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
from datetime import date
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.ephemeral_tenant_harness import EphemeralTenantHarness
from app.db.session import get_company_sessionmaker
from app.models.accounting import (
    Account,
    JournalVoucher,
    GeneralLedgerEntry,
    FiscalYear,
    FiscalPeriod,
    CurrencyExchangeRate
)
from app.models.tenant import Company, Branch
from app.services.unified_accounting_ledger_service import UnifiedAccountingLedgerService



@pytest.fixture(scope="module")
def ephemeral_db():
    """
    Module-scoped fixture that provisions a clean ephemeral PostgreSQL database,
    runs full Alembic migration to head, yields the db name and sessionmaker,
    and guarantees drop & teardown upon test completion.
    """
    db_name = EphemeralTenantHarness.generate_ephemeral_db_name()
    EphemeralTenantHarness.create_ephemeral_database(db_name)
    try:
        EphemeralTenantHarness.run_alembic_upgrade(db_name, "head")
        sessionmaker = EphemeralTenantHarness.get_ephemeral_sessionmaker(db_name)
        yield db_name, sessionmaker
    finally:
        EphemeralTenantHarness.drop_ephemeral_database(db_name)


@pytest.mark.asyncio
async def test_ephemeral_clean_slate_schema_verification(ephemeral_db):
    """Verify that all core application, WMS, and authoritative accounting tables exist on clean-slate database."""
    db_name, sessionmaker = ephemeral_db

    async with sessionmaker() as session:
        tables = await EphemeralTenantHarness.get_table_names(session)

        # Core operational tables
        assert "companies" in tables
        assert "branches" in tables
        assert "users" in tables
        assert "products" in tables
        assert "stock_movements" in tables
        assert "sales_invoices" in tables
        assert "cash_registers" in tables
        assert "shifts" in tables

        # Authoritative Double-Entry Accounting tables
        assert "accounts" in tables
        assert "journal_vouchers" in tables
        assert "general_ledger_entries" in tables
        assert "account_balance_snapshots" in tables
        assert "fiscal_years" in tables
        assert "fiscal_periods" in tables
        assert "bank_statements" in tables
        assert "bank_statement_lines" in tables
        assert "currency_exchange_rates" in tables
        assert "shift_cash_transactions" in tables

        # Check alembic revision is at latest head
        rev_res = await session.execute(text("SELECT version_num FROM alembic_version;"))
        rev = rev_res.scalar()
        assert rev == "v1360_pos_sct_fk_constraints"

        # Verify database-level FK constraints on shift_cash_transactions (v1360 / ADR-POS-002)
        fk_res = await session.execute(text("""
            SELECT conname FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'shift_cash_transactions' AND c.contype = 'f';
        """))
        fks = [row[0] for row in fk_res.fetchall()]
        assert "fk_sct_account_id" in fks, f"fk_sct_account_id FK constraint missing from {fks}"
        assert "fk_sct_gl_voucher_id" in fks, f"fk_sct_gl_voucher_id FK constraint missing from {fks}"


@pytest.mark.asyncio
async def test_ephemeral_forward_only_migration_guard_verification(ephemeral_db):
    """
    Verify migration lifecycle governance.

    As of v1346_pos_cash_denominations, the SMRITI Financial Data Governance
    policy classifies migrations that touch financial transaction history as
    FORWARD-ONLY. Attempting to downgrade through v1346 must raise
    NotImplementedError — this is the expected, policy-enforced behaviour.

    This test verifies:
      1. The forward-only guard fires (NotImplementedError / RuntimeError) when
         a downgrade through v1346 is attempted.
      2. The schema at head is structurally complete after upgrade (the
         positive path from a clean database is unaffected).
    """
    import pytest
    db_name, sessionmaker = ephemeral_db

    # 1. Attempt downgrade to base — must be rejected by the forward-only guard
    with pytest.raises(RuntimeError) as exc_info:
        EphemeralTenantHarness.run_alembic_downgrade(db_name, "base")

    # The RuntimeError wraps the NotImplementedError raised inside alembic
    assert "FORWARD-ONLY" in str(exc_info.value) or "NotImplementedError" in str(exc_info.value), (
        f"Expected forward-only policy error, got: {exc_info.value}"
    )

    # 2. Schema must still be intact at head after the failed downgrade attempt
    async with sessionmaker() as session:
        tables_at_head = await EphemeralTenantHarness.get_table_names(session)
        assert "accounts" in tables_at_head, "accounts table must exist at head"
        assert "journal_vouchers" in tables_at_head, "journal_vouchers must exist at head"
        assert "currency_exchange_rates" in tables_at_head, "currency_exchange_rates must exist at head"
        assert "general_ledger_entries" in tables_at_head, "general_ledger_entries must exist at head"
        assert "shift_cash_transactions" in tables_at_head, "shift_cash_transactions must exist at head"



@pytest.mark.asyncio
async def test_ephemeral_tenant_seeding_and_double_entry_transaction(ephemeral_db):
    """Verify clean tenant environment provisioning, COA seeding, and transaction posting on fresh database."""
    db_name, sessionmaker = ephemeral_db
    company_id = "COMP-EPHEM-01"
    branch_id = "BR-EPHEM-01"

    async with sessionmaker() as session:
        # 1. Seed baseline tenant environment
        seed_res = await EphemeralTenantHarness.seed_baseline_tenant_environment(
            session=session,
            company_id=company_id,
            branch_id=branch_id
        )
        assert seed_res["accounts_count"] >= 20

        # 2. Post a multi-currency Journal Voucher on the fresh database
        acc_cash = await UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "1010")
        acc_capital = await UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "3010")

        jv = await UnifiedAccountingLedgerService.post_journal_voucher(
            session=session,
            company_id=company_id,
            branch_id=branch_id,
            voucher_type="CAPITAL_INFUSION",
            voucher_date=date.today(),
            lines=[
                {
                    "account_id": acc_cash.id,
                    "debit_amount": Decimal("100000.00"),
                    "credit_amount": Decimal("0.00"),
                    "remarks": "Owner initial capital deposit"
                },
                {
                    "account_id": acc_capital.id,
                    "debit_amount": Decimal("0.00"),
                    "credit_amount": Decimal("100000.00"),
                    "remarks": "Owner capital credit"
                }
            ],
            narration="Initial capital infusion into ephemeral company",
            created_by=seed_res["admin_user_id"]
        )
        assert jv.id is not None
        assert jv.total_debit == Decimal("100000.00")
        assert jv.total_credit == Decimal("100000.00")

        # 3. Calculate Trial Balance
        tb = await UnifiedAccountingLedgerService.get_trial_balance(session, company_id)
        assert tb["grand_total_debit"] == 100000.00
        assert tb["grand_total_credit"] == 100000.00
        assert tb["is_balanced"] is True

        await session.commit()

    # 4. Verify multi-tenant isolation: This JV must NOT exist in smriti001
    smriti001_maker = get_company_sessionmaker("smriti001")
    async with smriti001_maker() as s1:
        stmt = select(JournalVoucher).where(JournalVoucher.id == jv.id)
        res = (await s1.execute(stmt)).scalar_one_or_none()
        assert res is None


@pytest.mark.asyncio
async def test_ephemeral_chart_of_accounts_completeness(ephemeral_db):
    """Verify that all default nominal, asset, liability, equity, income, and expense accounts are properly seeded."""
    db_name, sessionmaker = ephemeral_db
    company_id = "COMP-EPHEM-01"

    async with sessionmaker() as session:
        accounts_stmt = select(Account).where(Account.company_id == company_id, Account.is_deleted == False)
        accounts = (await session.execute(accounts_stmt)).scalars().all()
        account_codes = {acc.account_code: acc for acc in accounts}

        # Essential balance sheet and P&L accounts
        expected_codes = ["1010", "1020", "1030", "1040", "2010", "2021", "2022", "3010", "4010", "4030", "4040", "4050", "5010", "5050", "5060", "5070"]
        for code in expected_codes:
            assert code in account_codes, f"Expected account code {code} missing from seeded COA"

        # Check overage and shortage accounts
        assert account_codes["4050"].account_name == "Cash Register Overage (Surplus)"
        assert account_codes["4050"].root_type == "INCOME"
        assert account_codes["5070"].account_name == "Cash Register Shortage (Deficit)"
        assert account_codes["5070"].root_type == "EXPENSE"



@pytest.mark.asyncio
async def test_ephemeral_multi_currency_fx_in_clean_database(ephemeral_db):
    """Verify FX rate matrix, rate insertion, and multi-currency voucher posting in a clean ephemeral tenant database."""
    db_name, sessionmaker = ephemeral_db
    company_id = "COMP-EPHEM-01"
    branch_id = "BR-EPHEM-01"

    async with sessionmaker() as session:
        # 1. Set USD/INR exchange rate
        rate_entry = await UnifiedAccountingLedgerService.set_exchange_rate(
            session=session,
            company_id=company_id,
            from_currency="USD",
            to_currency="INR",
            exchange_rate=Decimal("84.500000"),
            rate_type="SPOT",
            effective_date=date.today(),
            source="TEST_ORACLE"
        )
        assert rate_entry.id is not None
        assert rate_entry.exchange_rate == Decimal("84.500000")


        # 2. Post multi-currency Journal Voucher: $1,000 USD receipt at 84.50 = ₹84,500 INR
        acc_cash = await UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "1010")
        acc_export_sales = await UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "4010")

        jv = await UnifiedAccountingLedgerService.post_journal_voucher(
            session=session,
            company_id=company_id,
            branch_id=branch_id,
            voucher_type="EXPORT_RECEIPT",
            voucher_date=date.today(),
            currency="USD",
            exchange_rate=Decimal("84.500000"),
            lines=[
                {
                    "account_id": acc_cash.id,
                    "debit_amount": Decimal("84500.00"),
                    "credit_amount": Decimal("0.00"),
                    "foreign_debit_amount": Decimal("1000.00"),
                    "foreign_credit_amount": Decimal("0.00"),
                    "remarks": "Foreign customer export payment in USD"
                },
                {
                    "account_id": acc_export_sales.id,
                    "debit_amount": Decimal("0.00"),
                    "credit_amount": Decimal("84500.00"),
                    "foreign_debit_amount": Decimal("0.00"),
                    "foreign_credit_amount": Decimal("1000.00"),
                    "remarks": "Export sales revenue recognized"
                }
            ],
            narration="Export sales receipt in foreign currency (USD)",
            created_by="ephem_admin"
        )
        assert jv.currency == "USD"
        assert jv.exchange_rate == Decimal("84.500000")
        assert jv.total_debit == Decimal("84500.00")
        assert jv.total_foreign_debit == Decimal("1000.00")
        assert jv.total_foreign_credit == Decimal("1000.00")

        await session.commit()


@pytest.mark.asyncio
async def test_ephemeral_concurrent_tenants_isolation():
    """Verify that multiple ephemeral databases can be provisioned concurrently with strict schema & data isolation."""
    db_name_a = EphemeralTenantHarness.generate_ephemeral_db_name()
    db_name_b = EphemeralTenantHarness.generate_ephemeral_db_name()

    EphemeralTenantHarness.create_ephemeral_database(db_name_a)
    EphemeralTenantHarness.create_ephemeral_database(db_name_b)

    try:
        EphemeralTenantHarness.run_alembic_upgrade(db_name_a, "head")
        EphemeralTenantHarness.run_alembic_upgrade(db_name_b, "head")

        sm_a = EphemeralTenantHarness.get_ephemeral_sessionmaker(db_name_a)
        sm_b = EphemeralTenantHarness.get_ephemeral_sessionmaker(db_name_b)

        async with sm_a() as sess_a:
            await EphemeralTenantHarness.seed_baseline_tenant_environment(sess_a, "COMP-ALPHA", "BR-ALPHA", "Alpha Retail")

        async with sm_b() as sess_b:
            await EphemeralTenantHarness.seed_baseline_tenant_environment(sess_b, "COMP-BETA", "BR-BETA", "Beta Retail")

        # Verify cross-database physical isolation
        async with sm_a() as sess_a:
            comps_a = (await sess_a.execute(select(Company))).scalars().all()
            comp_ids_a = [c.id for c in comps_a]
            assert "COMP-ALPHA" in comp_ids_a
            assert "COMP-BETA" not in comp_ids_a

        async with sm_b() as sess_b:
            comps_b = (await sess_b.execute(select(Company))).scalars().all()
            comp_ids_b = [c.id for c in comps_b]
            assert "COMP-BETA" in comp_ids_b
            assert "COMP-ALPHA" not in comp_ids_b

    finally:
        EphemeralTenantHarness.drop_ephemeral_database(db_name_a)
        EphemeralTenantHarness.drop_ephemeral_database(db_name_b)
