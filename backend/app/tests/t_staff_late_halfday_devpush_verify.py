"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.51
Created      : 2026-10-11
Modified     : 2026-10-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Sprint 2 / Sprint 3 new tests:
  T-LATE-01  Late clock-in detection (F-02)
  T-LATE-02  On-time clock-in is PRESENT, not LATE
  T-HALF-01  Clock-out after < 4h sets HALF_DAY (F-07)
  T-HALF-02  Clock-out after >= 4h stays PRESENT
  T-HALF-03  Late employee who works >= 4h stays LATE
  T-DEV-01   device-push rejected when SMRITI.HR.DEVICE_PUSH_API_KEY not set (F-03)
  T-DEV-02   device-push rejected when device_key is wrong (F-03)
  T-DEV-03   device-push succeeds when device_key matches registered key (F-03)
"""

import uuid
import pytest
from datetime import datetime, timezone, timedelta, time
from httpx import ASGITransport, AsyncClient

from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Branch, Company
from app.models.hr import AttendanceRecord
from app.models.system_parameter import SystemParameter
from app.models.staff_profile import StaffProfile
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
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


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _make_tenant(db_session, suffix):
    comp = Company(id=f"comp-att2-{suffix}", name=f"Att2 Co {suffix}",
                   gst_number="27ABCDE1234F1Z5", is_active=True)
    br = Branch(id=f"br-att2-{suffix}", company_id=comp.id,
                name=f"Att2 Br {suffix}", code=f"BRATT-{suffix}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def _make_user(db_session, suffix, comp_id, br_id, role=UserRole.CASHIER, **kwargs):
    user = User(
        id=f"usr-att2-{suffix}", username=f"usr_att2_{suffix}",
        hashed_password=hash_password("Test@1234"),
        role=role, is_active=True, is_deleted=False,
        company_id=comp_id, branch_id=br_id,
        **kwargs,
    )
    db_session.add(user)
    await db_session.commit()
    return user


async def _seed_system_param(db_session, comp_id, canonical_code, val_text):
    """Seed a SMRITI.HR.* system parameter for test isolation."""
    sp = SystemParameter(
        id=f"sp-{uuid.uuid4().hex[:12]}",
        company_id=comp_id,
        param_code=canonical_code,
        canonical_code=canonical_code,
        category="HR",
        category_name="Human Resources",
        description=f"Test seed: {canonical_code}",
        data_type="Text",
        mutability="Variable",
        profile_type="COMMON",
        scope_level="COMPANY",
        terminal_id="COMMON",
        val_text=val_text,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(sp)
    await db_session.commit()
    return sp


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


# ── T-LATE-01: Late clock-in → status = LATE ─────────────────────────────────

@pytest.mark.asyncio
async def test_late_clock_in_sets_late_status(db_session):
    """
    T-LATE-01: If punch_time > shift_start + grace_period, status must be LATE.
    Seeds SHIFT_START_TIME=00:01 and LATE_THRESHOLD_MINUTES=1 so that any
    punch in the test run (current time UTC) is definitively late.
    """
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    cashier = await _make_user(db_session, f"c-{suffix}", company.id, branch.id)

    # Force shift start to 00:01 UTC — every punch today is "late"
    await _seed_system_param(db_session, company.id, "SMRITI.HR.SHIFT_START_TIME", "00:01")
    await _seed_system_param(db_session, company.id, "SMRITI.HR.LATE_THRESHOLD_MINUTES", "0")

    _set_tenant(company.id, branch.id)
    headers = _bearer(cashier, company.id, branch.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post(
            "/api/v1/staff/attendance/punch",
            json={"user_id": cashier.id, "punch_type": "AUTO", "device_source": "TEST"},
            headers=headers,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["action"] == "CHECKED_IN"
        assert data["record"]["status"] == "LATE", (
            f"Expected LATE but got {data['record']['status']}. "
            f"Shift set to 00:01 UTC with 0 min grace — any punch should be LATE."
        )
        assert "marked LATE" in data["message"]


# ── T-LATE-02: On-time clock-in → status = PRESENT ───────────────────────────

@pytest.mark.asyncio
async def test_ontime_clock_in_sets_present_status(db_session):
    """
    T-LATE-02: If punch_time <= shift_start + grace_period, status must be PRESENT.
    Seeds SHIFT_START_TIME=23:59 (far future) so every test punch is on-time.
    """
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    cashier = await _make_user(db_session, f"c-{suffix}", company.id, branch.id)

    # Shift start far in the future — no punch can be late
    await _seed_system_param(db_session, company.id, "SMRITI.HR.SHIFT_START_TIME", "23:59")
    await _seed_system_param(db_session, company.id, "SMRITI.HR.LATE_THRESHOLD_MINUTES", "0")

    _set_tenant(company.id, branch.id)
    headers = _bearer(cashier, company.id, branch.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post(
            "/api/v1/staff/attendance/punch",
            json={"user_id": cashier.id, "punch_type": "AUTO"},
            headers=headers,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["record"]["status"] == "PRESENT", (
            f"Expected PRESENT but got {data['record']['status']}."
        )


# ── T-HALF-01: Clock-out after < 4h → HALF_DAY ───────────────────────────────

@pytest.mark.asyncio
async def test_short_shift_clock_out_sets_half_day(db_session):
    """
    T-HALF-01: Clock-out after < 4h of work must set status = HALF_DAY.
    Seeds an existing attendance record with check_in_at 2h ago, then punches out.
    """
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    cashier = await _make_user(db_session, f"c-{suffix}", company.id, branch.id)
    await _seed_system_param(db_session, company.id, "SMRITI.HR.HALF_DAY_HOURS_THRESHOLD", "4")
    await _seed_system_param(db_session, company.id, "SMRITI.HR.SHIFT_START_TIME", "23:59")

    now_utc = datetime.now(timezone.utc)
    check_in_2h_ago = now_utc - timedelta(hours=2)
    existing = AttendanceRecord(
        id=f"att-half-{suffix}",
        company_id=company.id,
        branch_id=branch.id,
        user_id=cashier.id,
        attendance_date=now_utc.date(),
        status="PRESENT",
        check_in_at=check_in_2h_ago,
        check_out_at=None,
        correction_status="NONE",
        created_by="test",
    )
    db_session.add(existing)
    await db_session.commit()

    _set_tenant(company.id, branch.id)
    headers = _bearer(cashier, company.id, branch.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post(
            "/api/v1/staff/attendance/punch",
            json={"user_id": cashier.id, "punch_type": "OUT"},
            headers=headers,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["action"] == "CHECKED_OUT"
        assert data["record"]["status"] == "HALF_DAY", (
            f"Expected HALF_DAY (2h < 4h threshold) but got {data['record']['status']}"
        )
        assert "HALF_DAY" in data["message"]


# ── T-HALF-02: Clock-out after >= 4h → PRESENT ───────────────────────────────

@pytest.mark.asyncio
async def test_full_shift_clock_out_stays_present(db_session):
    """
    T-HALF-02: Clock-out after >= 4h must keep status = PRESENT.
    """
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    cashier = await _make_user(db_session, f"c-{suffix}", company.id, branch.id)
    await _seed_system_param(db_session, company.id, "SMRITI.HR.HALF_DAY_HOURS_THRESHOLD", "4")
    await _seed_system_param(db_session, company.id, "SMRITI.HR.SHIFT_START_TIME", "23:59")

    now_utc = datetime.now(timezone.utc)
    check_in_5h_ago = now_utc - timedelta(hours=5)
    existing = AttendanceRecord(
        id=f"att-full-{suffix}",
        company_id=company.id,
        branch_id=branch.id,
        user_id=cashier.id,
        attendance_date=now_utc.date(),
        status="PRESENT",
        check_in_at=check_in_5h_ago,
        check_out_at=None,
        correction_status="NONE",
        created_by="test",
    )
    db_session.add(existing)
    await db_session.commit()

    _set_tenant(company.id, branch.id)
    headers = _bearer(cashier, company.id, branch.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post(
            "/api/v1/staff/attendance/punch",
            json={"user_id": cashier.id, "punch_type": "OUT"},
            headers=headers,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["record"]["status"] == "PRESENT", (
            f"Expected PRESENT (5h >= 4h threshold) but got {data['record']['status']}"
        )


# ── T-HALF-03: LATE employee works >= 4h → stays LATE ────────────────────────

@pytest.mark.asyncio
async def test_late_employee_full_shift_stays_late(db_session):
    """
    T-HALF-03: A LATE employee who works >= 4h must keep LATE status on clock-out.
    """
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    cashier = await _make_user(db_session, f"c-{suffix}", company.id, branch.id)
    await _seed_system_param(db_session, company.id, "SMRITI.HR.HALF_DAY_HOURS_THRESHOLD", "4")

    now_utc = datetime.now(timezone.utc)
    existing = AttendanceRecord(
        id=f"att-late-full-{suffix}",
        company_id=company.id,
        branch_id=branch.id,
        user_id=cashier.id,
        attendance_date=now_utc.date(),
        status="LATE",  # arrived late, but worked full shift
        check_in_at=now_utc - timedelta(hours=5),
        check_out_at=None,
        correction_status="NONE",
        created_by="test",
    )
    db_session.add(existing)
    await db_session.commit()

    _set_tenant(company.id, branch.id)
    headers = _bearer(cashier, company.id, branch.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post(
            "/api/v1/staff/attendance/punch",
            json={"user_id": cashier.id, "punch_type": "OUT"},
            headers=headers,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["record"]["status"] == "LATE", (
            f"LATE status must be preserved after full shift. Got: {data['record']['status']}"
        )


# ── T-DEV-01: device-push rejected when key not configured ───────────────────

@pytest.mark.asyncio
async def test_device_push_rejected_when_key_not_configured(db_session):
    """
    T-DEV-01: POST /attendance/device-push must return 403 SMRITI-PERM-010
    when SMRITI.HR.DEVICE_PUSH_API_KEY is not in system_parameters.
    """
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    _set_tenant(company.id, branch.id)
    # NOTE: No SMRITI.HR.DEVICE_PUSH_API_KEY seeded

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post(
            "/api/v1/staff/attendance/device-push",
            json={
                "device_id": "TEST-DEVICE-01",
                "device_key": "any-key",
                "branch_id": branch.id,
                "punches": [],
            },
        )
        assert r.status_code == 403, f"Expected 403 but got {r.status_code}: {r.text}"
        body = r.json()
        detail = body.get("detail", {})
        assert detail.get("code") == "SMRITI-PERM-010", f"Expected SMRITI-PERM-010 but got: {detail}"


# ── T-DEV-02: device-push rejected when wrong key sent ───────────────────────

@pytest.mark.asyncio
async def test_device_push_rejected_when_wrong_key(db_session):
    """
    T-DEV-02: POST /attendance/device-push must return 401 SMRITI-PERM-011
    when device_key does not match registered SMRITI.HR.DEVICE_PUSH_API_KEY.
    """
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    await _seed_system_param(db_session, company.id, "SMRITI.HR.DEVICE_PUSH_API_KEY", "correct-secret-key")
    _set_tenant(company.id, branch.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post(
            "/api/v1/staff/attendance/device-push",
            json={
                "device_id": "TEST-DEVICE-01",
                "device_key": "wrong-key",
                "branch_id": branch.id,
                "punches": [],
            },
        )
        assert r.status_code == 401, f"Expected 401 but got {r.status_code}: {r.text}"
        body = r.json()
        detail = body.get("detail", {})
        assert detail.get("code") == "SMRITI-PERM-011", f"Expected SMRITI-PERM-011 but got: {detail}"


# ── T-DEV-03: device-push succeeds when correct key provided ─────────────────

@pytest.mark.asyncio
async def test_device_push_succeeds_with_correct_key(db_session):
    """
    T-DEV-03: POST /attendance/device-push must return 200 and process punches
    when device_key matches SMRITI.HR.DEVICE_PUSH_API_KEY.
    """
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    emp = await _make_user(db_session, f"e-{suffix}", company.id, branch.id,
                           employee_code=f"EMP-{suffix}")
    await _seed_system_param(db_session, company.id, "SMRITI.HR.DEVICE_PUSH_API_KEY", "valid-key-xyz")
    _set_tenant(company.id, branch.id)

    now = datetime.now(timezone.utc)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post(
            "/api/v1/staff/attendance/device-push",
            json={
                "device_id": "ZKTeco-001",
                "device_key": "valid-key-xyz",
                "branch_id": branch.id,
                "punches": [
                    {
                        "employee_code": f"EMP-{suffix}",
                        "timestamp": (now - timedelta(hours=8)).isoformat(),
                        "punch_state": "CHECK_IN",
                        "verify_type": "FINGERPRINT",
                    },
                ],
            },
        )
        assert r.status_code == 200, f"Expected 200 but got {r.status_code}: {r.text}"
        data = r.json()
        assert data["success"] is True
        assert data["processed"] == 1
        assert data["errors"] == []
