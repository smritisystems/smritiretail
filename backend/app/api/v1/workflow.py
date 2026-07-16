"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-07-15
Modified     : 2026-07-15
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Core Workflow API — AD-3 resolution.
Workflow is a cross-module concern and must NOT live in sales.py or purchase.py.
This router owns all document state-machine transitions.

Supported docTypes and their state machines:
  PurchaseOrder : DRAFT → CONFIRMED (submit) | CONFIRMED → CANCELLED (cancel)
  SalesInvoice  : Draft → Confirmed (approve) | any → Cancelled (cancel)
  SalesQuotation: Draft → Approved (approve) | Draft → Cancelled (cancel)
"""

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_db, get_tenant_context, TenantContext, get_current_user, require_role
from app.models.auth import User, UserRole
from app.models.workflow import WorkflowEvent
from app.services.purchase import PurchaseService
from app.services.sales import SalesService

router = APIRouter()

# Supported document types and their allowed workflow actions
_SUPPORTED = {
    "PurchaseOrder":  {"submit", "cancel"},
    "SalesInvoice":   {"approve", "cancel"},
    "SalesQuotation": {"approve", "cancel"},
}


# ─────────────────────────── Helpers ────────────────────────────────

async def _log_event(
    db:           AsyncSession,
    doc_type:     str,
    doc_id:       str,
    action:       str,
    from_status:  Optional[str],
    to_status:    str,
    user:         User,
    tenant_ctx:   TenantContext,
    notes:        Optional[str] = None,
) -> None:
    """Append one immutable WorkflowEvent row to the audit trail."""
    event = WorkflowEvent(
        doc_type          = doc_type,
        doc_id            = doc_id,
        action            = action,
        from_status       = from_status,
        to_status         = to_status,
        performed_by_id   = user.id,
        performed_by_name = getattr(user, "username", None) or getattr(user, "name", None),
        company_id        = tenant_ctx.company_id,
        branch_id         = tenant_ctx.branch_id,
        notes             = notes,
        created_at        = datetime.now(timezone.utc),
    )
    db.add(event)
    # Note: caller is responsible for db.commit() — do not commit here
    # to keep the event atomic with the document transition.


# ─────────────────────────── Response schema ────────────────────────

class WorkflowEventResponse(BaseModel):
    id:                str
    doc_type:          str
    doc_id:            str
    action:            str
    from_status:       Optional[str]
    to_status:         str
    performed_by_id:   Optional[str]
    performed_by_name: Optional[str]
    created_at:        datetime
    notes:             Optional[str] = None

    model_config = {"from_attributes": True}


# ─────────────────────────── POST workflow action ────────────────────

@router.post(
    "/{doc_type}/{doc_id}/{action}",
    summary="Core Workflow Action",
)
async def workflow_action(
    doc_type: str,
    doc_id:   str,
    action:   str,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
    tenant_ctx:   TenantContext = Depends(get_tenant_context),
):
    """
    Generic workflow action endpoint.

    Supported combinations:
    - PurchaseOrder / submit   → DRAFT → CONFIRMED  (MANAGER, SYSADMIN)
    - PurchaseOrder / cancel   → any  → CANCELLED   (MANAGER, SYSADMIN)
    - SalesInvoice  / approve  → Draft → Confirmed   (MANAGER, SYSADMIN)
    - SalesInvoice  / cancel   → any  → Cancelled    (CASHIER+)
    - SalesQuotation / approve → Draft → Approved    (MANAGER, SYSADMIN)
    - SalesQuotation / cancel  → any  → Cancelled    (CASHIER+)

    Every successful transition is logged to workflow_events as an immutable audit row.
    """
    if doc_type not in _SUPPORTED:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown document type '{doc_type}'. Supported: {list(_SUPPORTED)}.",
        )
    if action not in _SUPPORTED[doc_type]:
        raise HTTPException(
            status_code=400,
            detail=f"Action '{action}' is not supported for '{doc_type}'. Allowed: {sorted(_SUPPORTED[doc_type])}.",
        )

    # Role guards
    manager_roles = {UserRole.MANAGER, UserRole.SYSADMIN}
    if action in ("submit", "approve") and current_user.role not in manager_roles:
        raise HTTPException(status_code=403, detail="MANAGER or SYSADMIN required for this workflow action.")

    purchase_svc = PurchaseService(db, tenant_ctx)
    sales_svc    = SalesService(db, tenant_ctx)

    if doc_type == "PurchaseOrder":
        if action == "submit":
            result = await purchase_svc.submit_purchase_order(doc_id)
            await _log_event(db, doc_type, doc_id, action,
                             from_status="DRAFT", to_status="CONFIRMED",
                             user=current_user, tenant_ctx=tenant_ctx)
            await db.commit()
            return result
        if action == "cancel":
            result = await purchase_svc.cancel_purchase_order(doc_id)
            await _log_event(db, doc_type, doc_id, action,
                             from_status=None, to_status="CANCELLED",
                             user=current_user, tenant_ctx=tenant_ctx)
            await db.commit()
            return result

    if doc_type == "SalesInvoice":
        if action == "approve":
            inv = await sales_svc.approve_sales_invoice(doc_id)
            await _log_event(db, doc_type, doc_id, action,
                             from_status="Draft", to_status="Confirmed",
                             user=current_user, tenant_ctx=tenant_ctx)
            await db.commit()
            return {"success": True, "invoice_id": inv.id, "status": inv.status}
        if action == "cancel":
            inv = await sales_svc.cancel_sales_invoice(doc_id)
            await _log_event(db, doc_type, doc_id, action,
                             from_status=None, to_status="Cancelled",
                             user=current_user, tenant_ctx=tenant_ctx)
            await db.commit()
            return {"success": True, "invoice_id": inv.id, "status": inv.status}

    if doc_type == "SalesQuotation":
        from sqlalchemy.orm import selectinload
        from app.models.sales import SalesQuotation
        if action == "approve":
            res = await db.execute(
                select(SalesQuotation)
                .where(
                    SalesQuotation.id         == doc_id,
                    SalesQuotation.company_id == tenant_ctx.company_id,
                    SalesQuotation.branch_id  == tenant_ctx.branch_id,
                    SalesQuotation.is_deleted == False,
                )
            )
            q = res.scalars().first()
            if not q:
                raise HTTPException(status_code=404, detail="Quotation not found")
            if q.status not in ("Draft", "Submitted"):
                raise HTTPException(status_code=400, detail=f"Cannot approve quotation with status '{q.status}'.")
            prev_status   = q.status
            q.status      = "Approved"
            q.modified_at = datetime.now(timezone.utc)
            db.add(q)
            await _log_event(db, doc_type, doc_id, action,
                             from_status=prev_status, to_status="Approved",
                             user=current_user, tenant_ctx=tenant_ctx)
            await db.commit()
            return {"success": True, "quotation_id": q.id, "status": q.status}
        if action == "cancel":
            res = await db.execute(
                select(SalesQuotation)
                .where(
                    SalesQuotation.id         == doc_id,
                    SalesQuotation.company_id == tenant_ctx.company_id,
                    SalesQuotation.branch_id  == tenant_ctx.branch_id,
                    SalesQuotation.is_deleted == False,
                )
            )
            q = res.scalars().first()
            if not q:
                raise HTTPException(status_code=404, detail="Quotation not found")
            prev_status   = q.status
            q.status      = "Cancelled"
            q.modified_at = datetime.now(timezone.utc)
            db.add(q)
            await _log_event(db, doc_type, doc_id, action,
                             from_status=prev_status, to_status="Cancelled",
                             user=current_user, tenant_ctx=tenant_ctx)
            await db.commit()
            return {"success": True, "quotation_id": q.id, "status": q.status}


# ─────────────────────────── GET workflow events ─────────────────────

@router.get(
    "/{doc_type}/{doc_id}/events",
    response_model=List[WorkflowEventResponse],
    summary="Workflow Event History",
    description="Returns the chronological audit trail for a document's state transitions.",
)
async def list_workflow_events(
    doc_type:     str,
    doc_id:       str,
    db:           AsyncSession = Depends(get_db),
    tenant_ctx:   TenantContext = Depends(get_tenant_context),
    current_user: User          = Depends(get_current_user),
):
    """List all workflow events for a specific document, chronologically."""
    res = await db.execute(
        select(WorkflowEvent)
        .where(
            WorkflowEvent.doc_type   == doc_type,
            WorkflowEvent.doc_id     == doc_id,
            WorkflowEvent.company_id == tenant_ctx.company_id,
            WorkflowEvent.branch_id  == tenant_ctx.branch_id,
        )
        .order_by(WorkflowEvent.created_at)
    )
    return res.scalars().all()
