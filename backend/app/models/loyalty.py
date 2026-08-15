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
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import BaseEntity

class LoyaltyTier(BaseEntity):
    """Loyalty Tiers (Bronze, Silver, Gold, Platinum). Configured in Control Plane/Company DB."""
    __tablename__ = "loyalty_tiers"

    name = Column(String(100), nullable=False, unique=True)
    min_spend = Column(Numeric(15, 2), default=0.00)
    earn_multiplier = Column(Numeric(5, 2), default=1.00)
    redemption_ratio = Column(Numeric(5, 2), default=1.00)  # 1 Point = ₹X
    benefits = Column(JSONB, server_default=text("'{}'"), default=dict)
    is_active = Column(Boolean, default=True)

class LoyaltyRule(BaseEntity):
    """Loyalty Earning and Redemption Rules."""
    __tablename__ = "loyalty_rules"

    name = Column(String(100), nullable=False)
    rule_type = Column(String(50), nullable=False)  # SPEND_BASED, CATEGORY_BONUS, BIRTHDAY_BONUS
    min_invoice_amount = Column(Numeric(15, 2), default=0.00)
    points_per_unit_spend = Column(Numeric(10, 2), default=1.00)
    unit_spend_amount = Column(Numeric(15, 2), default=100.00)  # e.g., 1 Point per ₹100
    expiry_days = Column(Integer, default=365)
    is_active = Column(Boolean, default=True)

class LoyaltyMember(BaseEntity):
    """Loyalty Program Member (Mapped to Customer / Person)."""
    __tablename__ = "loyalty_members"

    customer_id = Column(String(50), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    loyalty_tier_id = Column(String(50), ForeignKey("loyalty_tiers.id", ondelete="SET NULL"), nullable=True)
    card_number = Column(String(50), unique=True, index=True)
    total_points_earned = Column(Numeric(15, 2), default=0.00)
    total_points_redeemed = Column(Numeric(15, 2), default=0.00)
    current_points_balance = Column(Numeric(15, 2), default=0.00)
    total_lifetime_spend = Column(Numeric(15, 2), default=0.00)
    joined_date = Column(DateTime, default=datetime.utcnow)

class LoyaltyPointsLedger(BaseEntity):
    """Authoritative Transactional Ledger for Loyalty Points (Earn, Redeem, Reversal, Expiry)."""
    __tablename__ = "loyalty_points_ledgers"

    member_id = Column(String(50), ForeignKey("loyalty_members.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_type = Column(String(50), nullable=False)  # EARN, REDEEM, REVERSAL, EXPIRY, ADJUSTMENT
    points = Column(Numeric(15, 2), nullable=False)  # Positive for Earn, Negative for Redeem/Reversal
    reference_invoice_id = Column(String(50), nullable=True, index=True)
    reference_return_id = Column(String(50), nullable=True, index=True)
    narration = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
