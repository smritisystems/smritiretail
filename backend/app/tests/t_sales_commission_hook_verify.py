"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.34
Created      : 2026-10-08
Modified     : 2026-10-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone
import pytest
from sqlalchemy import select, text

from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context
from app.core.security import hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Branch, Company
from app.models.commission import CommissionProgram, CommissionRule, CommissionParticipant, CommissionLedger
from app.services.sales_hook import write_commission_accrual, write_commission_reversal
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
    comp = Company(id=f"comp-comm-{suffix}", name=f"Commission Co {suffix}",
                   gst_number="27ABCDE1234F1Z5", is_active=True)
    br = Branch(id=f"br-comm-{suffix}", company_id=comp.id,
                name=f"Commission Br {suffix}", code=f"BRCOM-{suffix}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def _make_salesperson(db_session, suffix, comp_id, br_id):
    user = User(
        id=f"usr-sp-{suffix}", username=f"salesperson_{suffix}",
        full_name=f"Sales Agent {suffix}",
        hashed_password=hash_password("Test@1234"),
        role=UserRole.CASHIER, is_active=True, is_deleted=False,
        company_id=comp_id, branch_id=br_id,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.mark.asyncio
async def test_commission_accrual_and_idempotency(db_session):
    """
    Verifies that write_commission_accrual:
    1. Resolves/provisions the salesperson as a CommissionParticipant.
    2. Writes an EARNED CommissionLedger row with correct defaults.
    3. Respects idempotency when called repeatedly on the same invoice.
    """
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    sp = await _make_salesperson(db_session, suffix, company.id, branch.id)

    inv_id = f"inv-{suffix}"
    inv_no = f"INV-2026-{suffix}"
    grand_total = Decimal("5000.00")

    # Item lines without line-level salesperson defaults to header salesperson
    items = [
        {"product_id": f"prd-1-{suffix}", "line_total": Decimal("2000.00"), "salesperson_id": None},
        {"product_id": f"prd-2-{suffix}", "line_total": Decimal("3000.00"), "salesperson_id": None},
    ]

    # First call: should accrue commission (default 2% on 5000 = 100.00)
    created_count = await write_commission_accrual(
        db=db_session,
        company_id=company.id,
        branch_id=branch.id,
        invoice_id=inv_id,
        invoice_no=inv_no,
        grand_total=grand_total,
        items=items,
        header_salesperson_id=sp.id,
        creator="test-cashier",
    )
    await db_session.commit()
    assert created_count == 1

    # Verify CommissionParticipant was created
    participant = (await db_session.execute(
        select(CommissionParticipant).where(
            CommissionParticipant.company_id == company.id,
            CommissionParticipant.user_id == sp.id,
            CommissionParticipant.is_deleted == False
        )
    )).scalar_one_or_none()
    assert participant is not None
    assert participant.person_name == sp.full_name

    # Verify CommissionLedger EARNED row
    ledger = (await db_session.execute(
        select(CommissionLedger).where(
            CommissionLedger.company_id == company.id,
            CommissionLedger.reference_invoice_id == inv_no,
            CommissionLedger.transaction_type == "EARNED",
            CommissionLedger.is_deleted == False
        )
    )).scalar_one_or_none()
    assert ledger is not None
    assert ledger.participant_id == participant.id
    assert ledger.participant_role == "SALESPERSON"
    assert Decimal(str(ledger.gross_sales_amount)) == Decimal("5000.00")
    assert Decimal(str(ledger.commission_amount)) == Decimal("100.00")

    # Second call (idempotency check): should return 0 and not add duplicates
    second_count = await write_commission_accrual(
        db=db_session,
        company_id=company.id,
        branch_id=branch.id,
        invoice_id=inv_id,
        invoice_no=inv_no,
        grand_total=grand_total,
        items=items,
        header_salesperson_id=sp.id,
        creator="test-cashier",
    )
    assert second_count == 0

    all_ledgers = (await db_session.execute(
        select(CommissionLedger).where(
            CommissionLedger.company_id == company.id,
            CommissionLedger.reference_invoice_id == inv_no
        )
    )).scalars().all()
    assert len(all_ledgers) == 1


@pytest.mark.asyncio
async def test_commission_reversal_on_sales_return(db_session):
    """
    Verifies that write_commission_reversal:
    1. Correctly claws back commission proportionally on partial sales returns.
    2. Writes a REVERSED CommissionLedger row with negative commission.
    3. Respects idempotency when called again for the same return.
    """
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    sp = await _make_salesperson(db_session, suffix, company.id, branch.id)

    inv_id = f"inv-{suffix}"
    inv_no = f"INV-RET-{suffix}"
    grand_total = Decimal("10000.00")

    # Step 1: Accrue commission on invoice
    await write_commission_accrual(
        db=db_session,
        company_id=company.id,
        branch_id=branch.id,
        invoice_id=inv_id,
        invoice_no=inv_no,
        grand_total=grand_total,
        items=[],
        header_salesperson_id=sp.id,
        creator="cashier-1",
    )
    await db_session.commit()

    # Step 2: Process return of 4,000 out of 10,000 (40% return ratio)
    # Original comm: 2% of 10000 = 200.00. Reversal should be -80.00 (-40%).
    return_id = f"ret-{suffix}"
    return_no = f"CN-2026-{suffix}"
    return_total = Decimal("4000.00")

    rev_count = await write_commission_reversal(
        db=db_session,
        company_id=company.id,
        branch_id=branch.id,
        sales_return_id=return_id,
        return_no=return_no,
        orig_invoice_id=inv_id,
        orig_invoice_no=inv_no,
        return_total=return_total,
        orig_grand_total=grand_total,
        creator="cashier-1",
    )
    await db_session.commit()
    assert rev_count == 1

    # Verify REVERSED ledger entry
    rev_ledger = (await db_session.execute(
        select(CommissionLedger).where(
            CommissionLedger.company_id == company.id,
            CommissionLedger.reference_return_id == return_no,
            CommissionLedger.transaction_type == "REVERSED",
            CommissionLedger.is_deleted == False
        )
    )).scalar_one_or_none()
    assert rev_ledger is not None
    assert Decimal(str(rev_ledger.gross_sales_amount)) == Decimal("-4000.00")
    assert Decimal(str(rev_ledger.commission_amount)) == Decimal("-80.00")

    # Step 3: Idempotency check on return
    second_rev = await write_commission_reversal(
        db=db_session,
        company_id=company.id,
        branch_id=branch.id,
        sales_return_id=return_id,
        return_no=return_no,
        orig_invoice_id=inv_id,
        orig_invoice_no=inv_no,
        return_total=return_total,
        orig_grand_total=grand_total,
        creator="cashier-1",
    )
    assert second_rev == 0


@pytest.mark.asyncio
async def test_commission_with_configured_percentage_rule(db_session):
    """
    Verifies that active CommissionRule (e.g. 5% SALESPERSON rate) takes precedence
    over hardcoded fallback.
    """
    suffix = uuid.uuid4().hex[:6]
    company, branch = await _make_tenant(db_session, suffix)
    sp = await _make_salesperson(db_session, suffix, company.id, branch.id)

    # Setup CommissionProgram and 5% Rule
    prog = CommissionProgram(
        id=f"prog-{suffix}",
        company_id=company.id,
        branch_id=branch.id,
        name=f"Festive Incentive {suffix}",
        is_active=True,
    )
    rule = CommissionRule(
        id=f"rule-{suffix}",
        company_id=company.id,
        branch_id=branch.id,
        program_id=prog.id,
        participant_role="SALESPERSON",
        calculation_type="PERCENTAGE",
        rate_percent=Decimal("5.00"),
        is_active=True,
    )
    db_session.add_all([prog, rule])
    await db_session.commit()

    inv_id = f"inv-rule-{suffix}"
    inv_no = f"INV-FESTIVE-{suffix}"
    grand_total = Decimal("10000.00")

    count = await write_commission_accrual(
        db=db_session,
        company_id=company.id,
        branch_id=branch.id,
        invoice_id=inv_id,
        invoice_no=inv_no,
        grand_total=grand_total,
        items=[],
        header_salesperson_id=sp.id,
        creator="cashier-rule",
    )
    await db_session.commit()
    assert count == 1

    ledger = (await db_session.execute(
        select(CommissionLedger).where(
            CommissionLedger.company_id == company.id,
            CommissionLedger.reference_invoice_id == inv_no,
            CommissionLedger.transaction_type == "EARNED"
        )
    )).scalar_one_or_none()
    assert ledger is not None
    # 5% of 10000 = 500.00
    assert Decimal(str(ledger.commission_amount)) == Decimal("500.00")
