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
Classification: Layer 6 AI Advisory REST API Gateway
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Body

from app.ai.demand_forecast import DemandForecaster
from app.ai.pricing_advisor import PricingAdvisor
from app.ai.replenishment_advisor import ReplenishmentAdvisor
from app.ai.ocr_parser import OCRDocumentParser

router = APIRouter(prefix="/ai/advisory", tags=["Layer 6 AI & Intelligent Automation"])


@router.post("/demand-forecast")
async def get_demand_forecast_advisory(item_id: str = Body(..., embed=True), historical_sales: List[float] = Body(..., embed=True)):
    """Provides demand forecasting advisories conforming to SMP-013 and AOP-001."""
    return await DemandForecaster.get_forecast(item_id, historical_sales)


@router.post("/pricing")
async def get_pricing_advisory(item_id: str = Body(...), current_price: float = Body(...), cost: float = Body(...), stock_qty: int = Body(...)):
    """Provides markdown & clearance pricing advisories."""
    return await PricingAdvisor.get_pricing_recommendation(item_id, current_price, cost, stock_qty)


@router.post("/replenishment")
async def get_replenishment_advisory(item_id: str = Body(...), current_stock: int = Body(...), min_reorder_point: int = Body(...), lead_time_days: int = Body(..., embed=True)):
    """Provides inventory replenishment and reorder point advisories."""
    return await ReplenishmentAdvisor.recommend_reorder(item_id, current_stock, min_reorder_point, lead_time_days)


@router.post("/ocr-parse")
async def parse_document_ocr(raw_text: str = Body(..., embed=True)):
    """Parses raw receipt/invoice document text into structured DTOs."""
    return await OCRDocumentParser.parse_invoice_text(raw_text)
