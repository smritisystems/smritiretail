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
from datetime import date, timedelta
from fastapi import HTTPException
from sqlalchemy import select

from app.db.session import get_company_sessionmaker
from app.services.unified_accounting_ledger_service import UnifiedAccountingLedgerService
from app.models.accounting import (
    CurrencyExchangeRate,
    JournalVoucher,
    GeneralLedgerEntry
)


@pytest.mark.asyncio
async def test_set_and_get_exchange_rate():
    """Verify upserting and resolving currency exchange rates."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # 1. Set USD rate
        rate_obj = await UnifiedAccountingLedgerService.set_exchange_rate(
            session=session,
            company_id="COMP-001",
            from_currency="USD",
            to_currency="INR",
            exchange_rate=Decimal("83.500000"),
            effective_date=date(2026, 7, 1),
            rate_type="SPOT",
            source="RBI"
        )
        await session.commit()

        assert rate_obj.from_currency == "USD"
        assert rate_obj.exchange_rate == Decimal("83.500000")

        # 2. Get USD rate
        resolved_rate = await UnifiedAccountingLedgerService.get_exchange_rate(
            session=session,
            company_id="COMP-001",
            from_currency="USD",
            to_currency="INR",
            as_of_date=date(2026, 7, 5)
        )
        assert resolved_rate == Decimal("83.500000")


        # 3. Base currency rate (INR/INR) is always 1.000000
        inr_rate = await UnifiedAccountingLedgerService.get_exchange_rate(
            session=session,
            company_id="COMP-001",
            from_currency="INR",
            to_currency="INR"
        )
        assert inr_rate == Decimal("1.000000")

        # 4. Unconfigured currency raises SMRITI-GL-007
        with pytest.raises(HTTPException) as exc_info:
            await UnifiedAccountingLedgerService.get_exchange_rate(
                session=session,
                company_id="COMP-001",
                from_currency="GBP",
                to_currency="INR",
                as_of_date=date(2026, 7, 1)
            )
        assert exc_info.value.status_code == 400
        assert "SMRITI-GL-007" in str(exc_info.value.detail)

        # 5. Non-positive rate raises SMRITI-GL-008
        with pytest.raises(HTTPException) as exc_info2:
            await UnifiedAccountingLedgerService.set_exchange_rate(
                session=session,
                company_id="COMP-001",
                from_currency="EUR",
                to_currency="INR",
                exchange_rate=Decimal("-10.00")
            )
        assert exc_info2.value.status_code == 400
        assert "SMRITI-GL-008" in str(exc_info2.value.detail)


@pytest.mark.asyncio
async def test_multi_currency_journal_voucher_posting():
    """Verify posting a multi-currency journal voucher converts foreign amounts to base currency."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(session, "COMP-001")
        acc_debtors = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "1030")
        acc_sales = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "4010")

        # Set exchange rate: 1 USD = 84.00 INR
        await UnifiedAccountingLedgerService.set_exchange_rate(
            session=session,
            company_id="COMP-001",
            from_currency="USD",
            to_currency="INR",
            exchange_rate=Decimal("84.000000"),
            effective_date=date(2026, 7, 10)
        )
        await session.commit()

        # Post foreign sales invoice of $1,000
        voucher = await UnifiedAccountingLedgerService.post_journal_voucher(
            session=session,
            company_id="COMP-001",
            voucher_type="SALES_INVOICE",
            voucher_date=date(2026, 7, 10),
            currency="USD",
            exchange_rate=Decimal("84.000000"),
            lines=[
                {"account_id": acc_debtors.id, "foreign_debit_amount": Decimal("1000.00"), "foreign_credit_amount": Decimal("0.00")},
                {"account_id": acc_sales.id, "foreign_debit_amount": Decimal("0.00"), "foreign_credit_amount": Decimal("1000.00")}
            ],
            narration="Export Sales $1000 @ ₹84.00"
        )
        await session.commit()

        assert voucher.currency == "USD"
        assert voucher.exchange_rate == Decimal("84.000000")
        assert voucher.total_foreign_debit == Decimal("1000.00")
        assert voucher.total_debit == Decimal("84000.00")
        assert voucher.total_credit == Decimal("84000.00")

        # Verify General Ledger Entry lines
        stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == voucher.id).order_by(GeneralLedgerEntry.debit_amount.desc())
        entries = (await session.execute(stmt)).scalars().all()
        assert len(entries) == 2
        assert entries[0].foreign_currency == "USD"
        assert entries[0].foreign_debit_amount == Decimal("1000.00")
        assert entries[0].debit_amount == Decimal("84000.00")
        assert entries[1].foreign_credit_amount == Decimal("1000.00")
        assert entries[1].credit_amount == Decimal("84000.00")


@pytest.mark.asyncio
async def test_realized_fx_gain_on_customer_settlement():
    """Verify Realized FX Gain when foreign customer payment is received at a higher exchange rate."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(session, "COMP-001")
        acc_bank = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "1020")
        acc_debtors = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "1030")
        acc_sales = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "4010")

        party_id = f"PTY-{uuid.uuid4().hex[:6].upper()}"

        # 1. Invoice: $1,000 @ ₹83.00 = ₹83,000
        inv_voucher = await UnifiedAccountingLedgerService.post_journal_voucher(
            session=session,
            company_id="COMP-001",
            voucher_type="SALES_INVOICE",
            voucher_date=date(2026, 7, 1),
            currency="USD",
            exchange_rate=Decimal("83.000000"),
            lines=[
                {"account_id": acc_debtors.id, "party_id": party_id, "foreign_debit_amount": Decimal("1000.00")},
                {"account_id": acc_sales.id, "foreign_credit_amount": Decimal("1000.00")}
            ],
            narration="Export Invoice $1000 @ 83"
        )

        # 2. Payment Received: $1,000 @ ₹85.50 = ₹85,500
        pay_voucher = await UnifiedAccountingLedgerService.post_journal_voucher(
            session=session,
            company_id="COMP-001",
            voucher_type="PAYMENT_RECEIPT",
            voucher_date=date(2026, 7, 15),
            currency="USD",
            exchange_rate=Decimal("85.500000"),
            lines=[
                {"account_id": acc_bank.id, "foreign_debit_amount": Decimal("1000.00")},
                {"account_id": acc_debtors.id, "party_id": party_id, "foreign_credit_amount": Decimal("1000.00")}
            ],
            narration="Bank settlement $1000 @ 85.50"
        )
        await session.commit()

        # 3. Reconcile settlement difference ($1000 * (85.50 - 83.00) = ₹2,500 Realized FX Gain)
        fx_voucher = await UnifiedAccountingLedgerService.reconcile_foreign_settlement_fx(
            session=session,
            company_id="COMP-001",
            invoice_voucher_id=inv_voucher.id,
            payment_voucher_id=pay_voucher.id,
            settled_foreign_amount=Decimal("1000.00"),
            party_id=party_id
        )
        await session.commit()

        assert fx_voucher is not None
        assert fx_voucher.voucher_type == "FX_REALIZATION"
        assert fx_voucher.total_debit == Decimal("2500.00")
        assert fx_voucher.total_credit == Decimal("2500.00")

        # Verify entries: Debit Debtors 1030 (2500), Credit FX Gain 4030 (2500)
        stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == fx_voucher.id).order_by(GeneralLedgerEntry.debit_amount.desc())
        entries = (await session.execute(stmt)).scalars().all()
        assert entries[0].account_id == acc_debtors.id
        assert entries[0].debit_amount == Decimal("2500.00")
        acc_fx_gain = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "4030")
        assert entries[1].account_id == acc_fx_gain.id
        assert entries[1].credit_amount == Decimal("2500.00")


@pytest.mark.asyncio
async def test_realized_fx_loss_on_supplier_settlement():
    """Verify Realized FX Loss when foreign supplier bill is paid at a higher exchange rate."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(session, "COMP-001")
        acc_bank = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "1020")
        acc_creditors = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "2010")
        acc_inventory = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "1040")

        party_id = f"SUPP-{uuid.uuid4().hex[:6].upper()}"

        # 1. Supplier Bill: $2,000 @ ₹82.00 = ₹164,000
        bill_voucher = await UnifiedAccountingLedgerService.post_journal_voucher(
            session=session,
            company_id="COMP-001",
            voucher_type="PURCHASE_BILL",
            voucher_date=date(2026, 7, 2),
            currency="USD",
            exchange_rate=Decimal("82.000000"),
            lines=[
                {"account_id": acc_inventory.id, "foreign_debit_amount": Decimal("2000.00")},
                {"account_id": acc_creditors.id, "party_id": party_id, "foreign_credit_amount": Decimal("2000.00")}
            ],
            narration="Import Purchase Bill $2000 @ 82"
        )

        # 2. Supplier Paid: $2,000 @ ₹84.50 = ₹169,000 (Paid ₹5,000 more due to rupee depreciation)
        pay_voucher = await UnifiedAccountingLedgerService.post_journal_voucher(
            session=session,
            company_id="COMP-001",
            voucher_type="SUPPLIER_PAYMENT",
            voucher_date=date(2026, 7, 20),
            currency="USD",
            exchange_rate=Decimal("84.500000"),
            lines=[
                {"account_id": acc_creditors.id, "party_id": party_id, "foreign_debit_amount": Decimal("2000.00")},
                {"account_id": acc_bank.id, "foreign_credit_amount": Decimal("2000.00")}
            ],
            narration="Supplier Payment $2000 @ 84.50"
        )
        await session.commit()

        # 3. Reconcile settlement difference ($2000 * (84.50 - 82.00) = ₹5,000 Realized FX Loss)
        fx_voucher = await UnifiedAccountingLedgerService.reconcile_foreign_settlement_fx(
            session=session,
            company_id="COMP-001",
            invoice_voucher_id=bill_voucher.id,
            payment_voucher_id=pay_voucher.id,
            settled_foreign_amount=Decimal("2000.00"),
            party_id=party_id
        )
        await session.commit()

        assert fx_voucher is not None
        assert fx_voucher.voucher_type == "FX_REALIZATION"
        assert fx_voucher.total_debit == Decimal("5000.00")
        assert fx_voucher.total_credit == Decimal("5000.00")

        acc_fx_loss = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "5050")
        stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == fx_voucher.id).order_by(GeneralLedgerEntry.debit_amount.desc())
        entries = (await session.execute(stmt)).scalars().all()
        assert entries[0].account_id == acc_fx_loss.id
        assert entries[0].debit_amount == Decimal("5000.00")
        assert entries[1].account_id == acc_creditors.id
        assert entries[1].credit_amount == Decimal("5000.00")


@pytest.mark.asyncio
async def test_unrealized_fx_mtm_periodic_revaluation():
    """Verify period-end Mark-to-Market (MTM) unrealized FX gain/loss revaluation."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(session, "COMP-001")
        acc_debtors = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "1030")
        acc_sales = await UnifiedAccountingLedgerService.get_account_by_code(session, "COMP-001", "4010")

        unique_party = f"PTY-MTM-{uuid.uuid4().hex[:4].upper()}"

        # Book open invoice of $5000 @ ₹82.00 = ₹410,000
        await UnifiedAccountingLedgerService.post_journal_voucher(
            session=session,
            company_id="COMP-001",
            voucher_type="SALES_INVOICE",
            voucher_date=date(2026, 7, 5),
            currency="USD",
            exchange_rate=Decimal("82.000000"),
            lines=[
                {"account_id": acc_debtors.id, "party_id": unique_party, "foreign_debit_amount": Decimal("5000.00")},
                {"account_id": acc_sales.id, "foreign_credit_amount": Decimal("5000.00")}
            ],
            narration="Open foreign debtor invoice $5000 @ 82"
        )
        await session.commit()

        # Revalue at period end closing rate: USD = 84.00 (Gain = $5000 * ₹2 = ₹10,000)
        reval_res = await UnifiedAccountingLedgerService.calculate_unrealized_fx_revaluation(
            session=session,
            company_id="COMP-001",
            as_of_date=date(2026, 7, 31),
            closing_rates={"USD": Decimal("84.000000")}
        )
        await session.commit()

        assert reval_res["total_unrealized_gain"] >= 10000.00
        assert reval_res["revaluation_voucher_id"] is not None


@pytest.mark.asyncio
async def test_multicurrency_tenant_isolation():
    """Verify that exchange rates and vouchers in smriti001 do not leak to smriti002."""
    session_001 = get_company_sessionmaker("smriti001")
    session_002 = get_company_sessionmaker("smriti002")

    async with session_001() as s1:
        rate1 = await UnifiedAccountingLedgerService.set_exchange_rate(
            session=s1,
            company_id="COMP-001",
            from_currency="AED",
            to_currency="INR",
            exchange_rate=Decimal("22.750000"),
            effective_date=date(2026, 7, 1)
        )
        await s1.commit()
        rate_id = rate1.id

    async with session_002() as s2:
        stmt = select(CurrencyExchangeRate).where(CurrencyExchangeRate.id == rate_id)
        leaked = (await s2.execute(stmt)).scalar_one_or_none()
        assert leaked is None, "CurrencyExchangeRate from smriti001 must not leak into smriti002!"
