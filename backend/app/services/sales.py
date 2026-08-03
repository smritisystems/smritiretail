"""
Project         : SMRITI Retail OS
Organization    : SmritiSys
Author          : Jawahar Ramkripal Mallah
Designation     : Chief Systems Architect & Creator
Email           : support@smritibooks.com
Websites        : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version         : 5.1.3
Created         : 2026-07-11
Modified        : 2026-08-04
Copyright       : © SMRITIBooks.com. All Rights Reserved.
License         : Proprietary Commercial Software
Classification  : Internal
"""

import uuid
from typing import List, Optional
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from ..models.sales import (
    SalesInvoice, SalesInvoiceItem, SalesInvoicePayment,
    SalesQuotation, SalesQuotationItem,
    SalesOrder, SalesOrderItem,
    SalesReturn, SalesReturnItem,
)
from ..models.crm import Customer
from ..schemas.sales import (
    SalesInvoiceCreate,
    SalesInvoiceUpdate,
    SalesQuotationCreate,
    SalesQuotationUpdate,
    SalesOrderCreate,
    SalesOrderUpdate,
    SalesReturnCreate,
    SalesReturnUpdate,
)
from .sales_orchestrator import SalesBusinessOrchestrator
from ..api.deps import TenantContext
from app.modules.sales.quotation.application import QuotationApplicationService
# ADR-007: Domain Event Bus
from app.services.event_bus import event_bus, Events
from app.services.accounting import AccountingService, Accounts, JournalEntry, JournalVoucher
from app.models.accounting import JournalVoucherModel


def _uid() -> str:
    return uuid.uuid4().hex[:8]


class SalesService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.orchestrator = SalesBusinessOrchestrator(db, tenant_ctx)

    # ──────────────────────────────────────────────────────────────
    # Sales Invoice
    # ──────────────────────────────────────────────────────────────

    async def create_sales_invoice(self, invoice_in: SalesInvoiceCreate) -> SalesInvoice:
        return await self.orchestrator.create_sales_invoice(invoice_in)

    async def get_sales_invoice(self, invoice_id: str) -> tuple[SalesInvoice, List[SalesInvoiceItem]]:
        res = await self.db.execute(
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .where(
                SalesInvoice.id == invoice_id,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                SalesInvoice.branch_id == self.tenant_ctx.branch_id,
                SalesInvoice.is_deleted == False
            )
        )
        invoice = res.scalars().first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Sales invoice not found")
        return invoice, invoice.items

    async def delete_sales_invoice(self, invoice_id: str) -> None:
        inv_res = await self.db.execute(
            select(SalesInvoice).where(
                SalesInvoice.id == invoice_id,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                SalesInvoice.branch_id == self.tenant_ctx.branch_id,
                SalesInvoice.is_deleted == False
            )
        )
        invoice = inv_res.scalars().first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Sales invoice not found")
        invoice.is_deleted = True
        invoice.status = "Cancelled"
        await self.db.commit()

        # ADR-007: Publish InvoiceCancelled AFTER successful commit
        # → Accounting module subscribes to post reversal ledger entry
        try:
            await publish_invoice_cancelled(
                invoice_number=str(getattr(invoice, "invoice_no", invoice_id)),
                refund_amount=float(getattr(invoice, "grand_total", 0) or 0),
                reason="User cancellation via API"
            )
        except Exception as _evt_err:
            import logging
            logging.getLogger("smriti.sales").warning(
                f"[CANCEL_EVENT] Domain event publish failed (non-critical): {_evt_err}"
            )

    # ──────────────────────────────────────────────────────────────
    # Sales Quotation
    # ──────────────────────────────────────────────────────────────

    async def create_sales_quotation(self, q_in: SalesQuotationCreate) -> SalesQuotation:
        return await self.orchestrator.create_sales_quotation(q_in)

    async def list_sales_quotations(self) -> List[SalesQuotation]:
        return await QuotationApplicationService(self.db, self.tenant_ctx).list_quotations()

    async def get_sales_quotation(self, q_id: str) -> tuple[SalesQuotation, List[SalesQuotationItem]]:
        return await QuotationApplicationService(self.db, self.tenant_ctx).get_quotation(q_id)

    # ──────────────────────────────────────────────────────────────
    # Sales Order
    # ──────────────────────────────────────────────────────────────

    async def create_sales_order(self, so_in: SalesOrderCreate) -> SalesOrder:
        return await self.orchestrator.create_sales_order(so_in)

    async def list_sales_orders(self) -> List[SalesOrder]:
        res = await self.db.execute(
            select(SalesOrder)
            .options(selectinload(SalesOrder.items))
            .where(
                SalesOrder.company_id == self.tenant_ctx.company_id,
                SalesOrder.branch_id == self.tenant_ctx.branch_id,
                SalesOrder.is_deleted == False
            )
        )
        return res.scalars().all()

    async def get_sales_order(self, so_id: str) -> tuple[SalesOrder, List[SalesOrderItem]]:
        res = await self.db.execute(
            select(SalesOrder)
            .options(selectinload(SalesOrder.items))
            .where(
                SalesOrder.id == so_id,
                SalesOrder.company_id == self.tenant_ctx.company_id,
                SalesOrder.branch_id == self.tenant_ctx.branch_id,
                SalesOrder.is_deleted == False
            )
        )
        so = res.scalars().first()
        if not so:
            raise HTTPException(status_code=404, detail="Sales order not found")
        return so, so.items

    # ──────────────────────────────────────────────────────────────
    # Sales Return
    # ──────────────────────────────────────────────────────────────

    async def create_sales_return(self, sr_in: SalesReturnCreate) -> SalesReturn:
        return await self.orchestrator.create_sales_return(sr_in)

    async def list_sales_returns(self) -> List[SalesReturn]:
        res = await self.db.execute(
            select(SalesReturn)
            .options(selectinload(SalesReturn.items))
            .where(
                SalesReturn.company_id == self.tenant_ctx.company_id,
                SalesReturn.branch_id == self.tenant_ctx.branch_id,
                SalesReturn.is_deleted == False
            )
        )
        return res.scalars().all()

    async def get_sales_return(self, sr_id: str) -> tuple[SalesReturn, List[SalesReturnItem]]:
        res = await self.db.execute(
            select(SalesReturn)
            .options(selectinload(SalesReturn.items))
            .where(
                SalesReturn.id == sr_id,
                SalesReturn.company_id == self.tenant_ctx.company_id,
                SalesReturn.branch_id == self.tenant_ctx.branch_id,
                SalesReturn.is_deleted == False
            )
        )
        sr = res.scalars().first()
        if not sr:
            raise HTTPException(status_code=404, detail="Sales return not found")
        return sr, sr.items

    # ───────────────────────────────────────────────────────────────
    # Phase 2 — UPDATE / CANCEL / DELETE
    # ───────────────────────────────────────────────────────────────

    # ── Invoice UPDATE ──────────────────────────────────────────────

    async def update_sales_invoice(
        self, invoice_id: str, update_in: SalesInvoiceUpdate
    ) -> SalesInvoice:
        """
        Partial-update a sales invoice.
        If items are supplied, old items are replaced and totals are server-side re-computed.
        Stock adjustments are NOT made on update; use Sales Returns for stock reversal.
        """
        res = await self.db.execute(
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .where(
                SalesInvoice.id         == invoice_id,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                SalesInvoice.branch_id  == self.tenant_ctx.branch_id,
                SalesInvoice.is_deleted == False,
            )
        )
        invoice = res.scalars().first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Sales invoice not found")

        # Apply scalar patches
        for attr in ("status", "customer_id", "date", "is_interstate",
                     "eway_bill_no", "invoice_no"):
            val = getattr(update_in, attr)
            if val is not None:
                setattr(invoice, attr, val)

        if update_in.items is not None:
            # Reassign the collection — delete-orphan cascade handles deleting old items
            # and the unit-of-work inserts new ones in the correct order.
            tax_total   = Decimal("0.00")
            grand_total = Decimal("0.00")
            new_items   = []
            for item in update_in.items:
                item_tax   = (item.quantity * item.price
                               * (item.gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
                item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
                tax_total   += item_tax
                grand_total += item_total
                new_items.append(SalesInvoiceItem(
                    invoice_id=invoice.id,
                    product_id=item.product_id, code=item.code, name=item.name,
                    quantity=item.quantity, price=item.price,
                    hsn_code=item.hsn_code, gst_rate=item.gst_rate,
                    tax_amount=item_tax, total_amount=item_total,
                    tenant_id=self.tenant_ctx.tenant_id,
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                ))
            invoice.items       = new_items  # orphans scheduled for DELETE, new for INSERT
            invoice.tax_total   = tax_total
            invoice.grand_total = grand_total
        else:
            if update_in.tax_total   is not None: invoice.tax_total   = update_in.tax_total
            if update_in.grand_total is not None: invoice.grand_total = update_in.grand_total

        invoice.modified_at = datetime.now(timezone.utc)
        self.db.add(invoice)
        await self.db.commit()

        result = await self.db.execute(
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items), selectinload(SalesInvoice.payments))
            .where(SalesInvoice.id == invoice.id)
        )
        return result.scalars().one()

    # ── Invoice CANCEL (DELETE) ─────────────────────────────────────

    async def cancel_sales_invoice(self, invoice_id: str) -> SalesInvoice:
        """
        Cancel a sales invoice: set status='Cancelled' and soft-delete (is_deleted=True).
        This mirrors the Express DELETE /api/sales/invoices/:id behaviour.
        Stock reversal is NOT performed here; use Sales Returns for that.
        """
        res = await self.db.execute(
            select(SalesInvoice).where(
                SalesInvoice.id         == invoice_id,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                SalesInvoice.branch_id  == self.tenant_ctx.branch_id,
                SalesInvoice.is_deleted == False,
            )
        )
        invoice = res.scalars().first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Sales invoice not found")

        customer = await self.db.get(Customer, invoice.customer_id) if invoice.customer_id else None
        if customer and invoice.balance_due > 0:
            current_outstanding = Decimal(str(getattr(customer, "outstanding", 0) or "0.00"))
            customer.outstanding = max(Decimal("0.00"), current_outstanding - Decimal(str(invoice.balance_due))).quantize(Decimal("0.01"))
            self.db.add(customer)

        reversal_amount = Decimal(str(invoice.grand_total or "0.00")).quantize(Decimal("0.01"))
        reversal_subtotal = Decimal(str(invoice.subtotal or "0.00")).quantize(Decimal("0.01"))
        reversal_cgst = Decimal(str(invoice.cgst_amount or "0.00")).quantize(Decimal("0.01"))
        reversal_sgst = Decimal(str(invoice.sgst_amount or "0.00")).quantize(Decimal("0.01"))
        reversal_igst = Decimal(str(invoice.igst_amount or "0.00")).quantize(Decimal("0.01"))

        accounting_service = AccountingService(self.db, self.tenant_ctx)
        reversal_voucher = JournalVoucher(
            ref_document_type="SalesInvoice",
            ref_document_id=invoice.id,
            ref_document_no=invoice.invoice_no,
            narration=f"Reversal of sales invoice {invoice.invoice_no}",
            voucher_date=datetime.now(timezone.utc).isoformat(),
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            entries=[
                JournalEntry(account_code=Accounts.ACCOUNTS_RECEIVABLE, account_name="Accounts Receivable", debit=Decimal("0.00"), credit=reversal_amount, narration=f"Reverse receivable for cancelled invoice {invoice.invoice_no}"),
                JournalEntry(account_code=Accounts.SALES_REVENUE, account_name="Sales Revenue", debit=reversal_subtotal, credit=Decimal("0.00"), narration=f"Reverse sales revenue for cancelled invoice {invoice.invoice_no}"),
                JournalEntry(account_code=Accounts.GST_OUTPUT_CGST, account_name="CGST Payable", debit=reversal_cgst, credit=Decimal("0.00"), narration=f"Reverse CGST for cancelled invoice {invoice.invoice_no}"),
                JournalEntry(account_code=Accounts.GST_OUTPUT_SGST, account_name="SGST Payable", debit=reversal_sgst, credit=Decimal("0.00"), narration=f"Reverse SGST for cancelled invoice {invoice.invoice_no}"),
                JournalEntry(account_code=Accounts.GST_OUTPUT_IGST, account_name="IGST Payable", debit=reversal_igst, credit=Decimal("0.00"), narration=f"Reverse IGST for cancelled invoice {invoice.invoice_no}"),
            ],
        )
        try:
            reversal_voucher_id = await accounting_service.post_journal(reversal_voucher)
            reversal_model = await self.db.get(JournalVoucherModel, reversal_voucher_id)
            if reversal_model:
                reversal_model.status = "REVERSED"
                reversal_model.narration = f"Reversal of invoice {invoice.invoice_no}"
                self.db.add(reversal_model)
        except Exception as exc:
            import logging
            logging.getLogger("smriti.sales").warning("[CANCEL_VOUCHER] Failed to reverse journal for invoice %s: %s", invoice.invoice_no, exc)

        invoice.status      = "Cancelled"
        invoice.is_deleted  = True
        invoice.modified_at = datetime.now(timezone.utc)
        self.db.add(invoice)
        await self.db.commit()
        await self.db.refresh(invoice)

        # ── SCDM: Publish SALES_INVOICE_CANCELLED for channel dispatch reversal
        await event_bus.publish(
            Events.SALES_INVOICE_CANCELLED,
            {
                "invoice_id":  invoice.id,
                "invoice_no":  invoice.invoice_no,
                "customer_id": invoice.customer_id,
            },
            self.db,
        )
        return invoice

    # ── Quotation UPDATE ────────────────────────────────────────────

    async def update_sales_quotation(self, q_id: str, update_in: SalesQuotationUpdate) -> SalesQuotation:
        return await QuotationApplicationService(self.db, self.tenant_ctx).update_quotation(q_id, update_in)

    async def submit_sales_quotation(self, q_id: str) -> SalesQuotation:
        return await QuotationApplicationService(self.db, self.tenant_ctx).submit_quotation(q_id)

    async def approve_sales_quotation(self, q_id: str) -> SalesQuotation:
        return await QuotationApplicationService(self.db, self.tenant_ctx).approve_quotation(q_id)

    async def reject_sales_quotation(self, q_id: str) -> SalesQuotation:
        return await QuotationApplicationService(self.db, self.tenant_ctx).reject_quotation(q_id)

    async def cancel_sales_quotation(self, q_id: str) -> SalesQuotation:
        return await QuotationApplicationService(self.db, self.tenant_ctx).cancel_quotation(q_id)

    async def convert_sales_quotation_to_order(self, q_id: str) -> SalesOrder:
        return await self.orchestrator.convert_quotation_to_order(q_id)

    async def convert_quotation_to_invoice(self, q_id: str) -> SalesInvoice:
        return await self.orchestrator.convert_quotation_to_invoice(q_id)

    # ── Quotation DELETE ────────────────────────────────────────────

    async def delete_sales_quotation(self, q_id: str) -> None:
        await QuotationApplicationService(self.db, self.tenant_ctx).delete_quotation(q_id)

    # ── Order UPDATE ────────────────────────────────────────────────

    async def update_sales_order(
        self, so_id: str, update_in: SalesOrderUpdate
    ) -> SalesOrder:
        res = await self.db.execute(
            select(SalesOrder)
            .options(selectinload(SalesOrder.items))
            .where(
                SalesOrder.id         == so_id,
                SalesOrder.company_id == self.tenant_ctx.company_id,
                SalesOrder.branch_id  == self.tenant_ctx.branch_id,
                SalesOrder.is_deleted == False,
            )
        )
        so = res.scalars().first()
        if not so:
            raise HTTPException(status_code=404, detail="Sales order not found")

        for attr in ("order_no", "date", "customer_name", "status", "source_quotation_id"):
            val = getattr(update_in, attr)
            if val is not None:
                setattr(so, attr, val)

        if update_in.items is not None:
            await self.db.execute(
                delete(SalesOrderItem).where(SalesOrderItem.order_id == so.id)
            )
            tax_total   = Decimal("0.00")
            grand_total = Decimal("0.00")
            for item in update_in.items:
                item_tax   = (item.quantity * item.price
                               * (item.gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
                item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
                tax_total   += item_tax
                grand_total += item_total
                self.db.add(SalesOrderItem(
                    order_id=so.id,
                    product_id=item.product_id, code=item.code, name=item.name,
                    quantity=item.quantity, price=item.price,
                    hsn_code=item.hsn_code, gst_rate=item.gst_rate,
                    tax_amount=item_tax, total_amount=item_total,
                    tenant_id=self.tenant_ctx.tenant_id,
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                ))
            so.tax_total   = tax_total
            so.grand_total = grand_total
        else:
            if update_in.tax_total   is not None: so.tax_total   = update_in.tax_total
            if update_in.grand_total is not None: so.grand_total = update_in.grand_total

        so.modified_at = datetime.now(timezone.utc)
        self.db.add(so)
        await self.db.commit()

        result = await self.db.execute(
            select(SalesOrder)
            .options(selectinload(SalesOrder.items))
            .where(SalesOrder.id == so.id)
        )
        return result.scalars().one()

    # ── Order DELETE ────────────────────────────────────────────────

    async def delete_sales_order(self, so_id: str) -> None:
        res = await self.db.execute(
            select(SalesOrder).where(
                SalesOrder.id         == so_id,
                SalesOrder.company_id == self.tenant_ctx.company_id,
                SalesOrder.branch_id  == self.tenant_ctx.branch_id,
                SalesOrder.is_deleted == False,
            )
        )
        so = res.scalars().first()
        if not so:
            raise HTTPException(status_code=404, detail="Sales order not found")
        so.is_deleted  = True
        so.modified_at = datetime.now(timezone.utc)
        self.db.add(so)
        await self.db.commit()

    # ── Return UPDATE ───────────────────────────────────────────────

    async def update_sales_return(
        self, sr_id: str, update_in: SalesReturnUpdate
    ) -> SalesReturn:
        res = await self.db.execute(
            select(SalesReturn)
            .options(selectinload(SalesReturn.items))
            .where(
                SalesReturn.id         == sr_id,
                SalesReturn.company_id == self.tenant_ctx.company_id,
                SalesReturn.branch_id  == self.tenant_ctx.branch_id,
                SalesReturn.is_deleted == False,
            )
        )
        sr = res.scalars().first()
        if not sr:
            raise HTTPException(status_code=404, detail="Sales return not found")

        for attr in ("return_no", "original_invoice_id", "credit_note_number",
                     "date", "reason", "is_interstate", "status"):
            val = getattr(update_in, attr)
            if val is not None:
                setattr(sr, attr, val)

        if update_in.items is not None:
            await self.db.execute(
                delete(SalesReturnItem).where(SalesReturnItem.return_id == sr.id)
            )
            tax_total   = Decimal("0.00")
            grand_total = Decimal("0.00")
            for item in update_in.items:
                item_tax   = (item.quantity * item.price
                               * (item.gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
                item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
                tax_total   += item_tax
                grand_total += item_total
                self.db.add(SalesReturnItem(
                    return_id=sr.id,
                    product_id=item.product_id, code=item.code, name=item.name,
                    quantity=item.quantity, price=item.price,
                    gst_rate=item.gst_rate,
                    tax_amount=item_tax, total_amount=item_total,
                    tenant_id=self.tenant_ctx.tenant_id,
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                ))
            sr.tax_total   = tax_total
            sr.grand_total = grand_total
        else:
            if update_in.tax_total   is not None: sr.tax_total   = update_in.tax_total
            if update_in.grand_total is not None: sr.grand_total = update_in.grand_total

        sr.modified_at = datetime.now(timezone.utc)
        self.db.add(sr)
        await self.db.commit()

        result = await self.db.execute(
            select(SalesReturn)
            .options(selectinload(SalesReturn.items))
            .where(SalesReturn.id == sr.id)
        )
        return result.scalars().one()

    # ── Return DELETE ───────────────────────────────────────────────

    async def delete_sales_return(self, sr_id: str) -> None:
        res = await self.db.execute(
            select(SalesReturn).where(
                SalesReturn.id         == sr_id,
                SalesReturn.company_id == self.tenant_ctx.company_id,
                SalesReturn.branch_id  == self.tenant_ctx.branch_id,
                SalesReturn.is_deleted == False,
            )
        )
        sr = res.scalars().first()
        if not sr:
            raise HTTPException(status_code=404, detail="Sales return not found")
        sr.is_deleted  = True
        sr.modified_at = datetime.now(timezone.utc)
        self.db.add(sr)
        await self.db.commit()


    # ─────────────────────────── Phase 4B: Workflow ─────────────────────────────

    async def approve_sales_invoice(self, invoice_id: str) -> SalesInvoice:
        """
        Approve a sales invoice: Draft → Confirmed.
        Sets status='Confirmed' and updates modified_at.
        """
        res = await self.db.execute(
            select(SalesInvoice).where(
                SalesInvoice.id         == invoice_id,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                SalesInvoice.branch_id  == self.tenant_ctx.branch_id,
                SalesInvoice.is_deleted == False,
            )
        )
        invoice = res.scalars().first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Sales invoice not found")
        if invoice.status not in ("Draft", "Submitted"):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot approve an invoice with status '{invoice.status}'.",
            )
        invoice.status      = "Confirmed"
        invoice.modified_at = datetime.now(timezone.utc)
        self.db.add(invoice)
        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    # ─────────────────────────── Phase 4B: Convert Quotation ────────────────────

