"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""

from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Body, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.models.auth import User

from app.db.session import get_db
from app.api.deps import get_current_tenant, TenantContext
from app.services.loyalty import LoyaltyEngineService

router = APIRouter(prefix="/loyalty", tags=["Customer Loyalty & Rewards Engine"], dependencies=[Depends(get_current_user)])


@router.get("/account/{customer_id}")
async def get_loyalty_account(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant),
):
    """Retrieves customer loyalty points balance and tier status."""
    service = LoyaltyEngineService(db, tenant)
    acc = await service.get_or_create_account(customer_id)
    return {
        "customer_id": acc.customer_id,
        "customer_name": acc.customer_name,
        "tier": acc.tier,
        "points_balance": acc.points_balance,
        "total_lifetime_spend": acc.total_lifetime_spend,
    }


@router.post("/earn")
async def earn_loyalty_points(
    customer_id: str = Body(...),
    invoice_amount: float = Body(..., ge=0.01),
    reference_doc_no: str = Body(...),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant),
):
    """Accrues loyalty points on a purchase (₹100 = 1 point)."""
    service = LoyaltyEngineService(db, tenant)
    res = await service.earn_points(customer_id, invoice_amount, reference_doc_no)
    await db.commit()
    return res


@router.post("/redeem")
async def redeem_loyalty_points(
    customer_id: str = Body(...),
    points: int = Body(..., ge=1),
    reference_doc_no: str = Body(...),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant),
):
    """Redeems loyalty points for an invoice discount (1 point = ₹1)."""
    service = LoyaltyEngineService(db, tenant)
    res = await service.redeem_points(customer_id, points, reference_doc_no)
    await db.commit()
    return res
