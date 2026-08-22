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

import uuid
from decimal import Decimal
from datetime import datetime, timezone, date
from typing import Dict, Any, List, Optional
from fastapi import HTTPException
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.accounting import (
    Account,
    JournalVoucher,
    GeneralLedgerEntry,
    AccountBalanceSnapshot,
)
from ..models.sales import SalesInvoice
from ..models.purchase import PurchaseReceipt
from .outbox_service import OutboxService


DEFAULT_CHART_OF_ACCOUNTS = [
    # 1000 - Assets
    {"code": "1000", "name": "Assets", "type": "ASSET", "root": "ASSET", "is_group": True, "parent": None},
    {"code": "1010", "name": "Cash in Hand", "type": "ASSET", "root": "ASSET", "is_group": False, "parent": "1000"},
    {"code": "1020", "name": "Bank Accounts", "type": "ASSET", "root": "ASSET", "is_group": False, "parent": "1000"},
    {"code": "1030", "name": "Accounts Receivable (Debtors)", "type": "ASSET", "root": "ASSET", "is_group": False, "parent": "1000", "party_type": "CUSTOMER"},
    {"code": "1040", "name": "Inventory Asset", "type": "ASSET", "root": "ASSET", "is_group": False, "parent": "1000"},
    {"code": "1051", "name": "Input CGST", "type": "ASSET", "root": "ASSET", "is_group": False, "parent": "1000"},
    {"code": "1052", "name": "Input SGST", "type": "ASSET", "root": "ASSET", "is_group": False, "parent": "1000"},
    {"code": "1053", "name": "Input IGST", "type": "ASSET", "root": "ASSET", "is_group": False, "parent": "1000"},

    # 2000 - Liabilities
    {"code": "2000", "name": "Liabilities", "type": "LIABILITY", "root": "LIABILITY", "is_group": True, "parent": None},
    {"code": "2010", "name": "Accounts Payable (Creditors)", "type": "LIABILITY", "root": "LIABILITY", "is_group": False, "parent": "2000", "party_type": "SUPPLIER"},
    {"code": "2021", "name": "Output CGST", "type": "LIABILITY", "root": "LIABILITY", "is_group": False, "parent": "2000"},
    {"code": "2022", "name": "Output SGST", "type": "LIABILITY", "root": "LIABILITY", "is_group": False, "parent": "2000"},
    {"code": "2023", "name": "Output IGST", "type": "LIABILITY", "root": "LIABILITY", "is_group": False, "parent": "2000"},

    # 3000 - Equity
    {"code": "3000", "name": "Equity", "type": "EQUITY", "root": "EQUITY", "is_group": True, "parent": None},
    {"code": "3010", "name": "Owner's Capital", "type": "EQUITY", "root": "EQUITY", "is_group": False, "parent": "3000"},
    {"code": "3020", "name": "Retained Earnings", "type": "EQUITY", "root": "EQUITY", "is_group": False, "parent": "3000"},

    # 4000 - Revenue
    {"code": "4000", "name": "Revenue", "type": "REVENUE", "root": "INCOME", "is_group": True, "parent": None},
    {"code": "4010", "name": "Sales Revenue (Goods)", "type": "REVENUE", "root": "INCOME", "is_group": False, "parent": "4000"},
    {"code": "4020", "name": "Discounts Received", "type": "REVENUE", "root": "INCOME", "is_group": False, "parent": "4000"},

    # 5000 - Expenses
    {"code": "5000", "name": "Expenses", "type": "EXPENSE", "root": "EXPENSE", "is_group": True, "parent": None},
    {"code": "5010", "name": "Cost of Goods Sold (COGS)", "type": "EXPENSE", "root": "EXPENSE", "is_group": False, "parent": "5000"},
    {"code": "5020", "name": "Discounts Allowed", "type": "EXPENSE", "root": "EXPENSE", "is_group": False, "parent": "5000"},
    {"code": "5030", "name": "Roundoff Account", "type": "EXPENSE", "root": "EXPENSE", "is_group": False, "parent": "5000"},
    {"code": "5040", "name": "Inventory Loss & Shrinkage", "type": "EXPENSE", "root": "EXPENSE", "is_group": False, "parent": "5000"},
]


class UnifiedAccountingLedgerService:
    """
    Authoritative Double-Entry General Ledger Engine.
    Guarantees strict double-entry balance invariants (Debit == Credit),
    Chart of Accounts lifecycle, automated document postings, and financial statements.
    """

    @classmethod
    async def seed_default_chart_of_accounts(
        cls,
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str] = None
    ) -> List[Account]:
        """
        Idempotently seeds standard Indian retail chart of accounts into the company database.
        """
        existing_stmt = select(Account).where(Account.company_id == company_id, Account.is_deleted == False)
        existing = {a.account_code: a for a in (await session.execute(existing_stmt)).scalars().all()}

        created_accounts: List[Account] = []
        code_to_id: Dict[str, str] = {code: acc.id for code, acc in existing.items()}

        # 1. First pass: Groups and root accounts
        for item in DEFAULT_CHART_OF_ACCOUNTS:
            code = item["code"]
            if code not in existing:
                acc_id = f"acc_{code}_{company_id}"
                acc = Account(
                    id=acc_id,
                    uuid=str(uuid.uuid4()),
                    company_id=company_id,
                    branch_id=branch_id,
                    account_code=code,
                    account_name=item["name"],
                    account_type=item["type"],
                    root_type=item["root"],
                    is_group=item["is_group"],
                    currency="INR",
                    is_active=True,
                    is_system=True,
                    party_type=item.get("party_type")
                )
                session.add(acc)
                code_to_id[code] = acc_id
                created_accounts.append(acc)

        await session.flush()

        # 2. Second pass: Link parent relationships
        for item in DEFAULT_CHART_OF_ACCOUNTS:
            parent_code = item.get("parent")
            if parent_code and parent_code in code_to_id:
                acc_id = code_to_id[item["code"]]
                acc_stmt = select(Account).where(Account.id == acc_id)
                acc = (await session.execute(acc_stmt)).scalar_one_or_none()
                if acc and not acc.parent_account_id:
                    acc.parent_account_id = code_to_id[parent_code]

        await session.commit()
        return created_accounts

    @classmethod
    async def get_account_by_code(
        cls,
        session: AsyncSession,
        company_id: str,
        account_code: str
    ) -> Account:
        """
        Fetches an active account by code, ensuring chart of accounts is seeded if missing.
        """
        stmt = select(Account).where(
            Account.company_id == company_id,
            Account.account_code == account_code,
            Account.is_deleted == False
        )
        account = (await session.execute(stmt)).scalar_one_or_none()
        if not account:
            await cls.seed_default_chart_of_accounts(session, company_id)
            account = (await session.execute(stmt)).scalar_one_or_none()
            if not account:
                raise HTTPException(status_code=404, detail=f"SMRITI-GL-404: Account code '{account_code}' not found for company '{company_id}'.")
        return account

    @classmethod
    async def post_journal_voucher(
        cls,
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str],
        voucher_type: str,
        voucher_date: date,
        lines: List[Dict[str, Any]],
        reference_doc_type: Optional[str] = None,
        reference_doc_id: Optional[str] = None,
        reference_doc_no: Optional[str] = None,
        narration: Optional[str] = None,
        created_by: Optional[str] = None,
        auto_stage_outbox: bool = True
    ) -> JournalVoucher:
        """
        Validates and atomically posts a balanced double-entry Journal Voucher.
        Strict invariant: sum(debit_amounts) == sum(credit_amounts).
        """
        if not lines or len(lines) < 2:
            raise HTTPException(
                status_code=400,
                detail="SMRITI-GL-002: A double-entry journal voucher requires at least two lines."
            )

        total_debit = Decimal("0.00")
        total_credit = Decimal("0.00")
        parsed_entries = []

        for line in lines:
            acc_id = line.get("account_id")
            acc_code = line.get("account_code")
            if not acc_id and acc_code:
                acc = await cls.get_account_by_code(session, company_id, acc_code)
                acc_id = acc.id
            elif not acc_id:
                raise HTTPException(status_code=400, detail="SMRITI-GL-003: Each voucher line must specify account_id or account_code.")

            debit = Decimal(str(line.get("debit_amount", 0.00))).quantize(Decimal("0.01"))
            credit = Decimal(str(line.get("credit_amount", 0.00))).quantize(Decimal("0.01"))

            if debit < 0 or credit < 0:
                raise HTTPException(status_code=400, detail="SMRITI-GL-004: Debit and credit amounts must be non-negative.")
            if debit == 0 and credit == 0:
                raise HTTPException(status_code=400, detail="SMRITI-GL-005: Line cannot have both zero debit and zero credit.")

            total_debit += debit
            total_credit += credit

            parsed_entries.append({
                "account_id": acc_id,
                "party_id": line.get("party_id"),
                "debit_amount": debit,
                "credit_amount": credit,
                "against_account_id": line.get("against_account_id"),
                "against_account_name": line.get("against_account_name"),
                "remarks": line.get("remarks"),
            })

        # Strict Double-Entry Invariant Validation
        if abs(total_debit - total_credit) > Decimal("0.001"):
            raise HTTPException(
                status_code=400,
                detail=f"SMRITI-GL-001: Unbalanced journal voucher. Total debits (₹{total_debit}) must equal total credits (₹{total_credit})."
            )

        now_utc = datetime.now(timezone.utc)
        voucher_id = f"jv_{uuid.uuid4().hex[:12]}"
        voucher_no = f"JV-{voucher_date.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        voucher = JournalVoucher(
            id=voucher_id,
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            branch_id=branch_id,
            voucher_no=voucher_no,
            voucher_type=voucher_type,
            voucher_date=voucher_date,
            posting_date=now_utc,
            reference_doc_type=reference_doc_type,
            reference_doc_id=reference_doc_id,
            reference_doc_no=reference_doc_no,
            narration=narration,
            total_debit=total_debit,
            total_credit=total_credit,
            is_posted=True,
            is_cancelled=False,
            posted_at=now_utc,
            created_by=created_by
        )
        session.add(voucher)
        await session.flush()

        for pe in parsed_entries:
            entry = GeneralLedgerEntry(
                id=f"gle_{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                company_id=company_id,
                branch_id=branch_id,
                voucher_id=voucher.id,
                account_id=pe["account_id"],
                party_id=pe["party_id"],
                entry_date=voucher_date,
                posting_date=now_utc,
                debit_amount=pe["debit_amount"],
                credit_amount=pe["credit_amount"],
                currency="INR",
                against_account_id=pe["against_account_id"],
                against_account_name=pe["against_account_name"],
                reference_doc_type=reference_doc_type,
                reference_doc_id=reference_doc_id,
                remarks=pe["remarks"]
            )
            session.add(entry)

        await session.flush()

        # Stage canonical outbox event
        if auto_stage_outbox:
            await OutboxService.record_event(
                session=session,
                target_channel="ACCOUNTING_STREAM",
                payload={
                    "voucher_id": voucher.id,
                    "voucher_no": voucher.voucher_no,
                    "voucher_type": voucher.voucher_type,
                    "voucher_date": voucher.voucher_date.isoformat(),
                    "total_amount": float(voucher.total_debit),
                    "reference_doc_type": reference_doc_type,
                    "reference_doc_id": reference_doc_id,
                    "entries_count": len(parsed_entries)
                },
                correlation_id=f"corr_jv_{voucher.id}",
                causation_id=reference_doc_id or voucher.id,
                event_type="GL_VOUCHER_POSTED",
                aggregate_type="JOURNAL_VOUCHER",
                aggregate_id=voucher.id,
                company_id=company_id,
                branch_id=branch_id
            )

        return voucher

    @classmethod
    async def post_sales_invoice_to_gl(
        cls,
        session: AsyncSession,
        company_id: str,
        invoice_id: str,
        branch_id: Optional[str] = None
    ) -> JournalVoucher:
        """
        Translates a confirmed Sales Invoice into an authoritative double-entry GL voucher:
        Debit: Accounts Receivable (1030) or Cash (1010) = Grand Total
        Credit: Sales Revenue (4010) = Subtotal (Gross before tax)
        Credit: Output CGST (2021) = CGST Total
        Credit: Output SGST (2022) = SGST Total
        Credit: Output IGST (2023) = IGST Total
        Credit/Debit: Roundoff Account (5030) = Roundoff difference
        """
        stmt = select(SalesInvoice).where(SalesInvoice.id == invoice_id, SalesInvoice.company_id == company_id).options(selectinload(SalesInvoice.items))
        inv = (await session.execute(stmt)).scalar_one_or_none()
        if not inv:
            raise HTTPException(status_code=404, detail=f"Sales invoice {invoice_id} not found.")

        # Ensure COA is present
        await cls.seed_default_chart_of_accounts(session, company_id, branch_id)

        acc_debtors = await cls.get_account_by_code(session, company_id, "1030")
        acc_sales = await cls.get_account_by_code(session, company_id, "4010")
        acc_cgst = await cls.get_account_by_code(session, company_id, "2021")
        acc_sgst = await cls.get_account_by_code(session, company_id, "2022")
        acc_igst = await cls.get_account_by_code(session, company_id, "2023")
        acc_roundoff = await cls.get_account_by_code(session, company_id, "5030")

        grand_total = Decimal(str(inv.grand_total or 0.00)).quantize(Decimal("0.01"))
        tax_total = Decimal(str(inv.tax_total or 0.00)).quantize(Decimal("0.01"))
        subtotal = Decimal(str(getattr(inv, "taxable_value", None) or getattr(inv, "subtotal", None) or (grand_total - tax_total))).quantize(Decimal("0.01"))

        # Calculate exact tax breakdown from items
        cgst_sum = Decimal("0.00")
        sgst_sum = Decimal("0.00")
        igst_sum = Decimal("0.00")

        for item in (inv.items or []):
            cgst_sum += Decimal(str(getattr(item, "cgst_amount", 0.00) or 0.00))
            sgst_sum += Decimal(str(getattr(item, "sgst_amount", 0.00) or 0.00))
            igst_sum += Decimal(str(getattr(item, "igst_amount", 0.00) or 0.00))

        # Fallback to general tax if items lack breakdown
        if (cgst_sum + sgst_sum + igst_sum) == 0 and tax_total > 0:
            if getattr(inv, "is_interstate", False):
                igst_sum = tax_total
            else:
                cgst_sum = (tax_total / 2).quantize(Decimal("0.01"))
                sgst_sum = tax_total - cgst_sum

        lines = []

        # 1. Debit Customer / Debtors for Grand Total
        lines.append({
            "account_id": acc_debtors.id,
            "party_id": inv.customer_id,
            "debit_amount": grand_total,
            "credit_amount": Decimal("0.00"),
            "remarks": f"Sales Invoice {inv.invoice_no} to {inv.customer_name}"
        })

        # 2. Credit Sales Revenue for Subtotal
        lines.append({
            "account_id": acc_sales.id,
            "debit_amount": Decimal("0.00"),
            "credit_amount": subtotal,
            "remarks": f"Revenue for Invoice {inv.invoice_no}"
        })

        # 3. Credit Output Tax Ledgers
        if cgst_sum > 0:
            lines.append({
                "account_id": acc_cgst.id,
                "debit_amount": Decimal("0.00"),
                "credit_amount": cgst_sum,
                "remarks": f"Output CGST on Invoice {inv.invoice_no}"
            })
        if sgst_sum > 0:
            lines.append({
                "account_id": acc_sgst.id,
                "debit_amount": Decimal("0.00"),
                "credit_amount": sgst_sum,
                "remarks": f"Output SGST on Invoice {inv.invoice_no}"
            })
        if igst_sum > 0:
            lines.append({
                "account_id": acc_igst.id,
                "debit_amount": Decimal("0.00"),
                "credit_amount": igst_sum,
                "remarks": f"Output IGST on Invoice {inv.invoice_no}"
            })

        # 4. Handle Roundoff difference
        total_credit_calc = subtotal + cgst_sum + sgst_sum + igst_sum
        diff = grand_total - total_credit_calc
        if abs(diff) > Decimal("0.00"):
            if diff > 0:
                # Credit roundoff
                lines.append({
                    "account_id": acc_roundoff.id,
                    "debit_amount": Decimal("0.00"),
                    "credit_amount": diff,
                    "remarks": "Roundoff Adjustment"
                })
            else:
                # Debit roundoff
                lines.append({
                    "account_id": acc_roundoff.id,
                    "debit_amount": abs(diff),
                    "credit_amount": Decimal("0.00"),
                    "remarks": "Roundoff Adjustment"
                })

        return await cls.post_journal_voucher(
            session=session,
            company_id=company_id,
            branch_id=branch_id or inv.branch_id,
            voucher_type="SALES_INVOICE",
            voucher_date=inv.date if isinstance(inv.date, date) else date.today(),
            lines=lines,
            reference_doc_type="SALES_INVOICE",
            reference_doc_id=inv.id,
            reference_doc_no=inv.invoice_no,
            narration=f"Automated GL posting for Sales Invoice {inv.invoice_no}",
            created_by=inv.created_by
        )

    @classmethod
    async def post_purchase_receipt_to_gl(
        cls,
        session: AsyncSession,
        company_id: str,
        receipt_id: str,
        branch_id: Optional[str] = None
    ) -> JournalVoucher:
        """
        Translates a received Purchase Receipt / Bill into an authoritative double-entry GL voucher:
        Debit: Inventory Asset (1040) / COGS = Subtotal
        Debit: Input CGST (1051) / SGST (1052) / IGST (1053) = Tax Totals
        Credit: Accounts Payable (2010) = Grand Total
        """
        stmt = select(PurchaseReceipt).where(PurchaseReceipt.id == receipt_id, PurchaseReceipt.company_id == company_id).options(selectinload(PurchaseReceipt.items))
        receipt = (await session.execute(stmt)).scalar_one_or_none()
        if not receipt:
            raise HTTPException(status_code=404, detail=f"Purchase receipt {receipt_id} not found.")

        await cls.seed_default_chart_of_accounts(session, company_id, branch_id)

        acc_inventory = await cls.get_account_by_code(session, company_id, "1040")
        acc_creditors = await cls.get_account_by_code(session, company_id, "2010")
        acc_cgst = await cls.get_account_by_code(session, company_id, "1051")
        acc_sgst = await cls.get_account_by_code(session, company_id, "1052")
        acc_igst = await cls.get_account_by_code(session, company_id, "1053")

        grand_total = Decimal(str(receipt.grand_total or getattr(receipt, 'total_amount', 0.00) or 0.00)).quantize(Decimal("0.01"))
        tax_total = Decimal(str(receipt.tax_total or getattr(receipt, 'total_tax', 0.00) or 0.00)).quantize(Decimal("0.01"))
        subtotal = Decimal(str(receipt.subtotal or (grand_total - tax_total))).quantize(Decimal("0.01"))

        cgst_sum = (tax_total / 2).quantize(Decimal("0.01"))
        sgst_sum = tax_total - cgst_sum

        lines = [
            {
                "account_id": acc_inventory.id,
                "debit_amount": subtotal,
                "credit_amount": Decimal("0.00"),
                "remarks": f"Inward Inventory for GRN {receipt.receipt_no}"
            },
            {
                "account_id": acc_cgst.id,
                "debit_amount": cgst_sum,
                "credit_amount": Decimal("0.00"),
                "remarks": f"Input CGST on GRN {receipt.receipt_no}"
            },
            {
                "account_id": acc_sgst.id,
                "debit_amount": sgst_sum,
                "credit_amount": Decimal("0.00"),
                "remarks": f"Input SGST on GRN {receipt.receipt_no}"
            },
            {
                "account_id": acc_creditors.id,
                "party_id": receipt.supplier_id,
                "debit_amount": Decimal("0.00"),
                "credit_amount": grand_total,
                "remarks": f"Payable to Supplier for GRN {receipt.receipt_no}"
            }
        ]

        receipt_dt = getattr(receipt, "receipt_date", None) or getattr(receipt, "created_at", None)
        v_date = receipt_dt.date() if isinstance(receipt_dt, datetime) else (receipt_dt or date.today())

        return await cls.post_journal_voucher(
            session=session,
            company_id=company_id,
            branch_id=branch_id or receipt.branch_id,
            voucher_type="PURCHASE_RECEIPT",
            voucher_date=v_date,
            lines=lines,
            reference_doc_type="PURCHASE_RECEIPT",
            reference_doc_id=receipt.id,
            reference_doc_no=receipt.receipt_no,
            narration=f"Automated GL posting for GRN {receipt.receipt_no}"
        )

    @classmethod
    async def get_trial_balance(
        cls,
        session: AsyncSession,
        company_id: str,
        as_of_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Calculates authoritative Trial Balance across all active accounts.
        Asserts total_debits == total_credits.
        """
        filters = [GeneralLedgerEntry.company_id == company_id, GeneralLedgerEntry.is_deleted == False]
        if as_of_date:
            filters.append(GeneralLedgerEntry.entry_date <= as_of_date)

        stmt = (
            select(
                Account.account_code,
                Account.account_name,
                Account.account_type,
                Account.root_type,
                func.coalesce(func.sum(GeneralLedgerEntry.debit_amount), 0).label("total_debit"),
                func.coalesce(func.sum(GeneralLedgerEntry.credit_amount), 0).label("total_credit")
            )
            .join(Account, GeneralLedgerEntry.account_id == Account.id)
            .where(*filters)
            .group_by(Account.id, Account.account_code, Account.account_name, Account.account_type, Account.root_type)
            .order_by(Account.account_code)
        )

        rows = (await session.execute(stmt)).all()

        trial_balance_rows = []
        grand_debit = Decimal("0.00")
        grand_credit = Decimal("0.00")

        for r in rows:
            debit = Decimal(str(r.total_debit))
            credit = Decimal(str(r.total_credit))
            net = debit - credit

            grand_debit += debit
            grand_credit += credit

            trial_balance_rows.append({
                "account_code": r.account_code,
                "account_name": r.account_name,
                "account_type": r.account_type,
                "root_type": r.root_type,
                "total_debit": float(debit),
                "total_credit": float(credit),
                "net_balance": float(net)
            })

        is_balanced = abs(grand_debit - grand_credit) < Decimal("0.001")

        return {
            "company_id": company_id,
            "as_of_date": (as_of_date or date.today()).isoformat(),
            "grand_total_debit": float(grand_debit),
            "grand_total_credit": float(grand_credit),
            "is_balanced": is_balanced,
            "accounts_count": len(trial_balance_rows),
            "accounts": trial_balance_rows
        }

    @classmethod
    async def get_profit_and_loss(
        cls,
        session: AsyncSession,
        company_id: str,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Calculates authoritative Profit & Loss Statement (Revenue - Expenses = Net Profit).
        """
        filters = [
            GeneralLedgerEntry.company_id == company_id,
            GeneralLedgerEntry.is_deleted == False,
            Account.account_type.in_(["REVENUE", "EXPENSE"])
        ]
        if from_date:
            filters.append(GeneralLedgerEntry.entry_date >= from_date)
        if to_date:
            filters.append(GeneralLedgerEntry.entry_date <= to_date)

        stmt = (
            select(
                Account.account_code,
                Account.account_name,
                Account.account_type,
                func.coalesce(func.sum(GeneralLedgerEntry.debit_amount), 0).label("total_debit"),
                func.coalesce(func.sum(GeneralLedgerEntry.credit_amount), 0).label("total_credit")
            )
            .join(Account, GeneralLedgerEntry.account_id == Account.id)
            .where(*filters)
            .group_by(Account.id, Account.account_code, Account.account_name, Account.account_type)
            .order_by(Account.account_code)
        )

        rows = (await session.execute(stmt)).all()

        revenue_items = []
        expense_items = []
        total_revenue = Decimal("0.00")
        total_expense = Decimal("0.00")

        for r in rows:
            debit = Decimal(str(r.total_debit))
            credit = Decimal(str(r.total_credit))

            if r.account_type == "REVENUE":
                net_revenue = credit - debit
                total_revenue += net_revenue
                revenue_items.append({
                    "account_code": r.account_code,
                    "account_name": r.account_name,
                    "amount": float(net_revenue)
                })
            elif r.account_type == "EXPENSE":
                net_expense = debit - credit
                total_expense += net_expense
                expense_items.append({
                    "account_code": r.account_code,
                    "account_name": r.account_name,
                    "amount": float(net_expense)
                })

        net_profit = total_revenue - total_expense

        return {
            "company_id": company_id,
            "from_date": from_date.isoformat() if from_date else None,
            "to_date": (to_date or date.today()).isoformat(),
            "total_revenue": float(total_revenue),
            "total_expense": float(total_expense),
            "net_profit": float(net_profit),
            "revenue_items": revenue_items,
            "expense_items": expense_items
        }
