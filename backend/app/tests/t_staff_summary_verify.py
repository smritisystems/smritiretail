"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.35
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
from app.models.commission import CommissionParticipant, CommissionLedger
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
    comp = Company(id=f"comp-sum-{suffix}", name=f"Summary Co {suffix}",
                   gst_number="27ABCDE1234F1Z5", is_active=True)
    br = Branch(id=f"br-sum-{suffix}", company_id=comp.id,
                name=f"Summary Br {suffix}", code=f"BRSUM-{suffix}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def _make_user(db_session, suffix, comp_id, br_id, role=UserRole.CASHIER, **kwargs):
    user = User(
        id=f"usr-sum-{suffix}", username=f"usr_sum_{suffix}",
        full_name=f"Staff Member {suffix}",
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
async def test_commissions_summary_aggregation(db_session):
    """
    Verifies /api/v1/staff/commissions/summary:
    Aggregates EARNED and REVERSED rows from commission_ledgers accurately.
    """
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    manager = await _make_user(db_session, f"mgr-{suffix}", company.id, branch.id, UserRole.MANAGER)
    salesperson = await _make_user(db_session, f"sp-{suffix}", company.id, branch.id, UserRole.CASHIER)
    _set_tenant(company.id, branch.id)

    # Setup CommissionParticipant
    part = CommissionParticipant(
        id=f"cp-{suffix}",
        company_id=company.id,
        branch_id=branch.id,
        user_id=salesperson.id,
        person_name=salesperson.full_name,
        roles=["SALESPERSON"],
        is_active=True,
    )
    db_session.add(part)
    await db_session.commit()

    # Insert 2 EARNED ledgers and 1 REVERSED ledger
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    l1 = CommissionLedger(
        id=f"cml-1-{suffix}",
        company_id=company.id,
        branch_id=branch.id,
        participant_id=part.id,
        participant_role="SALESPERSON",
        transaction_type="EARNED",
        gross_sales_amount=Decimal("10000.00"),
        commission_amount=Decimal("200.00"),
        reference_invoice_id=f"INV-1-{suffix}",
        timestamp=now,
    )
    l2 = CommissionLedger(
        id=f"cml-2-{suffix}",
        company_id=company.id,
        branch_id=branch.id,
        participant_id=part.id,
        participant_role="SALESPERSON",
        transaction_type="EARNED",
        gross_sales_amount=Decimal("5000.00"),
        commission_amount=Decimal("100.00"),
        reference_invoice_id=f"INV-2-{suffix}",
        timestamp=now,
    )
    l3 = CommissionLedger(
        id=f"cml-3-{suffix}",
        company_id=company.id,
        branch_id=branch.id,
        participant_id=part.id,
        participant_role="SALESPERSON",
        transaction_type="REVERSED",
        gross_sales_amount=Decimal("-3000.00"),
        commission_amount=Decimal("-60.00"),
        reference_return_id=f"RET-1-{suffix}",
        timestamp=now,
    )
    db_session.add_all([l1, l2, l3])
    await db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = _bearer(manager, company.id, branch.id)
        res = await client.get(
            f"/api/v1/staff/commissions/summary?user_id={salesperson.id}",
            headers=headers
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["success"] is True
        assert data["transaction_count"] == 3
        assert data["gross_sales"] == 15000.0
        assert data["returned_sales"] == 3000.0
        assert data["net_sales"] == 12000.0
        assert data["earned_commission"] == 300.0
        assert data["reversed_commission"] == 60.0
        assert data["net_commission"] == 240.0
        assert len(data["entries"]) == 3


@pytest.mark.asyncio
async def test_attendance_summary_aggregation(db_session):
    """
    Verifies /api/v1/staff/attendance/summary:
    Aggregates shift records into present, late, absent, hours worked, and avg shift metrics.
    """
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    manager = await _make_user(db_session, f"mgr2-{suffix}", company.id, branch.id, UserRole.MANAGER)
    staff = await _make_user(db_session, f"staff-{suffix}", company.id, branch.id, UserRole.CASHIER)
    _set_tenant(company.id, branch.id)

    today = date.today()
    d1 = today - timedelta(days=2)
    d2 = today - timedelta(days=1)
    d3 = today

    # Record 1: Present (8h)
    r1 = AttendanceRecord(
        company_id=company.id,
        branch_id=branch.id,
        user_id=staff.id,
        attendance_date=d1,
        status="PRESENT",
        check_in_at=datetime.combine(d1, datetime.min.time(), tzinfo=timezone.utc).replace(hour=9, minute=0),
        check_out_at=datetime.combine(d1, datetime.min.time(), tzinfo=timezone.utc).replace(hour=17, minute=0),
    )
    # Record 2: Late (7h)
    r2 = AttendanceRecord(
        company_id=company.id,
        branch_id=branch.id,
        user_id=staff.id,
        attendance_date=d2,
        status="LATE",
        check_in_at=datetime.combine(d2, datetime.min.time(), tzinfo=timezone.utc).replace(hour=10, minute=0),
        check_out_at=datetime.combine(d2, datetime.min.time(), tzinfo=timezone.utc).replace(hour=17, minute=0),
    )
    # Record 3: Absent
    r3 = AttendanceRecord(
        company_id=company.id,
        branch_id=branch.id,
        user_id=staff.id,
        attendance_date=d3,
        status="ABSENT",
    )
    db_session.add_all([r1, r2, r3])
    await db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = _bearer(manager, company.id, branch.id)
        res = await client.get(
            f"/api/v1/staff/attendance/summary?user_id={staff.id}",
            headers=headers
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["success"] is True
        assert data["total_days"] == 3
        assert data["present_days"] == 2  # 1 PRESENT + 1 LATE
        assert data["late_days"] == 1
        assert data["absent_days"] == 1
        assert data["total_hours_worked"] == 15.0  # 8.0 + 7.0
        assert data["avg_daily_hours"] == 7.5     # 15.0 / 2
