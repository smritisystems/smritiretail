"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.96.0
Created      : 2026-10-17
Modified     : 2026-10-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Procurement Visual Reports Backend Test Suite
"""

import os
import sys
import uuid
from decimal import Decimal

import pytest
import pytest_asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import get_company_sessionmaker
from app.models.inventory import Product, Warehouse
from app.models.purchase import (
    PurchaseBill,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseReceipt,
    PurchaseReceiptItem,
    Supplier,
)
from app.models.tenant import Company
from app.services.procurement_visual_reports_service import ProcurementVisualReportsService


@pytest.mark.asyncio
async def test_procurement_dashboard_summary_real_database(procurement_data):
    """Verify dashboard KPIs and stream rows are derived from persisted procurement records."""
    company_id, supplier_name, _ = procurement_data
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as db:
        res = await ProcurementVisualReportsService.get_dashboard_summary(db, company_id=company_id)
        
        assert len(res.kpi_cards) == 6
        kpis = {k.id: k for k in res.kpi_cards}
        
        assert kpis["purchase_orders"].numeric_value == 1
        assert kpis["purchase_spend"].numeric_value == 10000
        assert kpis["pending_approvals"].numeric_value == 0
        assert kpis["pending_receipts"].numeric_value == 0
        assert kpis["received_vs_ordered"].numeric_value == 100
        assert kpis["supplier_outstanding"].numeric_value == 10000
        assert "Suppliers: 1" in kpis["supplier_outstanding"].subtext

        assert [supplier.supplier_name for supplier in res.top_suppliers] == [supplier_name]
        assert len(res.supplier_performance) == 1
        for perf in res.supplier_performance:
            assert perf.lead_time_days >= 0
            assert perf.on_time_delivery_pct is None

        assert res.stream_counts == {"all": 3, "po": 1, "gr": 1, "pi": 1}
        assert len(res.fulfillment_stream) == 3
        doc_nos = [doc.doc_no for doc in res.fulfillment_stream]
        assert any(d.startswith("PO-") for d in doc_nos)
        assert any("GRN" in d for d in doc_nos)
        assert any(d.startswith("PI-") for d in doc_nos)


@pytest_asyncio.fixture
async def procurement_data():
    suffix = uuid.uuid4().hex[:8].upper()
    company_id = f"PROC-{suffix}"
    supplier_id = f"supplier_{suffix}"
    supplier_name = f"Report Supplier {suffix}"
    product_id = f"product_{suffix}"
    po_id = f"po_{suffix}"
    po_item_id = f"poi_{suffix}"
    warehouse_id = f"warehouse_{suffix}"
    receipt_id = f"receipt_{suffix}"
    bill_id = f"bill_{suffix}"

    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as db:
        db.add(Company(id=company_id, name=f"Procurement Report Test {suffix}"))
        await db.flush()

        supplier = Supplier(
            id=supplier_id,
            company_id=company_id,
            name=supplier_name,
            code=f"SUP-{suffix}",
        )
        warehouse = Warehouse(
            id=warehouse_id,
            company_id=company_id,
            code=f"WH-{suffix}",
            name=f"Report Warehouse {suffix}",
        )
        product = Product(
            id=product_id,
            company_id=company_id,
            code=f"SKU-{suffix}",
            sku=f"SKU-{suffix}",
            name=f"Report Product {suffix}",
            category="Footwear",
            barcode=f"REPORT-{suffix}",
            brand="Report Brand",
            style_code=f"STYLE-{suffix}",
            color="BLACK",
            size="40",
            price=Decimal("1000.00"),
            mrp=Decimal("1000.00"),
            stock=10,
        )
        db.add_all([supplier, warehouse, product])
        await db.flush()

        po = PurchaseOrder(
            id=po_id,
            company_id=company_id,
            order_no=f"PO-{suffix}",
            supplier_id=supplier_id,
            status="CONFIRMED",
            subtotal=Decimal("10000.00"),
            tax_total=Decimal("0.00"),
            grand_total=Decimal("10000.00"),
        )
        db.add(po)
        await db.flush()

        db.add(
            PurchaseOrderItem(
                id=po_item_id,
                company_id=company_id,
                order_id=po_id,
                product_id=product_id,
                code=product.code,
                name=product.name,
                quantity=Decimal("10.00"),
                cost_price=Decimal("1000.00"),
                gst_rate=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                line_total=Decimal("10000.00"),
            )
        )
        receipt = PurchaseReceipt(
            id=receipt_id,
            company_id=company_id,
            receipt_no=f"GRN-{suffix}",
            supplier_id=supplier_id,
            order_id=po_id,
            warehouse_id=warehouse_id,
            status="RECEIVED",
            grand_total=Decimal("10000.00"),
        )
        db.add(receipt)
        await db.flush()

        db.add_all(
            [
                PurchaseReceiptItem(
                    id=f"pri_{suffix}",
                    company_id=company_id,
                    receipt_id=receipt_id,
                    product_id=product_id,
                    purchase_order_id=po_id,
                    purchase_order_no=po.order_no,
                    code=product.code,
                    name=product.name,
                    quantity_ordered=Decimal("10.00"),
                    quantity_received=Decimal("10.00"),
                    quantity_damaged=Decimal("0.00"),
                    cost_price=Decimal("1000.00"),
                    gst_rate=Decimal("0.00"),
                    tax_amount=Decimal("0.00"),
                    line_total=Decimal("10000.00"),
                ),
                PurchaseBill(
                    id=bill_id,
                    company_id=company_id,
                    bill_no=f"PI-{suffix}",
                    supplier_id=supplier_id,
                    receipt_id=receipt_id,
                    order_id=po_id,
                    status="POSTED",
                    taxable_amount=Decimal("10000.00"),
                    tax_amount=Decimal("0.00"),
                    total_amount=Decimal("10000.00"),
                    paid_amount=Decimal("0.00"),
                ),
            ]
        )
        await db.commit()

    return company_id, supplier_name, f"STYLE-{suffix}"


@pytest.mark.asyncio
async def test_procurement_dashboard_summary_empty_company():
    """Verify that querying a company with zero records returns a truthful empty state, never mock data."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as db:
        res = await ProcurementVisualReportsService.get_dashboard_summary(db, company_id="COMP-NONEXISTENT")
        
        assert res.total_pos_for_status == 0
        assert len(res.fulfillment_stream) == 0
        assert len(res.spend_trend) == 0
        assert len(res.top_suppliers) == 0
        assert len(res.open_pos_and_receipts) == 0
        
        kpis = {k.id: k for k in res.kpi_cards}
        assert kpis["purchase_orders"].numeric_value == 0
        assert kpis["purchase_spend"].numeric_value == 0
        assert kpis["pending_approvals"].numeric_value == 0
        assert kpis["pending_receipts"].numeric_value == 0
        assert kpis["received_vs_ordered"].numeric_value == 0
        assert kpis["supplier_outstanding"].numeric_value == 0


@pytest.mark.asyncio
async def test_procurement_dashboard_summary_attribute_filters(procurement_data):
    """Verify attribute filtering (articles, colors, sizes) and dynamic filter options."""
    company_id, _, style_code = procurement_data
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as db:
        res = await ProcurementVisualReportsService.get_dashboard_summary(
            db,
            company_id=company_id,
            articles=[style_code],
            colors=["BLACK"],
            sizes=["40"],
            top_n=5,
        )

        # Filter options must contain live product master attributes
        assert res.filter_options is not None
        assert len(res.filter_options.articles) > 0
        assert len(res.filter_options.colors) > 0
        assert len(res.filter_options.sizes) > 0

        # Top articles returned must match requested top_n limit
        assert res.top_articles is not None
        assert len(res.top_articles) <= 5

        # Colors breakdown
        assert res.spend_by_color is not None
        for clr in res.spend_by_color:
            assert clr.percentage >= 0
            assert clr.spend_value >= 0

        # Sizes breakdown
        assert res.order_vs_receipt_by_size is not None
        for sz in res.order_vs_receipt_by_size:
            assert sz.ordered_qty >= 0
            assert sz.received_qty >= 0

        # Reorder alerts detailed with article/color/size
        assert res.reorder_alerts_detailed is not None
        for alert in res.reorder_alerts_detailed:
            assert alert.article != ""
            assert alert.suggested_po_qty >= 0


@pytest.mark.asyncio
async def test_procurement_dashboard_heatmap_and_scatter(procurement_data):
    """Verify 2D Article-Color Heatmap matrix and Supplier Lead Time vs Order Value scatter plot."""
    company_id, _, _ = procurement_data
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as db:
        res = await ProcurementVisualReportsService.get_dashboard_summary(
            db,
            company_id=company_id,
            top_n=10,
        )

        # Heatmap matrix
        assert res.article_color_heatmap is not None
        assert len(res.article_color_heatmap.articles) > 0
        assert len(res.article_color_heatmap.colors) > 0
        assert len(res.article_color_heatmap.cells) > 0
        assert res.article_color_heatmap.max_qty >= 0

        # Scatter plot points
        assert res.supplier_lead_time_vs_value is not None
        assert len(res.supplier_lead_time_vs_value) > 0
        for pt in res.supplier_lead_time_vs_value:
            assert pt.supplier_name != ""
            assert pt.avg_lead_time_days >= 0
            assert pt.order_value_lakh >= 0
            assert pt.bubble_color.startswith("#")

