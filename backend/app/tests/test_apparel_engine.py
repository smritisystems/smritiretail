"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 25.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pytest Suite for Domain Release Phase 31 Apparel Engine

test_apparel_engine.py — Integration test suite for Apparel & Fashion Matrix Engine (v25.0.0).
"""

import pytest

from app.core.apparel.matrix_grid import ApparelMatrixGridEngine
from app.core.apparel.markdown_engine import SeasonalMarkdownEngine
from app.core.apparel.hangtag_generator import HangtagGeneratorEngine


@pytest.mark.asyncio
async def test_variant_grid_generation():
    """Verify ApparelMatrixGridEngine builds Color x Size variant grid."""
    res = ApparelMatrixGridEngine.generate_variant_grid(
        style_code="TSHIRT-SLIM",
        colors=["BLACK", "NAVY", "WHITE"],
        sizes=["S", "M", "L", "XL"],
        base_mrp=999.0,
        stock_per_variant=15
    )
    assert res["style_code"] == "TSHIRT-SLIM"
    assert res["colors_count"] == 3
    assert res["sizes_count"] == 4
    assert res["total_variants_generated"] == 12
    assert res["variants"][0]["mrp"] == 999.0


@pytest.mark.asyncio
async def test_seasonal_markdown_calculation():
    """Verify SeasonalMarkdownEngine calculates age-based discount tiers."""
    # Age 150 days -> 50% discount
    res_150 = SeasonalMarkdownEngine.calculate_markdown(1000.0, 150)
    assert res_150["applied_discount_percentage"] == 50.0
    assert res_150["effective_selling_price"] == 500.0

    # Age 70 days -> 20% discount
    res_70 = SeasonalMarkdownEngine.calculate_markdown(1000.0, 70)
    assert res_70["applied_discount_percentage"] == 20.0
    assert res_70["effective_selling_price"] == 800.0


@pytest.mark.asyncio
async def test_hangtag_zpl_renderer():
    """Verify HangtagGeneratorEngine produces ZPL thermal printing string."""
    res = HangtagGeneratorEngine.render_hangtag("DENIM-001", "BLUE", "32", 1999.0, "8901234567890")
    assert res["style_code"] == "DENIM-001"
    assert "^XA" in res["thermal_zpl_payload"]
    assert "MRP: Rs.1999.00" in res["thermal_zpl_payload"]
