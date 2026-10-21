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
Classification: Visual Reports & Inventory Reports Follow-up Verification
"""

import uuid
import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import pytest
from sqlalchemy import select

from app.models.tenant import Company, Branch
from app.models.inventory import Product, StockMovement
from app.models.sales import SalesInvoice, SalesOrder, SalesOrderItem, SalesOrderReservation
from app.services.stock_synchronizer import StockSynchronizer
from app.services.visual_reports_service import VisualReportsService
from app.api.v1.inventory_reports import (
    stock_balance,
    stock_availability,
    stock_aging,
)
from app.api.deps import TenantContext


async def _create_tenant(session, s: str):
    comp = Company(
        id=f"comp-vr-fup-{s}",
        name=f"Followup Test Co {s}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    br1 = Branch(
        id=f"br-vr-1-{s}",
        company_id=comp.id,
        name=f"Branch 1 {s}",
        code=f"BR1-{s.upper()}",
        is_active=True,
    )
    br2 = Branch(
        id=f"br-vr-2-{s}",
        company_id=comp.id,
        name=f"Branch 2 {s}",
        code=f"BR2-{s.upper()}",
        is_active=True,
    )
    session.add_all([comp, br1, br2])
    await session.commit()
    return comp, br1, br2


@pytest.mark.asyncio
async def test_inventory_reports_signed_quantities_positive_sale_negative_ecom(db_session):
    """
    Test that inventory_reports.py (RPT-INV-001, RPT-INV-003, RPT-INV-004) correctly
    derives on-hand stock and value using signed movement quantities for:
    - INWARD_GRN: +100 @ unit_cost 50.00
    - OUTWARD_SALE: positive stored quantity +20.00
    - OUTWARD_ECOM: negative stored quantity -10.00
    On-hand must be 70 across all reports (100 - 20 - 10 = 70).
    RPT-INV-001 total stock value must be 70 * 50 = 3500.00.
    """
    s = uuid.uuid4().hex[:6]
    comp, br1, _ = await _create_tenant(db_session, s)

    prod = Product(
        id=f"prod-rep-{s}",
        company_id=comp.id,
        branch_id=br1.id,
        sku=f"SKU-REP-{s.upper()}",
        code=f"PRD-REP-{s.upper()}",
        barcode=f"BC-REP-{s.upper()}",
        name=f"Inventory Report Shoe {s}",
        category="Footwear",
        stock=70,
        cost_price=Decimal("50.00"),
        is_active=True,
    )
    db_session.add(prod)
    await db_session.commit()

    # Movement 1: INWARD_GRN 100 @ unit_cost 50
    m1 = StockMovement(
        id=f"mov-rep-1-{s}",
        company_id=comp.id,
        branch_id=br1.id,
        product_id=prod.id,
        product_name=prod.name,
        sku=prod.sku,
        movement_type="INWARD_GRN",
        quantity=Decimal("100.00"),
        unit_cost=Decimal("50.00"),
        reference_doc_type="GRN",
        reference_doc_id=f"GRN-01-{s}",
    )
    # Movement 2: OUTWARD_SALE stored as positive 20.00
    m2 = StockMovement(
        id=f"mov-rep-2-{s}",
        company_id=comp.id,
        branch_id=br1.id,
        product_id=prod.id,
        product_name=prod.name,
        sku=prod.sku,
        movement_type="OUTWARD_SALE",
        quantity=Decimal("20.00"),
        unit_cost=Decimal("50.00"),
        reference_doc_type="INV",
        reference_doc_id=f"INV-01-{s}",
    )
    # Movement 3: OUTWARD_ECOM stored as negative -10.00
    m3 = StockMovement(
        id=f"mov-rep-3-{s}",
        company_id=comp.id,
        branch_id=br1.id,
        product_id=prod.id,
        product_name=prod.name,
        sku=prod.sku,
        movement_type="OUTWARD_ECOM",
        quantity=Decimal("-10.00"),
        unit_cost=Decimal("50.00"),
        reference_doc_type="ECOM",
        reference_doc_id=f"ECOM-01-{s}",
    )
    db_session.add_all([m1, m2, m3])
    await db_session.commit()

    tenant = TenantContext(
        company_id=comp.id,
        branch_id=br1.id,
    )

    # 1. Test RPT-INV-001 (Stock Balance Summary)
    rpt1 = await stock_balance(
        category=None,
        warehouse=None,
        zero_stock=True,
        tenant=tenant,
        db=db_session,
        current_user={"id": "usr-test"},
    )
    item1 = next((i for i in rpt1["lines"] if i["product_id"] == prod.id), None)
    assert item1 is not None, "Product should be present in RPT-INV-001"
    assert item1["on_hand"] == 70.0, f"Expected RPT-INV-001 on_hand 70.0, got {item1['on_hand']}"
    assert item1["stock_value"] == 3500.0, f"Expected stock_value 3500.0, got {item1['stock_value']}"

    # 2. Test RPT-INV-003 (Stock Availability)
    rpt3 = await stock_availability(
        category=None,
        below_minimum=False,
        below_reorder=False,
        tenant=tenant,
        db=db_session,
        current_user={"id": "usr-test"},
    )
    item3 = next((i for i in rpt3["lines"] if i["product_id"] == prod.id), None)
    assert item3 is not None, "Product should be present in RPT-INV-003"
    assert item3["on_hand"] == 70.0, f"Expected RPT-INV-003 on_hand 70.0, got {item3['on_hand']}"

    # 3. Test RPT-INV-004 (Inventory Aging Summary)
    rpt4 = await stock_aging(
        as_on_date=None,
        buckets="30,60,90,180",
        category=None,
        tenant=tenant,
        db=db_session,
        current_user={"id": "usr-test"},
    )
    item4 = next((i for i in rpt4["lines"] if i["product_id"] == prod.id), None)
    assert item4 is not None, "Product should be present in RPT-INV-004"
    assert item4["on_hand"] == 70.0, f"Expected RPT-INV-004 on_hand 70.0, got {item4['on_hand']}"


@pytest.mark.asyncio
async def test_visual_reports_drift_badge_offsetting_products_and_location_filter(db_session):
    """
    Test that the drift badge counts products with drift via StockSynchronizer.detect_stock_drift:
    - Product 1: cached stock 20, movements 15 (drift = +5)
    - Product 2: cached stock 10, movements 15 (drift = -5)
    Naive net drift = (20+10) - (15+15) = 0, but real drift detection MUST report
    '2 products drifting' (NOT 'All clear' or '0 Drift').
    Also test location filter: filtering by br1 only inspects Product 1 (1 product drifting).
    """
    s = uuid.uuid4().hex[:6]
    comp, br1, br2 = await _create_tenant(db_session, s)

    # Product 1 at Branch 1
    p1 = Product(
        id=f"prod-d1-{s}",
        company_id=comp.id,
        branch_id=br1.id,
        sku=f"SKU-D1-{s.upper()}",
        code=f"PRD-D1-{s.upper()}",
        barcode=f"BC-D1-{s.upper()}",
        name=f"Drift Product 1 {s}",
        category="Footwear",
        stock=20,  # Cached stock is 20
        is_active=True,
    )
    # Product 2 at Branch 2
    p2 = Product(
        id=f"prod-d2-{s}",
        company_id=comp.id,
        branch_id=br2.id,
        sku=f"SKU-D2-{s.upper()}",
        code=f"PRD-D2-{s.upper()}",
        barcode=f"BC-D2-{s.upper()}",
        name=f"Drift Product 2 {s}",
        category="Apparel",
        stock=10,  # Cached stock is 10
        is_active=True,
    )
    db_session.add_all([p1, p2])
    await db_session.commit()

    # Movement for Product 1: INWARD_GRN 15 (Authoritative = 15; drift = 20 - 15 = +5)
    m1 = StockMovement(
        id=f"mov-d1-{s}",
        company_id=comp.id,
        branch_id=br1.id,
        warehouse_id=None,
        product_id=p1.id,
        product_name=p1.name,
        sku=p1.sku,
        movement_type="INWARD_GRN",
        quantity=Decimal("15.00"),
        reference_doc_type="GRN",
        reference_doc_id=f"GRN-D1-{s}",
    )
    # Movement for Product 2: INWARD_GRN 15 (Authoritative = 15; drift = 10 - 15 = -5)
    m2 = StockMovement(
        id=f"mov-d2-{s}",
        company_id=comp.id,
        branch_id=br2.id,
        warehouse_id=None,
        product_id=p2.id,
        product_name=p2.name,
        sku=p2.sku,
        movement_type="INWARD_GRN",
        quantity=Decimal("15.00"),
        reference_doc_type="GRN",
        reference_doc_id=f"GRN-D2-{s}",
    )
    db_session.add_all([m1, m2])
    await db_session.commit()

    # 1. Company-wide dashboard summary: must show "2 products drifting"
    summary_all = await VisualReportsService.get_dashboard_summary(
        session=db_session,
        company_id=comp.id,
    )
    assert summary_all.is_reconciled is False
    assert summary_all.reconciliation_status == "2 products drifting", (
        f"Expected '2 products drifting', got '{summary_all.reconciliation_status}'"
    )

    # 2. Location-filtered dashboard summary for Branch 1: must show "1 product drifting"
    summary_br1 = await VisualReportsService.get_dashboard_summary(
        session=db_session,
        company_id=comp.id,
        store_location_id=br1.id,
    )
    assert summary_br1.is_reconciled is False
    assert summary_br1.reconciliation_status == "1 product drifting", (
        f"Expected '1 product drifting', got '{summary_br1.reconciliation_status}'"
    )


@pytest.mark.asyncio
async def test_stock_ledger_query_unclassified_movement_types(db_session, caplog):
    """
    Test that unclassified movement types are logged with ERROR and surfaced
    rather than silently treated as else_=0.
    """
    from app.services.stock_ledger_query import audit_unclassified_movements

    s = uuid.uuid4().hex[:6]
    comp, br1, _ = await _create_tenant(db_session, s)

    prod = Product(
        id=f"prod-unclass-{s}",
        company_id=comp.id,
        branch_id=br1.id,
        sku=f"SKU-UNC-{s.upper()}",
        code=f"PRD-UNC-{s.upper()}",
        barcode=f"BC-UNC-{s.upper()}",
        name=f"Unclassified Test Prod {s}",
        category="Footwear",
        stock=50,
        is_active=True,
    )
    db_session.add(prod)
    await db_session.commit()

    # Create movement with an illegal/unclassified type
    mov_bad = StockMovement(
        id=f"mov-bad-{s}",
        company_id=comp.id,
        branch_id=br1.id,
        product_id=prod.id,
        product_name=prod.name,
        sku=prod.sku,
        movement_type="UNKNOWN_UNCLASSIFIED",
        quantity=Decimal("33.00"),
        reference_doc_type="TEST",
        reference_doc_id="BAD-001",
    )
    db_session.add(mov_bad)
    await db_session.commit()

    with caplog.at_level(logging.ERROR):
        unclass_dict = await audit_unclassified_movements(db_session, comp.id)

    assert "UNKNOWN_UNCLASSIFIED" in unclass_dict
    assert unclass_dict["UNKNOWN_UNCLASSIFIED"] == 1
    assert any("UNCLASSIFIED_MOVEMENT_TYPE" in record.message for record in caplog.records)
