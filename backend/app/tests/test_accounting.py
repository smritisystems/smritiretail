"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 12.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

test_accounting.py — Pytest suite for General Ledger & Double-Entry Accounting Engine (Plug-in Architecture).
"""

import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException
from app.core.config import settings
from app.services.accounting import AccountingService, JournalVoucher, JournalEntry, Accounts
from app.models.accounting import ChartOfAccounts, JournalVoucherModel


@pytest.mark.asyncio
async def test_retail_only_disabled_accounting_mode_bypasses_posting():
    """Verify that when ACCOUNTING_MODE is DISABLED (Retail Only), GL posting is dormant and does not fail retail workflows."""
    settings.ACCOUNTING_MODE = "DISABLED"
    service = AccountingService(None)

    voucher = JournalVoucher(
        ref_document_type="SalesInvoice",
        ref_document_id="inv-999",
        ref_document_no="INV-2026-9999",
        entries=[
            JournalEntry(account_code=Accounts.CASH, account_name="Cash", debit=Decimal("1000.00"), credit=Decimal("0.00")),
            JournalEntry(account_code=Accounts.SALES_REVENUE, account_name="Sales", debit=Decimal("0.00"), credit=Decimal("1000.00"))
        ]
    )

    v_id = await service.post_journal(voucher)
    assert v_id.startswith("JV-DORMANT-")


@pytest.mark.asyncio
async def test_advanced_accounting_mode_unbalanced_voucher_fails(monkeypatch):
    """Verify that in ADVANCED mode, unbalanced journal entries raise HTTP 400."""
    monkeypatch.setattr(settings, "ACCOUNTING_MODE", "ADVANCED")
    service = AccountingService(None)

    unbalanced_voucher = JournalVoucher(
        ref_document_type="SalesInvoice",
        ref_document_id="inv-101",
        ref_document_no="INV-2026-0001",
        entries=[
            JournalEntry(account_code=Accounts.CASH, account_name="Cash", debit=Decimal("1000.00"), credit=Decimal("0.00")),
            JournalEntry(account_code=Accounts.SALES_REVENUE, account_name="Sales", debit=Decimal("0.00"), credit=Decimal("800.00"))
        ]
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.post_journal(unbalanced_voucher)

    assert exc_info.value.status_code == 400
    assert "Unbalanced Journal Voucher" in exc_info.value.detail


@pytest.mark.asyncio
async def test_advanced_accounting_posting_unit_mock(monkeypatch):
    """Verify GL posting logic and account balances in unit test environment using mocks."""
    monkeypatch.setattr(settings, "ACCOUNTING_MODE", "ADVANCED")

    mock_db = MagicMock()
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()

    service = AccountingService(mock_db)

    # Mock Chart of Accounts in repo
    cash_coa = ChartOfAccounts(id="COA-1100", account_code=Accounts.CASH, account_name="Cash", account_type="ASSET", balance_type="DEBIT", current_balance=Decimal("0.00"))
    sales_coa = ChartOfAccounts(id="COA-4000", account_code=Accounts.SALES_REVENUE, account_name="Sales", account_type="REVENUE", balance_type="CREDIT", current_balance=Decimal("0.00"))

    mock_repo = AsyncMock()
    mock_repo.get_account_by_code = AsyncMock(side_effect=lambda code: cash_coa if code == Accounts.CASH else (sales_coa if code == Accounts.SALES_REVENUE else None))
    mock_repo.get_all_accounts = AsyncMock(return_value=[cash_coa, sales_coa])
    service.repo = mock_repo

    voucher = JournalVoucher(
        ref_document_type="SalesInvoice",
        ref_document_id="inv-102",
        ref_document_no="INV-2026-0002",
        entries=[
            JournalEntry(account_code=Accounts.CASH, account_name="Cash", debit=Decimal("1000.00"), credit=Decimal("0.00")),
            JournalEntry(account_code=Accounts.SALES_REVENUE, account_name="Sales", debit=Decimal("0.00"), credit=Decimal("1000.00"))
        ]
    )

    v_id = await service.post_journal(voucher)
    assert v_id.startswith("JV-")
    assert cash_coa.current_balance == Decimal("1000.00")
    assert sales_coa.current_balance == Decimal("1000.00")
