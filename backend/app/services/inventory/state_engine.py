from __future__ import annotations

"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Version      : 3.29.0
Modified     : 2026-08-02 — RC2 Movement Registry integration
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Inventory State Engine — RC2 Movement Registry Integration
----------------------------------------------------------
This module is part of the Inventory Kernel v1.0 (FROZEN at RC2).

RC2 Change: All movement_type dispatch now resolves through
MovementTypeRegistry.get() rather than hard-coded string comparisons.
The calculation algorithm and state equations are unchanged.

Platform Rule (FROZEN — Inventory Kernel v1.0)
----------------------------------------------
No engine may update `products.stock` directly except through the
Inventory State reconciliation pipeline (trg_inventory_state_reconciliation).

Kernel Invariant I-001 (FROZEN — ADR-001, ratified 2026-08-02)
--------------------------------------------------------------
SALE_RETURN is a physical stock movement only.
  · MUST increase On Hand via the trigger.
  · MUST NOT contribute to the return_pending deduction bucket.
  · A completed return is a physical fact, not a pending commitment.

Kernel Invariant I-002 (FROZEN — ADR-001, ratified 2026-08-02)
--------------------------------------------------------------
Completed business documents are never inferred from text.
  · FORBIDDEN: _matches_keyword(movement.reference_doc_type, "RETURN")
  · REQUIRED:  movement_type == "SALE_RETURN"  (or, in RC3: behavior.affects_return_pending)
  · Keyword matching on reference_doc_type / remarks is a temporary bridge
    for state buckets not yet covered by the movement taxonomy.
    All such heuristics must be replaced by explicit taxonomy flags in RC3.
"""

from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import TenantContext
from ...models.inventory import Product, StockMovement


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
        await self.db.refresh(product)
        return product

    async def _get_product_for_update(self, product_id: str) -> Product:
        stmt = (
            select(Product)
            .where(
                Product.id == product_id,
                Product.is_deleted.is_(False),
                Product.company_id == self.tenant_ctx.company_id,
                Product.branch_id == self.tenant_ctx.branch_id,
            )
            .with_for_update()
        )
        result = await self.db.execute(stmt)
        product = result.scalars().first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        await self.db.refresh(product)
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
        # Import here to avoid circular import at module load time.
        # MovementTypeRegistry is sealed at startup; this import resolves once.
        from ...domain.movement_taxonomy import MovementTypeRegistry

        product = await self._get_product(product_id)
        movements = await self._get_movement_stream(product_id)

        on_hand = self._to_decimal(product.stock)
        reserved = self._to_decimal(getattr(product, "reserved_stock", 0))

        in_transit           = Decimal("0")
        consignment_out      = Decimal("0")
        consignment_in       = Decimal("0")
        marketplace_reserved = Decimal("0")
        damaged              = Decimal("0")
        repair               = Decimal("0")
        blocked              = Decimal("0")
        return_pending       = Decimal("0")
        quality_hold         = Decimal("0")

        for movement in movements:
            qty      = self._to_decimal(movement.quantity)
            behavior = MovementTypeRegistry.get(movement.movement_type)

            # ------------------------------------------------------------------
            # Transit: movement record represents goods in transit between
            # locations.  Previously: hard-coded `== "TRANSFER"`.
            # Now:      resolved via behavior flag (covers TRANSFER_OUT, SHIP,
            #           DISPATCH, and any SDK-registered transit types).
            # ------------------------------------------------------------------
            if behavior.affects_transit:
                in_transit += abs(qty)

            # ------------------------------------------------------------------
            # Consignment: contextual — source_module or reference_doc_type
            # identifies consignment flow.  The direction flag distinguishes
            # goods sent out vs. received back.
            # Previously: hard-coded `== "OUT"` / `== "IN"`.
            # ------------------------------------------------------------------
            is_consignment = (
                self._matches_keyword(movement.source_module, "consignment")
                or self._matches_keyword(movement.reference_doc_type, "CONSIGNMENT")
            )
            if is_consignment and behavior.affects_physical_stock:
                if behavior.direction == -1:
                    consignment_out += abs(qty)
                elif behavior.direction == +1:
                    consignment_in += abs(qty)

            # ------------------------------------------------------------------
            # Marketplace reserved: outbound physical movement from marketplace
            # module.
            # Previously: hard-coded `== "OUT"` + source_module keyword.
            # Now:        behavior.affects_physical_stock + direction + module.
            # ------------------------------------------------------------------
            if (
                behavior.affects_physical_stock
                and behavior.direction == -1
                and self._matches_keyword(movement.source_module, "marketplace")
            ):
                marketplace_reserved += abs(qty)

            # ------------------------------------------------------------------
            # Remark-based state buckets — algorithm unchanged from pre-RC2.
            # These remain keyword-driven until movement_type taxonomy reaches
            # full coverage (RC3 work).
            # ------------------------------------------------------------------
            if self._matches_keyword(movement.remarks, "damaged", "damage"):
                damaged += abs(qty)

            if self._matches_keyword(movement.remarks, "repair", "under repair"):
                repair += abs(qty)

            if self._matches_keyword(movement.remarks, "blocked", "hold", "quality hold"):
                blocked += abs(qty)

            # Note: only remarks-based "return pending" is treated as a pending-state
            # deduction.  The former reference_doc_type "RETURN" branch matched
            # completed SALE_RETURN / PURCHASE_RETURN movements and incorrectly
            # reduced available stock for committed inventory.
            if self._matches_keyword(movement.remarks, "return pending", "return-pending"):
                return_pending += abs(qty)

            if self._matches_keyword(movement.remarks, "quality hold", "qc hold"):
                quality_hold += abs(qty)

        # State Equation (FROZEN — Inventory Kernel v1.0)
        #
        # Available = On Hand
        #           − Reserved − In Transit − Marketplace Reserved
        #           − Blocked − Quality Hold − Damaged − Repair
        #           − Return Pending − Consignment Out
        #
        # Available is floored at zero; negative availability is not surfaced
        # to consumers (checked separately via can_fulfill / reservation engine).
        available = max(
            on_hand
            - reserved
            - in_transit
            - marketplace_reserved
            - blocked
            - quality_hold
            - damaged
            - repair
            - return_pending
            - consignment_out,
            Decimal("0"),
        )

        return {
            "product_id":           product.id,
            "sku":                  product.sku or product.code,
            "product_name":         product.name,
            "on_hand":              float(on_hand),
            "available":            float(available),
            "reserved":             float(reserved),
            "in_transit":           float(in_transit),
            "consignment_out":      float(consignment_out),
            "consignment_in":       float(consignment_in),
            "marketplace_reserved": float(marketplace_reserved),
            "damaged":              float(damaged),
            "repair":               float(repair),
            "blocked":              float(blocked),
            "return_pending":       float(return_pending),
            "quality_hold":         float(quality_hold),
            "warehouse":            "All Warehouses",
            "updated_at":           product.modified_at.isoformat() if getattr(product, "modified_at", None) else None,
        }

    async def get_warehouse_breakdown(self, product_id: str) -> dict[str, float]:
        from ...domain.movement_taxonomy import MovementTypeRegistry

        movements = await self._get_movement_stream(product_id)
        breakdown: dict[str, Decimal] = {}

        for movement in movements:
            behavior  = MovementTypeRegistry.get(movement.movement_type)
            warehouse = movement.warehouse or "Unknown Warehouse"
            qty       = self._to_decimal(movement.quantity)

            # Only physical movements with a clear direction affect the
            # warehouse on-hand breakdown.
            # Previously: hard-coded `== "IN"` / `== "OUT"` string compare.
            if not behavior.affects_physical_stock or behavior.direction == 0:
                continue

            delta = qty if behavior.direction == +1 else -abs(qty)
            breakdown[warehouse] = breakdown.get(warehouse, Decimal("0")) + delta

        return {warehouse: float(quantity) for warehouse, quantity in breakdown.items()}

    async def can_fulfill(self, product_id: str, requested_qty: float) -> dict[str, Any]:
        state     = await self.get_product_state(product_id)
        requested = self._to_decimal(requested_qty)
        available = self._to_decimal(state["available"])
        return {
            "available":     bool(available >= requested),
            "available_qty": float(available),
            "reserved":      state["reserved"],
            "on_hand":       state["on_hand"],
            "reason":        None if available >= requested else "Insufficient available stock",
        }
