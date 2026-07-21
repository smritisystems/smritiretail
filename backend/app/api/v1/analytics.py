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
Classification: Financial Analytics & BI REST API Gateway
"""

from typing import Dict, Any
from fastapi import APIRouter, Body

from app.core.analytics.financial_analytics import FinancialAnalyticsEngine
from app.core.analytics.retail_kpi_engine import RetailKPIEngine
from app.core.analytics.trend_analyzer import TrendAnalyzer

router = APIRouter(prefix="/analytics", tags=["Domain Release: Financial Analytics & BI Engine (v20.0.0)"])


@router.get("/financial-summary")
async def get_financial_summary(revenue: float = 1250000.00, cogs: float = 750000.00, opex: float = 200000.00):
    """Returns executive financial summary (Gross Margin, EBITDA, Net Margin)."""
    return FinancialAnalyticsEngine.get_financial_summary(revenue, cogs, opex)


@router.get("/kpi")
async def get_retail_kpis(gross_margin: float = 500000.00, avg_inventory_cost: float = 250000.00, annual_cogs: float = 750000.00, store_sq_ft: float = 5000.00, total_units_received: int = 10000, total_units_sold: int = 8200):
    """Calculates retail performance KPIs (GMROI, Inventory Turnover, Sell-Through)."""
    return RetailKPIEngine.calculate_kpis(gross_margin, avg_inventory_cost, annual_cogs, store_sq_ft, total_units_received, total_units_sold)


@router.post("/variance")
async def analyze_budget_variance(period_name: str = Body(...), budget_amount: float = Body(...), actual_amount: float = Body(...)):
    """Analyzes budget vs actual revenue variances."""
    return TrendAnalyzer.analyze_variance(period_name, budget_amount, actual_amount)
