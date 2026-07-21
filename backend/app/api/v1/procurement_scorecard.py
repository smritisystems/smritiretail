"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.3.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import get_db
from app.api.deps import TenantContext, get_tenant_context
from app.models.purchase import SupplierScorecard, SupplierScorecardMetric, Supplier
from app.schemas.purchase import (
    SupplierScorecardResponse, ScorecardRecalculateRequest
)
from app.procurement.engine.supplier_performance_engine import SupplierPerformanceEngine

router = APIRouter(prefix="/purchase/scorecards", tags=["Procurement Supplier Performance Scorecards"])


@router.post("/calculate", response_model=List[SupplierScorecardResponse])
async def calculate_supplier_scorecards(
    req_body: ScorecardRecalculateRequest,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Recalculates performance scorecards for a single supplier or all tenant suppliers.
    """
    engine = SupplierPerformanceEngine(db, tenant)
    if req_body.supplier_id:
        sc = await engine.calculate_scorecard(req_body.supplier_id, days_window=req_body.days_window)
        return [sc]
    else:
        return await engine.recalculate_all_scorecards(days_window=req_body.days_window)


@router.get("/supplier/{supplier_id}", response_model=SupplierScorecardResponse)
async def get_latest_supplier_scorecard(
    supplier_id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Retrieves the latest performance scorecard for a specific supplier.
    """
    stmt = select(SupplierScorecard).where(
        SupplierScorecard.supplier_id == supplier_id,
        SupplierScorecard.company_id == tenant.company_id,
        SupplierScorecard.is_deleted == False
    ).order_by(SupplierScorecard.evaluation_date.desc())
    sc = (await db.execute(stmt)).scalars().first()
    if not sc:
        raise HTTPException(status_code=404, detail=f"No performance scorecard found for supplier '{supplier_id}'")

    l_stmt = select(SupplierScorecardMetric).where(SupplierScorecardMetric.scorecard_id == sc.id)
    sc.metrics = list((await db.execute(l_stmt)).scalars().all())
    return sc


@router.get("/rankings", response_model=List[SupplierScorecardResponse])
async def list_supplier_rankings(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Lists suppliers ranked by composite performance score.
    """
    stmt = select(SupplierScorecard).where(
        SupplierScorecard.company_id == tenant.company_id,
        SupplierScorecard.is_deleted == False
    ).order_by(SupplierScorecard.composite_score.desc())
    scorecards = list((await db.execute(stmt)).scalars().all())
    for sc in scorecards:
        l_stmt = select(SupplierScorecardMetric).where(SupplierScorecardMetric.scorecard_id == sc.id)
        sc.metrics = list((await db.execute(l_stmt)).scalars().all())
    return scorecards
