"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 9.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

replenishment.py — REST API gateway for Automated Replenishment & Reorder Suggestions.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_tenant, TenantContext
from app.models.inventory import ReplenishmentPlan
from app.services.replenishment_engine import ReplenishmentEngine
from app.schemas.replenishment import (
    ReorderSuggestionResponse, ReplenishmentPlanCreate,
    ReplenishmentPlanResponse, ConvertedPurchaseOrderSummary
)

router = APIRouter(prefix="/inventory/replenishment", tags=["Automated Warehouse Replenishment"])


@router.get("/suggestions", response_model=List[ReorderSuggestionResponse])
async def get_reorder_suggestions(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Generates live reorder suggestions for low-stock SKUs with preferred vendor resolution.
    """
    engine = ReplenishmentEngine(db, tenant)
    return await engine.generate_reorder_suggestions()


@router.post("/plans", response_model=ReplenishmentPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_replenishment_plan(
    payload: ReplenishmentPlanCreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Creates a draft ReplenishmentPlan document.
    """
    engine = ReplenishmentEngine(db, tenant)
    items_payload = [item.model_dump() for item in payload.items]
    return await engine.create_replenishment_plan(
        name=payload.name,
        items=items_payload,
        notes=payload.notes
    )


@router.post("/plans/{id}/convert", response_model=List[ConvertedPurchaseOrderSummary])
async def convert_plan_to_purchase_orders(
    id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Converts a replenishment plan into draft Purchase Orders grouped by preferred vendor.
    """
    engine = ReplenishmentEngine(db, tenant)
    pos = await engine.convert_plan_to_purchase_orders(plan_id=id)
    return [ConvertedPurchaseOrderSummary.model_validate(po) for po in pos]


@router.get("/plans/{id}", response_model=ReplenishmentPlanResponse)
async def get_replenishment_plan(
    id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Retrieves details of a replenishment plan.
    """
    stmt = select(ReplenishmentPlan).where(
        ReplenishmentPlan.id == id,
        ReplenishmentPlan.is_deleted == False,
        ReplenishmentPlan.company_id == tenant.company_id
    )
    plan = (await db.execute(stmt)).scalars().first()
    if not plan:
        raise HTTPException(status_code=404, detail=f"Replenishment plan '{id}' not found.")
    return plan
