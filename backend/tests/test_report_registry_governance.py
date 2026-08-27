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

SMRITI Reporting & BI Engine — Phase 1 Governance & Data Contracts Test Suite.
Verifies Invariants 1–10:
- Single Source of Truth Registry
- Governed Metric Dictionary Formulas
- Decoupled Shoper 9 Legacy Alias Resolution
- Server-Side RBAC Validation
- Forensic 5-Vector Execution Envelope
"""

import pytest
from decimal import Decimal
from datetime import datetime, timezone
from fastapi import HTTPException

from app.schemas.report_registry import StudioType, ReportContractStatus
from app.db.seed_reports_registry import CANONICAL_REPORT_REGISTRY
from app.core.metric_dictionary import (
    GovernedMetricDictionary,
    calculate_net_sales,
    calculate_abv,
    calculate_upt,
    calculate_gross_margin_amt,
    calculate_gross_margin_pct,
    calculate_gmroi,
    calculate_sell_through_pct,
    calculate_stock_aging_bucket,
)
from app.services.report_registry_svc import ReportRegistryService


# ---------------------------------------------------------------------------
# Test 1: Registry Completeness & Studio Coverage
# ---------------------------------------------------------------------------

def test_canonical_registry_completeness():
    """Verify that all 22 canonical reports exist with valid metadata."""
    assert len(CANONICAL_REPORT_REGISTRY) == 22, f"Expected 22 canonical reports, found {len(CANONICAL_REPORT_REGISTRY)}"

    studios_found = set(r.studio for r in CANONICAL_REPORT_REGISTRY.values())
    expected_studios = {
        StudioType.SALES_STUDIO,
        StudioType.MERCHANDISE_STUDIO,
        StudioType.INVENTORY_STUDIO,
        StudioType.TAX_STUDIO,
        StudioType.MIS_STUDIO,
    }
    assert studios_found == expected_studios, f"Missing studios: {expected_studios - studios_found}"

    for r_id, report in CANONICAL_REPORT_REGISTRY.items():
        assert report.report_id == r_id
        assert len(report.name) > 0
        assert len(report.dimensions) > 0, f"Report {r_id} has empty dimensions"
        assert len(report.measures) > 0, f"Report {r_id} has empty measures"
        assert len(report.allowed_roles) > 0, f"Report {r_id} has empty allowed_roles"
        assert report.contract_version.startswith("v")
        assert report.metric_version.startswith("v")
        assert report.schema_version.startswith("v")
        assert report.security_policy_version.startswith("v")
        assert report.status == ReportContractStatus.ACTIVE


# ---------------------------------------------------------------------------
# Test 2: Governed Metric Dictionary Integrity & Calculation Math
# ---------------------------------------------------------------------------

def test_governed_metric_dictionary_integrity():
    """Verify that all report measures exist in the Governed Metric Dictionary."""
    all_measures = set()
    for report in CANONICAL_REPORT_REGISTRY.values():
        all_measures.update(report.measures)

    for m_id in all_measures:
        metric = GovernedMetricDictionary.get_metric(m_id)
        assert metric.metric_id == m_id
        assert len(metric.formula_expression) > 0
        assert metric.version.startswith("v")


def test_pure_metric_calculations():
    """Verify deterministic precision of canonical retail KPI formulas."""
    # 1. Net Sales: Gross (10,000) - LineDisc (500) - HeaderDisc (200) - Returns (1,000) + Adjustments (0) = 8,300.00
    net_sales = calculate_net_sales(
        gross_sales=Decimal("10000.00"),
        line_discounts=Decimal("500.00"),
        header_concessions=Decimal("200.00"),
        sales_returns=Decimal("1000.00"),
        taxable_adjustments=Decimal("0.00")
    )
    assert net_sales == Decimal("8300.00")

    # 2. Average Basket Value (ABV): Net Sales (8,300) / 100 Invoices = 83.00
    abv = calculate_abv(net_sales=Decimal("8300.00"), total_invoices=100)
    assert abv == Decimal("83.00")

    # 3. Units Per Transaction (UPT): 250 Units / 100 Invoices = 2.50
    upt = calculate_upt(total_units_sold=250, total_invoices=100)
    assert upt == Decimal("2.50")

    # 4. Gross Margin Amount & Pct: Net Sales (10,000) - COGS (6,000) = 4,000 (40.00%)
    margin_amt = calculate_gross_margin_amt(net_sales=Decimal("10000.00"), cogs=Decimal("6000.00"))
    margin_pct = calculate_gross_margin_pct(net_sales=Decimal("10000.00"), cogs=Decimal("6000.00"))
    assert margin_amt == Decimal("4000.00")
    assert margin_pct == Decimal("40.00")

    # 5. GMROI: Gross Margin (4,000) / Avg Inventory (2,000) = 2.00
    gmroi = calculate_gmroi(gross_margin_amt=Decimal("4000.00"), avg_inventory_cost=Decimal("2000.00"))
    assert gmroi == Decimal("2.00")

    # 6. Sell-Through: 80 sold / 100 starting = 80.00%
    sell_thru = calculate_sell_through_pct(units_sold=80, starting_stock_units=100)
    assert sell_thru == Decimal("80.00")

    # 7. Stock Aging Buckets
    assert calculate_stock_aging_bucket(15) == "0-30 Days"
    assert calculate_stock_aging_bucket(45) == "31-60 Days"
    assert calculate_stock_aging_bucket(75) == "61-90 Days"
    assert calculate_stock_aging_bucket(120) == "90+ Days (Aged)"


# ---------------------------------------------------------------------------
# Test 3: Decoupled Shoper 9 Legacy Alias Resolution
# ---------------------------------------------------------------------------

def test_shoper9_legacy_alias_resolution():
    """Verify legacy codes resolve without polluting the core domain."""
    # Test MnuNo aliases
    r411 = ReportRegistryService.resolve_legacy_alias("411")
    assert r411.is_matched is True
    assert r411.matched_report_id == "RPT-SAL-001"
    assert r411.matched_report_name == "Daily Sales Summary Register"

    r412 = ReportRegistryService.resolve_legacy_alias("412")
    assert r412.is_matched is True
    assert r412.matched_report_id == "RPT-TAX-002"

    # Test Win32 EXE aliases
    r_sr202000 = ReportRegistryService.resolve_legacy_alias("SR202000")
    assert r_sr202000.is_matched is True
    assert r_sr202000.matched_report_id == "RPT-TAX-005"

    r_sr236300 = ReportRegistryService.resolve_legacy_alias("SR236300")
    assert r_sr236300.is_matched is True
    assert r_sr236300.matched_report_id == "RPT-MRC-001"

    r_sr202300 = ReportRegistryService.resolve_legacy_alias("SR202300")
    assert r_sr202300.is_matched is True
    assert r_sr202300.matched_report_id == "RPT-TAX-001"

    # Test Non-existent alias
    r_invalid = ReportRegistryService.resolve_legacy_alias("NON_EXISTENT_999")
    assert r_invalid.is_matched is False
    assert r_invalid.matched_report_id is None


# ---------------------------------------------------------------------------
# Test 4: RBAC & Execution Request Validation
# ---------------------------------------------------------------------------

def test_execution_request_rbac_and_measure_validation():
    """Verify RBAC and measure legality enforcement."""
    # Cashier allowed on Daily Sales
    report = ReportRegistryService.validate_execution_request(
        report_id="RPT-SAL-001",
        user_role="CASHIER",
        requested_measures=["MTR_NET_SALES"]
    )
    assert report.report_id == "RPT-SAL-001"

    # Cashier forbidden on Gross Margin report (RPT-PRF-001)
    with pytest.raises(HTTPException) as exc_info:
        ReportRegistryService.validate_execution_request(
            report_id="RPT-PRF-001",
            user_role="CASHIER"
        )
    assert exc_info.value.status_code == 403

    # Invalid measure request raises 400
    with pytest.raises(HTTPException) as exc_info:
        ReportRegistryService.validate_execution_request(
            report_id="RPT-SAL-001",
            user_role="STORE_MANAGER",
            requested_measures=["MTR_INVALID_MEASURE_XYZ"]
        )
    assert exc_info.value.status_code == 400


# ---------------------------------------------------------------------------
# Test 5: Forensic Execution Envelope Generation
# ---------------------------------------------------------------------------

def test_forensic_execution_envelope_generation():
    """Verify generation of complete 5-vector forensic execution envelope."""
    as_of = datetime(2026, 8, 28, 0, 0, 0, tzinfo=timezone.utc)
    envelope = ReportRegistryService.build_execution_envelope(
        report_id="RPT-SAL-001",
        executed_by_user="USR-001",
        executed_by_role="STORE_MANAGER",
        company_id="COMP-001",
        branch_id="BR-MAIN",
        data_as_of=as_of,
        filters_applied={"date": "2026-08-28"}
    )

    assert envelope.execution_id.startswith("EXEC-")
    assert envelope.report_id == "RPT-SAL-001"
    assert envelope.report_name == "Daily Sales Summary Register"
    assert envelope.contract_version == "v1.0"
    assert envelope.metric_version == "v1.0"
    assert envelope.schema_version == "v1.0"
    assert envelope.security_policy_version == "v1.0"
    assert envelope.data_as_of == as_of
    assert envelope.executed_by_user == "USR-001"
    assert envelope.company_id == "COMP-001"
    assert envelope.branch_id == "BR-MAIN"
    assert envelope.audit_trace_id.startswith("AUD-")
    assert envelope.filters_applied == {"date": "2026-08-28"}
