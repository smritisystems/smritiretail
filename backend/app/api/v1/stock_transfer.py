"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 8.1.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

stock_transfer.py — REST API gateway for Inter-Branch Stock Transfers.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_tenant, TenantContext
from app.models.inventory import StockTransfer
from app.services.stock_transfer_engine import StockTransferEngine
from app.schemas.stock_transfer import (
    StockTransferCreate, StockTransferResponse, StockTransferDispatchReq,
    StockTransferReceiveReq, StockTransferShipmentResponse
)

router = APIRouter(prefix="/inventory", tags=["Inter-Branch Stock Transfers"])


@router.post("/transfers", response_model=StockTransferResponse, status_code=status.HTTP_201_CREATED)
async def create_transfer_order(
    payload: StockTransferCreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Creates a draft inter-branch StockTransfer order.
    """
    engine = StockTransferEngine(db, tenant)
    items_payload = [item.model_dump() for item in payload.items]
    return await engine.create_transfer_order(
        source_branch_id=payload.source_branch_id,
        destination_branch_id=payload.destination_branch_id,
        items=items_payload,
        notes=payload.notes
    )


@router.post("/transfers/{id}/approve", response_model=StockTransferResponse)
async def approve_transfer_order(
    id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Approves stock transfer order and verifies stock availability at source branch.
    """
    engine = StockTransferEngine(db, tenant)
    return await engine.approve_transfer_order(transfer_id=id)


@router.post("/transfers/{id}/dispatch")
async def dispatch_transfer_shipment(
    id: str,
    payload: Optional[StockTransferDispatchReq] = None,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Dispatches stock transfer shipment, deducts source stock into in-transit.
    """
    engine = StockTransferEngine(db, tenant)
    carrier = payload.carrier if payload else None
    tracking_no = payload.tracking_no if payload else None
    result = await engine.dispatch_transfer(transfer_id=id, carrier=carrier, tracking_no=tracking_no)
    return {
        "transfer": StockTransferResponse.model_validate(result["transfer"]),
        "shipment": StockTransferShipmentResponse.model_validate(result["shipment"])
    }


@router.post("/transfers/{id}/receive", response_model=StockTransferResponse)
async def receive_transfer_stock(
    id: str,
    payload: Optional[StockTransferReceiveReq] = None,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Receives stock transfer at destination branch, adds product stock.
    """
    engine = StockTransferEngine(db, tenant)
    line_rcv = [c.model_dump() for c in payload.line_receipts] if payload and payload.line_receipts else None
    return await engine.receive_transfer(transfer_id=id, line_receipts=line_rcv)


@router.get("/transfers/{id}", response_model=StockTransferResponse)
async def get_transfer_order(
    id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Retrieves stock transfer order details.
    """
    stmt = select(StockTransfer).where(
        StockTransfer.id == id,
        StockTransfer.is_deleted == False,
        StockTransfer.company_id == tenant.company_id
    )
    trf = (await db.execute(stmt)).scalars().first()
    if not trf:
        raise HTTPException(status_code=404, detail=f"Stock transfer order '{id}' not found.")
    return trf
