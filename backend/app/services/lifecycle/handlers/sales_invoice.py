"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.47.4
* Created    : 2026-10-01
* Modified   : 2026-10-01
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Dict, Any, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import TenantContext
from app.models.auth import User
from app.models.sales import SalesInvoice, SalesInvoiceItem, SalesOrder, SalesOrderItem
from app.models.workflow import WorkflowEvent
from app.services.sales_stock_authority import SalesStockAuthority
from app.services.unified_ledger import UnifiedAccountingLedgerService
from ..contracts import BaseDocumentLifecycleHandler
from ..registry import register_lifecycle_handler
from ..exceptions import (
    DocumentNotFoundException,
    HandlerValidationException,
    TenantIsolationException,
)


@register_lifecycle_handler("SalesInvoice", "SALES_INVOICE", "sales_invoice")
class SalesInvoiceLifecycleHandler(BaseDocumentLifecycleHandler):
    """
    Authoritative Domain Lifecycle Handler for Sales Invoices / Tax Invoices.
    Enforces multi-tenancy, line-item integrity, 3-way matching against sales orders/fulfillment,
    authoritative stock movement convergence (via SalesStockAuthority), double-entry GL posting
    (via UnifiedAccountingLedgerService), and cancellation immutability (is_deleted = False).
    """

    document_type = "SalesInvoice"

    def get_resource_name(self) -> str:
        return "sales_invoice"

    def get_document_summary(self, doc: SalesInvoice) -> Dict[str, Any]:
        return {
            "invoice_no": getattr(doc, "invoice_no", None),
            "customer_name": getattr(doc, "customer_name", None),
            "grand_total": str(getattr(doc, "grand_total", "0.00")),
            "payment_mode": getattr(doc, "payment_mode", None),
            "status": getattr(doc, "status", None),
        }

    def get_document_amount(self, doc: SalesInvoice) -> Decimal:
        if doc.grand_total is not None:
            return Decimal(str(doc.grand_total))
        return Decimal("0.00")

    def get_current_status(self, doc: SalesInvoice) -> str:
        return str(doc.status or "DRAFT").strip().upper()

    def get_version(self, doc: SalesInvoice) -> int:
        return int(getattr(doc, "version", 1))

    def is_approval_action(self, action: str) -> bool:
        return action.strip().upper() in ("APPROVE", "POST")

    def get_default_workflow_definition(self) -> Dict[str, Any]:
        return {
            "code": "WF_SALES_INVOICE",
            "version": 1,
            "doc_type": "SalesInvoice",
            "initial_state": "DRAFT",
            "states": ["DRAFT", "SUBMITTED", "POSTED", "PAID", "CANCELLED"],
            "transitions": [
                {"from": "DRAFT", "to": "SUBMITTED", "action": "SUBMIT", "required_roles": ["CASHIER", "STORE_MANAGER", "ACCOUNTANT", "MANAGER", "SYSADMIN"]},
                {"from": "DRAFT", "to": "POSTED", "action": "POST", "required_roles": ["CASHIER", "STORE_MANAGER", "ACCOUNTANT", "MANAGER", "SYSADMIN"]},
                {"from": "DRAFT", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "SUBMITTED", "to": "POSTED", "action": "POST", "required_roles": ["ACCOUNTANT", "MANAGER", "SYSADMIN"]},
                {"from": "SUBMITTED", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["MANAGER", "SYSADMIN"]},
                {"from": "POSTED", "to": "PAID", "action": "PAY", "required_roles": ["CASHIER", "ACCOUNTANT", "MANAGER", "SYSADMIN"]},
                {"from": "POSTED", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["MANAGER", "SYSADMIN"]},
            ],
        }

    async def get_document(
        self,
        db: AsyncSession,
        doc_id: str,
        tenant_ctx: TenantContext
    ) -> SalesInvoice:
        """Safely loads a SalesInvoice enforcing multi-tenant isolation."""
        stmt = (
            select(SalesInvoice)
            .where(
                SalesInvoice.id == doc_id,
                SalesInvoice.company_id == tenant_ctx.company_id,
            )
            .options(selectinload(SalesInvoice.items))
            .with_for_update()
        )
        res = await db.execute(stmt)
        invoice = res.scalars().first()
        if not invoice:
            raise DocumentNotFoundException(self.document_type, doc_id)
        return invoice

    async def validate_transition(
        self,
        db: AsyncSession,
        doc: SalesInvoice,
        action: str,
        next_state: str,
        user: User,
        tenant_ctx: TenantContext,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        act = action.strip().upper()
        curr_state = self.get_current_status(doc)

        if act == "SUBMIT":
            if curr_state != "DRAFT":
                raise HandlerValidationException(
                    f"Only DRAFT sales invoices can be submitted. Current status: {curr_state}."
                )

        elif act == "POST":
            if curr_state not in ("DRAFT", "SUBMITTED"):
                raise HandlerValidationException(
                    f"Only DRAFT or SUBMITTED invoices can be posted. Current status: {curr_state}."
                )

            # Ensure invoice has items
            q_items = select(SalesInvoiceItem).where(
                SalesInvoiceItem.invoice_id == doc.id,
                SalesInvoiceItem.is_deleted == False
            )
            items = (await db.execute(q_items)).scalars().all()
            if not items and not getattr(doc, "items", None):
                raise HandlerValidationException("Cannot post a sales invoice with zero line items.")

            # Phase S5: 3-Way Match Validation (Ordered Qty >= Invoiced Qty, Billed Rate <= Ordered Rate)
            # Only checked if invoice is explicitly linked to a source Sales Order
            if doc.source_document_type == "SALES_ORDER" and doc.source_document_id:
                so_stmt = select(SalesOrder).where(
                    SalesOrder.id == doc.source_document_id,
                    SalesOrder.company_id == tenant_ctx.company_id,
                ).options(selectinload(SalesOrder.items))
                so = (await db.execute(so_stmt)).scalars().first()
                if so:
                    so_items_by_prod = {item.product_id: item for item in so.items if not item.is_deleted}
                    for inv_it in (doc.items or items):
                        matched_so_item = so_items_by_prod.get(inv_it.product_id)
                        if matched_so_item:
                            # 1. Quantity Check
                            if Decimal(str(inv_it.quantity)) > Decimal(str(matched_so_item.quantity)):
                                raise HandlerValidationException(
                                    f"Invoiced quantity ({inv_it.quantity}) exceeds ordered quantity ({matched_so_item.quantity}) for product '{inv_it.name}'.",
                                    "SALES_3WAY_QTY_EXCEEDED"
                                )
                            # 2. Rate Check (cannot bill higher than agreed SO rate)
                            if Decimal(str(inv_it.price)) > Decimal(str(matched_so_item.price)):
                                raise HandlerValidationException(
                                    f"Invoiced rate ({inv_it.price}) exceeds agreed sales order rate ({matched_so_item.price}) for product '{inv_it.name}'.",
                                    "SALES_3WAY_RATE_EXCEEDED"
                                )

        elif act == "CANCEL":
            if curr_state == "CANCELLED":
                raise HandlerValidationException("This sales invoice is already cancelled.")
            if curr_state == "PAID" or (doc.paid_amount and Decimal(str(doc.paid_amount)) > Decimal("0.00")):
                raise HandlerValidationException(
                    f"Cannot cancel invoice {doc.invoice_no} because it has active payments (paid amount: ₹{doc.paid_amount}). Reverse or refund payments prior to cancellation.",
                    "INVOICE_PAID_CANNOT_CANCEL"
                )

        elif act == "PAY":
            if curr_state != "POSTED":
                raise HandlerValidationException(
                    f"Only POSTED sales invoices can receive payments. Current status: {curr_state}."
                )
            current_balance = Decimal(str(doc.balance_amount)) if (doc.balance_amount is not None and (Decimal(str(doc.balance_amount)) > 0 or (doc.paid_amount and Decimal(str(doc.paid_amount)) > 0))) else Decimal(str(doc.grand_total or 0.00))
            amt = Decimal(str(payload.get("amount", current_balance)))
            if amt <= Decimal("0.00"):
                raise HandlerValidationException("Payment amount must be greater than zero.", "INVALID_PAYMENT_AMOUNT")
            if amt > current_balance:
                raise HandlerValidationException(
                    f"Payment amount (₹{amt}) exceeds outstanding invoice balance (₹{current_balance}).",
                    "PAYMENT_EXCEEDS_BALANCE"
                )

    async def apply_transition(
        self,
        db: AsyncSession,
        doc: SalesInvoice,
        action: str,
        next_state: str,
        user: User,
        tenant_ctx: TenantContext,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        act = action.strip().upper()
        now = datetime.now(timezone.utc)
        payload = payload or {}
        from_status = self.get_current_status(doc)

        # Update canonical status
        doc.status = next_state
        doc.modified_at = now
        # GUARANTEE: Never soft-delete on business lifecycle transition
        doc.is_deleted = False
        doc.version = (doc.version or 0) + 1

        if act == "POST":
            # Ensure balance_amount is initialized to grand_total if uninitialized
            if doc.balance_amount is None or (Decimal(str(doc.balance_amount)) == Decimal("0.00") and (not doc.paid_amount or Decimal(str(doc.paid_amount)) == Decimal("0.00"))):
                doc.balance_amount = Decimal(str(doc.grand_total or 0.00))
                doc.paid_amount = Decimal("0.00")
            # 1. Authoritative Stock Movement via SalesStockAuthority
            inv_items_stmt = select(SalesInvoiceItem).where(
                SalesInvoiceItem.invoice_id == doc.id,
                SalesInvoiceItem.is_deleted == False
            )
            inv_items = (await db.execute(inv_items_stmt)).scalars().all()
            lines = [
                {
                    "product_id": it.product_id,
                    "quantity": it.quantity,
                    "batch_no": it.batch_no,
                }
                for it in inv_items
            ]
            await SalesStockAuthority.record_outward_sale(
                session=db,
                tenant_ctx=tenant_ctx,
                invoice_id=doc.id,
                invoice_no=doc.invoice_no,
                items=lines,
                warehouse_id=doc.warehouse_id,
                user_id=getattr(user, "username", None) or str(user.id),
            )

            # 2. Financial GL Posting via UnifiedAccountingLedgerService (Atomic, Fail-Fast)
            await UnifiedAccountingLedgerService.post_sales_invoice_to_gl(
                session=db,
                company_id=tenant_ctx.company_id,
                invoice_id=doc.id,
                branch_id=tenant_ctx.branch_id,
            )

        elif act == "CANCEL":
            doc.cancellation_reason = payload.get("reason") or "Invoice cancelled"
            # If the invoice was already posted, reverse stock and GL entries
            if from_status in ("POSTED", "PAID"):
                await SalesStockAuthority.record_sales_cancellation_reversal(
                    session=db,
                    tenant_ctx=tenant_ctx,
                    invoice_id=doc.id,
                    invoice_no=doc.invoice_no,
                    reason=payload.get("reason") or "Invoice cancellation",
                    user_id=getattr(user, "username", None) or str(user.id),
                )
                await UnifiedAccountingLedgerService.post_sales_cancellation_to_gl(
                    session=db,
                    company_id=tenant_ctx.company_id,
                    invoice_id=doc.id,
                    branch_id=tenant_ctx.branch_id,
                    reason=payload.get("reason"),
                    cancelled_by=getattr(user, "username", None) or str(user.id),
                )

        elif act == "PAY":
            import uuid
            from app.schemas.payments import ProcessPaymentRequest, PaymentTenderItem, PaymentAllocationRequest
            from app.services.payments_engine import PaymentsEngine

            advance_payment_id = payload.get("advance_payment_id") or (payload.get("payment_id") if payload.get("use_advance") or payload.get("tender_type") == "ADVANCE" else None)
            current_balance = Decimal(str(doc.balance_amount)) if (doc.balance_amount is not None and (Decimal(str(doc.balance_amount)) > 0 or (doc.paid_amount and Decimal(str(doc.paid_amount)) > 0))) else Decimal(str(doc.grand_total or 0.00))
            pay_amount = Decimal(str(payload.get("amount", current_balance))).quantize(Decimal("0.01"))

            if advance_payment_id:
                alloc_req = PaymentAllocationRequest(
                    invoice_id=doc.id,
                    allocated_amount=float(pay_amount),
                    discount_allowed=float(payload.get("discount_allowed", 0.0)),
                    idempotency_key=payload.get("idempotency_key")
                )
                await PaymentsEngine.allocate_payment(
                    session=db,
                    company_id=tenant_ctx.company_id,
                    payment_id=advance_payment_id,
                    req=alloc_req,
                    created_by=getattr(user, "username", None) or str(user.id),
                    commit=False,
                )
            else:
                tender_type = str(payload.get("tender_type") or payload.get("payment_mode") or doc.payment_mode or "CASH").upper()
                gateway_ref = payload.get("gateway_reference") or payload.get("reference_no")
                notes = payload.get("notes") or f"Payment received for invoice {doc.invoice_no}"
                idempotency_key = payload.get("idempotency_key") or f"PAY-INV-{doc.id}-{uuid.uuid4().hex[:8]}"

                proc_payment_req = ProcessPaymentRequest(
                    reference_doc_type="SALES_INVOICE",
                    reference_doc_id=doc.id,
                    party_id=doc.customer_id,
                    branch_id=tenant_ctx.branch_id or doc.branch_id or "MAIN",
                    tenders=[
                        PaymentTenderItem(
                            tender_type=tender_type,
                            amount=float(pay_amount),
                            gateway_reference=gateway_ref,
                            notes=notes,
                        )
                    ],
                    idempotency_key=idempotency_key,
                    auto_allocate=True,
                )

                pay_response = await PaymentsEngine.process_payment(
                    session=db,
                    company_id=tenant_ctx.company_id,
                    req=proc_payment_req,
                    created_by=getattr(user, "username", None) or str(user.id),
                    commit=False,
                )

            # Ensure doc state reflects settlement calculated by PaymentsEngine
            if doc.balance_amount == Decimal("0.00"):
                doc.status = "PAID"
            else:
                doc.status = "POSTED"

        db.add(doc)
