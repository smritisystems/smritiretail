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
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import TenantContext
from ...models.inventory import Product, StockMovement
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

        # Idempotency check: same reservation ID should not create duplicate reservations.
        existing_reservation_result = await self.db.execute(
            select(StockMovement).where(
                StockMovement.product_id == product_id,
                StockMovement.reference_doc_id == reservation_id,
                StockMovement.reference_doc_type == reservation_type,
                StockMovement.is_deleted.is_(False),
            )
        )
        existing_reservation = existing_reservation_result.scalars().first()
        if existing_reservation:
            state = await self.state_engine.get_product_state(product_id)
            available_after = self._to_decimal(state.get("available", 0))
            return {
                "product_id": product_id,
                "reservation_type": reservation_type,
                "reservation_id": reservation_id,
                "reserved_qty": float(existing_reservation.quantity),
                "available_after": float(available_after),
                "on_hand": float(state.get("on_hand", 0)),
                "status": "reserved",
            }

        # Lock the product row first to prevent stale availability calculation
        # under concurrent reservation attempts. Use the locked row as the
        # availability source of truth so the current session does not reuse a
        # stale identity-map copy of the product while the transaction is still
        # in progress.
        product = await self.state_engine._get_product_for_update(product_id)
        current_reserved = self._to_decimal(getattr(product, "reserved_stock", 0))
        current_on_hand = self._to_decimal(getattr(product, "stock", 0))
        available = max(current_on_hand - current_reserved, Decimal("0"))

        if requested > available:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient available stock for reservation. Requested: {requested}, Available: {available}",
            )

        new_reserved = current_reserved + requested
        product.reserved_stock = new_reserved
        self.db.add(product)

        reservation_movement = StockMovement(
            product_id=product.id,
            product_name=product.name,
            sku=product.sku or product.code,
            quantity=requested,
            movement_type="RESERVE",
            reference_doc_type=reservation_type,
            reference_doc_id=reservation_id,
            source_module="reservation",
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )
        self.db.add(reservation_movement)

        await self.db.commit()
        await self.db.refresh(product)

        updated_state = await self.state_engine.get_product_state(product_id)
        available_after = self._to_decimal(updated_state.get("available", 0))

        return {
            "product_id": product_id,
            "reservation_type": reservation_type,
            "reservation_id": reservation_id,
            "reserved_qty": float(requested),
            "available_after": float(available_after),
            "on_hand": float(updated_state.get("on_hand", 0)),
            "status": "reserved",
        }
