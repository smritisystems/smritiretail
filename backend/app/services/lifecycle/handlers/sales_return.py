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

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import TenantContext
from app.models.auth import User
from app.models.sales import SalesReturn, SalesReturnItem
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


@register_lifecycle_handler("SalesReturn", "SALES_RETURN", "sales_return")
class SalesReturnLifecycleHandler(BaseDocumentLifecycleHandler):
    """
    Authoritative Domain Lifecycle Handler for Customer Sales Returns / Credit Notes.
    Enforces multi-tenancy, item integrity, restocking via SalesStockAuthority,
    credit note GL posting via UnifiedAccountingLedgerService, and cancellation immutability.
    """

    document_type = "SalesReturn"

    def get_resource_name(self) -> str:
        return "sales_return"

    def get_document_summary(self, doc: SalesReturn) -> Dict[str, Any]:
        return {
            "return_no": getattr(doc, "return_no", None),
            "customer_name": getattr(doc, "customer_name", None),
            "original_invoice_no": getattr(doc, "original_invoice_no", None),
            "grand_total": str(getattr(doc, "grand_total", "0.00")),
            "status": getattr(doc, "status", None),
        }

    def get_document_amount(self, doc: SalesReturn) -> Decimal:
        if doc.grand_total is not None:
            return Decimal(str(doc.grand_total))
        return Decimal("0.00")

    def get_current_status(self, doc: SalesReturn) -> str:
        return str(doc.status or "DRAFT").strip().upper()

    def get_version(self, doc: SalesReturn) -> int:
        return int(getattr(doc, "version", 1))

    def is_approval_action(self, action: str) -> bool:
        return action.strip().upper() in ("APPROVE", "PROCESS")

    def get_default_workflow_definition(self) -> Dict[str, Any]:
        return {
            "code": "WF_SALES_RETURN",
            "version": 1,
            "doc_type": "SalesReturn",
            "initial_state": "DRAFT",
            "states": ["DRAFT", "SUBMITTED", "APPROVED", "PROCESSED", "CANCELLED"],
            "transitions": [
                {"from": "DRAFT", "to": "SUBMITTED", "action": "SUBMIT", "required_roles": ["CASHIER", "STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "DRAFT", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "SUBMITTED", "to": "APPROVED", "action": "APPROVE", "required_roles": ["STORE_MANAGER", "MANAGER", "SYSADMIN"]},
                {"from": "SUBMITTED", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["MANAGER", "SYSADMIN"]},
                {"from": "APPROVED", "to": "PROCESSED", "action": "PROCESS", "required_roles": ["STORE_MANAGER", "ACCOUNTANT", "MANAGER", "SYSADMIN"]},
                {"from": "APPROVED", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["MANAGER", "SYSADMIN"]},
            ],
        }

    async def get_document(
        self,
        db: AsyncSession,
        doc_id: str,
        tenant_ctx: TenantContext
    ) -> SalesReturn:
        """Safely loads a SalesReturn enforcing multi-tenant isolation."""
        stmt = (
            select(SalesReturn)
            .where(
                SalesReturn.id == doc_id,
                SalesReturn.company_id == tenant_ctx.company_id,
            )
            .options(selectinload(SalesReturn.items))
        )
        res = await db.execute(stmt)
        ret = res.scalars().first()
        if not ret:
            raise DocumentNotFoundException(self.document_type, doc_id)
        return ret

    async def validate_transition(
        self,
        db: AsyncSession,
        doc: SalesReturn,
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
                    f"Only DRAFT sales returns can be submitted. Current status: {curr_state}."
                )
            # Ensure items exist
            q_items = select(SalesReturnItem).where(
                SalesReturnItem.return_id == doc.id,
                SalesReturnItem.is_deleted == False
            )
            items = (await db.execute(q_items)).scalars().all()
            if not items and not getattr(doc, "items", None):
                raise HandlerValidationException("Cannot submit a sales return with zero line items.")

        elif act == "APPROVE":
            if curr_state != "SUBMITTED":
                raise HandlerValidationException(
                    f"Only SUBMITTED sales returns can be approved. Current status: {curr_state}."
                )

        elif act == "PROCESS":
            if curr_state != "APPROVED":
                raise HandlerValidationException(
                    f"Only APPROVED sales returns can be processed for restocking. Current status: {curr_state}."
                )

        elif act == "CANCEL":
            if curr_state == "CANCELLED":
                raise HandlerValidationException("This sales return is already cancelled.")
            if curr_state == "PROCESSED":
                raise HandlerValidationException("A processed and restocked sales return cannot be cancelled.")

    async def apply_transition(
        self,
        db: AsyncSession,
        doc: SalesReturn,
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

        if act == "PROCESS":
            # 1. Restock items via SalesStockAuthority
            ret_items_stmt = select(SalesReturnItem).where(
                SalesReturnItem.return_id == doc.id,
                SalesReturnItem.is_deleted == False
            )
            ret_items = (await db.execute(ret_items_stmt)).scalars().all()
            lines = [
                {
                    "product_id": it.product_id,
                    "quantity": it.quantity,
                    "batch_no": getattr(it, "batch_no", None),
                }
                for it in ret_items
            ]
            await SalesStockAuthority.record_return_inward(
                session=db,
                tenant_ctx=tenant_ctx,
                return_id=doc.id,
                return_no=doc.return_no,
                items=lines,
                warehouse_id=getattr(doc, "warehouse_id", None),
                user_id=getattr(user, "username", None) or str(user.id),
            )

            # 2. Financial Credit Note GL Posting via UnifiedAccountingLedgerService
            try:
                await UnifiedAccountingLedgerService.post_sales_return_to_gl(
                    session=db,
                    company_id=tenant_ctx.company_id,
                    return_id=doc.id,
                    branch_id=tenant_ctx.branch_id,
                )
            except Exception as e:
                logger.warning("Could not post sales return %s to GL: %s", doc.id, e, exc_info=True)

        elif act == "CANCEL":
            doc.notes = f"{doc.notes or ''} | Cancelled: {payload.get('reason', 'Cancelled by user')}".strip(" |")

        db.add(doc)
