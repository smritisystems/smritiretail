"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import traceback
from typing import Dict, Any, List, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...api.deps import get_company_db, get_current_user
from ...models.promotions import PromotionCampaign, PromotionRule, Coupon, PromotionRedemption
from ...services.promotions_engine import PromotionsEngine
from ...schemas.promotions import (
    PromotionCampaignCreateRequest,
    PromotionCampaignResponse,
    PromotionRuleCreateRequest,
    PromotionRuleResponse,
    CouponCreateRequest,
    CouponResponse,
    PromotionEvaluationRequest,
    PromotionEvaluationResponse,
    PromotionRedemptionRequest,
    PromotionRedemptionResponse,
)

router = APIRouter()


def _extract_user_info(current_user: Any) -> Tuple[str, str]:
    if isinstance(current_user, dict):
        comp_id = current_user.get("company_id", "COMP-001")
        user_id = current_user.get("sub", "usr-system")
    else:
        comp_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
        user_id = getattr(current_user, "id", None) or getattr(current_user, "username", "usr-system")
    return comp_id, user_id


# ============================================================================
# CAMPAIGN & RULE ENDPOINTS
# ============================================================================

@router.post("/campaigns", response_model=PromotionCampaignResponse, status_code=status.HTTP_201_CREATED, summary="Create Promotional Campaign")
async def create_campaign(
    req: PromotionCampaignCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Creates a new promotional campaign master."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        camp = await PromotionsEngine.create_campaign(
            session=db,
            company_id=company_id,
            req=req,
            created_by=user_id,
        )
        return PromotionCampaignResponse(
            id=camp.id,
            name=camp.name,
            promo_code=camp.promo_code,
            description=camp.description,
            start_date=camp.start_date,
            end_date=camp.end_date,
            min_order_amount=float(camp.min_order_amount or 0.0),
            max_discount_amount=float(camp.max_discount_amount) if camp.max_discount_amount is not None else None,
            usage_limit=camp.usage_limit,
            per_customer_limit=camp.per_customer_limit or 1,
            priority=camp.priority or 10,
            is_exclusive=bool(camp.is_exclusive),
            allow_stacking=bool(camp.allow_stacking),
            max_stacked_discount_percent=float(camp.max_stacked_discount_percent or 50.0),
            allow_combine_with_loyalty=bool(camp.allow_combine_with_loyalty),
            is_active=bool(camp.is_active),
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/campaigns", response_model=List[PromotionCampaignResponse], summary="List Promotional Campaigns")
async def list_campaigns(
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Lists all promotional campaigns."""
    stmt = select(PromotionCampaign)
    if is_active is not None:
        stmt = stmt.where(PromotionCampaign.is_active == is_active)
    camps = (await db.execute(stmt)).scalars().all()

    return [
        PromotionCampaignResponse(
            id=c.id,
            name=c.name,
            promo_code=c.promo_code,
            description=c.description,
            start_date=c.start_date,
            end_date=c.end_date,
            min_order_amount=float(c.min_order_amount or 0.0),
            max_discount_amount=float(c.max_discount_amount) if c.max_discount_amount is not None else None,
            usage_limit=c.usage_limit,
            per_customer_limit=c.per_customer_limit or 1,
            priority=c.priority or 10,
            is_exclusive=bool(c.is_exclusive),
            allow_stacking=bool(c.allow_stacking),
            max_stacked_discount_percent=float(c.max_stacked_discount_percent or 50.0),
            allow_combine_with_loyalty=bool(c.allow_combine_with_loyalty),
            is_active=bool(c.is_active),
        )
        for c in camps
    ]


@router.post("/campaigns/{campaign_id}/rules", response_model=PromotionRuleResponse, status_code=status.HTTP_201_CREATED, summary="Add Promotion Rule")
async def add_promotion_rule(
    campaign_id: str,
    req: PromotionRuleCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Adds a discount/offer rule (Percentage, Fixed, BXGY, Bundle) to a campaign."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        rule = await PromotionsEngine.add_promotion_rule(
            session=db,
            company_id=company_id,
            campaign_id=campaign_id,
            req=req,
            created_by=user_id,
        )
        return PromotionRuleResponse(
            id=rule.id,
            campaign_id=rule.campaign_id,
            rule_type=rule.rule_type,
            discount_percent=float(rule.discount_percent or 0.0),
            discount_fixed_amount=float(rule.discount_fixed_amount or 0.0),
            special_price=float(rule.special_price or 0.0),
            buy_quantity=rule.buy_quantity or 1,
            get_quantity=rule.get_quantity or 0,
            bundle_offer_details=rule.bundle_offer_details or {},
            product_eligibility=rule.product_eligibility or {},
            is_active=bool(rule.is_active),
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# COUPON ENDPOINTS
# ============================================================================

@router.post("/coupons", response_model=CouponResponse, status_code=status.HTTP_201_CREATED, summary="Create Coupon Code")
async def create_coupon(
    req: CouponCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Creates a coupon code with usage limits linked to a campaign."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        coupon = await PromotionsEngine.create_coupon(
            session=db,
            company_id=company_id,
            req=req,
            created_by=user_id,
        )
        return CouponResponse(
            id=coupon.id,
            campaign_id=coupon.campaign_id,
            code=coupon.code,
            usage_limit=coupon.usage_limit,
            usage_count=coupon.usage_count or 0,
            is_active=bool(coupon.is_active),
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# EVALUATION & REDEMPTION ENDPOINTS
# ============================================================================

@router.post("/evaluate", response_model=PromotionEvaluationResponse, summary="Evaluate Cart Promotions & Offers")
async def evaluate_promotions(
    req: PromotionEvaluationRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Evaluates all active promotions, coupons, and BXGY mechanics on cart items with conflict resolution."""
    try:
        company_id, _ = _extract_user_info(current_user)
        return await PromotionsEngine.evaluate_promotions(session=db, company_id=company_id, req=req)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/redeem", response_model=PromotionRedemptionResponse, status_code=status.HTTP_201_CREATED, summary="Record Promotion Redemption")
async def record_promotion_redemption(
    req: PromotionRedemptionRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Atomically records redemption into the audit ledger and increments coupon usage counters."""
    try:
        company_id, _ = _extract_user_info(current_user)
        redemption = await PromotionsEngine.record_redemption(session=db, company_id=company_id, req=req)
        return PromotionRedemptionResponse(
            id=redemption.id,
            campaign_id=redemption.campaign_id,
            coupon_id=redemption.coupon_id,
            customer_id=redemption.customer_id,
            reference_invoice_id=redemption.reference_invoice_id,
            discount_applied=float(redemption.discount_applied),
            conflict_resolution_strategy=redemption.conflict_resolution_strategy or "BEST_BENEFIT",
            status="RECORDED",
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
