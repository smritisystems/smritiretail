"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.17.0
* Created    : 2026-10-22
* Modified   : 2026-10-22
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
* Target     : Automated Pytest Integration Test Suite for Report Designer Auto-Consolidation
* Classification: Internal
"""

import pytest
import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Company, Branch
from app.models.inventory import Product
from app.models.purchase import Supplier, PurchaseOrder, PurchaseOrderItem, PurchaseBill
from app.services.reports import ReportsService
from app.services.report_field_registry import ReportFieldRegistry, FieldSemanticType, AggregationFunction

pytestmark = pytest.mark.asyncio


class MockTenant:
    def __init__(self, company_id: str):
        self.company_id = company_id


async def test_report_field_registry_classification():
    """Verify field metadata classification for dimensions vs additive and non-additive measures."""
    # Grouping dimensions
    assert ReportFieldRegistry.is_dimension("Purchase", "supplier") is True
    assert ReportFieldRegistry.is_dimension("Purchase", "po_no") is True
    assert ReportFieldRegistry.is_dimension("Purchase", "article_sku") is True
    assert ReportFieldRegistry.is_dimension("Purchase", "color") is True
    assert ReportFieldRegistry.is_dimension("Purchase", "size") is True
    assert ReportFieldRegistry.is_dimension("Sales", "customer_name") is True
    assert ReportFieldRegistry.is_dimension("Sales", "size") is True

    # Measures
    assert ReportFieldRegistry.is_dimension("Purchase", "quantity") is False
    assert ReportFieldRegistry.is_dimension("Purchase", "net_amount") is False
    assert ReportFieldRegistry.is_additive_measure("Purchase", "quantity") is True
    assert ReportFieldRegistry.is_additive_measure("Purchase", "net_amount") is True
    assert ReportFieldRegistry.get_aggregation_type("Purchase", "quantity") == AggregationFunction.SUM

    # Partition columns
    parts = ReportFieldRegistry.partition_columns("Purchase", ["supplier", "po_no", "color", "size", "quantity", "net_amount"])
    assert parts["dimensions"] == ["supplier", "po_no", "color", "size"]
    assert parts["additive_measures"] == ["quantity", "net_amount"]


async def test_purchase_auto_consolidation_and_dimension_split(db_session: AsyncSession):
    """
    Test that multiple items sharing identical selected dimensions consolidate into 1 row,
    and selecting an additional dimension (Size) splits them into individual rows.
    """
    cid = "comp-consol-split-01"
    
    # 1. Seed Company & Branch
    comp = Company(id=cid, company_code="CSPLIT01", name="Test Consolidation Corp", is_active=True)
    br = Branch(id="br-split-01", company_id=cid, code="BR-SPLIT", name="Split Branch", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()
    
    # 2. Seed Supplier
    supp = Supplier(id="supp-as-shoes-01", company_id=cid, code="AS-SHOES", name="A. S. Shoes", city="Agra", is_active=True)
    db_session.add(supp)
    await db_session.commit()

    # 3. Seed Products for sizes 7, 8, 9
    prod7 = Product(
        id="prod-ch01-blk-7", company_id=cid, branch_id=br.id,
        code="CH-01-BLK-7", name="CH-01 Black 7", barcode="BC-CH01-7",
        category="Footwear", color="Black", size="7", price=Decimal("500"),
        is_active=True, is_deleted=False
    )
    prod8 = Product(
        id="prod-ch01-blk-8", company_id=cid, branch_id=br.id,
        code="CH-01-BLK-8", name="CH-01 Black 8", barcode="BC-CH01-8",
        category="Footwear", color="Black", size="8", price=Decimal("500"),
        is_active=True, is_deleted=False
    )
    prod9 = Product(
        id="prod-ch01-blk-9", company_id=cid, branch_id=br.id,
        code="CH-01-BLK-9", name="CH-01 Black 9", barcode="BC-CH01-9",
        category="Footwear", color="Black", size="9", price=Decimal("500"),
        is_active=True, is_deleted=False
    )
    db_session.add_all([prod7, prod8, prod9])
    await db_session.commit()

    # 4. Seed Purchase Order PO-0013 with 3 items (matching prompt example)
    # A. S. Shoes | PO-0013 | CH-01 | Black | 7 | 10 | 5000
    # A. S. Shoes | PO-0013 | CH-01 | Black | 8 | 12 | 6000
    # A. S. Shoes | PO-0013 | CH-01 | Black | 9 |  8 | 4000
    po = PurchaseOrder(
        id="po-as-0013",
        company_id=cid,
        branch_id=br.id,
        order_no="PO-0013",
        supplier_id=supp.id,
        created_at=datetime.datetime(2026, 4, 10, 10, 0, 0, tzinfo=datetime.timezone.utc),
        is_active=True,
        is_deleted=False,
    )
    db_session.add(po)
    await db_session.commit()

    poi1 = PurchaseOrderItem(id="poi-as-1", company_id=cid, order_id=po.id, product_id=prod7.id, code="CH-01", name="CH-01 Black 7", quantity=Decimal("10.00"), cost_price=Decimal("500.00"), line_total=Decimal("5000.00"), is_active=True, is_deleted=False)
    poi2 = PurchaseOrderItem(id="poi-as-2", company_id=cid, order_id=po.id, product_id=prod8.id, code="CH-01", name="CH-01 Black 8", quantity=Decimal("12.00"), cost_price=Decimal("500.00"), line_total=Decimal("6000.00"), is_active=True, is_deleted=False)
    poi3 = PurchaseOrderItem(id="poi-as-3", company_id=cid, order_id=po.id, product_id=prod9.id, code="CH-01", name="CH-01 Black 9", quantity=Decimal("8.00"), cost_price=Decimal("500.00"), line_total=Decimal("4000.00"), is_active=True, is_deleted=False)
    db_session.add_all([poi1, poi2, poi3])
    await db_session.commit()

    svc = ReportsService(db_session, MockTenant(cid))

    # A. Test Auto Consolidation WITHOUT size:
    # Selected: [Supplier, PO No, Article, Color, Quantity, Net Amount]
    # Expected: Exactly 1 consolidated row with Quantity = 30 and Net Amount = 15000, _record_count = 3
    res_cons = await svc.query_report_builder(
        category="Purchase",
        consolidation_mode="auto",
        selected_columns="supplier,po_no,article_sku,color,quantity,net_amount",
    )
    assert res_cons["total_count"] == 1
    assert len(res_cons["rows"]) == 1
    r = res_cons["rows"][0]
    assert r["supplier"] == "A. S. Shoes"
    assert r["po_no"] == "PO-0013"
    assert r["article_sku"] == "CH-01"
    assert r["color"] == "Black"
    assert r["quantity"] == 30.0
    assert r["net_amount"] == 15000.0
    assert r["_record_count"] == 3
    assert r["_is_consolidated"] is True
    assert res_cons["totals"]["quantity"] == 30.0
    assert res_cons["totals"]["net_amount"] == 15000.0

    # B. Test Auto Consolidation WITH size selected:
    # Expected: 3 separate rows for sizes 7, 8, 9
    res_size = await svc.query_report_builder(
        category="Purchase",
        consolidation_mode="auto",
        selected_columns="supplier,po_no,article_sku,color,size,quantity,net_amount",
    )
    assert res_size["total_count"] == 3
    assert len(res_size["rows"]) == 3
    sizes = sorted([row["size"] for row in res_size["rows"]])
    assert sizes == ["7", "8", "9"]
    quantities = sorted([row["quantity"] for row in res_size["rows"]])
    assert quantities == [8.0, 10.0, 12.0]
    assert res_size["totals"]["quantity"] == 30.0
    assert res_size["totals"]["net_amount"] == 15000.0

    # C. Test Detailed Rows Mode:
    # Expected: 3 separate individual records with _is_consolidated = False
    res_detailed = await svc.query_report_builder(
        category="Purchase",
        consolidation_mode="detailed",
    )
    assert res_detailed["total_count"] == 3
    assert len(res_detailed["rows"]) == 3
    for d_row in res_detailed["rows"]:
        assert d_row["_is_consolidated"] is False
        assert d_row["_record_count"] == 1


async def test_join_inflation_protection(db_session: AsyncSession):
    """
    Verify that having multiple purchase bills against a purchase order
    does NOT inflate item quantities or net amounts in consolidated or grand totals.
    """
    cid = "comp-inflation-guard-02"
    comp = Company(id=cid, company_code="CINFLATION", name="Inflation Guard Corp", is_active=True)
    br = Branch(id="br-inflation-02", company_id=cid, code="BR-INFL", name="Inflation Branch", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()

    supp = Supplier(id="supp-guard-02", company_id=cid, code="SUPP-IG", name="Vendor Guard", city="Delhi", is_active=True)
    db_session.add(supp)
    await db_session.commit()

    prod_guard = Product(
        id="prod-guard-1", company_id=cid, branch_id=br.id,
        code="SKU-GUARD", name="SKU Guard", barcode="BC-GUARD-1",
        category="General", color="Standard", size="Free", price=Decimal("500"),
        is_active=True, is_deleted=False
    )
    db_session.add(prod_guard)
    await db_session.commit()

    po = PurchaseOrder(id="po-guard-100", company_id=cid, branch_id=br.id, order_no="PO-IG-100", supplier_id=supp.id, is_active=True, is_deleted=False)
    db_session.add(po)
    await db_session.commit()

    poi = PurchaseOrderItem(id="poi-guard-1", company_id=cid, order_id=po.id, product_id=prod_guard.id, code="SKU-GUARD", name="SKU Guard", quantity=Decimal("50.00"), cost_price=Decimal("500.00"), line_total=Decimal("25000.00"), is_active=True, is_deleted=False)
    db_session.add(poi)
    await db_session.commit()

    # Add 2 purchase bills for the same order (would cause 1:2 Cartesian multiplication if outer-joined naively)
    bill1 = PurchaseBill(
        id="bill-guard-1", company_id=cid, branch_id=br.id, supplier_id=supp.id,
        order_id=po.id, bill_no="BILL-2026-001", total_amount=Decimal("12500.00"),
        is_active=True, is_deleted=False
    )
    bill2 = PurchaseBill(
        id="bill-guard-2", company_id=cid, branch_id=br.id, supplier_id=supp.id,
        order_id=po.id, bill_no="BILL-2026-002", total_amount=Decimal("12500.00"),
        is_active=True, is_deleted=False
    )
    db_session.add_all([bill1, bill2])
    await db_session.commit()

    svc = ReportsService(db_session, MockTenant(cid))

    res = await svc.query_report_builder(
        category="Purchase",
        consolidation_mode="auto",
        selected_columns="supplier,po_no,article_sku,quantity,net_amount",
    )
    # Quantity MUST remain 50.0, NOT 100.0!
    assert res["total_count"] == 1
    assert res["rows"][0]["quantity"] == 50.0
    assert res["rows"][0]["net_amount"] == 25000.0
    assert res["totals"]["quantity"] == 50.0
    assert res["totals"]["net_amount"] == 25000.0
