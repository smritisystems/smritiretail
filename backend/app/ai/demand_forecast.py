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
Classification: Demand Forecasting Engine
"""

from typing import List, Dict, Any
from app.ai.providers.local_statistical_provider import LocalStatisticalProvider, AdvisoryRecommendation

provider = LocalStatisticalProvider()


class DemandForecaster:
    """Demand Forecasting Engine."""

    @staticmethod
    async def get_forecast(item_id: str, historical_sales: List[float]) -> Dict[str, Any]:
        rec: AdvisoryRecommendation = await provider.predict_demand(item_id, historical_sales)
        return rec.to_dict()
