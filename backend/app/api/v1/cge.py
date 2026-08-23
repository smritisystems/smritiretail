"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import Optional, List, Dict, Any
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_tenant_context, TenantContext
from ...services.commercial_growth_service import CommercialGrowthEngine
from ...services.pdt_analytics_service import PdtAnalyticsService

router = APIRouter()


class EvaluateLoyaltyRequest(BaseModel):
    member_id: str
    spend_amount: float = Field(..., gt=0)


class ValidateCouponRequest(BaseModel):
    coupon_code: str
    cart_total: float = Field(..., ge=0)
    customer_id: Optional[str] = None


class SkuVelocityRequest(BaseModel):
    sku: str
    lookback_days: int = 30
    lead_time_days: int = 7


@router.post("/loyalty/enroll")
async def enroll_loyalty_member(
    customer_id: str = Query(...),
    card_number: Optional[str] = None,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Enrolls or fetches a customer loyalty member in the tenant database."""
    member = await CommercialGrowthEngine.get_or_create_loyalty_member(
        session=db,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        customer_id=customer_id,
        card_number=card_number
    )
    await db.commit()
    return {
        "member_id": member.id,
        "customer_id": member.customer_id,
        "card_number": member.card_number,
        "loyalty_tier_id": member.loyalty_tier_id,
        "current_points_balance": float(member.current_points_balance),
        "total_lifetime_spend": float(member.total_lifetime_spend)
    }


@router.post("/loyalty/evaluate-points")
async def evaluate_loyalty_points(
    req: EvaluateLoyaltyRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Calculates points to earn on spend."""
    pts = await CommercialGrowthEngine.calculate_loyalty_points_for_spend(
        session=db,
        company_id=tenant_ctx.company_id,
        member_id=req.member_id,
        spend_amount=Decimal(str(req.spend_amount))
    )
    return {
        "member_id": req.member_id,
        "spend_amount": req.spend_amount,
        "points_to_earn": float(pts)
    }


@router.post("/promotions/validate-coupon")
async def validate_promotional_coupon(
    req: ValidateCouponRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Validates coupon code against active campaign rules in the tenant database."""
    res = await CommercialGrowthEngine.validate_and_evaluate_coupon(
        session=db,
        company_id=tenant_ctx.company_id,
        coupon_code=req.coupon_code,
        cart_total=Decimal(str(req.cart_total)),
        customer_id=req.customer_id
    )
    return res


@router.get("/pdt/velocity/{sku}")
async def get_sku_velocity_and_cover(
    sku: str,
    lookback_days: int = 30,
    lead_time_days: int = 7,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Computes deterministic inventory velocity and replenishment reorder recommendation."""
    analytics = await PdtAnalyticsService.calculate_sku_velocity_and_cover(
        session=db,
        company_id=tenant_ctx.company_id,
        sku=sku,
        lookback_days=lookback_days,
        lead_time_days=lead_time_days
    )
    return analytics
