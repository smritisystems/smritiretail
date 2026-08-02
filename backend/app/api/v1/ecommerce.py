"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""

from typing import Dict, Any
from fastapi import APIRouter, Depends, Body, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_tenant, TenantContext
from app.services.ecommerce_sync import ECommerceSyncPipeline

router = APIRouter(prefix="/ecommerce", tags=["E-Commerce Multi-Channel Integration"])


@router.post("/sync-stock/{product_id}")
async def sync_product_stock_to_channels(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant),
):
    """Triggers real-time stock sync for a product to external channels."""
    pipeline = ECommerceSyncPipeline(db, tenant)
    res = await pipeline.sync_stock_to_channels(product_id)
    await db.commit()
    return res


@router.post("/process-order")
async def process_channel_order(
    channel_name: str = Body(...),
    channel_order: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant),
):
    """Processes an incoming channel order (Shopify, Amazon, WooCommerce)."""
    pipeline = ECommerceSyncPipeline(db, tenant)
    res = await pipeline.process_incoming_order(channel_name, channel_order)
    await db.commit()
    return res
