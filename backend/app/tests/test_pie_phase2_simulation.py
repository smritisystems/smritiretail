"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.45.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from app.services.identity_service import ProductIdentityService


@pytest.mark.asyncio
async def test_identity_rule_simulation_logic():
    """Verifies pre-import identity rule simulation and collision detection logic."""
    svc = ProductIdentityService()
    items = [
        {"name": "Polo T-Shirt", "category": "Apparel", "brand": "Nike"},
        {"name": "Running Shoes", "category": "Footwear", "brand": "Nike"},
        {"name": "Denim Jeans", "category": "Apparel", "brand": "Levis"},
    ]

    res = await svc.simulate_identity_rules(payload_items=items)
    assert res["total_items"] == 3
    assert res["unique_keys_generated"] == 3
    assert res["collisions_detected"] == 0
    assert res["conflict_rate_percent"] == 0.0
    assert len(res["samples"]) == 3


@pytest.mark.asyncio
async def test_matrix_variant_sku_and_barcode_generation(db_session):
    """Verifies matrix variant SKU and EAN-13 Mod-10 barcode generation for size/color dimensions."""
    svc = ProductIdentityService()
    variants = [
        {"color": "Blue", "size": "M"},
        {"color": "Blue", "size": "L"},
        {"color": "Red", "size": "M"},
    ]

    created = await svc.generate_variant_skus(
        db=db_session,
        parent_product_id="prod-apparel-001",
        parent_sku="SKU-APP-NIK-00001",
        variants=variants,
    )

    assert len(created) == 3
    assert created[0]["variant_sku"] == "SKU-APP-NIK-00001-BLUE-M"
    assert created[1]["variant_sku"] == "SKU-APP-NIK-00001-BLUE-L"
    assert created[2]["variant_sku"] == "SKU-APP-NIK-00001-RED-M"
    assert len(created[0]["barcode"]) == 13
    assert created[0]["barcode"].startswith("8901000")


@pytest.mark.asyncio
async def test_duplicate_confidence_scoring():
    """Verifies item attribute similarity confidence score calculation."""
    item_a = {"name": "Basmati Premium Rice 5kg", "category": "Grains"}
    item_b = {"name": "Basmati Premium Rice 5kg", "category": "Grains"}
    item_c = {"name": "Cotton Mens Shirt", "category": "Apparel"}

    res_exact = ProductIdentityService.calculate_duplicate_confidence(item_a, item_b)
    assert res_exact["confidence_score"] == 1.0
    assert res_exact["classification"] == "DUPLICATE_EXACT"

    res_unique = ProductIdentityService.calculate_duplicate_confidence(item_a, item_c)
    assert res_unique["confidence_score"] < 0.75
    assert res_unique["classification"] == "UNIQUE"
