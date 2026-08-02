from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy.future import select

if TYPE_CHECKING:
    from app.api.deps import TenantContext

from app.models.accounting import JournalLedgerEntryModel, JournalVoucherModel
from app.models.crm import Customer
from app.models.sales import SalesInvoice, SalesPayment


class ReceivablesService:
    """Derived AR engine over invoice, payment, and journal data."""

    def __init__(self, db, tenant_ctx: Optional["TenantContext"] = None):
        self.db = db
        self.tenant_ctx = tenant_ctx

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

        total_billed = sum(Decimal(str(i.grand_total)) for i in invoices)
        total_paid = sum(Decimal(str(i.paid_amount)) for i in invoices)
        total_due = sum(Decimal(str(i.balance_due)) for i in invoices)

        return {
            "customer_id": customer.id,
            "customer_name": customer.name,
            "customer_code": customer.code,
            "total_invoices": len(invoices),
            "total_billed": float(total_billed),
            "total_paid": float(total_paid),
            "total_due": float(total_due),
            "current_outstanding": float(total_due),
        }

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
