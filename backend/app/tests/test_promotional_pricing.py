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
from app.core.promotional_pricing import (
    PromotionalPricingEngine,
    CartItem,
    PromotionRule,
    PromotionType,
    VolumeSlab,
)

def test_tiered_volume_discount():
    cart = [CartItem(sku="SKU-SHIRT", item_name="Shirt", quantity=10.0, regular_unit_price=500.0)]

    slabs = [
        VolumeSlab(min_qty=1, max_qty=5, unit_price=500.0),
        VolumeSlab(min_qty=6, max_qty=15, unit_price=450.0),
    ]
    promo = PromotionRule("P-01", "Bulk Shirt Discount", PromotionType.TIERED_QUANTITY, sku="SKU-SHIRT", slabs=slabs)

    summary = PromotionalPricingEngine.evaluate_cart(cart, [promo])
    assert summary.subtotal == 5000.0
    assert summary.total_discount == 500.0  # (500-450)*10 = 500
    assert summary.final_payable == 4500.0

def test_buy_x_get_y_free():
    cart = [CartItem(sku="SKU-SOCK", item_name="Cotton Socks", quantity=5.0, regular_unit_price=100.0)]

    # Buy 2 Get 1 Free -> for 5 items, 2 sets of 2 -> 2 free items
    promo = PromotionRule("P-02", "Buy 2 Get 1 Free", PromotionType.BUY_X_GET_Y, sku="SKU-SOCK", buy_qty=2, get_free_qty=1)

    summary = PromotionalPricingEngine.evaluate_cart(cart, [promo])
    assert summary.subtotal == 500.0
    assert summary.total_free_items_qty == 2.0
    assert summary.total_discount == 200.0  # 2 free socks @ ₹100
    assert summary.final_payable == 300.0

def test_promo_code_application():
    cart = [CartItem(sku="SKU-PANT", item_name="Jeans", quantity=2.0, regular_unit_price=1000.0)]
    promo = PromotionRule("P-03", "Festive Offer 10%", PromotionType.PROMO_CODE, promo_code="FESTIVE10", discount_percent=10.0)

    summary = PromotionalPricingEngine.evaluate_cart(cart, [promo], promo_code="FESTIVE10")
    assert summary.subtotal == 2000.0
    assert summary.total_discount == 200.0
    assert summary.applied_promo_code == "FESTIVE10"
    assert summary.final_payable == 1800.0
