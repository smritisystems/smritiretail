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

import uuid
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import select, update, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.loyalty import LoyaltyTier, LoyaltyRule, LoyaltyMember, LoyaltyPointsLedger
from ..models.commission import CommissionProgram, CommissionRule, CommissionParticipant, CommissionLedger
from ..models.promotions import PromotionCampaign, PromotionRule, Coupon, PromotionRedemption
from ..models.referral import ReferralProgram, ReferralRelationship, ReferralReward
from ..models.crm import Customer


def _quantize_currency(val: float | Decimal) -> Decimal:
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class CommercialGrowthEngine:
    """
    SMRITI Commercial Growth Engine (CGE).
    Unified transactional engine for:
    1. Loyalty points accrual, tier graduation & redemption.
    2. Promotions, campaign stacking & coupon evaluation.
    3. Universal commission ledger & referral reward attribution.
    """

    # --- 1. Loyalty Program Operations ---

    @classmethod
    async def get_or_create_loyalty_member(
        cls,
        session: AsyncSession,
        company_id: str,
        branch_id: str,
        customer_id: str,
        card_number: Optional[str] = None
    ) -> LoyaltyMember:
        """Finds or enrolls a customer into the SMRITI Loyalty Program."""
        stmt = select(LoyaltyMember).where(
            LoyaltyMember.customer_id == customer_id,
            LoyaltyMember.company_id == company_id,
            LoyaltyMember.is_deleted == False
        )
        member = (await session.execute(stmt)).scalar_one_or_none()
        if member:
            return member

        # Determine baseline tier (lowest min_spend tier)
        tier_stmt = select(LoyaltyTier).where(
            LoyaltyTier.company_id == company_id,
            LoyaltyTier.is_active == True,
            LoyaltyTier.is_deleted == False
        ).order_by(LoyaltyTier.min_spend.asc())
        default_tier = (await session.execute(tier_stmt)).scalars().first()

        # Check if customer exists, else create default customer
        cust_stmt = select(Customer).where(Customer.id == customer_id, Customer.company_id == company_id)
        cust = (await session.execute(cust_stmt)).scalar_one_or_none()
        if not cust:
            cust = Customer(
                id=customer_id,
                company_id=company_id,
                branch_id=None,
                name=f"Customer {customer_id}",
                is_active=True,
                is_deleted=False
            )
            session.add(cust)
            await session.flush()

        member_id = f"lm_{uuid.uuid4().hex[:12]}"
        card_no = card_number or f"CARD-{uuid.uuid4().hex[:8].upper()}"

        member = LoyaltyMember(
            id=member_id,
            company_id=company_id,
            branch_id=None,
            customer_id=customer_id,
            loyalty_tier_id=default_tier.id if default_tier else None,
            card_number=card_no,
            total_points_earned=Decimal("0.00"),
            total_points_redeemed=Decimal("0.00"),
            current_points_balance=Decimal("0.00"),
            total_lifetime_spend=Decimal("0.00"),
            is_active=True,
            is_deleted=False
        )
        session.add(member)
        await session.flush()
        return member

    @classmethod
    async def calculate_loyalty_points_for_spend(
        cls,
        session: AsyncSession,
        company_id: str,
        member_id: str,
        spend_amount: Decimal
    ) -> Decimal:
        """Calculates loyalty points to earn on an invoice based on tier multipliers and rules."""
        member_stmt = select(LoyaltyMember).where(
            LoyaltyMember.id == member_id,
            LoyaltyMember.company_id == company_id
        )
        member = (await session.execute(member_stmt)).scalar_one_or_none()
        if not member:
            return Decimal("0.00")

        multiplier = Decimal("1.00")
        if member.loyalty_tier_id:
            tier_stmt = select(LoyaltyTier).where(LoyaltyTier.id == member.loyalty_tier_id)
            tier = (await session.execute(tier_stmt)).scalar_one_or_none()
            if tier and tier.earn_multiplier:
                multiplier = Decimal(str(tier.earn_multiplier))

        # Default rule: 1 point per 100 spend unit
        base_rate = Decimal("1.00")
        unit_spend = Decimal("100.00")

        rule_stmt = select(LoyaltyRule).where(
            LoyaltyRule.company_id == company_id,
            LoyaltyRule.is_active == True,
            LoyaltyRule.is_deleted == False
        ).order_by(LoyaltyRule.created_at.desc())
        active_rule = (await session.execute(rule_stmt)).scalars().first()
        if active_rule:
            base_rate = Decimal(str(active_rule.points_per_unit_spend))
            unit_spend = Decimal(str(active_rule.unit_spend_amount or 100.00))

        raw_points = (spend_amount / unit_spend) * base_rate * multiplier
        return _quantize_currency(raw_points)

    @classmethod
    async def record_points_transaction(
        cls,
        session: AsyncSession,
        company_id: str,
        branch_id: str,
        member_id: str,
        transaction_type: str,
        points: Decimal,
        reference_invoice_id: Optional[str] = None,
        spend_delta: Decimal = Decimal("0.00"),
        narration: Optional[str] = None
    ) -> LoyaltyPointsLedger:
        """Authoritatively writes loyalty points to ledger and updates member balance & tier."""
        member_stmt = select(LoyaltyMember).where(
            LoyaltyMember.id == member_id,
            LoyaltyMember.company_id == company_id
        )
        member = (await session.execute(member_stmt)).scalar_one_or_none()
        if not member:
            raise ValueError(f"Loyalty member '{member_id}' not found.")

        ledger_id = f"lpl_{uuid.uuid4().hex[:12]}"
        ledger_entry = LoyaltyPointsLedger(
            id=ledger_id,
            company_id=company_id,
            branch_id=None,
            member_id=member_id,
            transaction_type=transaction_type,
            points=points,
            reference_invoice_id=reference_invoice_id,
            narration=narration or f"{transaction_type} {points} pts",
            is_active=True,
            is_deleted=False
        )
        session.add(ledger_entry)

        # Update member balance
        if transaction_type == "EARN":
            member.total_points_earned = Decimal(str(member.total_points_earned)) + points
            member.current_points_balance = Decimal(str(member.current_points_balance)) + points
        elif transaction_type == "REDEEM":
            member.total_points_redeemed = Decimal(str(member.total_points_redeemed)) + abs(points)
            member.current_points_balance = Decimal(str(member.current_points_balance)) - abs(points)
        elif transaction_type == "REVERSAL":
            member.current_points_balance = Decimal(str(member.current_points_balance)) - abs(points)

        if spend_delta > 0:
            member.total_lifetime_spend = Decimal(str(member.total_lifetime_spend)) + spend_delta

        # Automatic Tier Advancement Check
        tier_stmt = select(LoyaltyTier).where(
            LoyaltyTier.company_id == company_id,
            LoyaltyTier.min_spend <= member.total_lifetime_spend,
            LoyaltyTier.is_active == True,
            LoyaltyTier.is_deleted == False
        ).order_by(LoyaltyTier.min_spend.desc())
        eligible_tier = (await session.execute(tier_stmt)).scalars().first()
        if eligible_tier and eligible_tier.id != member.loyalty_tier_id:
            member.loyalty_tier_id = eligible_tier.id

        await session.flush()
        return ledger_entry

    # --- 2. Promotions & Coupon Engine ---

    @classmethod
    async def validate_and_evaluate_coupon(
        cls,
        session: AsyncSession,
        company_id: str,
        coupon_code: str,
        cart_total: Decimal,
        customer_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Validates a promotional coupon code against active campaign rules."""
        clean_code = coupon_code.strip().upper()
        now = datetime.now(timezone.utc)

        stmt = select(Coupon).where(
            Coupon.code == clean_code,
            Coupon.company_id == company_id,
            Coupon.is_active == True,
            Coupon.is_deleted == False
        )
        coupon = (await session.execute(stmt)).scalar_one_or_none()
        if not coupon:
            return {"is_valid": False, "discount_amount": Decimal("0.00"), "reason": "Coupon code invalid or expired"}

        if coupon.usage_limit and coupon.usage_count >= coupon.usage_limit:
            return {"is_valid": False, "discount_amount": Decimal("0.00"), "reason": "Coupon usage limit exceeded"}

        # Fetch Campaign
        camp_stmt = select(PromotionCampaign).where(
            PromotionCampaign.id == coupon.campaign_id,
            PromotionCampaign.company_id == company_id,
            PromotionCampaign.is_active == True,
            PromotionCampaign.is_deleted == False
        )
        campaign = (await session.execute(camp_stmt)).scalar_one_or_none()
        if not campaign:
            return {"is_valid": False, "discount_amount": Decimal("0.00"), "reason": "Associated campaign not active"}

        # Check date window
        if campaign.start_date and campaign.start_date.tzinfo is None:
            c_start = campaign.start_date.replace(tzinfo=timezone.utc)
        else:
            c_start = campaign.start_date

        if campaign.end_date and campaign.end_date.tzinfo is None:
            c_end = campaign.end_date.replace(tzinfo=timezone.utc)
        else:
            c_end = campaign.end_date

        if c_start and now < c_start:
            return {"is_valid": False, "discount_amount": Decimal("0.00"), "reason": "Campaign has not started yet"}
        if c_end and now > c_end:
            return {"is_valid": False, "discount_amount": Decimal("0.00"), "reason": "Campaign has expired"}

        if cart_total < Decimal(str(campaign.min_order_amount or 0)):
            return {
                "is_valid": False,
                "discount_amount": Decimal("0.00"),
                "reason": f"Minimum cart amount of ₹{campaign.min_order_amount} required"
            }

        # Calculate discount from first active rule
        rule_stmt = select(PromotionRule).where(
            PromotionRule.campaign_id == campaign.id,
            PromotionRule.is_active == True,
            PromotionRule.is_deleted == False
        )
        rules = (await session.execute(rule_stmt)).scalars().all()

        discount = Decimal("0.00")
        for r in rules:
            if r.rule_type == "PERCENTAGE" and r.discount_percent:
                discount += cart_total * (Decimal(str(r.discount_percent)) / Decimal("100.00"))
            elif r.rule_type == "FIXED_DISCOUNT" and r.discount_fixed_amount:
                discount += Decimal(str(r.discount_fixed_amount))

        if campaign.max_discount_amount and discount > Decimal(str(campaign.max_discount_amount)):
            discount = Decimal(str(campaign.max_discount_amount))

        discount = _quantize_currency(min(discount, cart_total))
        return {
            "is_valid": True,
            "coupon_id": coupon.id,
            "campaign_id": campaign.id,
            "campaign_name": campaign.name,
            "discount_amount": discount,
            "allow_combine_with_loyalty": bool(campaign.allow_combine_with_loyalty)
        }

    @classmethod
    async def record_coupon_redemption(
        cls,
        session: AsyncSession,
        company_id: str,
        branch_id: str,
        campaign_id: str,
        coupon_id: Optional[str],
        reference_invoice_id: str,
        discount_applied: Decimal,
        customer_id: Optional[str] = None
    ) -> PromotionRedemption:
        """Authoritatively writes coupon redemption to ledger and increments usage count."""
        redemption_id = f"pred_{uuid.uuid4().hex[:12]}"
        redemption = PromotionRedemption(
            id=redemption_id,
            company_id=company_id,
            branch_id=branch_id,
            campaign_id=campaign_id,
            coupon_id=coupon_id,
            customer_id=customer_id,
            reference_invoice_id=reference_invoice_id,
            discount_applied=discount_applied,
            conflict_resolution_strategy="BEST_BENEFIT",
            is_active=True,
            is_deleted=False
        )
        session.add(redemption)

        if coupon_id:
            c_stmt = select(Coupon).where(Coupon.id == coupon_id)
            coupon = (await session.execute(c_stmt)).scalar_one_or_none()
            if coupon:
                coupon.usage_count = (coupon.usage_count or 0) + 1

        await session.flush()
        return redemption

    # --- 3. Universal Commission & Referral Operations ---

    @classmethod
    async def record_commission(
        cls,
        session: AsyncSession,
        company_id: str,
        branch_id: str,
        participant_id: str,
        participant_role: str,
        gross_sales_amount: Decimal,
        commission_rate_pct: Decimal,
        reference_invoice_id: Optional[str] = None,
        narration: Optional[str] = None
    ) -> CommissionLedger:
        """Calculates and authoritatively records salesperson or agent commission."""
        commission_amount = _quantize_currency(gross_sales_amount * (commission_rate_pct / Decimal("100.00")))
        ledger_id = f"cml_{uuid.uuid4().hex[:12]}"

        ledger = CommissionLedger(
            id=ledger_id,
            company_id=company_id,
            branch_id=branch_id,
            participant_id=participant_id,
            participant_role=participant_role,
            transaction_type="EARNED",
            gross_sales_amount=gross_sales_amount,
            commission_amount=commission_amount,
            reference_invoice_id=reference_invoice_id,
            narration=narration or f"Commission earned on Inv #{reference_invoice_id}",
            is_active=True,
            is_deleted=False
        )
        session.add(ledger)
        await session.flush()
        return ledger
