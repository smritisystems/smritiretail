"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.3.0
Created      : 2026-07-11
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from ..models.crm import Customer, CustomerGroup, PricingGroup, CustomerTaxProfile
from .base import BaseRepository
from ..api.deps import TenantContext


class CustomerRepository(BaseRepository[Customer]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(Customer, db, tenant_ctx)

    async def get(self, id: str) -> Optional[Customer]:
        stmt = (
            select(Customer)
            .options(
                selectinload(Customer.tax_profile),
                selectinload(Customer.credit_profile),
                selectinload(Customer.addresses),
                selectinload(Customer.contacts),
                selectinload(Customer.channel_preferences),
            )
            .filter(Customer.id == id, Customer.is_deleted == False)
        )
        stmt = self._apply_tenant_filter(stmt)
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def get_all(self, skip: int = 0, limit: int = 100) -> List[Customer]:
        stmt = (
            select(Customer)
            .options(
                selectinload(Customer.tax_profile),
                selectinload(Customer.credit_profile),
                selectinload(Customer.addresses),
                selectinload(Customer.contacts),
                selectinload(Customer.channel_preferences),
            )
            .filter(Customer.is_deleted == False)
        )
        stmt = self._apply_tenant_filter(stmt).offset(skip).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def search(
        self, q: Optional[str] = None, skip: int = 0, limit: int = 50
    ) -> List[Customer]:
        """
        Cashier Search Priority Order (v5.3.0 ADR):
        1. Customer Code (Exact / Prefix)
        2. Mobile Number (Exact / Partial)
        3. GSTIN / PAN (Exact match)
        4. Name (Prefix / Fuzzy)
        """
        stmt = (
            select(Customer)
            .outerjoin(CustomerTaxProfile, Customer.id == CustomerTaxProfile.customer_id)
            .options(
                selectinload(Customer.tax_profile),
                selectinload(Customer.credit_profile),
                selectinload(Customer.addresses),
                selectinload(Customer.contacts),
                selectinload(Customer.channel_preferences),
            )
            .filter(Customer.is_deleted == False)
        )
        stmt = self._apply_tenant_filter(stmt)
        if q:
            term = f"%{q.strip()}%"
            stmt = stmt.filter(
                (Customer.code.ilike(term)) |
                (Customer.name.ilike(term)) |
                (Customer.mobile.ilike(term)) |
                (Customer.gst_number.ilike(term)) |
                (CustomerTaxProfile.gstin.ilike(term)) |
                (CustomerTaxProfile.pan_number.ilike(term))
            )
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class CustomerGroupRepository(BaseRepository[CustomerGroup]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(CustomerGroup, db, tenant_ctx)


class PricingGroupRepository(BaseRepository[PricingGroup]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(PricingGroup, db, tenant_ctx)
