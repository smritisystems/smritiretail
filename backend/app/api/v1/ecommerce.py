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
Classification: E-Commerce Multi-Channel Sync REST API Gateway
"""

from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Body

from app.core.ecommerce.channel_sync import ChannelSyncEngine
from app.core.ecommerce.fulfillment_engine import FulfillmentRouter
from app.core.ecommerce.stock_allocator import StockAllocator

router = APIRouter(prefix="/ecommerce", tags=["Domain Release: E-Commerce Sync & Omnichannel Engine (v19.0.0)"])


@router.post("/channels")
async def register_sales_channel(channel_name: str = Body(...), store_url: str = Body(...)):
    """Registers a new e-commerce sales channel connector."""
    ch = ChannelSyncEngine.register_channel(channel_name, store_url)
    return ch.to_dict()


@router.get("/channels")
async def list_sales_channels():
    """Lists registered sales channels."""
    return ChannelSyncEngine.list_channels()


@router.post("/orders/fulfill")
async def route_order_fulfillment(channel_order_id: str = Body(...), channel_name: str = Body(...), items: List[dict] = Body(...), preferred_source: str = Body("WAREHOUSE")):
    """Routes an online order for fulfillment."""
    return FulfillmentRouter.route_order_fulfillment(channel_order_id, channel_name, items, preferred_source)


@router.post("/stock/allocate")
async def allocate_online_stock(total_physical_stock: int = Body(...), requested_qty: int = Body(...)):
    """Reserves e-commerce online inventory with safety buffer protection."""
    return StockAllocator.allocate_online_stock(total_physical_stock, requested_qty)
