"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Module       : Purchase Repository (ADR-006 — Repository Pattern)
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 1.0.0
Created      : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

ADR Reference : ADR-006 (Repository Pattern)
DBP Reference : SMRITI_DATABASE_BLUEPRINT_v1.0.md §2.6 — Purchase
DBP-002       : suppliers is owned by Purchase. Other modules consume via this repo.

Purpose:
    Canonical data access layer for Purchase module.
    Supplier ownership is enforced here (DBP-002).
    CRM and other modules MUST NOT access supplier tables directly.
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from ..models.purchase import (
    Supplier, PurchaseOrder, PurchaseOrderItem,
    PurchaseReceipt, PurchaseReceiptItem,
)
from ..api.deps import TenantContext
from .base import BaseRepository


class SupplierRepository(BaseRepository[Supplier]):
    """
    Canonical repository for Supplier.
    DBP-002: suppliers owned by Purchase. Only this repo accesses supplier tables.
    """

    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        super().__init__(Supplier, db, tenant_ctx)

    async def get_by_gstin(self, gstin: str) -> Optional[Supplier]:
        """Fetch active supplier by GSTIN — used for duplicate detection."""
        stmt = (
            select(Supplier)
            .filter(
                Supplier.gstin == gstin,
                Supplier.is_deleted == False,
                Supplier.company_id == self.tenant_ctx.company_id,
                Supplier.branch_id == self.tenant_ctx.branch_id,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_name(self, name: str) -> Optional[Supplier]:
        """Fetch active supplier by exact name match."""
        stmt = (
            select(Supplier)
            .filter(
                Supplier.name == name,
                Supplier.is_deleted == False,
                Supplier.company_id == self.tenant_ctx.company_id,
                Supplier.branch_id == self.tenant_ctx.branch_id,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def search(self, q: str, limit: int = 50) -> list[Supplier]:
        """Search suppliers by name or GSTIN."""
        q_like = f"%{q}%"
        stmt = (
            select(Supplier)
            .filter(
                Supplier.is_deleted == False,
                Supplier.company_id == self.tenant_ctx.company_id,
                Supplier.branch_id == self.tenant_ctx.branch_id,
                (Supplier.name.ilike(q_like) | Supplier.gstin.ilike(q_like)),
            )
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_with_profiles(self, supplier_id: str) -> Optional[Supplier]:
        """Load supplier with all sub-profiles eager-loaded."""
        stmt = (
            select(Supplier)
            .options(
                selectinload(Supplier.tax_profiles),
                selectinload(Supplier.bank_details),
                selectinload(Supplier.addresses),
                selectinload(Supplier.contacts),
            )
            .filter(
                Supplier.id == supplier_id,
                Supplier.is_deleted == False,
                Supplier.company_id == self.tenant_ctx.company_id,
                Supplier.branch_id == self.tenant_ctx.branch_id,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()


class PurchaseOrderRepository(BaseRepository[PurchaseOrder]):
    """
    Canonical repository for PurchaseOrder.
    """

    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        super().__init__(PurchaseOrder, db, tenant_ctx)

    async def get_by_order_no(self, order_no: str) -> Optional[PurchaseOrder]:
        """Fetch PO by business document number."""
        stmt = (
            select(PurchaseOrder)
            .filter(
                PurchaseOrder.order_no == order_no,
                PurchaseOrder.is_deleted == False,
                PurchaseOrder.company_id == self.tenant_ctx.company_id,
                PurchaseOrder.branch_id == self.tenant_ctx.branch_id,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_with_items(self, order_id: str) -> Optional[PurchaseOrder]:
        """Load PurchaseOrder with all items eager-loaded."""
        stmt = (
            select(PurchaseOrder)
            .options(selectinload(PurchaseOrder.items))
            .filter(
                PurchaseOrder.id == order_id,
                PurchaseOrder.is_deleted == False,
                PurchaseOrder.company_id == self.tenant_ctx.company_id,
                PurchaseOrder.branch_id == self.tenant_ctx.branch_id,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_open_orders(self, supplier_id: Optional[str] = None) -> list[PurchaseOrder]:
        """Return all CONFIRMED / PARTIAL purchase orders (awaiting full GRN)."""
        stmt = (
            select(PurchaseOrder)
            .filter(
                PurchaseOrder.is_deleted == False,
                PurchaseOrder.company_id == self.tenant_ctx.company_id,
                PurchaseOrder.branch_id == self.tenant_ctx.branch_id,
                PurchaseOrder.status.in_(["CONFIRMED", "PARTIAL"]),
            )
        )
        if supplier_id:
            stmt = stmt.filter(PurchaseOrder.supplier_id == supplier_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class PurchaseReceiptRepository(BaseRepository[PurchaseReceipt]):
    """
    Canonical repository for PurchaseReceipt (GRN).
    """

    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        super().__init__(PurchaseReceipt, db, tenant_ctx)

    async def get_by_grn_no(self, receipt_no: str) -> Optional[PurchaseReceipt]:
        """Fetch GRN by business receipt number."""
        stmt = (
            select(PurchaseReceipt)
            .filter(
                PurchaseReceipt.receipt_no == receipt_no,
                PurchaseReceipt.company_id == self.tenant_ctx.company_id,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_po(self, order_id: str) -> list[PurchaseReceipt]:
        """Return all GRNs linked to a purchase order."""
        stmt = (
            select(PurchaseReceipt)
            .filter(
                PurchaseReceipt.order_id == order_id,
                PurchaseReceipt.company_id == self.tenant_ctx.company_id,
            )
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
