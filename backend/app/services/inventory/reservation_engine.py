from __future__ import annotations

from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import TenantContext
from .state_engine import InventoryStateService


class InventoryReservationService:
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

    async def reserve(
        self,
        product_id: str,
        qty: float | int | Decimal,
        reservation_type: str,
        reservation_id: str,
    ) -> dict[str, Any]:
        requested = self._to_decimal(qty)
        if requested <= 0:
            raise HTTPException(status_code=400, detail="Reservation quantity must be greater than zero")

        product = await self.state_engine._get_product_for_update(product_id)
        state = await self.state_engine.get_product_state(product_id)
        available = self._to_decimal(state.get("available", 0))

        if requested > available:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient available stock for reservation. Requested: {requested}, Available: {available}",
            )

        current_reserved = self._to_decimal(getattr(product, "reserved_stock", 0))
        new_reserved = current_reserved + requested
        product.reserved_stock = new_reserved
        self.db.add(product)
        await self.db.commit()
        await self.db.refresh(product)

        updated_state = await self.state_engine.get_product_state(product_id)
        available_after = self._to_decimal(updated_state.get("available", 0))

        return {
            "product_id": product_id,
            "reservation_type": reservation_type,
            "reservation_id": reservation_id,
            "reserved_qty": float(new_reserved),
            "available_after": float(available_after),
            "on_hand": float(updated_state.get("on_hand", 0)),
            "status": "reserved",
        }
