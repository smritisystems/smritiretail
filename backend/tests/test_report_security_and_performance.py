"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.35.0
Created      : 2026-08-28
Modified     : 2026-08-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITI Reporting & BI Engine — Phase 2 Security Masking & Query Router Test Suite.
Verifies:
- Invariant 4: Zero frontend security trust (Server-side field masking)
- Invariant 5: Workload isolation via 4 Performance Tiers
- Invariant 9: Uniform security masking across all consumer views
"""

import pytest
from datetime import date, timedelta
from app.core.report_security import (
    ReportSecurityEngine,
    PERM_VIEW_REVENUE,
    PERM_VIEW_TAX,
    PERM_VIEW_COST_AND_MARGIN,
)
from app.core.performance_router import (
    PerformanceRouter,
    PerformanceTier,
)


# ---------------------------------------------------------------------------
# Test 1: Server-Side RBAC & Field Masking for Cashiers / Staff
# ---------------------------------------------------------------------------

def test_cashier_field_masking():
    """Verify that financial sensitive fields (Cost, Margin, GMROI) are masked for cashiers."""
    raw_record = {
        "invoice_no": "INV-2026-001",
        "date": "2026-08-28",
        "gross_sales": 1000.00,
        "line_discount": 100.00,
        "net_sales": 900.00,
        "tax_amount": 162.00,
        "cogs": 500.00,
        "cost_price": 500.00,
        "gross_margin_amt": 400.00,
        "gross_margin_pct": 44.44,
        "gmroi": 2.50,
    }

    masked = ReportSecurityEngine.mask_record(raw_record, user_role="CASHIER")

    # Visible fields preserved
    assert masked["invoice_no"] == "INV-2026-001"
    assert masked["gross_sales"] == 1000.00
    assert masked["net_sales"] == 900.00
    assert masked["tax_amount"] == 162.00

    # Sensitive financial fields masked to None
    assert masked["cogs"] is None
    assert masked["cost_price"] is None
    assert masked["gross_margin_amt"] is None
    assert masked["gross_margin_pct"] is None
    assert masked["gmroi"] is None


def test_supervisor_field_masking():
    """Verify that store supervisors also have cost and margins masked."""
    raw_record = {
        "item_code": "TSHIRT-BLK-M",
        "units_sold": 50,
        "net_sales": 25000.00,
        "unit_landed_cost": 250.00,
        "gross_margin_amt": 12500.00,
        "margin_percent": 50.00,
    }

    masked = ReportSecurityEngine.mask_record(raw_record, user_role="STORE_SUPERVISOR")

    assert masked["item_code"] == "TSHIRT-BLK-M"
    assert masked["units_sold"] == 50
    assert masked["net_sales"] == 25000.00
    assert masked["unit_landed_cost"] is None
    assert masked["gross_margin_amt"] is None
    assert masked["margin_percent"] is None


def test_accountant_and_ceo_full_financial_visibility():
    """Verify that Accountants and CEOs see all unmasked financial metrics."""
    raw_record = {
        "invoice_no": "INV-2026-001",
        "net_sales": 900.00,
        "cogs": 500.00,
        "gross_margin_amt": 400.00,
        "gross_margin_pct": 44.44,
    }

    for role in ["ACCOUNTANT", "ADMIN", "CEO", "SUPERADMIN"]:
        unmasked = ReportSecurityEngine.mask_record(raw_record, user_role=role)
        assert unmasked["cogs"] == 500.00
        assert unmasked["gross_margin_amt"] == 400.00
        assert unmasked["gross_margin_pct"] == 44.44


def test_nested_dataset_masking():
    """Verify recursive masking across nested invoice line items."""
    raw_dataset = [
        {
            "invoice_no": "INV-101",
            "net_sales": 1000.00,
            "gross_margin_amt": 400.00,
            "items": [
                {"item_code": "SKU-1", "rate": 500.00, "cost_price": 300.00},
                {"item_code": "SKU-2", "rate": 500.00, "cost_price": 300.00},
            ]
        }
    ]

    masked_dataset = ReportSecurityEngine.mask_dataset(raw_dataset, user_role="CASHIER")
    assert masked_dataset[0]["gross_margin_amt"] is None
    assert masked_dataset[0]["items"][0]["cost_price"] is None
    assert masked_dataset[0]["items"][1]["cost_price"] is None
    assert masked_dataset[0]["items"][0]["rate"] == 500.00


# ---------------------------------------------------------------------------
# Test 2: Query Performance-Tier Router
# ---------------------------------------------------------------------------

def test_router_tier1_interactive_pos():
    """Verify single-day POS queries route to TIER_1_INTERACTIVE (<50ms)."""
    today = date(2026, 8, 28)
    route = PerformanceRouter.classify_query(
        report_id="RPT-SAL-001",
        from_date=today,
        to_date=today,
        is_multi_branch=False
    )
    assert route.tier == PerformanceTier.TIER_1_INTERACTIVE
    assert route.target_latency_ms == 50
    assert route.is_async_required is False
    assert route.execution_strategy == "DIRECT_INDEXED_SQL"


def test_router_tier2_analytical_matrix():
    """Verify Apparel Matrix and 30-day queries route to TIER_2_ANALYTICAL (<300ms)."""
    today = date(2026, 8, 28)
    month_ago = today - timedelta(days=30)
    
    # 1. Apparel Matrix report (even single day)
    route_matrix = PerformanceRouter.classify_query(
        report_id="RPT-MRC-001",
        from_date=today,
        to_date=today
    )
    assert route_matrix.tier == PerformanceTier.TIER_2_ANALYTICAL
    assert route_matrix.target_latency_ms == 300
    assert route_matrix.execution_strategy == "AGGREGATION_CTE_WINDOW"

    # 2. 30-day date range
    route_range = PerformanceRouter.classify_query(
        report_id="RPT-SAL-001",
        from_date=month_ago,
        to_date=today
    )
    assert route_range.tier == PerformanceTier.TIER_2_ANALYTICAL


def test_router_tier3_heavy_historical():
    """Verify 180-day queries route to TIER_3_HISTORICAL (Async background)."""
    today = date(2026, 8, 28)
    half_year_ago = today - timedelta(days=180)

    route = PerformanceRouter.classify_query(
        report_id="RPT-SAL-001",
        from_date=half_year_ago,
        to_date=today
    )
    assert route.tier == PerformanceTier.TIER_3_HISTORICAL
    assert route.is_async_required is True
    assert route.target_latency_ms == 5000
    assert route.execution_strategy == "BACKGROUND_CHUNKED_ASYNC"


def test_router_tier4_streaming_export():
    """Verify Excel/CSV exports route to TIER_4_STREAMING_EXPORT."""
    today = date(2026, 8, 28)
    
    route_xlsx = PerformanceRouter.classify_query(
        report_id="RPT-SAL-001",
        from_date=today,
        to_date=today,
        is_export=True,
        export_format="xlsx"
    )
    assert route_xlsx.tier == PerformanceTier.TIER_4_STREAMING_EXPORT
    assert route_xlsx.is_streaming is True
    assert route_xlsx.execution_strategy == "ITERATIVE_STREAMING_WRITER"
