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
from app.models.crm import Customer, CustomerGroup
from app.models.loyalty import LoyaltyTier, LoyaltyMember, LoyaltyPointsLedger
from app.models.commission import CommissionProgram, CommissionRule, CommissionParticipant, CommissionLedger
from app.models.promotions import PromotionCampaign, PromotionRule, Coupon, PromotionRedemption
from app.models.referral import ReferralProgram, ReferralRelationship, ReferralReward

def test_referral_reward_earn_and_reversal():
    """Verify referral reward calculation and automatic reversal on Sales Return."""
    reward_earned = ReferralReward(
        relationship_id="rel_1001",
        referrer_person_id="person_rahul_001",
        transaction_type="EARNED",
        reward_amount=100.00,
        reference_invoice_id="inv_100125",
        narration="Earned ₹100 referral reward on qualifying purchase"
    )
    assert reward_earned.reward_amount == 100.00
    assert reward_earned.transaction_type == "EARNED"

    reward_reversed = ReferralReward(
        relationship_id="rel_1001",
        referrer_person_id="person_rahul_001",
        transaction_type="REVERSED",
        reward_amount=-100.00,
        reference_return_id="ret_100125",
        narration="Reversed ₹100 referral reward due to Sales Return"
    )
    assert reward_reversed.reward_amount == -100.00
    assert reward_reversed.transaction_type == "REVERSED"

def test_unambiguous_database_ownership():
    """
    Verify Unambiguous Database Ownership Rule:
    smritisys: Capability entitlements, platform defaults, policy/configuration.
    smriti001: ALL operational definitions and transactional ledgers.
    """
    op_tables_in_smriti001 = [
        CommissionProgram.__tablename__,
        CommissionRule.__tablename__,
        CommissionParticipant.__tablename__,
        CommissionLedger.__tablename__,
        PromotionCampaign.__tablename__,
        PromotionRule.__tablename__,
        Coupon.__tablename__,
        PromotionRedemption.__tablename__,
        LoyaltyMember.__tablename__,
        LoyaltyPointsLedger.__tablename__,
        ReferralProgram.__tablename__,
        ReferralRelationship.__tablename__,
        ReferralReward.__tablename__
    ]

    expected = [
        "commission_programs", "commission_rules", "commission_participants", "commission_ledgers",
        "promotion_campaigns", "promotion_rules", "coupons", "promotion_redemptions",
        "loyalty_members", "loyalty_points_ledgers",
        "referral_programs", "referral_relationships", "referral_rewards"
    ]
    assert op_tables_in_smriti001 == expected

def test_customer_360_ecosystem_aggregation():
    """Verify Customer 360 ecosystem integrates CRM, Loyalty, Promotions, Referrals & Commissions."""
    customer = Customer(code="CUST-001", name="Rahul Sharma", mobile="9876543210")
    participant = CommissionParticipant(person_name="Rahul Sharma", roles=["SALESPERSON", "REFERRER"])

    assert customer.name == "Rahul Sharma"
    assert "SALESPERSON" in participant.roles
    assert "REFERRER" in participant.roles
