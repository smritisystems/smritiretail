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

SMRITI Reporting & BI Engine — Phase 4 API Endpoints Test Suite.
Verifies REST endpoints:
- GET /api/v1/reporting/catalog
- GET /api/v1/reporting/catalog/{report_id}
- GET /api/v1/reporting/alias-lookup
- GET /api/v1/reporting/metrics
- POST /api/v1/reporting/validate-envelope
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.api.deps import get_current_user, get_tenant_context, TenantContext
from app.models.auth import User, UserRole


# Mock Auth Dependency
async def mock_admin_user():
    return User(
        id="USR-TEST-ADMIN",
        username="admin_test",
        role=UserRole.SYSADMIN,
        is_active=True,
    )

async def mock_tenant():
    return TenantContext(
        company_id="COMP-TEST-001",
        branch_id="BR-TEST-MAIN",
    )


@pytest.fixture(autouse=True)
def override_auth():
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[get_tenant_context] = mock_tenant
    yield
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_reporting_catalog():
    """Verify GET /api/v1/reporting/catalog returns all 22 canonical reports."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/reporting/catalog")
        assert res.status_code == 200
        data = res.json()
        assert data["total_reports"] == 22
        assert len(data["studios"]) == 5
        assert len(data["reports"]) == 22


@pytest.mark.asyncio
async def test_get_reporting_catalog_filtered_by_studio():
    """Verify studio filtering on catalog."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/reporting/catalog?studio=sales_studio")
        assert res.status_code == 200
        data = res.json()
        assert data["total_reports"] == 5
        for r in data["reports"]:
            assert r["studio"] == "sales_studio"


@pytest.mark.asyncio
async def test_get_single_report_contract():
    """Verify GET /api/v1/reporting/catalog/{report_id}."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/reporting/catalog/RPT-SAL-001")
        assert res.status_code == 200
        data = res.json()
        assert data["report_id"] == "RPT-SAL-001"
        assert data["name"] == "Daily Sales Summary Register"
        assert "411" in data["shoper_aliases"]


@pytest.mark.asyncio
async def test_alias_lookup_endpoint():
    """Verify legacy Shoper 9 alias lookup API."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Look up MnuNo 412
        res1 = await ac.get("/api/v1/reporting/alias-lookup?q=412")
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["is_matched"] is True
        assert data1["matched_report_id"] == "RPT-TAX-002"

        # 2. Look up Win32 EXE SR236300 (Apparel Matrix)
        res2 = await ac.get("/api/v1/reporting/alias-lookup?q=SR236300")
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["is_matched"] is True
        assert data2["matched_report_id"] == "RPT-MRC-001"

        # 3. Non-existent query
        res3 = await ac.get("/api/v1/reporting/alias-lookup?q=UNKNOWN_CODE_999")
        assert res3.status_code == 200
        assert res3.json()["is_matched"] is False


@pytest.mark.asyncio
async def test_list_governed_metrics_endpoint():
    """Verify GET /api/v1/reporting/metrics."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/reporting/metrics")
        assert res.status_code == 200
        metrics = res.json()
        assert len(metrics) >= 15
        metric_ids = [m["metric_id"] for m in metrics]
        assert "MTR_NET_SALES" in metric_ids
        assert "MTR_GROSS_MARGIN_PCT" in metric_ids
        assert "MTR_GMROI" in metric_ids


@pytest.mark.asyncio
async def test_validate_and_build_envelope_endpoint():
    """Verify POST /api/v1/reporting/validate-envelope."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v1/reporting/validate-envelope?report_id=RPT-SAL-001")
        assert res.status_code == 200
        env = res.json()
        assert env["report_id"] == "RPT-SAL-001"
        assert env["contract_version"] == "v1.0"
        assert env["metric_version"] == "v1.0"
        assert env["company_id"] == "COMP-TEST-001"
        assert env["branch_id"] == "BR-TEST-MAIN"
        assert env["audit_trace_id"].startswith("AUD-")
