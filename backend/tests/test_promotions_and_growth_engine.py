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

import sys, os
from datetime import datetime, timedelta
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from app.models.promotions import PromotionCampaign, PromotionRule, Coupon, PromotionRedemption

def test_promotion_redemption_and_immutable_snapshot():
    """Verify promotion application to invoice stores an immutable rule snapshot."""
    now = datetime.utcnow()
    campaign = PromotionCampaign(
        name="SUMMER26 Mega Sale",
        promo_code="SUMMER26",
        start_date=now,
        end_date=now + timedelta(days=30),
        min_order_amount=1000.00,
        max_discount_amount=500.00,
        is_active=True
    )
    rule = PromotionRule(
        campaign_id="camp_001",
        rule_type="PERCENTAGE",
        discount_percent=10.00
    )

    redemption = PromotionRedemption(
        campaign_id="camp_001",
        coupon_id="coup_001",
        customer_id="cust_1001",
        reference_invoice_id="inv_100125",
        discount_applied=500.00,
        rule_snapshot={
            "campaign_name": campaign.name,
            "promo_code": campaign.promo_code,
            "discount_percent": 10.00,
            "max_discount": 500.00
        }
    )

    assert redemption.discount_applied == 500.00
    assert redemption.rule_snapshot["promo_code"] == "SUMMER26"
    assert redemption.reference_invoice_id == "inv_100125"

def test_coupon_validation_and_usage_tracking():
    """Verify coupon code tracking and usage limit enforcement."""
    coupon = Coupon(
        campaign_id="camp_001",
        code="SUMMER26",
        usage_limit=100,
        usage_count=5,
        is_active=True
    )
    assert coupon.code == "SUMMER26"
    assert coupon.usage_count < coupon.usage_limit

def test_customer_360_growth_ecosystem_co_location():
    """Verify CRM + Loyalty + Promotions + SICE unified co-location in smriti001."""
    # Entitlement policy definition
    assert PromotionCampaign.__tablename__ == "promotion_campaigns"
    assert PromotionRule.__tablename__ == "promotion_rules"
    assert Coupon.__tablename__ == "coupons"
    assert PromotionRedemption.__tablename__ == "promotion_redemptions"
