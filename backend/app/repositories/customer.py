"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.8.0
Created      : 2026-07-11
Modified     : 2026-07-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from ..models.crm import Customer, CustomerGroup
from .base import BaseRepository
from ..api.deps import TenantContext

class CustomerRepository(BaseRepository[Customer]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(Customer, db, tenant_ctx)

    async def get(self, id: str) -> Optional[Customer]:
        stmt = (
            select(Customer)
            .options(selectinload(Customer.group))
            .filter(Customer.id == id, Customer.is_deleted == False)
        )
        stmt = self._apply_tenant_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_all(self, skip: int = 0, limit: int = 100) -> List[Customer]:
        stmt = (
            select(Customer)
            .options(selectinload(Customer.group))
            .filter(Customer.is_deleted == False)
        )
        stmt = self._apply_tenant_filter(stmt)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def search(
        self, q: Optional[str] = None, skip: int = 0, limit: int = 50
    ) -> List[Customer]:
        """
        Search customers by name or mobile under tenant context, eagerly loading group for credit policy.
        """
        stmt = (
            select(Customer)
            .options(selectinload(Customer.group))
            .filter(Customer.is_deleted == False)
        )
        stmt = self._apply_tenant_filter(stmt)
        if q:
            clean_q = q.strip()
            stmt = stmt.filter(
                (Customer.name.ilike(f"%{clean_q}%")) |
                (Customer.mobile.ilike(f"%{clean_q}%")) |
                (Customer.code.ilike(f"%{clean_q}%")) |
                (Customer.id.ilike(f"%{clean_q}%")) |
                (Customer.email.ilike(f"%{clean_q}%")) |
                (Customer.gst_number.ilike(f"%{clean_q}%"))
            )
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

class CustomerGroupRepository(BaseRepository[CustomerGroup]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(CustomerGroup, db, tenant_ctx)
