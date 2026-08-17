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
import pytest
import httpx

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.api.deps import get_current_user
from app.models.auth import User, UserRole

sysadmin_user = User(id="usr-super", role=UserRole.SYSADMIN, company_id="COMP-001", branch_id="BR-MAIN")
cashier_user = User(id="usr-cashier", role=UserRole.CASHIER, company_id="COMP-001", branch_id="BR-MAIN")
manager_user = User(id="usr-manager", role=UserRole.MANAGER, company_id="COMP-001", branch_id="BR-MAIN")

@pytest.mark.asyncio
async def test_01_anonymous_request_rejected_401():
    """Verify anonymous request to protected control center endpoint returns 401."""
    app.dependency_overrides.clear()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/control-center/companies")
        assert res.status_code == 401

        res_action = await client.post(
            "/api/v1/control-center/lifecycle/action",
            json={"company_id": "COMP-001", "action": "SUSPEND"}
        )
        assert res_action.status_code == 401

        res_dev = await client.get("/api/v1/dev-tracker")
        assert res_dev.status_code == 401

@pytest.mark.asyncio
async def test_02_spoofed_x_user_id_header_rejected_401():
    """Verify spoofed header x-user-id: usr_sysadmin is ignored and returns 401 without Bearer token."""
    app.dependency_overrides.clear()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(
            "/api/v1/control-center/companies",
            headers={"x-user-id": "usr_sysadmin"}
        )
        assert res.status_code == 401

        res_action = await client.post(
            "/api/v1/control-center/lifecycle/action",
            json={"company_id": "COMP-001", "action": "SUSPEND"},
            headers={"x-user-id": "usr_sysadmin"}
        )
        assert res_action.status_code == 401

@pytest.mark.asyncio
async def test_03_missing_or_invalid_bearer_token_rejected_401():
    """Verify missing or invalid Bearer token fails closed with 401."""
    app.dependency_overrides.clear()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(
            "/api/v1/control-center/companies",
            headers={"Authorization": "Bearer INVALID_TOKEN_STRING"}
        )
        assert res.status_code == 401

@pytest.mark.asyncio
async def test_04_authenticated_ordinary_user_allowed_only_for_assigned_company():
    """Verify ordinary user (CASHIER/MANAGER) can access details of assigned company."""
    app.dependency_overrides[get_current_user] = lambda: cashier_user
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/control-center/companies/COMP-001")
        assert res.status_code == 200
        assert res.json()["company_id"] == "COMP-001"
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_05_company_a_user_accessing_company_b_returns_403():
    """Verify ordinary user assigned to Company A (COMP-001) cannot access Company B (COMP-002) detail or modules."""
    app.dependency_overrides[get_current_user] = lambda: cashier_user
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res_detail = await client.get("/api/v1/control-center/companies/COMP-002")
        assert res_detail.status_code == 403

        res_modules = await client.get("/api/v1/control-center/modules?company_id=COMP-002")
        assert res_modules.status_code == 403
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_06_sysadmin_authorized_company_control_operation_succeeds_200():
    """Verify authenticated SYSADMIN user can list companies and execute lifecycle dry-run planning."""
    app.dependency_overrides[get_current_user] = lambda: sysadmin_user
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res_list = await client.get("/api/v1/control-center/companies")
        assert res_list.status_code == 200
        assert len(res_list.json()) > 0

        res_action = await client.post(
            "/api/v1/control-center/lifecycle/action",
            json={"company_id": "COMP-001", "action": "SUSPEND"}
        )
        assert res_action.status_code == 200
        assert res_action.json()["status"] == "PLANNED"
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_07_cashier_or_manager_lifecycle_action_rejected_403():
    """Verify non-SYSADMIN roles (CASHIER / MANAGER) are rejected with 403 for administrative lifecycle actions."""
    app.dependency_overrides[get_current_user] = lambda: manager_user
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res_action = await client.post(
            "/api/v1/control-center/lifecycle/action",
            json={"company_id": "COMP-001", "action": "SUSPEND"}
        )
        assert res_action.status_code == 403

        res_list = await client.get("/api/v1/control-center/companies")
        assert res_list.status_code == 403
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_08_non_sysadmin_unassigned_user_rejected_403():
    """Verify non-SYSADMIN user with ZERO assignment row in DB is strictly rejected with 403."""
    unassigned_cashier = User(id="usr-unassigned-999", role=UserRole.CASHIER, company_id="COMP-001")
    app.dependency_overrides[get_current_user] = lambda: unassigned_cashier
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/control-center/companies/COMP-001")
        assert res.status_code == 403
        assert "not authorized to access Company" in res.json()["detail"]
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_09_sysadmin_accesses_any_company_without_explicit_assignment_row():
    """Verify SYSADMIN role grants access to any company based on DB/verified role without needing an explicit assignment row."""
    unassigned_sysadmin = User(id="usr-sysadmin-unassigned-888", role=UserRole.SYSADMIN, company_id="COMP-001")
    app.dependency_overrides[get_current_user] = lambda: unassigned_sysadmin
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/control-center/companies/COMP-001")
        assert res.status_code == 200
        assert res.json()["company_id"] == "COMP-001"
    app.dependency_overrides.clear()
