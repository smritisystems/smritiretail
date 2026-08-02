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

InventoryStateService — canonical inventory state engine.

Purpose:
- Compute the single source of truth for inventory quantities.
- Reuse stock ledger as the data source.
- Prevent duplicate per-screen stock logic.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import TenantContext
from ..models.inventory import Product, StockMovement


class InventoryStateService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx

    @staticmethod
    def _to_decimal(value: Any) -> Decimal:
        try:
            return Decimal(str(value or 0))
        except Exception:
            return Decimal("0")

    async def _get_product(self, product_id: str) -> Product:
        stmt = (
            select(Product)
            .where(
                Product.id == product_id,
                Product.is_deleted.is_(False),
                Product.company_id == self.tenant_ctx.company_id,
                Product.branch_id == self.tenant_ctx.branch_id,
            )
        )
        result = await self.db.execute(stmt)
        product = result.scalars().first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        return product

    async def _get_movement_stream(self, product_id: str) -> list[StockMovement]:
        stmt = (
            select(StockMovement)
            .where(
                StockMovement.product_id == product_id,
                StockMovement.company_id == self.tenant_ctx.company_id,
                StockMovement.branch_id == self.tenant_ctx.branch_id,
            )
            .order_by(StockMovement.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    def _matches_keyword(text: str | None, *keywords: str) -> bool:
        if not text:
            return False
        lowered = text.lower()
        return any(keyword.lower() in lowered for keyword in keywords)

    async def get_product_state(self, product_id: str) -> dict[str, Any]:
        product = await self._get_product(product_id)
        movements = await self._get_movement_stream(product_id)

        on_hand = self._to_decimal(product.stock)
        reserved = self._to_decimal(getattr(product, "reserved_stock", 0))

        in_transit = Decimal("0")
        consignment_out = Decimal("0")
        consignment_in = Decimal("0")
        marketplace_reserved = Decimal("0")
        damaged = Decimal("0")
        repair = Decimal("0")
        blocked = Decimal("0")
        return_pending = Decimal("0")
        quality_hold = Decimal("0")

        for movement in movements:
            qty = self._to_decimal(movement.quantity)
            if movement.movement_type and movement.movement_type.upper() == "TRANSFER":
                in_transit += abs(qty)

            if movement.movement_type and movement.movement_type.upper() == "OUT" and (
                self._matches_keyword(movement.source_module, "consignment")
                or self._matches_keyword(movement.reference_doc_type, "CONSIGNMENT")
            ):
                consignment_out += abs(qty)

            if movement.movement_type and movement.movement_type.upper() == "IN" and (
                self._matches_keyword(movement.source_module, "consignment")
                or self._matches_keyword(movement.reference_doc_type, "CONSIGNMENT")
            ):
                consignment_in += abs(qty)

            if movement.movement_type and movement.movement_type.upper() == "OUT" and self._matches_keyword(movement.source_module, "marketplace"):
                marketplace_reserved += abs(qty)

            if self._matches_keyword(movement.remarks, "damaged", "damage"):
                damaged += abs(qty)

            if self._matches_keyword(movement.remarks, "repair", "under repair"):
                repair += abs(qty)

            if self._matches_keyword(movement.remarks, "blocked", "hold", "quality hold"):
                blocked += abs(qty)

            if self._matches_keyword(movement.remarks, "return pending", "return-pending") or self._matches_keyword(movement.reference_doc_type, "RETURN"):
                return_pending += abs(qty)

            if self._matches_keyword(movement.remarks, "quality hold", "qc hold"):
                quality_hold += abs(qty)

        available = max(on_hand - reserved - in_transit - marketplace_reserved - blocked - quality_hold - damaged - repair - return_pending, Decimal("0"))

        return {
            "product_id": product.id,
            "sku": product.sku or product.code,
            "product_name": product.name,
            "on_hand": float(on_hand),
            "available": float(available),
            "reserved": float(reserved),
            "in_transit": float(in_transit),
            "consignment_out": float(consignment_out),
            "consignment_in": float(consignment_in),
            "marketplace_reserved": float(marketplace_reserved),
            "damaged": float(damaged),
            "repair": float(repair),
            "blocked": float(blocked),
            "return_pending": float(return_pending),
            "quality_hold": float(quality_hold),
            "warehouse": "Main Warehouse",
            "updated_at": product.modified_at.isoformat() if getattr(product, "modified_at", None) else None,
        }

    async def can_fulfill(self, product_id: str, requested_qty: float) -> dict[str, Any]:
        state = await self.get_product_state(product_id)
        requested = self._to_decimal(requested_qty)
        available = self._to_decimal(state["available"])
        return {
            "available": bool(available >= requested),
            "available_qty": float(available),
            "reserved": state["reserved"],
            "on_hand": state["on_hand"],
            "reason": None if available >= requested else "Insufficient available stock",
        }
