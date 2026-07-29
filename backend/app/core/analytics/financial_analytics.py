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
Classification: Executive Financial Dashboard Aggregator
"""

from typing import Dict, Any


class FinancialAnalyticsEngine:
    """Executive Financial Summary Aggregator."""

    @staticmethod
    def get_financial_summary(revenue: float = 1250000.00, cogs: float = 750000.00, opex: float = 200000.00) -> Dict[str, Any]:
        gross_profit = revenue - cogs
        gross_margin_pct = round((gross_profit / revenue) * 100.0, 2) if revenue > 0 else 0.0
        ebitda = gross_profit - opex
        net_margin_pct = round((ebitda / revenue) * 100.0, 2) if revenue > 0 else 0.0

        return {
            "total_revenue": revenue,
            "cost_of_goods_sold": cogs,
            "gross_profit": gross_profit,
            "gross_margin_percentage": gross_margin_pct,
            "operating_expenses": opex,
            "ebitda": ebitda,
            "net_margin_percentage": net_margin_pct
        }
