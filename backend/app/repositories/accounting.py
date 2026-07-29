"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 12.1.0
Created      : 2026-07-21
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

accounting.py — Async SQLAlchemy repository for Chart of Accounts, Journal Vouchers, Ledgers,
Bank Accounts, Cost Centers, TDS Entries, Financial Years, and Period Lock verification.
"""

from typing import List, Optional
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from ..models.accounting import (
    ChartOfAccounts, JournalVoucherModel, JournalLedgerEntryModel,
    FiscalPeriod, FinancialYear, BankAccount, CostCenter, TdsEntry, GstReturnLock,
)
from ..api.deps import TenantContext


class AccountingRepository:
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        self.db = db
        self.tenant_ctx = tenant_ctx

    async def get_account_by_code(self, account_code: str) -> Optional[ChartOfAccounts]:
        stmt = select(ChartOfAccounts).where(
            ChartOfAccounts.account_code == account_code,
            ChartOfAccounts.is_deleted == False
        )
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(ChartOfAccounts.company_id == self.tenant_ctx.company_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_all_accounts(self) -> List[ChartOfAccounts]:
        stmt = select(ChartOfAccounts).where(ChartOfAccounts.is_deleted == False).order_by(ChartOfAccounts.account_code)
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(ChartOfAccounts.company_id == self.tenant_ctx.company_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_account(self, account: ChartOfAccounts) -> ChartOfAccounts:
        self.db.add(account)
        await self.db.flush()
        return account

    async def get_voucher_by_id(self, voucher_id: str) -> Optional[JournalVoucherModel]:
        stmt = select(JournalVoucherModel).where(
            JournalVoucherModel.id == voucher_id,
            JournalVoucherModel.is_deleted == False
        )
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(JournalVoucherModel.company_id == self.tenant_ctx.company_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_voucher_by_no(self, voucher_no: str) -> Optional[JournalVoucherModel]:
        stmt = select(JournalVoucherModel).where(
            JournalVoucherModel.voucher_no == voucher_no,
            JournalVoucherModel.is_deleted == False
        )
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(JournalVoucherModel.company_id == self.tenant_ctx.company_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_ledger_entries_for_account(self, account_code: str) -> List[JournalLedgerEntryModel]:
        stmt = select(JournalLedgerEntryModel).where(
            JournalLedgerEntryModel.account_code == account_code,
            JournalLedgerEntryModel.is_deleted == False
        )
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(JournalLedgerEntryModel.company_id == self.tenant_ctx.company_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # Bank Accounts
    async def create_bank_account(self, bank_acc: BankAccount) -> BankAccount:
        self.db.add(bank_acc)
        await self.db.flush()
        return bank_acc

    async def get_all_bank_accounts(self) -> List[BankAccount]:
        stmt = select(BankAccount).where(BankAccount.is_deleted == False)
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(BankAccount.company_id == self.tenant_ctx.company_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_bank_account_by_id(self, bank_id: str) -> Optional[BankAccount]:
        stmt = select(BankAccount).where(BankAccount.id == bank_id, BankAccount.is_deleted == False)
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(BankAccount.company_id == self.tenant_ctx.company_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    # Cost Centers
    async def create_cost_center(self, cost_center: CostCenter) -> CostCenter:
        self.db.add(cost_center)
        await self.db.flush()
        return cost_center

    async def get_all_cost_centers(self) -> List[CostCenter]:
        stmt = select(CostCenter).where(CostCenter.is_deleted == False)
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(CostCenter.company_id == self.tenant_ctx.company_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # TDS Entries
    async def create_tds_entry(self, tds: TdsEntry) -> TdsEntry:
        self.db.add(tds)
        await self.db.flush()
        return tds

    async def get_all_tds_entries(self) -> List[TdsEntry]:
        stmt = select(TdsEntry).where(TdsEntry.is_deleted == False)
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(TdsEntry.company_id == self.tenant_ctx.company_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # Financial Year & Period Locking Check
    async def get_financial_year_for_date(self, posting_date: date) -> Optional[FinancialYear]:
        stmt = select(FinancialYear).where(
            FinancialYear.start_date <= posting_date,
            FinancialYear.end_date >= posting_date,
            FinancialYear.is_deleted == False
        )
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(FinancialYear.company_id == self.tenant_ctx.company_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def is_posting_locked_for_date(self, posting_date: date) -> bool:
        """
        Returns True if posting date falls in a locked FinancialYear or locked GST period.
        """
        fy = await self.get_financial_year_for_date(posting_date)
        if fy and fy.is_locked:
            return True
        # Check GST Return Lock for the period (MM-YYYY)
        period_str = posting_date.strftime("%m-%Y")
        stmt_gst = select(GstReturnLock).where(
            GstReturnLock.return_period == period_str,
            GstReturnLock.is_locked == True,
            GstReturnLock.is_deleted == False
        )
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt_gst = stmt_gst.where(GstReturnLock.company_id == self.tenant_ctx.company_id)
        res_gst = await self.db.execute(stmt_gst)
        if res_gst.scalars().first():
            return True
        return False
