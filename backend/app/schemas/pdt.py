"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, Field


class PDTModelRegisterReq(BaseModel):
    model_code: str
    model_name: str
    model_type: str = "DEMAND_FORECAST"
    algorithm: str = "HOLT_WINTERS_EXPONENTIAL"
    version: str = "1.0.0"
    hyperparameters: Dict[str, Any] = Field(default_factory=dict)


class PDTDemandSignalReq(BaseModel):
    signal_code: str
    signal_type: str
    impact_factor: Decimal = Decimal("1.00")
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    affected_categories: List[str] = Field(default_factory=list)


class PDTSkuTwinUpdateReq(BaseModel):
    sku: str
    lead_time_days: int = 7
    safety_buffer_qty: Decimal = Decimal("10.0000")
    daily_velocity: Decimal = Decimal("0.0000")


class PDTPredictionGenerateReq(BaseModel):
    sku: str
    model_code: str
    forecast_horizon_days: int = 30
    current_on_hand: Decimal
    historical_sales_velocity: Decimal


class PDTPredictionResponse(BaseModel):
    prediction_no: str
    sku: str
    model_code: str
    model_version: str
    forecast_horizon_days: int
    forecasted_demand: Decimal
    recommended_replenishment: Decimal
    confidence_score: Decimal
    risk_level: str
    explainability_factors: Dict[str, Any]
    generated_at: datetime
    read_only_notice: str = "PDT predictions are strictly advisory intelligence artifacts and cannot mutate transactional ledgers or physical stock."
