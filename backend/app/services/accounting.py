"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 12.0.0
Created      : 2026-07-19
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

AccountingService — Active General Ledger & Double-Entry Financial Engine for SMRITI Retail OS.
"""

import logging
import uuid
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional, List
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ..models.accounting import ChartOfAccounts, JournalVoucherModel, JournalLedgerEntryModel
from ..repositories.accounting import AccountingRepository
from ..api.deps import TenantContext
from fastapi import HTTPException

from ..core.config import settings

logger = logging.getLogger("smriti.accounting")



# ---------------------------------------------------------------------------
# Data classes (stable interface across modules)
# ---------------------------------------------------------------------------

@dataclass
class JournalEntry:
    """A single debit or credit line in a journal voucher."""
    account_code:  str            # Chart of accounts code (e.g. "4000-SALES")
    account_name:  str            # Human-readable name
    debit:         Decimal = Decimal("0.00")
    credit:        Decimal = Decimal("0.00")
    narration:     Optional[str] = None
    cost_center:   Optional[str] = None
    project:       Optional[str] = None

    def __post_init__(self):
        if self.debit < 0 or self.credit < 0:
            raise ValueError("Debit and credit amounts must be non-negative.")
        if self.debit > 0 and self.credit > 0:
            raise ValueError("A journal entry line cannot have both debit and credit.")


@dataclass
class JournalVoucher:
    """A complete balanced journal voucher."""
    ref_document_type: str
    ref_document_id:   str
    ref_document_no:   str
    entries:           List[JournalEntry] = field(default_factory=list)
    narration:         Optional[str] = None
    voucher_date:      Optional[str] = None   # ISO date string
    company_id:        Optional[str] = None
    branch_id:         Optional[str] = None

    @property
    def total_debit(self) -> Decimal:
        return sum(e.debit for e in self.entries)

    @property
    def total_credit(self) -> Decimal:
        return sum(e.credit for e in self.entries)

    @property
    def is_balanced(self) -> bool:
        return self.total_debit == self.total_credit


# ---------------------------------------------------------------------------
# Standard account codes
# ---------------------------------------------------------------------------

class Accounts:
    SALES_REVENUE          = "4000-SALES"
    SALES_RETURNS          = "4010-SALES-RETURNS"
    ACCOUNTS_RECEIVABLE    = "1200-AR"
    ACCOUNTS_PAYABLE       = "2200-AP"
    CASH                   = "1100-CASH"
    BANK                   = "1110-BANK"
    GST_OUTPUT_CGST        = "2210-GST-CGST"
    GST_OUTPUT_SGST        = "2220-GST-SGST"
    GST_OUTPUT_IGST        = "2230-GST-IGST"
    INVENTORY              = "1300-INVENTORY"
    COGS                   = "5000-COGS"
    CONSIGNMENT_STOCK      = "1310-CONSIGNMENT"
    MT_LISTING_FEES        = "6100-MT-LISTING"
    MT_MARKETING_SUPPORT   = "6110-MT-MARKETING"
    EQUITY_CAPITAL         = "3000-EQUITY"
    GENERAL_EXPENSE        = "6000-EXPENSE"


DEFAULT_COA = [
    ("1100-CASH", "Cash in Hand", "ASSET", "DEBIT"),
    ("1110-BANK", "Bank Account", "ASSET", "DEBIT"),
    ("1200-AR", "Accounts Receivable", "ASSET", "DEBIT"),
    ("1300-INVENTORY", "Inventory Asset", "ASSET", "DEBIT"),
    ("1310-CONSIGNMENT", "Consignment Stock Asset", "ASSET", "DEBIT"),
    ("2200-AP", "Accounts Payable", "LIABILITY", "CREDIT"),
    ("2210-GST-CGST", "CGST Payable/ITC", "LIABILITY", "CREDIT"),
    ("2220-GST-SGST", "SGST Payable/ITC", "LIABILITY", "CREDIT"),
    ("2230-GST-IGST", "IGST Payable/ITC", "LIABILITY", "CREDIT"),
    ("3000-EQUITY", "Owner Equity Capital", "EQUITY", "CREDIT"),
    ("4000-SALES", "Sales Revenue", "REVENUE", "CREDIT"),
    ("4010-SALES-RETURNS", "Sales Returns & Allowances", "REVENUE", "DEBIT"),
    ("5000-COGS", "Cost of Goods Sold", "COGS", "DEBIT"),
    ("6000-EXPENSE", "General Operating Expense", "EXPENSE", "DEBIT"),
    ("6100-MT-LISTING", "Modern Trade Listing Fees", "EXPENSE", "DEBIT"),
    ("6110-MT-MARKETING", "Modern Trade Marketing Support", "EXPENSE", "DEBIT"),
]


class AccountingService:
    def __init__(self, db: Optional[AsyncSession] = None, tenant_ctx: Optional[TenantContext] = None):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.repo = AccountingRepository(db, tenant_ctx) if db else None


    async def seed_chart_of_accounts(self) -> None:
        """Seed default chart of accounts if not present."""
        for code, name, ac_type, bal_type in DEFAULT_COA:
            existing = await self.repo.get_account_by_code(code)
            if not existing:
                account = ChartOfAccounts(
                    id=f"COA-{code}",
                    uuid=str(uuid.uuid4()),
                    tenant_id=self.tenant_ctx.tenant_id if self.tenant_ctx else "default",
                    company_id=self.tenant_ctx.company_id if self.tenant_ctx else "comp-default",
                    branch_id=self.tenant_ctx.branch_id if self.tenant_ctx else "br-default",
                    account_code=code,
                    account_name=name,
                    account_type=ac_type,
                    balance_type=bal_type,
                    current_balance=Decimal("0.00"),
                    is_system=True
                )
                self.db.add(account)
        await self.db.flush()

    async def post_journal(self, voucher: JournalVoucher) -> str:
        """
        Post a double-entry journal voucher transactionally into PostgreSQL.
        Respects ACCOUNTING_MODE ("DISABLED", "BASIC", "ADVANCED").
        If DISABLED, logs posting intent to Financial Event Bus and returns dormant voucher ID.
        """
        mode = getattr(settings, "ACCOUNTING_MODE", "DISABLED").upper()
        if mode == "DISABLED":
            logger.info("[Financial Event Bus] Accounting DISABLED. Bypassing GL posting for %s:%s", voucher.ref_document_type, voucher.ref_document_no)
            return f"JV-DORMANT-{uuid.uuid4().hex[:8]}"

        if not voucher.is_balanced:
            raise HTTPException(
                status_code=400,
                detail=f"Unbalanced Journal Voucher: Total Debit ({voucher.total_debit}) does not equal Total Credit ({voucher.total_credit})."
            )


        if not voucher.entries or len(voucher.entries) < 2:
            raise HTTPException(
                status_code=400,
                detail="A journal voucher must contain at least 2 entry lines."
            )

        await self.seed_chart_of_accounts()

        v_id = f"JV-{uuid.uuid4().hex[:10]}"
        v_no = f"JV-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        model = JournalVoucherModel(
            id=v_id,
            uuid=str(uuid.uuid4()),
            tenant_id=self.tenant_ctx.tenant_id if self.tenant_ctx else "default",
            company_id=self.tenant_ctx.company_id if self.tenant_ctx else "comp-default",
            branch_id=self.tenant_ctx.branch_id if self.tenant_ctx else "br-default",
            voucher_no=v_no,
            ref_document_type=voucher.ref_document_type,
            ref_document_id=voucher.ref_document_id,
            ref_document_no=voucher.ref_document_no,
            total_debit=voucher.total_debit,
            total_credit=voucher.total_credit,
            narration=voucher.narration,
            status="POSTED"
        )
        self.db.add(model)

        for entry in voucher.entries:
            line_id = f"JVE-{uuid.uuid4().hex[:10]}"
            line = JournalLedgerEntryModel(
                id=line_id,
                uuid=str(uuid.uuid4()),
                tenant_id=self.tenant_ctx.tenant_id if self.tenant_ctx else "default",
                company_id=self.tenant_ctx.company_id if self.tenant_ctx else "comp-default",
                branch_id=self.tenant_ctx.branch_id if self.tenant_ctx else "br-default",
                voucher_id=v_id,
                account_code=entry.account_code,
                account_name=entry.account_name,
                debit=entry.debit,
                credit=entry.credit,
                narration=entry.narration or voucher.narration,
                cost_center=entry.cost_center,
                project=entry.project
            )
            self.db.add(line)

            # Update account ledger dynamic balance
            ac = await self.repo.get_account_by_code(entry.account_code)
            if ac:
                if ac.balance_type == "DEBIT":
                    ac.current_balance += (entry.debit - entry.credit)
                else:
                    ac.current_balance += (entry.credit - entry.debit)

        await self.db.commit()
        logger.info("Posted Journal Voucher %s for ref %s:%s", v_no, voucher.ref_document_type, voucher.ref_document_no)
        return v_id

    async def get_trial_balance(self, as_of_date: Optional[str] = None) -> dict:
        """Calculate and return Trial Balance report."""
        await self.seed_chart_of_accounts()
        accounts = await self.repo.get_all_accounts()

        tb_items = []
        tot_debit = Decimal("0.00")
        tot_credit = Decimal("0.00")

        for ac in accounts:
            entries = await self.repo.get_ledger_entries_for_account(ac.account_code)
            deb_sum = sum(e.debit for e in entries)
            cred_sum = sum(e.credit for e in entries)
            net_bal = deb_sum - cred_sum if ac.balance_type == "DEBIT" else cred_sum - deb_sum

            tot_debit += deb_sum
            tot_credit += cred_sum

            tb_items.append({
                "account_code": ac.account_code,
                "account_name": ac.account_name,
                "account_type": ac.account_type,
                "debit_total": float(deb_sum),
                "credit_total": float(cred_sum),
                "net_balance": float(net_bal)
            })

        return {
            "as_of_date": as_of_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "total_debit": float(tot_debit),
            "total_credit": float(tot_credit),
            "is_balanced": tot_debit == tot_credit,
            "accounts": tb_items
        }

    async def get_profit_and_loss(self, start_date: Optional[str] = None, end_date: Optional[str] = None) -> dict:
        """Calculate Profit & Loss (Income Statement)."""
        await self.seed_chart_of_accounts()
        accounts = await self.repo.get_all_accounts()

        revenues = []
        expenses = []
        tot_rev = Decimal("0.00")
        tot_cogs = Decimal("0.00")
        tot_exp = Decimal("0.00")

        for ac in accounts:
            entries = await self.repo.get_ledger_entries_for_account(ac.account_code)
            if not entries:
                continue

            deb_sum = sum(e.debit for e in entries)
            cred_sum = sum(e.credit for e in entries)

            if ac.account_type == "REVENUE":
                amt = cred_sum - deb_sum
                tot_rev += amt
                revenues.append({"account_code": ac.account_code, "account_name": ac.account_name, "amount": float(amt)})
            elif ac.account_type == "COGS":
                amt = deb_sum - cred_sum
                tot_cogs += amt
                expenses.append({"account_code": ac.account_code, "account_name": ac.account_name, "amount": float(amt)})
            elif ac.account_type == "EXPENSE":
                amt = deb_sum - cred_sum
                tot_exp += amt
                expenses.append({"account_code": ac.account_code, "account_name": ac.account_name, "amount": float(amt)})

        gross_profit = tot_rev - tot_cogs
        net_profit = gross_profit - tot_exp

        return {
            "start_date": start_date or datetime.now(timezone.utc).strftime("%Y-%m-01"),
            "end_date": end_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "total_revenue": float(tot_rev),
            "total_cogs": float(tot_cogs),
            "gross_profit": float(gross_profit),
            "total_operating_expenses": float(tot_exp),
            "net_profit": float(net_profit),
            "revenues": revenues,
            "expenses": expenses
        }

    async def get_balance_sheet(self, as_of_date: Optional[str] = None) -> dict:
        """Calculate Balance Sheet Statement (Assets = Liabilities + Equity)."""
        await self.seed_chart_of_accounts()
        accounts = await self.repo.get_all_accounts()

        assets = []
        liabilities = []
        equity = []
        tot_assets = Decimal("0.00")
        tot_liab = Decimal("0.00")
        tot_eq = Decimal("0.00")

        for ac in accounts:
            entries = await self.repo.get_ledger_entries_for_account(ac.account_code)
            deb_sum = sum(e.debit for e in entries)
            cred_sum = sum(e.credit for e in entries)

            if ac.account_type == "ASSET":
                net = deb_sum - cred_sum
                tot_assets += net
                assets.append({
                    "account_code": ac.account_code, "account_name": ac.account_name, "account_type": ac.account_type,
                    "debit_total": float(deb_sum), "credit_total": float(cred_sum), "net_balance": float(net)
                })
            elif ac.account_type == "LIABILITY":
                net = cred_sum - deb_sum
                tot_liab += net
                liabilities.append({
                    "account_code": ac.account_code, "account_name": ac.account_name, "account_type": ac.account_type,
                    "debit_total": float(deb_sum), "credit_total": float(cred_sum), "net_balance": float(net)
                })
            elif ac.account_type == "EQUITY":
                net = cred_sum - deb_sum
                tot_eq += net
                equity.append({
                    "account_code": ac.account_code, "account_name": ac.account_name, "account_type": ac.account_type,
                    "debit_total": float(deb_sum), "credit_total": float(cred_sum), "net_balance": float(net)
                })

        pnl = await self.get_profit_and_loss(as_of_date=as_of_date)
        retained_earnings = Decimal(str(pnl["net_profit"]))
        tot_eq += retained_earnings

        equity.append({
            "account_code": "3900-RETAINED-EARNINGS",
            "account_name": "Current Period Retained Net Earnings",
            "account_type": "EQUITY",
            "debit_total": 0.0,
            "credit_total": float(retained_earnings),
            "net_balance": float(retained_earnings)
        })

        tot_liab_eq = tot_liab + tot_eq

        return {
            "as_of_date": as_of_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "total_assets": float(tot_assets),
            "total_liabilities": float(tot_liab),
            "total_equity": float(tot_eq),
            "total_liabilities_and_equity": float(tot_liab_eq),
            "is_balanced": abs(tot_assets - tot_liab_eq) < Decimal("0.01"),
            "assets": assets,
            "liabilities": liabilities,
            "equity": equity
        }


accounting_service = AccountingService()

