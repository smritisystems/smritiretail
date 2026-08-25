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

from sqlalchemy import Column, String, Numeric, Boolean
from ..db.base import BaseEntity


class CGEUnifiedPolicy(BaseEntity):
    """
    CGEUnifiedPolicy — Unified anti-abuse and validation policies for CRM, Loyalty, Referral, and Commissions.
    """
    __tablename__ = "cge_unified_policies"

    policy_code = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    max_daily_points_accrual = Column(Numeric(12, 2), default=10000.00)
    min_order_value_for_referral = Column(Numeric(15, 2), default=500.00)
    allow_self_referral = Column(Boolean, default=False)
    commission_reversal_on_refund = Column(Boolean, default=True)
