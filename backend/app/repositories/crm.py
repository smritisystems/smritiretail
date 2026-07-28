"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Module       : CRM Repository (ADR-006 — Repository Pattern)
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 1.0.0
Created      : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

ADR Reference : ADR-006 (Repository Pattern)
DBP Reference : SMRITI_DATABASE_BLUEPRINT_v1.0.md §2.3 — CRM

Purpose:
    Canonical data access layer for CRM module.
    Customer aggregate (Customer + addresses + contacts + profiles) is
    accessed exclusively through CustomerRepository.
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from ..models.crm import (
    Customer, CustomerGroup, PricingGroup,
    CustomerAddress, CustomerContact,
    CustomerCreditProfile, CustomerTaxProfile,
)
from ..api.deps import TenantContext
from .base import BaseRepository


class CustomerRepository(BaseRepository[Customer]):
    """
    Canonical repository for Customer aggregate.
    Handles the full customer entity graph.
    """

    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        super().__init__(Customer, db, tenant_ctx)

    async def get_full(self, customer_id: str) -> Optional[Customer]:
        """Load Customer with all child entities eager-loaded."""
        stmt = (
            select(Customer)
            .options(
                selectinload(Customer.addresses),
                selectinload(Customer.contacts),
                selectinload(Customer.credit_profile),
                selectinload(Customer.tax_profile),
                selectinload(Customer.channel_preferences),
            )
            .filter(
                Customer.id == customer_id,
                Customer.is_deleted == False,
                Customer.company_id == self.tenant_ctx.company_id,
                Customer.branch_id == self.tenant_ctx.branch_id,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_mobile(self, mobile: str) -> Optional[Customer]:
        """Fetch customer by mobile (uniqueness check at registration)."""
        stmt = (
            select(Customer)
            .filter(
                Customer.mobile == mobile,
                Customer.is_deleted == False,
                Customer.company_id == self.tenant_ctx.company_id,
                Customer.branch_id == self.tenant_ctx.branch_id,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_gstin(self, gstin: str) -> Optional[Customer]:
        """Fetch customer by GSTIN (B2B invoice validation)."""
        stmt = (
            select(Customer)
            .filter(
                Customer.gst_number == gstin,
                Customer.is_deleted == False,
                Customer.company_id == self.tenant_ctx.company_id,
                Customer.branch_id == self.tenant_ctx.branch_id,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def search(self, q: str, limit: int = 50) -> list[Customer]:
        """Search customers by name, mobile, email, code."""
        q_like = f"%{q}%"
        stmt = (
            select(Customer)
            .filter(
                Customer.is_deleted == False,
                Customer.company_id == self.tenant_ctx.company_id,
                Customer.branch_id == self.tenant_ctx.branch_id,
                (
                    Customer.name.ilike(q_like)
                    | Customer.mobile.ilike(q_like)
                    | Customer.email.ilike(q_like)
                    | Customer.code.ilike(q_like)
                ),
            )
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_group(self, group_id: str) -> list[Customer]:
        """Return all active customers in a customer group."""
        stmt = (
            select(Customer)
            .filter(
                Customer.customer_group_id == group_id,
                Customer.is_deleted == False,
                Customer.company_id == self.tenant_ctx.company_id,
                Customer.branch_id == self.tenant_ctx.branch_id,
            )
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_blocked(self) -> list[Customer]:
        """Return all blocked customers (credit risk monitoring)."""
        stmt = (
            select(Customer)
            .filter(
                Customer.status == "Blocked",
                Customer.is_deleted == False,
                Customer.company_id == self.tenant_ctx.company_id,
                Customer.branch_id == self.tenant_ctx.branch_id,
            )
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class CustomerGroupRepository(BaseRepository[CustomerGroup]):
    """Canonical repository for CustomerGroup."""

    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        super().__init__(CustomerGroup, db, tenant_ctx)


class PricingGroupRepository(BaseRepository[PricingGroup]):
    """Canonical repository for PricingGroup."""

    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        super().__init__(PricingGroup, db, tenant_ctx)

    async def get_by_name(self, name: str) -> Optional[PricingGroup]:
        stmt = (
            select(PricingGroup)
            .filter(
                PricingGroup.name == name,
                PricingGroup.is_deleted == False,
                PricingGroup.company_id == self.tenant_ctx.company_id,
                PricingGroup.branch_id == self.tenant_ctx.branch_id,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()
