from __future__ import annotations

from datetime import datetime, timezone
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

        credit_note_stmt = select(CreditNote).where(
            CreditNote.customer_id == customer_id,
            CreditNote.is_deleted == False,
        )
        if self.tenant_ctx and self.tenant_ctx.company_id:
            credit_note_stmt = credit_note_stmt.where(CreditNote.company_id == self.tenant_ctx.company_id)
        credit_notes = (await self.db.execute(credit_note_stmt)).scalars().all()

        total_billed = sum(Decimal(str(i.grand_total)) for i in invoices)
        total_paid = sum(Decimal(str(i.paid_amount)) for i in invoices)
        total_due = sum(Decimal(str(i.balance_due)) for i in invoices)
        total_credit_notes = sum(Decimal(str(c.grand_total)) for c in credit_notes)

        customer_outstanding = Decimal(str(getattr(customer, "outstanding", "0.00") or "0.00"))
        net_outstanding = max(Decimal("0.00"), total_due - total_credit_notes)

        return {
            "customer_id": customer.id,
            "customer_name": customer.name,
            "customer_code": customer.code,
            "total_invoices": len(invoices),
            "total_credit_notes": len(credit_notes),
            "total_billed": float(total_billed),
            "total_paid": float(total_paid),
            "total_due": float(total_due),
            "total_credit_notes_amount": float(total_credit_notes),
            "current_outstanding": float(customer_outstanding),
            "net_outstanding": float(net_outstanding),
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
        return Decimal(str(statement["total_due"])).quantize(Decimal("0.01"))

    async def get_ageing(self, customer_id: str) -> Dict[str, Any]:
        invoice_stmt = select(SalesInvoice).where(
            SalesInvoice.customer_id == customer_id,
            SalesInvoice.is_deleted == False,
            SalesInvoice.balance_due > 0,
        )
        if self.tenant_ctx and self.tenant_ctx.company_id:
            invoice_stmt = invoice_stmt.where(SalesInvoice.company_id == self.tenant_ctx.company_id)
        invoices = (await self.db.execute(invoice_stmt)).scalars().all()

        buckets = {"0_30": [], "31_60": [], "61_90": [], "90_plus": []}
        today = datetime.now(timezone.utc).date()
        for invoice in invoices:
            invoice_date = invoice.invoice_date
            if hasattr(invoice_date, "date"):
                invoice_date = invoice_date.date()
            elif not isinstance(invoice_date, datetime):
                invoice_date = None
            age_days = (today - invoice_date).days if invoice_date else 0
            if age_days <= 30:
                buckets["0_30"].append(invoice)
            elif age_days <= 60:
                buckets["31_60"].append(invoice)
            elif age_days <= 90:
                buckets["61_90"].append(invoice)
            else:
                buckets["90_plus"].append(invoice)

        return {
            "customer_id": customer_id,
            "as_of_date": today.isoformat(),
            "buckets": {
                name: {
                    "count": len(items),
                    "amount": float(sum(Decimal(str(item.balance_due)) for item in items)),
                }
                for name, items in buckets.items()
            },
            "total_open": float(sum(Decimal(str(i.balance_due)) for i in invoices)),
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

        return {
            "invoice_id": invoice_id,
            "invoice_no": invoice.invoice_no,
            "invoice_total": float(invoice_total),
            "journal_debit": float(journal_debit),
            "journal_credit": float(journal_credit),
            "payment_total": float(payment_total),
            "outstanding_delta": float(balance_delta),
            "reconciled": journal_debit == journal_credit == invoice_total,
        }
