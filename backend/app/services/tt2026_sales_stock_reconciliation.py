from collections import defaultdict
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy import String, and_, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.models.fulfillment import Dispatch, PackingSlip
from app.models.inventory import Product, StockMovement
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.services.sales_stock_authority import SalesStockAuthority
from app.services.stock_ledger_query import get_signed_movement_quantity_expr
from app.services.stock_movement_types import ALL_MOVEMENT_TYPES

TT2026_PREFIX = "TT2026"
_SALE_REFERENCE_TYPES = ("SALES_INVOICE", "Sales Invoice", "SALES INVOICE")
_ZERO = Decimal("0")


def _product_identity_join():
    return or_(
        StockMovement.product_id == Product.id,
        and_(Product.item_id.is_not(None), StockMovement.item_id == Product.item_id),
        and_(Product.item_variant_id.is_not(None), StockMovement.variant_id == Product.item_variant_id),
        and_(Product.variant_id.is_not(None), StockMovement.variant_id == cast(Product.variant_id, String)),
    )


async def reconcile_tt2026_sales_stock(
    session: AsyncSession,
    tenant_ctx: TenantContext,
    invoice_ids: list[str],
    user_id: str,
    reason: str,
    dry_run: bool = True,
    authorize_negative_stock: bool = False,
) -> dict[str, Any]:
    if not invoice_ids or len(invoice_ids) != len(set(invoice_ids)):
        raise HTTPException(status_code=422, detail="Provide a non-empty list of unique invoice IDs.")
    if not dry_run and not authorize_negative_stock:
        raise HTTPException(
            status_code=422,
            detail="Posting requires explicit authorization to allow negative stock.",
        )
    if not reason.strip():
        raise HTTPException(status_code=422, detail="A reconciliation reason is required.")

    invoice_stmt = select(SalesInvoice).where(
        SalesInvoice.company_id == tenant_ctx.company_id,
        SalesInvoice.id.in_(invoice_ids),
        SalesInvoice.is_deleted.is_(False),
    )
    if tenant_ctx.branch_id:
        invoice_stmt = invoice_stmt.where(
            or_(SalesInvoice.branch_id == tenant_ctx.branch_id, SalesInvoice.branch_id.is_(None))
        )
    invoices = (await session.execute(invoice_stmt.order_by(SalesInvoice.date, SalesInvoice.invoice_no))).scalars().all()
    if len(invoices) != len(invoice_ids):
        raise HTTPException(status_code=404, detail="One or more invoices were not found in the active company/branch.")
    if any(not (invoice.invoice_no or "").startswith(TT2026_PREFIX) for invoice in invoices):
        raise HTTPException(status_code=422, detail="Only TT2026-prefixed invoices can be reconciled.")
    if any((invoice.status or "").casefold() != "submitted" for invoice in invoices):
        raise HTTPException(status_code=409, detail="All selected invoices must be Submitted.")

    selected_ids = [invoice.id for invoice in invoices]
    lines = (
        await session.execute(
            select(SalesInvoiceItem)
            .where(
                SalesInvoiceItem.invoice_id.in_(selected_ids),
                SalesInvoiceItem.is_deleted.is_(False),
            )
            .order_by(SalesInvoiceItem.invoice_id, SalesInvoiceItem.line_no, SalesInvoiceItem.id)
        )
    ).scalars().all()
    invoice_by_id = {invoice.id: invoice for invoice in invoices}
    for line in lines:
        if line.company_id not in (None, tenant_ctx.company_id):
            raise HTTPException(status_code=409, detail=f"Invoice line {line.id} has a conflicting company.")
        expected_branch = invoice_by_id[line.invoice_id].branch_id or tenant_ctx.branch_id
        if line.branch_id not in (None, expected_branch):
            raise HTTPException(status_code=409, detail=f"Invoice line {line.id} has a conflicting branch.")
    product_ids = sorted({line.product_id for line in lines if line.product_id})
    products = (
        await session.execute(
            select(Product).where(
                Product.company_id == tenant_ctx.company_id,
                Product.id.in_(product_ids),
                Product.is_deleted.is_(False),
            )
        )
    ).scalars().all() if product_ids else []
    product_by_id = {product.id: product for product in products}
    missing_product_ids = set(product_ids) - set(product_by_id)
    if missing_product_ids:
        raise HTTPException(status_code=404, detail=f"Invoice products not found: {sorted(missing_product_ids)}")

    expected: dict[tuple[str, str], Decimal] = defaultdict(lambda: _ZERO)
    movement_groups: dict[tuple[str, str, str | None], Decimal] = defaultdict(lambda: _ZERO)
    movement_group_counts: dict[tuple[str, str], int] = defaultdict(int)
    movement_groups_by_invoice: dict[str, list[tuple[str, str, str | None]]] = defaultdict(list)
    for line in lines:
        if not line.product_id:
            continue
        quantity = Decimal(str(line.quantity or 0))
        if quantity < _ZERO:
            raise HTTPException(status_code=409, detail=f"Negative invoice-line quantity on line {line.id}.")
        if quantity > _ZERO and (product_by_id[line.product_id].tracking_mode or "").casefold() != "no-stock":
            expected[(line.invoice_id, line.product_id)] += quantity
            group_key = (line.invoice_id, line.product_id, line.batch_no)
            if group_key not in movement_groups:
                movement_group_counts[(line.invoice_id, line.product_id)] += 1
                movement_groups_by_invoice[line.invoice_id].append(group_key)
            movement_groups[group_key] += quantity

    posted_stmt = (
        select(
            StockMovement.reference_doc_id,
            StockMovement.product_id,
            StockMovement.batch,
            func.sum(StockMovement.quantity),
        )
        .where(
            StockMovement.company_id == tenant_ctx.company_id,
            StockMovement.reference_doc_type.in_(_SALE_REFERENCE_TYPES),
            StockMovement.reference_doc_id.in_(selected_ids),
            StockMovement.movement_type == "OUTWARD_SALE",
            StockMovement.is_deleted.is_(False),
        )
        .group_by(StockMovement.reference_doc_id, StockMovement.product_id, StockMovement.batch)
    )
    posted_rows = (await session.execute(posted_stmt)).all()
    posted_by_product: dict[tuple[str, str], Decimal] = defaultdict(lambda: _ZERO)
    for invoice_id, product_id, batch_no, quantity in posted_rows:
        group_key = (invoice_id, product_id, batch_no)
        expected_quantity = movement_groups.get(group_key, _ZERO)
        posted_quantity = Decimal(str(quantity or 0))
        if posted_quantity != expected_quantity:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Existing sales movement quantity does not match invoice lines for invoice "
                    f"{invoice_id}, product {product_id}, batch {batch_no}; "
                    f"expected {expected_quantity}, found {posted_quantity}."
                ),
            )
        posted_by_product[(invoice_id, product_id)] += posted_quantity

    dispatch_stmt = (
        select(PackingSlip.sales_invoice_id, StockMovement.product_id)
        .select_from(StockMovement)
        .join(Dispatch, Dispatch.id == StockMovement.reference_doc_id)
        .join(PackingSlip, PackingSlip.id == Dispatch.packing_slip_id)
        .where(
            StockMovement.company_id == tenant_ctx.company_id,
            StockMovement.movement_type == "OUTWARD_DISPATCH",
            StockMovement.is_deleted.is_(False),
            Dispatch.company_id == tenant_ctx.company_id,
            Dispatch.is_deleted.is_(False),
            PackingSlip.company_id == tenant_ctx.company_id,
            PackingSlip.is_deleted.is_(False),
            PackingSlip.sales_invoice_id.in_(selected_ids),
        )
        .distinct()
    )
    dispatch_covered = {
        (invoice_id, product_id)
        for invoice_id, product_id in (await session.execute(dispatch_stmt)).all()
    }

    fully_posted: set[tuple[str, str]] = set()
    for key, quantity in posted_by_product.items():
        expected_quantity = expected.get(key, _ZERO)
        if quantity != expected_quantity:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Existing sales movement quantity does not match invoice lines for invoice "
                    f"{key[0]}, product {key[1]}; expected {expected_quantity}, found {quantity}."
                ),
            )
        if key in dispatch_covered:
            raise HTTPException(
                status_code=409,
                detail=f"Both sales and dispatch movements already exist for invoice {key[0]}, product {key[1]}.",
            )
        fully_posted.add(key)

    pending: dict[str, Decimal] = defaultdict(lambda: _ZERO)
    pending_movements = 0
    dispatch_covered_movements = 0
    for key, quantity in expected.items():
        invoice_id, product_id = key
        group_count = movement_group_counts.get(key, 0)
        if key in fully_posted:
            continue
        if key in dispatch_covered:
            dispatch_covered_movements += group_count
            continue
        pending[product_id] += quantity
        pending_movements += group_count

    unknown_type = func.upper(func.coalesce(StockMovement.movement_type, ""))
    unknown_stmt = (
        select(Product.id, func.count(StockMovement.id))
        .select_from(Product)
        .join(
            StockMovement,
            and_(
                StockMovement.company_id == tenant_ctx.company_id,
                StockMovement.is_deleted.is_(False),
                _product_identity_join(),
            ),
        )
        .where(
            Product.company_id == tenant_ctx.company_id,
            Product.id.in_(pending.keys()),
            unknown_type.notin_(tuple(ALL_MOVEMENT_TYPES)),
        )
        .group_by(Product.id)
    )
    unknown_rows = (await session.execute(unknown_stmt)).all() if pending else []
    if unknown_rows:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot reconcile products with unclassified stock movements: {[row[0] for row in unknown_rows]}",
        )

    balance_stmt = (
        select(Product.id, func.coalesce(func.sum(get_signed_movement_quantity_expr()), 0))
        .select_from(Product)
        .outerjoin(
            StockMovement,
            and_(
                StockMovement.company_id == tenant_ctx.company_id,
                StockMovement.is_deleted.is_(False),
                _product_identity_join(),
            ),
        )
        .where(
            Product.company_id == tenant_ctx.company_id,
            Product.id.in_(pending.keys()),
        )
        .group_by(Product.id)
    )
    balance_rows = (await session.execute(balance_stmt)).all() if pending else []
    balances = {product_id: Decimal(str(quantity or 0)) for product_id, quantity in balance_rows}

    sku_preview = []
    for product_id, deduction in sorted(pending.items(), key=lambda entry: (product_by_id[entry[0]].sku or "", entry[0])):
        product = product_by_id[product_id]
        current = balances.get(product_id, _ZERO)
        projected = current - deduction
        sku_preview.append(
            {
                "product_id": product_id,
                "sku": product.sku or product.code,
                "product_name": product.name,
                "current_on_hand": str(current),
                "pending_sale_out": str(deduction),
                "projected_on_hand": str(projected),
                "will_be_negative": projected < _ZERO,
            }
        )

    negative_products = [item for item in sku_preview if item["will_be_negative"]]
    already_posted_count = len(fully_posted)
    response = {
        "dry_run": dry_run,
        "invoice_count": len(invoices),
        "already_reconciled_invoice_products": already_posted_count,
        "dispatch_covered_invoice_products": sum(
            1 for key in expected if key in dispatch_covered and key not in fully_posted
        ),
        "planned_stock_movements": pending_movements,
        "dispatch_covered_movements": dispatch_covered_movements,
        "negative_sku_count": len(negative_products),
        "negative_shortage_units": str(
            sum((abs(Decimal(item["projected_on_hand"])) for item in negative_products), _ZERO)
        ),
        "sku_preview": sku_preview,
        "posted_invoice_ids": [],
    }
    if dry_run:
        return response

    pending_invoice_ids = {
        invoice_id
        for invoice_id, product_id in expected
        if (invoice_id, product_id) not in fully_posted
        and (invoice_id, product_id) not in dispatch_covered
    }
    for invoice in invoices:
        if invoice.id not in pending_invoice_ids:
            continue
        invoice_lines = []
        for invoice_id, product_id, batch_no in movement_groups_by_invoice[invoice.id]:
            invoice_lines.append({
                "product_id": product_id,
                "quantity": movement_groups[(invoice_id, product_id, batch_no)],
                "batch_no": batch_no,
                "line_ref": f"TT2026-{product_id}-{batch_no or 'UNBATCHED'}",
            })
        await SalesStockAuthority.record_outward_sale(
            session=session,
            tenant_ctx=TenantContext(
                company_id=tenant_ctx.company_id,
                branch_id=invoice.branch_id or tenant_ctx.branch_id,
                role=tenant_ctx.role,
            ),
            invoice_id=invoice.id,
            invoice_no=invoice.invoice_no,
            items=invoice_lines,
            warehouse_id=invoice.warehouse_id,
            user_id=user_id,
            allow_negative_stock=True,
            business_date=invoice.date,
            approval="SYSADMIN_TT2026_RECONCILIATION",
            source_module="INVENTORY_RECONCILIATION",
            movement_remarks=f"TT2026 stock-only reconciliation; authorized by SYSADMIN. Reason: {reason.strip()}",
        )
        response["posted_invoice_ids"].append(invoice.id)

    await session.commit()
    response["posted_invoice_count"] = len(response["posted_invoice_ids"])
    response["posted_movement_count"] = pending_movements
    return response
