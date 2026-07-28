"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.0.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
SMRITI CRM Core Layer - Customer Credit Control & Risk Management Engine
Conforms to Level 1 SMRITI Architecture Constitution (Rule GR-011 Canonical Ownership: CRM).

Enforces credit risk policies for wholesale / B2B customer orders & invoices:
1. Exposure = Outstanding Unpaid Invoices + Unbilled Confirmed Sales Orders
2. Soft Warning: Utilization >= 80% of Credit Limit
3. Hard Block: Total Exposure >= 100% of Credit Limit OR Oldest Unpaid Invoice Overdue > Max Allowed Days (e.g. 90 days).
4. Prevents order processing or invoice generation when HARD_BLOCK is active.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class CreditStatus(str, Enum):
    NORMAL = "NORMAL"
    SOFT_WARNING = "SOFT_WARNING"
    HARD_BLOCK = "HARD_BLOCK"


@dataclass
class CustomerCreditProfile:
    customer_id: str
    customer_name: str
    credit_limit: float
    outstanding_balance: float = 0.0
    unbilled_orders_amount: float = 0.0
    oldest_overdue_days: int = 0
    max_allowed_overdue_days: int = 90
    credit_hold_manual: bool = False


@dataclass
class CreditEvaluationResult:
    customer_id: str
    credit_limit: float
    current_exposure: float
    projected_exposure: float
    utilization_percentage: float
    status: CreditStatus
    allow_new_order: bool
    blocking_reason: Optional[str] = None


class CustomerCreditControlEngine:
    """
    Canonical Engine for Customer Credit Limits & Soft/Hard Block Rules.
    """

    @staticmethod
    def evaluate_credit(
        profile: CustomerCreditProfile, new_order_amount: float = 0.0
    ) -> CreditEvaluationResult:
        if new_order_amount < 0:
            raise ValueError("New order amount cannot be negative.")

        current_exposure = round(profile.outstanding_balance + profile.unbilled_orders_amount, 2)
        projected_exposure = round(current_exposure + new_order_amount, 2)

        if profile.credit_limit <= 0:
            # Unlimited credit profile
            return CreditEvaluationResult(
                customer_id=profile.customer_id,
                credit_limit=0.0,
                current_exposure=current_exposure,
                projected_exposure=projected_exposure,
                utilization_percentage=0.0,
                status=CreditStatus.NORMAL,
                allow_new_order=not profile.credit_hold_manual,
                blocking_reason="Manual credit hold active" if profile.credit_hold_manual else None,
            )

        utilization_pct = round((projected_exposure / profile.credit_limit) * 100.0, 2)

        # Check blocking conditions
        reasons = []
        if profile.credit_hold_manual:
            reasons.append("Account is under manual credit hold by credit manager.")

        if projected_exposure > profile.credit_limit:
            exceeded = projected_exposure - profile.credit_limit
            reasons.append(
                f"Credit limit exceeded by ₹{exceeded:.2f} (Limit: ₹{profile.credit_limit:.2f}, Exposure: ₹{projected_exposure:.2f})."
            )

        if (
            profile.oldest_overdue_days > profile.max_allowed_overdue_days
            and profile.outstanding_balance > 0
        ):
            reasons.append(
                f"Invoices overdue by {profile.oldest_overdue_days} days (Max allowed: {profile.max_allowed_overdue_days} days)."
            )

        if reasons:
            return CreditEvaluationResult(
                customer_id=profile.customer_id,
                credit_limit=profile.credit_limit,
                current_exposure=current_exposure,
                projected_exposure=projected_exposure,
                utilization_percentage=utilization_pct,
                status=CreditStatus.HARD_BLOCK,
                allow_new_order=False,
                blocking_reason=" | ".join(reasons),
            )

        # Soft warning if utilization >= 80%
        if utilization_pct >= 80.0:
            status = CreditStatus.SOFT_WARNING
            warn_msg = f"Soft Warning: Credit limit utilization at {utilization_pct:.1f}%."
        else:
            status = CreditStatus.NORMAL
            warn_msg = None

        return CreditEvaluationResult(
            customer_id=profile.customer_id,
            credit_limit=profile.credit_limit,
            current_exposure=current_exposure,
            projected_exposure=projected_exposure,
            utilization_percentage=utilization_pct,
            status=status,
            allow_new_order=True,
            blocking_reason=warn_msg,
        )
