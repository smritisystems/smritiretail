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
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.promotions import PromotionCampaign, PromotionRule, Coupon, PromotionRedemption
from ..schemas.promotions import (
    PromotionCampaignCreateRequest,
    PromotionCampaignResponse,
    PromotionRuleCreateRequest,
    PromotionRuleResponse,
    CouponCreateRequest,
    CouponResponse,
    PromotionCartItem,
    PromotionEvaluationRequest,
    PromotionEvaluationResponse,
    AppliedPromotionDetail,
    PromotionRedemptionRequest,
    PromotionRedemptionResponse,
)


def _to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt.replace(tzinfo=None) if dt.tzinfo else dt


class PromotionsEngine:
    """
    Authoritative SMRITI Promotions & Offers Engine (Section 7).
    Evaluates complex discount mechanics (Percentage, Fixed, BXGY, Bundles, Coupons)
    with strict conflict resolution and stacking policies.
    """

    @classmethod
    async def create_campaign(
        cls,
        session: AsyncSession,
        company_id: str,
        req: PromotionCampaignCreateRequest,
        created_by: Optional[str] = None,
    ) -> PromotionCampaign:
        """Creates a new promotional campaign header."""
        stmt_check = select(PromotionCampaign).where(
            PromotionCampaign.name == req.name,
        )
        existing = (await session.execute(stmt_check)).scalars().first()
        if existing:
            raise ValueError(f"Promotion campaign with name '{req.name}' already exists.")

        camp = PromotionCampaign(
            id=f"pc_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            name=req.name,
            promo_code=req.promo_code,
            description=req.description,
            start_date=_to_naive_utc(req.start_date),
            end_date=_to_naive_utc(req.end_date),
            min_order_amount=Decimal(str(req.min_order_amount)),
            max_discount_amount=Decimal(str(req.max_discount_amount)) if req.max_discount_amount is not None else None,
            usage_limit=req.usage_limit,
            per_customer_limit=req.per_customer_limit,
            applicable_stores=req.applicable_stores,
            applicable_channels=req.applicable_channels,
            customer_eligibility=req.customer_eligibility,
            priority=req.priority,
            is_exclusive=req.is_exclusive,
            allow_stacking=req.allow_stacking,
            max_stacked_discount_percent=Decimal(str(req.max_stacked_discount_percent)),
            allow_combine_with_loyalty=req.allow_combine_with_loyalty,
            allow_combine_with_referral=req.allow_combine_with_referral,
            is_active=req.is_active,
            created_by=created_by,
        )
        session.add(camp)
        await session.commit()
        return camp

    @classmethod
    async def add_promotion_rule(
        cls,
        session: AsyncSession,
        company_id: str,
        campaign_id: str,
        req: PromotionRuleCreateRequest,
        created_by: Optional[str] = None,
    ) -> PromotionRule:
        """Adds a rule (Percentage, Fixed, BXGY, Bundle) to a campaign."""
        stmt_camp = select(PromotionCampaign).where(PromotionCampaign.id == campaign_id)
        camp = (await session.execute(stmt_camp)).scalars().first()
        if not camp:
            raise ValueError(f"Campaign '{campaign_id}' not found.")

        rule = PromotionRule(
            id=f"pr_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            campaign_id=campaign_id,
            rule_type=req.rule_type.upper(),
            discount_percent=Decimal(str(req.discount_percent)),
            discount_fixed_amount=Decimal(str(req.discount_fixed_amount)),
            special_price=Decimal(str(req.special_price)),
            buy_quantity=req.buy_quantity,
            get_quantity=req.get_quantity,
            bundle_offer_details=req.bundle_offer_details,
            product_eligibility=req.product_eligibility,
            is_active=req.is_active,
            created_by=created_by,
        )
        session.add(rule)
        await session.commit()
        return rule

    @classmethod
    async def create_coupon(
        cls,
        session: AsyncSession,
        company_id: str,
        req: CouponCreateRequest,
        created_by: Optional[str] = None,
    ) -> Coupon:
        """Generates a unique coupon code mapped to a campaign."""
        code_clean = req.code.strip().upper()
        stmt_c = select(Coupon).where(Coupon.code == code_clean)
        existing = (await session.execute(stmt_c)).scalars().first()
        if existing:
            raise ValueError(f"Coupon code '{code_clean}' already exists.")

        coupon = Coupon(
            id=f"cpn_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            campaign_id=req.campaign_id,
            code=code_clean,
            usage_limit=req.usage_limit,
            usage_count=0,
            is_active=True,
            created_by=created_by,
        )
        session.add(coupon)
        await session.commit()
        return coupon

    @classmethod
    async def evaluate_promotions(
        cls,
        session: AsyncSession,
        company_id: str,
        req: PromotionEvaluationRequest,
    ) -> PromotionEvaluationResponse:
        """
        Authoritatively evaluates all active campaigns, rules, coupons, and BXGY mechanics
        against cart items with conflict resolution and stacking policies.
        """
        now = _to_naive_utc(req.as_of_date) or datetime.now(timezone.utc).replace(tzinfo=None)
        gross_total = Decimal("0.00")
        for item in req.items:
            gross_total += Decimal(str(item.unit_price)) * Decimal(str(item.quantity))

        # Check coupon if provided
        matched_coupon = None
        if req.coupon_code:
            c_code = req.coupon_code.strip().upper()
            stmt_cpn = select(Coupon).where(Coupon.code == c_code, Coupon.is_active == True)
            matched_coupon = (await session.execute(stmt_cpn)).scalars().first()
            if not matched_coupon:
                return PromotionEvaluationResponse(
                    gross_cart_total=float(gross_total),
                    total_promotional_discount=0.0,
                    net_cart_total=float(gross_total),
                    applied_promotions=[],
                    rejected_promotions_count=0,
                    conflict_resolution_strategy="COUPON_NOT_FOUND",
                )
            if matched_coupon.usage_limit and (matched_coupon.usage_count or 0) >= matched_coupon.usage_limit:
                return PromotionEvaluationResponse(
                    gross_cart_total=float(gross_total),
                    total_promotional_discount=0.0,
                    net_cart_total=float(gross_total),
                    applied_promotions=[],
                    rejected_promotions_count=0,
                    conflict_resolution_strategy="COUPON_USAGE_LIMIT_EXCEEDED",
                )

        # 1. Fetch eligible active campaigns
        stmt_camp = select(PromotionCampaign).where(
            PromotionCampaign.is_active == True,
            PromotionCampaign.min_order_amount <= gross_total,
        )
        if req.campaign_id:
            stmt_camp = stmt_camp.where(PromotionCampaign.id == req.campaign_id)
        elif req.campaign_ids:
            stmt_camp = stmt_camp.where(PromotionCampaign.id.in_(req.campaign_ids))
        elif req.campaign_code:
            stmt_camp = stmt_camp.where(PromotionCampaign.promo_code == req.campaign_code)
        elif matched_coupon:
            stmt_camp = stmt_camp.where(PromotionCampaign.id == matched_coupon.campaign_id)

        all_camps = (await session.execute(stmt_camp)).scalars().all()

        eligible_camps = []
        for c in all_camps:
            s_date = _to_naive_utc(c.start_date)
            e_date = _to_naive_utc(c.end_date)
            if s_date and now < s_date:
                continue
            if e_date and now > e_date:
                continue
            # Check channel filtering
            if c.applicable_channels and len(c.applicable_channels) > 0:
                if req.channel not in c.applicable_channels:
                    continue
            # Check store filtering
            if req.store_id and c.applicable_stores and len(c.applicable_stores) > 0:
                if req.store_id not in c.applicable_stores:
                    continue
            eligible_camps.append(c)

        # 2. Evaluate discount potential for each campaign
        evaluated_candidates = []
        for camp in eligible_camps:
            stmt_rules = select(PromotionRule).where(
                PromotionRule.campaign_id == camp.id,
                PromotionRule.is_active == True,
            )
            rules = (await session.execute(stmt_rules)).scalars().all()

            for rule in rules:
                disc_amount = Decimal("0.00")
                free_items = []
                narration = f"Campaign '{camp.name}'"

                # Filter matching cart items by product eligibility
                p_elig = rule.product_eligibility or {}
                elig_prod_ids = p_elig.get("product_ids", [])
                elig_cat_ids = p_elig.get("category_ids", [])

                matching_items = []
                for itm in req.items:
                    if elig_prod_ids and itm.item_id not in elig_prod_ids:
                        continue
                    if elig_cat_ids and itm.category not in elig_cat_ids:
                        continue
                    matching_items.append(itm)

                if rule.rule_type == "PERCENTAGE":
                    match_subtotal = sum(Decimal(str(it.unit_price)) * Decimal(str(it.quantity)) for it in matching_items)
                    disc_amount = match_subtotal * (Decimal(str(rule.discount_percent)) / Decimal("100.00"))
                    narration += f": {rule.discount_percent}% discount"

                elif rule.rule_type == "FIXED_DISCOUNT":
                    disc_amount = Decimal(str(rule.discount_fixed_amount))
                    narration += f": Flat ₹{rule.discount_fixed_amount} discount"

                elif rule.rule_type == "BUY_X_GET_Y":
                    # BXGY mechanics: Buy buy_quantity, get get_quantity free
                    tot_units = sum(int(it.quantity) for it in matching_items)
                    bundle_size = rule.buy_quantity + rule.get_quantity
                    if tot_units >= bundle_size and bundle_size > 0:
                        bundles_count = tot_units // bundle_size
                        free_count = bundles_count * rule.get_quantity
                        if matching_items:
                            min_unit_price = min(Decimal(str(it.unit_price)) for it in matching_items)
                            disc_amount = min_unit_price * Decimal(str(free_count))
                            free_items.append({"item_id": matching_items[0].item_id, "quantity": free_count})
                            narration += f": Buy {rule.buy_quantity} Get {rule.get_quantity} Free ({free_count} free units)"

                elif rule.rule_type == "BUY_X_AT_PRICE":
                    tot_units = sum(int(it.quantity) for it in matching_items)
                    if tot_units >= rule.buy_quantity and matching_items:
                        regular_cost = Decimal(str(matching_items[0].unit_price)) * Decimal(str(rule.buy_quantity))
                        sp_price = Decimal(str(rule.special_price))
                        if regular_cost > sp_price:
                            disc_amount = regular_cost - sp_price
                            narration += f": Buy {rule.buy_quantity} for special price ₹{rule.special_price}"

                # Cap by campaign max_discount_amount
                if camp.max_discount_amount and disc_amount > Decimal(str(camp.max_discount_amount)):
                    disc_amount = Decimal(str(camp.max_discount_amount))

                disc_amount = min(disc_amount, gross_total)
                if disc_amount > 0 or len(free_items) > 0:
                    evaluated_candidates.append({
                        "campaign": camp,
                        "rule": rule,
                        "discount_amount": disc_amount,
                        "free_items": free_items,
                        "narration": narration,
                        "is_coupon": bool(matched_coupon and matched_coupon.campaign_id == camp.id),
                        "coupon_id": matched_coupon.id if (matched_coupon and matched_coupon.campaign_id == camp.id) else None,
                        "coupon_code": matched_coupon.code if (matched_coupon and matched_coupon.campaign_id == camp.id) else None,
                    })

        # 3. Conflict Resolution & Stacking Execution
        applied = []
        total_discount = Decimal("0.00")
        strategy = "BEST_BENEFIT"
        rejected_count = 0

        # Check for exclusive campaign
        exclusive_candidates = [c for c in evaluated_candidates if c["campaign"].is_exclusive]
        if exclusive_candidates:
            # Exclusive override: top exclusive candidate wins
            exclusive_candidates.sort(key=lambda x: (x["discount_amount"]), reverse=True)
            top_ex = exclusive_candidates[0]
            applied.append(top_ex)
            total_discount = top_ex["discount_amount"]
            strategy = "EXCLUSIVE_OVERRIDE"
            rejected_count = len(evaluated_candidates) - 1
        else:
            # Check stackable candidates
            stackable_candidates = [c for c in evaluated_candidates if c["campaign"].allow_stacking]
            non_stackable = [c for c in evaluated_candidates if not c["campaign"].allow_stacking]

            sum_stackable = sum((c["discount_amount"] for c in stackable_candidates), Decimal("0.00"))
            max_non_stackable = max((c["discount_amount"] for c in non_stackable), default=Decimal("0.00"))

            if stackable_candidates and sum_stackable >= max_non_stackable:
                max_stack_pct = min((c["campaign"].max_stacked_discount_percent or Decimal("50.00") for c in stackable_candidates), default=Decimal("50.00"))
                max_allowed_disc = gross_total * (Decimal(str(max_stack_pct)) / Decimal("100.00"))

                cur_disc = Decimal("0.00")
                for cand in stackable_candidates:
                    room = max_allowed_disc - cur_disc
                    if room <= 0:
                        rejected_count += 1
                        continue
                    applicable_part = min(cand["discount_amount"], room)
                    cand_copy = dict(cand)
                    cand_copy["discount_amount"] = applicable_part
                    applied.append(cand_copy)
                    cur_disc += applicable_part
                total_discount = cur_disc
                strategy = "BEST_BENEFIT"
                rejected_count += len(non_stackable)
            elif non_stackable:
                non_stackable.sort(key=lambda x: (x["discount_amount"]), reverse=True)
                top_cand = non_stackable[0]
                applied.append(top_cand)
                total_discount = top_cand["discount_amount"]
                strategy = "BEST_BENEFIT"
                rejected_count = len(evaluated_candidates) - 1

        applied_details = []
        for app_item in applied:
            applied_details.append(
                AppliedPromotionDetail(
                    campaign_id=app_item["campaign"].id,
                    campaign_name=app_item["campaign"].name,
                    rule_type=app_item["rule"].rule_type,
                    coupon_id=app_item.get("coupon_id"),
                    coupon_code=app_item.get("coupon_code"),
                    discount_amount=float(app_item["discount_amount"].quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
                    is_exclusive=app_item["campaign"].is_exclusive,
                    free_items_granted=app_item["free_items"],
                    narration=app_item["narration"],
                )
            )

        total_discount_final = float(total_discount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        gross_total_final = float(gross_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        net_total_final = max(0.0, float((gross_total - total_discount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)))

        return PromotionEvaluationResponse(
            gross_cart_total=gross_total_final,
            total_promotional_discount=total_discount_final,
            net_cart_total=net_total_final,
            applied_promotions=applied_details,
            rejected_promotions_count=rejected_count,
            conflict_resolution_strategy=strategy,
            allow_combine_with_loyalty=all(c["campaign"].allow_combine_with_loyalty for c in applied) if applied else True,
        )

    @classmethod
    async def record_redemption(
        cls,
        session: AsyncSession,
        company_id: str,
        req: PromotionRedemptionRequest,
    ) -> PromotionRedemption:
        """Authoritatively logs promotion redemption and increments coupon usage count."""
        redemption = PromotionRedemption(
            id=f"pred_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            campaign_id=req.campaign_id,
            coupon_id=req.coupon_id,
            customer_id=req.customer_id,
            reference_invoice_id=req.reference_invoice_id,
            discount_applied=Decimal(str(req.discount_applied)),
            conflict_resolution_strategy=req.conflict_resolution_strategy,
            is_active=True,
        )
        session.add(redemption)

        if req.coupon_id:
            stmt_cpn = select(Coupon).where(Coupon.id == req.coupon_id)
            cpn = (await session.execute(stmt_cpn)).scalars().first()
            if cpn:
                cpn.usage_count = (cpn.usage_count or 0) + 1

        await session.commit()
        return redemption
