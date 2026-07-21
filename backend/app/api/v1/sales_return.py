"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 7.2.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

sales_return.py — REST API gateway for Outbound Sales Returns & Credit Note issuance.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_tenant, TenantContext
from app.models.sales import SalesReturn, CreditNote
from app.sales.engine.return_engine import SalesReturnEngine
from app.schemas.sales_return import (
    SalesReturnCreate, SalesReturnResponse, ReturnEvaluationRequest, CreditNoteResponse
)

router = APIRouter(prefix="/sales", tags=["Sales Returns & Credit Notes"])


@router.post("/returns", response_model=SalesReturnResponse, status_code=status.HTTP_201_CREATED)
async def create_sales_return(
    payload: SalesReturnCreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Creates a draft SalesReturn order linked to an active SalesInvoice.
    """
    engine = SalesReturnEngine(db, tenant)
    items_payload = [item.model_dump() for item in payload.items]
    return await engine.create_sales_return(
        invoice_id=payload.invoice_id,
        items=items_payload,
        reason=payload.reason
    )


@router.post("/returns/{id}/evaluate")
async def evaluate_and_process_return(
    id: str,
    payload: Optional[ReturnEvaluationRequest] = None,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Evaluates line conditions (Restockable vs Damaged), restocks salable items, and issues CreditNote.
    """
    engine = SalesReturnEngine(db, tenant)
    line_conds = [c.model_dump() for c in payload.line_conditions] if payload and payload.line_conditions else None
    result = await engine.evaluate_and_process_return(return_id=id, line_conditions=line_conds)
    return {
        "sales_return": SalesReturnResponse.model_validate(result["sales_return"]),
        "credit_note": CreditNoteResponse.model_validate(result["credit_note"])
    }


@router.get("/returns/{id}", response_model=SalesReturnResponse)
async def get_sales_return(
    id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Retrieves sales return order details.
    """
    stmt = select(SalesReturn).where(
        SalesReturn.id == id,
        SalesReturn.is_deleted == False,
        SalesReturn.company_id == tenant.company_id
    )
    ret = (await db.execute(stmt)).scalars().first()
    if not ret:
        raise HTTPException(status_code=404, detail=f"Sales return '{id}' not found.")
    return ret


@router.get("/credit-notes/{id}", response_model=CreditNoteResponse)
async def get_credit_note(
    id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Retrieves GST CreditNote details.
    """
    stmt = select(CreditNote).where(
        CreditNote.id == id,
        CreditNote.is_deleted == False,
        CreditNote.company_id == tenant.company_id
    )
    cn = (await db.execute(stmt)).scalars().first()
    if not cn:
        raise HTTPException(status_code=404, detail=f"Credit note '{id}' not found.")
    return cn
