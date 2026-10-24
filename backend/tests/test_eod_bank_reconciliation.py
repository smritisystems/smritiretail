"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-09-09
Modified     : 2026-09-09
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import pytest
from decimal import Decimal
from datetime import datetime, timezone, date, timedelta
from sqlalchemy import select
import httpx

from app.main import app
from app.core.security import create_access_token
from app.db.session import get_company_sessionmaker
from app.models.tenant import Company, Branch
from app.models.auth import User, UserRole
from app.models.pos import CashRegister, Shift
from app.models.outbox import IntegrationOutboxEvent
from app.models.accounting import (
    Account,
    JournalVoucher,
    GeneralLedgerEntry,
    BankStatement,
    BankStatementLine,
)
from app.services.unified_ledger import UnifiedAccountingLedgerService
from app.services.pos import POSService
from app.schemas.pos import ShiftClose
from app.api.deps import TenantContext, get_current_user, get_tenant_context


@pytest.fixture(scope="module", autouse=True)
async def setup_eod_test_data():
    """Ensure Company COMP-001, Branch MAIN, and cashier user exist in smriti001."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # 1. Company
        comp = (await session.execute(select(Company).where(Company.id == "COMP-001"))).scalar_one_or_none()
        if not comp:
            comp = Company(id="COMP-001", name="SMRITI Test Co", company_code="001", gst_number="27AAACA0001A1Z5")
            session.add(comp)

        # 2. Branch
        branch = (await session.execute(select(Branch).where(Branch.id == "MAIN"))).scalar_one_or_none()
        if not branch:
            branch = Branch(id="MAIN", company_id="COMP-001", name="Main Branch", code="MAIN")
            session.add(branch)

        # 3. Cashier User
        cashier = (await session.execute(select(User).where(User.id == "usr-eod-cashier"))).scalar_one_or_none()
        if not cashier:
            cashier = User(
                id="usr-eod-cashier",
                company_id="COMP-001",
                branch_id="MAIN",
                username="cashier_eod",
                email="cashier_eod@smritibooks.com",
                hashed_password="mock_hashed_password",
                role=UserRole.CASHIER,
                is_active=True,
                is_deleted=False,
                status="Active"
            )
            session.add(cashier)

        # 4. Cash Register
        reg = (await session.execute(select(CashRegister).where(CashRegister.id == "REG-EOD-01"))).scalar_one_or_none()
        if not reg:
            reg = CashRegister(
                id="REG-EOD-01",
                company_id="COMP-001",
                branch_id="MAIN",
                name="EOD Terminal 1",
                code="REG-EOD-01",
                cashier="cashier_eod",
                warehouse="WH-MAIN",
                is_locked=False,
                is_active=True,
                is_deleted=False
            )
            session.add(reg)

        # 5. Chart of Accounts
        await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(session, "COMP-001", "MAIN")
        await session.commit()


@pytest.mark.asyncio
async def test_shift_close_shortage_gl_posting():
    """
    Verifies that closing a shift with a cash shortage (variance < 0) correctly posts:
      Debit: Cash Register Shortage (5070)
      Credit: Cash in Hand (1010)
    And validates strict idempotency on re-execution.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        suffix = uuid.uuid4().hex[:6]
        shift = Shift(
            id=f"shift_short_{suffix}",
            company_id="COMP-001",
            branch_id="MAIN",
            register_id="REG-EOD-01",
            cashier_id="usr-eod-cashier",
            status="CLOSED",
            opening_balance=Decimal("1000.00"),
            expected_cash=Decimal("5000.00"),
            closing_balance=Decimal("4850.00"),
            variance=Decimal("-150.00"),
            opened_at=datetime.now(timezone.utc) - timedelta(hours=8),
            closed_at=datetime.now(timezone.utc),
            is_deleted=False
        )
        session.add(shift)
        await session.commit()

        # Post to GL
        voucher = await UnifiedAccountingLedgerService.post_shift_close_to_gl(
            session=session,
            company_id="COMP-001",
            shift_id=shift.id,
            branch_id="MAIN",
            created_by="usr-eod-cashier"
        )
        await session.commit()

        assert voucher is not None
        assert voucher.voucher_type == "SHIFT_CLOSE"
        assert voucher.total_debit == Decimal("150.00")
        assert voucher.total_credit == Decimal("150.00")
        assert voucher.reference_doc_type == "POS_SHIFT"
        assert voucher.reference_doc_id == shift.id

        # Verify GL line entries
        gl_entries = (await session.execute(
            select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == voucher.id)
        )).scalars().all()
        assert len(gl_entries) == 2

        acc_shortage = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "5070")
        acc_cash = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "1010")

        shortage_entry = next((e for e in gl_entries if e.account_id == acc_shortage.id), None)
        cash_entry = next((e for e in gl_entries if e.account_id == acc_cash.id), None)

        assert shortage_entry is not None
        assert shortage_entry.debit_amount == Decimal("150.00")
        assert shortage_entry.credit_amount == Decimal("0.00")

        assert cash_entry is not None
        assert cash_entry.debit_amount == Decimal("0.00")
        assert cash_entry.credit_amount == Decimal("150.00")

        # Idempotency check: re-invoking must return same voucher without new rows
        v_again = await UnifiedAccountingLedgerService.post_shift_close_to_gl(
            session=session,
            company_id="COMP-001",
            shift_id=shift.id,
            branch_id="MAIN"
        )
        assert v_again.id == voucher.id


@pytest.mark.asyncio
async def test_shift_close_overage_gl_posting():
    """
    Verifies that closing a shift with a cash overage (variance > 0) correctly posts:
      Debit: Cash in Hand (1010)
      Credit: Cash Register Overage (4050)
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        suffix = uuid.uuid4().hex[:6]
        shift = Shift(
            id=f"shift_over_{suffix}",
            company_id="COMP-001",
            branch_id="MAIN",
            register_id="REG-EOD-01",
            cashier_id="usr-eod-cashier",
            status="CLOSED",
            opening_balance=Decimal("1000.00"),
            expected_cash=Decimal("5000.00"),
            closing_balance=Decimal("5250.00"),
            variance=Decimal("250.00"),
            opened_at=datetime.now(timezone.utc) - timedelta(hours=8),
            closed_at=datetime.now(timezone.utc),
            is_deleted=False
        )
        session.add(shift)
        await session.commit()

        voucher = await UnifiedAccountingLedgerService.post_shift_close_to_gl(
            session=session,
            company_id="COMP-001",
            shift_id=shift.id,
            branch_id="MAIN"
        )
        await session.commit()

        assert voucher is not None
        assert voucher.voucher_type == "SHIFT_CLOSE"
        assert voucher.total_debit == Decimal("250.00")
        assert voucher.total_credit == Decimal("250.00")

        gl_entries = (await session.execute(
            select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == voucher.id)
        )).scalars().all()
        assert len(gl_entries) == 2

        acc_cash = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "1010")
        acc_overage = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "4050")

        cash_entry = next((e for e in gl_entries if e.account_id == acc_cash.id), None)
        overage_entry = next((e for e in gl_entries if e.account_id == acc_overage.id), None)

        assert cash_entry.debit_amount == Decimal("250.00")
        assert overage_entry.credit_amount == Decimal("250.00")


@pytest.mark.asyncio
async def test_shift_close_zero_variance_gl_posting():
    """Verifies that a zero variance shift close returns None without creating redundant vouchers."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        suffix = uuid.uuid4().hex[:6]
        shift = Shift(
            id=f"shift_zero_{suffix}",
            company_id="COMP-001",
            branch_id="MAIN",
            register_id="REG-EOD-01",
            cashier_id="usr-eod-cashier",
            status="CLOSED",
            opening_balance=Decimal("1000.00"),
            expected_cash=Decimal("5000.00"),
            closing_balance=Decimal("5000.00"),
            variance=Decimal("0.00"),
            opened_at=datetime.now(timezone.utc) - timedelta(hours=8),
            closed_at=datetime.now(timezone.utc),
            is_deleted=False
        )
        session.add(shift)
        await session.commit()

        voucher = await UnifiedAccountingLedgerService.post_shift_close_to_gl(
            session=session,
            company_id="COMP-001",
            shift_id=shift.id,
            branch_id="MAIN"
        )
        assert voucher is None


@pytest.mark.asyncio
async def test_pos_service_close_shift_stages_outbox_event():
    """
    Verifies that POSService.close_shift atomically:
      1. Closes the shift and computes variance
      2. Invokes post_shift_close_to_gl
      3. Stages a SHIFT_CLOSED outbox event on target_channel='POS_STREAM'
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        suffix = uuid.uuid4().hex[:6]
        shift = Shift(
            id=f"shift_pos_svc_{suffix}",
            company_id="COMP-001",
            branch_id="MAIN",
            register_id="REG-EOD-01",
            cashier_id="usr-eod-cashier",
            status="OPEN",
            opening_balance=Decimal("2000.00"),
            expected_cash=Decimal("2000.00"),
            opened_at=datetime.now(timezone.utc) - timedelta(hours=4),
            is_deleted=False
        )
        session.add(shift)
        await session.commit()

        tenant = TenantContext(company_id="COMP-001", branch_id="MAIN")
        pos_svc = POSService(db=session, tenant=tenant)

        close_req = ShiftClose(
            closing_balance=Decimal("1900.00"),
            closing_notes="Slight shortage at shift changeover"
        )
        closed_shift = await pos_svc.close_shift(
            shift_id=shift.id,
            req=close_req,
            requesting_user_id="usr-eod-cashier"
        )

        assert closed_shift.status == "CLOSED"
        assert closed_shift.variance == Decimal("-100.00")

        # Verify outbox event was recorded
        obx_stmt = select(IntegrationOutboxEvent).where(
            IntegrationOutboxEvent.company_id == "COMP-001",
            IntegrationOutboxEvent.aggregate_type == "SHIFT",
            IntegrationOutboxEvent.aggregate_id == shift.id,
            IntegrationOutboxEvent.event_type == "SHIFT_CLOSED"
        )
        obx_event = (await session.execute(obx_stmt)).scalars().first()
        assert obx_event is not None
        assert obx_event.target_channel == "POS_STREAM"
        assert obx_event.payload_json["variance"] == -100.00
        assert obx_event.status == "PENDING"


@pytest.mark.asyncio
async def test_z_report_rollup_accuracy():
    """
    Verifies that POSService.get_z_report accurately compiles shift sales, cash drawer
    reconciliation metrics, tender variance, and the linked GL balancing voucher.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        suffix = uuid.uuid4().hex[:6]
        shift = Shift(
            id=f"shift_zrep_{suffix}",
            company_id="COMP-001",
            branch_id="MAIN",
            register_id="REG-EOD-01",
            cashier_id="usr-eod-cashier",
            status="OPEN",
            opening_balance=Decimal("1500.00"),
            expected_cash=Decimal("1500.00"),
            opened_at=datetime.now(timezone.utc) - timedelta(hours=6),
            is_deleted=False
        )
        session.add(shift)
        await session.commit()

        tenant = TenantContext(company_id="COMP-001", branch_id="MAIN")
        pos_svc = POSService(db=session, tenant=tenant)

        # Close shift with variance: expected = 1500, counted = 1350 -> variance = -150
        await pos_svc.close_shift(
            shift_id=shift.id,
            req=ShiftClose(closing_balance=Decimal("1350.00"), closing_notes="EOD Z-Report Test"),
            requesting_user_id="usr-eod-cashier"
        )

        zrep = await pos_svc.get_z_report(shift.id)
        assert zrep["shift_id"] == shift.id
        assert zrep["status"] == "CLOSED"
        assert zrep["expected_cash"] == Decimal("1500.00")
        assert zrep["closing_balance"] == Decimal("1350.00")
        assert zrep["variance"] == Decimal("-150.00")
        assert zrep["gl_voucher_id"] is not None
        assert zrep["gl_voucher_no"] is not None



@pytest.mark.asyncio
async def test_bank_deposit_gl_posting_and_idempotency():
    """
    Verifies post_bank_deposit_to_gl:
      Debit: Bank Accounts (1020)
      Credit: Cash in Hand (1010)
      Balanced lines and strict idempotency.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        suffix = uuid.uuid4().hex[:6]
        deposit_ref = f"DEP-SLIP-{suffix.upper()}"
        amount = Decimal("35000.00")

        voucher = await UnifiedAccountingLedgerService.post_bank_deposit_to_gl(
            session=session,
            company_id="COMP-001",
            amount=amount,
            bank_account_code="1020",
            cash_account_code="1010",
            deposit_date=date.today(),
            reference_no=deposit_ref,
            reference_doc_id=deposit_ref,
            branch_id="MAIN",
            narration=f"Daily cash drawer drop to HDFC bank slip {deposit_ref}",
            created_by="usr-eod-cashier"
        )
        await session.commit()

        assert voucher is not None
        assert voucher.voucher_type == "BANK_DEPOSIT"
        assert voucher.total_debit == amount
        assert voucher.total_credit == amount
        assert voucher.reference_doc_no == deposit_ref

        # Check GL lines
        gl_entries = (await session.execute(
            select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == voucher.id)
        )).scalars().all()
        assert len(gl_entries) == 2

        acc_bank = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "1020")
        acc_cash = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "1010")

        bank_entry = next((e for e in gl_entries if e.account_id == acc_bank.id), None)
        cash_entry = next((e for e in gl_entries if e.account_id == acc_cash.id), None)

        assert bank_entry is not None
        assert bank_entry.debit_amount == amount
        assert bank_entry.credit_amount == Decimal("0.00")

        assert cash_entry is not None
        assert cash_entry.debit_amount == Decimal("0.00")
        assert cash_entry.credit_amount == amount

        # Idempotency check: duplicate call with same reference returns same voucher
        voucher_dup = await UnifiedAccountingLedgerService.post_bank_deposit_to_gl(
            session=session,
            company_id="COMP-001",
            amount=amount,
            reference_no=deposit_ref,
            reference_doc_id=deposit_ref
        )
        assert voucher_dup.id == voucher.id


@pytest.mark.asyncio
async def test_bank_statement_two_way_auto_reconciliation():
    """
    Verifies that auto_reconcile_bank_statement matches a BankStatementLine
    deposit amount with the corresponding GeneralLedgerEntry debit on the bank account.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        suffix = uuid.uuid4().hex[:6]
        deposit_ref = f"DEP-RECON-{suffix.upper()}"
        unique_int = int(suffix, 16) % 50000 + 10000
        amount = Decimal(f"{unique_int}.39")

        # 1. Post GL deposit entry
        voucher = await UnifiedAccountingLedgerService.post_bank_deposit_to_gl(
            session=session,
            company_id="COMP-001",
            amount=amount,
            bank_account_code="1020",
            deposit_date=date.today(),
            reference_no=deposit_ref,
            reference_doc_id=deposit_ref,
            branch_id="MAIN"
        )
        await session.commit()

        acc_bank = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "1020")

        # 2. Create BankStatement with deposit line
        stmt_id = f"stmt_{suffix}"
        line_id = f"line_{suffix}"
        closing_bal = Decimal("100000.00") + amount
        statement = BankStatement(
            id=stmt_id,
            company_id="COMP-001",
            branch_id="MAIN",
            bank_account_id=acc_bank.id,
            statement_no=f"STMT-{suffix.upper()}",
            statement_date=date.today(),
            from_date=date.today() - timedelta(days=7),
            to_date=date.today(),
            opening_balance=Decimal("100000.00"),
            closing_balance=closing_bal,
            is_reconciled=False
        )
        session.add(statement)

        line = BankStatementLine(
            id=line_id,
            company_id="COMP-001",
            branch_id="MAIN",
            statement_id=stmt_id,
            line_number=1,
            transaction_date=date.today(),
            value_date=date.today(),
            reference_no=deposit_ref,
            description="Branch Cash Deposit Machine Drop",
            deposit_amount=amount,
            withdrawal_amount=Decimal("0.00"),
            balance_after_transaction=closing_bal,
            reconciliation_status="UNMATCHED"
        )
        session.add(line)
        await session.commit()

        # 3. Execute auto-reconciliation
        recon_result = await UnifiedAccountingLedgerService.auto_reconcile_bank_statement(
            session=session,
            company_id="COMP-001",
            statement_id=stmt_id
        )
        await session.commit()

        assert recon_result["statement_id"] == stmt_id
        assert recon_result["matched_lines"] == 1
        assert recon_result["unmatched_lines"] == 0
        assert recon_result["is_fully_reconciled"] is True

        # Verify BankStatementLine updated
        updated_line = (await session.execute(
            select(BankStatementLine).where(BankStatementLine.id == line_id)
        )).scalar_one()
        assert updated_line.reconciliation_status == "AUTO_RECONCILED"
        assert updated_line.reconciled_gl_entry_id is not None
        assert updated_line.cleared_at is not None

        # Verify reconciled GL entry
        gle = (await session.execute(
            select(GeneralLedgerEntry).where(GeneralLedgerEntry.id == updated_line.reconciled_gl_entry_id)
        )).scalar_one()
        assert gle.voucher_id == voucher.id
        assert gle.account_id == acc_bank.id
        assert gle.debit_amount == amount


@pytest.mark.asyncio
async def test_bank_deposit_outbox_worker_dispatch():
    """
    Verifies that dispatch_outbox_event correctly processes BANK_DEPOSIT_POSTED
    outbox events and translates them into balanced GL vouchers.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        suffix = uuid.uuid4().hex[:6]
        dep_id = f"dep_obx_{suffix}"
        slip_no = f"SLIP-OBX-{suffix.upper()}"
        amount = 18500.00

        event_payload = {
            "company_id": "COMP-001",
            "branch_id": "MAIN",
            "deposit_id": dep_id,
            "slip_number": slip_no,
            "amount": amount,
            "deposit_date": date.today().isoformat(),
            "narration": f"POS Shift EOD Cashier deposit slip {slip_no}"
        }

        voucher = await UnifiedAccountingLedgerService.dispatch_outbox_event(
            event={
                "event_type": "BANK_DEPOSIT_POSTED",
                "company_id": "COMP-001",
                "branch_id": "MAIN",
                "payload": event_payload
            },
            session=session
        )
        await session.commit()

        assert voucher is not None
        assert voucher.voucher_type == "BANK_DEPOSIT"
        assert voucher.total_debit == Decimal(str(amount))
        assert voucher.total_credit == Decimal(str(amount))
        assert voucher.reference_doc_id == dep_id


@pytest.mark.asyncio
async def test_bank_deposit_rest_api():
    """
    Verifies POST /api/v1/accounting/bank-deposits creates an authoritative GL voucher
    via the REST API and returns BankDepositResponse (HTTP 201).
    """
    mock_cashier = User(
        id="usr-eod-cashier",
        username="cashier_eod",
        role=UserRole.CASHIER,
        company_id="COMP-001",
        branch_id="MAIN",
        is_active=True,
        is_deleted=False
    )
    app.dependency_overrides[get_current_user] = lambda: mock_cashier
    app.dependency_overrides[get_tenant_context] = lambda: TenantContext("COMP-001", "MAIN")

    token = create_access_token({
        "sub": "usr-eod-cashier",
        "company_id": "COMP-001",
        "branch_id": "MAIN"
    })
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Company-Code": "001",
        "X-Company-ID": "COMP-001",
        "X-Branch-Code": "MAIN",
        "Content-Type": "application/json"
    }

    suffix = uuid.uuid4().hex[:6]
    payload = {
        "amount": 27500.00,
        "bank_account_code": "1020",
        "cash_account_code": "1010",
        "deposit_date": date.today().isoformat(),
        "slip_number": f"SLIP-API-{suffix.upper()}",
        "narration": "Direct cashier end-of-day bank counter deposit",
        "branch_id": "MAIN"
    }

    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as client:
            res = await client.post("/accounting/bank-deposits", json=payload, headers=headers)
            assert res.status_code == 201, res.text
            data = res.json()
            assert data["status"] == "POSTED"
            assert float(data["amount"]) == 27500.00
            assert data["voucher_no"].startswith("JV-")
            assert data["voucher_id"] is not None
    finally:
        app.dependency_overrides.clear()
