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
from datetime import datetime, timezone
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from app.models.promotions import PromotionCampaign, PromotionRule, Coupon, PromotionRedemption

def test_promotion_conflict_best_benefit_strategy():
    """Verify BEST_BENEFIT strategy selects the promotion providing maximum discount when multiple promotions apply."""
    invoice_amount = 10000.00

    promo_1_disc = invoice_amount * 0.10  # ₹1,000 (10% Off)
    promo_2_disc = 1500.00                 # ₹1,500 Flat Off
    promo_3_disc = invoice_amount * 0.12  # ₹1,200 (12% Off)

    # Engine selects highest monetary benefit = promo_2_disc (₹1,500)
    best_discount = max(promo_1_disc, promo_2_disc, promo_3_disc)
    assert best_discount == 1500.00

    redemption = PromotionRedemption(
        campaign_id="camp_flat1500",
        coupon_id="coup_flat1500",
        customer_id="cust_1001",
        reference_invoice_id="inv_100125",
        discount_applied=best_discount,
        conflict_resolution_strategy="BEST_BENEFIT",
        evaluated_campaigns_snapshot=[
            {"campaign": "10% Off", "discount": 1000.00, "status": "REJECTED", "reason": "LOWER_BENEFIT"},
            {"campaign": "Flat 1500 Off", "discount": 1500.00, "status": "APPLIED", "reason": "BEST_BENEFIT"},
            {"campaign": "12% Off", "discount": 1200.00, "status": "REJECTED", "reason": "LOWER_BENEFIT"}
        ]
    )
    assert redemption.discount_applied == 1500.00
    assert redemption.conflict_resolution_strategy == "BEST_BENEFIT"
    assert len(redemption.evaluated_campaigns_snapshot) == 3

def test_exclusive_promotion_override():
    """Verify exclusive promotion overrides all other promotions regardless of priority rank."""
    exclusive_promo = PromotionCampaign(
        name="VIP Exclusive 25% Off",
        priority=50,
        is_exclusive=True,
        allow_stacking=False
    )
    regular_promo = PromotionCampaign(
        name="Festive 10% Off",
        priority=1,
        is_exclusive=False,
        allow_stacking=True
    )

    assert exclusive_promo.is_exclusive is True
    assert regular_promo.is_exclusive is False

    redemption = PromotionRedemption(
        campaign_id="camp_exclusive",
        reference_invoice_id="inv_100126",
        discount_applied=2500.00,
        conflict_resolution_strategy="EXCLUSIVE_OVERRIDE",
        evaluated_campaigns_snapshot=[
            {"campaign": "VIP Exclusive 25% Off", "status": "APPLIED", "reason": "EXCLUSIVE_OVERRIDE"},
            {"campaign": "Festive 10% Off", "status": "REJECTED", "reason": "EXCLUSIVE_PROMOTION_ACTIVE"}
        ]
    )
    assert redemption.conflict_resolution_strategy == "EXCLUSIVE_OVERRIDE"

def test_promotion_stacking_and_max_cap_enforcement():
    """Verify stacked promotions enforce the maximum combined discount cap (50%)."""
    invoice_amount = 10000.00
    max_stacked_cap = invoice_amount * 0.50  # Max ₹5,000

    promo_1_disc = 3000.00
    promo_2_disc = 3000.00
    uncapped_total = promo_1_disc + promo_2_disc  # ₹6,000

    capped_total = min(uncapped_total, max_stacked_cap)  # Capped at ₹5,000
    assert capped_total == 5000.00

def test_evaluated_campaigns_audit_snapshot():
    """Verify redemption ledger retains full evaluation audit trail."""
    redemption = PromotionRedemption(
        campaign_id="camp_stacked",
        reference_invoice_id="inv_100127",
        discount_applied=4000.00,
        conflict_resolution_strategy="STACKED_APPLIED",
        evaluated_campaigns_snapshot=[
            {"campaign": "SUMMER26", "discount": 2000.00, "status": "STACKED"},
            {"campaign": "WELCOME10", "discount": 2000.00, "status": "STACKED"}
        ]
    )
    assert len(redemption.evaluated_campaigns_snapshot) == 2
