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
Classification: Local Statistical AI Provider
"""

from typing import List
from app.ai.providers.base_provider import BaseAIProvider, AdvisoryRecommendation


class LocalStatisticalProvider(BaseAIProvider):
    """Zero-dependency Local Statistical Rules AI Provider."""

    def __init__(self):
        super().__init__("local_statistical", "Local Statistical Rules Engine")

    async def predict_demand(self, item_id: str, historical_sales: List[float]) -> AdvisoryRecommendation:
        if not historical_sales:
            return AdvisoryRecommendation(
                recommendation=10.0,
                confidence=0.5,
                evidence=["No historical data available. Using baseline default."],
                explanation="Default baseline forecast due to zero sales history."
            )

        avg_sales = sum(historical_sales) / len(historical_sales)
        forecast = round(avg_sales * 1.15, 2)  # 15% growth factor
        return AdvisoryRecommendation(
            recommendation=forecast,
            confidence=0.88,
            evidence=[f"Average historical sales: {avg_sales}", "15% seasonal trend buffer applied"],
            explanation=f"Forecasted demand of {forecast} units based on historical sales velocity."
        )

    async def recommend_pricing(self, item_id: str, current_price: float, cost: float, stock_qty: int) -> AdvisoryRecommendation:
        margin = current_price - cost
        if stock_qty > 100:
            suggested_price = round(current_price * 0.90, 2)  # 10% clearance markdown
            return AdvisoryRecommendation(
                recommendation=suggested_price,
                confidence=0.92,
                evidence=[f"High inventory level ({stock_qty} units)", f"Margin buffer: {margin}"],
                explanation=f"Recommend clearance markdown to {suggested_price} to accelerate inventory turnover."
            )
        else:
            return AdvisoryRecommendation(
                recommendation=current_price,
                confidence=0.95,
                evidence=[f"Optimal inventory level ({stock_qty} units)"],
                explanation="Maintain current pricing."
            )
