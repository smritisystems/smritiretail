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

"""
InventoryUniversalSearchService

Searches across the canonical stock ledger using the keywords that users commonly
know at the moment of inquiry: SKU, barcode, batch, serial, invoice, PO, GRN,
supplier, customer, or document reference.
"""


from typing import Any

from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ..api.deps import TenantContext
from ..models.inventory import StockMovement


class InventoryUniversalSearchService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx

    async def search(self, q: str, limit: int = 50) -> list[dict[str, Any]]:
        query = (q or "").strip()
        if not query:
            return []

        pattern = f"%{query}%"
        stmt = (
            select(StockMovement)
            .where(
                StockMovement.company_id == self.tenant_ctx.company_id,
                StockMovement.branch_id == self.tenant_ctx.branch_id,
                or_(
                    StockMovement.sku.ilike(pattern),
                    StockMovement.product_name.ilike(pattern),
                    StockMovement.reference_doc_id.ilike(pattern),
                    StockMovement.reference_doc_type.ilike(pattern),
                    StockMovement.warehouse.ilike(pattern),
                    StockMovement.batch.ilike(pattern),
                    StockMovement.serial.ilike(pattern),
                    StockMovement.remarks.ilike(pattern),
                    StockMovement.source_module.ilike(pattern),
                ),
            )
            .order_by(StockMovement.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        movements = list(result.scalars().all())

        return [
            {
                "id": movement.id,
                "product_id": movement.product_id,
                "product_name": movement.product_name,
                "sku": movement.sku,
                "movement_type": movement.movement_type,
                "reference_doc_type": movement.reference_doc_type,
                "reference_doc_id": movement.reference_doc_id,
                "warehouse": movement.warehouse,
                "batch": movement.batch,
                "serial": movement.serial,
                "remarks": movement.remarks,
                "quantity": float(movement.quantity) if movement.quantity is not None else None,
            }
            for movement in movements
        ]
