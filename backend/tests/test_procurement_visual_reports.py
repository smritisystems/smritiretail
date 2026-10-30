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

import sys
import os
import pytest
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import async_session
from app.services.procurement_visual_reports_service import ProcurementVisualReportsService


@pytest.mark.asyncio
async def test_procurement_dashboard_summary_real_database():
    """Verify ProcurementVisualReportsService derives 100% of data from COMP-001 PostgreSQL database."""
    async with async_session() as db:
        res = await ProcurementVisualReportsService.get_dashboard_summary(db, company_id="COMP-001")
        
        # Verify 6 KPIs exist and match real statutory database numbers
        assert len(res.kpi_cards) == 6
        kpis = {k.id: k for k in res.kpi_cards}
        
        # 1. Purchase Orders: 28 real statutory orders in COMP-001
        assert kpis["purchase_orders"].numeric_value == 28
        assert "28" in kpis["purchase_orders"].value
        
        # 2. Purchase Spend: ₹ 9,888,228 committed expenditure
        assert kpis["purchase_spend"].numeric_value == 9888228
        assert "9,888,228" in kpis["purchase_spend"].value
        
        # 3. Pending Approvals: 0 pending
        assert kpis["pending_approvals"].numeric_value == 0
        
        # 4. Pending Receipts: 0 pairs pending (all 23,064 pairs inward received)
        assert kpis["pending_receipts"].numeric_value == 0
        
        # 5. Received vs Ordered: 100% fulfillment
        assert kpis["received_vs_ordered"].numeric_value == 100
        assert "23,064 / 23,064" in kpis["received_vs_ordered"].subtext
        
        # 6. Supplier Outstanding: ₹ 9,888,228 commercial unpaid liability across 9 suppliers
        assert kpis["supplier_outstanding"].numeric_value == 9888228
        assert "Suppliers: 9" in kpis["supplier_outstanding"].subtext
        
        # Verify Top Suppliers: 9 real footwear vendors ranked by spend
        assert len(res.top_suppliers) == 9
        top_supplier_names = [s.supplier_name for s in res.top_suppliers]
        assert "AS FOOTWEAR" in top_supplier_names
        assert "AK FOOTWEAR" in top_supplier_names
        assert "LAJOS FOOTWEAR" in top_supplier_names
        assert "MK FOOTWEAR" in top_supplier_names
        # Ensure mock vendors are NOT present
        assert "Metro Footwear Ltd." not in top_supplier_names
        assert "Bharat Traders" not in top_supplier_names
        
        # Verify Supplier Performance: calculated lead time in days, no fake on-time delivery
        assert len(res.supplier_performance) == 9
        for perf in res.supplier_performance:
            assert perf.lead_time_days >= 0
            # on_time_delivery_pct is None because historical POs do not have delivery dates
            assert perf.on_time_delivery_pct is None
            
        # Verify Active Procurement Stream: 84 real persisted documents (28 POs, 28 GRNs, 28 Bills)
        assert res.stream_counts["all"] == 84
        assert res.stream_counts["po"] == 28
        assert res.stream_counts["gr"] == 28
        assert res.stream_counts["pi"] == 28
        assert len(res.fulfillment_stream) == 84
        
        # Verify doc numbers originate from real database (e.g. PO-C-849, GRN-D-522, etc.)
        doc_nos = [doc.doc_no for doc in res.fulfillment_stream]
        assert any(d.startswith("PO-") for d in doc_nos)
        assert any("GRN" in d for d in doc_nos)


@pytest.mark.asyncio
async def test_procurement_dashboard_summary_empty_company():
    """Verify that querying a company with zero records returns a truthful empty state, never mock data."""
    async with async_session() as db:
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
async def test_procurement_dashboard_summary_attribute_filters():
    """Verify attribute filtering (articles, colors, sizes) and dynamic filter options."""
    async with async_session() as db:
        res = await ProcurementVisualReportsService.get_dashboard_summary(
            db,
            company_id="COMP-001",
            articles=["SH-02-I", "CH-13-C"],
            colors=["BLACK", "BROWN"],
            sizes=["40", "41"],
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
async def test_procurement_dashboard_heatmap_and_scatter():
    """Verify 2D Article-Color Heatmap matrix and Supplier Lead Time vs Order Value scatter plot."""
    async with async_session() as db:
        res = await ProcurementVisualReportsService.get_dashboard_summary(
            db,
            company_id="COMP-001",
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

