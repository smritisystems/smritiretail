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
Classification: Abstract AI Provider Interface
"""

import time
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional


class AdvisoryRecommendation:
    """Structured Advisory Recommendation DTO (SMP-013 Compliant)."""

    def __init__(
        self,
        recommendation: Any,
        confidence: float,
        evidence: List[str],
        explanation: str,
        alternatives: Optional[List[Any]] = None,
        model_version: str = "v1.0-statistical"
    ):
        self.recommendation = recommendation
        self.confidence = min(max(confidence, 0.0), 1.0)
        self.evidence = evidence
        self.explanation = explanation
        self.alternatives = alternatives or []
        self.model_version = model_version
        self.timestamp = time.time()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "recommendation": self.recommendation,
            "confidence": self.confidence,
            "evidence": self.evidence,
            "explanation": self.explanation,
            "alternatives": self.alternatives,
            "model_version": self.model_version,
            "timestamp": self.timestamp
        }


class BaseAIProvider(ABC):
    """Abstract Base AI Advisory Provider."""

    def __init__(self, provider_id: str, name: str):
        self.provider_id = provider_id
        self.name = name

    @abstractmethod
    async def predict_demand(self, item_id: str, historical_sales: List[float]) -> AdvisoryRecommendation:
        pass

    @abstractmethod
    async def recommend_pricing(self, item_id: str, current_price: float, cost: float, stock_qty: int) -> AdvisoryRecommendation:
        pass
