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
from app.models.fulfillment import PackingSlip, PackingSlipItem, Dispatch, DispatchItem
from app.models.sales import SalesInvoice
from app.models.workflow import WorkflowEvent
from app.services.sales_stock_authority import SalesStockAuthority
from ..contracts import BaseDocumentLifecycleHandler
from ..registry import register_lifecycle_handler
from ..exceptions import (
    DocumentNotFoundException,
    HandlerValidationException,
    TenantIsolationException,
)


@register_lifecycle_handler("PackingSlip", "PACKING_SLIP", "packing_slip")
class PackingSlipLifecycleHandler(BaseDocumentLifecycleHandler):
    """
    Authoritative Domain Lifecycle Handler for Packing Slips / Pick Lists.
    Enforces multi-tenancy, item integrity, and state transitions.
    """

    document_type = "PackingSlip"

    def get_resource_name(self) -> str:
        return "packing_slip"

    def get_document_summary(self, doc: PackingSlip) -> Dict[str, Any]:
        return {
            "packing_slip_number": getattr(doc, "packing_slip_number", None),
            "sales_invoice_id": getattr(doc, "sales_invoice_id", None),
            "status": getattr(doc, "status", None),
            "total_packages": getattr(doc, "total_packages", 1),
        }

    def get_default_workflow_definition(self) -> Dict[str, Any]:
        return {
            "code": "WF_PACKING_SLIP",
            "version": 1,
            "doc_type": "PackingSlip",
            "initial_state": "DRAFT",
            "states": ["DRAFT", "PENDING", "PACKED", "CANCELLED"],
            "transitions": [
                {"from": "DRAFT", "to": "PACKED", "action": "PACK", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "DRAFT", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "PENDING", "to": "PACKED", "action": "PACK", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "PENDING", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "PACKED", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["MANAGER", "SYSADMIN"]},
            ],
        }

    async def get_document(
        self,
        db: AsyncSession,
        doc_id: str,
        tenant_ctx: TenantContext
    ) -> PackingSlip:
        """Safely loads a PackingSlip enforcing multi-tenant isolation."""
        stmt = (
            select(PackingSlip)
            .where(
                PackingSlip.id == doc_id,
                PackingSlip.company_id == tenant_ctx.company_id,
            )
            .options(selectinload(PackingSlip.items))
        )
        res = await db.execute(stmt)
        ps = res.scalars().first()
        if not ps:
            raise DocumentNotFoundException(self.document_type, doc_id)
        return ps

    def get_current_status(self, doc: PackingSlip) -> str:
        return str(doc.status or "DRAFT").strip().upper()

    def get_version(self, doc: PackingSlip) -> int:
        return int(getattr(doc, "version", 1))

    async def validate_transition(
        self,
        db: AsyncSession,
        doc: PackingSlip,
        action: str,
        next_state: str,
        user: User,
        tenant_ctx: TenantContext,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        act = action.strip().upper()
        curr_state = self.get_current_status(doc)

        if act == "PACK":
            if curr_state not in ("DRAFT", "PENDING"):
                raise HandlerValidationException(
                    f"Only DRAFT or PENDING packing slips can be packed. Current status: {curr_state}."
                )

        elif act == "CANCEL":
            if curr_state == "CANCELLED":
                raise HandlerValidationException("This packing slip is already cancelled.")

    async def apply_transition(
        self,
        db: AsyncSession,
        doc: PackingSlip,
        action: str,
        next_state: str,
        user: User,
        tenant_ctx: TenantContext,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        doc.status = next_state
        doc.modified_at = datetime.now(timezone.utc)
        doc.is_deleted = False
        doc.version = (doc.version or 0) + 1
        db.add(doc)


@register_lifecycle_handler("Dispatch", "DISPATCH", "dispatch")
class DispatchLifecycleHandler(BaseDocumentLifecycleHandler):
    """
    Authoritative Domain Lifecycle Handler for Logistics Dispatch & Delivery Manifests.
    Coordinates courier tracking, delivery confirmation, and double-deduction-safe stock deduction.
    """

    document_type = "Dispatch"

    def get_resource_name(self) -> str:
        return "dispatch"

    def get_document_summary(self, doc: Dispatch) -> Dict[str, Any]:
        return {
            "dispatch_number": getattr(doc, "dispatch_number", None),
            "tracking_number": getattr(doc, "tracking_number", None),
            "courier_partner": getattr(doc, "courier_partner", None),
            "status": getattr(doc, "status", None),
        }

    def get_default_workflow_definition(self) -> Dict[str, Any]:
        return {
            "code": "WF_DISPATCH",
            "version": 1,
            "doc_type": "Dispatch",
            "initial_state": "DRAFT",
            "states": ["DRAFT", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "RETURNED", "CANCELLED"],
            "transitions": [
                {"from": "DRAFT", "to": "DISPATCHED", "action": "DISPATCH", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "DRAFT", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "DISPATCHED", "to": "IN_TRANSIT", "action": "TRANSIT", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "DISPATCHED", "to": "DELIVERED", "action": "DELIVER", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "DISPATCHED", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["MANAGER", "SYSADMIN"]},
                {"from": "IN_TRANSIT", "to": "DELIVERED", "action": "DELIVER", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "IN_TRANSIT", "to": "RETURNED", "action": "RETURN", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "IN_TRANSIT", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["MANAGER", "SYSADMIN"]},
            ],
        }

    async def get_document(
        self,
        db: AsyncSession,
        doc_id: str,
        tenant_ctx: TenantContext
    ) -> Dispatch:
        """Safely loads a Dispatch enforcing multi-tenant isolation."""
        stmt = (
            select(Dispatch)
            .where(
                Dispatch.id == doc_id,
                Dispatch.company_id == tenant_ctx.company_id,
            )
            .options(selectinload(Dispatch.items))
        )
        res = await db.execute(stmt)
        disp = res.scalars().first()
        if not disp:
            raise DocumentNotFoundException(self.document_type, doc_id)
        return disp

    def get_current_status(self, doc: Dispatch) -> str:
        return str(doc.status or "DRAFT").strip().upper()

    def get_version(self, doc: Dispatch) -> int:
        return int(getattr(doc, "version", 1))

    async def validate_transition(
        self,
        db: AsyncSession,
        doc: Dispatch,
        action: str,
        next_state: str,
        user: User,
        tenant_ctx: TenantContext,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        act = action.strip().upper()
        curr_state = self.get_current_status(doc)

        if act == "DISPATCH":
            if curr_state != "DRAFT":
                raise HandlerValidationException(
                    f"Only DRAFT dispatches can be marked as DISPATCHED. Current status: {curr_state}."
                )

        elif act == "CANCEL":
            if curr_state == "CANCELLED":
                raise HandlerValidationException("This dispatch is already cancelled.")
            if curr_state == "DELIVERED":
                raise HandlerValidationException("A delivered dispatch cannot be cancelled.")

    async def apply_transition(
        self,
        db: AsyncSession,
        doc: Dispatch,
        action: str,
        next_state: str,
        user: User,
        tenant_ctx: TenantContext,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        act = action.strip().upper()
        now = datetime.now(timezone.utc)
        payload = payload or {}

        doc.status = next_state
        doc.modified_at = now
        doc.is_deleted = False
        doc.version = (doc.version or 0) + 1

        if act == "DISPATCH":
            doc.dispatch_date = now
            # Find linked invoice via packing slip if available to prevent double deduction
            invoice_id = None
            if doc.packing_slip_id:
                ps_res = await db.execute(
                    select(PackingSlip).where(PackingSlip.id == doc.packing_slip_id)
                )
                ps = ps_res.scalars().first()
                if ps:
                    invoice_id = ps.sales_invoice_id

            # Deduct stock safely (SalesStockAuthority automatically checks if invoice already deducted stock!)
            disp_items_res = await db.execute(
                select(DispatchItem).where(
                    DispatchItem.dispatch_id == doc.id,
                    DispatchItem.is_deleted == False
                )
            )
            disp_items = disp_items_res.scalars().all()
            lines = [
                {"product_id": it.product_id, "quantity": it.quantity}
                for it in disp_items
            ]
            await SalesStockAuthority.record_dispatch_outward(
                session=db,
                tenant_ctx=tenant_ctx,
                dispatch_id=doc.id,
                dispatch_no=doc.dispatch_number,
                packing_slip_id=doc.packing_slip_id,
                items=lines,
                invoice_id=invoice_id,
                user_id=getattr(user, "username", None) or str(user.id),
            )

        elif act == "DELIVER":
            doc.delivered_date = now

        db.add(doc)
