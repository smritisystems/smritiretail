"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.41.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token


def _get_auth_headers():
    token = create_access_token(data={
        "sub": "usr-super",
        "role": "SYSADMIN",
        "company_id": "COMP-001",
        "branch_id": "BR-001",
        "tenant_id": "smriti001",
        "db_name": "smriti001",
        "is_active": True,
    })
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
        "X-Branch-ID": "BR-001"
    }


@pytest.mark.asyncio
async def test_capability_catalog():
    """Verify complete capability catalog query from control plane."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/capabilities/catalog", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["count"] >= 26
        caps = {c["code"]: c for c in data["capabilities"]}
        assert "POS" in caps
        assert "INVENTORY" in caps
        assert "SALES" in caps
        assert "ACCOUNTING" in caps
        assert "WMS" in caps
        assert "GST" in caps
        assert "CGE" in caps
        assert caps["POS"]["dependencies"] == ["INVENTORY", "SALES", "ACCOUNTING"]


@pytest.mark.asyncio
async def test_plan_bundles_endpoint():
    """Verify standard plan subscription tiers and bundles."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/capabilities/plans", headers=_get_auth_headers())
        assert res.status_code == 200
        plans = res.json()["plans"]
        assert "BASIC" in plans
        assert "PROFESSIONAL" in plans
        assert "ENTERPRISE" in plans
        assert "INVENTORY" in plans["BASIC"]
        assert "POS" in plans["PROFESSIONAL"]
        assert "CGE" in plans["ENTERPRISE"]


@pytest.mark.asyncio
async def test_capability_dependency_validation_fail_closed():
    """Verify strict dependency graph validation (fail closed)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Valid set with all prerequisites satisfied
        res_valid = await client.post(
            "/api/v1/capabilities/validate",
            json={"capabilities": ["INVENTORY", "SALES", "ACCOUNTING", "POS"]},
            headers=_get_auth_headers()
        )
        assert res_valid.status_code == 200
        assert res_valid.json()["is_valid"] is True
        assert len(res_valid.json()["dependency_errors"]) == 0

        # Invalid set missing prerequisite: POS without INVENTORY, SALES, ACCOUNTING
        res_invalid = await client.post(
            "/api/v1/capabilities/validate",
            json={"capabilities": ["POS"]},
            headers=_get_auth_headers()
        )
        assert res_invalid.status_code == 200
        assert res_invalid.json()["is_valid"] is False
        assert len(res_invalid.json()["dependency_errors"]) >= 1
        err_text = " ".join(res_invalid.json()["dependency_errors"])
        assert "INVENTORY" in err_text or "SALES" in err_text


@pytest.mark.asyncio
async def test_plan_resolution_with_overrides():
    """Verify effective capability resolution given plan tier and tenant overrides."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/capabilities/resolve",
            json={
                "plan_tier": "BASIC",
                "tenant_overrides": {"WMS": True, "DISTRIBUTION": True}
            },
            headers=_get_auth_headers()
        )
        assert res.status_code == 200
        data = res.json()
        assert data["plan_tier"] == "BASIC"
        assert "WMS" in data["active_capabilities"]
        assert "DISTRIBUTION" in data["active_capabilities"]
        assert data["is_valid"] is True


@pytest.mark.asyncio
async def test_tenant_capabilities_binding_list():
    """Verify querying tenant capability bindings for active company context."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/capabilities/tenant", headers=_get_auth_headers())
        assert res.status_code == 200
        bindings = res.json()
        assert len(bindings) >= 10
        codes = [b["capability_code"] for b in bindings]
        assert "POS" in codes
        assert "INVENTORY" in codes


@pytest.mark.asyncio
async def test_tenant_capability_toggle_fail_closed():
    """Verify enabling/disabling capabilities with dependency guards."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Attempting to disable INVENTORY while POS is active should fail with HTTP 400
        res_fail = await client.post(
            "/api/v1/capabilities/tenant/toggle",
            json={"capability_code": "INVENTORY", "enable": False, "force": False},
            headers=_get_auth_headers()
        )
        assert res_fail.status_code == 400, f"Expected 400, got {res_fail.status_code}: {res_fail.text}"
        assert "Cannot disable capability 'INVENTORY'" in res_fail.json()["detail"]

        # 2. Toggle non-prerequisite capability DISTRIBUTION on and off
        res_toggle_on = await client.post(
            "/api/v1/capabilities/tenant/toggle",
            json={"capability_code": "DISTRIBUTION", "enable": True},
            headers=_get_auth_headers()
        )
        assert res_toggle_on.status_code == 200
        assert res_toggle_on.json()["is_enabled"] is True

        res_toggle_off = await client.post(
            "/api/v1/capabilities/tenant/toggle",
            json={"capability_code": "DISTRIBUTION", "enable": False},
            headers=_get_auth_headers()
        )
        assert res_toggle_off.status_code == 200
        assert res_toggle_off.json()["is_enabled"] is False


@pytest.mark.asyncio
async def test_feature_flags_and_company_toggle():
    """Verify feature flags retrieval and company-level toggle."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Get feature flags
        res = await client.get("/api/v1/capabilities/feature-flags", headers=_get_auth_headers())
        assert res.status_code == 200
        flags = {f["key"]: f for f in res.json()}
        assert "DARK_MODE_V2" in flags
        assert "ENHANCED_AUDIT_TRAIL" in flags

        # Toggle feature flag for company
        res_toggle = await client.post(
            "/api/v1/capabilities/feature-flags/DARK_MODE_V2/toggle",
            json={"enable": True},
            headers=_get_auth_headers()
        )
        assert res_toggle.status_code == 200
        assert res_toggle.json()["is_enabled"] is True


@pytest.mark.asyncio
async def test_module_states_endpoint():
    """Verify module lifecycle states query."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/capabilities/modules", headers=_get_auth_headers())
        assert res.status_code == 200
        modules = res.json()
        assert len(modules) >= 5
        uuids = [m["module_uuid"] for m in modules]
        assert "MOD-POS" in uuids
        assert "MOD-INV" in uuids
