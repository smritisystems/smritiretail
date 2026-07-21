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
Classification: Pytest Suite for Phase 22 AI Advisory Engine

test_ai_advisory_engine.py — Integration test suite for Layer 6 AI Advisory Engine.
"""

import pytest

from app.ai.demand_forecast import DemandForecaster
from app.ai.pricing_advisor import PricingAdvisor
from app.ai.replenishment_advisor import ReplenishmentAdvisor
from app.ai.ocr_parser import OCRDocumentParser
from app.ai.providers.local_statistical_provider import LocalStatisticalProvider


@pytest.mark.asyncio
async def test_demand_forecast_advisory():
    """Verify DemandForecaster returns structured AdvisoryRecommendation DTO (SMP-013)."""
    res = await DemandForecaster.get_forecast("SKU-101", [100.0, 110.0, 105.0, 120.0])
    assert res["recommendation"] == 125.06
    assert res["confidence"] == 0.88
    assert len(res["evidence"]) == 2
    assert "Forecasted demand" in res["explanation"]


@pytest.mark.asyncio
async def test_pricing_advisor_markdown():
    """Verify PricingAdvisor returns markdown clearance pricing recommendation."""
    res = await PricingAdvisor.get_pricing_recommendation("SKU-102", 100.0, 60.0, stock_qty=150)
    assert res["recommendation"] == 90.0
    assert res["confidence"] == 0.92
    assert "Recommend clearance markdown" in res["explanation"]


@pytest.mark.asyncio
async def test_replenishment_advisor():
    """Verify ReplenishmentAdvisor returns reorder point recommendations."""
    res = await ReplenishmentAdvisor.recommend_reorder("SKU-103", current_stock=5, min_reorder_point=20, lead_time_days=3)
    rec = res["recommendation"]
    assert rec["should_reorder"] is True
    assert rec["suggested_reorder_qty"] == 35
    assert res["confidence"] == 0.96


@pytest.mark.asyncio
async def test_ocr_document_parser():
    """Verify OCRDocumentParser extracts structured invoice header and line items."""
    sample_text = "INVOICE # INV-OCR-2026-001\nSKU-FOOTWEAR-01 Qty: 2 Unit Price: 725.00"
    res = await OCRDocumentParser.parse_invoice_text(sample_text)
    data = res["recommendation"]
    assert data["invoice_number"] == "INV-OCR-2026-001"
    assert data["total_amount"] == 1450.00
    assert len(data["line_items"]) == 1


@pytest.mark.asyncio
async def test_aop_001_fallback_behavior():
    """Verify AOP-001 AI Optionality Principle fallback behavior for empty history."""
    provider = LocalStatisticalProvider()
    res = await provider.predict_demand("SKU-NEW", [])
    assert res.recommendation == 10.0
    assert res.confidence == 0.5
    assert "zero sales history" in res.explanation
