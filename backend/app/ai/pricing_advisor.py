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
Classification: Intelligent Pricing & Markdown Advisor
"""

from typing import Dict, Any
from app.ai.providers.local_statistical_provider import LocalStatisticalProvider, AdvisoryRecommendation

provider = LocalStatisticalProvider()


class PricingAdvisor:
    """Pricing & Markdown Advisory Engine."""

    @staticmethod
    async def get_pricing_recommendation(item_id: str, current_price: float, cost: float, stock_qty: int) -> Dict[str, Any]:
        rec: AdvisoryRecommendation = await provider.recommend_pricing(item_id, current_price, cost, stock_qty)
        return rec.to_dict()
