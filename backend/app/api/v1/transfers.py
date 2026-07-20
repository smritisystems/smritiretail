"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.40.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_db
from app.models.transfer import StockTransferOrder
from app.services.rebalancing_service import StockRebalancingService

router = APIRouter(prefix="/transfers", tags=["Stock Transfers & Rebalancing"])


class CalculateRebalanceRequest(BaseModel):
    source_branch_id: str = Field(..., example="br-main-hub")
    target_branch_id: str = Field(..., example="br-spoke-outlet")


class ActionTransferRequest(BaseModel):
    user_id: str = Field(..., example="usr-manager-01")


@router.post(
    "/rebalance/calculate",
    summary="Calculate Multi-Store Rebalancing Recommendations",
    description="Analyzes inventory velocity and stock-on-hand across stores to generate stock redistribution recommendations."
)
async def calculate_rebalance(
    payload: CalculateRebalanceRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    svc = StockRebalancingService()
    recs = await svc.calculate_rebalancing_recommendations(
        db=db,
        source_branch_id=payload.source_branch_id,
        target_branch_id=payload.target_branch_id,
    )
    return {
        "success": True,
        "recommendations_count": len(recs),
        "recommendations": [
            {
                "id": r.id,
                "product_id": r.product_id,
                "sku": r.sku,
                "product_name": r.product_name,
                "recommended_qty": float(r.recommended_qty),
                "reason": r.reason,
            }
            for r in recs
        ]
    }


@router.post(
    "/rebalance/{recommendation_id}/convert",
    summary="Convert Recommendation to Transfer Order",
    description="Converts a pending rebalancing recommendation into a Stock Transfer Order (REQUESTED)."
)
async def convert_recommendation(
    recommendation_id: str,
    payload: ActionTransferRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    svc = StockRebalancingService()
    try:
        sto = await svc.convert_recommendation_to_sto(
            db=db,
            recommendation_id=recommendation_id,
            requested_by=payload.user_id,
        )
        return {
            "success": True,
            "transfer_order_id": sto.id,
            "transfer_no": sto.transfer_no,
            "status": sto.status,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post(
    "/{transfer_order_id}/dispatch",
    summary="Dispatch Stock Transfer Order",
    description="Dispatches goods from source store, updates STO status to DISPATCHED, and logs OUT stock movement."
)
async def dispatch_transfer(
    transfer_order_id: str,
    payload: ActionTransferRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    svc = StockRebalancingService()
    try:
        sto = await svc.dispatch_transfer_order(
            db=db,
            transfer_order_id=transfer_order_id,
            dispatched_by=payload.user_id,
        )
        return {
            "success": True,
            "transfer_order_id": sto.id,
            "transfer_no": sto.transfer_no,
            "status": sto.status,
            "total_shipped_qty": float(sto.total_shipped_qty),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post(
    "/{transfer_order_id}/receive",
    summary="Receive Stock Transfer Order",
    description="Receives goods at target store, updates STO status to RECEIVED, and logs IN stock movement."
)
async def receive_transfer(
    transfer_order_id: str,
    payload: ActionTransferRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    svc = StockRebalancingService()
    try:
        sto = await svc.receive_transfer_order(
            db=db,
            transfer_order_id=transfer_order_id,
            received_by=payload.user_id,
        )
        return {
            "success": True,
            "transfer_order_id": sto.id,
            "transfer_no": sto.transfer_no,
            "status": sto.status,
            "total_received_qty": float(sto.total_received_qty),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get(
    "/",
    summary="List Stock Transfer Orders",
    description="Fetches active or historical Stock Transfer Orders."
)
async def list_transfers(
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    stmt = select(StockTransferOrder).order_by(StockTransferOrder.created_at.desc())
    res = await db.execute(stmt)
    stos = res.scalars().all()
    return [
        {
            "id": s.id,
            "transfer_no": s.transfer_no,
            "source_branch_id": s.source_branch_id,
            "target_branch_id": s.target_branch_id,
            "status": s.status,
            "total_requested_qty": float(s.total_requested_qty),
            "total_shipped_qty": float(s.total_shipped_qty),
            "total_received_qty": float(s.total_received_qty),
        }
        for s in stos
    ]
