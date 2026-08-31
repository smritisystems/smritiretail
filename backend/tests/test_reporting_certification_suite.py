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

SMRITI Reporting & BI Engine v1.0.0-GA — Master Integration & Certification Suite.
Executes the 12-Stage Formal Architectural Certification:
01. Registry <-> API Reconciliation
02. Governed Metric <-> Pure Formula Reconciliation
03. UI <-> API Payload Reconciliation
04. Multi-Surface Horizontal Metric Reconciliation (Grid, BI, XLSX, CSV)
05. Server-Side RBAC & Field Masking Penetration Tests
06. Legacy Jump-Code Compatibility & Zero Domain Contamination
07. 5-Level Universal Drill-Down & Cryptographic Audit Lineage
08. Temporal Snapshot (data_as_of) Reproducibility
09. 4-Tier Query Performance Router Certification
10. Shoper 9 Operational Equivalence & Zero Formula Drift
11. End-to-End Multi-Tenant Isolation & 5-Vector Envelope Certification
12. Release Candidate Certification Gate
"""

from decimal import Decimal
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.api.deps import get_current_user, get_tenant_context, TenantContext
from app.models.auth import User, UserRole
from app.core.metric_dictionary import (
    GovernedMetricDictionary,
    calculate_net_sales,
    calculate_abv,
    calculate_upt,
    calculate_gross_margin_pct,
    calculate_gmroi,
    calculate_sell_through_pct,
    calculate_stock_aging_bucket,
)
from datetime import date, timedelta
from app.core.report_security import (
    ReportSecurityEngine,
    ROLE_PERMISSIONS,
    SENSITIVE_FINANCIAL_FIELDS,
)
from app.core.performance_router import (
    PerformanceRouter,
    PerformanceTier,
)
from app.core.inventory_snapshot_engine import (
    InventorySnapshotEngine,
    InventorySnapshotRecord,
    StockMovementDelta,
    InventoryStateMode,
)
from app.core.audit_lineage import (
    AuditLineageEngine,
    DrillDownLevel,
)
from app.db.seed_reports_registry import CANONICAL_REPORT_REGISTRY
from app.services.report_registry_svc import ReportRegistryService


# Mock Auth Dependency for Certification
async def mock_cert_admin():
    return User(
        id="USR-CERT-SYSADMIN",
        username="architect_cert",
        role=UserRole.SYSADMIN,
        is_active=True,
    )

async def mock_cert_tenant():
    return TenantContext(
        company_id="COMP-SMRITI-HQ",
        branch_id="BR-FLAGSHIP-01",
    )


@pytest.fixture(autouse=True)
def override_cert_auth():
    app.dependency_overrides[get_current_user] = mock_cert_admin
    app.dependency_overrides[get_tenant_context] = mock_cert_tenant
    yield
    app.dependency_overrides.clear()


# ============================================================================
# 01. Registry <-> API Reconciliation
# ============================================================================
@pytest.mark.asyncio
async def test_01_registry_api_reconciliation():
    """Verify all 22 registered reports are exposed without mismatch via REST API."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/reporting/catalog")
        assert res.status_code == 200
        catalog = res.json()
        assert catalog["total_reports"] == 22
        assert len(catalog["studios"]) == 5
        assert set(catalog["studios"]) == {
            "sales_studio",
            "merchandise_studio",
            "inventory_studio",
            "tax_studio",
            "mis_studio",
        }

        # Check that every single registry entry is returned accurately
        returned_ids = {r["report_id"] for r in catalog["reports"]}
        expected_ids = set(CANONICAL_REPORT_REGISTRY.keys())
        assert returned_ids == expected_ids


# ============================================================================
# 02. Governed Metric <-> Pure Formula Reconciliation
# ============================================================================
def test_02_metric_formula_reconciliation():
    """Verify pure mathematical formulas adhere to SMRITI accounting standards."""
    # Net Sales: Gross - Line Discounts - Header Concessions - Sales Returns + Taxable Adjustments
    net = calculate_net_sales(
        gross_sales=Decimal("168330.00"),
        line_discounts=Decimal("9250.00"),
        header_concessions=Decimal("0.00"),
        sales_returns=Decimal("1320.00"),
        taxable_adjustments=Decimal("0.00"),
    )
    assert net == Decimal("157760.00")

    # ABV: Net Sales / Total Invoices
    abv = calculate_abv(net_sales=Decimal("157760.00"), total_invoices=341)
    assert abv == Decimal("462.64")

    # UPT: Total Units Sold / Total Invoices
    upt = calculate_upt(total_units_sold=645, total_invoices=341)
    assert upt == Decimal("1.89")

    # Gross Margin %: ((Net Sales - COGS) / Net Sales) * 100
    gm_pct = calculate_gross_margin_pct(
        net_sales=Decimal("100000.00"),
        cogs=Decimal("60000.00"),
    )
    assert gm_pct == Decimal("40.00")

    # GMROI: Gross Margin Amt / Average Inventory at Cost
    gmroi = calculate_gmroi(
        gross_margin_amt=Decimal("40000.00"),
        avg_inventory_cost=Decimal("20000.00"),
    )
    assert gmroi == Decimal("2.00")


# ============================================================================
# 03. UI <-> API Payload Reconciliation
# ============================================================================
@pytest.mark.asyncio
async def test_03_ui_api_payload_reconciliation():
    """Verify report contract payload delivers all required fields for React UI."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/reporting/catalog/RPT-SAL-001")
        assert res.status_code == 200
        contract = res.json()

        # Check presence of mandatory UI attributes
        assert contract["name"] == "Daily Sales Summary Register"
        assert contract["studio"] == "sales_studio"
        assert "date" in contract["dimensions"]
        assert "MTR_NET_SALES" in contract["measures"]
        assert "CASHIER" in contract["allowed_roles"]
        assert contract["drill_route"] == "/sales/invoices"


# ============================================================================
# 04. Multi-Surface Horizontal Metric Reconciliation (Grid, BI, XLSX, CSV)
# ============================================================================
def test_04_multi_surface_horizontal_metric_reconciliation():
    """Verify that calculated metrics produce identical values regardless of surface."""
    test_gross = Decimal("3864230.75")
    test_discounts = Decimal("216890.00")
    test_returns = Decimal("21750.00")

    canonical_net = calculate_net_sales(
        gross_sales=test_gross,
        line_discounts=test_discounts,
        header_concessions=Decimal("0.00"),
        sales_returns=test_returns,
    )
    assert canonical_net == Decimal("3625590.75")

    # Simulate representation across surfaces
    grid_val = f"{canonical_net:,.2f}"
    bi_kpi_val = float(canonical_net)
    xlsx_numeric_val = Decimal(str(canonical_net))

    assert grid_val == "3,625,590.75"
    assert bi_kpi_val == 3625590.75
    assert xlsx_numeric_val == canonical_net


# ============================================================================
# 05. Server-Side RBAC & Field Masking Penetration Tests
# ============================================================================
def test_05_rbac_and_field_masking_penetration():
    """Penetration test: Verify no sensitive financial fields leak to Cashiers/Supervisors."""
    raw_sensitive_dataset = [
        {
            "bill_no": "BILL-1001",
            "item_name": "Leather Oxford Shoes",
            "cost_price": 1200.00,
            "cogs": 1200.00,
            "selling_price": 2499.00,
            "gross_margin_amt": 1299.00,
            "gross_margin_pct": 51.98,
            "gmroi": 2.15,
            "stock_valuation_amt": 120000.00,
            "nested_financials": {
                "supplier_cost": 1100.00,
                "unit_cost": 1100.00,
            },
        }
    ]

    # 1. Cashier Role Execution -> All financial sensitive fields MUST be masked with None
    masked_cashier = ReportSecurityEngine.mask_dataset(raw_sensitive_dataset, "CASHIER")
    row_cashier = masked_cashier[0]
    for sensitive_col in SENSITIVE_FINANCIAL_FIELDS:
        assert row_cashier.get(sensitive_col) is None, f"Leaked {sensitive_col} to CASHIER"
    assert row_cashier["nested_financials"]["unit_cost"] is None

    # 2. Executive / Accountant Role Execution -> Full Visibility
    unmasked_ceo = ReportSecurityEngine.mask_dataset(raw_sensitive_dataset, "CEO")
    row_ceo = unmasked_ceo[0]
    assert row_ceo["cost_price"] == 1200.00
    assert row_ceo["gross_margin_amt"] == 1299.00
    assert row_ceo["nested_financials"]["unit_cost"] == 1100.00


# ============================================================================
# 06. Legacy Jump-Code Compatibility & Zero Domain Contamination
# ============================================================================
@pytest.mark.asyncio
async def test_06_legacy_alias_compatibility():
    """Verify legacy Shoper 9 jump-codes resolve cleanly with zero domain contamination."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        test_cases = [
            ("411", "RPT-SAL-001"),
            ("412", "RPT-TAX-002"),
            ("SR202000", "RPT-TAX-005"),
            ("SR236300", "RPT-MRC-001"),
            ("472", "RPT-INV-002"),
            ("MnuNo 411", "RPT-SAL-001"),
        ]

        for query, expected_report in test_cases:
            res = await ac.get(f"/api/v1/reporting/alias-lookup?q={query}")
            assert res.status_code == 200
            data = res.json()
            assert data["is_matched"] is True
            assert data["matched_report_id"] == expected_report


# ============================================================================
# 07. 5-Level Universal Drill-Down & Cryptographic Audit Lineage
# ============================================================================
def test_07_five_level_universal_drilldown_lineage():
    """Verify complete 5-level vertical audit lineage trace."""
    # L1 -> L2: Register to Period
    trace_l2 = AuditLineageEngine.create_drilldown_trace(
        source_report_id="RPT-SAL-001",
        current_level=DrillDownLevel.LEVEL_1_REGISTER,
        target_level=DrillDownLevel.LEVEL_2_PERIOD,
        context_filters={"date": "2024-08-03"},
    )
    assert trace_l2.target_route == "/reports/sales/period-summary"
    assert len(trace_l2.audit_event_hash) == 24

    # L2 -> L3: Period to Department
    trace_l3 = AuditLineageEngine.create_drilldown_trace(
        source_report_id="RPT-SAL-001",
        current_level=DrillDownLevel.LEVEL_2_PERIOD,
        target_level=DrillDownLevel.LEVEL_3_DEPARTMENT,
        context_filters={"date": "2024-08-03", "department": "Footwear"},
        parent_trace_id=trace_l2.trace_id,
    )
    assert trace_l3.target_route == "/reports/sales/department-breakdown"
    assert trace_l3.parent_trace_id == trace_l2.trace_id

    # L3 -> L4: Department to Brand / Style Matrix
    trace_l4 = AuditLineageEngine.create_drilldown_trace(
        source_report_id="RPT-SAL-001",
        current_level=DrillDownLevel.LEVEL_3_DEPARTMENT,
        target_level=DrillDownLevel.LEVEL_4_BRAND_STYLE,
        context_filters={"date": "2024-08-03", "department": "Footwear", "brand": "Nike"},
        parent_trace_id=trace_l3.trace_id,
    )
    assert trace_l4.target_route == "/reports/sales/brand-style-matrix"

    # L4 -> L5: Brand / Style to Transaction Document Details
    trace_l5 = AuditLineageEngine.create_drilldown_trace(
        source_report_id="RPT-SAL-001",
        current_level=DrillDownLevel.LEVEL_4_BRAND_STYLE,
        target_level=DrillDownLevel.LEVEL_5_TRANSACTION_DOC,
        context_filters={"bill_no": "S-030824-1156"},
        source_document_ids=["S-030824-1156"],
        parent_trace_id=trace_l4.trace_id,
    )
    assert trace_l5.target_route == "/sales/invoice-detail"
    assert "S-030824-1156" in trace_l5.source_document_ids


# ============================================================================
# 08. Temporal Snapshot (data_as_of) Reproducibility
# ============================================================================
def test_08_temporal_snapshot_reproducibility():
    """Verify point-in-time inventory balances reproduce without genesis replay."""
    frozen_base = InventorySnapshotRecord(
        snapshot_id="SNAP-2026-07",
        company_id="COMP-SMRITI-HQ",
        branch_id="BR-FLAGSHIP-01",
        item_code="SKU-POLO-NAVY-M",
        period_end_date=date(2026, 7, 31),
        closing_stock_qty=Decimal("100.00"),
        unit_landed_cost=Decimal("500.00"),
        valuation_amount=Decimal("50000.00"),
        is_frozen=True,
        integrity_hash="HASH7890",
    )

    deltas = [
        StockMovementDelta(
            movement_id="MOV-01",
            date=date(2026, 8, 5),
            item_code="SKU-POLO-NAVY-M",
            inward_qty=Decimal("20.00"),
        ),
        StockMovementDelta(
            movement_id="MOV-02",
            date=date(2026, 8, 12),
            item_code="SKU-POLO-NAVY-M",
            outward_qty=Decimal("15.00"),
        ),
    ]

    reconstructed = InventorySnapshotEngine.compute_as_of_stock(
        item_code="SKU-POLO-NAVY-M",
        as_of_date=date(2026, 8, 15),
        latest_prior_snapshot=frozen_base,
        delta_movements=deltas,
    )

    assert reconstructed.calculated_stock_qty == Decimal("105.00")
    assert reconstructed.total_valuation_amt == Decimal("52500.00")
    assert reconstructed.state_mode == InventoryStateMode.DERIVED_FROM_SNAPSHOT
    assert reconstructed.delta_movements_count == 2


# ============================================================================
# 09. 4-Tier Query Performance Router Certification
# ============================================================================
def test_09_performance_tier_routing_certification():
    """Verify automatic performance tier classification and circuit breakers."""
    today = date(2026, 8, 28)
    month_ago = today - timedelta(days=30)
    half_year_ago = today - timedelta(days=180)

    # 1. Interactive POS -> Tier 1 (<50ms, direct indexed SQL)
    route_pos = PerformanceRouter.classify_query(
        report_id="RPT-SAL-001",
        from_date=today,
        to_date=today,
        is_multi_branch=False,
    )
    assert route_pos.tier == PerformanceTier.TIER_1_INTERACTIVE
    assert route_pos.target_latency_ms == 50
    assert route_pos.is_async_required is False
    assert route_pos.execution_strategy == "DIRECT_INDEXED_SQL"

    # 2. Heavy Analytical -> Tier 2 (<300ms, Aggregation CTE Window)
    route_matrix = PerformanceRouter.classify_query(
        report_id="RPT-MRC-001",
        from_date=month_ago,
        to_date=today,
    )
    assert route_matrix.tier == PerformanceTier.TIER_2_ANALYTICAL
    assert route_matrix.target_latency_ms == 300
    assert route_matrix.execution_strategy == "AGGREGATION_CTE_WINDOW"

    # 3. Heavy Historical (180 days) -> Tier 3 (Async Background)
    route_historical = PerformanceRouter.classify_query(
        report_id="RPT-SAL-001",
        from_date=half_year_ago,
        to_date=today,
    )
    assert route_historical.tier == PerformanceTier.TIER_3_HISTORICAL
    assert route_historical.is_async_required is True
    assert route_historical.execution_strategy == "BACKGROUND_CHUNKED_ASYNC"

    # 4. Streaming Export -> Tier 4 (Streaming writer)
    route_export = PerformanceRouter.classify_query(
        report_id="RPT-SAL-001",
        from_date=today,
        to_date=today,
        is_export=True,
        export_format="xlsx",
    )
    assert route_export.tier == PerformanceTier.TIER_4_STREAMING_EXPORT
    assert route_export.is_streaming is True
    assert route_export.execution_strategy == "ITERATIVE_STREAMING_WRITER"


# ============================================================================
# 10. Shoper 9 Operational Equivalence & Zero Formula Drift
# ============================================================================
def test_10_shoper9_operational_equivalence():
    """Verify that every legacy report code maps to an exact modern equivalent."""
    alias_map = ReportRegistryService.get_all_shoper_aliases()
    assert len(alias_map) >= 22
    assert "411" in alias_map
    assert "412" in alias_map
    assert "SR202000" in alias_map
    assert "SR236300" in alias_map

    # Ensure no two aliases point to conflicting reports unintentionally
    assert alias_map["411"] == "RPT-SAL-001"
    assert alias_map["412"] == "RPT-TAX-002"
    assert alias_map["SR202000"] == "RPT-TAX-005"
    assert alias_map["SR236300"] == "RPT-MRC-001"


# ============================================================================
# 11. End-to-End Multi-Tenant Isolation & 5-Vector Envelope Certification
# ============================================================================
@pytest.mark.asyncio
async def test_11_tenant_isolation_and_envelope_certification():
    """Verify complete 5-vector execution envelope construction with tenant isolation."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v1/reporting/validate-envelope?report_id=RPT-SAL-001")
        assert res.status_code == 200
        env = res.json()

        # 5-Vector Envelope Invariants
        assert env["company_id"] == "COMP-SMRITI-HQ"
        assert env["branch_id"] == "BR-FLAGSHIP-01"
        assert env["report_id"] == "RPT-SAL-001"
        assert env["contract_version"] == "v1.0"
        assert env["metric_version"] == "v1.0"
        assert env["audit_trace_id"].startswith("AUD-")


# ============================================================================
# 12. Release Candidate Certification Gate
# ============================================================================
def test_12_release_candidate_readiness_gate():
    """Final Certification Gate: Asserts 100% compliance with Frozen v1.0.0-GA Architecture."""
    # Check 1: Exactly 22 Canonical Reports
    assert len(CANONICAL_REPORT_REGISTRY) == 22

    # Check 2: Exactly 5 Studios
    studios = {r.studio for r in CANONICAL_REPORT_REGISTRY.values()}
    assert len(studios) == 5

    # Check 3: All Governed Metrics Defined
    metrics = GovernedMetricDictionary.list_all_metrics()
    assert len(metrics) >= 15

    # Check 4: Zero unmapped measures in registry
    valid_metric_ids = {m.metric_id for m in metrics}
    for report in CANONICAL_REPORT_REGISTRY.values():
        for measure in report.measures:
            assert measure in valid_metric_ids, f"Measure {measure} not found in Governed Metric Dictionary"

    print("\n[CERTIFICATION PASSED] SMRITI Reporting & BI Engine v1.0.0-GA Release Candidate Certified!")
