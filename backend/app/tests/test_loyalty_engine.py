"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 22.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pytest Suite for Domain Release Phase 28 Loyalty Engine

test_loyalty_engine.py — Integration test suite for Customer Loyalty Engine (v22.0.0).
"""

import pytest

from app.core.loyalty.loyalty_manager import LoyaltyManager
from app.core.loyalty.promotion_engine import PromotionEngine
from app.core.loyalty.giftcard_ledger import GiftCardLedger


@pytest.mark.asyncio
async def test_loyalty_manager_points_and_tier_upgrade():
    """Verify LoyaltyManager accrues points and upgrades customer tier."""
    acc = LoyaltyManager.get_or_create_account("CUST-1001", "Rajesh Kumar")
    assert acc.tier == "BRONZE"
    assert acc.points_balance == 0

    # Add $1200 spend -> earn 120 points -> upgrade to SILVER
    pts1 = acc.add_spend(1200.0)
    assert pts1 == 120
    assert acc.points_balance == 120
    assert acc.tier == "SILVER"

    # Add $4000 spend -> total 5200 spend -> upgrade to GOLD
    acc.add_spend(4000.0)
    assert acc.tier == "GOLD"


@pytest.mark.asyncio
async def test_promotion_engine_coupon_validation():
    """Verify PromotionEngine validates coupon codes and calculates discounts."""
    # WELCOME10 gives 10% off for cart >= $50
    res_ok = PromotionEngine.apply_coupon("WELCOME10", cart_total=100.0)
    assert res_ok["valid"] is True
    assert res_ok["discount_amount"] == 10.0
    assert res_ok["final_total"] == 90.0

    # Rejection if cart below min_cart threshold
    res_min = PromotionEngine.apply_coupon("SAVE50", cart_total=150.0)
    assert res_min["valid"] is False
    assert res_min["discount_amount"] == 0.0


@pytest.mark.asyncio
async def test_gift_card_ledger_issuance_and_redemption():
    """Verify GiftCardLedger issues gift cards and handles redemptions."""
    card = GiftCardLedger.issue_card("GC-9900-1122", initial_balance=500.0)
    assert card.balance_amount == 500.0

    # Redeem $200
    res_red = GiftCardLedger.redeem_card("GC-9900-1122", amount=200.0)
    assert res_red["success"] is True
    assert res_red["remaining_balance"] == 300.0

    # Excessive redemption -> Fail
    res_fail = GiftCardLedger.redeem_card("GC-9900-1122", amount=400.0)
    assert res_fail["success"] is False
    assert res_fail["remaining_balance"] == 300.0
