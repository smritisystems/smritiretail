from datetime import date
from decimal import Decimal
import uuid

import pytest
from sqlalchemy import select
from fastapi import HTTPException

from app.api.deps import TenantContext
from app.models.inventory import Product, StockMovement
from app.models.item_master import Item, ItemVariant
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.tenant import Branch, Company
from app.services.stock_ledger import StockLedger
from app.services.stock_ledger_query import get_movement_business_date_expr
from app.services.tt2026_sales_stock_reconciliation import reconcile_tt2026_sales_stock


async def _seed_invoice(db_session, suffix: str):
    company = Company(
        id=f"COMP-TTREC-{suffix}",
        name="TT reconciliation test",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=f"BR-TTREC-{suffix}",
        code=f"TTREC-{suffix}",
        name="TT reconciliation branch",
        company_id=company.id,
        is_active=True,
        is_deleted=False,
    )
    item = Item(
        id=f"ITEM-TTREC-{suffix}",
        company_id=company.id,
        branch_id=branch.id,
        item_code=f"STYLE-{suffix}",
        item_name="Reconciliation test item",
        uom="PRS",
        is_active=True,
        is_deleted=False,
    )
    variant = ItemVariant(
        id=f"VAR-TTREC-{suffix}",
        company_id=company.id,
        item_id=item.id,
        variant_sku=f"SKU-TTREC-{suffix}",
        variant_name="Reconciliation test variant",
        is_active=True,
        is_deleted=False,
    )
    product = Product(
        id=f"PROD-TTREC-{suffix}",
        company_id=company.id,
        branch_id=branch.id,
        item_id=item.id,
        item_variant_id=variant.id,
        code=f"CODE-{suffix}",
        sku=f"SKU-TTREC-{suffix}",
        name="Reconciliation test product",
        category="Test",
        barcode=f"BAR-{suffix}",
        price=Decimal("100.00"),
        mrp=Decimal("100.00"),
        gst_percentage=Decimal("18.00"),
        stock=0,
        is_active=True,
        is_deleted=False,
    )
    invoice = SalesInvoice(
        id=f"INV-TTREC-{suffix}",
        company_id=company.id,
        branch_id=branch.id,
        invoice_no=f"TT2026-{suffix}",
        date=date(2026, 1, 15),
        status="Submitted",
        taxable_value=Decimal("600.00"),
        tax_total=Decimal("108.00"),
        grand_total=Decimal("708.00"),
        warehouse_id=None,
        is_deleted=False,
    )
    line = SalesInvoiceItem(
        company_id=company.id,
        branch_id=branch.id,
        invoice_id=invoice.id,
        product_id=None,
        item_id=item.id,
        variant_id=variant.id,
        code=product.code,
        name=product.name,
        quantity=Decimal("6.0000"),
        price=Decimal("100.00"),
        total_amount=Decimal("708.00"),
        is_deleted=False,
    )
    db_session.add_all([company, branch])
    await db_session.commit()
    db_session.add(item)
    await db_session.commit()
    db_session.add(variant)
    await db_session.commit()
    db_session.add(product)
    await db_session.commit()
    db_session.add(invoice)
    await db_session.commit()
    db_session.add(line)
    await db_session.commit()
    await StockLedger.post_admin_opening_stock(
        db_session,
        company.id,
        product.id,
        Decimal("5"),
        "Test opening balance",
    )
    await db_session.commit()
    return company, branch, product, invoice


@pytest.mark.asyncio
async def test_tt2026_reconciliation_preview_is_read_only_and_shows_shortage(db_session):
    suffix = uuid.uuid4().hex[:8]
    company, branch, product, invoice = await _seed_invoice(db_session, suffix)
    sibling_variant = ItemVariant(
        id=f"VAR-TTREC-SIB-{suffix}",
        company_id=company.id,
        item_id=product.item_id,
        variant_sku=f"SKU-TTREC-SIB-{suffix}",
        variant_name="Sibling variant",
        is_active=True,
        is_deleted=False,
    )
    sibling_product = Product(
        id=f"PROD-TTREC-SIB-{suffix}",
        company_id=company.id,
        branch_id=branch.id,
        item_id=product.item_id,
        item_variant_id=sibling_variant.id,
        code=f"CODE-TTREC-SIB-{suffix}",
        sku=sibling_variant.variant_sku,
        name="Sibling variant product",
        category="Test",
        barcode=f"BAR-TTREC-SIB-{suffix}",
        price=Decimal("100.00"),
        mrp=Decimal("100.00"),
        gst_percentage=Decimal("18.00"),
        stock=0,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(sibling_variant)
    await db_session.commit()
    db_session.add(sibling_product)
    await db_session.commit()
    await StockLedger.post_admin_opening_stock(
        db_session,
        company.id,
        sibling_product.id,
        Decimal("100"),
        "Sibling variant opening balance",
    )
    await db_session.commit()

    result = await reconcile_tt2026_sales_stock(
        session=db_session,
        tenant_ctx=TenantContext(company_id=company.id, branch_id=branch.id),
        invoice_ids=[invoice.id],
        user_id="admin",
        reason="Approved inventory reconciliation",
        dry_run=True,
    )

    assert result["dry_run"] is True
    assert result["planned_stock_movements"] == 1
    assert result["negative_sku_count"] == 1
    assert result["total_current_on_hand"] == "5.00"
    assert result["total_pending_sale_out"] == "6.0000"
    assert result["total_projected_on_hand"] == "-1.0000"
    assert result["sku_preview"][0]["current_on_hand"] == "5.00"
    assert result["sku_preview"][0]["pending_sale_out"] == "6.0000"
    assert result["sku_preview"][0]["projected_on_hand"] == "-1.0000"
    movements = (
        await db_session.execute(
            select(StockMovement).where(
                StockMovement.company_id == company.id,
                StockMovement.reference_doc_id == invoice.id,
                StockMovement.movement_type == "OUTWARD_SALE",
            )
        )
    ).scalars().all()
    assert movements == []


@pytest.mark.asyncio
async def test_tt2026_reconciliation_posts_stock_only_with_business_date_and_reason(db_session):
    suffix = uuid.uuid4().hex[:8]
    company, branch, product, invoice = await _seed_invoice(db_session, suffix)

    result = await reconcile_tt2026_sales_stock(
        session=db_session,
        tenant_ctx=TenantContext(company_id=company.id, branch_id=branch.id),
        invoice_ids=[invoice.id],
        user_id="sysadmin",
        reason="Authorized negative stock reconciliation",
        dry_run=False,
        authorize_negative_stock=True,
    )

    assert result["posted_invoice_count"] == 1
    movement = (
        await db_session.execute(
            select(StockMovement).where(
                StockMovement.company_id == company.id,
                StockMovement.reference_doc_id == invoice.id,
                StockMovement.movement_type == "OUTWARD_SALE",
            )
        )
    ).scalars().one()
    assert movement.business_date == invoice.date
    assert movement.approval == "SYSADMIN_TT2026_RECONCILIATION"
    assert "Authorized negative stock reconciliation" in movement.remarks
    assert movement.user == "sysadmin"
    assert movement.source_module == "INVENTORY_RECONCILIATION"
    assert invoice.status == "Submitted"
    movement_business_date = (
        await db_session.execute(
            select(get_movement_business_date_expr()).where(StockMovement.id == movement.id)
        )
    ).scalar_one()
    assert movement_business_date == invoice.date

    replay = await reconcile_tt2026_sales_stock(
        session=db_session,
        tenant_ctx=TenantContext(company_id=company.id, branch_id=branch.id),
        invoice_ids=[invoice.id],
        user_id="sysadmin",
        reason="Authorized negative stock reconciliation",
        dry_run=False,
        authorize_negative_stock=True,
    )
    assert replay["posted_invoice_count"] == 0
    assert replay["already_reconciled_invoice_products"] == 1


@pytest.mark.asyncio
async def test_tt2026_post_requires_explicit_negative_stock_authorization(db_session):
    suffix = uuid.uuid4().hex[:8]
    company, branch, product, invoice = await _seed_invoice(db_session, suffix)

    with pytest.raises(HTTPException) as exc_info:
        await reconcile_tt2026_sales_stock(
            session=db_session,
            tenant_ctx=TenantContext(company_id=company.id, branch_id=branch.id),
            invoice_ids=[invoice.id],
            user_id="sysadmin",
            reason="Approved inventory reconciliation",
            dry_run=False,
            authorize_negative_stock=False,
        )

    assert exc_info.value.status_code == 422
    movements = (
        await db_session.execute(
            select(StockMovement).where(
                StockMovement.company_id == company.id,
                StockMovement.reference_doc_id == invoice.id,
                StockMovement.movement_type == "OUTWARD_SALE",
            )
        )
    ).scalars().all()
    assert movements == []
