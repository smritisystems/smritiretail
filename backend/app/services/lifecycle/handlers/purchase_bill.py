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
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import TenantContext
from app.models.auth import User
from app.models.purchase import (
    PurchaseBill,
    PurchaseBillItem,
    Supplier,
    PurchaseReceipt,
    PurchaseReceiptItem,
    PurchaseOrder,
    PurchaseOrderItem,
)
from app.models.workflow import WorkflowEvent
from app.services.unified_ledger import UnifiedAccountingLedgerService
from ..contracts import BaseDocumentLifecycleHandler
from ..registry import register_lifecycle_handler
from ..exceptions import (
    DocumentNotFoundException,
    HandlerValidationException,
    TenantIsolationException,
)


@register_lifecycle_handler("PurchaseBill", "PURCHASE_BILL", "purchase_bill", "PURCHASE_INVOICE", "purchase_invoice")
class PurchaseBillLifecycleHandler(BaseDocumentLifecycleHandler):
    """
    Authoritative Domain Lifecycle Handler for Supplier Purchase Bills / Commercial Invoices.
    Enforces multi-tenancy, supplier validation, 3-way match validation against GRN/PO,
    financial approval threshold gates, and cancellation immutability (is_deleted = False).
    """

    document_type = "PurchaseBill"

    def get_resource_name(self) -> str:
        return "purchase_bill"

    def get_document_summary(self, doc: PurchaseBill) -> Dict[str, Any]:
        return {
            "bill_no": getattr(doc, "bill_no", None),
            "supplier_id": getattr(doc, "supplier_id", None),
            "receipt_id": getattr(doc, "receipt_id", None),
            "order_id": getattr(doc, "order_id", None),
            "total_amount": str(getattr(doc, "total_amount", "0.00")),
            "status": getattr(doc, "status", None),
        }

    def get_document_amount(self, doc: PurchaseBill) -> Decimal:
        return Decimal(str(getattr(doc, "total_amount", Decimal("0.00"))))

    def get_current_status(self, doc: PurchaseBill) -> str:
        status = getattr(doc, "status", "DRAFT")
        return str(status).upper()

    def get_version(self, doc: PurchaseBill) -> int:
        return int(getattr(doc, "version", 1))

    def is_approval_action(self, action: str) -> bool:
        return action.upper() in ("APPROVE", "POST")

    def get_default_workflow_definition(self) -> Dict[str, Any]:
        return {
            "code": "WF_PURCHASE_BILL",
            "version": 1,
            "doc_type": "PurchaseBill",
            "initial_state": "DRAFT",
            "states": ["DRAFT", "SUBMITTED", "APPROVED", "POSTED", "PAID", "CANCELLED"],
            "transitions": [
                {"from": "DRAFT", "to": "SUBMITTED", "action": "SUBMIT", "required_roles": ["STORE_MANAGER", "ACCOUNTANT", "MANAGER", "SYSADMIN"]},
                {"from": "DRAFT", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["STORE_MANAGER", "ACCOUNTANT", "MANAGER", "SYSADMIN"]},
                {"from": "SUBMITTED", "to": "APPROVED", "action": "APPROVE", "required_roles": ["ACCOUNTANT", "MANAGER", "SYSADMIN"]},
                {"from": "SUBMITTED", "to": "DRAFT", "action": "REJECT", "required_roles": ["ACCOUNTANT", "MANAGER", "SYSADMIN"]},
                {"from": "SUBMITTED", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["MANAGER", "SYSADMIN"]},
                {"from": "APPROVED", "to": "POSTED", "action": "POST", "required_roles": ["ACCOUNTANT", "MANAGER", "SYSADMIN"]},
                {"from": "APPROVED", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["MANAGER", "SYSADMIN"]},
                {"from": "POSTED", "to": "PAID", "action": "PAY", "required_roles": ["ACCOUNTANT", "SYSADMIN"]},
                {"from": "POSTED", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["MANAGER", "SYSADMIN"]},
            ],
        }

    async def get_document(
        self,
        db: AsyncSession,
        doc_id: str,
        tenant_ctx: TenantContext
    ) -> PurchaseBill:
        """Safely loads a PurchaseBill enforcing multi-tenant isolation."""
        stmt = (
            select(PurchaseBill)
            .options(selectinload(PurchaseBill.items))
            .where(
                or_(
                    PurchaseBill.id == doc_id,
                    PurchaseBill.bill_no == doc_id,
                    PurchaseBill.identity_code == doc_id,
                )
            )
        )
        res = await db.execute(stmt)
        bill = res.scalars().first()
        if not bill:
            raise DocumentNotFoundException("PurchaseBill", doc_id)

        if bill.company_id != tenant_ctx.company_id:
            raise TenantIsolationException(doc_type="PurchaseBill", doc_id=doc_id)

        return bill

    async def validate_transition(
        self,
        db: AsyncSession,
        doc: PurchaseBill,
        action: str,
        next_state: str,
        user: User,
        tenant_ctx: TenantContext,
        payload: Dict[str, Any],
    ) -> None:
        """Domain validations for Purchase Bill lifecycle transitions including 3-way match."""
        if action == "CANCEL":
            if doc.status == "PAID":
                raise HandlerValidationException("Cannot cancel a PAID Purchase Bill. A debit note or payment reversal is required.", "PAID_CANNOT_CANCEL")
            reason = payload.get("reason") or payload.get("notes") or payload.get("cancellation_reason")
            if not reason or not str(reason).strip():
                raise HandlerValidationException("Cancellation requires a non-empty cancellation reason.", "REASON_REQUIRED")

        if action in ("SUBMIT", "APPROVE", "POST"):
            if doc.total_amount <= Decimal("0.00"):
                raise HandlerValidationException("Purchase Bill total amount must be greater than zero.", "INVALID_AMOUNT")

            # Validate supplier active state
            supp_res = await db.execute(
                select(Supplier).where(
                    Supplier.id == doc.supplier_id,
                    Supplier.company_id == tenant_ctx.company_id,
                )
            )
            supplier = supp_res.scalars().first()
            if not supplier:
                raise HandlerValidationException(f"Supplier '{doc.supplier_id}' not found.", "SUPPLIER_NOT_FOUND")

            # If linked to PO, ensure PO exists and belongs to same tenant
            if doc.order_id:
                po_res = await db.execute(
                    select(PurchaseOrder).where(
                        (PurchaseOrder.id == doc.order_id) | (PurchaseOrder.order_no == doc.order_id),
                        PurchaseOrder.company_id == tenant_ctx.company_id,
                    )
                )
                po = po_res.scalars().first()
                if not po:
                    raise HandlerValidationException(f"Linked Purchase Order '{doc.order_id}' not found.", "ORDER_NOT_FOUND")
                if (po.status or "").upper() == "CANCELLED":
                    raise HandlerValidationException(f"Linked Purchase Order '{po.order_no or doc.order_id}' is cancelled.", "LINKED_ORDER_CANCELLED")

            # If linked to GRN, ensure GRN exists and belongs to same tenant
            if doc.receipt_id:
                receipt_res = await db.execute(
                    select(PurchaseReceipt).where(
                        (PurchaseReceipt.id == doc.receipt_id) | (PurchaseReceipt.receipt_no == doc.receipt_id),
                        PurchaseReceipt.company_id == tenant_ctx.company_id,
                    )
                )
                receipt = receipt_res.scalars().first()
                if not receipt:
                    raise HandlerValidationException(f"Linked Goods Receipt '{doc.receipt_id}' not found.", "RECEIPT_NOT_FOUND")
                if receipt.status == "CANCELLED":
                    raise HandlerValidationException(f"Linked Goods Receipt '{receipt.receipt_no}' is cancelled.", "LINKED_RECEIPT_CANCELLED")

            # --- LINE-LEVEL 3-WAY VARIANCE MATCHING ---
            items = getattr(doc, "items", None)
            if not items:
                items_res = await db.execute(
                    select(PurchaseBillItem).where(
                        PurchaseBillItem.bill_id == doc.id,
                        PurchaseBillItem.is_deleted == False,
                    )
                )
                items = items_res.scalars().all()

            if items:
                # 1. Line sum verification (0.05 rounding tolerance)
                line_sum = sum([Decimal(str(it.total_amount)) for it in items])
                if abs(line_sum - doc.total_amount) > Decimal("0.05"):
                    raise HandlerValidationException(
                        f"Purchase Bill total amount ({doc.total_amount}) does not match sum of line items ({line_sum}).",
                        "3WAY_LINE_SUM_MISMATCH"
                    )

                # 2. Match against Linked PO Items (Quantities & Rates)
                if doc.order_id:
                    po_items_res = await db.execute(
                        select(PurchaseOrderItem).where(
                            PurchaseOrderItem.order_id == doc.order_id,
                            PurchaseOrderItem.is_deleted == False,
                        )
                    )
                    po_items = po_items_res.scalars().all()
                    po_map_by_id = {pi.id: pi for pi in po_items}
                    po_map_by_prod = {pi.product_id: pi for pi in po_items}

                    for it in items:
                        matched_po_item = po_map_by_id.get(it.po_item_id) or po_map_by_prod.get(it.product_id)
                        if matched_po_item:
                            if Decimal(str(it.quantity)) > Decimal(str(matched_po_item.quantity)):
                                raise HandlerValidationException(
                                    f"Billed quantity ({it.quantity}) exceeds ordered quantity ({matched_po_item.quantity}) for product '{it.name}'.",
                                    "3WAY_QTY_EXCEEDED"
                                )
                            if Decimal(str(it.rate)) > Decimal(str(matched_po_item.cost_price)):
                                raise HandlerValidationException(
                                    f"Billed rate ({it.rate}) exceeds agreed purchase order rate ({matched_po_item.cost_price}) for product '{it.name}'.",
                                    "3WAY_RATE_EXCEEDED"
                                )

                # 3. Match against Linked GRN Items (Received Quantities)
                if doc.receipt_id:
                    grn_items_res = await db.execute(
                        select(PurchaseReceiptItem).where(
                            PurchaseReceiptItem.receipt_id == doc.receipt_id,
                            PurchaseReceiptItem.is_deleted == False,
                        )
                    )
                    grn_items = grn_items_res.scalars().all()
                    grn_map_by_id = {gi.id: gi for gi in grn_items}
                    grn_map_by_prod = {gi.product_id: gi for gi in grn_items}

                    for it in items:
                        matched_grn_item = grn_map_by_id.get(it.receipt_item_id) or grn_map_by_prod.get(it.product_id)
                        if matched_grn_item:
                            if Decimal(str(it.quantity)) > Decimal(str(matched_grn_item.quantity_received)):
                                raise HandlerValidationException(
                                    f"Billed quantity ({it.quantity}) exceeds GRN received quantity ({matched_grn_item.quantity_received}) for product '{it.name}'.",
                                    "3WAY_QTY_EXCEEDED"
                                )

    async def apply_transition(
        self,
        db: AsyncSession,
        doc: PurchaseBill,
        action: str,
        next_state: str,
        user: User,
        tenant_ctx: TenantContext,
        payload: Dict[str, Any],
    ) -> None:
        """Applies state mutation to PurchaseBill entity atomically."""
        from_status = self.get_current_status(doc)
        doc.status = next_state
        now = datetime.now(timezone.utc)
        doc.version = (doc.version or 0) + 1
        doc.modified_at = now

        if action == "POST" or next_state == "POSTED":
            # Financial GL Posting via UnifiedAccountingLedgerService (Atomic, Fail-Fast)
            await UnifiedAccountingLedgerService.post_purchase_bill_to_gl(
                session=db,
                company_id=tenant_ctx.company_id,
                bill_id=doc.id,
                branch_id=tenant_ctx.branch_id or doc.branch_id,
                created_by=getattr(user, "username", None) or str(user.id),
            )

        elif action == "CANCEL":
            # MANDATORY INVARIANT: Cancelled records remain queryable
            doc.is_deleted = False
            doc.deleted_at = None
            doc.cancellation_reason = payload.get("reason") or payload.get("notes") or payload.get("cancellation_reason")

            # If the bill was already posted to GL, generate compensating reversal voucher
            if from_status in ("POSTED", "PAID"):
                await UnifiedAccountingLedgerService.reverse_purchase_bill_gl(
                    session=db,
                    company_id=tenant_ctx.company_id,
                    bill_id=doc.id,
                    branch_id=tenant_ctx.branch_id or doc.branch_id,
                    reason=doc.cancellation_reason,
                    cancelled_by=getattr(user, "username", None) or str(user.id),
                )

        elif action == "PAY":
            payment_amount = payload.get("amount") or doc.total_amount
            doc.paid_amount = Decimal(str(payment_amount))
