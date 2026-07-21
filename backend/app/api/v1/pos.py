"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 10.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

pos.py — REST API gateway for Unified POS Checkout, Cash Drawer Sessions, and Offline Store Sync.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_tenant, TenantContext
from app.models.pos import PosSession, PosTransaction
from app.services.pos_engine import PosEngine
from app.schemas.pos import (
    PosSessionOpenReq, PosSessionResponse, PosCheckoutReq,
    PosTransactionResponse, PosSessionCloseReq, PosOfflineSyncBatchReq,
    PosOfflineSyncResultItem
)

router = APIRouter(prefix="/pos", tags=["Point of Sale (POS) Checkout & Cash Drawer"])


@router.post("/sessions/open", response_model=PosSessionResponse, status_code=status.HTTP_201_CREATED)
async def open_pos_session(
    payload: PosSessionOpenReq,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Opens a new terminal cash drawer session.
    """
    engine = PosEngine(db, tenant)
    return await engine.open_session(
        cashier_id=payload.cashier_id,
        terminal_id=payload.terminal_id,
        opening_balance=payload.opening_balance
    )


@router.post("/sessions/{id}/checkout", response_model=PosTransactionResponse, status_code=status.HTTP_201_CREATED)
async def pos_checkout(
    id: str,
    payload: PosCheckoutReq,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Executes a high-speed counter sale checkout transaction.
    """
    engine = PosEngine(db, tenant)
    items_payload = [item.model_dump() for item in payload.items]
    return await engine.process_checkout(
        session_id=id,
        items=items_payload,
        payment_method=payload.payment_method,
        tendered_amount=payload.tendered_amount,
        customer_id=payload.customer_id,
        client_tx_uuid=payload.client_tx_uuid,
        discount_amount=payload.discount_amount
    )


@router.post("/sessions/{id}/close", response_model=PosSessionResponse)
async def close_pos_session(
    id: str,
    payload: PosSessionCloseReq,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Reconciles cash count and closes a POS drawer session.
    """
    engine = PosEngine(db, tenant)
    return await engine.close_session(
        session_id=id,
        actual_cash_count=payload.actual_cash_count,
        notes=payload.notes
    )


@router.post("/sync", response_model=List[PosOfflineSyncResultItem])
async def sync_offline_transactions(
    payload: PosOfflineSyncBatchReq,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Ingests a batch of offline POS transactions with deduplication.
    """
    engine = PosEngine(db, tenant)
    batch_payload = [item.model_dump() for item in payload.items]
    return await engine.process_offline_sync_batch(items=batch_payload)


@router.get("/sessions/{id}", response_model=PosSessionResponse)
async def get_pos_session(
    id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Retrieves details of a POS drawer session.
    """
    stmt = select(PosSession).where(
        PosSession.id == id,
        PosSession.is_deleted == False,
        PosSession.company_id == tenant.company_id
    )
    session = (await db.execute(stmt)).scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail=f"POS Session '{id}' not found.")
    return session
