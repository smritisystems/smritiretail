"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.36
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
    comp = Company(id=f"comp-stl-{suffix}", name=f"Settle Co {suffix}",
                   gst_number="27ABCDE1234F1Z5", is_active=True)
    br = Branch(id=f"br-stl-{suffix}", company_id=comp.id,
                name=f"Settle Br {suffix}", code=f"BRSTL-{suffix}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def _make_user(db_session, suffix, comp_id, br_id, role=UserRole.CASHIER, **kwargs):
    user = User(
        id=f"usr-stl-{suffix}", username=f"usr_stl_{suffix}",
        full_name=f"Settle Member {suffix}",
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
async def test_commission_settlement_disbursement(db_session):
    """
    Verifies /api/v1/staff/commissions/settle:
    1. Accrues positive EARNED commissions.
    2. Partial disbursement appends PAID row and reduces unsettled balance.
    3. Full disbursement sets remaining balance to 0.
    4. Settle attempt on zero balance raises HTTP 422.
    """
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    manager = await _make_user(db_session, f"mgr-{suffix}", company.id, branch.id, UserRole.MANAGER)
    salesperson = await _make_user(db_session, f"sp-{suffix}", company.id, branch.id, UserRole.CASHIER)
    _set_tenant(company.id, branch.id)

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
        gross_sales_amount=Decimal("15000.00"),
        commission_amount=Decimal("300.00"),
        reference_invoice_id=f"INV-2-{suffix}",
        timestamp=now,
    )
    db_session.add_all([l1, l2])
    await db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = _bearer(manager, company.id, branch.id)

        # 1. Partial settlement of 350.00
        settle_res = await client.post(
            "/api/v1/staff/commissions/settle",
            json={
                "user_id": salesperson.id,
                "amount": 350.0,
                "payment_mode": "BANK_TRANSFER",
                "notes": "Mid-month payout",
            },
            headers=headers
        )
        assert settle_res.status_code == 200, settle_res.text
        s_data = settle_res.json()
        assert s_data["success"] is True
        assert s_data["disbursed_amount"] == 350.0
        assert s_data["remaining_balance"] == 150.0
        assert "PAYOUT-" in s_data["payout_ref"]

        # 2. Check summary reflection
        sum_res = await client.get(
            f"/api/v1/staff/commissions/summary?user_id={salesperson.id}",
            headers=headers
        )
        assert sum_res.status_code == 200, sum_res.text
        sum_data = sum_res.json()
        assert sum_data["earned_commission"] == 500.0
        assert sum_data["paid_commission"] == 350.0
        assert sum_data["unsettled_commission"] == 150.0
        assert sum_data["transaction_count"] == 3

        # 3. Full settlement of remaining balance
        settle_full = await client.post(
            "/api/v1/staff/commissions/settle",
            json={
                "user_id": salesperson.id,
                "payment_mode": "CASH",
            },
            headers=headers
        )
        assert settle_full.status_code == 200, settle_full.text
        assert settle_full.json()["remaining_balance"] == 0.0

        # 4. Attempt settlement when balance is 0
        settle_zero = await client.post(
            "/api/v1/staff/commissions/settle",
            json={"user_id": salesperson.id},
            headers=headers
        )
        assert settle_zero.status_code == 422
        assert "No positive commission balance" in settle_zero.json()["detail"]


@pytest.mark.asyncio
async def test_leave_balances_auto_provision_and_request(db_session):
    """
    Verifies /api/v1/staff/leave/balances & /leave/requests:
    1. Auto-provisions statutory CL (12), SL (12), EL (15) balances on first read.
    2. Submits a leave request.
    """
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    manager = await _make_user(db_session, f"mgr-lv-{suffix}", company.id, branch.id, UserRole.MANAGER)
    staff = await _make_user(db_session, f"stf-lv-{suffix}", company.id, branch.id, UserRole.CASHIER)
    _set_tenant(company.id, branch.id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = _bearer(manager, company.id, branch.id)

        # 1. Fetch balances -> triggers auto-provisioning
        b_res = await client.get(
            f"/api/v1/staff/leave/balances?user_id={staff.id}",
            headers=headers
        )
        assert b_res.status_code == 200, b_res.text
        b_data = b_res.json()
        assert b_data["total"] == 3
        types = {b["leave_type"]: b["entitled_days"] for b in b_data["balances"]}
        assert types == {"CL": 12, "SL": 12, "EL": 15}

        # 2. Submit leave request
        req_res = await client.post(
            "/api/v1/staff/leave/requests",
            json={
                "user_id": staff.id,
                "leave_type": "CL",
                "start_date": str(date.today() + timedelta(days=5)),
                "end_date": str(date.today() + timedelta(days=6)),
                "reason": "Personal family event",
            },
            headers=headers
        )
        assert req_res.status_code == 201, req_res.text
        req_data = req_res.json()
        assert req_data["status"] == "PENDING"
        assert req_data["total_days"] == 2

        # 3. List leave requests
        list_res = await client.get(
            f"/api/v1/staff/leave/requests?user_id={staff.id}",
            headers=headers
        )
        assert list_res.status_code == 200, list_res.text
        assert list_res.json()["total"] == 1
