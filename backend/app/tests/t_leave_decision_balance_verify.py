"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.37
Created      : 2026-10-08
Modified     : 2026-10-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from decimal import Decimal
from datetime import date, datetime, timezone, timedelta
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Branch, Company
from app.models.hr import LeaveBalance, LeaveRequest
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


async def _make_tenant(db_session, suffix):
    comp = Company(id=f"comp-lvd-{suffix}", name=f"Leave Dec Co {suffix}",
                   gst_number="27ABCDE1234F1Z5", is_active=True)
    br = Branch(id=f"br-lvd-{suffix}", company_id=comp.id,
                name=f"Leave Dec Br {suffix}", code=f"BRLVD-{suffix}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def _make_user(db_session, suffix, comp_id, br_id, role=UserRole.CASHIER, **kwargs):
    user = User(
        id=f"usr-lvd-{suffix}", username=f"usr_lvd_{suffix}",
        full_name=f"Leave Staff {suffix}",
        hashed_password=hash_password("Test@1234"),
        role=role, is_active=True, is_deleted=False,
        company_id=comp_id, branch_id=br_id,
        **kwargs
    )
    db_session.add(user)
    await db_session.commit()
    return user


def _bearer(user: User, comp_id: str, br_id: str) -> dict:
    token = create_access_token({
        "sub": user.id, "username": user.username,
        "role": user.role.value, "company_id": comp_id, "branch_id": br_id,
        "jti": str(uuid.uuid4()), "type": "access",
    })
    return {"Authorization": f"Bearer {token}"}


def _set_tenant(comp_id: str, br_id: str):
    async def _gt():
        return TenantContext(company_id=comp_id, branch_id=br_id)
    app.dependency_overrides[get_tenant_context] = _gt


@pytest.mark.asyncio
async def test_leave_approval_atomic_balance_deduction(db_session):
    """
    Verifies leave lifecycle with atomic balance deduction:
    1. Employee submits 3-day CL request -> pending_days increments to 3.
    2. Manager approves request -> status becomes APPROVED, used_days becomes 3, pending_days becomes 0.
    3. Employee submits 2-day CL request -> pending_days increments to 2.
    4. Manager rejects request -> status becomes REJECTED, used_days remains 3, pending_days becomes 0.
    """
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    emp = await _make_user(db_session, f"emp-{suffix}", comp.id, br.id, role=UserRole.CASHIER)
    mgr = await _make_user(db_session, f"mgr-{suffix}", comp.id, br.id, role=UserRole.MANAGER)
    _set_tenant(comp.id, br.id)

    emp_headers = _bearer(emp, comp.id, br.id)
    mgr_headers = _bearer(mgr, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Step 1: Employee submits 3-day leave request
        post_resp = await client.post(
            "/api/v1/staff/leave/requests",
            json={
                "user_id": emp.id,
                "leave_type": "CL",
                "start_date": "2026-10-10",
                "end_date": "2026-10-12",
                "reason": "Family wedding function",
            },
            headers=emp_headers,
        )
        assert post_resp.status_code == 201, post_resp.text
        req_data = post_resp.json()
        assert req_data["total_days"] == 3
        assert req_data["status"] == "PENDING"
        req_id = req_data["id"]

        # Step 2: Inquire balance - verify pending_days is 3
        bal_resp = await client.get(
            f"/api/v1/staff/leave/balances?user_id={emp.id}&leave_year=2026",
            headers=emp_headers,
        )
        assert bal_resp.status_code == 200
        bal_cl = next(b for b in bal_resp.json()["balances"] if b["leave_type"] == "CL")
        assert bal_cl["pending_days"] == 3
        assert bal_cl["used_days"] == 0

        # Step 3: Manager approves leave request
        dec_resp = await client.patch(
            f"/api/v1/staff/leave/requests/{req_id}/decision",
            json={
                "status": "APPROVED",
                "decision_reason": "Approved by floor manager",
            },
            headers=mgr_headers,
        )
        assert dec_resp.status_code == 200, dec_resp.text
        dec_data = dec_resp.json()
        assert dec_data["status"] == "APPROVED"
        assert dec_data["approver_id"] == mgr.id

        # Step 4: Verify balance updated - used_days=3, pending_days=0
        bal_resp2 = await client.get(
            f"/api/v1/staff/leave/balances?user_id={emp.id}&leave_year=2026",
            headers=emp_headers,
        )
        assert bal_resp2.status_code == 200
        bal_cl2 = next(b for b in bal_resp2.json()["balances"] if b["leave_type"] == "CL")
        assert bal_cl2["used_days"] == 3
        assert bal_cl2["pending_days"] == 0

        # Step 5: Employee submits second leave request (2 days)
        post_resp2 = await client.post(
            "/api/v1/staff/leave/requests",
            json={
                "user_id": emp.id,
                "leave_type": "CL",
                "start_date": "2026-10-20",
                "end_date": "2026-10-21",
                "reason": "Personal travel",
            },
            headers=emp_headers,
        )
        assert post_resp2.status_code == 201
        req2_id = post_resp2.json()["id"]

        # Verify pending_days updated to 2
        bal_resp3 = await client.get(
            f"/api/v1/staff/leave/balances?user_id={emp.id}&leave_year=2026",
            headers=emp_headers,
        )
        bal_cl3 = next(b for b in bal_resp3.json()["balances"] if b["leave_type"] == "CL")
        assert bal_cl3["pending_days"] == 2
        assert bal_cl3["used_days"] == 3

        # Step 6: Manager rejects second request
        rej_resp = await client.patch(
            f"/api/v1/staff/leave/requests/{req2_id}/decision",
            json={
                "status": "REJECTED",
                "decision_reason": "Staff shortage during festival sale",
            },
            headers=mgr_headers,
        )
        assert rej_resp.status_code == 200
        assert rej_resp.json()["status"] == "REJECTED"

        # Verify balance: pending_days released (0), used_days unchanged (3)
        bal_resp4 = await client.get(
            f"/api/v1/staff/leave/balances?user_id={emp.id}&leave_year=2026",
            headers=emp_headers,
        )
        bal_cl4 = next(b for b in bal_resp4.json()["balances"] if b["leave_type"] == "CL")
        assert bal_cl4["used_days"] == 3
        assert bal_cl4["pending_days"] == 0


@pytest.mark.asyncio
async def test_non_manager_cannot_decide_leave(db_session):
    """Verifies that non-manager/non-sysadmin roles are blocked from approving leave."""
    suffix = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, suffix)
    emp1 = await _make_user(db_session, f"emp1-{suffix}", comp.id, br.id, role=UserRole.CASHIER)
    emp2 = await _make_user(db_session, f"emp2-{suffix}", comp.id, br.id, role=UserRole.CASHIER)
    _set_tenant(comp.id, br.id)

    emp1_headers = _bearer(emp1, comp.id, br.id)
    emp2_headers = _bearer(emp2, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # emp1 submits leave
        post_resp = await client.post(
            "/api/v1/staff/leave/requests",
            json={
                "user_id": emp1.id,
                "leave_type": "SL",
                "start_date": "2026-10-15",
                "end_date": "2026-10-15",
                "reason": "Doctor appointment",
            },
            headers=emp1_headers,
        )
        assert post_resp.status_code == 201
        req_id = post_resp.json()["id"]

        # emp2 attempts to approve emp1's leave -> 403 Forbidden
        dec_resp = await client.patch(
            f"/api/v1/staff/leave/requests/{req_id}/decision",
            json={"status": "APPROVED"},
            headers=emp2_headers,
        )
        assert dec_resp.status_code == 403
