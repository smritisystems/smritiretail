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

from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, Field


class CGEPolicyCreateReq(BaseModel):
    policy_code: str
    name: str
    max_daily_points_accrual: Decimal = Decimal("10000.00")
    min_order_value_for_referral: Decimal = Decimal("500.00")
    allow_self_referral: bool = False
    commission_reversal_on_refund: bool = True


class CGEAntiAbuseCheckReq(BaseModel):
    customer_id: str
    referrer_id: Optional[str] = None
    requested_points: Decimal = Decimal("0.00")
    order_amount: Decimal = Decimal("0.00")
    policy_code: Optional[str] = None


class CGEAntiAbuseCheckResponse(BaseModel):
    allowed: bool
    risk_level: str  # CLEAN, WARNING, BLOCKED
    violations: List[str] = Field(default_factory=list)
    adjusted_points_allowed: Decimal = Decimal("0.00")
    referral_reward_eligible: bool = True


class CGEReversalReq(BaseModel):
    original_invoice_no: str
    refund_amount: Decimal
    reason: str = "ORDER_RETURN_REFUND"
    reverse_loyalty: bool = True
    reverse_commission: bool = True


class CGEReversalResponse(BaseModel):
    reversal_id: str
    original_invoice_no: str
    reversed_loyalty_points: Decimal
    reversed_commission_amount: Decimal
    status: str = "REVERSED"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
