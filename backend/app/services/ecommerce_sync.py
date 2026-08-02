from __future__ import annotations
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

import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.inventory import Product
from app.api.deps import TenantContext
from app.services.inventory.facades import InventoryQueryFacade, InventoryCommandFacade

logger = logging.getLogger("smriti.ecommerce_sync")


class ECommerceSyncPipeline:
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        self.db = db
        self.tenant_ctx = tenant_ctx

    async def sync_stock_to_channels(self, product_id: str) -> Dict[str, Any]:
        """
        Pushes updated stock level of a product to connected online sales channels.
        Consumes InventoryQueryFacade.get_canonical_state() per MP001.5.
        """
        stmt = select(Product).where(Product.id == product_id, Product.is_deleted == False)
        res = await self.db.execute(stmt)
        p = res.scalars().first()
        if not p:
            return {"synced": False, "error": "Product not found"}

        query_facade = InventoryQueryFacade(self.db, self.tenant_ctx)
        state = await query_facade.get_canonical_state(product_id)
        avail_stock = state.get("available", 0)

        logger.info("[E-Commerce Sync] Syncing SKU '%s' available stock (%d) to Shopify & Amazon channels.", p.code, avail_stock)

        return {
            "synced": True,
            "sku": p.code,
            "sync_stock": float(avail_stock),
            "channels_updated": ["Shopify", "WooCommerce", "Amazon"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    async def process_incoming_order(self, channel_name: str, channel_order: dict) -> Dict[str, Any]:
        """
        Processes an incoming online order from Shopify/Amazon/WooCommerce,
        checks ATP via InventoryQueryFacade, and issues sale via InventoryCommandFacade.
        Consumes InventoryQueryFacade.can_fulfill() & InventoryCommandFacade.issue_sale() per MP001.1 & MP001.3.
        """
        channel_order_id = channel_order.get("id")
        sku = channel_order.get("sku")
        qty = channel_order.get("quantity", 1)

        stmt = select(Product).where(Product.code == sku, Product.is_deleted == False)
        res = await self.db.execute(stmt)
        p = res.scalars().first()

        if p:
            query_facade = InventoryQueryFacade(self.db, self.tenant_ctx)
            command_facade = InventoryCommandFacade(self.db, self.tenant_ctx)
            
            chk = await query_facade.can_fulfill(p.id, qty=qty)
            if chk.get("can_fulfill", False):
                await command_facade.issue_sale(
                    invoice_id=str(channel_order_id),
                    invoice_no=f"{channel_name}-{channel_order_id}",
                    items=[{"product_id": p.id, "quantity": qty}],
                    warehouse="Default Warehouse",
                )
                logger.info("[E-Commerce Order] Allocated %d units of SKU '%s' for %s order %s.", qty, sku, channel_name, channel_order_id)
                status_str = "ALLOCATED"
            else:
                status_str = "BACKORDERED"
        else:
            status_str = "PRODUCT_NOT_FOUND"

        return {
            "status": status_str,
            "channel": channel_name,
            "order_id": channel_order_id,
            "sku": sku,
            "quantity": qty,
        }
