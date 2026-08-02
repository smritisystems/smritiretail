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
SMRITI Inventory Kernel Facades v1.0.0 (FROZEN)

Provides InventoryQueryFacade and InventoryCommandFacade as standard public surface
for external domain consumption (Sales, Purchase, POS, WMS, Reports).
"""

from decimal import Decimal
from typing import Any, List, Optional
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import TenantContext
from ...models.inventory import Product, StockMovement
from .state_engine import InventoryStateService
from .availability_engine import InventoryAvailabilityService
from .reservation_engine import InventoryReservationService
from .trace_engine import InventoryTraceService
from .timeline_engine import InventoryTimelineService


class InventoryQueryFacade:
    """Read-Only Facts, Availability & Audit Queries"""
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.state_service = InventoryStateService(db, tenant_ctx)
        self.availability_service = InventoryAvailabilityService(db, tenant_ctx)
        self.trace_service = InventoryTraceService(db, tenant_ctx)
        self.timeline_service = InventoryTimelineService(db, tenant_ctx)

    async def get_canonical_state(self, product_id: str) -> dict[str, Any]:
        return await self.state_service.get_product_state(product_id)

    async def can_fulfill(
        self,
        product_id: str,
        qty: float | int | Decimal = 0,
        warehouse_id: str | None = None,
    ) -> dict[str, Any]:
        return await self.availability_service.can_fulfill(
            product_id=product_id,
            warehouse_id=warehouse_id,
            qty=qty,
        )

    async def get_stock_movements(self, product_id: str, limit: int = 100) -> List[dict[str, Any]]:
        return await self.trace_service.get_product_trace(product_id=product_id, limit=limit)


class InventoryCommandFacade:
    """State Mutations, Commitments & Business Intent Commands"""
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.reservation_service = InventoryReservationService(db, tenant_ctx)

    async def reserve_stock(
        self,
        product_id: str,
        qty: float | int | Decimal,
        reference_doc: str,
        idempotency_key: str,
    ) -> dict[str, Any]:
        return await self.reservation_service.reserve(
            product_id=product_id,
            qty=qty,
            reservation_type=reference_doc,
            reservation_id=idempotency_key,
        )

    async def issue_sale(
        self,
        invoice_id: str,
        invoice_no: str,
        items: List[dict[str, Any]],
        warehouse: str = "Default Warehouse",
    ) -> List[StockMovement]:
        """Issue SALE movements for invoice posting without exposing raw movement math to Sales."""
        movements: List[StockMovement] = []
        for item in items:
            product_id = item["product_id"]
            qty = Decimal(str(item["quantity"]))
            stmt = select(Product).where(
                Product.id == product_id,
                Product.is_deleted.is_(False),
                Product.company_id == self.tenant_ctx.company_id,
                Product.branch_id == self.tenant_ctx.branch_id,
            )
            res = await self.db.execute(stmt)
            product = res.scalars().first()
            if product and getattr(product, "tracking_mode", "Standard") != "No-stock":
                movement_id = f"SM-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6]}"
                db_movement = StockMovement(
                    id=movement_id,
                    uuid=str(uuid.uuid4()),
                    product_id=product.id,
                    product_name=product.name,
                    sku=product.sku or product.code,
                    quantity=-qty,
                    movement_type="SALE",
                    reference_doc_type="Sales Invoice",
                    reference_doc_id=invoice_id,
                    warehouse=warehouse,
                    unit_cost=product.cost_price or product.price,
                    remarks=f"Stock issued for sales invoice: {invoice_no}",
                    source_module="Sales",
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                )
                self.db.add(db_movement)
                movements.append(db_movement)
        return movements

    async def return_sale(
        self,
        return_id: str,
        return_no: str,
        items: List[dict[str, Any]],
        warehouse: str = "Default Warehouse",
    ) -> List[StockMovement]:
        """Issue SALE_RETURN movements for sales return processing."""
        movements: List[StockMovement] = []
        for item in items:
            product_id = item["product_id"]
            qty = Decimal(str(item["quantity"]))
            stmt = select(Product).where(
                Product.id == product_id,
                Product.is_deleted.is_(False),
                Product.company_id == self.tenant_ctx.company_id,
                Product.branch_id == self.tenant_ctx.branch_id,
            )
            res = await self.db.execute(stmt)
            product = res.scalars().first()
            if product and getattr(product, "tracking_mode", "Standard") != "No-stock":
                movement_id = f"SM-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6]}"
                db_movement = StockMovement(
                    id=movement_id,
                    uuid=str(uuid.uuid4()),
                    product_id=product.id,
                    product_name=product.name,
                    sku=product.sku or product.code,
                    quantity=qty,
                    movement_type="SALE_RETURN",
                    reference_doc_type="Sales Return",
                    reference_doc_id=return_id,
                    warehouse=warehouse,
                    unit_cost=product.cost_price or product.price,
                    remarks=f"Stock restored for sales return: {return_no}",
                    source_module="Sales",
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                )
                self.db.add(db_movement)
                movements.append(db_movement)
        return movements

    async def receive_purchase(
        self,
        grn_id: str,
        grn_no: str,
        items: List[dict[str, Any]],
        warehouse: str = "Default Warehouse",
    ) -> List[StockMovement]:
        """Issue PURCHASE movements for goods receipt note (GRN) posting."""
        movements: List[StockMovement] = []
        for item in items:
            product_id = item["product_id"]
            qty = Decimal(str(item["quantity"]))
            stmt = select(Product).where(
                Product.id == product_id,
                Product.is_deleted.is_(False),
                Product.company_id == self.tenant_ctx.company_id,
                Product.branch_id == self.tenant_ctx.branch_id,
            )
            res = await self.db.execute(stmt)
            product = res.scalars().first()
            if product and getattr(product, "tracking_mode", "Standard") != "No-stock":
                ts = int(datetime.now(timezone.utc).timestamp() * 1_000_000)
                movement_id = f"SM-{ts}-{uuid.uuid4().hex[:6]}"
                db_movement = StockMovement(
                    id=movement_id,
                    uuid=str(uuid.uuid4()),
                    product_id=product.id,
                    product_name=product.name,
                    sku=product.sku or product.code,
                    quantity=qty,
                    movement_type="PURCHASE",
                    reference_doc_type="Goods Receipt",
                    reference_doc_id=grn_id,
                    warehouse=warehouse,
                    unit_cost=product.cost_price or product.price,
                    remarks=f"Stock received for purchase GRN: {grn_no}",
                    source_module="Purchase",
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                )
                self.db.add(db_movement)
                movements.append(db_movement)
        return movements

    async def return_purchase(
        self,
        return_id: str,
        return_no: str,
        items: List[dict[str, Any]],
        warehouse: str = "Default Warehouse",
    ) -> List[StockMovement]:
        """Issue PURCHASE_RETURN movements for debit note / purchase return processing."""
        movements: List[StockMovement] = []
        for item in items:
            product_id = item["product_id"]
            qty = Decimal(str(item["quantity"]))
            stmt = select(Product).where(
                Product.id == product_id,
                Product.is_deleted.is_(False),
                Product.company_id == self.tenant_ctx.company_id,
                Product.branch_id == self.tenant_ctx.branch_id,
            )
            res = await self.db.execute(stmt)
            product = res.scalars().first()
            if product and getattr(product, "tracking_mode", "Standard") != "No-stock":
                ts = int(datetime.now(timezone.utc).timestamp() * 1_000_000)
                movement_id = f"SM-{ts}-{uuid.uuid4().hex[:6]}"
                db_movement = StockMovement(
                    id=movement_id,
                    uuid=str(uuid.uuid4()),
                    product_id=product.id,
                    product_name=product.name,
                    sku=product.sku or product.code,
                    quantity=-qty,
                    movement_type="PURCHASE_RETURN",
                    reference_doc_type="Purchase Return",
                    reference_doc_id=return_id,
                    warehouse=warehouse,
                    unit_cost=product.cost_price or product.price,
                    remarks=f"Stock returned for purchase debit note: {return_no}",
                    source_module="Purchase",
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                )
                self.db.add(db_movement)
                movements.append(db_movement)
        return movements

    async def issue_pos_sale(
        self,
        receipt_id: str,
        receipt_no: str,
        items: List[dict[str, Any]],
        warehouse: str = "Default Warehouse",
    ) -> List[StockMovement]:
        """Issue SALE movements for POS quick checkout posting."""
        movements: List[StockMovement] = []
        for item in items:
            product_id = item["product_id"]
            qty = Decimal(str(item["quantity"]))
            stmt = select(Product).where(
                Product.id == product_id,
                Product.is_deleted.is_(False),
                Product.company_id == self.tenant_ctx.company_id,
                Product.branch_id == self.tenant_ctx.branch_id,
            )
            res = await self.db.execute(stmt)
            product = res.scalars().first()
            if product and getattr(product, "tracking_mode", "Standard") != "No-stock":
                ts = int(datetime.now(timezone.utc).timestamp() * 1_000_000)
                movement_id = f"SM-{ts}-{uuid.uuid4().hex[:6]}"
                db_movement = StockMovement(
                    id=movement_id,
                    uuid=str(uuid.uuid4()),
                    product_id=product.id,
                    product_name=product.name,
                    sku=product.sku or product.code,
                    quantity=-qty,
                    movement_type="SALE",
                    reference_doc_type="POS Receipt",
                    reference_doc_id=receipt_id,
                    warehouse=warehouse,
                    unit_cost=product.cost_price or product.price,
                    remarks=f"Stock issued for POS checkout: {receipt_no}",
                    source_module="POS",
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                )
                self.db.add(db_movement)
                movements.append(db_movement)
        return movements
