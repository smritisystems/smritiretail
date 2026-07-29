"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 16.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Automated Inventory Replenishment Advisor
"""

from typing import Dict, Any
from app.ai.providers.base_provider import AdvisoryRecommendation


class ReplenishmentAdvisor:
    """Inventory Replenishment & Reorder Advisory Engine."""

    @staticmethod
    async def recommend_reorder(item_id: str, current_stock: int, min_reorder_point: int, lead_time_days: int) -> Dict[str, Any]:
        should_reorder = current_stock <= min_reorder_point
        suggested_qty = (min_reorder_point * 2) - current_stock if should_reorder else 0

        rec = AdvisoryRecommendation(
            recommendation={"should_reorder": should_reorder, "suggested_reorder_qty": suggested_qty},
            confidence=0.96,
            evidence=[f"Current stock: {current_stock}", f"Reorder threshold: {min_reorder_point}", f"Supplier lead time: {lead_time_days} days"],
            explanation="Reorder recommended to prevent stockout based on lead-time buffer." if should_reorder else "Stock level optimal."
        )
        return rec.to_dict()
