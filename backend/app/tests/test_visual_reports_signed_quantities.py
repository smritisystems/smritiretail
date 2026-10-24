"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.1
Created      : 2026-10-21
Modified     : 2026-10-21
Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Visual Reports Signed Movement & Reconciliation Test Suite
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import pytest
from sqlalchemy import select

from app.models.tenant import Company, Branch
from app.models.inventory import Product, StockMovement
from app.models.sales import SalesInvoice, SalesOrder, SalesOrderItem, SalesOrderReservation
from app.services.stock_synchronizer import StockSynchronizer
from app.services.visual_reports_service import VisualReportsService


async def _create_tenant(session, s: str):
    comp = Company(
        id=f"comp-vr-sgn-{s}",
        name=f"Signed Movement Test Co {s}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    br = Branch(
        id=f"br-vr-sgn-{s}",
        company_id=comp.id,
        name=f"Main Branch {s}",
        code=f"BR-{s.upper()}",
        is_active=True,
    )
    session.add_all([comp, br])
    await session.commit()
    return comp, br


@pytest.mark.asyncio
async def test_visual_reports_signed_quantities_and_timeline_reconciliation(db_session):
    """
    Test that VisualReportsService correctly calculates on-hand, category position,
    top-SKU, and running stock-flow timeline using the signed-quantity helper.
    Proves that on-hand matches StockSynchronizer.sync_product_stock_cache for
    INWARD_GRN + OUTWARD_SALE + OUTWARD_ECOM + ADJUSTMENT movements.
    """
    s = uuid.uuid4().hex[:6]
    comp, br = await _create_tenant(db_session, s)

    # 1. Create product
    prod = Product(
        id=f"prod-vr-{s}",
        company_id=comp.id,
        branch_id=br.id,
        sku=f"SKU-VR-{s.upper()}",
        code=f"PRD-{s.upper()}",
        barcode=f"BC-{s.upper()}",
        name=f"Test Running Shoe {s}",
        category="Footwear",
        stock=0,
        is_active=True,
    )
    db_session.add(prod)
    await db_session.commit()

    # 2. Add diverse stock movements across two dates
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    two_days_ago = today - timedelta(days=2)

    # Opening movement (2 days ago): INWARD_GRN +100
    m1 = StockMovement(
        id=f"mov-1-{s}",
        company_id=comp.id,
        branch_id=br.id,
        product_id=prod.id,
        product_name=prod.name,
        sku=prod.sku,
        movement_type="INWARD_GRN",
        quantity=Decimal("100.00"),
        reference_doc_type="GRN",
        reference_doc_id=f"GRN-001-{s}",
        created_at=datetime.combine(two_days_ago, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=10),
    )
    # Yesterday: OUTWARD_SALE 20 (stored as positive 20.00)
    m2 = StockMovement(
        id=f"mov-2-{s}",
        company_id=comp.id,
        branch_id=br.id,
        product_id=prod.id,
        product_name=prod.name,
        sku=prod.sku,
        movement_type="OUTWARD_SALE",
        quantity=Decimal("20.00"),
        reference_doc_type="SALES_INVOICE",
        reference_doc_id=f"INV-001-{s}",
        created_at=datetime.combine(yesterday, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=14),
    )
    # Today: OUTWARD_ECOM 10 (stored as positive 10.00)
    m3 = StockMovement(
        id=f"mov-3-{s}",
        company_id=comp.id,
        branch_id=br.id,
        product_id=prod.id,
        product_name=prod.name,
        sku=prod.sku,
        movement_type="OUTWARD_ECOM",
        quantity=Decimal("10.00"),
        reference_doc_type="ECOM_ORDER",
        reference_doc_id=f"ECOM-001-{s}",
        created_at=datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=9),
    )
    # Today: ADJUSTMENT -5 (signed -5.00)
    m4 = StockMovement(
        id=f"mov-4-{s}",
        company_id=comp.id,
        branch_id=br.id,
        product_id=prod.id,
        product_name=prod.name,
        sku=prod.sku,
        movement_type="ADJUSTMENT",
        quantity=Decimal("-5.00"),
        reference_doc_type="STOCK_ADJUSTMENT",
        reference_doc_id=f"ADJ-001-{s}",
        created_at=datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=11),
    )
    db_session.add_all([m1, m2, m3, m4])
    await db_session.commit()

    # 3. Synchronize authoritative product stock cache
    cached_sync = await StockSynchronizer.sync_product_stock_cache(
        session=db_session,
        product_id=prod.id,
        company_id=comp.id,
    )
    # Authoritative calculation: 100 - 20 - 10 - 5 = 65
    assert cached_sync == Decimal("65"), f"Expected synchronizer to yield 65, got {cached_sync}"

    # Also add an active reservation with valid order and order item
    so = SalesOrder(
        id=f"so-{s}",
        order_no=f"SO-{s}",
        customer_name="Alpha Retail",
        grand_total=Decimal("2000.00"),
        status="Draft",
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(so)
    await db_session.flush()

    so_item = SalesOrderItem(
        order_id=so.id,
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("15.00"),
        price=Decimal("100.00"),
        total_amount=Decimal("1500.00"),
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(so_item)
    await db_session.flush()

    resv = SalesOrderReservation(
        id=f"resv-{s}",
        company_id=comp.id,
        branch_id=br.id,
        order_id=so.id,
        order_item_id=so_item.id,
        barcode=prod.barcode,
        product_id=prod.id,
        idempotency_key=f"idem-resv-{s}",
        requested_quantity=Decimal("15.00"),
        reserved_quantity=Decimal("15.00"),
        released_quantity=Decimal("0.00"),
        consumed_quantity=Decimal("0.00"),
        status="ACTIVE",
    )
    db_session.add(resv)
    await db_session.commit()

    # 4. Invoices test: 1 completed, 1 draft, 1 cancelled
    inv_valid = SalesInvoice(
        id=f"inv-v-{s}",
        company_id=comp.id,
        branch_id=br.id,
        invoice_no=f"INV-VAL-{s}",
        date=today,
        status="Completed",
        grand_total=Decimal("2500.00"),
        is_deleted=False,
    )
    inv_draft = SalesInvoice(
        id=f"inv-d-{s}",
        company_id=comp.id,
        branch_id=br.id,
        invoice_no=f"INV-DRF-{s}",
        date=today,
        status="Draft",
        grand_total=Decimal("1500.00"),
        is_deleted=False,
    )
    inv_cancel = SalesInvoice(
        id=f"inv-c-{s}",
        company_id=comp.id,
        branch_id=br.id,
        invoice_no=f"INV-CNC-{s}",
        date=today,
        status="Cancelled",
        grand_total=Decimal("3000.00"),
        is_deleted=False,
    )
    db_session.add_all([inv_valid, inv_draft, inv_cancel])
    await db_session.commit()

    # 5. Query Dashboard Summary with window: yesterday to today
    # Opening before yesterday: m1 (+100)
    # Yesterday: m2 (-20) -> running on-hand = 80
    # Today: m3 (-10) + m4 (-5) = -15 -> running on-hand = 65
    summary = await VisualReportsService.get_dashboard_summary(
        session=db_session,
        company_id=comp.id,
        start_date=yesterday,
        end_date=today,
    )

    # Check KPI on-hand: MUST BE 65 (NOT 125 or 135!)
    kpi_on_hand = next(k for k in summary.kpis if k.id == "on_hand")
    assert kpi_on_hand.numeric_value == 65.0, f"Expected on-hand 65.0, got {kpi_on_hand.numeric_value}"

    # Check category position: MUST BE 65
    cat_pos = next(c for c in summary.category_positions if c.category == "Footwear")
    assert cat_pos.on_hand == 65, f"Expected category on-hand 65, got {cat_pos.on_hand}"

    # Check top SKU on-hand: MUST BE 65
    top_sku = next((t for t in summary.top_reserved_skus if t.sku == prod.sku), None)
    if top_sku:
        assert top_sku.on_hand == 65, f"Expected top SKU on-hand 65, got {top_sku.on_hand}"

    # Check invoice count: MUST BE 1 (draft & cancelled excluded!)
    stage_inv = next(s for s in summary.workflow_stages if s.id == "stage_inv")
    assert stage_inv.count == 1, f"Expected 1 valid invoice count, got {stage_inv.count}"

    # Check stock-flow timeline running balances
    assert len(summary.stock_flow_timeline) >= 2, "Expected at least 2 timeline points"
    point_yesterday = next(p for p in summary.stock_flow_timeline if p.date == yesterday.isoformat())
    point_today = next(p for p in summary.stock_flow_timeline if p.date == today.isoformat())

    # Opening balance before yesterday = 100.
    # Yesterday net = -20 -> running on-hand = 80. Dispatched = 20.
    assert point_yesterday.on_hand == 80, f"Expected yesterday on-hand 80, got {point_yesterday.on_hand}"
    assert point_yesterday.dispatched == 20, f"Expected yesterday dispatched 20, got {point_yesterday.dispatched}"

    # Today net = -10 (ecom) - 5 (adj) = -15 -> running on-hand = 65. Invoiced = 1.
    assert point_today.on_hand == 65, f"Expected today on-hand 65, got {point_today.on_hand}"
    assert point_today.invoiced == 1, f"Expected today invoiced 1, got {point_today.invoiced}"

    # Check reconciliation status (cached stock 65 matches on-hand 65)
    assert summary.is_reconciled is True, "Expected is_reconciled to be True"
    assert summary.reconciliation_status in ("All clear", "100% Reconciled (0 Drift)"), f"Unexpected status: {summary.reconciliation_status}"


@pytest.mark.asyncio
async def test_visual_reports_pos_flow_no_zero_division(db_session):
    """
    Test POS direct invoicing workflow where sales_orders = 0, but invoices > 0.
    Percentages must use invoices as the base and show 'n/a' for upstream steps.
    """
    s = uuid.uuid4().hex[:6]
    comp, br = await _create_tenant(db_session, s)
    today = datetime.now(timezone.utc).date()

    inv = SalesInvoice(
        id=f"inv-pos-{s}",
        company_id=comp.id,
        branch_id=br.id,
        invoice_no=f"POS-INV-{s}",
        date=today,
        status="Completed",
        grand_total=Decimal("1200.00"),
        is_deleted=False,
    )
    db_session.add(inv)
    await db_session.commit()

    summary = await VisualReportsService.get_dashboard_summary(
        session=db_session,
        company_id=comp.id,
        start_date=today,
        end_date=today,
    )

    stage_so = next(s for s in summary.workflow_stages if s.id == "stage_so")
    stage_inv = next(s for s in summary.workflow_stages if s.id == "stage_inv")

    # Invoices should be 100% base
    assert stage_inv.count == 1
    assert stage_inv.percentage == 100
    # Sales orders should be 0% with n/a subtext
    assert stage_so.count == 0
    assert stage_so.percentage == 0
    assert "n/a" in stage_so.subtext.lower()
