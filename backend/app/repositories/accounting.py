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

accounting.py — Async SQLAlchemy repository for Chart of Accounts and Journal Vouchers.
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from ..models.accounting import ChartOfAccounts, JournalVoucherModel, JournalLedgerEntryModel, FiscalPeriod
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
