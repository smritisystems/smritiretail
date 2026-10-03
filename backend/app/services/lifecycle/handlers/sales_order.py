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
from app.models.sales import SalesOrder, SalesOrderItem, SalesOrderReservation
from app.models.workflow import WorkflowEvent
from ..contracts import BaseDocumentLifecycleHandler
from ..registry import register_lifecycle_handler
from ..exceptions import (
    DocumentNotFoundException,
    HandlerValidationException,
    TenantIsolationException,
)


@register_lifecycle_handler("SalesOrder", "SALES_ORDER", "sales_order")
class SalesOrderLifecycleHandler(BaseDocumentLifecycleHandler):
    """
    Authoritative Domain Lifecycle Handler for Sales Orders.
    Implements multi-tenant isolation, line item validation, reservation lifecycle,
    and cancellation immutability (ensuring is_deleted = False).
    """

    document_type = "SalesOrder"

    def get_resource_name(self) -> str:
        return "sales_order"

    def get_document_summary(self, doc: SalesOrder) -> Dict[str, Any]:
        return {
            "order_no": getattr(doc, "order_no", None),
            "customer_name": getattr(doc, "customer_name", None),
            "grand_total": str(getattr(doc, "grand_total", "0.00")),
            "fulfillment_status": getattr(doc, "fulfillment_status", None),
        }

    def get_default_workflow_definition(self) -> Dict[str, Any]:
        return {
            "code": "WF_SALES_ORDER",
            "version": 1,
            "doc_type": "SalesOrder",
            "initial_state": "DRAFT",
            "states": ["DRAFT", "SUBMITTED", "CONFIRMED", "ALLOCATED", "DELIVERED", "CANCELLED"],
            "transitions": [
                {"from": "DRAFT", "to": "SUBMITTED", "action": "SUBMIT", "required_roles": ["CASHIER", "STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "DRAFT", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "SUBMITTED", "to": "CONFIRMED", "action": "CONFIRM", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "SUBMITTED", "to": "CONFIRMED", "action": "APPROVE", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "SUBMITTED", "to": "DRAFT", "action": "REJECT", "required_roles": ["MANAGER", "SYSADMIN"]},
                {"from": "SUBMITTED", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["MANAGER", "SYSADMIN"]},
                {"from": "CONFIRMED", "to": "ALLOCATED", "action": "ALLOCATE", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "CONFIRMED", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["MANAGER", "SYSADMIN"]},
                {"from": "ALLOCATED", "to": "DELIVERED", "action": "DELIVER", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "ALLOCATED", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["MANAGER", "SYSADMIN"]},
            ],
        }

    async def get_document(
        self,
        db: AsyncSession,
        doc_id: str,
        tenant_ctx: TenantContext
    ) -> SalesOrder:
        """Safely loads a SalesOrder enforcing multi-tenant isolation."""
        stmt = (
            select(SalesOrder)
            .where(
                SalesOrder.id == doc_id,
                SalesOrder.company_id == tenant_ctx.company_id,
            )
            .options(selectinload(SalesOrder.items))
        )
        res = await db.execute(stmt)
        order = res.scalars().first()
        if not order:
            raise DocumentNotFoundException(self.document_type, doc_id)
        return order

    def get_current_status(self, doc: SalesOrder) -> str:
        return str(doc.status or "DRAFT").strip().upper()

    def get_version(self, doc: SalesOrder) -> int:
        return int(getattr(doc, "version", 1))

    def get_document_amount(self, doc: SalesOrder) -> Decimal:
        if doc.grand_total is not None:
            return Decimal(str(doc.grand_total))
        return Decimal("0.00")

    async def validate_transition(
        self,
        db: AsyncSession,
        doc: SalesOrder,
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
                    f"Only DRAFT sales orders can be submitted. Current status: {curr_state}."
                )
            # Verify lines exist
            q_items = select(SalesOrderItem).where(
                SalesOrderItem.order_id == doc.id,
                SalesOrderItem.is_deleted == False
            )
            items_res = await db.execute(q_items)
            items = items_res.scalars().all()
            if not items and not getattr(doc, "items", None):
                raise HandlerValidationException("Cannot submit a sales order with zero line items.")

        elif act in ("CONFIRM", "APPROVE"):
            if curr_state != "SUBMITTED":
                raise HandlerValidationException(
                    f"Only SUBMITTED sales orders can be confirmed. Current status: {curr_state}."
                )

        elif act == "REJECT":
            if curr_state != "SUBMITTED":
                raise HandlerValidationException(
                    f"Only SUBMITTED sales orders can be rejected. Current status: {curr_state}."
                )

        elif act == "CANCEL":
            if curr_state == "CANCELLED":
                raise HandlerValidationException("This sales order is already cancelled.")
            if curr_state == "DELIVERED":
                raise HandlerValidationException(
                    "A delivered sales order cannot be cancelled. Please process a sales return instead."
                )

        elif act == "ALLOCATE":
            if curr_state != "CONFIRMED":
                raise HandlerValidationException(
                    f"Only CONFIRMED sales orders can be allocated. Current status: {curr_state}."
                )

        elif act == "DELIVER":
            if curr_state not in ("ALLOCATED", "CONFIRMED"):
                raise HandlerValidationException(
                    f"Only ALLOCATED or CONFIRMED sales orders can be delivered. Current status: {curr_state}."
                )

    async def apply_transition(
        self,
        db: AsyncSession,
        doc: SalesOrder,
        action: str,
        next_state: str,
        user: User,
        tenant_ctx: TenantContext,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        act = action.strip().upper()
        now = datetime.now(timezone.utc)
        payload = payload or {}

        # Update canonical status
        doc.status = next_state
        doc.modified_at = now
        # GUARANTEE: Never soft-delete on business lifecycle transition
        doc.is_deleted = False
        doc.version = (doc.version or 0) + 1

        if act == "CANCEL":
            # Release any active inventory reservations
            q_res = select(SalesOrderReservation).where(
                SalesOrderReservation.order_id == doc.id,
                SalesOrderReservation.company_id == tenant_ctx.company_id,
                SalesOrderReservation.status.in_(["ACTIVE", "PARTIAL"]),
                SalesOrderReservation.is_deleted == False
            )
            active_res = (await db.execute(q_res)).scalars().all()
            for r in active_res:
                r.status = "RELEASED"
                r.released_quantity = r.reserved_quantity
                r.release_reason = payload.get("reason") or "Order cancelled"
                r.modified_at = now
                db.add(r)

            # Mark order items cancelled
            q_items = select(SalesOrderItem).where(
                SalesOrderItem.order_id == doc.id,
                SalesOrderItem.is_deleted == False
            )
            items = (await db.execute(q_items)).scalars().all()
            for it in items:
                it.line_status = "CANCELLED"
                it.closure_reason = payload.get("reason") or "Order cancelled"
                it.closed_at = now
                it.closed_by = getattr(user, "username", None) or str(user.id)
                db.add(it)

        elif act == "ALLOCATE":
            doc.fulfillment_status = "ALLOCATED"

        elif act == "DELIVER":
            doc.fulfillment_status = "FULLY_BILLED"

        db.add(doc)
