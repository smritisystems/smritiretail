"""
/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.21.0
 * Created      : 2026-07-16
 * Modified     : 2026-07-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.models.auth import User
from app.models.tenant import Company, Branch
from app.models.report_schedule import ReportSchedule
from app.api.deps import get_db, get_tenant_context, TenantContext
from app.core.security import hash_password, create_access_token

pytestmark = pytest.mark.asyncio


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
async def setup_tenant_and_user(db_session):
    """Create company, branch, and manager user; override FastAPI dependencies."""
    suffix = uuid.uuid4().hex[:6]

    company = Company(id=f"comp-rsch-{suffix}", name=f"RSch Co {suffix}", is_active=True)
    branch  = Branch(
        id=f"br-rsch-{suffix}", company_id=company.id,
        name=f"RSch Branch {suffix}", code=f"BR-RSCH-{suffix}", is_active=True,
    )
    manager = User(
        id=f"usr-mgr-{suffix}", username=f"mgr_{suffix}",
        hashed_password=hash_password("pass"), role="MANAGER",
        company_id=company.id, branch_id=branch.id, is_active=True,
    )
    db_session.add_all([company, branch, manager])
    await db_session.commit()

    # Store for access in tests
    setup_tenant_and_user.company  = company
    setup_tenant_and_user.branch   = branch
    setup_tenant_and_user.manager  = manager

    # FastAPI dependency overrides
    async def _get_db():
        yield db_session

    def _get_tenant():
        return TenantContext(company_id=company.id, branch_id=branch.id)

    def _get_user():
        return manager

    app.dependency_overrides[get_db]             = _get_db
    app.dependency_overrides[get_tenant_context] = _get_tenant

    from app.api.deps import get_current_user
    app.dependency_overrides[get_current_user]   = _get_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_tenant_context, None)
    app.dependency_overrides.pop(get_current_user, None)


VALID_PAYLOAD = {
    "report_id":        "RPT-SAL-001",
    "report_name":      "Daily Sales Summary Register",
    "frequency":        "DAILY",
    "execution_time":   "08:00",
    "delivery_channel": "EMAIL",
    "delivery_target":  "test@smritibooks.com",
    "delivery_format":  "PDF",
}


# ─── Tests ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_studios_catalog_returns_all_studios():
    """GET /api/v1/reports/studios — should return all 3 studios with reports."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/reports/studios")
    assert res.status_code == 200, res.text
    data = res.json()
    assert "studios" in data
    assert "sales_studio"     in data["studios"]
    assert "purchase_studio"  in data["studios"]
    assert "inventory_studio" in data["studios"]
    assert len(data["studios"]["sales_studio"]["reports"]) >= 4


@pytest.mark.asyncio
async def test_create_schedule_returns_201(setup_tenant_and_user):
    """POST /api/v1/reports/schedules — MANAGER creates a schedule → 201."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/reports/schedules", json=VALID_PAYLOAD)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["report_id"]        == "RPT-SAL-001"
    assert data["delivery_channel"] == "EMAIL"
    assert data["delivery_target"]  == "test@smritibooks.com"
    assert data["frequency"]        == "DAILY"
    assert data["cron_expression"]  == "0 8 * * *"   # derived from DAILY + 08:00
    assert data["id"].startswith("SCH-")


@pytest.mark.asyncio
async def test_list_schedules_returns_tenant_scoped(setup_tenant_and_user):
    """GET /api/v1/reports/schedules — returns only this tenant's schedules."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create two schedules
        await client.post("/api/v1/reports/schedules", json=VALID_PAYLOAD)
        payload2 = {**VALID_PAYLOAD, "report_id": "RPT-PUR-001", "frequency": "WEEKLY"}
        await client.post("/api/v1/reports/schedules", json=payload2)

        res = await client.get("/api/v1/reports/schedules")

    assert res.status_code == 200, res.text
    schedules = res.json()
    assert len(schedules) == 2
    assert all(s["delivery_channel"] == "EMAIL" for s in schedules)


@pytest.mark.asyncio
async def test_delete_schedule_soft_deletes(setup_tenant_and_user, db_session):
    """DELETE /api/v1/reports/schedules/{id} — soft-deletes; row still in DB with is_deleted=True."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        create_res = await client.post("/api/v1/reports/schedules", json=VALID_PAYLOAD)
        schedule_id = create_res.json()["id"]

        del_res = await client.delete(f"/api/v1/reports/schedules/{schedule_id}")

    assert del_res.status_code == 204, del_res.text

    # Row still in DB but is_deleted=True
    from sqlalchemy.future import select
    result = await db_session.execute(
        select(ReportSchedule).where(ReportSchedule.id == schedule_id)
    )
    row = result.scalar_one_or_none()
    assert row is not None
    assert row.is_deleted is True
    assert row.is_active  is False


@pytest.mark.asyncio
async def test_delete_schedule_returns_404_for_unknown(setup_tenant_and_user):
    """DELETE /api/v1/reports/schedules/UNKNOWN → 404."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.delete("/api/v1/reports/schedules/SCH-DOES-NOT-EXIST")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_report_user_blocked_from_creating_schedule(setup_tenant_and_user):
    """Report User role must receive 403 on POST /schedules (preserved from Express behavior).
    Uses a lightweight mock — avoids inserting into the userrole Postgres enum.
    """
    from dataclasses import dataclass

    @dataclass
    class _MockReportUser:
        id: str = "usr-report-mock"
        role: str = "Report User"
        username: str = "report_user_mock"

    mock_report_user = _MockReportUser()

    from app.api.deps import get_current_user

    def _get_report_user():
        return mock_report_user

    app.dependency_overrides[get_current_user] = _get_report_user
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/api/v1/reports/schedules", json=VALID_PAYLOAD)
        assert res.status_code == 403, res.text
        assert "Read-Only" in res.json().get("detail", "")
    finally:
        app.dependency_overrides.pop(get_current_user, None)
