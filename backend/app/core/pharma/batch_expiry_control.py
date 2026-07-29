"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 24.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Strict FEFO & Near-Expiry Lock Engine
"""

from datetime import datetime, timedelta
from typing import Dict, Any


class BatchExpiryControlEngine:
    """Near-Expiry Sales Lock & Compliance Engine."""

    MINIMUM_EXPIRY_DAYS_THRESHOLD = 30  # Block checkout sales if medicine expires within 30 days

    @classmethod
    def evaluate_batch_sale_eligibility(cls, batch_number: str, expiry_date_str: str) -> Dict[str, Any]:
        try:
            exp_date = datetime.strptime(expiry_date_str, "%Y-%m-%d")
        except ValueError:
            return {"batch_number": batch_number, "is_eligible": False, "reason": "Invalid date format"}

        today = datetime.utcnow()
        days_until_expiry = (exp_date - today).days

        if days_until_expiry <= 0:
            is_eligible = False
            reason = "EXPIRED_MEDICINE"
        elif days_until_expiry < cls.MINIMUM_EXPIRY_DAYS_THRESHOLD:
            is_eligible = False
            reason = f"NEAR_EXPIRY_LOCK (Expires in {days_until_expiry} days)"
        else:
            is_eligible = True
            reason = "APPROVED_FOR_SALE"

        return {
            "batch_number": batch_number,
            "expiry_date": expiry_date_str,
            "days_until_expiry": days_until_expiry,
            "is_eligible_for_sale": is_eligible,
            "lock_reason": reason
        }
