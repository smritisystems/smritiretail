"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 20.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Period Trend & Variance Analyzer
"""

from typing import Dict, Any


class TrendAnalyzer:
    """Financial Trend & Budget Variance Analyzer."""

    @staticmethod
    def analyze_variance(period_name: str, budget_amount: float, actual_amount: float) -> Dict[str, Any]:
        variance_amt = round(actual_amount - budget_amount, 2)
        variance_pct = round((variance_amt / budget_amount) * 100.0, 2) if budget_amount > 0 else 0.0
        status = "ON_TARGET" if abs(variance_pct) <= 2.0 else ("FAVORABLE" if variance_amt > 0 else "UNFAVORABLE")

        return {
            "period": period_name,
            "budget_amount": budget_amount,
            "actual_amount": actual_amount,
            "variance_amount": variance_amt,
            "variance_percentage": variance_pct,
            "status": status
        }
