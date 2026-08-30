from __future__ import annotations

from typing import Optional, Any

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.inventory import Warehouse


class InventoryWarehouseResolver:
    """Resolve a canonical warehouse for a transaction using only DB-backed configuration."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def resolve(
        self,
        *,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        register_id: Optional[str] = None,
        warehouse_id: Optional[str] = None,
        transaction_context: Optional[dict[str, Any]] = None,
    ) -> Warehouse:
        """Return an active Warehouse record for the supplied scope.

        Resolution precedence is intentionally conservative and DB-driven:
        transaction-specific -> register -> branch -> company -> global
        """
        if warehouse_id:
            stmt = select(Warehouse).where(
                Warehouse.id == warehouse_id,
                Warehouse.company_id == company_id,
                Warehouse.is_deleted == False,
                Warehouse.is_active == True,
            )
            res = await self.db.execute(stmt)
            wh = res.scalars().first()
            if wh:
                return wh
            raise ValueError("INVENTORY_WAREHOUSE_NOT_CONFIGURED")

        if register_id and company_id:
            from ..models.pos import CashRegister

            reg_stmt = select(CashRegister).where(
                CashRegister.id == register_id,
                CashRegister.company_id == company_id,
                CashRegister.is_deleted == False,
                CashRegister.is_active == True,
            )
            reg_res = await self.db.execute(reg_stmt)
            register = reg_res.scalars().first()
            register_warehouse = getattr(register, "warehouse", None)
            if register_warehouse:
                wh_stmt = select(Warehouse).where(
                    Warehouse.company_id == company_id,
                    Warehouse.is_deleted == False,
                    Warehouse.is_active == True,
                    or_(Warehouse.id == register_warehouse, Warehouse.code == register_warehouse),
                )
                wh_res = await self.db.execute(wh_stmt)
                register_wh = wh_res.scalars().first()
                if register_wh:
                    return register_wh

        if branch_id and company_id:
            stmt = select(Warehouse).where(
                Warehouse.branch_id == branch_id,
                Warehouse.company_id == company_id,
                Warehouse.is_deleted == False,
                Warehouse.is_active == True,
            ).order_by(Warehouse.created_at.asc())
            res = await self.db.execute(stmt)
            wh = res.scalars().first()
            if wh:
                return wh

        if company_id:
            stmt = select(Warehouse).where(
                Warehouse.company_id == company_id,
                Warehouse.is_deleted == False,
                Warehouse.is_active == True,
            ).order_by(Warehouse.created_at.asc())
            res = await self.db.execute(stmt)
            wh = res.scalars().first()
            if wh:
                return wh

        # Final fallback remains tenant-scoped to prevent cross-company leakage.
        if company_id:
            stmt = select(Warehouse).where(
                Warehouse.company_id == company_id,
                Warehouse.is_deleted == False,
                Warehouse.is_active == True,
            ).order_by(Warehouse.created_at.asc())
            res = await self.db.execute(stmt)
            wh = res.scalars().first()
            if wh:
                return wh

        raise ValueError("INVENTORY_WAREHOUSE_NOT_CONFIGURED")
