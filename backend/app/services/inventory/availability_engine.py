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

from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import TenantContext
from .state_engine import InventoryStateService


class InventoryAvailabilityService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.state_engine = InventoryStateService(db, tenant_ctx)

    @staticmethod
    def _to_decimal(value: Any) -> Decimal:
        try:
            return Decimal(str(value or 0))
        except Exception:
            return Decimal("0")

    async def can_fulfill(
        self,
        product_id: str,
        warehouse_id: str | None = None,
        qty: float | int | Decimal | None = None,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if qty is None:
            raise HTTPException(status_code=400, detail="Quantity is required")

        state = await self.state_engine.get_product_state(product_id)
        requested = self._to_decimal(qty)
        available = self._to_decimal(state.get("available", 0))
        can_fulfill = available >= requested

        return {
            "product_id": product_id,
            "warehouse_id": warehouse_id,
            "requested_qty": float(requested),
            "on_hand": float(state.get("on_hand", 0)),
            "reserved_qty": float(state.get("reserved", 0)),
            "available_qty": float(available),
            "can_fulfill": can_fulfill,
            "reason": None if can_fulfill else "Insufficient available stock",
            "context": context or {},
        }
