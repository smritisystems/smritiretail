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

from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Integer, Numeric, String, Boolean, Index
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from ..db.base import BaseEntity


class PDTModelRegistry(BaseEntity):
    """
    PDTModelRegistry — Metadata and parameter registry for predictive intelligence models.
    """
    __tablename__ = "pdt_model_registry"

    model_code = Column(String(50), nullable=False, unique=True, index=True)
    model_name = Column(String(255), nullable=False)
    model_type = Column(String(50), nullable=False)  # DEMAND_FORECAST, REORDER_OPTIMIZATION, STOCKOUT_RISK
    algorithm = Column(String(100), nullable=False)   # HOLT_WINTERS_EXPONENTIAL, ARIMA_SEASONAL, BAYESIAN_VELOCITY
    version = Column(String(20), nullable=False, default="1.0.0")
    hyperparameters = Column(JSONB, server_default="{}", default=dict)
    trained_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class PDTSkuTwinCache(BaseEntity):
    """
    PDTSkuTwinCache — Digital Twin real-time velocity and safety buffer cache for SKUs.
    """
    __tablename__ = "pdt_sku_twin_cache"

    sku = Column(String(100), nullable=False, index=True)
    lead_time_days = Column(Integer, default=7)
    safety_buffer_qty = Column(Numeric(12, 4), default=10.0000)
    daily_velocity = Column(Numeric(12, 4), default=0.0000)
    current_days_of_cover = Column(Numeric(8, 2), default=0.00)
    recommended_safety_stock = Column(Numeric(12, 4), default=0.0000)
    last_evaluated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class PDTDemandSignal(BaseEntity):
    """
    PDTDemandSignal — External and internal market signals impacting demand velocity.
    """
    __tablename__ = "pdt_demand_signals"

    signal_code = Column(String(50), nullable=False, index=True)
    signal_type = Column(String(50), nullable=False)  # SEASONAL_FESTIVAL, PROMOTIONAL_SPIKE, WEATHER_IMPACT, REGIONAL_HOLIDAY
    impact_factor = Column(Numeric(5, 2), nullable=False, default=1.00)
    start_date = Column(DateTime(timezone=True))
    end_date = Column(DateTime(timezone=True))
    affected_categories = Column(ARRAY(String), server_default="{}")


class PDTDistributionPrediction(BaseEntity):
    """
    PDTDistributionPrediction — Read-only predictive replenishment and transfer forecasts.
    Strictly isolated from transactional accounting and physical inventory mutations.
    """
    __tablename__ = "pdt_distribution_predictions"

    prediction_no = Column(String(50), nullable=False, unique=True, index=True)
    sku = Column(String(100), nullable=False, index=True)
    model_code = Column(String(50), nullable=False)
    model_version = Column(String(20), nullable=False)
    forecast_horizon_days = Column(Integer, default=30)
    forecasted_demand = Column(Numeric(12, 4), nullable=False, default=0.0000)
    recommended_replenishment = Column(Numeric(12, 4), nullable=False, default=0.0000)
    confidence_score = Column(Numeric(5, 4), nullable=False, default=0.9500)
    risk_level = Column(String(30), default="LOW")  # LOW, MODERATE, HIGH_STOCKOUT_RISK
    explainability_factors = Column(JSONB, server_default="{}", default=dict)
    generated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
