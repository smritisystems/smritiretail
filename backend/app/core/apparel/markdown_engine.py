"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 25.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Seasonal Clearance & Markdown Engine
"""

from typing import Dict, Any


class SeasonalMarkdownEngine:
    """Automated Age-based Discount Calculator."""

    MARKDOWN_TIERS = [
        {"min_age": 120, "discount_pct": 50.0, "reason": "END_OF_SEASON_CLEARANCE"},
        {"min_age": 60,  "discount_pct": 20.0, "reason": "MID_SEASON_MARKDOWN"},
        {"min_age": 30,  "discount_pct": 10.0, "reason": "EARLY_BIRD_PROMO"},
    ]

    @classmethod
    def calculate_markdown(cls, original_mrp: float, inventory_age_days: int) -> Dict[str, Any]:
        discount_pct = 0.0
        reason = "REGULAR_PRICE"

        for tier in cls.MARKDOWN_TIERS:
            if inventory_age_days >= tier["min_age"]:
                discount_pct = tier["discount_pct"]
                reason = tier["reason"]
                break

        discount_amount = round((original_mrp * discount_pct) / 100.0, 2)
        effective_price = round(original_mrp - discount_amount, 2)

        return {
            "original_mrp": original_mrp,
            "inventory_age_days": inventory_age_days,
            "applied_discount_percentage": discount_pct,
            "discount_amount": discount_amount,
            "effective_selling_price": effective_price,
            "markdown_reason": reason
        }
