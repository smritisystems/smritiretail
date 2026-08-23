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
from app.api.deps import TenantContext, get_db, get_tenant_context, get_current_user
from app.models.auth import User, UserRole
from app.models.pos import CashRegister, Shift, ShiftCashTransaction
from app.models.sales import SalesInvoice
from app.models.accounting import JournalVoucher, GeneralLedgerEntry, Account
from app.services.pos import POSService
from app.services.unified_accounting_ledger_service import UnifiedAccountingLedgerService
from app.schemas.pos import (
    ShiftOpen, ShiftClose, CashRegisterCreate,
    CashDenominationBreakdown, ShiftCashDropRequest, ShiftTillExpenseRequest
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
            reason="Mid-day vault transfer for security"
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
            receipt_ref="RCP-EXP-9001"
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
            req=ShiftCashDropRequest(amount=Decimal("12000.00"), reason="Excess cash drop"),
            requesting_user_id=cashier_id
        )

        # 4. Till Expense = ₹500
        await pos_svc.record_till_expense(
            shift_id=shift_id,
            req=ShiftTillExpenseRequest(amount=Decimal("500.00"), reason="Tea & Refreshments"),
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
            "reason": "Mid-shift bank deposit"
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
            "receipt_ref": "RCP-8812"
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
                req=ShiftCashDropRequest(amount=Decimal("15000.00"), reason="End-of-afternoon safe drop"),
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
