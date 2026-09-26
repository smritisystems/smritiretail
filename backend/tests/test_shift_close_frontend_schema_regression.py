"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.44.4
Created      : 2026-09-26
Modified     : 2026-09-26
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import sys
import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy.future import select

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import get_company_sessionmaker
from app.api.deps import TenantContext
from app.models.auth import User, UserRole
from app.models.pos import Shift, POSShiftDenominationCount, CashRegister
from app.services.pos import POSService
from app.schemas.pos import ShiftClose, CashDenominationBreakdown


async def ensure_regression_cashier(session, cashier_id: str) -> str:
    stmt = select(User).where(User.id == cashier_id)
    u = (await session.execute(stmt)).scalar_one_or_none()
    if not u:
        u = User(
            id=cashier_id,
            uuid=str(uuid.uuid4()),
            username=f"cashier_{cashier_id}_{uuid.uuid4().hex[:4]}",
            email=f"{cashier_id}_{uuid.uuid4().hex[:4]}@smritibooks.com",
            hashed_password="hashed_test_password",
            role=UserRole.CASHIER,
            is_active=True,
            is_deleted=False
        )
        session.add(u)
        await session.commit()
    return cashier_id


@pytest.mark.asyncio
async def test_pro_pos_shift_close_payload_reconciliation_e2e():
    """
    Regression Test:
    Verifies that the exact payload shape sent by ProPosShiftCloseDl.tsx:
      {
        'closing_balance': 5050.00,
        'closing_notes': 'Cashier EOD closeout with ₹5000 in notes and ₹50 in coins',
        'denominations': {
            'notes_2000': 0, 'notes_500': 10, 'notes_200': 0, 'notes_100': 0,
            'notes_50': 0, 'notes_20': 0, 'notes_10': 0, 'notes_5': 0,
            'notes_2': 0, 'notes_1': 0, 'coins_total': 50.00
        }
      }
    is accepted by ShiftClose schema, parses coins_total, preserves closing_notes,
    calculates exactly ₹5,050.00 closing balance into PostgreSQL, and persists
    the coin breakdown in pos_shift_denomination_counts.
    """
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "MAIN"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    suffix = uuid.uuid4().hex[:6]
    cashier_id = f"usr-reg-cashier-{suffix}"

    # 1. Simulate exact frontend payload produced by ProPosShiftCloseDl.tsx
    frontend_payload = {
        "closing_balance": 5050.00,
        "closing_notes": f"Cashier EOD closeout notes {suffix}",
        "denominations": {
            "notes_2000": 0,
            "notes_500": 10,
            "notes_200": 0,
            "notes_100": 0,
            "notes_50": 0,
            "notes_20": 0,
            "notes_10": 0,
            "notes_5": 0,
            "notes_2": 0,
            "notes_1": 0,
            "coins_total": 50.00,
        },
    }

    # 2. Pydantic validation parity
    close_req = ShiftClose.model_validate(frontend_payload)
    assert close_req.closing_balance == Decimal("5050.00"), "closing_balance must match frontend counted cash"
    assert close_req.closing_notes == f"Cashier EOD closeout notes {suffix}", "closing_notes must not be dropped"
    assert close_req.denominations is not None, "denominations breakdown must be parsed"
    assert close_req.denominations.coins_total == Decimal("50.00"), "coins_total must be parsed as Decimal('50.00')"
    assert close_req.denominations.calculate_total() == Decimal("5050.00"), "calculate_total must equal 5050.00 (5000 notes + 50 coins)"

    async with session_factory() as session:
        await ensure_regression_cashier(session, cashier_id)

        # 3. Create unique CashRegister and active open shift in DB
        reg_id = f"REG-REGRESS-{suffix}"
        reg = CashRegister(
            id=reg_id,
            company_id=company_id,
            branch_id=branch_id,
            name=f"Regression Counter {suffix}",
            code=f"REG-R-{suffix}",
            is_active=True,
            is_deleted=False
        )
        session.add(reg)
        await session.commit()

        shift = Shift(
            id=f"shift_reg_{suffix}",
            company_id=company_id,
            branch_id=branch_id,
            register_id=reg_id,
            cashier_id=cashier_id,
            status="OPEN",
            opening_balance=Decimal("5050.00"),
            expected_cash=Decimal("5050.00"),
            opened_at=datetime.now(timezone.utc) - timedelta(hours=8),
            is_deleted=False
        )
        session.add(shift)
        await session.commit()

        # 4. Invoke POSService.close_shift with parsed payload
        pos_svc = POSService(db=session, tenant=tenant)
        closed_shift = await pos_svc.close_shift(
            shift_id=shift.id,
            req=close_req,
            requesting_user_id=cashier_id
        )

        # 5. Assertions on closed Shift in PostgreSQL
        assert closed_shift.status == "CLOSED", "Shift must transition to CLOSED"
        assert closed_shift.closing_balance == Decimal("5050.00"), (
            f"Expected closing_balance Decimal('5050.00'), got {closed_shift.closing_balance}. Coins were dropped!"
        )
        assert closed_shift.variance == Decimal("0.00"), (
            f"Expected variance Decimal('0.00'), got {closed_shift.variance}. False shortage generated!"
        )
        assert closed_shift.closing_notes == f"Cashier EOD closeout notes {suffix}", (
            f"Expected closing_notes preserved, got {closed_shift.closing_notes}"
        )

        # 6. Verify pos_shift_denomination_counts has coin row persisted
        stmt_counts = select(POSShiftDenominationCount).where(
            POSShiftDenominationCount.shift_id == shift.id
        )
        counts_res = await session.execute(stmt_counts)
        counts = counts_res.scalars().all()

        coin_counts = [c for c in counts if c.denomination_value == Decimal("1.00")]
        assert len(coin_counts) == 1, "Must have exactly 1 record for coins in pos_shift_denomination_counts"
        assert coin_counts[0].actual_amount == Decimal("50.00"), (
            f"Expected coins actual_amount Decimal('50.00'), got {coin_counts[0].actual_amount}"
        )
        assert coin_counts[0].actual_count == 50, (
            f"Expected coins actual_count 50, got {coin_counts[0].actual_count}"
        )

        note_500_counts = [c for c in counts if c.denomination_value == Decimal("500.00")]
        assert len(note_500_counts) == 1, "Must have 1 record for notes_500"
        assert note_500_counts[0].actual_count == 10, "Must have 10 count for notes_500"
        assert note_500_counts[0].actual_amount == Decimal("5000.00"), "Must have ₹5,000 for notes_500"


@pytest.mark.asyncio
async def test_pro_pos_shift_close_without_denominations_fallback():
    """
    Regression Test:
    Verifies that if cashier submits closing_balance without denomination breakdown,
    the closing_balance is accepted directly and persisted without HTTP 400 rejection.
    """
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "MAIN"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    suffix = uuid.uuid4().hex[:6]
    cashier_id = f"usr-fallback-{suffix}"

    fallback_payload = {
        "closing_balance": 3500.00,
        "closing_notes": f"Fallback closeout {suffix}",
        "denominations": None
    }

    close_req = ShiftClose.model_validate(fallback_payload)
    assert close_req.closing_balance == Decimal("3500.00")

    async with session_factory() as session:
        await ensure_regression_cashier(session, cashier_id)

        reg_id = f"REG-FB-{suffix}"
        reg = CashRegister(
            id=reg_id,
            company_id=company_id,
            branch_id=branch_id,
            name=f"Fallback Counter {suffix}",
            code=f"REG-FB-{suffix}",
            is_active=True,
            is_deleted=False
        )
        session.add(reg)
        await session.commit()

        shift = Shift(
            id=f"shift_fb_{suffix}",
            company_id=company_id,
            branch_id=branch_id,
            register_id=reg_id,
            cashier_id=cashier_id,
            status="OPEN",
            opening_balance=Decimal("3500.00"),
            expected_cash=Decimal("3500.00"),
            opened_at=datetime.now(timezone.utc) - timedelta(hours=4),
            is_deleted=False
        )
        session.add(shift)
        await session.commit()

        pos_svc = POSService(db=session, tenant=tenant)
        closed_shift = await pos_svc.close_shift(
            shift_id=shift.id,
            req=close_req,
            requesting_user_id=cashier_id
        )

        assert closed_shift.status == "CLOSED"
        assert closed_shift.closing_balance == Decimal("3500.00")
        assert closed_shift.variance == Decimal("0.00")
