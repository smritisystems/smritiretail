"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.0.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
SMRITI Indian Statutory Accounting Core Layer - Fixed Asset Management & Depreciation Engine
Conforms to Income Tax Act 1961 (Section 32 Block of Assets) & Companies Act 2013 (Schedule II).

Calculates depreciation using:
1. Straight Line Method (SLM): Depreciation = (Cost - Salvage Value) / Useful Life
2. Written Down Value (WDV): Depreciation = Book Value * WDV Rate %
"""

import datetime
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional


class DepreciationMethod(str, Enum):
    SLM = "SLM"  # Straight Line Method
    WDV = "WDV"  # Written Down Value


class AssetCategory(str, Enum):
    PLANT_MACHINERY = "PLANT_MACHINERY"       # WDV 15%
    BUILDINGS = "BUILDINGS"                   # WDV 10%
    COMPUTERS_SOFTWARE = "COMPUTERS_SOFTWARE" # WDV 40%
    FURNITURE_FIXTURES = "FURNITURE_FIXTURES" # WDV 10%
    VEHICLES = "VEHICLES"                     # WDV 15%


# Income Tax Act Block of Asset Default Rates
DEFAULT_WDV_RATES: Dict[AssetCategory, float] = {
    AssetCategory.PLANT_MACHINERY: 15.0,
    AssetCategory.BUILDINGS: 10.0,
    AssetCategory.COMPUTERS_SOFTWARE: 40.0,
    AssetCategory.FURNITURE_FIXTURES: 10.0,
    AssetCategory.VEHICLES: 15.0,
}


@dataclass
class FixedAssetRecord:
    asset_id: str
    asset_name: str
    category: AssetCategory
    purchase_cost: float
    salvage_value: float = 0.0
    useful_life_years: int = 5
    wdv_rate_percent: Optional[float] = None
    purchase_date: str = "2026-04-01"

    def get_wdv_rate(self) -> float:
        if self.wdv_rate_percent is not None:
            return self.wdv_rate_percent
        return DEFAULT_WDV_RATES.get(self.category, 15.0)


@dataclass
class DepreciationPeriodResult:
    asset_id: str
    period_year: int
    opening_book_value: float
    depreciation_amount: float
    closing_book_value: float
    method_used: DepreciationMethod


class FixedAssetDepreciationEngine:
    """
    Canonical Depreciation Calculation & Asset Register Engine.
    """

    @staticmethod
    def calculate_period_depreciation(
        asset: FixedAssetRecord,
        current_book_value: float,
        method: DepreciationMethod = DepreciationMethod.WDV,
        months: int = 12,
    ) -> DepreciationPeriodResult:
        if current_book_value <= asset.salvage_value:
            return DepreciationPeriodResult(
                asset_id=asset.asset_id,
                period_year=1,
                opening_book_value=current_book_value,
                depreciation_amount=0.0,
                closing_book_value=current_book_value,
                method_used=method,
            )

        pro_rata_factor = months / 12.0

        if method == DepreciationMethod.SLM:
            depreciable_base = asset.purchase_cost - asset.salvage_value
            annual_dep = depreciable_base / max(1, asset.useful_life_years)
            dep_amount = round(annual_dep * pro_rata_factor, 2)
        else:  # WDV
            rate = asset.get_wdv_rate() / 100.0
            annual_dep = current_book_value * rate
            dep_amount = round(annual_dep * pro_rata_factor, 2)

        # Cannot depreciate below salvage value
        max_allowable = round(current_book_value - asset.salvage_value, 2)
        dep_amount = min(dep_amount, max_allowable)

        closing_val = round(current_book_value - dep_amount, 2)

        return DepreciationPeriodResult(
            asset_id=asset.asset_id,
            period_year=1,
            opening_book_value=round(current_book_value, 2),
            depreciation_amount=dep_amount,
            closing_book_value=closing_val,
            method_used=method,
        )

    @staticmethod
    def generate_multi_year_schedule(
        asset: FixedAssetRecord,
        years: int = 5,
        method: DepreciationMethod = DepreciationMethod.WDV,
    ) -> List[DepreciationPeriodResult]:
        schedule: List[DepreciationPeriodResult] = []
        book_val = asset.purchase_cost

        for y in range(1, years + 1):
            if book_val <= asset.salvage_value:
                break

            res = FixedAssetDepreciationEngine.calculate_period_depreciation(
                asset=asset, current_book_value=book_val, method=method, months=12
            )
            res.period_year = y
            schedule.append(res)
            book_val = res.closing_book_value

        return schedule
