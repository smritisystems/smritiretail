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
from datetime import datetime, timezone, date, timedelta
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
    FiscalYear,
    FiscalPeriod,
    BankStatement,
    BankStatementLine,
    CurrencyExchangeRate,
)
from ..models.sales import SalesInvoice
from ..models.purchase import PurchaseReceipt
from ..models.payment_ledger import PaymentTransaction
from ..models.inventory import StockAudit
from ..models.pos import Shift
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
    {"code": "4030", "name": "Foreign Exchange Gain (Realized)", "type": "REVENUE", "root": "INCOME", "is_group": False, "parent": "4000"},
    {"code": "4040", "name": "Foreign Exchange Gain (Unrealized)", "type": "REVENUE", "root": "INCOME", "is_group": False, "parent": "4000"},
    {"code": "4050", "name": "Cash Register Overage (Surplus)", "type": "REVENUE", "root": "INCOME", "is_group": False, "parent": "4000"},

    # 5000 - Expenses
    {"code": "5000", "name": "Expenses", "type": "EXPENSE", "root": "EXPENSE", "is_group": True, "parent": None},
    {"code": "5010", "name": "Cost of Goods Sold (COGS)", "type": "EXPENSE", "root": "EXPENSE", "is_group": False, "parent": "5000"},
    {"code": "5020", "name": "Discounts Allowed", "type": "EXPENSE", "root": "EXPENSE", "is_group": False, "parent": "5000"},
    {"code": "5030", "name": "Roundoff Account", "type": "EXPENSE", "root": "EXPENSE", "is_group": False, "parent": "5000"},
    {"code": "5040", "name": "Inventory Loss & Shrinkage", "type": "EXPENSE", "root": "EXPENSE", "is_group": False, "parent": "5000"},
    {"code": "5050", "name": "Foreign Exchange Loss (Realized)", "type": "EXPENSE", "root": "EXPENSE", "is_group": False, "parent": "5000"},
    {"code": "5060", "name": "Foreign Exchange Loss (Unrealized)", "type": "EXPENSE", "root": "EXPENSE", "is_group": False, "parent": "5000"},
    {"code": "5070", "name": "Cash Register Shortage (Deficit)", "type": "EXPENSE", "root": "EXPENSE", "is_group": False, "parent": "5000"},
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

    @staticmethod
    def validate_currency_code(code: str) -> str:
        """Validates that a currency code is a valid 3-letter uppercase ISO format."""
        if not code or not isinstance(code, str):
            raise HTTPException(status_code=400, detail="SMRITI-VAL-001: Currency code must be a valid 3-letter ISO code.")
        clean_code = code.strip().upper()
        if len(clean_code) != 3 or not clean_code.isalpha():
            raise HTTPException(status_code=400, detail=f"SMRITI-VAL-002: Invalid currency code '{code}'. Must be a 3-letter uppercase ISO code (e.g. USD, EUR, INR).")
        return clean_code

    @classmethod
    async def post_journal_voucher(
        cls,
        session: AsyncSession,
        company_id: str,
        voucher_type: str,
        voucher_date: date,
        lines: List[Dict[str, Any]],
        branch_id: Optional[str] = None,
        reference_doc_type: Optional[str] = None,
        reference_doc_id: Optional[str] = None,
        reference_doc_no: Optional[str] = None,
        narration: Optional[str] = None,
        created_by: Optional[str] = None,
        auto_stage_outbox: bool = True,
        currency: str = "INR",
        exchange_rate: Optional[Decimal] = None
    ) -> JournalVoucher:
        """
        Validates and atomically posts a balanced double-entry Journal Voucher.
        Strict invariant: sum(debit_amounts) == sum(credit_amounts) in Base Currency.
        Supports multi-currency conversion and foreign line amount tracking.
        Enforces fiscal period lockouts (SMRITI-GL-006) and currency validation.
        """
        await cls.assert_fiscal_period_open(session, company_id, voucher_date)

        if not lines or len(lines) < 2:
            raise HTTPException(
                status_code=400,
                detail="SMRITI-GL-002: A double-entry journal voucher requires at least two lines."
            )

        currency = cls.validate_currency_code(currency)
        if currency != "INR" and exchange_rate is None:
            exchange_rate = await cls.get_exchange_rate(session, company_id, currency, "INR", voucher_date)
        elif exchange_rate is None:
            exchange_rate = Decimal("1.000000")
        else:
            exchange_rate = Decimal(str(exchange_rate))
            if exchange_rate <= 0 or exchange_rate > Decimal("100000000.000000"):
                raise HTTPException(status_code=400, detail="SMRITI-GL-008: Currency exchange rate must be strictly positive and <= 100,000,000.")

        total_debit = Decimal("0.00")
        total_credit = Decimal("0.00")
        total_f_debit = Decimal("0.00")
        total_f_credit = Decimal("0.00")
        parsed_entries = []

        for line in lines:
            acc_id = line.get("account_id")
            acc_code = line.get("account_code")
            if not acc_id and acc_code:
                acc = await cls.get_account_by_code(session, company_id, acc_code)
                acc_id = acc.id
            elif not acc_id:
                raise HTTPException(status_code=400, detail="SMRITI-GL-003: Each voucher line must specify account_id or account_code.")

            raw_curr = line.get("currency") or line.get("foreign_currency") or currency
            line_curr = cls.validate_currency_code(raw_curr)
            raw_line_rate = line.get("exchange_rate")
            if raw_line_rate is not None:
                line_rate = Decimal(str(raw_line_rate))
                if line_rate <= 0 or line_rate > Decimal("100000000.000000"):
                    raise HTTPException(status_code=400, detail="SMRITI-GL-008: Line exchange rate must be strictly positive and <= 100,000,000.")
            else:
                line_rate = exchange_rate



            f_debit = Decimal(str(line.get("foreign_debit_amount", 0.00))).quantize(Decimal("0.01"))
            f_credit = Decimal(str(line.get("foreign_credit_amount", 0.00))).quantize(Decimal("0.01"))
            debit = Decimal(str(line.get("debit_amount", 0.00))).quantize(Decimal("0.01"))
            credit = Decimal(str(line.get("credit_amount", 0.00))).quantize(Decimal("0.01"))

            # Convert foreign amounts to base amounts if base amounts not explicitly supplied
            if line_curr != "INR":
                if f_debit > 0 and debit == 0:
                    debit = (f_debit * line_rate).quantize(Decimal("0.01"))
                elif debit > 0 and f_debit == 0:
                    f_debit = (debit / line_rate).quantize(Decimal("0.01"))

                if f_credit > 0 and credit == 0:
                    credit = (f_credit * line_rate).quantize(Decimal("0.01"))
                elif credit > 0 and f_credit == 0:
                    f_credit = (credit / line_rate).quantize(Decimal("0.01"))
            else:
                f_debit = debit
                f_credit = credit

            if debit < 0 or credit < 0:
                raise HTTPException(status_code=400, detail="SMRITI-GL-004: Debit and credit amounts must be non-negative.")
            if debit == 0 and credit == 0:
                raise HTTPException(status_code=400, detail="SMRITI-GL-005: Line cannot have both zero debit and zero credit.")

            total_debit += debit
            total_credit += credit
            total_f_debit += f_debit
            total_f_credit += f_credit

            parsed_entries.append({
                "account_id": acc_id,
                "party_id": line.get("party_id"),
                "debit_amount": debit,
                "credit_amount": credit,
                "foreign_currency": line_curr,
                "exchange_rate": line_rate,
                "foreign_debit_amount": f_debit,
                "foreign_credit_amount": f_credit,
                "against_account_id": line.get("against_account_id"),
                "against_account_name": line.get("against_account_name"),
                "remarks": line.get("remarks"),
            })

        # Foreign Currency Consistency Validation
        if currency != "INR":
            same_foreign_curr = all(e["foreign_currency"] == currency for e in parsed_entries)
            if same_foreign_curr and abs(total_f_debit - total_f_credit) > Decimal("0.001"):
                raise HTTPException(
                    status_code=400,
                    detail=f"SMRITI-GL-010: Unbalanced foreign currency voucher. Total foreign debits ({currency} {total_f_debit}) must equal total foreign credits ({currency} {total_f_credit})."
                )

        # Strict Double-Entry Invariant Validation in Base Currency
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
            currency=currency,
            exchange_rate=exchange_rate,
            total_foreign_debit=total_f_debit,
            total_foreign_credit=total_f_credit,
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
                foreign_currency=pe["foreign_currency"],
                exchange_rate=pe["exchange_rate"],
                foreign_debit_amount=pe["foreign_debit_amount"],
                foreign_credit_amount=pe["foreign_credit_amount"],
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

    @classmethod
    async def post_payment_transaction_to_gl(
        cls,
        session: AsyncSession,
        company_id: str,
        payment_id: str,
        branch_id: Optional[str] = None
    ) -> JournalVoucher:
        """
        Translates a PaymentTransaction into an authoritative double-entry GL voucher:
        Customer Receipt:
            Debit: Cash in Hand (1010) or Bank Accounts (1020) = Amount
            Credit: Accounts Receivable / Debtors (1030) = Amount
        Supplier Payment:
            Debit: Accounts Payable / Creditors (2010) = Amount
            Credit: Cash in Hand (1010) or Bank Accounts (1020) = Amount
        """
        stmt = select(PaymentTransaction).where(PaymentTransaction.id == payment_id, PaymentTransaction.company_id == company_id)
        payment = (await session.execute(stmt)).scalar_one_or_none()
        if not payment:
            raise HTTPException(status_code=404, detail=f"Payment transaction {payment_id} not found.")

        await cls.seed_default_chart_of_accounts(session, company_id, branch_id)

        tender_type = (payment.tender_type or "CASH").upper()
        if tender_type == "CASH":
            tender_account = await cls.get_account_by_code(session, company_id, "1010")
        else:
            tender_account = await cls.get_account_by_code(session, company_id, "1020")

        amount = Decimal(str(payment.amount or 0.00)).quantize(Decimal("0.01"))
        ref_type = (payment.reference_doc_type or "SALES_INVOICE").upper()

        lines = []
        if ref_type in ["SALES_INVOICE", "POS_BILL", "CUSTOMER_RECEIPT"]:
            # Customer settlement
            acc_debtors = await cls.get_account_by_code(session, company_id, "1030")
            lines.append({
                "account_id": tender_account.id,
                "party_id": payment.party_id,
                "debit_amount": amount,
                "credit_amount": Decimal("0.00"),
                "remarks": f"Tender {tender_type} received for {ref_type} {payment.reference_doc_id}"
            })
            lines.append({
                "account_id": acc_debtors.id,
                "party_id": payment.party_id,
                "debit_amount": Decimal("0.00"),
                "credit_amount": amount,
                "remarks": f"Receivable settlement for {payment.reference_doc_id}"
            })
            voucher_type = "PAYMENT_RECEIPT"
        else:
            # Supplier settlement
            acc_creditors = await cls.get_account_by_code(session, company_id, "2010")
            lines.append({
                "account_id": acc_creditors.id,
                "party_id": payment.party_id,
                "debit_amount": amount,
                "credit_amount": Decimal("0.00"),
                "remarks": f"Payable settlement for {payment.reference_doc_id}"
            })
            lines.append({
                "account_id": tender_account.id,
                "party_id": payment.party_id,
                "debit_amount": Decimal("0.00"),
                "credit_amount": amount,
                "remarks": f"Tender {tender_type} disbursed for {ref_type} {payment.reference_doc_id}"
            })
            voucher_type = "SUPPLIER_PAYMENT"

        payment_dt = getattr(payment, "captured_at", None) or getattr(payment, "created_at", None)
        v_date = payment_dt.date() if isinstance(payment_dt, datetime) else (payment_dt or date.today())

        return await cls.post_journal_voucher(
            session=session,
            company_id=company_id,
            branch_id=branch_id or payment.branch_id,
            voucher_type=voucher_type,
            voucher_date=v_date,
            lines=lines,
            reference_doc_type=payment.reference_doc_type,
            reference_doc_id=payment.id,
            reference_doc_no=payment.transaction_no,
            narration=f"Automated GL posting for Payment {payment.transaction_no} via {tender_type}"
        )

    @classmethod
    async def post_stock_audit_reconciliation_to_gl(
        cls,
        session: AsyncSession,
        company_id: str,
        audit_id: str,
        branch_id: Optional[str] = None
    ) -> Optional[JournalVoucher]:
        """
        Translates a reconciled Physical Stock Audit into an authoritative double-entry GL voucher:
        Deficit (Physical < System, OUTWARD_LOSS):
            Debit: Inventory Loss & Shrinkage (5040) = Total Deficit Value
            Credit: Inventory Asset (1040) = Total Deficit Value
        Surplus (Physical > System, INWARD_SURPLUS):
            Debit: Inventory Asset (1040) = Total Surplus Value
            Credit: Discounts Received / Other Income (4020) = Total Surplus Value
        """
        stmt = select(StockAudit).where(StockAudit.id == audit_id, StockAudit.company_id == company_id).options(selectinload(StockAudit.items))
        audit = (await session.execute(stmt)).scalar_one_or_none()
        if not audit:
            raise HTTPException(status_code=404, detail=f"Stock audit {audit_id} not found.")

        await cls.seed_default_chart_of_accounts(session, company_id, branch_id)

        acc_inventory = await cls.get_account_by_code(session, company_id, "1040")
        acc_loss = await cls.get_account_by_code(session, company_id, "5040")
        acc_income = await cls.get_account_by_code(session, company_id, "4020")

        total_deficit_val = Decimal("0.00")
        total_surplus_val = Decimal("0.00")

        for item in (audit.items or []):
            var_qty = Decimal(str(item.variance_qty or 0.00))
            u_cost = Decimal(str(item.unit_cost or 0.00))
            line_val = Decimal(str(item.variance_value or (var_qty * u_cost))).quantize(Decimal("0.01"))

            if var_qty < 0:
                total_deficit_val += abs(line_val)
            elif var_qty > 0:
                total_surplus_val += abs(line_val)

        lines = []

        if total_deficit_val > Decimal("0.00"):
            lines.append({
                "account_id": acc_loss.id,
                "debit_amount": total_deficit_val,
                "credit_amount": Decimal("0.00"),
                "remarks": f"Physical inventory shrinkage write-off for Audit {audit.audit_no}"
            })
            lines.append({
                "account_id": acc_inventory.id,
                "debit_amount": Decimal("0.00"),
                "credit_amount": total_deficit_val,
                "remarks": f"Inventory Asset reduction for Audit {audit.audit_no}"
            })

        if total_surplus_val > Decimal("0.00"):
            lines.append({
                "account_id": acc_inventory.id,
                "debit_amount": total_surplus_val,
                "credit_amount": Decimal("0.00"),
                "remarks": f"Found stock inventory addition for Audit {audit.audit_no}"
            })
            lines.append({
                "account_id": acc_income.id,
                "debit_amount": Decimal("0.00"),
                "credit_amount": total_surplus_val,
                "remarks": f"Surplus stock recognition for Audit {audit.audit_no}"
            })

        if not lines:
            return None

        audit_dt = getattr(audit, "reconciled_at", None) or getattr(audit, "created_at", None)
        v_date = audit_dt.date() if isinstance(audit_dt, datetime) else (audit_dt or date.today())

        return await cls.post_journal_voucher(
            session=session,
            company_id=company_id,
            branch_id=branch_id or audit.branch_id,
            voucher_type="STOCK_ADJUSTMENT",
            voucher_date=v_date,
            lines=lines,
            reference_doc_type="STOCK_AUDIT",
            reference_doc_id=audit.id,
            reference_doc_no=audit.audit_no,
            narration=f"Automated GL stock adjustment for Audit {audit.audit_no}"
        )

    @classmethod
    async def post_shift_close_to_gl(
        cls,
        session: AsyncSession,
        company_id: str,
        shift_id: str,
        branch_id: Optional[str] = None,
        created_by: Optional[str] = None
    ) -> Optional[JournalVoucher]:
        """
        Translates a closed POS Register Shift / Z-Report into an authoritative double-entry GL voucher.
        Balances cash tender variance (physical cash drawer count vs expected cash total):
        Cash Shortage (variance < 0):
            Debit: Cash Register Shortage (5070) = |variance|
            Credit: Cash in Hand (1010) = |variance|
        Cash Overage (variance > 0):
            Debit: Cash in Hand (1010) = variance
            Credit: Cash Register Overage (4050) = variance
        Zero Variance (variance == 0):
            Returns None (Cash already perfectly aligned by individual invoice postings).
        """
        stmt = select(Shift).where(Shift.id == shift_id, Shift.company_id == company_id, Shift.is_deleted == False)
        shift = (await session.execute(stmt)).scalar_one_or_none()
        if not shift:
            raise HTTPException(status_code=404, detail=f"Shift {shift_id} not found.")

        if shift.status != "CLOSED":
            raise HTTPException(status_code=400, detail="Cannot post GL voucher for an unclosed shift. Close shift first.")

        # Idempotency check: check if already posted for this shift
        existing_stmt = select(JournalVoucher).where(
            JournalVoucher.company_id == company_id,
            JournalVoucher.reference_doc_type == "POS_SHIFT",
            JournalVoucher.reference_doc_id == shift.id,
            JournalVoucher.is_deleted == False
        )
        existing_v = (await session.execute(existing_stmt)).scalar_one_or_none()
        if existing_v:
            return existing_v

        variance = Decimal(str(shift.variance or 0.00)).quantize(Decimal("0.01"))
        if abs(variance) < Decimal("0.01"):
            return None  # Zero cash variance; GL cash drawer balance matches physical count perfectly

        await cls.seed_default_chart_of_accounts(session, company_id, branch_id)

        acc_cash = await cls.get_account_by_code(session, company_id, "1010")
        acc_overage = await cls.get_account_by_code(session, company_id, "4050")
        acc_shortage = await cls.get_account_by_code(session, company_id, "5070")

        lines = []
        if variance < 0:
            # Shortage: Cash counted is less than expected -> Debit Shortage Expense, Credit Cash
            shortage_amt = abs(variance)
            lines = [
                {
                    "account_id": acc_shortage.id,
                    "debit_amount": shortage_amt,
                    "credit_amount": Decimal("0.00"),
                    "remarks": f"Cash drawer shortage on Register {shift.register_id} Shift {shift.id}"
                },
                {
                    "account_id": acc_cash.id,
                    "debit_amount": Decimal("0.00"),
                    "credit_amount": shortage_amt,
                    "remarks": f"Cash drawer shortage adjustment on Register {shift.register_id}"
                }
            ]
        else:
            # Overage: Cash counted is more than expected -> Debit Cash, Credit Overage Income
            overage_amt = variance
            lines = [
                {
                    "account_id": acc_cash.id,
                    "debit_amount": overage_amt,
                    "credit_amount": Decimal("0.00"),
                    "remarks": f"Cash drawer surplus on Register {shift.register_id} Shift {shift.id}"
                },
                {
                    "account_id": acc_overage.id,
                    "debit_amount": Decimal("0.00"),
                    "credit_amount": overage_amt,
                    "remarks": f"Cash drawer surplus adjustment on Register {shift.register_id}"
                }
            ]

        opened_str = shift.opened_at.strftime('%Y%m%d%H%M') if shift.opened_at else shift.id[:8]
        voucher_date = shift.closed_at.date() if shift.closed_at else date.today()

        return await cls.post_journal_voucher(
            session=session,
            company_id=company_id,
            branch_id=branch_id or shift.branch_id,
            voucher_type="SHIFT_CLOSE",
            voucher_date=voucher_date,
            lines=lines,
            reference_doc_type="POS_SHIFT",
            reference_doc_id=shift.id,
            reference_doc_no=f"ZREPORT-{shift.register_id}-{opened_str}",
            narration=f"ProPOS Shift Close & Z-Report balancing for Register {shift.register_id} (Expected: ₹{shift.expected_cash}, Counted: ₹{shift.closing_balance}, Variance: ₹{shift.variance})",
            created_by=created_by or shift.cashier_id or "pos_shift_engine"
        )


    @classmethod
    async def generate_period_balance_snapshot(
        cls,
        session: AsyncSession,
        company_id: str,
        period_date: date,
        branch_id: Optional[str] = None
    ) -> List[AccountBalanceSnapshot]:
        """
        Calculates and persists closing account balance snapshots for high-speed reporting.
        """
        await cls.seed_default_chart_of_accounts(session, company_id, branch_id)

        # Get all active accounts
        acc_stmt = select(Account).where(Account.company_id == company_id, Account.is_deleted == False)
        accounts = (await session.execute(acc_stmt)).scalars().all()

        # Aggregated totals as of period_date
        stmt = (
            select(
                GeneralLedgerEntry.account_id,
                func.coalesce(func.sum(GeneralLedgerEntry.debit_amount), 0).label("closing_debit"),
                func.coalesce(func.sum(GeneralLedgerEntry.credit_amount), 0).label("closing_credit")
            )
            .where(
                GeneralLedgerEntry.company_id == company_id,
                GeneralLedgerEntry.is_deleted == False,
                GeneralLedgerEntry.entry_date <= period_date
            )
            .group_by(GeneralLedgerEntry.account_id)
        )
        totals = {r.account_id: (Decimal(str(r.closing_debit)), Decimal(str(r.closing_credit))) for r in (await session.execute(stmt)).all()}

        snapshots: List[AccountBalanceSnapshot] = []

        for acc in accounts:
            closing_debit, closing_credit = totals.get(acc.id, (Decimal("0.00"), Decimal("0.00")))
            net_balance = (closing_debit - closing_credit).quantize(Decimal("0.01"))

            # Check existing snapshot
            snap_stmt = select(AccountBalanceSnapshot).where(
                AccountBalanceSnapshot.company_id == company_id,
                AccountBalanceSnapshot.account_id == acc.id,
                AccountBalanceSnapshot.period_date == period_date
            )
            snapshot = (await session.execute(snap_stmt)).scalar_one_or_none()

            if snapshot:
                snapshot.closing_debit = closing_debit
                snapshot.closing_credit = closing_credit
                snapshot.net_balance = net_balance
            else:
                snapshot = AccountBalanceSnapshot(
                    id=f"snap_{uuid.uuid4().hex[:12]}",
                    uuid=str(uuid.uuid4()),
                    company_id=company_id,
                    branch_id=branch_id,
                    account_id=acc.id,
                    period_date=period_date,
                    opening_debit=Decimal("0.00"),
                    opening_credit=Decimal("0.00"),
                    closing_debit=closing_debit,
                    closing_credit=closing_credit,
                    net_balance=net_balance
                )
                session.add(snapshot)

            snapshots.append(snapshot)

        await session.flush()
        return snapshots

    @classmethod
    async def assert_fiscal_period_open(
        cls,
        session: AsyncSession,
        company_id: str,
        voucher_date: date
    ) -> None:
        """
        Guarantees that the posting date belongs to an OPEN fiscal period.
        Rejects vouchers falling in HARD_LOCKED or CLOSED periods with HTTP 400 (SMRITI-GL-006).
        """
        stmt = (
            select(FiscalPeriod)
            .where(
                FiscalPeriod.company_id == company_id,
                FiscalPeriod.start_date <= voucher_date,
                FiscalPeriod.end_date >= voucher_date,
                FiscalPeriod.is_deleted == False
            )
        )
        period = (await session.execute(stmt)).scalars().first()
        if period and period.status in ["HARD_LOCKED", "CLOSED"]:
            raise HTTPException(
                status_code=400,
                detail=f"SMRITI-GL-006: Accounting period '{period.period_name}' is {period.status} for date {voucher_date}. Backdating and modifications are strictly prohibited."
            )

    @classmethod
    async def create_fiscal_year_with_periods(
        cls,
        session: AsyncSession,
        company_id: str,
        start_date: date,
        end_date: date,
        code: Optional[str] = None,
        branch_id: Optional[str] = None
    ) -> FiscalYear:
        """
        Creates an authoritative Financial Year and partitions it into 12 monthly Fiscal Periods.
        """
        fy_code = code or f"FY{start_date.year}-{str(end_date.year)[-2:]}"

        stmt = select(FiscalYear).where(FiscalYear.company_id == company_id, FiscalYear.financial_year_code == fy_code)
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if existing:
            return existing

        fy = FiscalYear(
            id=f"fy_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            branch_id=branch_id,
            financial_year_code=fy_code,
            start_date=start_date,
            end_date=end_date,
            is_closed=False,
            is_locked=False
        )
        session.add(fy)
        await session.flush()

        # Generate monthly periods
        cur_start = start_date
        month_names = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"]

        for i in range(1, 13):
            # Calculate month end
            if cur_start.month == 12:
                next_month = cur_start.replace(year=cur_start.year + 1, month=1, day=1)
            else:
                next_month = cur_start.replace(month=cur_start.month + 1, day=1)
            cur_end = min(next_month - timedelta(days=1), end_date)

            p_name = f"{month_names[i - 1]} {cur_start.year}" if i <= len(month_names) else f"Period {i}"

            period = FiscalPeriod(
                id=f"fp_{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                company_id=company_id,
                branch_id=branch_id,
                fiscal_year_id=fy.id,
                period_name=p_name,
                period_number=i,
                start_date=cur_start,
                end_date=cur_end,
                status="OPEN"
            )
            session.add(period)

            cur_start = cur_end + timedelta(days=1)
            if cur_start > end_date:
                break

        await session.flush()
        return fy

    @classmethod
    async def lock_fiscal_period(
        cls,
        session: AsyncSession,
        company_id: str,
        period_id: str,
        lock_status: str = "HARD_LOCKED",
        closed_by: Optional[str] = "admin"
    ) -> FiscalPeriod:
        """
        Transitions a fiscal period to SOFT_CLOSED or HARD_LOCKED to prevent modifications.
        """
        stmt = select(FiscalPeriod).where(FiscalPeriod.id == period_id, FiscalPeriod.company_id == company_id)
        period = (await session.execute(stmt)).scalar_one_or_none()
        if not period:
            raise HTTPException(status_code=404, detail=f"Fiscal period {period_id} not found.")

        period.status = lock_status
        period.closed_at = datetime.now(timezone.utc)
        period.closed_by = closed_by
        await session.flush()
        return period

    @classmethod
    async def import_bank_statement(
        cls,
        session: AsyncSession,
        company_id: str,
        bank_account_id: str,
        statement_no: str,
        from_date: date,
        to_date: date,
        opening_balance: Decimal,
        closing_balance: Decimal,
        lines: List[Dict[str, Any]],
        statement_date: Optional[date] = None,
        branch_id: Optional[str] = None
    ) -> BankStatement:
        """
        Ingests a bank statement with discrete transaction lines for automated reconciliation.
        """
        statement = BankStatement(
            id=f"bs_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            branch_id=branch_id,
            bank_account_id=bank_account_id,
            statement_no=statement_no,
            statement_date=statement_date or date.today(),
            from_date=from_date,
            to_date=to_date,
            opening_balance=opening_balance,
            closing_balance=closing_balance,
            is_reconciled=False
        )
        session.add(statement)
        await session.flush()

        for idx, line in enumerate(lines, start=1):
            t_date = line.get("transaction_date") or date.today()
            v_date = line.get("value_date") or t_date
            dep = Decimal(str(line.get("deposit_amount", 0.00))).quantize(Decimal("0.01"))
            wdr = Decimal(str(line.get("withdrawal_amount", 0.00))).quantize(Decimal("0.01"))

            bs_line = BankStatementLine(
                id=f"bsl_{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                company_id=company_id,
                branch_id=branch_id,
                statement_id=statement.id,
                line_number=idx,
                transaction_date=t_date,
                value_date=v_date,
                reference_no=line.get("reference_no"),
                description=line.get("description"),
                deposit_amount=dep,
                withdrawal_amount=wdr,
                balance_after_transaction=line.get("balance_after_transaction"),
                reconciliation_status="UNMATCHED"
            )
            session.add(bs_line)

        await session.flush()
        return statement

    @classmethod
    async def auto_reconcile_bank_statement(
        cls,
        session: AsyncSession,
        company_id: str,
        statement_id: str
    ) -> Dict[str, Any]:
        """
        Performs automated two-way matching between bank statement lines and GL entries.
        Matches by amount and date tolerance (+/- 5 days).
        """
        stmt = select(BankStatement).where(BankStatement.id == statement_id, BankStatement.company_id == company_id).options(selectinload(BankStatement.lines))
        statement = (await session.execute(stmt)).scalar_one_or_none()
        if not statement:
            raise HTTPException(status_code=404, detail=f"Bank statement {statement_id} not found.")

        matched_count = 0
        unmatched_count = 0
        now_utc = datetime.now(timezone.utc)

        # Retrieve already reconciled GL entries to avoid double matching
        reconciled_gle_stmt = select(BankStatementLine.reconciled_gl_entry_id).where(
            BankStatementLine.company_id == company_id,
            BankStatementLine.reconciled_gl_entry_id.isnot(None)
        )
        used_gle_ids = set((await session.execute(reconciled_gle_stmt)).scalars().all())

        for line in statement.lines:
            if line.reconciliation_status in ["AUTO_RECONCILED", "MANUALLY_CLEARED"]:
                matched_count += 1
                continue

            date_min = line.transaction_date - timedelta(days=5)
            date_max = line.transaction_date + timedelta(days=5)

            if line.deposit_amount > Decimal("0.00"):
                # Bank Deposit = Book Debit to Bank Account
                gle_stmt = (
                    select(GeneralLedgerEntry)
                    .where(
                        GeneralLedgerEntry.company_id == company_id,
                        GeneralLedgerEntry.account_id == statement.bank_account_id,
                        GeneralLedgerEntry.debit_amount == line.deposit_amount,
                        GeneralLedgerEntry.entry_date >= date_min,
                        GeneralLedgerEntry.entry_date <= date_max,
                        GeneralLedgerEntry.is_deleted == False
                    )
                )
                candidates = (await session.execute(gle_stmt)).scalars().all()
                match = next((c for c in candidates if c.id not in used_gle_ids), None)

                if match:
                    line.reconciled_gl_entry_id = match.id
                    line.reconciliation_status = "AUTO_RECONCILED"
                    line.cleared_at = now_utc
                    used_gle_ids.add(match.id)
                    matched_count += 1
                else:
                    unmatched_count += 1

            elif line.withdrawal_amount > Decimal("0.00"):
                # Bank Withdrawal = Book Credit to Bank Account
                gle_stmt = (
                    select(GeneralLedgerEntry)
                    .where(
                        GeneralLedgerEntry.company_id == company_id,
                        GeneralLedgerEntry.account_id == statement.bank_account_id,
                        GeneralLedgerEntry.credit_amount == line.withdrawal_amount,
                        GeneralLedgerEntry.entry_date >= date_min,
                        GeneralLedgerEntry.entry_date <= date_max,
                        GeneralLedgerEntry.is_deleted == False
                    )
                )
                candidates = (await session.execute(gle_stmt)).scalars().all()
                match = next((c for c in candidates if c.id not in used_gle_ids), None)

                if match:
                    line.reconciled_gl_entry_id = match.id
                    line.reconciliation_status = "AUTO_RECONCILED"
                    line.cleared_at = now_utc
                    used_gle_ids.add(match.id)
                    matched_count += 1
                else:
                    unmatched_count += 1

        if unmatched_count == 0 and len(statement.lines) > 0:
            statement.is_reconciled = True
            statement.reconciled_at = now_utc

        await session.flush()

        return {
            "statement_id": statement.id,
            "total_lines": len(statement.lines),
            "matched_lines": matched_count,
            "unmatched_lines": unmatched_count,
            "is_fully_reconciled": statement.is_reconciled
        }

    @classmethod
    async def get_bank_reconciliation_statement(
        cls,
        session: AsyncSession,
        company_id: str,
        bank_account_id: str,
        as_of_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Generates an authoritative Bank Reconciliation Statement (BRS).
        Calculates:
            Balance as per Company Books
            + Unpresented Cheques / Withdrawals (credited in books, not in bank)
            - Deposits in Transit / Uncredited (debited in books, not in bank)
            = Reconciled Balance (Compared against Bank Statement Balance)
        """
        cut_off = as_of_date or date.today()

        # 1. Balance as per Books (GL Debits - Credits)
        gl_stmt = (
            select(
                func.coalesce(func.sum(GeneralLedgerEntry.debit_amount), 0).label("book_debit"),
                func.coalesce(func.sum(GeneralLedgerEntry.credit_amount), 0).label("book_credit")
            )
            .where(
                GeneralLedgerEntry.company_id == company_id,
                GeneralLedgerEntry.account_id == bank_account_id,
                GeneralLedgerEntry.entry_date <= cut_off,
                GeneralLedgerEntry.is_deleted == False
            )
        )
        gl_row = (await session.execute(gl_stmt)).one()
        book_debit = Decimal(str(gl_row.book_debit))
        book_credit = Decimal(str(gl_row.book_credit))
        book_balance = (book_debit - book_credit).quantize(Decimal("0.01"))

        # 2. Latest Bank Statement as of cut_off
        bs_stmt = (
            select(BankStatement)
            .where(
                BankStatement.company_id == company_id,
                BankStatement.bank_account_id == bank_account_id,
                BankStatement.to_date <= cut_off
            )
            .order_by(BankStatement.to_date.desc())
            .limit(1)
        )
        statement = (await session.execute(bs_stmt)).scalar_one_or_none()
        bank_statement_balance = Decimal(str(statement.closing_balance if statement else "0.00")).quantize(Decimal("0.01"))

        # 3. Uncredited Deposits (GL debits with no cleared statement line)
        reconciled_subquery = (
            select(BankStatementLine.reconciled_gl_entry_id)
            .where(
                BankStatementLine.company_id == company_id,
                BankStatementLine.reconciliation_status.in_(["AUTO_RECONCILED", "MANUALLY_CLEARED"]),
                BankStatementLine.reconciled_gl_entry_id.isnot(None)
            )
        )

        uncredited_stmt = (
            select(func.coalesce(func.sum(GeneralLedgerEntry.debit_amount), 0))
            .where(
                GeneralLedgerEntry.company_id == company_id,
                GeneralLedgerEntry.account_id == bank_account_id,
                GeneralLedgerEntry.debit_amount > 0,
                GeneralLedgerEntry.entry_date <= cut_off,
                GeneralLedgerEntry.is_deleted == False,
                GeneralLedgerEntry.id.notin_(reconciled_subquery)
            )
        )
        uncredited_deposits = Decimal(str((await session.execute(uncredited_stmt)).scalar() or "0.00")).quantize(Decimal("0.01"))

        # 4. Unpresented Cheques / Withdrawals (GL credits with no cleared statement line)
        unpresented_stmt = (
            select(func.coalesce(func.sum(GeneralLedgerEntry.credit_amount), 0))
            .where(
                GeneralLedgerEntry.company_id == company_id,
                GeneralLedgerEntry.account_id == bank_account_id,
                GeneralLedgerEntry.credit_amount > 0,
                GeneralLedgerEntry.entry_date <= cut_off,
                GeneralLedgerEntry.is_deleted == False,
                GeneralLedgerEntry.id.notin_(reconciled_subquery)
            )
        )
        unpresented_cheques = Decimal(str((await session.execute(unpresented_stmt)).scalar() or "0.00")).quantize(Decimal("0.01"))

        # Reconciled Bank Balance formula:
        # Bank Balance = Book Balance - Uncredited Deposits + Unpresented Cheques
        reconciled_balance = (book_balance - uncredited_deposits + unpresented_cheques).quantize(Decimal("0.01"))
        difference = (bank_statement_balance - reconciled_balance).quantize(Decimal("0.01"))

        return {
            "company_id": company_id,
            "bank_account_id": bank_account_id,
            "as_of_date": cut_off.isoformat(),
            "book_balance": float(book_balance),
            "bank_statement_balance": float(bank_statement_balance),
            "uncredited_deposits": float(uncredited_deposits),
            "unpresented_cheques": float(unpresented_cheques),
            "reconciled_balance": float(reconciled_balance),
            "difference": float(difference),
            "is_balanced": abs(difference) <= Decimal("0.01")
        }

    # ─────────────────────────── Multi-Currency & FX Engine ───────────────────────────

    @classmethod
    async def set_exchange_rate(
        cls,
        session: AsyncSession,
        company_id: str,
        from_currency: str,
        to_currency: str = "INR",
        exchange_rate: Decimal = Decimal("1.000000"),
        effective_date: Optional[date] = None,
        rate_type: str = "SPOT",
        source: str = "MANUAL",
        branch_id: Optional[str] = None
    ) -> CurrencyExchangeRate:
        """
        Upserts an authoritative currency exchange rate.
        Enforces 3-letter ISO codes, currency disparity, valid rate types, and positive bounds.
        """
        eff_date = effective_date or date.today()
        from_curr = cls.validate_currency_code(from_currency)
        to_curr = cls.validate_currency_code(to_currency)

        if from_curr == to_curr:
            raise HTTPException(
                status_code=400,
                detail="SMRITI-GL-011: Exchange rate cannot be defined between identical currencies."
            )

        if rate_type not in ("SPOT", "CLOSING", "AVERAGE", "CUSTOM"):
            raise HTTPException(
                status_code=400,
                detail=f"SMRITI-VAL-003: Invalid rate_type '{rate_type}'. Must be SPOT, CLOSING, AVERAGE, or CUSTOM."
            )

        rate_val = Decimal(str(exchange_rate))
        if rate_val <= 0 or rate_val > Decimal("100000000.000000"):
            raise HTTPException(
                status_code=400,
                detail="SMRITI-GL-008: Currency exchange rate must be strictly positive (> 0) and <= 100,000,000."
            )

        stmt = select(CurrencyExchangeRate).where(
            CurrencyExchangeRate.company_id == company_id,
            CurrencyExchangeRate.from_currency == from_curr,
            CurrencyExchangeRate.to_currency == to_curr,
            CurrencyExchangeRate.effective_date == eff_date,
            CurrencyExchangeRate.rate_type == rate_type,
            CurrencyExchangeRate.is_deleted == False
        )
        existing = (await session.execute(stmt)).scalar_one_or_none()

        if existing:
            existing.exchange_rate = rate_val
            existing.source = source
            await session.flush()
            return existing

        rate_obj = CurrencyExchangeRate(
            id=f"fx_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            branch_id=branch_id,
            from_currency=from_curr,
            to_currency=to_curr,
            exchange_rate=rate_val,
            effective_date=eff_date,
            rate_type=rate_type,
            source=source
        )
        session.add(rate_obj)
        await session.flush()
        return rate_obj

    @classmethod
    async def get_exchange_rate(
        cls,
        session: AsyncSession,
        company_id: str,
        from_currency: str,
        to_currency: str = "INR",
        as_of_date: Optional[date] = None,
        rate_type: str = "SPOT"
    ) -> Decimal:
        """
        Resolves the most recent applicable exchange rate on or before the given date.
        """
        from_curr = cls.validate_currency_code(from_currency)
        to_curr = cls.validate_currency_code(to_currency)
        if from_curr == to_curr:
            return Decimal("1.000000")

        eff_date = as_of_date or date.today()

        stmt = (
            select(CurrencyExchangeRate.exchange_rate)
            .where(
                CurrencyExchangeRate.company_id == company_id,
                CurrencyExchangeRate.from_currency == from_curr,
                CurrencyExchangeRate.to_currency == to_curr,
                CurrencyExchangeRate.rate_type == rate_type,
                CurrencyExchangeRate.effective_date <= eff_date,
                CurrencyExchangeRate.is_deleted == False
            )
            .order_by(CurrencyExchangeRate.effective_date.desc())
            .limit(1)
        )
        rate = (await session.execute(stmt)).scalar_one_or_none()
        if rate is not None:
            return Decimal(str(rate))

        raise HTTPException(
            status_code=400,
            detail=f"SMRITI-GL-007: No exchange rate configured for currency pair '{from_curr}/{to_curr}' as of {eff_date.isoformat()}."
        )

    @classmethod
    async def reconcile_foreign_settlement_fx(
        cls,
        session: AsyncSession,
        company_id: str,
        invoice_voucher_id: str,
        payment_voucher_id: str,
        settled_foreign_amount: Decimal,
        party_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        created_by: Optional[str] = None
    ) -> Optional[JournalVoucher]:
        """
        Calculates and posts Realized Foreign Exchange Gain / Loss upon foreign invoice settlement.
        Enforces settlement allocation limits, document validation, and idempotency protection.
        """
        foreign_amt = Decimal(str(settled_foreign_amount)).quantize(Decimal("0.01"))
        if foreign_amt <= 0:
            raise HTTPException(status_code=400, detail="SMRITI-VAL-004: Settled foreign amount must be strictly positive.")

        inv_stmt = select(JournalVoucher).where(
            JournalVoucher.id == invoice_voucher_id,
            JournalVoucher.company_id == company_id,
            JournalVoucher.is_deleted == False
        )
        invoice_voucher = (await session.execute(inv_stmt)).scalar_one_or_none()
        if not invoice_voucher:
            raise HTTPException(status_code=404, detail=f"SMRITI-GL-404: Invoice voucher '{invoice_voucher_id}' not found.")

        pay_stmt = select(JournalVoucher).where(
            JournalVoucher.id == payment_voucher_id,
            JournalVoucher.company_id == company_id,
            JournalVoucher.is_deleted == False
        )
        payment_voucher = (await session.execute(pay_stmt)).scalar_one_or_none()
        if not payment_voucher:
            raise HTTPException(status_code=404, detail=f"SMRITI-GL-404: Payment voucher '{payment_voucher_id}' not found.")

        # Currency consistency check
        if invoice_voucher.currency != payment_voucher.currency:
            raise HTTPException(
                status_code=400,
                detail=f"SMRITI-GL-014: Currency mismatch between invoice ({invoice_voucher.currency}) and payment ({payment_voucher.currency}) vouchers."
            )

        # Over-settlement boundary protection
        max_inv_foreign = max(invoice_voucher.total_foreign_debit, invoice_voucher.total_foreign_credit)
        max_pay_foreign = max(payment_voucher.total_foreign_debit, payment_voucher.total_foreign_credit)
        if foreign_amt > max_inv_foreign or foreign_amt > max_pay_foreign:
            raise HTTPException(
                status_code=400,
                detail=f"SMRITI-GL-009: Settled foreign amount ({foreign_amt}) exceeds invoice foreign limit ({max_inv_foreign}) or payment limit ({max_pay_foreign})."
            )

        # Idempotency check: check if realization voucher already posted for this pair
        pair_ref_id = f"{invoice_voucher_id}:{payment_voucher_id}"
        existing_fx_stmt = select(JournalVoucher).where(
            JournalVoucher.company_id == company_id,
            JournalVoucher.voucher_type == "FX_REALIZATION",
            JournalVoucher.reference_doc_id == pair_ref_id,
            JournalVoucher.is_deleted == False
        )
        existing_fx = (await session.execute(existing_fx_stmt)).scalars().all()
        if existing_fx:
            return existing_fx[0]

        booking_rate = Decimal(str(invoice_voucher.exchange_rate))
        settlement_rate = Decimal(str(payment_voucher.exchange_rate))

        booking_base = (foreign_amt * booking_rate).quantize(Decimal("0.01"))
        settlement_base = (foreign_amt * settlement_rate).quantize(Decimal("0.01"))
        fx_diff = (settlement_base - booking_base).quantize(Decimal("0.01"))

        if abs(fx_diff) < Decimal("0.01"):
            return None  # Zero realized difference

        await cls.seed_default_chart_of_accounts(session, company_id, branch_id)
        acc_debtors = await cls.get_account_by_code(session, company_id, "1030")
        acc_creditors = await cls.get_account_by_code(session, company_id, "2010")
        acc_fx_gain = await cls.get_account_by_code(session, company_id, "4030")
        acc_fx_loss = await cls.get_account_by_code(session, company_id, "5050")

        is_sales = invoice_voucher.voucher_type in ("SALES_INVOICE", "JOURNAL") and not invoice_voucher.voucher_type.startswith("PURCHASE")
        lines = []

        if is_sales:
            # Customer / Debtors Settlement
            if fx_diff > 0:
                # Realized Gain: Received more INR => Debit Debtors, Credit FX Gain
                gain_amt = fx_diff
                lines = [
                    {"account_id": acc_debtors.id, "party_id": party_id, "debit_amount": gain_amt, "credit_amount": Decimal("0.00"), "remarks": f"Realized FX Gain on {invoice_voucher.voucher_no}"},
                    {"account_id": acc_fx_gain.id, "debit_amount": Decimal("0.00"), "credit_amount": gain_amt, "remarks": f"Realized FX Gain on {invoice_voucher.voucher_no}"}
                ]
            else:
                # Realized Loss: Received less INR => Debit FX Loss, Credit Debtors
                loss_amt = abs(fx_diff)
                lines = [
                    {"account_id": acc_fx_loss.id, "debit_amount": loss_amt, "credit_amount": Decimal("0.00"), "remarks": f"Realized FX Loss on {invoice_voucher.voucher_no}"},
                    {"account_id": acc_debtors.id, "party_id": party_id, "debit_amount": Decimal("0.00"), "credit_amount": loss_amt, "remarks": f"Realized FX Loss on {invoice_voucher.voucher_no}"}
                ]
        else:
            # Supplier / Creditors Settlement
            if fx_diff < 0:
                # Realized Gain: Paid less INR => Debit Creditors, Credit FX Gain
                gain_amt = abs(fx_diff)
                lines = [
                    {"account_id": acc_creditors.id, "party_id": party_id, "debit_amount": gain_amt, "credit_amount": Decimal("0.00"), "remarks": f"Realized FX Gain on {invoice_voucher.voucher_no}"},
                    {"account_id": acc_fx_gain.id, "debit_amount": Decimal("0.00"), "credit_amount": gain_amt, "remarks": f"Realized FX Gain on {invoice_voucher.voucher_no}"}
                ]
            else:
                # Realized Loss: Paid more INR => Debit FX Loss, Credit Creditors
                loss_amt = fx_diff
                lines = [
                    {"account_id": acc_fx_loss.id, "debit_amount": loss_amt, "credit_amount": Decimal("0.00"), "remarks": f"Realized FX Loss on {invoice_voucher.voucher_no}"},
                    {"account_id": acc_creditors.id, "party_id": party_id, "debit_amount": Decimal("0.00"), "credit_amount": loss_amt, "remarks": f"Realized FX Loss on {invoice_voucher.voucher_no}"}
                ]

        narration = f"Automated Realized FX Settlement Difference for {invoice_voucher.voucher_no} vs {payment_voucher.voucher_no}"
        return await cls.post_journal_voucher(
            session=session,
            company_id=company_id,
            branch_id=branch_id,
            voucher_type="FX_REALIZATION",
            voucher_date=payment_voucher.voucher_date,
            lines=lines,
            reference_doc_type="PAYMENT_SETTLEMENT",
            reference_doc_id=pair_ref_id,
            reference_doc_no=f"FX-SETTLE-{invoice_voucher.voucher_no}-{payment_voucher.voucher_no}",
            narration=narration,
            created_by=created_by or "system_fx_engine"
        )

    @classmethod
    async def calculate_unrealized_fx_revaluation(
        cls,
        session: AsyncSession,
        company_id: str,
        as_of_date: date,
        closing_rates: Dict[str, Decimal],
        branch_id: Optional[str] = None,
        created_by: Optional[str] = None,
        allow_overwrite: bool = False
    ) -> Dict[str, Any]:
        """
        Mark-to-Market (MTM) periodic revaluation of open foreign balances at closing rates.
        Posts unrealized gain/loss to Account 4040 or 5060.
        Enforces fiscal period lockouts and periodic run idempotency.
        """
        await cls.assert_fiscal_period_open(session, company_id, as_of_date)

        # Idempotency check: look for existing revaluation voucher for this company and date
        mtm_ref_no = f"MTM-{company_id}-{as_of_date.isoformat()}"
        existing_stmt = select(JournalVoucher).where(
            JournalVoucher.company_id == company_id,
            JournalVoucher.voucher_type == "FX_UNREALIZED_MTM",
            JournalVoucher.reference_doc_no == mtm_ref_no,
            JournalVoucher.is_deleted == False
        )
        existing_v = (await session.execute(existing_stmt)).scalar_one_or_none()
        if existing_v and not allow_overwrite:
            return {
                "company_id": company_id,
                "as_of_date": as_of_date.isoformat(),
                "total_unrealized_gain": float(existing_v.total_credit),
                "total_unrealized_loss": float(existing_v.total_debit),
                "revaluation_voucher_id": existing_v.id,
                "revaluation_voucher_no": existing_v.voucher_no,
                "is_idempotent_cached": True
            }
        elif existing_v and allow_overwrite:
            existing_v.is_deleted = True
            existing_v.is_posted = False
            await session.flush()

        await cls.seed_default_chart_of_accounts(session, company_id, branch_id)
        acc_debtors = await cls.get_account_by_code(session, company_id, "1030")
        acc_creditors = await cls.get_account_by_code(session, company_id, "2010")
        acc_unrealized_gain = await cls.get_account_by_code(session, company_id, "4040")
        acc_unrealized_loss = await cls.get_account_by_code(session, company_id, "5060")

        # Aggregate foreign currency balances for debtors and creditors
        stmt = (
            select(
                GeneralLedgerEntry.account_id,
                GeneralLedgerEntry.party_id,
                GeneralLedgerEntry.foreign_currency,
                func.sum(GeneralLedgerEntry.foreign_debit_amount - GeneralLedgerEntry.foreign_credit_amount).label("net_foreign"),
                func.sum(GeneralLedgerEntry.debit_amount - GeneralLedgerEntry.credit_amount).label("net_base")
            )
            .where(
                GeneralLedgerEntry.company_id == company_id,
                GeneralLedgerEntry.entry_date <= as_of_date,
                GeneralLedgerEntry.foreign_currency != "INR",
                GeneralLedgerEntry.is_deleted == False,
                GeneralLedgerEntry.account_id.in_([acc_debtors.id, acc_creditors.id])
            )
            .group_by(GeneralLedgerEntry.account_id, GeneralLedgerEntry.party_id, GeneralLedgerEntry.foreign_currency)
        )
        rows = (await session.execute(stmt)).all()

        reval_lines = []
        total_mtm_gain = Decimal("0.00")
        total_mtm_loss = Decimal("0.00")

        for r in rows:
            acc_id = r.account_id
            curr = r.foreign_currency
            net_foreign = Decimal(str(r.net_foreign or 0))
            net_base = Decimal(str(r.net_base or 0))

            if abs(net_foreign) < Decimal("0.01"):
                continue

            closing_rate = closing_rates.get(curr)
            if not closing_rate:
                continue

            closing_rate = Decimal(str(closing_rate))
            revalued_base = (net_foreign * closing_rate).quantize(Decimal("0.01"))
            diff = (revalued_base - net_base).quantize(Decimal("0.01"))

            if abs(diff) < Decimal("0.01"):
                continue

            if acc_id == acc_debtors.id:
                # Debtors asset revaluation
                if diff > 0:
                    # Unrealized Gain: Debit Debtors, Credit Unrealized Gain
                    reval_lines.append({"account_id": acc_debtors.id, "party_id": r.party_id, "debit_amount": diff, "credit_amount": Decimal("0.00")})
                    total_mtm_gain += diff
                else:
                    # Unrealized Loss: Debit Unrealized Loss, Credit Debtors
                    loss_amt = abs(diff)
                    reval_lines.append({"account_id": acc_debtors.id, "party_id": r.party_id, "debit_amount": Decimal("0.00"), "credit_amount": loss_amt})
                    total_mtm_loss += loss_amt
            elif acc_id == acc_creditors.id:
                # Creditors liability revaluation (liability increases when diff < 0)
                if diff < 0:
                    # Unrealized Gain for liability (INR amount owed decreases)
                    gain_amt = abs(diff)
                    reval_lines.append({"account_id": acc_creditors.id, "party_id": r.party_id, "debit_amount": gain_amt, "credit_amount": Decimal("0.00")})
                    total_mtm_gain += gain_amt
                else:
                    # Unrealized Loss for liability (INR amount owed increases)
                    reval_lines.append({"account_id": acc_creditors.id, "party_id": r.party_id, "debit_amount": Decimal("0.00"), "credit_amount": diff})
                    total_mtm_loss += diff

        voucher = None
        if total_mtm_gain > 0 or total_mtm_loss > 0:
            jv_lines = list(reval_lines)
            if total_mtm_gain > 0:
                jv_lines.append({"account_id": acc_unrealized_gain.id, "debit_amount": Decimal("0.00"), "credit_amount": total_mtm_gain})
            if total_mtm_loss > 0:
                jv_lines.append({"account_id": acc_unrealized_loss.id, "debit_amount": total_mtm_loss, "credit_amount": Decimal("0.00")})

            voucher = await cls.post_journal_voucher(
                session=session,
                company_id=company_id,
                branch_id=branch_id,
                voucher_type="FX_UNREALIZED_MTM",
                voucher_date=as_of_date,
                lines=jv_lines,
                reference_doc_type="PERIODIC_REVALUATION",
                reference_doc_no=mtm_ref_no,
                narration=f"Periodic Mark-to-Market FX Revaluation as of {as_of_date.isoformat()}",
                created_by=created_by or "system_mtm_engine"
            )

        return {
            "company_id": company_id,
            "as_of_date": as_of_date.isoformat(),
            "total_unrealized_gain": float(total_mtm_gain),
            "total_unrealized_loss": float(total_mtm_loss),
            "revaluation_voucher_id": voucher.id if voucher else None,
            "revaluation_voucher_no": voucher.voucher_no if voucher else None
        }

    @classmethod
    async def assert_voucher_immutable(cls, session: AsyncSession, voucher_id: str, company_id: str) -> None:
        """
        Enforces append-only immutable ledger policy. Posted vouchers and ledger entries cannot be mutated.
        """
        stmt = select(JournalVoucher).where(JournalVoucher.id == voucher_id, JournalVoucher.company_id == company_id)
        v = (await session.execute(stmt)).scalar_one_or_none()
        if v and v.is_posted:
            raise HTTPException(
                status_code=400,
                detail="SMRITI-GL-015: Immutable Ledger Policy: Posted journal vouchers and ledger entries cannot be modified directly. Post an authoritative reversing journal voucher."
            )




