"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.9.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

from decimal import Decimal
from typing import Dict, Any, List


EVALUATION_WEIGHT_PROFILES: Dict[str, Dict[str, float]] = {
    "RETAIL_DEFAULT": {"price_weight": 0.50, "lead_time_weight": 0.25, "rating_weight": 0.25},
    "IMPORT_STANDARD": {"price_weight": 0.40, "lead_time_weight": 0.30, "rating_weight": 0.30},
    "MANUFACTURING_HEAVY": {"price_weight": 0.35, "lead_time_weight": 0.35, "rating_weight": 0.30},
    "EMERGENCY_PURCHASE": {"price_weight": 0.20, "lead_time_weight": 0.60, "rating_weight": 0.20},
}


class EvaluationEngine:
    """
    Data-Driven Multi-Factor Quotation Evaluation Engine.
    Computes scores using configurable weight profiles (Price %, Lead Time %, Rating %).
    """

    @staticmethod
    def evaluate_quotes(quotes_data: List[Dict[str, Any]], profile_name: str = "RETAIL_DEFAULT") -> List[Dict[str, Any]]:
        weights = EVALUATION_WEIGHT_PROFILES.get(profile_name, EVALUATION_WEIGHT_PROFILES["RETAIL_DEFAULT"])
        w_price = weights["price_weight"]
        w_lead = weights["lead_time_weight"]
        w_rating = weights["rating_weight"]

        if not quotes_data:
            return []

        min_price = min([q["total_value"] for q in quotes_data]) or 1.0
        min_lead = min([q["lead_time_days"] for q in quotes_data]) or 1.0

        for q in quotes_data:
            # Price Score: Inverse relative to lowest price
            price_score = (min_price / q["total_value"]) * 100.0 if q["total_value"] > 0 else 0.0
            
            # Lead Time Score: Inverse relative to shortest lead time
            lead_score = (min_lead / q["lead_time_days"]) * 100.0 if q["lead_time_days"] > 0 else 0.0
            
            # Vendor Rating Score (Default 80 if unrated)
            rating_score = float(q.get("vendor_rating", 80.0))

            total_score = (w_price * price_score) + (w_lead * lead_score) + (w_rating * rating_score)
            q["score"] = round(total_score, 2)

        return quotes_data
