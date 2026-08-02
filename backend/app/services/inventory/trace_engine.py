from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import TenantContext
from ...repositories.inventory import StockMovementRepository


class InventoryTraceService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.repo = StockMovementRepository(db, tenant_ctx)

    async def get_product_trace(self, product_id: str, limit: int = 100) -> list[dict[str, Any]]:
        movements = await self.repo.get_by_product(product_id, limit=limit)
        return [self._serialize(m) for m in movements]

    async def get_reference_trace(self, reference_doc_id: str, limit: int = 100) -> list[dict[str, Any]]:
        movements = await self.repo.get_by_reference(reference_doc_id, limit=limit)
        return [self._serialize(m) for m in movements]

    async def get_sku_trace(self, sku: str, limit: int = 100) -> list[dict[str, Any]]:
        movements = await self.repo.get_by_sku(sku, limit=limit)
        return [self._serialize(m) for m in movements]

    @staticmethod
    def _serialize(movement: Any) -> dict[str, Any]:
        return {
            "id": movement.id,
            "product_id": movement.product_id,
            "product_name": movement.product_name,
            "sku": movement.sku,
            "quantity": float(movement.quantity) if getattr(movement, "quantity", None) is not None else None,
            "movement_type": movement.movement_type,
            "reference_doc_type": movement.reference_doc_type,
            "reference_doc_id": movement.reference_doc_id,
            "warehouse": movement.warehouse,
            "batch": movement.batch,
            "serial": movement.serial,
            "remarks": movement.remarks,
            "source_module": movement.source_module,
            "approval": movement.approval,
        }
