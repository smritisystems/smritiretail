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
Classification: Retail Performance KPI Calculation Engine
"""

from typing import Dict, Any


class RetailKPIEngine:
    """Retail Performance KPI Calculator (GMROI, Inventory Turnover, Sell-Through)."""

    @staticmethod
    def calculate_kpis(gross_margin: float, avg_inventory_cost: float, annual_cogs: float, store_sq_ft: float, total_units_received: int, total_units_sold: int) -> Dict[str, Any]:
        # GMROI = Gross Margin / Average Inventory Cost
        gmroi = round(gross_margin / avg_inventory_cost, 2) if avg_inventory_cost > 0 else 0.0

        # Inventory Turnover = Annual COGS / Average Inventory Cost
        inventory_turnover = round(annual_cogs / avg_inventory_cost, 2) if avg_inventory_cost > 0 else 0.0

        # Sales per Sq Ft = (COGS / store_sq_ft)
        sales_per_sq_ft = round((annual_cogs * 1.5) / store_sq_ft, 2) if store_sq_ft > 0 else 0.0

        # Sell Through = (Sold Units / Received Units) * 100
        sell_through_pct = round((total_units_sold / total_units_received) * 100.0, 2) if total_units_received > 0 else 0.0

        return {
            "gmroi": gmroi,
            "inventory_turnover_ratio": inventory_turnover,
            "sales_per_sq_ft": sales_per_sq_ft,
            "sell_through_percentage": sell_through_pct
        }
