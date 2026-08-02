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

InventoryTimelineService — chronological movement timeline derived from the canonical
stock ledger. It does not create new tables or parallel state; it interprets the
existing StockMovement stream for operational visibility.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import TenantContext
from ..models.inventory import StockMovement
from ..repositories.inventory import StockMovementRepository


class InventoryTimelineService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.stock_movement_repo = StockMovementRepository(db, tenant_ctx)

    @staticmethod
    def _event_label(movement: StockMovement) -> str:
        movement_type = (movement.movement_type or "UNKNOWN").upper()
        if movement_type == "IN":
            return "Stock receipt"
        if movement_type == "OUT":
            return "Stock issue"
        if movement_type == "TRANSFER":
            return "Stock transfer"
        if movement_type == "ADJUSTMENT":
            return "Stock adjustment"
        return movement_type.replace("_", " ").title()

    def _serialize_item(self, movement: StockMovement) -> dict[str, Any]:
        created_at = movement.created_at
        return {
            "id": movement.id,
            "product_id": movement.product_id,
            "product_name": movement.product_name,
            "sku": movement.sku,
            "movement_type": movement.movement_type,
            "event_label": self._event_label(movement),
            "reference_doc_type": movement.reference_doc_type,
            "reference_doc_id": movement.reference_doc_id,
            "warehouse": movement.warehouse,
            "bin": movement.bin,
            "batch": movement.batch,
            "serial": movement.serial,
            "quantity": float(movement.quantity) if movement.quantity is not None else None,
            "unit_cost": float(movement.unit_cost) if movement.unit_cost is not None else None,
            "source_module": movement.source_module,
            "approval": movement.approval,
            "remarks": movement.remarks,
            "date": created_at.date().isoformat() if isinstance(created_at, datetime) else None,
            "created_at": created_at.isoformat() if isinstance(created_at, datetime) else None,
        }

    async def get_product_timeline(self, product_id: str, limit: int = 100) -> list[dict[str, Any]]:
        movements = await self.stock_movement_repo.get_by_product(product_id, limit=limit)
        return [self._serialize_item(m) for m in movements]

    async def get_sku_timeline(self, sku: str, limit: int = 100) -> list[dict[str, Any]]:
        movements = await self.stock_movement_repo.get_by_sku(sku, limit=limit)
        return [self._serialize_item(m) for m in movements]
