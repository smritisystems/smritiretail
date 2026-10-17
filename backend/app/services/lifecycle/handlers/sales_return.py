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
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import TenantContext
from app.models.auth import User
from app.models.sales import SalesReturn, SalesReturnItem, SalesInvoice, SalesInvoiceItem
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
            .with_for_update()
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

            # Ensure return has line items
            ret_items = doc.items
            if not ret_items:
                q_items = select(SalesReturnItem).where(
                    SalesReturnItem.return_id == doc.id,
                    SalesReturnItem.is_deleted == False
                )
                ret_items = (await db.execute(q_items)).scalars().all()
            if not ret_items:
                raise HandlerValidationException("Cannot process a sales return with zero line items.")

            # Validate against original SalesInvoice
            if not doc.original_invoice_id:
                raise HandlerValidationException(
                    "Sales return must reference a valid original sales invoice.",
                    "SALES_RETURN_MISSING_ORIGINAL_INVOICE"
                )

            inv_stmt = select(SalesInvoice).where(
                SalesInvoice.id == doc.original_invoice_id,
                SalesInvoice.company_id == tenant_ctx.company_id,
                SalesInvoice.is_deleted == False
            ).options(selectinload(SalesInvoice.items))
            orig_inv = (await db.execute(inv_stmt)).scalar_one_or_none()
            if not orig_inv:
                raise HandlerValidationException(
                    f"Original sales invoice '{doc.original_invoice_id}' not found for tenant.",
                    "SALES_RETURN_ORIGINAL_INVOICE_NOT_FOUND"
                )

            inv_status = str(orig_inv.status or "").upper()
            if inv_status not in ("POSTED", "PAID"):
                raise HandlerValidationException(
                    f"Cannot process return against sales invoice '{orig_inv.invoice_no}' with status '{orig_inv.status}'. Only POSTED or PAID invoices can be returned.",
                    "SALES_RETURN_INVOICE_NOT_POSTED"
                )

            orig_items_by_prod = {item.product_id: item for item in (orig_inv.items or []) if not getattr(item, "is_deleted", False)}

            # Query cumulative returned quantities from previous valid returns (excluding this return and cancelled returns)
            valid_statuses = ("PROCESSED", "COMPLETED")
            prev_stmt = (
                select(SalesReturnItem.product_id, func.sum(SalesReturnItem.quantity).label("total_returned"))
                .join(SalesReturn, SalesReturn.id == SalesReturnItem.return_id)
                .where(
                    SalesReturn.original_invoice_id == doc.original_invoice_id,
                    SalesReturn.company_id == tenant_ctx.company_id,
                    SalesReturn.is_deleted == False,
                    SalesReturn.id != doc.id,
                    SalesReturn.status.in_(valid_statuses),
                    SalesReturnItem.is_deleted == False,
                    SalesReturnItem.product_id.is_not(None)
                )
                .group_by(SalesReturnItem.product_id)
            )
            prev_rows = (await db.execute(prev_stmt)).all()
            prev_returned_qty = {row[0]: Decimal(str(row[1] or 0)) for row in prev_rows}

            # Enforce quantity eligibility per return line (accumulating per product if return has multiple lines)
            current_return_by_prod: Dict[str, Decimal] = {}
            for rit in ret_items:
                if getattr(rit, "is_deleted", False):
                    continue
                if not rit.product_id:
                    continue

                orig_item = orig_items_by_prod.get(rit.product_id)
                if not orig_item:
                    raise HandlerValidationException(
                        f"Product '{rit.name}' ({rit.code}) is not present on original sales invoice '{orig_inv.invoice_no}'.",
                        "SALES_RETURN_PRODUCT_NOT_INVOICED"
                    )

                ret_qty = Decimal(str(rit.quantity or 0))
                if ret_qty <= Decimal("0.00"):
                    raise HandlerValidationException(
                        f"Return quantity for product '{rit.name}' must be strictly greater than zero.",
                        "SALES_RETURN_INVALID_QTY"
                    )

                current_return_by_prod[rit.product_id] = current_return_by_prod.get(rit.product_id, Decimal("0.00")) + ret_qty

                orig_qty = Decimal(str(orig_item.quantity or 0))
                already_returned = prev_returned_qty.get(rit.product_id, Decimal("0.00"))
                remaining_qty = orig_qty - already_returned
                total_attempted = current_return_by_prod[rit.product_id]

                if total_attempted > remaining_qty:
                    raise HandlerValidationException(
                        f"Return quantity ({total_attempted}) exceeds remaining returnable quantity ({remaining_qty}) for product '{rit.name}'. (Invoiced: {orig_qty}, Already Returned: {already_returned})",
                        "SALES_RETURN_QTY_EXCEEDED"
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
                original_invoice_id=doc.original_invoice_id,
            )

            # 2. Financial Credit Note & COGS Reversal via UnifiedAccountingLedgerService (Synchronous, Fail-Fast)
            await UnifiedAccountingLedgerService.post_sales_return_to_gl(
                session=db,
                company_id=tenant_ctx.company_id,
                return_id=doc.id,
                branch_id=tenant_ctx.branch_id,
            )

        elif act == "CANCEL":
            doc.reason = f"{doc.reason or ''} | Cancelled: {payload.get('reason', 'Cancelled by user')}".strip(" |")

        db.add(doc)
