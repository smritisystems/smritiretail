"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.33
Created      : 2026-10-08
Modified     : 2026-10-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from datetime import datetime, timezone, timedelta
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Branch, Company
from app.models.staff_profile import StaffProfile
from app.models.hr import AttendanceRecord
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
    comp = Company(id=f"comp-punch-{suffix}", name=f"Punch Co {suffix}",
                   gst_number="27ABCDE1234F1Z5", is_active=True)
    br = Branch(id=f"br-punch-{suffix}", company_id=comp.id,
                name=f"Punch Br {suffix}", code=f"BRPUN-{suffix}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def _make_user(db_session, suffix, comp_id, br_id, role=UserRole.CASHIER, **kwargs):
    user = User(
        id=f"usr-punch-{suffix}", username=f"usr_punch_{suffix}",
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
async def test_interactive_punch_in_and_out_lifecycle(db_session):
    """
    Verifies /api/v1/staff/attendance/punch endpoint:
    1. First punch -> Clock IN (creates record, sets check_in_at).
    2. Repeated punch with mode 'IN' -> returns ALREADY_CHECKED_IN.
    3. Auto/OUT punch -> Clock OUT (updates check_out_at).
    """
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    cashier = await _make_user(db_session, f"cashier-{suffix}", company.id, branch.id, UserRole.CASHIER)
    _set_tenant(company.id, branch.id)
    headers = _bearer(cashier, company.id, branch.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Step 1: Clock IN
        r1 = await client.post(
            "/api/v1/staff/attendance/punch",
            json={"user_id": cashier.id, "punch_type": "AUTO", "device_source": "TEST_WEB"},
            headers=headers,
        )
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["success"] is True
        assert d1["action"] == "CHECKED_IN"
        assert d1["record"]["check_in_at"] is not None
        assert d1["record"]["check_out_at"] is None

        # Step 2: Redundant Punch IN
        r2 = await client.post(
            "/api/v1/staff/attendance/punch",
            json={"user_id": cashier.id, "punch_type": "IN"},
            headers=headers,
        )
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["action"] == "ALREADY_CHECKED_IN"

        # Step 3: Clock OUT
        r3 = await client.post(
            "/api/v1/staff/attendance/punch",
            json={"user_id": cashier.id, "punch_type": "OUT", "device_source": "TEST_WEB_OUT"},
            headers=headers,
        )
        assert r3.status_code == 200
        d3 = r3.json()
        assert d3["success"] is True
        assert d3["action"] == "CHECKED_OUT"
        assert d3["record"]["check_out_at"] is not None


@pytest.mark.asyncio
async def test_biometric_device_push_batch_ingestion(db_session):
    """
    Verifies /api/v1/staff/attendance/device-push endpoint:
    Resolves employee codes and pushes IN/OUT punches for multiple staff.
    """
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    manager = await _make_user(db_session, f"mgr-{suffix}", company.id, branch.id, UserRole.MANAGER)
    user_a = await _make_user(db_session, f"empA-{suffix}", company.id, branch.id, employee_code=f"EMP-A-{suffix}")
    user_b = await _make_user(db_session, f"empB-{suffix}", company.id, branch.id, employee_code=f"EMP-B-{suffix}")

    # Add staff profile for user_a
    prof_a = StaffProfile(
        id=f"prof-a-{suffix}",
        company_id=company.id,
        user_id=user_a.id,
        employee_code=f"EMP-A-{suffix}",
        country="India",
        status="ACTIVE",
    )
    db_session.add(prof_a)
    await db_session.commit()

    _set_tenant(company.id, branch.id)
    headers = _bearer(manager, company.id, branch.id)

    now = datetime.now(timezone.utc)
    punch_in_time = (now - timedelta(hours=4)).isoformat()
    punch_out_time = now.isoformat()

    payload = {
        "device_id": "eSSL-BIOMAX-01",
        "device_key": "sec-token-123",
        "branch_id": branch.id,
        "punches": [
            {
                "employee_code": f"EMP-A-{suffix}",
                "timestamp": punch_in_time,
                "punch_state": "CHECK_IN",
                "verify_type": "FINGERPRINT",
            },
            {
                "employee_code": f"EMP-A-{suffix}",
                "timestamp": punch_out_time,
                "punch_state": "CHECK_OUT",
                "verify_type": "FINGERPRINT",
            },
            {
                "employee_code": f"EMP-B-{suffix}",
                "timestamp": punch_in_time,
                "punch_state": "AUTO",
                "verify_type": "FACE",
            },
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/staff/attendance/device-push",
            json=payload,
            headers=headers,
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["success"] is True
        assert data["processed"] == 3
        assert len(data["errors"]) == 0
