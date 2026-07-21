"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 20.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pytest Suite for Domain Release Phase 26 Financial Analytics Engine

test_analytics_engine.py — Integration test suite for Financial Analytics & BI Engine (v20.0.0).
"""

import pytest

from app.core.analytics.financial_analytics import FinancialAnalyticsEngine
from app.core.analytics.retail_kpi_engine import RetailKPIEngine
from app.core.analytics.trend_analyzer import TrendAnalyzer


@pytest.mark.asyncio
async def test_financial_analytics_summary_aggregation():
    """Verify FinancialAnalyticsEngine aggregates gross margin, EBITDA, and net margin."""
    res = FinancialAnalyticsEngine.get_financial_summary(revenue=1000000.0, cogs=600000.0, opex=150000.0)
    assert res["gross_profit"] == 400000.0
    assert res["gross_margin_percentage"] == 40.0
    assert res["ebitda"] == 250000.0
    assert res["net_margin_percentage"] == 25.0


@pytest.mark.asyncio
async def test_retail_kpi_gmroi_and_turnover_calculations():
    """Verify RetailKPIEngine computes GMROI, turnover ratio, and sell-through."""
    res = RetailKPIEngine.calculate_kpis(
        gross_margin=400000.0,
        avg_inventory_cost=200000.0,
        annual_cogs=600000.0,
        store_sq_ft=4000.0,
        total_units_received=10000,
        total_units_sold=8500
    )
    # GMROI = 400k / 200k = 2.0
    assert res["gmroi"] == 2.0
    # Turnover = 600k / 200k = 3.0
    assert res["inventory_turnover_ratio"] == 3.0
    # Sell through = 8500 / 10000 = 85.0%
    assert res["sell_through_percentage"] == 85.0


@pytest.mark.asyncio
async def test_trend_analyzer_variance_analysis():
    """Verify TrendAnalyzer computes budget vs actual revenue variances."""
    res = TrendAnalyzer.analyze_variance("Q1-2026", budget_amount=500000.0, actual_amount=550000.0)
    assert res["variance_amount"] == 50000.0
    assert res["variance_percentage"] == 10.0
    assert res["status"] == "FAVORABLE"
