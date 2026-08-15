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

class CommissionProgram(BaseEntity):
    """SMRITI Universal Incentive & Commission Program (SICE)."""
    __tablename__ = "commission_programs"

    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

class CommissionRule(BaseEntity):
    """Commission Calculation Rule (Salesperson 2%, Referral 1%, Driver ₹50)."""
    __tablename__ = "commission_rules"

    program_id = Column(String(50), ForeignKey("commission_programs.id", ondelete="CASCADE"), nullable=False, index=True)
    participant_role = Column(String(50), nullable=False)  # SALESPERSON, DRIVER, REFERRER, AGENT, DEALER, AFFILIATE, INFLUENCER
    calculation_type = Column(String(30), nullable=False)  # PERCENTAGE, FIXED_AMOUNT, SLAB_BASED
    rate_percent = Column(Numeric(5, 2), default=0.00)
    fixed_amount = Column(Numeric(15, 2), default=0.00)
    min_order_amount = Column(Numeric(15, 2), default=0.00)
    max_commission_amount = Column(Numeric(15, 2), nullable=True)
    rule_conditions = Column(JSONB, server_default=text("'{}'"), default=dict)
    is_active = Column(Boolean, default=True)

class CommissionParticipant(BaseEntity):
    """Universal Person Role Assignment for Incentives & Commissions."""
    __tablename__ = "commission_participants"

    person_name = Column(String(255), nullable=False)
    user_id = Column(String(50), nullable=True, index=True)
    mobile = Column(String(20), index=True)
    roles = Column(JSONB, server_default=text("'[]'"), default=list)  # e.g., ["SALESPERSON", "REFERRER"]
    status = Column(String(20), default="Active")

class CommissionLedger(BaseEntity):
    """Authoritative Transactional Ledger for Universal Commissions (Earned, Reversed, Settled, Paid)."""
    __tablename__ = "commission_ledgers"

    participant_id = Column(String(50), ForeignKey("commission_participants.id", ondelete="CASCADE"), nullable=False, index=True)
    participant_role = Column(String(50), nullable=False)
    transaction_type = Column(String(50), nullable=False)  # EARNED, REVERSED, APPROVED, PAID
    gross_sales_amount = Column(Numeric(15, 2), default=0.00)
    commission_amount = Column(Numeric(15, 2), nullable=False)
    reference_invoice_id = Column(String(50), nullable=True, index=True)
    reference_return_id = Column(String(50), nullable=True, index=True)
    narration = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
