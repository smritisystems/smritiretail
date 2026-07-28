"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Module       : Inventory Repository (ADR-006 — Repository Pattern)
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 1.0.0
Created      : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

ADR Reference : ADR-006 (Repository Pattern)
GR Reference  : GR-001 (SSOT), GR-014 (Code-First Review)
DBP Reference : SMRITI_DATABASE_BLUEPRINT_v1.0.md §2.5 — Inventory

Purpose:
    Canonical data access layer for Inventory module.
    All Inventory service methods MUST use these repositories.
    Direct session.execute(select(Product)...) in service layer is prohibited.
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from ..models.inventory import Product, StockMovement, Warehouse, StockCount
from ..api.deps import TenantContext
from .base import BaseRepository


class ProductRepository(BaseRepository[Product]):
    """
    Canonical repository for Product (Item Master).
    Owner: Inventory module. Other modules consume via this repo or API.
    """

    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        super().__init__(Product, db, tenant_ctx)

    async def get_by_code(self, code: str) -> Optional[Product]:
        """Fetch active product by business code (not PK)."""
        stmt = (
            select(Product)
            .filter(
                Product.code == code,
                Product.is_deleted == False,
                Product.company_id == self.tenant_ctx.company_id,
                Product.branch_id == self.tenant_ctx.branch_id,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_barcode(self, barcode: str) -> Optional[Product]:
        """Fetch active product by barcode value."""
        stmt = (
            select(Product)
            .filter(
                Product.barcode == barcode,
                Product.is_deleted == False,
                Product.company_id == self.tenant_ctx.company_id,
                Product.branch_id == self.tenant_ctx.branch_id,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def search(self, q: str, limit: int = 50) -> list[Product]:
        """Full-text search across name, code, barcode, SKU."""
        q_like = f"%{q}%"
        stmt = (
            select(Product)
            .filter(
                Product.is_deleted == False,
                Product.company_id == self.tenant_ctx.company_id,
                Product.branch_id == self.tenant_ctx.branch_id,
                (
                    Product.name.ilike(q_like)
                    | Product.code.ilike(q_like)
                    | Product.barcode.ilike(q_like)
                    | Product.sku.ilike(q_like)
                ),
            )
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_low_stock(self, threshold: int = 5) -> list[Product]:
        """Return products where stock <= threshold (for replenishment triggers)."""
        stmt = (
            select(Product)
            .filter(
                Product.is_deleted == False,
                Product.company_id == self.tenant_ctx.company_id,
                Product.branch_id == self.tenant_ctx.branch_id,
                Product.stock <= threshold,
            )
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_stock(self, product_id: str, delta: int) -> Optional[Product]:
        """Increment (positive) or decrement (negative) stock atomically."""
        product = await self.get(product_id)
        if not product:
            return None
        product.stock += delta
        self.db.add(product)
        return product


class StockMovementRepository(BaseRepository[StockMovement]):
    """
    Canonical repository for StockMovement ledger.
    Every inventory change MUST produce a StockMovement record.
    """

    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        super().__init__(StockMovement, db, tenant_ctx)

    async def get_by_product(self, product_id: str, limit: int = 100) -> list[StockMovement]:
        """Return movement history for a single product, newest first."""
        stmt = (
            select(StockMovement)
            .filter(
                StockMovement.product_id == product_id,
                StockMovement.company_id == self.tenant_ctx.company_id,
                StockMovement.branch_id == self.tenant_ctx.branch_id,
            )
            .order_by(StockMovement.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_reference(self, reference_doc_id: str) -> list[StockMovement]:
        """Return all movements generated by a specific document (PO, GRN, Invoice)."""
        stmt = (
            select(StockMovement)
            .filter(
                StockMovement.reference_doc_id == reference_doc_id,
                StockMovement.company_id == self.tenant_ctx.company_id,
            )
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class WarehouseRepository(BaseRepository[Warehouse]):
    """Canonical repository for Warehouse."""

    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        super().__init__(Warehouse, db, tenant_ctx)

    async def get_default(self) -> Optional[Warehouse]:
        """Return the default warehouse for this tenant."""
        stmt = (
            select(Warehouse)
            .filter(
                Warehouse.is_deleted == False,
                Warehouse.company_id == self.tenant_ctx.company_id,
                Warehouse.branch_id == self.tenant_ctx.branch_id,
                Warehouse.is_default == True,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()
