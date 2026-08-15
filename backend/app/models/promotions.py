"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

from datetime import datetime
from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, DateTime, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import BaseEntity

class PromotionCampaign(BaseEntity):
    """SMRITI Commercial Growth Engine - Promotion & Campaign Master."""
    __tablename__ = "promotion_campaigns"

    name = Column(String(100), nullable=False, unique=True)
    promo_code = Column(String(50), nullable=True, index=True)
    description = Column(Text, nullable=True)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    min_order_amount = Column(Numeric(15, 2), default=0.00)
    max_discount_amount = Column(Numeric(15, 2), nullable=True)
    usage_limit = Column(Integer, nullable=True)  # Overall campaign limit
    per_customer_limit = Column(Integer, default=1)
    applicable_stores = Column(JSONB, server_default=text("'[]'"), default=list)
    applicable_channels = Column(JSONB, server_default=text("'[]'"), default=list)  # POS, ECOMMERCE, MOBILE_APP
    customer_eligibility = Column(JSONB, server_default=text("'{}'"), default=dict)  # customer_group_ids, loyalty_tier_ids, first_order_only

    # Conflict Resolution & Stacking Rules
    priority = Column(Integer, default=10)  # Lower number = higher priority
    is_exclusive = Column(Boolean, default=False)  # If True, overrides all other promotions
    allow_stacking = Column(Boolean, default=False)  # Can combine with other non-exclusive promotions
    max_stacked_discount_percent = Column(Numeric(5, 2), default=50.00)
    allow_combine_with_loyalty = Column(Boolean, default=True)
    allow_combine_with_referral = Column(Boolean, default=True)

    is_active = Column(Boolean, default=True)

class PromotionRule(BaseEntity):
    """
    Promotion Discount & Offer Calculation Rules:
    - PERCENTAGE
    - FIXED_DISCOUNT
    - BUY_X_GET_Y
    - BUY_X_AT_PRICE
    - BUNDLE_OFFER
    - QUANTITY_DISCOUNT
    - MIX_MATCH
    - FREE_ITEM
    - FREE_SHIPPING
    """
    __tablename__ = "promotion_rules"

    campaign_id = Column(String(50), ForeignKey("promotion_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_type = Column(String(50), nullable=False)  # PERCENTAGE, FIXED_DISCOUNT, BUY_X_GET_Y, BUY_X_AT_PRICE, BUNDLE, FREE_SHIPPING
    discount_percent = Column(Numeric(5, 2), default=0.00)
    discount_fixed_amount = Column(Numeric(15, 2), default=0.00)
    special_price = Column(Numeric(15, 2), default=0.00)  # Buy X at ₹Y
    buy_quantity = Column(Integer, default=1)
    get_quantity = Column(Integer, default=0)
    bundle_offer_details = Column(JSONB, server_default=text("'{}'"), default=dict)
    product_eligibility = Column(JSONB, server_default=text("'{}'"), default=dict)  # product_ids, category_ids, brand_ids
    is_active = Column(Boolean, default=True)

class Coupon(BaseEntity):
    """Promo Codes & Discount Coupons."""
    __tablename__ = "coupons"

    campaign_id = Column(String(50), ForeignKey("promotion_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False, unique=True, index=True)
    usage_limit = Column(Integer, default=100)
    usage_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

class PromotionRedemption(BaseEntity):
    """Authoritative Transactional Redemption Ledger for Promotions & Coupons."""
    __tablename__ = "promotion_redemptions"

    campaign_id = Column(String(50), ForeignKey("promotion_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    coupon_id = Column(String(50), ForeignKey("coupons.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_id = Column(String(50), nullable=True, index=True)
    reference_invoice_id = Column(String(50), nullable=False, index=True)
    discount_applied = Column(Numeric(15, 2), nullable=False)

    # Conflict Resolution Audit Snapshot
    conflict_resolution_strategy = Column(String(50), default="BEST_BENEFIT")  # BEST_BENEFIT, HIGHEST_PRIORITY, EXCLUSIVE_OVERRIDE
    evaluated_campaigns_snapshot = Column(JSONB, server_default=text("'[]'"), default=list)  # Evaluated, stacked, and rejected campaigns
    rule_snapshot = Column(JSONB, server_default=text("'{}'"), default=dict)  # Immutable snapshot at transaction time

    timestamp = Column(DateTime, default=datetime.utcnow)
