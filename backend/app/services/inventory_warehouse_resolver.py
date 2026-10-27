"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.1.0
Created      : 2026-08-22
Modified     : 2026-10-27
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Changelog:
  v3.1.0 (R-001, 2026-10-27): Fix register resolution to prefer warehouse_id FK column
    over the legacy warehouse text-code field. Removes silent wrong-warehouse fallback.
    Remove duplicate company-level fallback block (was identical to primary).
"""
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

        Resolution precedence (DB-driven, conservative):
          1. Explicit warehouse_id supplied by caller
          2. POS register - warehouse_id FK first, then legacy warehouse code text
          3. Branch-level default (oldest active warehouse for the branch)
          4. Company-level fallback (oldest active warehouse for the company)
        """
        # 1. Explicit warehouse_id passed by caller - highest precedence.
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

        # 2. POS register - prefer warehouse_id FK, fall back to legacy warehouse code text.
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

            if register:
                # R-001: Prefer the governed FK column first.
                reg_wh_id: Optional[str] = getattr(register, "warehouse_id", None)
                if reg_wh_id:
                    wh_stmt = select(Warehouse).where(
                        Warehouse.id == reg_wh_id,
                        Warehouse.company_id == company_id,
                        Warehouse.is_deleted == False,
                        Warehouse.is_active == True,
                    )
                    wh_res = await self.db.execute(wh_stmt)
                    register_wh = wh_res.scalars().first()
                    if register_wh:
                        return register_wh

                # Fallback: legacy warehouse code text (backward-compat until fully migrated).
                reg_wh_code: Optional[str] = getattr(register, "warehouse", None)
                if reg_wh_code:
                    wh_stmt = select(Warehouse).where(
                        Warehouse.company_id == company_id,
                        Warehouse.is_deleted == False,
                        Warehouse.is_active == True,
                        or_(Warehouse.id == reg_wh_code, Warehouse.code == reg_wh_code),
                    )
                    wh_res = await self.db.execute(wh_stmt)
                    register_wh = wh_res.scalars().first()
                    if register_wh:
                        return register_wh

        # 3. Branch-level default — prefer is_default_for_branch flag (R-007),
        #    then fall back to oldest by created_at for backward compatibility.
        if branch_id and company_id:
            stmt = select(Warehouse).where(
                Warehouse.branch_id == branch_id,
                Warehouse.company_id == company_id,
                Warehouse.is_deleted == False,
                Warehouse.is_active == True,
            ).order_by(
                Warehouse.is_default_for_branch.desc(),  # R-007: governed default first
                (Warehouse.pincode.is_not(None) & (Warehouse.pincode != "")).desc(),
                Warehouse.created_at.asc(),
            )
            res = await self.db.execute(stmt)
            wh = res.scalars().first()
            if wh:
                return wh


        # 4. Company-level fallback - oldest active warehouse for the company.
        if company_id:
            stmt = select(Warehouse).where(
                Warehouse.company_id == company_id,
                Warehouse.is_deleted == False,
                Warehouse.is_active == True,
            ).order_by(
                (Warehouse.pincode.is_not(None) & (Warehouse.pincode != "")).desc(),
                Warehouse.created_at.asc(),
            )
            res = await self.db.execute(stmt)
            wh = res.scalars().first()
            if wh:
                return wh

        raise ValueError("INVENTORY_WAREHOUSE_NOT_CONFIGURED")
