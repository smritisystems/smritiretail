"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-07-17
Modified     : 2026-07-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import List, Optional
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import TenantContext
from ..models.pos import CashRegister, Shift
from ..models.sales import SalesInvoice
from ..db.base import BaseEntity
from .base import BaseRepository


class CashRegisterRepository(BaseRepository[CashRegister]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(CashRegister, db, tenant_ctx)

    async def get_by_code(self, code: str) -> Optional[CashRegister]:
        stmt = select(CashRegister).filter(
            CashRegister.code == code,
            CashRegister.is_deleted == False,
        )
        stmt = self._apply_tenant_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()


class ShiftRepository(BaseRepository[Shift]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(Shift, db, tenant_ctx)

    async def get_active_shift(self, register_id: str) -> Optional[Shift]:
        stmt = select(Shift).filter(
            Shift.register_id == register_id,
            Shift.status == "OPEN",
            Shift.is_deleted == False,
        )
        stmt = self._apply_tenant_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_all_recent(self, limit: int = 100) -> List[Shift]:
        stmt = select(Shift).filter(
            Shift.is_deleted == False,
        )
        stmt = self._apply_tenant_filter(stmt)
        stmt = stmt.order_by(Shift.opened_at.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return result.scalars().all()
