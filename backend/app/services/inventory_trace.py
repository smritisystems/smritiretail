"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-02
Modified     : 2026-08-02
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

InventoryTraceService — Canonical product and reference movement trace queries
"""

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import TenantContext
from ..repositories.inventory import ProductRepository, StockMovementRepository
from .inventory_timeline import InventoryTimelineService
from .inventory_universal_search import InventoryUniversalSearchService


class InventoryTraceService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.product_repo = ProductRepository(db, tenant_ctx)
        self.stock_movement_repo = StockMovementRepository(db, tenant_ctx)
        self.timeline_service = InventoryTimelineService(db, tenant_ctx)
        self.universal_search_service = InventoryUniversalSearchService(db, tenant_ctx)

    async def get_product_trace(self, product_id: str, limit: int = 100):
        product = await self.product_repo.get(product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        return await self.stock_movement_repo.get_by_product(product_id, limit=limit)

    async def get_reference_trace(self, reference_doc_id: str):
        return await self.stock_movement_repo.get_by_reference(reference_doc_id)

    async def get_sku_trace(self, sku: str, limit: int = 100):
        return await self.stock_movement_repo.get_by_sku(sku, limit=limit)

    async def get_product_timeline(self, product_id: str, limit: int = 100):
        return await self.timeline_service.get_product_timeline(product_id, limit=limit)

    async def get_sku_timeline(self, sku: str, limit: int = 100):
        return await self.timeline_service.get_sku_timeline(sku, limit=limit)

    async def search(self, q: str, limit: int = 50):
        return await self.universal_search_service.search(q, limit=limit)
