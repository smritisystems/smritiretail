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
        stmt = stmt.order_by(Customer.created_at.asc(), Customer.id.asc())
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


class CustomerGSTRegistrationRepository(BaseRepository):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        from ..models.crm import CustomerGSTRegistration
        super().__init__(CustomerGSTRegistration, db, tenant_ctx)
        self.model = CustomerGSTRegistration

    def _apply_company_filter(self, stmt):
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.filter(self.model.company_id == self.tenant_ctx.company_id)
        return stmt

    async def get(self, id: str):
        stmt = select(self.model).filter(
            self.model.id == id,
            self.model.is_deleted == False,
        )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_customer_and_id(self, customer_id: str, id: str):
        stmt = select(self.model).filter(
            self.model.id == id,
            self.model.customer_id == customer_id,
            self.model.is_deleted == False,
        )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_customer_and_gstin(
        self, customer_id: str, gstin: str, include_deleted: bool = False
    ):
        stmt = select(self.model).filter(
            self.model.customer_id == customer_id,
            self.model.gstin == gstin,
        )
        if not include_deleted:
            stmt = stmt.filter(self.model.is_deleted == False)
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_all_for_customer(
        self, customer_id: str, include_inactive: bool = False
    ):
        stmt = select(self.model).filter(
            self.model.customer_id == customer_id,
            self.model.is_deleted == False,
        )
        if not include_inactive:
            stmt = stmt.filter(
                self.model.is_active == True,
                self.model.status == "ACTIVE",
            )
        stmt = self._apply_company_filter(stmt)
        stmt = stmt.order_by(self.model.is_primary.desc(), self.model.state_name.asc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_primary(self, customer_id: str):
        stmt = select(self.model).filter(
            self.model.customer_id == customer_id,
            self.model.is_primary == True,
            self.model.is_deleted == False,
        )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def clear_primary_flags(self, customer_id: str, exclude_id: Optional[str] = None):
        stmt = select(self.model).filter(
            self.model.customer_id == customer_id,
            self.model.is_primary == True,
            self.model.is_deleted == False,
        )
        if exclude_id:
            stmt = stmt.filter(self.model.id != exclude_id)
        stmt = self._apply_company_filter(stmt)
        res = await self.db.execute(stmt)
        for reg in res.scalars().all():
            reg.is_primary = False


class CustomerDeliveryLocationRepository(BaseRepository):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        from ..models.crm import CustomerDeliveryLocation
        super().__init__(CustomerDeliveryLocation, db, tenant_ctx)
        self.model = CustomerDeliveryLocation

    def _apply_company_filter(self, stmt):
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.filter(self.model.company_id == self.tenant_ctx.company_id)
        return stmt

    async def get(self, id: str):
        stmt = (
            select(self.model)
            .options(selectinload(self.model.gst_registration))
            .filter(
                self.model.id == id,
                self.model.is_deleted == False,
            )
        )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_customer_and_id(self, customer_id: str, id: str):
        stmt = (
            select(self.model)
            .options(selectinload(self.model.gst_registration))
            .filter(
                self.model.id == id,
                self.model.customer_id == customer_id,
                self.model.is_deleted == False,
            )
        )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_customer_and_store_code(
        self, customer_id: str, store_code: str, active_only: bool = True
    ):
        stmt = select(self.model).filter(
            self.model.customer_id == customer_id,
            self.model.store_code == store_code,
            self.model.is_deleted == False,
        )
        if active_only:
            stmt = stmt.filter(
                self.model.is_active == True,
                self.model.status == "ACTIVE",
            )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_all_for_customer(
        self, customer_id: str, include_inactive: bool = False
    ):
        stmt = (
            select(self.model)
            .options(selectinload(self.model.gst_registration))
            .filter(
                self.model.customer_id == customer_id,
                self.model.is_deleted == False,
            )
        )
        if not include_inactive:
            stmt = stmt.filter(
                self.model.is_active == True,
                self.model.status == "ACTIVE",
            )
        stmt = self._apply_company_filter(stmt)
        stmt = stmt.order_by(self.model.store_code.asc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def search(
        self,
        q: Optional[str] = None,
        customer_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ):
        stmt = (
            select(self.model)
            .options(selectinload(self.model.gst_registration))
            .filter(
                self.model.is_deleted == False,
                self.model.is_active == True,
                self.model.status == "ACTIVE",
            )
        )
        stmt = self._apply_company_filter(stmt)
        if customer_id:
            stmt = stmt.filter(self.model.customer_id == customer_id)
        if q:
            clean_q = q.strip()
            stmt = stmt.filter(
                (self.model.store_code.ilike(f"%{clean_q}%")) |
                (self.model.location_name.ilike(f"%{clean_q}%")) |
                (self.model.city.ilike(f"%{clean_q}%")) |
                (self.model.state.ilike(f"%{clean_q}%")) |
                (self.model.pincode.ilike(f"%{clean_q}%"))
            )
        stmt = stmt.order_by(self.model.store_code.asc())
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_default(self, customer_id: str):
        stmt = (
            select(self.model)
            .options(selectinload(self.model.gst_registration))
            .filter(
                self.model.customer_id == customer_id,
                self.model.is_default == True,
                self.model.is_active == True,
                self.model.status == "ACTIVE",
                self.model.is_deleted == False,
            )
        )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def clear_default_flags(self, customer_id: str, exclude_id: Optional[str] = None):
        stmt = select(self.model).filter(
            self.model.customer_id == customer_id,
            self.model.is_default == True,
            self.model.is_deleted == False,
        )
        if exclude_id:
            stmt = stmt.filter(self.model.id != exclude_id)
        stmt = self._apply_company_filter(stmt)
        res = await self.db.execute(stmt)
        for loc in res.scalars().all():
            loc.is_default = False


class CustomerBillingLocationRepository(BaseRepository):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        from ..models.crm import CustomerBillingLocation
        super().__init__(CustomerBillingLocation, db, tenant_ctx)
        self.model = CustomerBillingLocation

    def _apply_company_filter(self, stmt):
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.filter(self.model.company_id == self.tenant_ctx.company_id)
        return stmt

    async def get(self, id: str):
        stmt = (
            select(self.model)
            .options(selectinload(self.model.gst_registration))
            .filter(
                self.model.id == id,
                self.model.is_deleted == False,
            )
        )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_customer_and_id(self, customer_id: str, id: str):
        stmt = (
            select(self.model)
            .options(selectinload(self.model.gst_registration))
            .filter(
                self.model.id == id,
                self.model.customer_id == customer_id,
                self.model.is_deleted == False,
            )
        )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_customer_and_billing_store_code(
        self, customer_id: str, billing_store_code: str, active_only: bool = True
    ):
        stmt = select(self.model).filter(
            self.model.customer_id == customer_id,
            self.model.billing_store_code == billing_store_code,
            self.model.is_deleted == False,
        )
        if active_only:
            stmt = stmt.filter(self.model.status == "ACTIVE")
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_all_for_customer(
        self, customer_id: str, include_inactive: bool = False
    ):
        stmt = (
            select(self.model)
            .options(selectinload(self.model.gst_registration))
            .filter(
                self.model.customer_id == customer_id,
                self.model.is_deleted == False,
            )
        )
        if not include_inactive:
            stmt = stmt.filter(self.model.status == "ACTIVE")
        stmt = self._apply_company_filter(stmt)
        stmt = stmt.order_by(self.model.is_default.desc(), self.model.billing_store_code.asc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_default(self, customer_id: str):
        stmt = (
            select(self.model)
            .options(selectinload(self.model.gst_registration))
            .filter(
                self.model.customer_id == customer_id,
                self.model.is_default == True,
                self.model.status == "ACTIVE",
                self.model.is_deleted == False,
            )
        )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def clear_default_flags(self, customer_id: str, exclude_id: Optional[str] = None):
        stmt = select(self.model).filter(
            self.model.customer_id == customer_id,
            self.model.is_default == True,
            self.model.is_deleted == False,
        )
        if exclude_id:
            stmt = stmt.filter(self.model.id != exclude_id)
        stmt = self._apply_company_filter(stmt)
        res = await self.db.execute(stmt)
        for loc in res.scalars().all():
            loc.is_default = False


class CustomerExternalIdentityRepository(BaseRepository):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        from ..models.crm import CustomerExternalIdentity
        super().__init__(CustomerExternalIdentity, db, tenant_ctx)
        self.model = CustomerExternalIdentity

    def _apply_company_filter(self, stmt):
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.filter(self.model.company_id == self.tenant_ctx.company_id)
        return stmt

    async def get_all_for_customer(self, customer_id: str, include_inactive: bool = False):
        stmt = select(self.model).filter(
            self.model.customer_id == customer_id,
            self.model.is_deleted == False,
        )
        if not include_inactive:
            stmt = stmt.filter(self.model.status == "ACTIVE")
        stmt = self._apply_company_filter(stmt)
        stmt = stmt.order_by(self.model.source_system.asc(), self.model.external_code.asc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_composite(
        self, source_system: str, external_type: str, external_code: str
    ):
        stmt = select(self.model).filter(
            self.model.source_system == source_system,
            self.model.external_type == external_type,
            self.model.external_code == external_code,
            self.model.status == "ACTIVE",
            self.model.is_deleted == False,
        )
        stmt = self._apply_company_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

