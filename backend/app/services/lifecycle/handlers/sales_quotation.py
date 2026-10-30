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
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import TenantContext
from app.models.auth import User
from app.models.sales import SalesQuotation, SalesQuotationItem
from app.models.workflow import WorkflowEvent
from ..contracts import BaseDocumentLifecycleHandler
from ..registry import register_lifecycle_handler
from ..exceptions import (
    DocumentNotFoundException,
    HandlerValidationException,
    TenantIsolationException,
)


@register_lifecycle_handler("SalesQuotation", "SALES_QUOTATION", "sales_quotation")
class SalesQuotationLifecycleHandler(BaseDocumentLifecycleHandler):
    """
    Authoritative Domain Lifecycle Handler for Sales Quotations / Estimates.
    Enforces multi-tenant isolation, line item integrity, quote-to-conversion tracking,
    and cancellation immutability (ensuring is_deleted = False).
    """

    document_type = "SalesQuotation"

    def get_resource_name(self) -> str:
        return "sales_quotation"

    def get_document_summary(self, doc: SalesQuotation) -> Dict[str, Any]:
        return {
            "quotation_no": getattr(doc, "quotation_no", None),
            "customer_name": getattr(doc, "customer_name", None),
            "grand_total": str(getattr(doc, "grand_total", "0.00")),
            "valid_until": str(getattr(doc, "valid_until", "")),
        }

    def get_default_workflow_definition(self) -> Dict[str, Any]:
        return {
            "code": "WF_SALES_QUOTATION",
            "version": 1,
            "doc_type": "SalesQuotation",
            "initial_state": "DRAFT",
            "states": ["DRAFT", "SENT", "ACCEPTED", "CONVERTED", "EXPIRED", "CANCELLED"],
            "transitions": [
                {"from": "DRAFT", "to": "SENT", "action": "SEND", "required_roles": ["CASHIER", "STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "DRAFT", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "SENT", "to": "ACCEPTED", "action": "ACCEPT", "required_roles": ["CASHIER", "STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "SENT", "to": "EXPIRED", "action": "EXPIRE", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "SENT", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "ACCEPTED", "to": "CONVERTED", "action": "CONVERT", "required_roles": ["CASHIER", "STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "ACCEPTED", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
            ],
        }

    async def get_document(
        self,
        db: AsyncSession,
        doc_id: str,
        tenant_ctx: TenantContext
    ) -> SalesQuotation:
        """Safely loads a SalesQuotation enforcing multi-tenant isolation."""
        stmt = (
            select(SalesQuotation)
            .where(
                SalesQuotation.id == doc_id,
                SalesQuotation.company_id == tenant_ctx.company_id,
            )
            .options(selectinload(SalesQuotation.items))
        )
        res = await db.execute(stmt)
        quote = res.scalars().first()
        if not quote:
            raise DocumentNotFoundException(self.document_type, doc_id)
        return quote

    def get_current_status(self, doc: SalesQuotation) -> str:
        return str(doc.status or "DRAFT").strip().upper()

    def get_version(self, doc: SalesQuotation) -> int:
        return int(getattr(doc, "version", 1))

    def get_document_amount(self, doc: SalesQuotation) -> Decimal:
        if doc.grand_total is not None:
            return Decimal(str(doc.grand_total))
        return Decimal("0.00")

    async def validate_transition(
        self,
        db: AsyncSession,
        doc: SalesQuotation,
        action: str,
        next_state: str,
        user: User,
        tenant_ctx: TenantContext,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        act = action.strip().upper()
        curr_state = self.get_current_status(doc)

        if act == "SEND":
            if curr_state != "DRAFT":
                raise HandlerValidationException(
                    f"Only DRAFT quotations can be sent. Current status: {curr_state}."
                )
            # Verify line items exist
            q_items = select(SalesQuotationItem).where(
                SalesQuotationItem.quotation_id == doc.id,
                SalesQuotationItem.is_deleted == False
            )
            items = (await db.execute(q_items)).scalars().all()
            if not items and not getattr(doc, "items", None):
                raise HandlerValidationException("Cannot send a sales quotation with zero line items.")

        elif act == "ACCEPT":
            if curr_state != "SENT":
                raise HandlerValidationException(
                    f"Only SENT quotations can be accepted. Current status: {curr_state}."
                )

        elif act == "CONVERT":
            if curr_state != "ACCEPTED":
                raise HandlerValidationException(
                    f"Only ACCEPTED quotations can be converted to an order or invoice. Current status: {curr_state}."
                )

        elif act == "EXPIRE":
            if curr_state != "SENT":
                raise HandlerValidationException(
                    f"Only SENT quotations can be expired. Current status: {curr_state}."
                )

        elif act == "CANCEL":
            if curr_state == "CANCELLED":
                raise HandlerValidationException("This quotation is already cancelled.")
            if curr_state == "CONVERTED":
                raise HandlerValidationException(
                    "A converted quotation cannot be cancelled directly. Modify or cancel the resulting transaction."
                )

    async def apply_transition(
        self,
        db: AsyncSession,
        doc: SalesQuotation,
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
        # GUARANTEE: Never soft-delete on business lifecycle transition
        doc.is_deleted = False
        doc.version = (doc.version or 0) + 1

        db.add(doc)
