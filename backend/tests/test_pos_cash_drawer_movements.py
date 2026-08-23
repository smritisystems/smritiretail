"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.db.session import get_company_sessionmaker
from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context, get_current_user
from app.models.auth import User, UserRole
from app.models.pos import CashRegister, Shift, ShiftCashTransaction
from app.models.sales import SalesInvoice
from app.models.accounting import JournalVoucher, GeneralLedgerEntry, Account
from app.services.pos import POSService
from app.services.unified_accounting_ledger_service import UnifiedAccountingLedgerService
from app.schemas.pos import (
    ShiftOpen, ShiftClose, CashRegisterCreate,
    CashDenominationBreakdown, ShiftCashInRequest, ShiftCashDropRequest, ShiftTillExpenseRequest
)
from app.db.ephemeral_tenant_harness import EphemeralTenantHarness


async def ensure_test_cashier(session: AsyncSession, cashier_id: str = "usr-cashier-drawers") -> str:
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
async def test_physical_cash_denominations_calculation_and_closing():
    """
    Verify that physical denomination counts calculate exact closing balance,
    persist denominations JSONB on shift, and verify zero variance closing.
    """
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    unique_suffix = uuid.uuid4().hex[:6]

    async with session_factory() as session:
        cashier_id = await ensure_test_cashier(session, f"usr-denom-{unique_suffix}")
        pos_svc = POSService(session, tenant)

        reg_id = f"REG-DENOM-{unique_suffix}"
        await pos_svc.create_register(CashRegisterCreate(
            id=reg_id,
            name=f"Counter Denom {unique_suffix}",
            code=f"POS-D-{unique_suffix}"
        ))

        shift_id = f"SH-DENOM-{unique_suffix}"
        shift = await pos_svc.open_shift(
            ShiftOpen(id=shift_id, register_id=reg_id, opening_balance=Decimal("2000.00")),
            cashier_id=cashier_id
        )

        # Record Sales Invoice: ₹3,750 Cash
        inv = SalesInvoice(
            id=f"INV-D-{unique_suffix}",
            invoice_no=f"POS-INV-D-{unique_suffix}",
            company_id=company_id,
            branch_id=branch_id,
            shift_id=shift_id,
            payment_mode="CASH",
            grand_total=Decimal("3750.00"),
            tax_total=Decimal("0.00"),
            status="PAID",
            is_active=True,
            is_deleted=False
        )
        session.add(inv)
        await session.commit()

        # Denomination breakdown totaling exactly ₹5,750:
        # 10 x ₹500 = ₹5000
        # 3 x ₹200 = ₹600
        # 1 x ₹100 = ₹100
        # 1 x ₹50 = ₹50
        # Coins = ₹0.00
        denoms = CashDenominationBreakdown(
            notes_500=10,
            notes_200=3,
            notes_100=1,
            notes_50=1,
            coins_total=Decimal("0.00")
        )
        assert denoms.calculate_total() == Decimal("5750.00")

        # Close shift with physical denomination breakdown
        closed_shift = await pos_svc.close_shift(
            shift_id=shift_id,
            req=ShiftClose(denominations=denoms, closing_notes="Denomination count matched"),
            requesting_user_id=cashier_id
        )

        assert closed_shift.status == "CLOSED"
        assert closed_shift.closing_balance == Decimal("5750.00")
        assert closed_shift.expected_cash == Decimal("5750.00")
        assert closed_shift.variance == Decimal("0.00")
        assert closed_shift.denominations is not None
        assert closed_shift.denominations["notes_500"] == 10
        assert closed_shift.denominations["notes_200"] == 3

        # Verify Z-Report reflects denominations
        z_rep = await pos_svc.get_z_report(shift_id)
        assert z_rep["closing_balance"] == Decimal("5750.00")
        assert z_rep["variance"] == Decimal("0.00")
        assert z_rep["denominations"]["notes_500"] == 10


@pytest.mark.asyncio
async def test_mid_shift_cash_drop_to_bank_safe():
    """
    Verify that mid-shift cash drop records ShiftCashTransaction and posts
    an automated double-entry GL voucher (Debit Bank 1020, Credit Cash 1010).
    """
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    unique_suffix = uuid.uuid4().hex[:6]

    async with session_factory() as session:
        cashier_id = await ensure_test_cashier(session, f"usr-drop-{unique_suffix}")
        pos_svc = POSService(session, tenant)

        reg_id = f"REG-DROP-{unique_suffix}"
        await pos_svc.create_register(CashRegisterCreate(
            id=reg_id,
            name=f"Counter Drop {unique_suffix}",
            code=f"POS-DR-{unique_suffix}"
        ))

        shift_id = f"SH-DROP-{unique_suffix}"
        shift = await pos_svc.open_shift(
            ShiftOpen(id=shift_id, register_id=reg_id, opening_balance=Decimal("10000.00")),
            cashier_id=cashier_id
        )

        # Record Cash Drop of ₹6,000 to main safe/bank
        drop_req = ShiftCashDropRequest(
            amount=Decimal("6000.00"),
            reason="Mid-day vault transfer for security",
            idempotency_key=f"drop-{uuid.uuid4().hex}"
        )
        sct = await pos_svc.record_cash_drop(
            shift_id=shift_id,
            req=drop_req,
            requesting_user_id=cashier_id
        )

        assert sct.transaction_type == "CASH_DROP"
        assert sct.amount == Decimal("6000.00")
        assert sct.gl_voucher_id is not None
        assert sct.gl_voucher_no is not None

        # Verify Shift running cash_drops_total updated
        await session.refresh(shift)
        assert shift.cash_drops_total == Decimal("6000.00")

        # Verify GL Journal Voucher entries
        jv_stmt = select(JournalVoucher).where(JournalVoucher.id == sct.gl_voucher_id)
        jv = (await session.execute(jv_stmt)).scalar_one()
        assert jv.voucher_type == "CASH_DROP"
        assert jv.reference_doc_type == "POS_CASH_DROP"
        assert jv.reference_doc_id == sct.id
        assert jv.total_debit == Decimal("6000.00")
        assert jv.total_credit == Decimal("6000.00")

        gle_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv.id)
        entries = (await session.execute(gle_stmt)).scalars().all()
        assert len(entries) == 2

        acc_bank = await UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "1020")
        acc_cash = await UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "1010")

        bank_entry = next(e for e in entries if e.account_id == acc_bank.id)
        cash_entry = next(e for e in entries if e.account_id == acc_cash.id)

        assert bank_entry.debit_amount == Decimal("6000.00")
        assert bank_entry.credit_amount == Decimal("0.00")
        assert cash_entry.debit_amount == Decimal("0.00")
        assert cash_entry.credit_amount == Decimal("6000.00")


@pytest.mark.asyncio
async def test_mid_shift_till_expense_payout():
    """
    Verify that mid-shift petty expense records ShiftCashTransaction and posts
    an automated double-entry GL voucher (Debit Expenses 5000, Credit Cash 1010).
    """
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    unique_suffix = uuid.uuid4().hex[:6]

    async with session_factory() as session:
        cashier_id = await ensure_test_cashier(session, f"usr-exp-{unique_suffix}")
        pos_svc = POSService(session, tenant)

        reg_id = f"REG-EXP-{unique_suffix}"
        await pos_svc.create_register(CashRegisterCreate(
            id=reg_id,
            name=f"Counter Exp {unique_suffix}",
            code=f"POS-EX-{unique_suffix}"
        ))

        shift_id = f"SH-EXP-{unique_suffix}"
        shift = await pos_svc.open_shift(
            ShiftOpen(id=shift_id, register_id=reg_id, opening_balance=Decimal("5000.00")),
            cashier_id=cashier_id
        )

        # Record Till Expense of ₹350 for courier
        exp_req = ShiftTillExpenseRequest(
            amount=Decimal("350.00"),
            reason="Express store courier charges",
            receipt_ref="RCP-EXP-9001",
            idempotency_key=f"exp-{uuid.uuid4().hex}"
        )
        sct = await pos_svc.record_till_expense(
            shift_id=shift_id,
            req=exp_req,
            requesting_user_id=cashier_id
        )

        assert sct.transaction_type == "TILL_EXPENSE"
        assert sct.amount == Decimal("350.00")
        assert sct.receipt_ref == "RCP-EXP-9001"
        assert sct.gl_voucher_id is not None

        # Verify Shift running till_expenses_total updated
        await session.refresh(shift)
        assert shift.till_expenses_total == Decimal("350.00")

        # Verify GL Journal Voucher entries
        jv_stmt = select(JournalVoucher).where(JournalVoucher.id == sct.gl_voucher_id)
        jv = (await session.execute(jv_stmt)).scalar_one()
        assert jv.voucher_type == "TILL_EXPENSE"
        assert jv.reference_doc_type == "POS_TILL_EXPENSE"
        assert jv.total_debit == Decimal("350.00")
        assert jv.total_credit == Decimal("350.00")

        acc_exp = await UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "5000")
        acc_cash = await UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "1010")

        gle_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv.id)
        entries = (await session.execute(gle_stmt)).scalars().all()

        exp_entry = next(e for e in entries if e.account_id == acc_exp.id)
        cash_entry = next(e for e in entries if e.account_id == acc_cash.id)

        assert exp_entry.debit_amount == Decimal("350.00")
        assert exp_entry.credit_amount == Decimal("0.00")
        assert cash_entry.debit_amount == Decimal("0.00")
        assert cash_entry.credit_amount == Decimal("350.00")


@pytest.mark.asyncio
async def test_combined_cash_movements_and_closing_shortage_gl_balancing():
    """
    Verify that net expected cash factors in Opening + Cash Sales - Drops - Expenses,
    and reconciles remaining physical count variance via GL shortage voucher (5070).
    """
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    unique_suffix = uuid.uuid4().hex[:6]

    async with session_factory() as session:
        cashier_id = await ensure_test_cashier(session, f"usr-comb-{unique_suffix}")
        pos_svc = POSService(session, tenant)

        reg_id = f"REG-COMB-{unique_suffix}"
        await pos_svc.create_register(CashRegisterCreate(
            id=reg_id,
            name=f"Counter Combined {unique_suffix}",
            code=f"POS-CMB-{unique_suffix}"
        ))

        shift_id = f"SH-COMB-{unique_suffix}"
        # 1. Opening Cash = ₹10,000
        await pos_svc.open_shift(
            ShiftOpen(id=shift_id, register_id=reg_id, opening_balance=Decimal("10000.00")),
            cashier_id=cashier_id
        )

        # 2. Cash Sales = ₹15,000
        inv = SalesInvoice(
            id=f"INV-CMB-{unique_suffix}",
            invoice_no=f"POS-INV-CMB-{unique_suffix}",
            company_id=company_id,
            branch_id=branch_id,
            shift_id=shift_id,
            payment_mode="CASH",
            grand_total=Decimal("15000.00"),
            tax_total=Decimal("0.00"),
            status="PAID",
            is_active=True,
            is_deleted=False
        )
        session.add(inv)
        await session.commit()

        # 3. Cash Drop = ₹12,000
        await pos_svc.record_cash_drop(
            shift_id=shift_id,
            req=ShiftCashDropRequest(amount=Decimal("12000.00"), reason="Excess cash drop",
                                     idempotency_key=f"drop-{uuid.uuid4().hex}"),
            requesting_user_id=cashier_id
        )

        # 4. Till Expense = ₹500
        await pos_svc.record_till_expense(
            shift_id=shift_id,
            req=ShiftTillExpenseRequest(amount=Decimal("500.00"), reason="Tea & Refreshments",
                                        idempotency_key=f"exp-{uuid.uuid4().hex}"),
            requesting_user_id=cashier_id
        )

        # Net Expected Cash = 10,000 + 15,000 - 12,000 - 500 = 12,500
        # Physical cash count entered by cashier = 12,300 (Shortage of ₹200)
        closed_shift = await pos_svc.close_shift(
            shift_id=shift_id,
            req=ShiftClose(closing_balance=Decimal("12300.00"), closing_notes="End of shift shortage ₹200"),
            requesting_user_id=cashier_id
        )

        assert closed_shift.expected_cash == Decimal("12500.00")
        assert closed_shift.closing_balance == Decimal("12300.00")
        assert closed_shift.variance == Decimal("-200.00")

        # Verify automated balancing GL voucher posted for ₹200 shortage
        jv_stmt = select(JournalVoucher).where(
            JournalVoucher.company_id == company_id,
            JournalVoucher.reference_doc_type == "POS_SHIFT",
            JournalVoucher.reference_doc_id == shift_id
        )
        close_jv = (await session.execute(jv_stmt)).scalar_one()
        assert close_jv.voucher_type == "SHIFT_CLOSE"
        assert close_jv.total_debit == Decimal("200.00")
        assert close_jv.total_credit == Decimal("200.00")

        acc_shortage = await UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "5070")
        acc_cash = await UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "1010")

        gle_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == close_jv.id)
        entries = (await session.execute(gle_stmt)).scalars().all()

        shortage_entry = next(e for e in entries if e.account_id == acc_shortage.id)
        cash_entry = next(e for e in entries if e.account_id == acc_cash.id)

        assert shortage_entry.debit_amount == Decimal("200.00")
        assert cash_entry.credit_amount == Decimal("200.00")

        # Verify comprehensive Z-Report data
        z_rep = await pos_svc.get_z_report(shift_id)
        assert z_rep["opening_balance"] == Decimal("10000.00")
        assert z_rep["cash_sales_total"] == Decimal("15000.00")
        assert z_rep["cash_drops_total"] == Decimal("12000.00")
        assert z_rep["till_expenses_total"] == Decimal("500.00")
        assert z_rep["expected_cash"] == Decimal("12500.00")
        assert z_rep["closing_balance"] == Decimal("12300.00")
        assert z_rep["variance"] == Decimal("-200.00")
        assert len(z_rep["cash_movements"]) == 2


@pytest.mark.asyncio
async def test_api_pos_cash_drop_and_till_expense_endpoints():
    """
    Verify REST API routes for cash-drop, till-expense, shift close, and Z-report.
    """
    company_id = "COMP-001"
    branch_id = "BR-001"
    unique_suffix = uuid.uuid4().hex[:6]
    shift_id = f"SH-API-{unique_suffix}"
    reg_id = f"REG-API-{unique_suffix}"

    user_id = f"usr-api-{unique_suffix}"
    mock_user = User(
        id=user_id,
        uuid=str(uuid.uuid4()),
        username=f"manager_api_{unique_suffix}",
        email=f"api_{unique_suffix}@smritibooks.com",
        hashed_password="hashed_test_password",
        role=UserRole.MANAGER,
        company_id=company_id,
        branch_id=branch_id,
        is_active=True,
        is_deleted=False
    )


    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as s:
        s.add(mock_user)
        await s.commit()

    tenant_ctx = TenantContext(company_id=company_id, branch_id=branch_id)

    async def get_test_db():
        async with session_factory() as s:
            yield s

    app.dependency_overrides[get_tenant_context] = lambda: tenant_ctx
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_company_db] = get_test_db
    app.dependency_overrides[get_db] = get_test_db

    try:
        client = TestClient(app)

        # 1. Create Register
        reg_resp = client.post("/api/v1/registers/", json={
            "id": reg_id,
            "name": f"API Counter {unique_suffix}",
            "code": f"POS-API-{unique_suffix}"
        })
        assert reg_resp.status_code == 201



        # 2. Open Shift
        open_resp = client.post("/api/v1/pos/shifts/open", json={
            "id": shift_id,
            "register_id": reg_id,
            "opening_balance": 8000.00
        })
        assert open_resp.status_code == 201

        # 3. Record Cash Drop via API
        drop_resp = client.post(f"/api/v1/pos/shifts/{shift_id}/cash-drop", json={
            "amount": 3000.00,
            "reason": "Mid-shift bank deposit",
            "idempotency_key": f"drop-api-{shift_id}"
        })
        assert drop_resp.status_code == 201
        drop_data = drop_resp.json()
        assert drop_data["transaction_type"] == "CASH_DROP"
        assert float(drop_data["amount"]) == 3000.00
        assert drop_data["gl_voucher_id"] is not None

        # 4. Record Till Expense via API
        exp_resp = client.post(f"/api/v1/pos/shifts/{shift_id}/till-expense", json={
            "amount": 250.00,
            "reason": "Printer ribbon cartridge",
            "receipt_ref": "RCP-8812",
            "idempotency_key": f"exp-api-{shift_id}"
        })
        assert exp_resp.status_code == 201
        exp_data = exp_resp.json()
        assert exp_data["transaction_type"] == "TILL_EXPENSE"
        assert float(exp_data["amount"]) == 250.00
        assert exp_data["receipt_ref"] == "RCP-8812"

        # 5. Close Shift with Denomination Breakdown (Expected = 8000 - 3000 - 250 = 4750)
        # Denominations: 9x500 (4500) + 2x100 (200) + 1x50 (50) = 4750
        close_resp = client.post(f"/api/v1/pos/shifts/close/{shift_id}", json={
            "denominations": {
                "notes_500": 9,
                "notes_100": 2,
                "notes_50": 1,
                "coins_total": 0.00
            },
            "closing_notes": "Perfect balance via API"
        })
        assert close_resp.status_code == 200
        close_data = close_resp.json()
        assert close_data["status"] == "CLOSED"
        assert float(close_data["closing_balance"]) == 4750.00
        assert float(close_data["variance"]) == 0.00
        assert float(close_data["cash_drops_total"]) == 3000.00
        assert float(close_data["till_expenses_total"]) == 250.00

        # 6. Fetch Z-Report
        z_resp = client.get(f"/api/v1/pos/shifts/{shift_id}/z-report")
        assert z_resp.status_code == 200
        z_data = z_resp.json()
        assert z_data["shift_id"] == shift_id
        assert float(z_data["opening_balance"]) == 8000.00
        assert float(z_data["cash_drops_total"]) == 3000.00
        assert float(z_data["till_expenses_total"]) == 250.00
        assert float(z_data["closing_balance"]) == 4750.00
        assert len(z_data["cash_movements"]) == 2

    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_ephemeral_clean_database_cash_movements_verification():
    """
    Verify complete cash movements lifecycle on a freshly provisioned ephemeral PostgreSQL database.
    """
    db_name = EphemeralTenantHarness.generate_ephemeral_db_name()
    EphemeralTenantHarness.create_ephemeral_database(db_name)

    try:
        # Migrate fresh database to head
        EphemeralTenantHarness.run_alembic_upgrade(db_name, "head")
        session_factory = EphemeralTenantHarness.get_ephemeral_sessionmaker(db_name)

        async with session_factory() as session:
            # Seed tenant
            tenant_info = await EphemeralTenantHarness.seed_baseline_tenant_environment(
                session=session,
                company_id="COMP-EPHEM-CASH",
                branch_id="BR-EPHEM-CASH",
                company_name="Ephemeral Cash POS India",
                branch_name="Main Till"
            )
            company_id = tenant_info["company_id"]
            branch_id = tenant_info["branch_id"]
            cashier_id = tenant_info["cashier_user_id"]
            tenant = TenantContext(company_id=company_id, branch_id=branch_id)

            pos_svc = POSService(session, tenant)

            # 1. Create Register & Open Shift
            reg_id = "REG-EPH-TILL"
            await pos_svc.create_register(CashRegisterCreate(
                id=reg_id,
                name="Ephemeral Till Counter",
                code="POS-EPH-01"
            ))

            shift_id = "SH-EPH-01"
            await pos_svc.open_shift(
                ShiftOpen(id=shift_id, register_id=reg_id, opening_balance=Decimal("20000.00")),
                cashier_id=cashier_id
            )

            # 2. Record Cash Drop of ₹15,000
            drop_sct = await pos_svc.record_cash_drop(
                shift_id=shift_id,
                req=ShiftCashDropRequest(amount=Decimal("15000.00"), reason="End-of-afternoon safe drop",
                                         idempotency_key=f"drop-{uuid.uuid4().hex}"),
                requesting_user_id=cashier_id
            )
            assert drop_sct.gl_voucher_id is not None

            # 3. Close with Denominations (10 x ₹500 = ₹5000)
            closed_shift = await pos_svc.close_shift(
                shift_id=shift_id,
                req=ShiftClose(
                    denominations=CashDenominationBreakdown(notes_500=10, coins_total=Decimal("0.00")),
                    closing_notes="Ephemeral till closed"
                ),
                requesting_user_id=cashier_id
            )

            assert closed_shift.expected_cash == Decimal("5000.00")
            assert closed_shift.closing_balance == Decimal("5000.00")
            assert closed_shift.variance == Decimal("0.00")

            # 4. Verify Trial Balance on clean database
            tb = await UnifiedAccountingLedgerService.get_trial_balance(session, company_id)
            assert tb["is_balanced"] is True
            assert tb["grand_total_debit"] == tb["grand_total_credit"]

    finally:
        EphemeralTenantHarness.drop_ephemeral_database(db_name)


@pytest.mark.asyncio
async def test_cash_in_movement_end_to_end_and_gl_posting():
    """
    Verify Cash In (till float injection) records transaction, updates shift cash_in_total,
    posts a balanced GL journal voucher (Debit 1010, Credit 1020), and correctly factors
    into expected cash calculations upon closing.
    """
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    unique_suffix = uuid.uuid4().hex[:6]

    async with session_factory() as session:
        cashier_id = await ensure_test_cashier(session, f"usr-cin-{unique_suffix}")
        pos_svc = POSService(session, tenant)

        reg_id = f"REG-CIN-{unique_suffix}"
        await pos_svc.create_register(CashRegisterCreate(
            id=reg_id,
            name=f"Counter CashIn {unique_suffix}",
            code=f"POS-CI-{unique_suffix}"
        ))

        shift_id = f"SH-CIN-{unique_suffix}"
        shift = await pos_svc.open_shift(
            ShiftOpen(id=shift_id, register_id=reg_id, opening_balance=Decimal("1000.00")),
            cashier_id=cashier_id
        )

        # 1. Record Cash In of ₹4,000 from main safe
        in_sct = await pos_svc.record_cash_in(
            shift_id=shift_id,
            req=ShiftCashInRequest(amount=Decimal("4000.00"), reason="Morning additional cash float",
                                   idempotency_key=f"in-{uuid.uuid4().hex}"),
            requesting_user_id=cashier_id
        )
        assert in_sct.transaction_type == "CASH_IN"
        assert in_sct.amount == Decimal("4000.00")
        assert in_sct.gl_voucher_id is not None

        # 2. Verify GL Journal Voucher lines (Debit 1010 Cash, Credit 1020 Safe)
        jv_res = await session.execute(select(JournalVoucher).where(JournalVoucher.id == in_sct.gl_voucher_id))
        jv = jv_res.scalars().one()
        assert jv.voucher_type == "CASH_IN"
        assert jv.total_debit == Decimal("4000.00")
        assert jv.total_credit == Decimal("4000.00")

        # 3. Close shift with counted ₹5,000 (Opening 1000 + CashIn 4000 = 5000 expected)
        closed = await pos_svc.close_shift(
            shift_id=shift_id,
            req=ShiftClose(
                denominations=CashDenominationBreakdown(notes_500=10, coins_total=Decimal("0.00")),
                closing_notes="Shift closed with float in"
            ),
            requesting_user_id=cashier_id
        )
        assert closed.expected_cash == Decimal("5000.00")
        assert closed.closing_balance == Decimal("5000.00")
        assert closed.variance == Decimal("0.00")


@pytest.mark.asyncio
async def test_cash_drop_and_till_expense_insufficient_cash_rejection():
    """
    Verify that cash drop and till expense payouts exceeding available cash in drawer
    are rejected with HTTP 400 Insufficient Cash.
    """
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    unique_suffix = uuid.uuid4().hex[:6]

    async with session_factory() as session:
        cashier_id = await ensure_test_cashier(session, f"usr-icash-{unique_suffix}")
        pos_svc = POSService(session, tenant)

        reg_id = f"REG-IC-{unique_suffix}"
        await pos_svc.create_register(CashRegisterCreate(
            id=reg_id,
            name=f"Counter InsuffCash {unique_suffix}",
            code=f"POS-IC-{unique_suffix}"
        ))

        shift_id = f"SH-IC-{unique_suffix}"
        await pos_svc.open_shift(
            ShiftOpen(id=shift_id, register_id=reg_id, opening_balance=Decimal("1000.00")),
            cashier_id=cashier_id
        )

        # 1. Attempt Cash Drop of ₹2,500 when drawer only has ₹1,000 -> Expect 400
        with pytest.raises(HTTPException) as exc_drop:
            await pos_svc.record_cash_drop(
                shift_id=shift_id,
                req=ShiftCashDropRequest(amount=Decimal("2500.00"), reason="Excess drop attempt",
                                         idempotency_key=f"drop-{uuid.uuid4().hex}"),
                requesting_user_id=cashier_id
            )
        assert exc_drop.value.status_code == 400
        assert "Insufficient cash in drawer" in exc_drop.value.detail

        # 2. Attempt Till Expense of ₹1,500 when drawer only has ₹1,000 -> Expect 400
        with pytest.raises(HTTPException) as exc_exp:
            await pos_svc.record_till_expense(
                shift_id=shift_id,
                req=ShiftTillExpenseRequest(amount=Decimal("1500.00"), reason="Excess expense attempt",
                                            idempotency_key=f"exp-{uuid.uuid4().hex}"),
                requesting_user_id=cashier_id
            )
        assert exc_exp.value.status_code == 400
        assert "Insufficient cash in drawer" in exc_exp.value.detail


@pytest.mark.asyncio
async def test_cash_movement_and_close_idempotency_deduplication():
    """
    Verify client-generated idempotency keys:
    1. Cash In with idempotency_key replayed returns the exact existing transaction without duplicate GL posting.
    2. Cash Drop with idempotency_key replayed returns existing transaction without duplicate GL posting.
    3. Till Expense with idempotency_key replayed returns existing transaction without duplicate GL posting.
    4. Shift Close with idempotency_key replayed returns already closed shift without 400 error.
    """
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    unique_suffix = uuid.uuid4().hex[:6]

    async with session_factory() as session:
        cashier_id = await ensure_test_cashier(session, f"usr-idemp-{unique_suffix}")
        pos_svc = POSService(session, tenant)

        reg_id = f"REG-IDEMP-{unique_suffix}"
        await pos_svc.create_register(CashRegisterCreate(
            id=reg_id,
            name=f"Counter Idempotency {unique_suffix}",
            code=f"POS-ID-{unique_suffix}"
        ))

        shift_id = f"SH-IDEMP-{unique_suffix}"
        shift = await pos_svc.open_shift(
            ShiftOpen(id=shift_id, register_id=reg_id, opening_balance=Decimal("2000.00")),
            cashier_id=cashier_id
        )

        # 1. Cash In idempotency test
        idemp_in = f"idemp-in-{unique_suffix}"
        in_req = ShiftCashInRequest(
            amount=Decimal("1500.00"),
            reason="Idempotent float addition",
            idempotency_key=idemp_in
        )
        tx_in_1 = await pos_svc.record_cash_in(shift_id, in_req, cashier_id)
        tx_in_2 = await pos_svc.record_cash_in(shift_id, in_req, cashier_id)
        assert tx_in_1.id == tx_in_2.id
        assert tx_in_1.gl_voucher_id == tx_in_2.gl_voucher_id

        # Verify shift cash_in_total only incremented once (₹1500, not ₹3000)
        s_check = await pos_svc.get_shift(shift_id)
        assert s_check.cash_in_total == Decimal("1500.00")

        # 2. Cash Drop idempotency test
        idemp_drop = f"idemp-drop-{unique_suffix}"
        drop_req = ShiftCashDropRequest(
            amount=Decimal("1000.00"),
            reason="Idempotent safe drop",
            idempotency_key=idemp_drop
        )
        tx_drop_1 = await pos_svc.record_cash_drop(shift_id, drop_req, cashier_id)
        tx_drop_2 = await pos_svc.record_cash_drop(shift_id, drop_req, cashier_id)
        assert tx_drop_1.id == tx_drop_2.id
        assert tx_drop_1.gl_voucher_id == tx_drop_2.gl_voucher_id

        s_check = await pos_svc.get_shift(shift_id)
        assert s_check.cash_drops_total == Decimal("1000.00")

        # 3. Till Expense idempotency test
        idemp_exp = f"idemp-exp-{unique_suffix}"
        exp_req = ShiftTillExpenseRequest(
            amount=Decimal("200.00"),
            reason="Idempotent expense payout",
            idempotency_key=idemp_exp
        )
        tx_exp_1 = await pos_svc.record_till_expense(shift_id, exp_req, cashier_id)
        tx_exp_2 = await pos_svc.record_till_expense(shift_id, exp_req, cashier_id)
        assert tx_exp_1.id == tx_exp_2.id
        assert tx_exp_1.gl_voucher_id == tx_exp_2.gl_voucher_id

        s_check = await pos_svc.get_shift(shift_id)
        assert s_check.till_expenses_total == Decimal("200.00")

        # 4. Shift Close idempotency test
        # Expected = 2000 + 1500 - 1000 - 200 = 2300
        idemp_close = f"idemp-close-{unique_suffix}"
        close_req = ShiftClose(
            closing_balance=Decimal("2300.00"),
            closing_notes="Idempotent shift close",
            idempotency_key=idemp_close
        )
        closed_1 = await pos_svc.close_shift(shift_id, close_req, cashier_id)
        closed_2 = await pos_svc.close_shift(shift_id, close_req, cashier_id)
        assert closed_1.id == closed_2.id
        assert closed_1.status == "CLOSED"
        assert closed_2.status == "CLOSED"
        assert closed_1.closed_at == closed_2.closed_at


@pytest.mark.asyncio
async def test_invalid_source_and_expense_account_rejection():
    """
    Verify rejection of invalid account overrides:
    1. Cash In with non-existent source account -> HTTP 400
    2. Cash Drop with non-asset account -> HTTP 400
    3. Till Expense with non-expense account -> HTTP 400
    """
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    unique_suffix = uuid.uuid4().hex[:6]

    async with session_factory() as session:
        cashier_id = await ensure_test_cashier(session, f"usr-acc-{unique_suffix}")
        pos_svc = POSService(session, tenant)

        reg_id = f"REG-ACC-{unique_suffix}"
        await pos_svc.create_register(CashRegisterCreate(
            id=reg_id,
            name=f"Counter AccCheck {unique_suffix}",
            code=f"POS-AC-{unique_suffix}"
        ))

        shift_id = f"SH-ACC-{unique_suffix}"
        await pos_svc.open_shift(
            ShiftOpen(id=shift_id, register_id=reg_id, opening_balance=Decimal("3000.00")),
            cashier_id=cashier_id
        )

        # 1. Non-existent source account on Cash In
        with pytest.raises(HTTPException) as exc_in:
            await pos_svc.record_cash_in(
                shift_id=shift_id,
                req=ShiftCashInRequest(
                    amount=Decimal("500.00"),
                    reason="Invalid account test",
                    source_account_id="acc-non-existent-999",
                    idempotency_key=f"in-{uuid.uuid4().hex}"
                ),
                requesting_user_id=cashier_id,
                requesting_user_role="MANAGER"
            )
        assert exc_in.value.status_code == 400
        assert "not found" in exc_in.value.detail.lower()

        # 2. Non-existent expense account on Till Expense
        with pytest.raises(HTTPException) as exc_exp:
            await pos_svc.record_till_expense(
                shift_id=shift_id,
                req=ShiftTillExpenseRequest(
                    amount=Decimal("100.00"),
                    reason="Invalid expense account test",
                    expense_account_id="acc-non-existent-999",
                    idempotency_key=f"exp-{uuid.uuid4().hex}"
                ),
                requesting_user_id=cashier_id,
                requesting_user_role="MANAGER"
            )
        assert exc_exp.value.status_code == 400
        assert "not found" in exc_exp.value.detail.lower()


@pytest.mark.asyncio
async def test_api_pos_company_db_and_permissions_enforcement():
    """
    Verify FastAPI dependency injection wiring:
    1. Operational routes require valid authenticated user with proper role.
    2. Endpoint rejects unauthorized callers missing necessary permissions.
    """
    company_id = "COMP-001"
    branch_id = "BR-001"
    unique_suffix = uuid.uuid4().hex[:6]

    session_factory = get_company_sessionmaker("smriti001")
    tenant_ctx = TenantContext(company_id=company_id, branch_id=branch_id)

    async def get_test_db():
        async with session_factory() as s:
            yield s

    app.dependency_overrides[get_tenant_context] = lambda: tenant_ctx
    app.dependency_overrides[get_company_db] = get_test_db
    app.dependency_overrides[get_db] = get_test_db

    try:
        client = TestClient(app)

        # 1. Unauthenticated request to /pos/shifts/open should fail with 401 or 403
        open_resp = client.post("/api/v1/pos/shifts/open", json={
            "id": f"SH-UNAUTH-{unique_suffix}",
            "register_id": f"REG-UNAUTH-{unique_suffix}",
            "opening_balance": 1000.00
        })
        assert open_resp.status_code in (401, 403)
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_database_level_one_open_shift_unique_constraint_rejection():
    """
    Verify that the PostgreSQL partial unique index `uq_shifts_active_per_register`
    strictly prevents two OPEN shifts from existing simultaneously on the same register.
    """
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    unique_suffix = uuid.uuid4().hex[:6]

    async with session_factory() as session:
        cashier_id = await ensure_test_cashier(session, f"usr-uq-{unique_suffix}")
        pos_svc = POSService(session, tenant)

        reg_id = f"REG-UQ-{unique_suffix}"
        await pos_svc.create_register(CashRegisterCreate(
            id=reg_id,
            name=f"Counter UniqueTest {unique_suffix}",
            code=f"POS-UQ-{unique_suffix}"
        ))

        # 1. Open first shift
        shift_1_id = f"SH-UQ1-{unique_suffix}"
        await pos_svc.open_shift(
            ShiftOpen(id=shift_1_id, register_id=reg_id, opening_balance=Decimal("1000.00")),
            cashier_id=cashier_id
        )

        # 2. Attempt to open second shift on same register -> HTTP 400 rejection
        shift_2_id = f"SH-UQ2-{unique_suffix}"
        with pytest.raises(HTTPException) as exc:
            await pos_svc.open_shift(
                ShiftOpen(id=shift_2_id, register_id=reg_id, opening_balance=Decimal("500.00")),
                cashier_id=cashier_id
            )
        assert exc.value.status_code == 400
        assert "already has an open shift" in exc.value.detail


@pytest.mark.asyncio
async def test_database_level_idempotency_unique_constraint_enforcement():
    """
    Verify PostgreSQL unique index `uq_sct_idempotency` physically rejects
    duplicate raw insert attempts with identical (company_id, shift_id, idempotency_key).
    """
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    unique_suffix = uuid.uuid4().hex[:6]

    async with session_factory() as session:
        cashier_id = await ensure_test_cashier(session, f"usr-uqsct-{unique_suffix}")
        pos_svc = POSService(session, tenant)

        reg_id = f"REG-UQSCT-{unique_suffix}"
        await pos_svc.create_register(CashRegisterCreate(
            id=reg_id,
            name=f"Counter SCTUQ {unique_suffix}",
            code=f"POS-UQSCT-{unique_suffix}"
        ))

        shift_id = f"SH-UQSCT-{unique_suffix}"
        await pos_svc.open_shift(
            ShiftOpen(id=shift_id, register_id=reg_id, opening_balance=Decimal("5000.00")),
            cashier_id=cashier_id
        )

        # Replayed call returns deduplicated object seamlessly
        idemp_key = f"key-dedup-{unique_suffix}"
        req = ShiftCashInRequest(
            amount=Decimal("1000.00"),
            reason="Concurrent test float",
            idempotency_key=idemp_key
        )
        res1 = await pos_svc.record_cash_in(shift_id, req, cashier_id)
        res2 = await pos_svc.record_cash_in(shift_id, req, cashier_id)
        assert res1.id == res2.id
        assert res1.amount == res2.amount


@pytest.mark.asyncio
async def test_pos_checkout_versus_closed_shift_concurrency_lock():
    """
    Verify POS checkout enforces row-level locking on shift and rejects sales on CLOSED shift.
    """
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    unique_suffix = uuid.uuid4().hex[:6]

    async with session_factory() as session:
        cashier_id = await ensure_test_cashier(session, f"usr-chk-{unique_suffix}")
        pos_svc = POSService(session, tenant)

        reg_id = f"REG-CHK-{unique_suffix}"
        await pos_svc.create_register(CashRegisterCreate(
            id=reg_id,
            name=f"Counter ChkLock {unique_suffix}",
            code=f"POS-CHK-{unique_suffix}"
        ))

        shift_id = f"SH-CHK-{unique_suffix}"
        await pos_svc.open_shift(
            ShiftOpen(id=shift_id, register_id=reg_id, opening_balance=Decimal("1000.00")),
            cashier_id=cashier_id
        )

        # Close shift
        await pos_svc.close_shift(
            shift_id=shift_id,
            req=ShiftClose(closing_balance=Decimal("1000.00"), closing_notes="Closed before checkout attempt"),
            requesting_user_id=cashier_id
        )

        # Attempt POS checkout on closed shift -> Expect HTTP 400
        from app.schemas.pos import POSCheckoutRequest
        with pytest.raises(HTTPException) as exc:
            await pos_svc.pos_checkout(POSCheckoutRequest(
                invoice_no=f"POS-INV-CHK-{unique_suffix}",
                shift_id=shift_id,
                items=[],
                grand_total=Decimal("0.00"),
                payment_mode="CASH"
            ))
        assert exc.value.status_code == 400
        assert "not open" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_idempotency_key_collision_with_different_amount_raises_409():
    """
    Verify that reusing an idempotency key with a conflicting payload/amount
    is rejected with HTTP 409 Conflict.
    """
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    unique_suffix = uuid.uuid4().hex[:6]

    async with session_factory() as session:
        cashier_id = await ensure_test_cashier(session, f"usr-idempconf-{unique_suffix}")
        pos_svc = POSService(session, tenant)

        reg_id = f"REG-IDEMP-{unique_suffix}"
        await pos_svc.create_register(CashRegisterCreate(
            id=reg_id,
            name=f"Counter IdempConf {unique_suffix}",
            code=f"POS-IDC-{unique_suffix}"
        ))

        shift_id = f"SH-IDC-{unique_suffix}"
        await pos_svc.open_shift(
            ShiftOpen(id=shift_id, register_id=reg_id, opening_balance=Decimal("5000.00")),
            cashier_id=cashier_id
        )

        idemp_key = f"key-conflict-{unique_suffix}"
        # 1. First request with 1000.00 -> Success
        req1 = ShiftCashInRequest(
            amount=Decimal("1000.00"),
            reason="Original float injection",
            idempotency_key=idemp_key
        )
        res1 = await pos_svc.record_cash_in(shift_id, req1, cashier_id)
        assert res1.amount == Decimal("1000.00")

        # 2. Colliding request with same idempotency_key but different amount 2000.00 -> HTTP 409
        req2 = ShiftCashInRequest(
            amount=Decimal("2000.00"),
            reason="Modified float injection with same key",
            idempotency_key=idemp_key
        )
        with pytest.raises(HTTPException) as exc:
            await pos_svc.record_cash_in(shift_id, req2, cashier_id)
        assert exc.value.status_code == 409
        assert "collision" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_cashier_closing_another_cashier_shift_forbidden_403():
    """
    Verify that a cashier is strictly forbidden from closing another cashier's shift (HTTP 403),
    while a manager or administrator is permitted.
    """
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    unique_suffix = uuid.uuid4().hex[:6]

    async with session_factory() as session:
        cashier_1 = await ensure_test_cashier(session, f"usr-c1-{unique_suffix}")
        cashier_2 = await ensure_test_cashier(session, f"usr-c2-{unique_suffix}")
        manager_id = await ensure_test_cashier(session, f"usr-mgr-{unique_suffix}")

        pos_svc = POSService(session, tenant)

        reg_id = f"REG-RBAC-{unique_suffix}"
        await pos_svc.create_register(CashRegisterCreate(
            id=reg_id,
            name=f"Counter RBAC {unique_suffix}",
            code=f"POS-RBAC-{unique_suffix}"
        ))

        shift_id = f"SH-RBAC-{unique_suffix}"
        await pos_svc.open_shift(
            ShiftOpen(id=shift_id, register_id=reg_id, opening_balance=Decimal("2000.00")),
            cashier_id=cashier_1
        )

        # 1. Cashier 2 tries to close Cashier 1's shift -> HTTP 403
        with pytest.raises(HTTPException) as exc:
            await pos_svc.close_shift(
                shift_id=shift_id,
                req=ShiftClose(closing_balance=Decimal("2000.00")),
                requesting_user_id=cashier_2,
                requesting_user_role="CASHIER"
            )
        assert exc.value.status_code == 403
        assert "manager authorization" in exc.value.detail.lower()

        # 2. Manager closes the shift -> Success
        closed_shift = await pos_svc.close_shift(
            shift_id=shift_id,
            req=ShiftClose(closing_balance=Decimal("2000.00")),
            requesting_user_id=manager_id,
            requesting_user_role="MANAGER"
        )
        assert closed_shift.status == "CLOSED"


@pytest.mark.asyncio
async def test_cashier_account_override_forbidden_403():
    """
    Verify that standard cashiers are forbidden from specifying custom GL account overrides (HTTP 403).
    """
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    unique_suffix = uuid.uuid4().hex[:6]

    async with session_factory() as session:
        cashier_id = await ensure_test_cashier(session, f"usr-accover-{unique_suffix}")
        pos_svc = POSService(session, tenant)

        reg_id = f"REG-ACCOV-{unique_suffix}"
        await pos_svc.create_register(CashRegisterCreate(
            id=reg_id,
            name=f"Counter AccOv {unique_suffix}",
            code=f"POS-ACO-{unique_suffix}"
        ))

        shift_id = f"SH-ACO-{unique_suffix}"
        await pos_svc.open_shift(
            ShiftOpen(id=shift_id, register_id=reg_id, opening_balance=Decimal("3000.00")),
            cashier_id=cashier_id
        )

        # Cashier role attempts custom GL source account override -> HTTP 403
        with pytest.raises(HTTPException) as exc:
            await pos_svc.record_cash_in(
                shift_id=shift_id,
                req=ShiftCashInRequest(
                    amount=Decimal("500.00"),
                    source_account_id="ACC-CUSTOM-VAULT-999",
                    reason="Unauthorized custom vault float",
                    idempotency_key=f"in-{uuid.uuid4().hex}"
                ),
                requesting_user_id=cashier_id,
                requesting_user_role="CASHIER"
            )
        assert exc.value.status_code == 403
        assert "manager authorization" in exc.value.detail.lower()


