from __future__ import annotations
"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""

from datetime import datetime, date, timezone
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy.future import select

if TYPE_CHECKING:
    from app.api.deps import TenantContext

from app.models.accounting import JournalLedgerEntryModel, JournalVoucherModel
from app.models.crm import Customer
from app.models.sales import CreditNote, SalesInvoice, SalesPayment


class ReceivablesService:
    """Derived AR engine over invoice, payment, credit note, and journal data."""

    def __init__(self, db, tenant_ctx: Optional["TenantContext"] = None):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self._sales_engine = None
        self._sales_service = None

    def _invoice_stmt(self):
        stmt = select(SalesInvoice).where(SalesInvoice.is_deleted == False)
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(SalesInvoice.company_id == self.tenant_ctx.company_id)
        if self.tenant_ctx and self.tenant_ctx.branch_id:
            stmt = stmt.where(SalesInvoice.branch_id == self.tenant_ctx.branch_id)
        return stmt

    def _credit_note_stmt(self):
        stmt = select(CreditNote).where(CreditNote.is_deleted == False)
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(CreditNote.company_id == self.tenant_ctx.company_id)
        if self.tenant_ctx and self.tenant_ctx.branch_id:
            stmt = stmt.where(CreditNote.branch_id == self.tenant_ctx.branch_id)
        return stmt

    async def _get_sales_engine(self):
        from app.sales.engine.invoicing_engine import SalesInvoicingEngine

        if not self._sales_engine:
            self._sales_engine = SalesInvoicingEngine(self.db, self.tenant_ctx)
        return self._sales_engine

    async def _get_sales_service(self):
        from app.services.sales import SalesService

        if not self._sales_service:
            self._sales_service = SalesService(self.db, self.tenant_ctx)
        return self._sales_service

    async def get_customer_statement(self, customer_id: str) -> Dict[str, Any]:
        customer_stmt = select(Customer).where(Customer.id == customer_id, Customer.is_deleted == False)
        if self.tenant_ctx and self.tenant_ctx.company_id:
            customer_stmt = customer_stmt.where(Customer.company_id == self.tenant_ctx.company_id)
        customer = (await self.db.execute(customer_stmt)).scalars().first()
        if not customer:
            raise ValueError(f"Customer '{customer_id}' not found")

        invoice_stmt = select(SalesInvoice).where(
            SalesInvoice.customer_id == customer_id,
            SalesInvoice.is_deleted == False,
        )
        if self.tenant_ctx and self.tenant_ctx.company_id:
            invoice_stmt = invoice_stmt.where(SalesInvoice.company_id == self.tenant_ctx.company_id)
        invoices = (await self.db.execute(invoice_stmt)).scalars().all()

        payment_stmt = select(SalesPayment).where(
            SalesPayment.customer_id == customer_id,
            SalesPayment.is_deleted == False,
        )
        if self.tenant_ctx and self.tenant_ctx.company_id:
            payment_stmt = payment_stmt.where(SalesPayment.company_id == self.tenant_ctx.company_id)
        payments = (await self.db.execute(payment_stmt)).scalars().all()

        credit_note_stmt = select(CreditNote).where(
            CreditNote.customer_id == customer_id,
            CreditNote.is_deleted == False,
        )
        if self.tenant_ctx and self.tenant_ctx.company_id:
            credit_note_stmt = credit_note_stmt.where(CreditNote.company_id == self.tenant_ctx.company_id)
        credit_notes = (await self.db.execute(credit_note_stmt)).scalars().all()

        total_billed = sum(Decimal(str(i.grand_total)) for i in invoices)
        total_paid = sum(Decimal(str(p.amount)) for p in payments)
        total_due = sum(Decimal(str(i.balance_due)) for i in invoices)
        total_credit_notes = sum(Decimal(str(c.grand_total)) for c in credit_notes)
        net_outstanding = max(Decimal("0.00"), total_due - total_credit_notes)

        def _normalize_date(value):
            if value is None:
                return datetime.now(timezone.utc)
            if isinstance(value, datetime):
                return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)
            if isinstance(value, date):
                return datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
            return datetime.now(timezone.utc)

        ledger_events = []
        for invoice in invoices:
            ledger_events.append(
                {
                    "date": invoice.invoice_date,
                    "document_type": "Invoice",
                    "document_no": invoice.invoice_no,
                    "debit": Decimal(str(invoice.grand_total)),
                    "credit": Decimal("0.00"),
                    "reference": invoice.invoice_no,
                }
            )
        for payment in payments:
            ledger_events.append(
                {
                    "date": payment.payment_date,
                    "document_type": "Payment",
                    "document_no": payment.payment_no,
                    "debit": Decimal("0.00"),
                    "credit": Decimal(str(payment.amount)),
                    "reference": payment.reference_no or payment.payment_no,
                }
            )
        for credit_note in credit_notes:
            ledger_events.append(
                {
                    "date": credit_note.issue_date,
                    "document_type": "Credit Note",
                    "document_no": credit_note.credit_note_no,
                    "debit": Decimal("0.00"),
                    "credit": Decimal(str(credit_note.grand_total)),
                    "reference": credit_note.invoice_id,
                }
            )

        ledger_events.sort(key=lambda x: _normalize_date(x["date"]))
        running_balance = Decimal("0.00")
        ledger = []
        for event in ledger_events:
            running_balance += event["debit"] - event["credit"]
            ledger.append(
                {
                    "date": event["date"],
                    "document_type": event["document_type"],
                    "document_no": event["document_no"],
                    "debit": event["debit"],
                    "credit": event["credit"],
                    "running_balance": running_balance,
                    "reference": event["reference"],
                }
            )

        customer_outstanding = Decimal(str(getattr(customer, "outstanding", "0.00") or "0.00"))

        return {
            "customer_id": customer.id,
            "customer_name": customer.name,
            "customer_code": customer.code,
            "opening_balance": Decimal("0.00"),
            "total_invoices": len(invoices),
            "total_billed": total_billed,
            "total_paid": total_paid,
            "total_due": total_due,
            "total_credit_notes": total_credit_notes,
            "net_outstanding": net_outstanding,
            "current_outstanding": customer_outstanding,
            "ledger": ledger,
        }

    async def calculate_outstanding(self, customer_id: str) -> Decimal:
        statement = await self.get_customer_statement(customer_id)
        return Decimal(str(statement["net_outstanding"])).quantize(Decimal("0.01"))

    async def get_open_invoices(self, customer_id: str) -> List[SalesInvoice]:
        stmt = select(SalesInvoice).where(
            SalesInvoice.customer_id == customer_id,
            SalesInvoice.balance_due > Decimal("0.00"),
            SalesInvoice.is_deleted == False,
        )
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(SalesInvoice.company_id == self.tenant_ctx.company_id)
        if self.tenant_ctx and self.tenant_ctx.branch_id:
            stmt = stmt.where(SalesInvoice.branch_id == self.tenant_ctx.branch_id)
        return (await self.db.execute(stmt)).scalars().all()

    async def apply_invoice(self, invoice_id: str) -> Dict[str, Any]:
        invoice = await self._load_invoice(invoice_id)
        reconciliation = await self.reconcile_invoice(invoice_id)
        return {
            "invoice": invoice,
            "reconciliation": reconciliation,
        }

    async def apply_payment(
        self,
        invoice_id: str,
        amount: Decimal,
        payment_mode: str,
        reference_no: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> SalesPayment:
        engine = await self._get_sales_engine()
        return await engine.record_payment(
            invoice_id=invoice_id,
            amount=amount,
            payment_mode=payment_mode,
            reference_no=reference_no,
            notes=notes,
        )

    async def apply_credit_note(self, credit_note_id: str) -> Dict[str, Any]:
        stmt = self._credit_note_stmt().where(CreditNote.id == credit_note_id)
        credit_note = (await self.db.execute(stmt)).scalars().first()
        if not credit_note:
            raise ValueError(f"Credit note '{credit_note_id}' not found")

        customer_stmt = select(Customer).where(Customer.id == credit_note.customer_id, Customer.is_deleted == False)
        if self.tenant_ctx and self.tenant_ctx.company_id:
            customer_stmt = customer_stmt.where(Customer.company_id == self.tenant_ctx.company_id)
        customer = (await self.db.execute(customer_stmt)).scalars().first()

        current_outstanding = Decimal(str(getattr(customer, "outstanding", "0.00") or "0.00")) if customer else Decimal("0.00")
        adjusted_outstanding = max(Decimal("0.00"), current_outstanding - Decimal(str(credit_note.grand_total)))

        return {
            "credit_note_id": credit_note.id,
            "credit_note_no": credit_note.credit_note_no,
            "invoice_id": credit_note.invoice_id,
            "customer_id": credit_note.customer_id,
            "credit_amount": float(Decimal(str(credit_note.grand_total)).quantize(Decimal("0.01"))),
            "current_outstanding": float(current_outstanding),
            "adjusted_outstanding": float(adjusted_outstanding),
        }

    async def reverse_invoice(self, invoice_id: str) -> SalesInvoice:
        sales_service = await self._get_sales_service()
        return await sales_service.cancel_sales_invoice(invoice_id)

    async def calculate_aging(self, customer_id: str) -> Dict[str, Any]:
        return await self.get_ageing(customer_id)

    async def reconcile_customer(self, customer_id: str) -> Dict[str, Any]:
        statement = await self.get_customer_statement(customer_id)
        invoices = await self.get_open_invoices(customer_id)

        invoice_reconciliations = []
        for invoice in invoices:
            inv_recon = await self.reconcile_invoice(invoice.id)
            invoice_reconciliations.append(inv_recon)

        return {
            "customer_id": customer_id,
            "statement": statement,
            "open_invoice_reconciliations": invoice_reconciliations,
        }

    async def _load_invoice(self, invoice_id: str) -> SalesInvoice:
        stmt = self._invoice_stmt().where(SalesInvoice.id == invoice_id)
        invoice = (await self.db.execute(stmt)).scalars().first()
        if not invoice:
            raise ValueError(f"Invoice '{invoice_id}' not found")
        return invoice

    async def get_outstanding(self, customer_id: str) -> Decimal:
        statement = await self.get_customer_statement(customer_id)
        return Decimal(str(statement["net_outstanding"])).quantize(Decimal("0.01"))

    async def get_ageing(self, customer_id: str) -> Dict[str, Any]:
        invoice_stmt = select(SalesInvoice).where(
            SalesInvoice.customer_id == customer_id,
            SalesInvoice.is_deleted == False,
            SalesInvoice.balance_due > 0,
        )
        if self.tenant_ctx and self.tenant_ctx.company_id:
            invoice_stmt = invoice_stmt.where(SalesInvoice.company_id == self.tenant_ctx.company_id)
        if self.tenant_ctx and self.tenant_ctx.branch_id:
            invoice_stmt = invoice_stmt.where(SalesInvoice.branch_id == self.tenant_ctx.branch_id)
        invoices = (await self.db.execute(invoice_stmt)).scalars().all()

        buckets = {"current": [], "days_1_30": [], "days_31_60": [], "days_61_90": [], "over_90_days": []}
        today = datetime.now(timezone.utc).date()
        items = []

        for invoice in invoices:
            invoice_date = invoice.invoice_date
            if hasattr(invoice_date, "date"):
                invoice_date_value = invoice_date.date()
            elif isinstance(invoice_date, datetime):
                invoice_date_value = invoice_date
            else:
                invoice_date_value = today
            age_days = (today - invoice_date_value).days if invoice_date_value else 0
            if age_days == 0:
                bucket_name = "current"
            elif age_days <= 30:
                bucket_name = "days_1_30"
            elif age_days <= 60:
                bucket_name = "days_31_60"
            elif age_days <= 90:
                bucket_name = "days_61_90"
            else:
                bucket_name = "over_90_days"
            buckets[bucket_name].append(invoice)
            items.append(
                {
                    "invoice_id": invoice.id,
                    "invoice_no": invoice.invoice_no,
                    "customer_id": invoice.customer_id,
                    "customer_name": getattr(invoice.customer, "name", "") if getattr(invoice, "customer", None) else "",
                    "invoice_date": invoice_date.isoformat() if invoice_date else None,
                    "due_date": invoice.due_date.isoformat() if getattr(invoice, "due_date", None) else None,
                    "outstanding": Decimal(str(invoice.balance_due)),
                    "age_days": age_days,
                    "aging_bucket": bucket_name,
                    "status": invoice.status,
                }
            )

        bucket_totals = {
            "current": sum(Decimal(str(i.balance_due)) for i in buckets["current"]),
            "days_1_30": sum(Decimal(str(i.balance_due)) for i in buckets["days_1_30"]),
            "days_31_60": sum(Decimal(str(i.balance_due)) for i in buckets["days_31_60"]),
            "days_61_90": sum(Decimal(str(i.balance_due)) for i in buckets["days_61_90"]),
            "over_90_days": sum(Decimal(str(i.balance_due)) for i in buckets["over_90_days"]),
        }

        return {
            "customer_id": customer_id,
            "as_of_date": today.isoformat(),
            "total_invoices": len(invoices),
            "total_outstanding": float(sum(Decimal(str(invoice.balance_due)) for invoice in invoices)),
            "bucket_totals": bucket_totals,
            "items": items,
        }

    async def reconcile_invoice(self, invoice_id: str) -> Dict[str, Any]:
        invoice_stmt = select(SalesInvoice).where(SalesInvoice.id == invoice_id, SalesInvoice.is_deleted == False)
        if self.tenant_ctx and self.tenant_ctx.company_id:
            invoice_stmt = invoice_stmt.where(SalesInvoice.company_id == self.tenant_ctx.company_id)
        invoice = (await self.db.execute(invoice_stmt)).scalars().first()
        if not invoice:
            raise ValueError(f"Invoice '{invoice_id}' not found")

        voucher_stmt = select(JournalVoucherModel).where(
            JournalVoucherModel.ref_document_id == invoice_id,
            JournalVoucherModel.is_deleted == False,
        )
        if self.tenant_ctx and self.tenant_ctx.company_id:
            voucher_stmt = voucher_stmt.where(JournalVoucherModel.company_id == self.tenant_ctx.company_id)
        vouchers = (await self.db.execute(voucher_stmt)).scalars().all()

        entries: List[JournalLedgerEntryModel] = []
        if vouchers:
            entry_stmt = select(JournalLedgerEntryModel).where(JournalLedgerEntryModel.voucher_id.in_([v.id for v in vouchers]))
            entries = (await self.db.execute(entry_stmt)).scalars().all()

        journal_debit = sum(Decimal(str(e.debit)) for e in entries)
        journal_credit = sum(Decimal(str(e.credit)) for e in entries)
        invoice_total = Decimal(str(invoice.grand_total)).quantize(Decimal("0.01"))
        balance_delta = invoice_total - Decimal(str(invoice.balance_due)).quantize(Decimal("0.01"))
        payment_total = Decimal(str(invoice.paid_amount)).quantize(Decimal("0.01"))

        is_balanced = journal_debit == journal_credit
        invoice_match = journal_debit == invoice_total and journal_credit == invoice_total
        settlement_match = payment_total + Decimal(str(invoice.balance_due)).quantize(Decimal("0.01")) == invoice_total
        reconciled = is_balanced and invoice_match and settlement_match
        return {
            "invoice_id": invoice_id,
            "invoice_no": invoice.invoice_no,
            "invoice_total": float(invoice_total),
            "journal_debit": float(journal_debit),
            "journal_credit": float(journal_credit),
            "payment_total": float(payment_total),
            "outstanding_delta": float(balance_delta),
            "reconciled": reconciled,
            "reconciliation_status": "PASSED" if reconciled else "FAILED",
        }
