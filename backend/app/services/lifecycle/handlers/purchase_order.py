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
from app.models.purchase import PurchaseOrder, PurchaseOrderItem
from app.models.workflow import WorkflowEvent
from ..contracts import BaseDocumentLifecycleHandler
from ..registry import register_lifecycle_handler
from ..exceptions import (
    DocumentNotFoundException,
    HandlerValidationException,
    TenantIsolationException,
)


@register_lifecycle_handler("PurchaseOrder", "PURCHASE_ORDER", "purchase_order")
class PurchaseOrderLifecycleHandler(BaseDocumentLifecycleHandler):
    """
    Authoritative Domain Lifecycle Handler for Purchase Orders.
    Implements domain validation, audit stamping, revision chaining,
    and cancellation immutability (ensuring is_deleted = False).
    """

    document_type = "PurchaseOrder"

    def get_resource_name(self) -> str:
        return "purchase_order"

    def get_document_summary(self, doc: PurchaseOrder) -> Dict[str, Any]:
        return {
            "order_no": getattr(doc, "order_no", None),
            "amend_revision": getattr(doc, "amend_revision", 0),
        }

    def get_default_workflow_definition(self) -> Dict[str, Any]:
        return {
            "code": "WF_PURCHASE_ORDER",
            "version": 1,
            "doc_type": "PurchaseOrder",
            "initial_state": "DRAFT",
            "states": ["DRAFT", "SUBMITTED", "CONFIRMED", "RECEIVED", "COMPLETED", "CANCELLED"],
            "transitions": [
                {"from": "DRAFT", "to": "SUBMITTED", "action": "SUBMIT", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "DRAFT", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "SUBMITTED", "to": "CONFIRMED", "action": "CONFIRM", "required_roles": ["MANAGER", "SYSADMIN"]},
                {"from": "SUBMITTED", "to": "CONFIRMED", "action": "APPROVE", "required_roles": ["MANAGER", "SYSADMIN"]},
                {"from": "SUBMITTED", "to": "DRAFT", "action": "REJECT", "required_roles": ["MANAGER", "SYSADMIN"]},
                {"from": "SUBMITTED", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["MANAGER", "SYSADMIN"]},
                {"from": "CONFIRMED", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["MANAGER", "SYSADMIN"]},
                {"from": "CONFIRMED", "to": "CONFIRMED", "action": "AMEND", "required_roles": ["MANAGER", "SYSADMIN"]},
                {"from": "CONFIRMED", "to": "RECEIVED", "action": "RECEIVE", "required_roles": ["STORE_MANAGER", "SYSADMIN"]},
                {"from": "RECEIVED", "to": "COMPLETED", "action": "COMPLETE", "required_roles": ["ACCOUNTANT", "MANAGER", "SYSADMIN"]},
            ],
        }

    async def get_document(
        self,
        db: AsyncSession,
        doc_id: str,
        tenant_ctx: TenantContext
    ) -> PurchaseOrder:
        """Safely loads a PurchaseOrder enforcing multi-tenant isolation."""
        stmt = (
            select(PurchaseOrder)
            .where(
                PurchaseOrder.id == doc_id,
                PurchaseOrder.company_id == tenant_ctx.company_id,
            )
        )
        res = await db.execute(stmt)
        order = res.scalars().first()
        if not order:
            raise DocumentNotFoundException(self.document_type, doc_id)
        return order

    def get_current_status(self, doc: PurchaseOrder) -> str:
        return str(doc.status or "DRAFT").strip().upper()

    def get_version(self, doc: PurchaseOrder) -> int:
        return int(getattr(doc, "version", 1))

    def get_document_amount(self, doc: PurchaseOrder) -> Decimal:
        if doc.grand_total is not None:
            return Decimal(str(doc.grand_total))
        return Decimal("0.00")

    async def validate_transition(
        self,
        db: AsyncSession,
        doc: PurchaseOrder,
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
                    f"Only DRAFT purchase orders can be submitted. Current status: {curr_state}."
                )
            # Verify lines exist
            q_items = select(PurchaseOrderItem).where(PurchaseOrderItem.order_id == doc.id)
            items_res = await db.execute(q_items)
            items = items_res.scalars().all()
            if not items and not getattr(doc, "items", None) and (doc.grand_total or Decimal("0")) <= Decimal("0"):
                raise HandlerValidationException("Cannot submit a purchase order with zero line items.")

        elif act in ("CONFIRM", "APPROVE"):
            if curr_state != "SUBMITTED":
                raise HandlerValidationException(
                    f"Only SUBMITTED purchase orders can be confirmed. Current status: {curr_state}."
                )

        elif act == "REJECT":
            if curr_state != "SUBMITTED":
                raise HandlerValidationException(
                    f"Only SUBMITTED purchase orders can be rejected. Current status: {curr_state}."
                )

        elif act == "CANCEL":
            if curr_state == "CANCELLED":
                raise HandlerValidationException("This purchase order is already cancelled.")
            if curr_state in ("RECEIVED", "COMPLETED"):
                raise HandlerValidationException(
                    "A received or completed purchase order cannot be cancelled. Please raise a return/debit note instead."
                )

        elif act == "AMEND":
            if curr_state != "CONFIRMED":
                raise HandlerValidationException(
                    f"Only CONFIRMED purchase orders can be amended. Current status: {curr_state}."
                )

    async def apply_transition(
        self,
        db: AsyncSession,
        doc: PurchaseOrder,
        action: str,
        next_state: str,
        user: User,
        tenant_ctx: TenantContext,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        act = action.strip().upper()
        now = datetime.now(timezone.utc)
        actor_name = (
            getattr(user, "username", None)
            or getattr(user, "email", None)
            or getattr(user, "name", None)
            or str(getattr(user, "id", ""))
        )
        payload = payload or {}

        # Update canonical status
        doc.status = next_state
        doc.modified_at = now
        # GUARANTEE: Never soft-delete on business lifecycle transition
        doc.is_deleted = False

        if act == "SUBMIT":
            doc.submitted_by = actor_name
            doc.submitted_at = now

        elif act in ("CONFIRM", "APPROVE"):
            doc.confirmed_by = actor_name
            doc.confirmed_at = now
            notes = payload.get("notes")
            if notes:
                doc.notes = f"{doc.notes or ''} | Confirmed: {notes}".strip(" |")

        elif act == "REJECT":
            reason = payload.get("reason") or "Rejected by manager"
            doc.notes = f"{doc.notes or ''} | Rejected: {reason}".strip(" |")

        elif act == "CANCEL":
            doc.cancelled_by = actor_name
            doc.cancelled_at = now
            reason = payload.get("reason")
            reason_code = payload.get("reason_code")
            if reason_code and hasattr(doc, "cancellation_reason_code"):
                doc.cancellation_reason_code = str(reason_code).strip().upper()
            if reason:
                doc.cancellation_reason = reason
                doc.notes = f"{doc.notes or ''} | Cancelled: {reason}".strip(" |")
            elif reason_code:
                doc.cancellation_reason = str(reason_code)
                doc.notes = f"{doc.notes or ''} | Cancelled: {reason_code}".strip(" |")

        elif act == "AMEND":
            # Predecessor update: mark as CANCELLED/Superseded
            doc.status = "CANCELLED"
            doc.amended_by = actor_name
            doc.amended_at = now
            doc.is_deleted = False
            rev = (doc.amend_revision or 0) + 1
            doc.notes = f"{doc.notes or ''} | Amended & Superseded by revision {rev}".strip(" |")

        db.add(doc)
