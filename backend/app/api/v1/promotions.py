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

import uuid
from datetime import datetime
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
    PromotionSchemeDTO,
    PromotionSchemeUpsertRequest,
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


# ============================================================================
# STATUTORY PROMOTION SCHEMES SYNCHRONIZATION (Define Sales Promotions & F6)
# ============================================================================

@router.get("/schemes", response_model=List[PromotionSchemeDTO], summary="List Defined Promotional Schemes")
async def list_promotion_schemes(
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Returns active and defined promotional schemes synchronized between POS and PostgreSQL."""
    try:
        q = select(PromotionCampaign).order_by(PromotionCampaign.priority.asc(), PromotionCampaign.name.asc())
        res = await db.execute(q)
        campaigns = res.scalars().all()

        dtos: List[PromotionSchemeDTO] = []
        for camp in campaigns:
            rq = select(PromotionRule).where(PromotionRule.campaign_id == camp.id).limit(1)
            r_res = await db.execute(rq)
            rule = r_res.scalars().first()

            bundle = getattr(rule, "bundle_offer_details", {}) or {}
            pelig = getattr(rule, "product_eligibility", {}) or {}
            celig = getattr(camp, "customer_eligibility", {}) or {}

            level = bundle.get("level", "ITEM_LEVEL")
            category = bundle.get("category", "ITEM_DISCOUNT_PERCENT")
            disc_val = float(rule.discount_percent or 0.0) if rule and float(rule.discount_percent or 0.0) > 0 else float(getattr(rule, "discount_fixed_amount", 0.0) or 0.0)

            valid_from = camp.start_date.strftime("%Y-%m-%d") if camp.start_date else datetime.utcnow().strftime("%Y-%m-%d")
            valid_to = camp.end_date.strftime("%Y-%m-%d") if camp.end_date else datetime.utcnow().strftime("%Y-%m-%d")

            dtos.append(
                PromotionSchemeDTO(
                    id=camp.id,
                    code=camp.promo_code or camp.name,
                    name=camp.name,
                    description=camp.description or "",
                    level=level,
                    category=category,
                    priority=camp.priority or 1,
                    discount_value=disc_val,
                    min_bill_value=float(camp.min_order_amount) if camp.min_order_amount is not None else None,
                    min_qty=getattr(rule, "buy_quantity", None) if rule else None,
                    buy_qty=getattr(rule, "buy_quantity", None) if rule else None,
                    free_qty=getattr(rule, "get_quantity", None) if rule else None,
                    max_discount=float(camp.max_discount_amount) if camp.max_discount_amount is not None else None,
                    applicable_categories=pelig.get("categories", []),
                    applicable_brands=pelig.get("brands", []),
                    applicable_customer_groups=celig.get("groups", ["ALL"]),
                    valid_from=valid_from,
                    valid_to=valid_to,
                    is_happy_hours=bool(bundle.get("is_happy_hours", False)),
                    happy_hours_start=bundle.get("happy_hours_start"),
                    happy_hours_end=bundle.get("happy_hours_end"),
                    is_active=bool(camp.is_active),
                    created_at=camp.created_at.isoformat() if camp.created_at else None,
                    updated_at=camp.modified_at.isoformat() if hasattr(camp, "modified_at") and camp.modified_at else None,
                )
            )

        return dtos
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/schemes", response_model=PromotionSchemeDTO, summary="Upsert Promotional Scheme")
async def upsert_promotion_scheme(
    req: PromotionSchemeUpsertRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Upserts a promotional scheme definition and synchronizes it into PostgreSQL."""
    try:
        company_id, user_id = _extract_user_info(current_user)

        try:
            start_dt = datetime.strptime(req.valid_from, "%Y-%m-%d")
        except Exception:
            start_dt = datetime.utcnow()
        try:
            end_dt = datetime.strptime(req.valid_to, "%Y-%m-%d")
        except Exception:
            end_dt = datetime.utcnow().replace(year=datetime.utcnow().year + 1)

        camp = None
        if req.id:
            cq = select(PromotionCampaign).where(PromotionCampaign.id == req.id)
            res = await db.execute(cq)
            camp = res.scalars().first()

        if not camp:
            cq2 = select(PromotionCampaign).where(PromotionCampaign.promo_code == req.code)
            res2 = await db.execute(cq2)
            camp = res2.scalars().first()

        if not camp:
            camp = PromotionCampaign(
                id=req.id or f"camp-{uuid.uuid4().hex[:12]}",
                name=req.name,
                promo_code=req.code,
                description=req.description or "",
                start_date=start_dt,
                end_date=end_dt,
                min_order_amount=req.min_bill_value or 0.0,
                max_discount_amount=req.max_discount,
                priority=req.priority or 1,
                is_active=req.is_active,
                customer_eligibility={"groups": req.applicable_customer_groups},
                created_by=user_id,
            )
            db.add(camp)
            await db.flush()
        else:
            camp.name = req.name
            camp.promo_code = req.code
            camp.description = req.description or ""
            camp.start_date = start_dt
            camp.end_date = end_dt
            camp.min_order_amount = req.min_bill_value or 0.0
            camp.max_discount_amount = req.max_discount
            camp.priority = req.priority or 1
            camp.is_active = req.is_active
            camp.customer_eligibility = {"groups": req.applicable_customer_groups}

        rq = select(PromotionRule).where(PromotionRule.campaign_id == camp.id)
        r_res = await db.execute(rq)
        rule = r_res.scalars().first()

        rule_type = "PERCENTAGE" if "PERCENT" in req.category else ("FIXED_DISCOUNT" if "FLAT" in req.category else req.category)
        disc_pct = req.discount_value if "PERCENT" in req.category else 0.0
        disc_amt = req.discount_value if ("FLAT" in req.category or "AMOUNT" in req.category) else 0.0

        bundle_details = {
            "level": req.level,
            "category": req.category,
            "is_happy_hours": req.is_happy_hours,
            "happy_hours_start": req.happy_hours_start,
            "happy_hours_end": req.happy_hours_end,
        }
        prod_eligibility = {
            "categories": req.applicable_categories,
            "brands": req.applicable_brands,
        }

        if not rule:
            rule = PromotionRule(
                id=f"rule-{uuid.uuid4().hex[:12]}",
                campaign_id=camp.id,
                rule_type=rule_type,
                discount_percent=disc_pct,
                discount_fixed_amount=disc_amt,
                buy_quantity=req.buy_qty or req.min_qty or 1,
                get_quantity=req.free_qty or 0,
                bundle_offer_details=bundle_details,
                product_eligibility=prod_eligibility,
                is_active=req.is_active,
                created_by=user_id,
            )
            db.add(rule)
        else:
            rule.rule_type = rule_type
            rule.discount_percent = disc_pct
            rule.discount_fixed_amount = disc_amt
            rule.buy_quantity = req.buy_qty or req.min_qty or 1
            rule.get_quantity = req.free_qty or 0
            rule.bundle_offer_details = bundle_details
            rule.product_eligibility = prod_eligibility
            rule.is_active = req.is_active

        await db.commit()
        await db.refresh(camp)

        return PromotionSchemeDTO(
            id=camp.id,
            code=camp.promo_code or camp.name,
            name=camp.name,
            description=camp.description or "",
            level=req.level,
            category=req.category,
            priority=camp.priority or 1,
            discount_value=req.discount_value,
            min_bill_value=float(camp.min_order_amount) if camp.min_order_amount is not None else None,
            min_qty=req.min_qty,
            buy_qty=req.buy_qty,
            free_qty=req.free_qty,
            max_discount=float(camp.max_discount_amount) if camp.max_discount_amount is not None else None,
            applicable_categories=req.applicable_categories,
            applicable_brands=req.applicable_brands,
            applicable_customer_groups=req.applicable_customer_groups,
            valid_from=req.valid_from,
            valid_to=req.valid_to,
            is_happy_hours=req.is_happy_hours,
            happy_hours_start=req.happy_hours_start,
            happy_hours_end=req.happy_hours_end,
            is_active=bool(camp.is_active),
            created_at=camp.created_at.isoformat() if camp.created_at else None,
            updated_at=camp.modified_at.isoformat() if hasattr(camp, "modified_at") and camp.modified_at else None,
        )
    except Exception as e:
        await db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/schemes/{scheme_id}", summary="Delete or Deactivate Promotional Scheme")
async def delete_promotion_scheme(
    scheme_id: str,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Deletes a promotional scheme from PostgreSQL."""
    try:
        cq = select(PromotionCampaign).where(PromotionCampaign.id == scheme_id)
        res = await db.execute(cq)
        camp = res.scalars().first()
        if not camp:
            cq2 = select(PromotionCampaign).where(PromotionCampaign.promo_code == scheme_id)
            res2 = await db.execute(cq2)
            camp = res2.scalars().first()

        if not camp:
            raise HTTPException(status_code=404, detail="Promotional scheme not found")

        await db.delete(camp)
        await db.commit()
        return {"status": "SUCCESS", "deleted_id": scheme_id}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

