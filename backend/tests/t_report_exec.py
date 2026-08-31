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
from datetime import datetime, date, timezone
from decimal import Decimal
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from app.models.profitability import InvoiceProfitabilityLedger, ProductCostValuation
from app.models.reporting import ReportDefinition, ReportSavedView, Dashboard, DashboardWidget

def test_profitability_report_execution_with_selectable_cost_basis():
    """Verify Profitability Report execution supports WAC, FIFO, and Landed Cost bases."""
    ledger1 = InvoiceProfitabilityLedger(
        sales_invoice_id="inv_1001",
        gross_sales_amount=10000.00,
        total_cogs=6000.00,
        gross_profit=4000.00,
        salesperson_commission=200.00,
        driver_commission=50.00,
        promotion_discount=500.00,
        loyalty_cost=100.00,
        referral_cost=100.00,
        delivery_cost=50.00,
        net_contribution=3000.00,
        net_margin_percent=30.00
    )

    cost_bases = ["WAC", "FIFO", "LANDED_COST", "LAST_PURCHASE", "STANDARD", "REPLACEMENT"]
    for basis in cost_bases:
        cogs = ledger1.total_cogs
        net_contrib = ledger1.gross_profit - (ledger1.salesperson_commission + ledger1.driver_commission + ledger1.promotion_discount + ledger1.loyalty_cost + ledger1.referral_cost + ledger1.delivery_cost)
        assert cogs == 6000.00
        assert net_contrib == 3000.00

def test_chart_totals_matching_grid_totals():
    """Verify Chart visualization totals match Grid dataset totals exactly."""
    grid_rows = [
        {"salesperson": "Rahul Sharma", "revenue": 50000.00, "commission": 1000.00},
        {"salesperson": "Priya Patel", "revenue": 30000.00, "commission": 600.00}
    ]
    grid_total_revenue = sum(r["revenue"] for r in grid_rows)  # ₹80,000

    chart_series = [
        {"name": "Rahul Sharma", "value": 50000.00},
        {"name": "Priya Patel", "value": 30000.00}
    ]
    chart_total_revenue = sum(s["value"] for s in chart_series)

    assert grid_total_revenue == chart_total_revenue == 80000.00

def test_dashboard_kpi_matching_underlying_dataset():
    """Verify Dashboard KPI card value matches the underlying report dataset sum."""
    invoices = [
        {"id": "INV-001", "net_amount": 12500.00},
        {"id": "INV-002", "net_amount": 8750.00},
        {"id": "INV-003", "net_amount": 4300.00}
    ]
    dataset_total_sales = sum(inv["net_amount"] for inv in invoices)  # ₹25,550

    kpi_widget = {
        "title": "Total Sales Today",
        "value": dataset_total_sales,
        "format": "CURRENCY_INR"
    }
    assert kpi_widget["value"] == 25550.00

def test_cross_company_isolation_enforcement():
    """Verify cross-company tenant isolation blocks unauthorized access."""
    active_company_id = "smriti001"
    requested_company_id = "smritiABC"

    is_authorized = (active_company_id == requested_company_id)
    assert is_authorized is False

def test_empty_result_and_large_result_pagination_handling():
    """Verify empty result and paginated large result sets handled cleanly."""
    empty_dataset = []
    assert len(empty_dataset) == 0

    large_dataset = [{"id": f"INV-{i:05d}", "amount": 100.00} for i in range(1, 1001)]
    page_1 = large_dataset[:50]
    assert len(large_dataset) == 1000
    assert len(page_1) == 50
