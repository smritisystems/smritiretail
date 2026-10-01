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
from app.models.purchase import PurchaseReceipt, PurchaseReceiptItem, PurchaseOrder
from app.models.goods_receipt import GoodsReceiptNote, GoodsReceiptLine
from app.models.workflow import WorkflowEvent
from ..contracts import BaseDocumentLifecycleHandler
from ..registry import register_lifecycle_handler
from ..exceptions import (
    DocumentNotFoundException,
    HandlerValidationException,
    TenantIsolationException,
)


@register_lifecycle_handler("GoodsReceipt", "GOODS_RECEIPT", "goods_receipt", "GRN", "PURCHASE_RECEIPT", "purchase_receipt")
class GoodsReceiptLifecycleHandler(BaseDocumentLifecycleHandler):
    """
    Authoritative Domain Lifecycle Handler for Goods Receipt Notes (GRN).
    Supports polymorphic document loading across PurchaseReceipt and GoodsReceiptNote,
    enforcing multi-tenancy, stock movement verification, linked purchase order checks,
    and cancellation immutability (is_deleted = False).
    """

    document_type = "GoodsReceipt"

    def get_resource_name(self) -> str:
        return "goods_receipt"

    def get_document_summary(self, doc: Any) -> Dict[str, Any]:
        return {
            "receipt_no": getattr(doc, "receipt_no", getattr(doc, "grn_number", None)),
            "supplier_id": getattr(doc, "supplier_id", getattr(doc, "vendor_id", None)),
            "order_id": getattr(doc, "order_id", getattr(doc, "primary_po_id", None)),
            "status": getattr(doc, "status", None),
        }

    def get_document_amount(self, doc: Any) -> Decimal:
        return Decimal(str(getattr(doc, "grand_total", getattr(doc, "total_landed", getattr(doc, "total_taxable", 0.00)))))

    def get_current_status(self, doc: Any) -> str:
        status = getattr(doc, "status", "DRAFT")
        return str(status).upper()

    def get_version(self, doc: Any) -> int:
        return int(getattr(doc, "version", 1))

    def get_default_workflow_definition(self) -> Dict[str, Any]:
        return {
            "code": "WF_GOODS_RECEIPT",
            "version": 1,
            "doc_type": "GoodsReceipt",
            "initial_state": "DRAFT",
            "states": ["DRAFT", "SUBMITTED", "CONFIRMED", "RECEIVED", "COMPLETED", "CANCELLED"],
            "transitions": [
                {"from": "DRAFT", "to": "SUBMITTED", "action": "SUBMIT", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "DRAFT", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "SUBMITTED", "to": "CONFIRMED", "action": "CONFIRM", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "SUBMITTED", "to": "RECEIVED", "action": "RECEIVE", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "SUBMITTED", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "CONFIRMED", "to": "RECEIVED", "action": "RECEIVE", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "CONFIRMED", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "RECEIVED", "to": "COMPLETED", "action": "COMPLETE", "required_roles": ["ACCOUNTANT", "MANAGER", "SYSADMIN"]},
                {"from": "RECEIVED", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["MANAGER", "SYSADMIN"]},
            ],
        }

    async def get_document(
        self,
        db: AsyncSession,
        doc_id: str,
        tenant_ctx: TenantContext
    ) -> Any:
        """
        Safely loads a GRN document enforcing multi-tenant isolation.
        Searches PurchaseReceipt first, falling back to GoodsReceiptNote.
        """
        # 1. Search PurchaseReceipt
        stmt_pr = (
            select(PurchaseReceipt)
            .options(selectinload(PurchaseReceipt.items))
            .where(
                or_(
                    PurchaseReceipt.id == doc_id,
                    PurchaseReceipt.receipt_no == doc_id,
                    PurchaseReceipt.identity_code == doc_id,
                )
            )
        )
        res_pr = await db.execute(stmt_pr)
        pr = res_pr.scalars().first()
        if pr:
            if pr.company_id != tenant_ctx.company_id:
                raise TenantIsolationException(doc_type="GoodsReceipt", doc_id=doc_id)
            return pr

        # 2. Search GoodsReceiptNote
        stmt_grn = (
            select(GoodsReceiptNote)
            .options(selectinload(GoodsReceiptNote.lines))
            .where(
                or_(
                    GoodsReceiptNote.id == doc_id,
                    GoodsReceiptNote.grn_number == doc_id,
                    GoodsReceiptNote.uuid == doc_id,
                )
            )
        )
        res_grn = await db.execute(stmt_grn)
        grn = res_grn.scalars().first()
        if grn:
            if grn.company_id != tenant_ctx.company_id:
                raise TenantIsolationException(doc_type="GoodsReceipt", doc_id=doc_id)
            return grn

        raise DocumentNotFoundException("GoodsReceipt", doc_id)

    async def validate_transition(
        self,
        db: AsyncSession,
        doc: Any,
        action: str,
        next_state: str,
        user: User,
        tenant_ctx: TenantContext,
        payload: Dict[str, Any],
    ) -> None:
        """Domain validations for Goods Receipt transitions."""
        if action == "CANCEL":
            reason = payload.get("reason") or payload.get("notes") or payload.get("cancellation_reason")
            if not reason or not str(reason).strip():
                raise HandlerValidationException("Cancellation requires a non-empty cancellation reason.", "REASON_REQUIRED")

        if action in ("RECEIVE", "CONFIRM"):
            items = getattr(doc, "items", getattr(doc, "lines", []))
            if not items:
                raise HandlerValidationException("Cannot receive GRN without line items.", "EMPTY_ITEMS")

            po_id = getattr(doc, "order_id", getattr(doc, "primary_po_id", None))
            if po_id:
                po_res = await db.execute(
                    select(PurchaseOrder).where(
                        (PurchaseOrder.id == po_id) | (PurchaseOrder.order_no == po_id) | (PurchaseOrder.identity_code == po_id),
                        PurchaseOrder.company_id == tenant_ctx.company_id,
                    )
                )
                po = po_res.scalars().first()
                if po and (po.status or "").upper() == "CANCELLED":
                    raise HandlerValidationException(f"Linked Purchase Order '{po.order_no or po_id}' is cancelled.", "LINKED_PO_CANCELLED")

    async def apply_transition(
        self,
        db: AsyncSession,
        doc: Any,
        action: str,
        next_state: str,
        user: User,
        tenant_ctx: TenantContext,
        payload: Dict[str, Any],
    ) -> None:
        """Applies state mutation to GRN entity atomically."""
        doc.status = next_state
        now = datetime.now(timezone.utc)

        if hasattr(doc, "version"):
            doc.version = (doc.version or 0) + 1
        if hasattr(doc, "modified_at"):
            doc.modified_at = now
        if hasattr(doc, "modified_by"):
            doc.modified_by = getattr(user, "username", str(user.id))

        if action == "CANCEL":
            # MANDATORY INVARIANT: Cancelled records remain queryable
            if hasattr(doc, "is_deleted"):
                doc.is_deleted = False
            if hasattr(doc, "deleted_at"):
                doc.deleted_at = None

            reason = payload.get("reason") or payload.get("notes") or payload.get("cancellation_reason")
            if hasattr(doc, "rejection_reason"):
                doc.rejection_reason = reason
            if hasattr(doc, "cancelled_by"):
                doc.cancelled_by = getattr(user, "username", str(user.id))
            if hasattr(doc, "cancelled_at"):
                doc.cancelled_at = now

        elif action == "RECEIVE":
            if hasattr(doc, "received_date") and not doc.received_date:
                doc.received_date = now.date()
            if hasattr(doc, "posted_at"):
                doc.posted_at = now
            if hasattr(doc, "posted_by"):
                doc.posted_by = getattr(user, "username", str(user.id))

            # If linked to a PO, update PO status to RECEIVED
            po_id = getattr(doc, "order_id", getattr(doc, "primary_po_id", None))
            if po_id:
                po_res = await db.execute(
                    select(PurchaseOrder).where(
                        (PurchaseOrder.id == po_id) | (PurchaseOrder.order_no == po_id) | (PurchaseOrder.identity_code == po_id),
                        PurchaseOrder.company_id == tenant_ctx.company_id,
                    )
                )
                po = po_res.scalars().first()
                if po and po.status in ("CONFIRMED", "SUBMITTED"):
                    po.status = "RECEIVED"
                    po.modified_at = now
