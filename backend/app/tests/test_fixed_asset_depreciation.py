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

import pytest
from app.core.fixed_asset_depreciation import (
    FixedAssetDepreciationEngine,
    FixedAssetRecord,
    AssetCategory,
    DepreciationMethod,
)

def test_slm_depreciation():
    # Asset cost ₹100,000, salvage value ₹10,000, useful life 5 years -> Annual Dep = (100k-10k)/5 = ₹18,000
    asset = FixedAssetRecord(
        asset_id="AST-01",
        asset_name="Office Server",
        category=AssetCategory.COMPUTERS_SOFTWARE,
        purchase_cost=100000.0,
        salvage_value=10000.0,
        useful_life_years=5,
    )

    res = FixedAssetDepreciationEngine.calculate_period_depreciation(
        asset, current_book_value=100000.0, method=DepreciationMethod.SLM, months=12
    )
    assert res.depreciation_amount == 18000.0
    assert res.closing_book_value == 82000.0

def test_wdv_depreciation_schedule():
    # Asset cost ₹100,000, Computers WDV rate 40%
    # Year 1: 40% of 100k = 40,000 (Closing 60,000)
    # Year 2: 40% of 60k = 24,000 (Closing 36,000)
    asset = FixedAssetRecord(
        asset_id="AST-02",
        asset_name="Laptops",
        category=AssetCategory.COMPUTERS_SOFTWARE,
        purchase_cost=100000.0,
        salvage_value=1000.0,
    )

    schedule = FixedAssetDepreciationEngine.generate_multi_year_schedule(
        asset, years=2, method=DepreciationMethod.WDV
    )

    assert len(schedule) == 2
    assert schedule[0].depreciation_amount == 40000.0
    assert schedule[0].closing_book_value == 60000.0

    assert schedule[1].depreciation_amount == 24000.0
    assert schedule[1].closing_book_value == 36000.0
