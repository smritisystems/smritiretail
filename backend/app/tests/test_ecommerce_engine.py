"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 19.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pytest Suite for Domain Release Phase 25 E-Commerce Engine

test_ecommerce_engine.py — Integration test suite for E-Commerce Engine (v19.0.0).
"""

import pytest

from app.core.ecommerce.channel_sync import ChannelSyncEngine
from app.core.ecommerce.fulfillment_engine import FulfillmentRouter
from app.core.ecommerce.stock_allocator import StockAllocator


@pytest.mark.asyncio
async def test_channel_sync_engine_registration():
    """Verify ChannelSyncEngine registers e-commerce store connectors."""
    ch = ChannelSyncEngine.register_channel("SHOPIFY", "https://smriti-demo.myshopify.com")
    assert ch.channel_name == "SHOPIFY"
    assert ch.sync_status == "CONNECTED"

    channels = ChannelSyncEngine.list_channels()
    assert len(channels) >= 1
    assert any(c["channel_name"] == "SHOPIFY" for c in channels)


@pytest.mark.asyncio
async def test_fulfillment_router_ship_from_store_and_warehouse():
    """Verify FulfillmentRouter routes omnichannel orders."""
    items = [{"item_id": "SKU-FOOTWEAR-01", "qty": 1}]
    res_wh = FulfillmentRouter.route_order_fulfillment("ORD-SHPFY-1001", "SHOPIFY", items, preferred_source="WAREHOUSE")
    assert res_wh["fulfillment_source"] == "WAREHOUSE"
    assert res_wh["status"] == "ROUTED"

    res_store = FulfillmentRouter.route_order_fulfillment("ORD-AMZ-9901", "AMAZON", items, preferred_source="STORE_LOCATION")
    assert res_store["fulfillment_source"] == "STORE_LOCATION"


@pytest.mark.asyncio
async def test_stock_allocator_safety_buffer():
    """Verify StockAllocator safety buffer prevents online overselling."""
    # Physical stock = 20, Safety buffer = 5 -> Allocatable = 15
    res_valid = StockAllocator.allocate_online_stock(total_physical_stock=20, requested_qty=10)
    assert res_valid["allocatable_online_stock"] == 15
    assert res_valid["can_allocate"] is True
    assert res_valid["allocated_qty"] == 10

    # Requesting 18 when allocatable is 15 -> Rejection
    res_exceeded = StockAllocator.allocate_online_stock(total_physical_stock=20, requested_qty=18)
    assert res_exceeded["can_allocate"] is False
    assert res_exceeded["allocated_qty"] == 15
