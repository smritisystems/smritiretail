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

class ReferralProgram(BaseEntity):
    """SMRITI Commercial Growth Engine - Referral Program Master."""
    __tablename__ = "referral_programs"

    name = Column(String(100), nullable=False, unique=True)
    referral_code_prefix = Column(String(20), default="REF")
    min_qualifying_order_amount = Column(Numeric(15, 2), default=500.00)
    referrer_reward_amount = Column(Numeric(15, 2), default=100.00)
    referee_discount_percent = Column(Numeric(5, 2), default=10.00)
    is_active = Column(Boolean, default=True)

class ReferralRelationship(BaseEntity):
    """Referrer Person -> Referred Customer Link."""
    __tablename__ = "referral_relationships"

    program_id = Column(String(50), ForeignKey("referral_programs.id", ondelete="CASCADE"), nullable=False, index=True)
    referrer_person_id = Column(String(50), nullable=False, index=True)  # Universal Person ID
    referred_customer_id = Column(String(50), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    referral_code_used = Column(String(50), nullable=False, index=True)
    status = Column(String(30), default="QUALIFIED")  # PENDING, QUALIFIED, REJECTED
    created_at = Column(DateTime, default=datetime.utcnow)

class ReferralReward(BaseEntity):
    """Authoritative Transactional Ledger for Referral Rewards (Earned, Reversed, Paid)."""
    __tablename__ = "referral_rewards"

    relationship_id = Column(String(50), ForeignKey("referral_relationships.id", ondelete="CASCADE"), nullable=False, index=True)
    referrer_person_id = Column(String(50), nullable=False, index=True)
    transaction_type = Column(String(50), nullable=False)  # EARNED, REVERSED, PAID
    reward_amount = Column(Numeric(15, 2), nullable=False)
    reference_invoice_id = Column(String(50), nullable=True, index=True)
    reference_return_id = Column(String(50), nullable=True, index=True)
    narration = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
