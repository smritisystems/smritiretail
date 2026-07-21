"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 8.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

stock_audit.py — REST API gateway for Physical Stock Audits & Cycle Counting.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_tenant, TenantContext
from app.models.inventory import StockCount, StockAdjustment
from app.services.stock_audit_engine import StockAuditEngine
from app.schemas.stock_audit import (
    StockCountCreate, StockCountResponse, PhysicalCountsRequest,
    StockCountReconcileRequest, StockAdjustmentResponse
)

router = APIRouter(prefix="/inventory", tags=["Inventory Physical Audit & Cycle Counting"])


@router.post("/stock-counts", response_model=StockCountResponse, status_code=status.HTTP_201_CREATED)
async def create_stock_count_session(
    payload: StockCountCreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Creates a draft warehouse stock count audit session.
    """
    engine = StockAuditEngine(db, tenant)
    return await engine.create_stock_count(
        name=payload.name,
        count_type=payload.count_type or "Full",
        product_ids=payload.product_ids,
        notes=payload.notes
    )


@router.post("/stock-counts/{id}/counts", response_model=StockCountResponse)
async def record_physical_counts(
    id: str,
    payload: PhysicalCountsRequest,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Records physical counts for items in a count session and calculates variances.
    """
    engine = StockAuditEngine(db, tenant)
    line_counts = [c.model_dump() for c in payload.line_counts]
    return await engine.record_physical_counts(count_id=id, line_counts=line_counts)


@router.post("/stock-counts/{id}/reconcile")
async def reconcile_stock_count(
    id: str,
    payload: Optional[StockCountReconcileRequest] = None,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Reconciles physical count variance, updates Product.stock directly, and posts StockAdjustment voucher.
    """
    engine = StockAuditEngine(db, tenant)
    reason = payload.reason if payload else "Cycle Count Variance Reconciliation"
    result = await engine.reconcile_and_adjust_stock(count_id=id, reason=reason)
    return {
        "stock_count": StockCountResponse.model_validate(result["stock_count"]),
        "stock_adjustment": StockAdjustmentResponse.model_validate(result["stock_adjustment"])
    }


@router.get("/stock-counts/{id}", response_model=StockCountResponse)
async def get_stock_count_session(
    id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Retrieves details of a stock count audit session.
    """
    stmt = select(StockCount).where(
        StockCount.id == id,
        StockCount.is_deleted == False,
        StockCount.company_id == tenant.company_id
    )
    cnt = (await db.execute(stmt)).scalars().first()
    if not cnt:
        raise HTTPException(status_code=404, detail=f"Stock count session '{id}' not found.")
    return cnt


@router.get("/stock-adjustments/{id}", response_model=StockAdjustmentResponse)
async def get_stock_adjustment_voucher(
    id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Retrieves details of a posted stock adjustment voucher.
    """
    stmt = select(StockAdjustment).where(
        StockAdjustment.id == id,
        StockAdjustment.is_deleted == False,
        StockAdjustment.company_id == tenant.company_id
    )
    adj = (await db.execute(stmt)).scalars().first()
    if not adj:
        raise HTTPException(status_code=404, detail=f"Stock adjustment voucher '{id}' not found.")
    return adj
