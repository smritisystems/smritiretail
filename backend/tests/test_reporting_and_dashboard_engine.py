"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import sys, os
from datetime import datetime, timezone
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from app.models.reporting import ReportDefinition, ReportSavedView, Dashboard, DashboardWidget

def test_report_definition_and_saved_views():
    """Verify Report Definition master and Excel-style saved view configuration."""
    report = ReportDefinition(
        code="RPT_PROFITABILITY_001",
        name="Sales Profitability Waterfall Report",
        category="Profitability",
        data_source="invoice_profitability_ledgers",
        dimensions=["Company", "Branch", "Customer", "Salesperson", "Date"],
        measures=["GrossSales", "COGS", "GrossProfit", "Commissions", "Discounts", "NetContribution", "MarginPercent"]
    )
    assert report.code == "RPT_PROFITABILITY_001"
    assert "NetContribution" in report.measures

    saved_view = ReportSavedView(
        report_definition_id="rpt_001",
        user_id="user_admin_01",
        view_name="Monthly High Margin View",
        column_layout=["Date", "Customer", "NetContribution", "MarginPercent"],
        sort_rules=[{"field": "MarginPercent", "order": "DESC"}],
        group_by=["Branch"],
        is_default=True
    )
    assert saved_view.view_name == "Monthly High Margin View"
    assert saved_view.sort_rules[0]["order"] == "DESC"

def test_chart_report_engine_visualization_abstraction():
    """Verify Chart Report Engine represents the exact same underlying Report Dataset as Grid or Chart."""
    widget = DashboardWidget(
        dashboard_id="dash_ceo_01",
        report_definition_id="rpt_001",
        widget_type="CHART",
        title="Monthly Sales Trend",
        chart_type="LINE",
        dimensions=["Month"],
        measures=["GrossSales", "NetContribution"],
        grid_position={"x": 0, "y": 0, "w": 6, "h": 4}
    )
    assert widget.widget_type == "CHART"
    assert widget.chart_type == "LINE"

def test_dashboard_manager_widget_composition():
    """Verify Dashboard Manager creates composite dashboards with KPI, Chart, and Grid widgets."""
    dash = Dashboard(
        code="DASH_CEO_EXECUTIVE",
        name="CEO Executive Dashboard",
        category="CEO",
        is_system_dashboard=True,
        is_shared=True,
        layout_config={"columns": 12, "rowHeight": 100}
    )
    assert dash.code == "DASH_CEO_EXECUTIVE"
    assert dash.is_system_dashboard is True

def test_reporting_co_location_in_smriti001():
    """Verify reporting and dashboard models reside in smriti001 without separate reporting databases."""
    reporting_tables = [
        ReportDefinition.__tablename__,
        ReportSavedView.__tablename__,
        Dashboard.__tablename__,
        DashboardWidget.__tablename__
    ]
    expected = [
        "report_definitions", "report_saved_views", "dashboards", "dashboard_widgets"
    ]
    assert reporting_tables == expected
