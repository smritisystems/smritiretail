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
Classification: Pydantic DTO Schemas for Financial Analytics & BI
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict


class FinancialSummaryResponse(BaseModel):
    total_revenue: float
    gross_profit: float
    gross_margin_percentage: float
    ebitda: float
    net_margin_percentage: float


class RetailKPIMetricsResponse(BaseModel):
    gmroi: float
    inventory_turnover_ratio: float
    sales_per_sq_ft: float
    sell_through_percentage: float


class TrendVarianceResponse(BaseModel):
    period: str
    budget_revenue: float
    actual_revenue: float
    variance_amount: float
    variance_percentage: float
    status: str
