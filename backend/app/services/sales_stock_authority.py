"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.75.0
Created      : 2026-10-01
Modified     : 2026-10-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Authoritative Sales Stock Movement & Ledger Engine (Phase S2)
"""

import uuid
import logging
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple

from fastapi import HTTPException
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.models.inventory import Product, ProductBatchStock, StockMovement, Warehouse
from app.models.sales import SalesInvoice, SalesInvoiceItem, SalesReturn, SalesReturnItem
from app.models.fulfillment import Dispatch, DispatchItem, PackingSlip
from app.models.profitability import ProductCostValuation, TransactionCostSnapshot
from .stock_synchronizer import StockSynchronizer
from .identity.engine import IdentityEngine
from .stock_ledger import StockLedger, MovementRequest, InternalCost

logger = logging.getLogger("smriti.sales_stock_authority")


class SalesStockAuthority:
    """
    Sole authoritative transactional stock movement engine for Sales and Return operations.
    Enforces the fundamental SMRITI Ledger Principle:
    
    LEDGER = SOURCE OF TRUTH.
    `products.stock` is strictly a synchronized materialized read cache.
    `stock_movements` and `product_batch_stocks` are the sole transactional authorities.
    
    Convergence & Single-Writer Invariants (v6.99.1):
    1. Single authoritative stock movement per business event:
       - Outward sales route strictly through `record_outward_sale` (including
         both direct SalesService and UnifiedSalesLedgerService/offline sync).
       - Sales return restocking occurs exclusively through `record_return_inward`
         upon approval/PROCESS (premature creation-time stock mutations removed).
       - Inward return movements restore both authoritative batch stocks
         (ProductBatchStock) and synchronize cached product stock.
       - Cancellation reversals route strictly through `record_sales_cancellation_reversal`.
    2. Zero double-deduction (Dispatch does not re-deduct stock if Invoice already deducted it;
       Invoice does not re-deduct if Dispatch already deducted it).
    3. Row-level locking on Product and Batch rows for concurrency protection.
    4. Strict idempotency and duplicate movement rejection across doc types (Sales Invoice,
       Distribution Order, Sales Return, etc.).
    5. Cost valuation integrity: unit cost resolves via CostValuation engine / snapshot,
       never falling back to selling price.
    6. Complete tenant isolation (company_id, branch_id).
    """

    @classmethod
    async def record_outward_sale(
        cls,
        session: AsyncSession,
        tenant_ctx: TenantContext,
        invoice_id: str,
        invoice_no: str,
        items: List[Dict[str, Any]],
        warehouse_id: Optional[str] = None,
        user_id: Optional[str] = None,
        allow_negative_stock: bool = False,
        reference_doc_type: str = "SALES_INVOICE",
    ) -> List[StockMovement]:
        """
        Records authoritative OUTWARD_SALE stock movements for a confirmed/posted Sales Invoice or Distribution Order.
        Atomically updates batch stocks and synchronizes product stock cache.
        """
        movements: List[StockMovement] = []
        requests: List[MovementRequest] = []
        user = user_id or "SYSTEM"

        ref_type_upper = (reference_doc_type or "SALES_INVOICE").upper().replace(" ", "_")
        if ref_type_upper in ("SALES_INVOICE", "SALES_INVOICE"):
            ref_types = ["SALES_INVOICE", "Sales Invoice", "SALES INVOICE"]
        elif ref_type_upper in ("DISTRIBUTION_ORDER", "DISTRIBUTION_ORDER"):
            ref_types = ["DISTRIBUTION_ORDER", "Distribution Order", "DISTRIBUTION ORDER"]
        else:
            ref_types = [reference_doc_type]

        for line_idx, line in enumerate(items):
            product_id = line.get("product_id")
            qty = Decimal(str(line.get("quantity") or 0))
            if qty <= Decimal("0.00"):
                continue

            # 1. Idempotency Check: Don't create duplicate movement for the same invoice/order line
            existing_stmt = select(StockMovement).where(
                StockMovement.company_id == tenant_ctx.company_id,
                StockMovement.reference_doc_type.in_(ref_types),
                StockMovement.reference_doc_id == invoice_id,
                StockMovement.product_id == product_id,
                StockMovement.movement_type == "OUTWARD_SALE",
                StockMovement.is_deleted.is_(False),
            )
            existing_mov = (await session.execute(existing_stmt)).scalars().first()
            if existing_mov:
                movements.append(existing_mov)
                continue

            # 1b. Check if dispatch already deducted physical stock for this invoice (bidirectional prevention)
            if ref_type_upper == "SALES_INVOICE":
                disp_check_stmt = select(func.count(StockMovement.id)).where(
                    StockMovement.company_id == tenant_ctx.company_id,
                    StockMovement.product_id == product_id,
                    StockMovement.movement_type == "OUTWARD_DISPATCH",
                    StockMovement.reference_doc_type.in_(["DISPATCH", "Dispatch"]),
                    StockMovement.is_deleted.is_(False),
                    StockMovement.reference_doc_id.in_(
                        select(Dispatch.id).join(PackingSlip, Dispatch.packing_slip_id == PackingSlip.id).where(
                            PackingSlip.sales_invoice_id == invoice_id,
                            PackingSlip.company_id == tenant_ctx.company_id,
                            PackingSlip.is_deleted.is_(False),
                        )
                    ),
                )
                disp_count = (await session.execute(disp_check_stmt)).scalar() or 0
                if disp_count > 0:
                    logger.info(
                        "Invoice %s line for product %s: Physical stock already deducted via prior dispatch. Skipping duplicate deduction.",
                        invoice_no, product_id
                    )
                    continue

            # Check tracking mode on product
            prod_check = (await session.execute(
                select(Product).where(
                    Product.id == product_id,
                    Product.company_id == tenant_ctx.company_id,
                    Product.is_deleted.is_(False),
                )
            )).scalars().first()
            if not prod_check:
                raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found for tenant.")
            if (prod_check.tracking_mode or "").lower() == "no-stock":
                continue

            src_module = "Distribution" if "DISTRIBUTION" in ref_type_upper else "Sales"
            cost_obj = None
            if line.get("unit_cost") is not None and Decimal(str(line.get("unit_cost"))) > Decimal("0.00"):
                cost_obj = InternalCost(
                    unit_cost=Decimal(str(line.get("unit_cost"))).quantize(Decimal("0.01")),
                    cost_source="EXPLICIT_LINE_UNIT_COST",
                )

            requests.append(
                MovementRequest(
                    company_id=tenant_ctx.company_id,
                    branch_id=tenant_ctx.branch_id,
                    product_id=product_id,
                    movement_type="OUTWARD_SALE",
                    quantity=qty,
                    reference_doc_type=reference_doc_type,
                    reference_doc_id=invoice_id,
                    warehouse_id=warehouse_id,
                    batch_no=line.get("batch_no"),
                    internal_cost=cost_obj,
                    allow_negative_stock=allow_negative_stock,
                    remarks=f"Authoritative stock deduction for {reference_doc_type} {invoice_no}",
                    source_module=src_module,
                    user=user,
                    line_ref=line.get("line_ref") or f"LINE-{line_idx + 1}",
                )
            )

        if requests:
            post_results = await StockLedger.post_many(session, requests)
            for r in post_results:
                movements.append(r.movement)

        return movements

    @classmethod
    async def record_return_inward(
        cls,
        session: AsyncSession,
        tenant_ctx: TenantContext,
        return_id: str,
        return_no: str,
        items: List[Dict[str, Any]],
        warehouse_id: Optional[str] = None,
        user_id: Optional[str] = None,
        original_invoice_id: Optional[str] = None,
    ) -> List[StockMovement]:
        """
        Records authoritative RETURN_INWARD stock movements for an approved/processed Sales Return.
        Uses historical unit cost from original invoice TransactionCostSnapshot if available,
        falling back to ProductCostValuation -> Product.cost_price.
        Atomically updates batch stocks and synchronizes product stock cache.
        """
        movements: List[StockMovement] = []
        requests: List[MovementRequest] = []
        user = user_id or "SYSTEM"

        for line in items:
            product_id = line.get("product_id")
            qty = Decimal(str(line.get("quantity") or 0))
            if qty <= Decimal("0.00"):
                continue

            # 1. Idempotency Check (supporting both SALES_RETURN and Sales Return)
            existing_stmt = select(StockMovement).where(
                StockMovement.company_id == tenant_ctx.company_id,
                StockMovement.reference_doc_type.in_(["SALES_RETURN", "Sales Return", "SALES RETURN"]),
                StockMovement.reference_doc_id == return_id,
                StockMovement.product_id == product_id,
                StockMovement.movement_type == "RETURN_INWARD",
                StockMovement.is_deleted.is_(False),
            )
            existing_mov = (await session.execute(existing_stmt)).scalars().first()
            if existing_mov:
                movements.append(existing_mov)
                continue

            # Check tracking mode on product
            prod_check = (await session.execute(
                select(Product).where(
                    Product.id == product_id,
                    Product.company_id == tenant_ctx.company_id,
                    Product.is_deleted.is_(False),
                )
            )).scalars().first()
            if not prod_check:
                raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found for tenant.")
            if (prod_check.tracking_mode or "").lower() == "no-stock":
                continue

            batch_no = line.get("batch_no")

            # 4. Resolve Historical Cost (Tier 1: Original Invoice Snapshot, Tier 2: ProductCostValuation, Tier 3: Product.cost_price)
            unit_cost = Decimal("0.00")
            val_method = "ZERO_COST_UNVALUED"

            if line.get("unit_cost") is not None and Decimal(str(line.get("unit_cost"))) > Decimal("0.00"):
                unit_cost = Decimal(str(line.get("unit_cost"))).quantize(Decimal("0.01"))
                val_method = "PROVIDED_UNIT_COST"
            elif original_invoice_id:
                inv_item_id = line.get("sales_invoice_item_id")
                snap = None
                if inv_item_id:
                    snap_stmt = select(TransactionCostSnapshot).where(
                        TransactionCostSnapshot.sales_invoice_id == original_invoice_id,
                        TransactionCostSnapshot.sales_invoice_item_id == str(inv_item_id),
                        TransactionCostSnapshot.company_id == tenant_ctx.company_id,
                        TransactionCostSnapshot.is_deleted == False
                    )
                    snap = (await session.execute(snap_stmt)).scalars().first()

                if snap and snap.cost_per_unit is not None and Decimal(str(snap.cost_per_unit)) > Decimal("0.00"):
                    unit_cost = Decimal(str(snap.cost_per_unit)).quantize(Decimal("0.01"))
                    val_method = f"HISTORICAL_SNAPSHOT ({snap.valuation_method_used or 'EXACT_LINE'})"
                else:
                    snaps_stmt = select(TransactionCostSnapshot).where(
                        TransactionCostSnapshot.sales_invoice_id == original_invoice_id,
                        TransactionCostSnapshot.product_id == prod_check.id,
                        TransactionCostSnapshot.company_id == tenant_ctx.company_id,
                        TransactionCostSnapshot.is_deleted == False
                    )
                    snaps = (await session.execute(snaps_stmt)).scalars().all()
                    if len(snaps) == 1 and snaps[0].cost_per_unit is not None and Decimal(str(snaps[0].cost_per_unit)) > Decimal("0.00"):
                        unit_cost = Decimal(str(snaps[0].cost_per_unit)).quantize(Decimal("0.01"))
                        val_method = f"HISTORICAL_SNAPSHOT ({snaps[0].valuation_method_used or 'SINGLE_LINE'})"
                    elif len(snaps) > 1 and len({Decimal(str(s.cost_per_unit)) for s in snaps if s.cost_per_unit}) == 1:
                        unit_cost = Decimal(str(snaps[0].cost_per_unit)).quantize(Decimal("0.01"))
                        val_method = f"HISTORICAL_SNAPSHOT ({snaps[0].valuation_method_used or 'UNIFORM_COST_LINES'})"
                    elif len(snaps) > 1:
                        logger.warning(
                            "[SMRITI-COST-002] Multi-line return for product %s on invoice %s missing exact line item linkage. Fallback marked as PROVISIONAL_AMBIGUOUS_LINE_FALLBACK.",
                            prod_check.id,
                            original_invoice_id,
                        )

            if unit_cost <= Decimal("0.00"):
                pcv_stmt = select(ProductCostValuation).where(
                    ProductCostValuation.product_id == prod_check.id,
                    ProductCostValuation.company_id == tenant_ctx.company_id,
                    ProductCostValuation.is_deleted == False
                )
                pcv = (await session.execute(pcv_stmt)).scalars().first()
                if pcv:
                    raw_method = "UNKNOWN"
                    if pcv.weighted_average_cost and Decimal(str(pcv.weighted_average_cost)) > Decimal("0.00"):
                        unit_cost = Decimal(str(pcv.weighted_average_cost)).quantize(Decimal("0.01"))
                        raw_method = "WEIGHTED_AVERAGE"
                    elif pcv.purchase_cost and Decimal(str(pcv.purchase_cost)) > Decimal("0.00"):
                        unit_cost = Decimal(str(pcv.purchase_cost)).quantize(Decimal("0.01"))
                        raw_method = "PURCHASE_COST"
                    elif pcv.last_purchase_cost and Decimal(str(pcv.last_purchase_cost)) > Decimal("0.00"):
                        unit_cost = Decimal(str(pcv.last_purchase_cost)).quantize(Decimal("0.01"))
                        raw_method = "LAST_PURCHASE"
                    elif pcv.standard_cost and Decimal(str(pcv.standard_cost)) > Decimal("0.00"):
                        unit_cost = Decimal(str(pcv.standard_cost)).quantize(Decimal("0.01"))
                        raw_method = "STANDARD_COST"

                    if unit_cost > Decimal("0.00"):
                        if not original_invoice_id:
                            val_method = f"UNLINKED_RETURN_POLICY ({raw_method})"
                        else:
                            val_method = f"PROVISIONAL_AMBIGUOUS_LINE_FALLBACK ({raw_method})"

            if unit_cost <= Decimal("0.00") and prod_check.cost_price and Decimal(str(prod_check.cost_price)) > Decimal("0.00"):
                unit_cost = Decimal(str(prod_check.cost_price)).quantize(Decimal("0.01"))
                if original_invoice_id:
                    val_method = "PROVISIONAL_AMBIGUOUS_LINE_FALLBACK (CATALOG_COST)"
                else:
                    val_method = "PROVISIONAL_CATALOG_COST"

            cost_obj = None
            if unit_cost > Decimal("0.00"):
                cost_obj = InternalCost(
                    unit_cost=unit_cost,
                    cost_source=val_method,
                )

            requests.append(
                MovementRequest(
                    company_id=tenant_ctx.company_id,
                    branch_id=tenant_ctx.branch_id,
                    product_id=product_id,
                    movement_type="RETURN_INWARD",
                    quantity=qty,
                    reference_doc_type="SALES_RETURN",
                    reference_doc_id=return_id,
                    warehouse_id=warehouse_id,
                    batch_no=batch_no,
                    internal_cost=cost_obj,
                    allow_negative_stock=True,
                    remarks=f"Authoritative stock return via Sales Return {return_no} (Cost: {unit_cost}, Method: {val_method})",
                    source_module="Sales",
                    user=user,
                    line_ref=line.get("line_ref") or f"LINE-{len(requests) + 1}",
                )
            )

        if requests:
            post_results = await StockLedger.post_many(session, requests)
            for r in post_results:
                movements.append(r.movement)

        return movements

    @classmethod
    async def record_sales_cancellation_reversal(
        cls,
        session: AsyncSession,
        tenant_ctx: TenantContext,
        invoice_id: str,
        invoice_no: str,
        user_id: Optional[str] = None,
        reason: Optional[str] = None,
    ) -> List[StockMovement]:
        """
        Creates compensating stock movements for a cancelled Sales Invoice.
        Reverses original OUTWARD_SALE movements via single-door StockLedger.post_many().
        """
        user = user_id or "SYSTEM"

        # Find original outward movements (supporting both SALES_INVOICE and Sales Invoice)
        orig_stmt = select(StockMovement).where(
            StockMovement.company_id == tenant_ctx.company_id,
            StockMovement.reference_doc_type.in_(["SALES_INVOICE", "Sales Invoice", "SALES INVOICE"]),
            StockMovement.reference_doc_id == invoice_id,
            StockMovement.movement_type == "OUTWARD_SALE",
            StockMovement.is_deleted.is_(False),
        )
        orig_movements = (await session.execute(orig_stmt)).scalars().all()
        if not orig_movements:
            return []

        # Check if cancellation reversal already exists
        rev_check_stmt = select(StockMovement).where(
            StockMovement.company_id == tenant_ctx.company_id,
            StockMovement.reference_doc_type.in_(["SALES_INVOICE_CANCEL", "Sales Invoice Cancel"]),
            StockMovement.reference_doc_id == invoice_id,
            StockMovement.is_deleted.is_(False),
        )
        existing_rev = (await session.execute(rev_check_stmt)).scalars().all()
        if existing_rev:
            return list(existing_rev)

        requests: List[MovementRequest] = []
        for om in orig_movements:
            cost_obj = None
            if om.unit_cost is not None:
                cost_obj = InternalCost(
                    unit_cost=Decimal(str(om.unit_cost)),
                    cost_source="ORIGINAL_OUTWARD_REVERSAL",
                )
            requests.append(
                MovementRequest(
                    company_id=tenant_ctx.company_id,
                    branch_id=tenant_ctx.branch_id or om.branch_id,
                    product_id=om.product_id,
                    quantity=Decimal(str(om.quantity)),
                    movement_type="RETURN_INWARD",
                    reference_doc_type="SALES_INVOICE_CANCEL",
                    reference_doc_id=invoice_id,
                    line_ref=om.id,
                    warehouse_id=om.warehouse_id,
                    batch_no=om.batch,
                    allow_negative_stock=True,
                    internal_cost=cost_obj,
                    remarks=f"Compensating stock reversal for cancelled Invoice {invoice_no}: {reason or 'Cancelled'}",
                    source_module="Sales",
                    user=user,
                )
            )

        post_results = await StockLedger.post_many(session, requests)
        return [res.movement for res in post_results]

    @classmethod
    async def record_dispatch_outward(
        cls,
        session: AsyncSession,
        tenant_ctx: TenantContext,
        dispatch_id: str,
        dispatch_no: str,
        packing_slip_id: str,
        items: List[Dict[str, Any]],
        invoice_id: Optional[str] = None,
        source_order_id: Optional[str] = None,
        user_id: Optional[str] = None,
        allow_negative_stock: bool = False,
    ) -> List[StockMovement]:
        """
        Records dispatch movements ensuring ZERO double-deduction.
        If an invoice already deducted stock via OUTWARD_SALE, dispatch does NOT deduct physical stock again.
        If dispatch is fulfilling a Sales Order reservation, physical stock is deducted via StockLedger and reservation released.
        """
        user = user_id or "SYSTEM"

        # Check if invoice already deducted physical stock
        invoice_already_deducted = False
        if invoice_id:
            inv_mov_stmt = select(func.count(StockMovement.id)).where(
                StockMovement.company_id == tenant_ctx.company_id,
                StockMovement.reference_doc_type.in_(["SALES_INVOICE", "Sales Invoice", "SALES INVOICE"]),
                StockMovement.reference_doc_id == invoice_id,
                StockMovement.movement_type == "OUTWARD_SALE",
                StockMovement.is_deleted.is_(False),
            )
            inv_mov_count = (await session.execute(inv_mov_stmt)).scalar() or 0
            if inv_mov_count > 0:
                invoice_already_deducted = True

        movements: List[StockMovement] = []
        requests: List[MovementRequest] = []
        pending_release_items: List[Tuple[str, Decimal]] = []

        for idx, line in enumerate(items):
            product_id = line.get("product_id")
            qty = Decimal(str(line.get("quantity") or 0))
            if qty <= Decimal("0.00") or not product_id:
                continue

            if invoice_already_deducted:
                # Stock was already deducted when invoice posted.
                # DO NOT double-deduct physical stock!
                logger.info(
                    "Dispatch %s for invoice %s: Physical stock already deducted via invoice. Skipping duplicate deduction.",
                    dispatch_no, invoice_id
                )
                if source_order_id:
                    pending_release_items.append((product_id, qty))
                continue

            requests.append(
                MovementRequest(
                    company_id=tenant_ctx.company_id,
                    branch_id=tenant_ctx.branch_id,
                    product_id=product_id,
                    quantity=qty,
                    movement_type="OUTWARD_DISPATCH",
                    reference_doc_type="DISPATCH",
                    reference_doc_id=dispatch_id,
                    line_ref=str(idx),
                    warehouse_id=line.get("warehouse_id"),
                    batch_no=line.get("batch") or line.get("batch_no"),
                    allow_negative_stock=allow_negative_stock,
                    remarks=f"Authoritative dispatch stock deduction: {dispatch_no}",
                    source_module="Fulfillment",
                    user=user,
                )
            )
            if source_order_id:
                pending_release_items.append((product_id, qty))

        if requests:
            post_results = await StockLedger.post_many(session, requests)
            movements.extend([res.movement for res in post_results])

        # Release reserved stock for SO fulfilling dispatch
        if pending_release_items:
            for pid, q in pending_release_items:
                prod_stmt = select(Product).where(
                    Product.id == pid,
                    Product.company_id == tenant_ctx.company_id,
                    Product.is_deleted.is_(False),
                ).with_for_update()
                product = (await session.execute(prod_stmt)).scalars().first()
                if product and product.reserved_stock:
                    product.reserved_stock = max(Decimal("0.00"), Decimal(str(product.reserved_stock)) - q)
                    session.add(product)
            await session.flush()

        return movements

