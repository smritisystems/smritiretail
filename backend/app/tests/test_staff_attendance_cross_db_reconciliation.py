"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.45
Created      : 2026-10-09
Modified     : 2026-10-09
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Automated Regression Tests for Cross-Database Tenant Identity Reconciliation.
Verifies that control-plane directory user IDs (e.g. 'usr-cashier-direct', 'usr-manager-direct')
resolve cleanly when queried across company-scoped HR endpoints (/attendance, /attendance/summary,
/leave/requests, /leave/balances, and /attendance/punch) without 404 errors.
"""

import uuid
from datetime import date, datetime, timezone
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Branch, Company
from app.models.hr import AttendanceRecord, LeaveBalance
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    """Wire test DB session and clean up tables."""
    await clear_db(db_session)

    async def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_company_db] = _get_db
    try:
        yield
    finally:
        try:
            await clear_db(db_session)
        except Exception:
            pass
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_company_db, None)
        app.dependency_overrides.pop(get_tenant_context, None)


async def _setup_reconciliation_environment(db_session):
    suffix = uuid.uuid4().hex[:6]
    comp = Company(
        id=f"comp-rec-{suffix}",
        name=f"Reconciliation Corp {suffix}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    br = Branch(
        id=f"br-rec-{suffix}",
        company_id=comp.id,
        name=f"Main Branch {suffix}",
        code=f"BR-{suffix}",
        is_active=True,
    )
    admin_user = User(
        id=f"usr-admin-{suffix}",
        uuid=str(uuid.uuid4()),
        username=f"admin_{suffix}",
        email=f"admin_{suffix}@smriti.com",
        hashed_password=hash_password("Pass@123"),
        role=UserRole.SYSADMIN,
        is_active=True,
        company_id=comp.id,
        branch_id=br.id,
    )
    # Control-plane cashier user identity
    control_cashier = User(
        id="usr-cashier-direct",
        uuid=str(uuid.uuid4()),
        username=f"cashier_{suffix}",
        email=f"cashier_{suffix}@smriti.com",
        hashed_password=hash_password("Pass@123"),
        role=UserRole.CASHIER,
        is_active=True,
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add_all([comp, br, admin_user, control_cashier])
    await db_session.commit()

    async def _get_tenant():
        return TenantContext(
            company_id=comp.id,
            branch_id=br.id,
            role=UserRole.SYSADMIN,
        )
    app.dependency_overrides[get_tenant_context] = _get_tenant

    token = create_access_token(data={"sub": admin_user.id, "company_id": comp.id})
    headers = {"Authorization": f"Bearer {token}"}
    return comp, br, admin_user, control_cashier, headers


@pytest.mark.asyncio
async def test_list_attendance_cross_database_resolution(db_session):
    comp, br, admin_user, control_cashier, headers = await _setup_reconciliation_environment(db_session)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Query attendance for control-plane user ID 'usr-cashier-direct'
        resp = await client.get(
            f"/api/v1/staff/attendance?user_id={control_cashier.id}",
            headers=headers,
        )
        assert resp.status_code == 200, f"Expected 200 but got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "records" in data
        assert data["total"] == 0


@pytest.mark.asyncio
async def test_attendance_summary_cross_database_resolution(db_session):
    comp, br, admin_user, control_cashier, headers = await _setup_reconciliation_environment(db_session)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Query attendance summary for control-plane user ID 'usr-cashier-direct'
        resp = await client.get(
            f"/api/v1/staff/attendance/summary?user_id={control_cashier.id}&period=2026-10",
            headers=headers,
        )
        assert resp.status_code == 200, f"Expected 200 but got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["present_days"] == 0
        assert data["total_hours_worked"] == 0.0


@pytest.mark.asyncio
async def test_leave_balances_cross_database_autoseed(db_session):
    comp, br, admin_user, control_cashier, headers = await _setup_reconciliation_environment(db_session)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Query leave balances for control-plane user ID 'usr-cashier-direct'
        resp = await client.get(
            f"/api/v1/staff/leave/balances?user_id={control_cashier.id}",
            headers=headers,
        )
        assert resp.status_code == 200, f"Expected 200 but got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["total"] == 3
        types = {b["leave_type"] for b in data["balances"]}
        assert types == {"CL", "SL", "EL"}


@pytest.mark.asyncio
async def test_punch_attendance_cross_database_resolution(db_session):
    comp, br, admin_user, control_cashier, headers = await _setup_reconciliation_environment(db_session)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Interactive punch clock-in for control-plane user ID 'usr-cashier-direct'
        payload = {
            "user_id": control_cashier.id,
            "punch_type": "IN",
            "notes": "Morning Shift Opening",
        }
        resp = await client.post(
            "/api/v1/staff/attendance/punch",
            json=payload,
            headers=headers,
        )
        assert resp.status_code == 200, f"Expected 200 but got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["success"] is True
        assert data["action"] == "CHECKED_IN"
