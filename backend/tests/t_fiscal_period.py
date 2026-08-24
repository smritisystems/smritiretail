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
from datetime import date, datetime, timezone, timedelta
from fastapi import HTTPException
from sqlalchemy import select, func

from app.db.session import get_company_sessionmaker
from app.models.accounting import (
    Account,
    JournalVoucher,
    GeneralLedgerEntry,
    FiscalYear,
    FiscalPeriod,
    BankStatement,
    BankStatementLine,
)
from app.services.unified_accounting_ledger_service import UnifiedAccountingLedgerService


@pytest.mark.asyncio
async def test_fiscal_year_and_period_generation():
    """Verify that create_fiscal_year_with_periods generates 12 monthly fiscal periods."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        unique_suffix = uuid.uuid4().hex[:6]
        fy_code = f"FY-{unique_suffix.upper()}"
        fy = await UnifiedAccountingLedgerService.create_fiscal_year_with_periods(
            session=session,
            company_id=f"COMP-{unique_suffix}",
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            code=fy_code
        )
        await session.commit()

        assert fy.financial_year_code == fy_code
        assert fy.start_date == date(2026, 4, 1)
        assert fy.end_date == date(2027, 3, 31)

        # Check periods
        stmt = select(FiscalPeriod).where(FiscalPeriod.fiscal_year_id == fy.id).order_by(FiscalPeriod.period_number)
        periods = (await session.execute(stmt)).scalars().all()
        assert len(periods) == 12

        # Verify Period 1 (April) and Period 12 (March)
        assert periods[0].period_name == "April 2026"
        assert periods[0].period_number == 1
        assert periods[0].status == "OPEN"

        assert periods[11].period_name == "March 2027"
        assert periods[11].period_number == 12
        assert periods[11].status == "OPEN"


@pytest.mark.asyncio
async def test_backdated_voucher_rejected_in_locked_period():
    """Verify invariant SMRITI-GL-006: Rejects posting journal vouchers in HARD_LOCKED periods."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        unique_suffix = uuid.uuid4().hex[:6]
        comp_id = f"COMP-{unique_suffix}"
        await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(session, comp_id)
        acc_cash = await UnifiedAccountingLedgerService.get_account_by_code(session, comp_id, "1010")
        acc_sales = await UnifiedAccountingLedgerService.get_account_by_code(session, comp_id, "4010")

        # 1. Create and lock April 2026 period
        fy = await UnifiedAccountingLedgerService.create_fiscal_year_with_periods(
            session=session,
            company_id=comp_id,
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            code=f"FY-{unique_suffix.upper()}"
        )
        await session.commit()

        stmt = select(FiscalPeriod).where(FiscalPeriod.fiscal_year_id == fy.id, FiscalPeriod.period_number == 1)
        april_period = (await session.execute(stmt)).scalar_one()

        await UnifiedAccountingLedgerService.lock_fiscal_period(
            session=session,
            company_id=comp_id,
            period_id=april_period.id,
            lock_status="HARD_LOCKED",
            closed_by="chief_accountant"
        )
        await session.commit()

        # 2. Attempt to post backdated voucher on 2026-04-15 -> MUST FAIL with SMRITI-GL-006
        with pytest.raises(HTTPException) as exc_info:
            await UnifiedAccountingLedgerService.post_journal_voucher(
                session=session,
                company_id=comp_id,
                voucher_type="JOURNAL",
                voucher_date=date(2026, 4, 15),
                lines=[
                    {"account_id": acc_cash.id, "debit_amount": Decimal("500.00"), "credit_amount": Decimal("0.00")},
                    {"account_id": acc_sales.id, "debit_amount": Decimal("0.00"), "credit_amount": Decimal("500.00")}
                ],
                narration="Illegal backdated entry in locked April period"
            )

        assert exc_info.value.status_code == 400
        assert "SMRITI-GL-006" in exc_info.value.detail
        assert "HARD_LOCKED" in exc_info.value.detail


@pytest.mark.asyncio

async def test_bank_statement_import_and_line_persistence():
    """Verify ingesting a bank statement with multiple credit and debit lines."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(session, "COMP-001")
        acc_bank = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "1020")

        unique_suffix = uuid.uuid4().hex[:6]
        stmt_no = f"STMT-HDFC-{unique_suffix.upper()}"

        statement = await UnifiedAccountingLedgerService.import_bank_statement(
            session=session,
            company_id="COMP-001",
            bank_account_id=acc_bank.id,
            statement_no=stmt_no,
            from_date=date(2026, 5, 1),
            to_date=date(2026, 5, 31),
            opening_balance=Decimal("10000.00"),
            closing_balance=Decimal("18500.00"),
            lines=[
                {
                    "transaction_date": date(2026, 5, 5),
                    "reference_no": f"UPI-REC-{unique_suffix}",
                    "description": "Customer UPI settlement",
                    "deposit_amount": Decimal("10000.00"),
                    "withdrawal_amount": Decimal("0.00"),
                    "balance_after_transaction": Decimal("20000.00")
                },
                {
                    "transaction_date": date(2026, 5, 10),
                    "reference_no": f"NEFT-SUPP-{unique_suffix}",
                    "description": "Supplier Vendor Payment",
                    "deposit_amount": Decimal("0.00"),
                    "withdrawal_amount": Decimal("1500.00"),
                    "balance_after_transaction": Decimal("18500.00")
                }
            ]
        )
        await session.commit()

        assert statement.statement_no == stmt_no
        assert statement.opening_balance == Decimal("10000.00")
        assert statement.closing_balance == Decimal("18500.00")
        assert statement.is_reconciled is False

        # Verify lines
        stmt_lines = select(BankStatementLine).where(BankStatementLine.statement_id == statement.id).order_by(BankStatementLine.line_number)
        lines = (await session.execute(stmt_lines)).scalars().all()
        assert len(lines) == 2
        assert lines[0].deposit_amount == Decimal("10000.00")
        assert lines[0].reconciliation_status == "UNMATCHED"
        assert lines[1].withdrawal_amount == Decimal("1500.00")


@pytest.mark.asyncio
async def test_bank_statement_auto_reconciliation():
    """Verify automated two-way matching between bank statement lines and GL entries."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(session, "COMP-001")
        acc_bank = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "1020")
        acc_sales = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "4010")
        acc_supp = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "2010")

        unique_suffix = uuid.uuid4().hex[:6]
        rec_amt = Decimal("4500.00")
        pay_amt = Decimal("1200.00")

        # 1. Post GL Vouchers
        v1 = await UnifiedAccountingLedgerService.post_journal_voucher(
            session=session,
            company_id="COMP-001",
            voucher_type="PAYMENT_RECEIPT",
            voucher_date=date(2026, 6, 10),
            lines=[
                {"account_id": acc_bank.id, "debit_amount": rec_amt, "credit_amount": Decimal("0.00")},
                {"account_id": acc_sales.id, "debit_amount": Decimal("0.00"), "credit_amount": rec_amt}
            ],
            narration="Customer payment received into Bank"
        )
        v2 = await UnifiedAccountingLedgerService.post_journal_voucher(
            session=session,
            company_id="COMP-001",
            voucher_type="SUPPLIER_PAYMENT",
            voucher_date=date(2026, 6, 12),
            lines=[
                {"account_id": acc_supp.id, "debit_amount": pay_amt, "credit_amount": Decimal("0.00")},
                {"account_id": acc_bank.id, "debit_amount": Decimal("0.00"), "credit_amount": pay_amt}
            ],
            narration="Vendor payment disbursed from Bank"
        )
        await session.commit()

        # 2. Ingest Bank Statement containing these transactions
        stmt = await UnifiedAccountingLedgerService.import_bank_statement(
            session=session,
            company_id="COMP-001",
            bank_account_id=acc_bank.id,
            statement_no=f"STMT-MATCH-{unique_suffix.upper()}",
            from_date=date(2026, 6, 1),
            to_date=date(2026, 6, 30),
            opening_balance=Decimal("50000.00"),
            closing_balance=Decimal("53300.00"),
            lines=[
                {
                    "transaction_date": date(2026, 6, 10),
                    "reference_no": f"DEP-{unique_suffix}",
                    "description": "Customer Deposit",
                    "deposit_amount": rec_amt,
                    "withdrawal_amount": Decimal("0.00")
                },
                {
                    "transaction_date": date(2026, 6, 13),  # Value date 1 day later
                    "reference_no": f"WDR-{unique_suffix}",
                    "description": "Vendor Clearance",
                    "deposit_amount": Decimal("0.00"),
                    "withdrawal_amount": pay_amt
                }
            ]
        )
        await session.commit()

        # 3. Trigger auto-reconciliation
        res = await UnifiedAccountingLedgerService.auto_reconcile_bank_statement(
            session=session,
            company_id="COMP-001",
            statement_id=stmt.id
        )
        await session.commit()

        assert res["total_lines"] == 2
        assert res["matched_lines"] == 2
        assert res["unmatched_lines"] == 0
        assert res["is_fully_reconciled"] is True

        # Verify statement line statuses
        lines_stmt = select(BankStatementLine).where(BankStatementLine.statement_id == stmt.id)
        lines = (await session.execute(lines_stmt)).scalars().all()
        for line in lines:
            assert line.reconciliation_status == "AUTO_RECONCILED"
            assert line.reconciled_gl_entry_id is not None
            assert line.cleared_at is not None


@pytest.mark.asyncio
async def test_bank_reconciliation_statement_equality():
    """Verify BRS calculation invariant: Reconciled Balance matches Bank Statement."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(session, "COMP-001")
        acc_bank = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "1020")

        brs = await UnifiedAccountingLedgerService.get_bank_reconciliation_statement(
            session=session,
            company_id="COMP-001",
            bank_account_id=acc_bank.id,
            as_of_date=date(2026, 6, 30)
        )

        assert "book_balance" in brs
        assert "bank_statement_balance" in brs
        assert "uncredited_deposits" in brs
        assert "unpresented_cheques" in brs
        assert "reconciled_balance" in brs
        assert isinstance(brs["is_balanced"], bool)


@pytest.mark.asyncio
async def test_fiscal_brs_tenant_isolation():
    """Verify that fiscal periods and bank statements in smriti001 do not leak to smriti002."""
    session_001 = get_company_sessionmaker("smriti001")
    session_002 = get_company_sessionmaker("smriti002")

    unique_code = f"FY-{uuid.uuid4().hex[:4].upper()}"

    # 1. Create Fiscal Year in smriti001
    async with session_001() as s1:
        fy1 = await UnifiedAccountingLedgerService.create_fiscal_year_with_periods(
            session=s1,
            company_id="COMP-001",
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            code=unique_code
        )
        await s1.commit()
        fy_id = fy1.id

    # 2. Check smriti002
    async with session_002() as s2:
        stmt = select(FiscalYear).where(FiscalYear.id == fy_id)
        leaked = (await s2.execute(stmt)).scalar_one_or_none()
        assert leaked is None, "FiscalYear from smriti001 must not leak into smriti002!"
