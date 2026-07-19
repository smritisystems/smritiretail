"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.26.0
Created      : 2026-07-11
Modified     : 2026-07-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from ..models.crm import Customer, CustomerGroup, PricingGroup
from ..schemas.crm import (
    CustomerCreate, CustomerUpdate, CustomerGroupCreate,
    PricingGroupCreate, PricingGroupUpdate,
)
from ..api.deps import TenantContext


class CrmService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx

    # ------------------------------------------------------------------
    # CustomerGroup
    # ------------------------------------------------------------------

    async def create_customer_group(self, group_in: CustomerGroupCreate) -> CustomerGroup:
        # Check for duplicate name
        existing = await self.db.execute(
            select(CustomerGroup).filter(
                CustomerGroup.name == group_in.name,
                CustomerGroup.is_deleted == False,
                CustomerGroup.company_id == self.tenant_ctx.company_id,
                CustomerGroup.branch_id == self.tenant_ctx.branch_id
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Customer group with this name already exists")

        db_group = CustomerGroup(
            **group_in.model_dump(),
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )
        self.db.add(db_group)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="Customer group with this name already exists"
            )
        await self.db.refresh(db_group)
        return db_group

    # ------------------------------------------------------------------
    # PricingGroup
    # ------------------------------------------------------------------

    async def create_pricing_group(self, group_in: PricingGroupCreate) -> PricingGroup:
        """
        Create a new PricingGroup. Names must be unique per tenant.
        A PricingGroup controls commercial pricing strategy independently
        of the CustomerGroup classification.
        """
        existing = await self.db.execute(
            select(PricingGroup).filter(
                PricingGroup.name == group_in.name,
                PricingGroup.is_deleted == False,
                PricingGroup.company_id == self.tenant_ctx.company_id,
                PricingGroup.branch_id == self.tenant_ctx.branch_id,
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Pricing group with this name already exists")

        db_group = PricingGroup(
            **group_in.model_dump(),
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )
        self.db.add(db_group)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="Pricing group with this name already exists"
            )
        await self.db.refresh(db_group)
        return db_group

    async def update_pricing_group(self, group_id: str, group_in: PricingGroupUpdate) -> PricingGroup:
        """Update a PricingGroup's commercial pricing parameters."""
        res = await self.db.execute(
            select(PricingGroup).filter(
                PricingGroup.id == group_id,
                PricingGroup.is_deleted == False,
                PricingGroup.company_id == self.tenant_ctx.company_id,
                PricingGroup.branch_id == self.tenant_ctx.branch_id,
            )
        )
        pg = res.scalars().first()
        if not pg:
            raise HTTPException(status_code=404, detail="Pricing group not found")

        for field, value in group_in.model_dump(exclude_unset=True).items():
            setattr(pg, field, value)

        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="A pricing group with this name already exists")
        await self.db.refresh(pg)
        return pg

    async def resolve_customer_pricing(self, customer_id: str) -> dict:
        """
        Price Engine Integration helper.
        Returns the effective pricing parameters for a customer by walking:
            Customer -> PricingGroup (explicit) -> defaults

        The Price Engine in the sales/invoice pipeline calls this method to
        determine: base_price_field, discount_percent, price_adjustment,
        rounding_rule, max_additional_discount_percent, scheme_eligible.

        Returns a plain dict that the price engine can apply directly.
        """
        res = await self.db.execute(
            select(Customer).filter(
                Customer.id == customer_id,
                Customer.is_deleted == False,
                Customer.company_id == self.tenant_ctx.company_id,
                Customer.branch_id == self.tenant_ctx.branch_id,
            )
        )
        customer = res.scalars().first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Default pricing — no group assigned
        defaults = {
            "pricing_group_id": None,
            "pricing_group_name": None,
            "base_price_field": "price",
            "discount_percent": 0.00,
            "price_adjustment": 0.00,
            "rounding_rule": "Nearest1",
            "max_additional_discount_percent": 0.00,
            "tax_inclusive": True,
            "scheme_eligible": True,
            "quantity_break_eligible": False,
            "min_order_value": 0.00,
        }

        if not customer.pricing_group_id:
            return defaults

        pg_res = await self.db.execute(
            select(PricingGroup).filter(
                PricingGroup.id == customer.pricing_group_id,
                PricingGroup.is_deleted == False,
            )
        )
        pg = pg_res.scalars().first()
        if not pg:
            return defaults

        return {
            "pricing_group_id": pg.id,
            "pricing_group_name": pg.name,
            "base_price_field": pg.base_price_field,
            "discount_percent": float(pg.discount_percent),
            "price_adjustment": float(pg.price_adjustment),
            "rounding_rule": pg.rounding_rule,
            "max_additional_discount_percent": float(pg.max_additional_discount_percent),
            "tax_inclusive": pg.tax_inclusive,
            "scheme_eligible": pg.scheme_eligible,
            "quantity_break_eligible": pg.quantity_break_eligible,
            "min_order_value": float(pg.min_order_value),
        }

    # ------------------------------------------------------------------
    # Customer
    # ------------------------------------------------------------------

    async def create_customer(self, customer_in: CustomerCreate) -> Customer:
        # Check for duplicate mobile
        if customer_in.mobile:
            existing_mobile = await self.db.execute(
                select(Customer).filter(
                    Customer.mobile == customer_in.mobile,
                    Customer.is_deleted == False,
                    Customer.company_id == self.tenant_ctx.company_id,
                    Customer.branch_id == self.tenant_ctx.branch_id
                )
            )
            if existing_mobile.scalars().first():
                raise HTTPException(status_code=400, detail="Customer with this mobile number already exists")

        # Validate customer group exists
        stmt = select(CustomerGroup).filter(
            CustomerGroup.id == customer_in.customer_group_id,
            CustomerGroup.is_deleted == False,
            CustomerGroup.company_id == self.tenant_ctx.company_id,
            CustomerGroup.branch_id == self.tenant_ctx.branch_id
        )
        res = await self.db.execute(stmt)
        group = res.scalars().first()
        if not group:
            raise HTTPException(status_code=400, detail="Specified Customer Group does not exist")

        # Validate pricing group if supplied
        if customer_in.pricing_group_id:
            pg_res = await self.db.execute(
                select(PricingGroup).filter(
                    PricingGroup.id == customer_in.pricing_group_id,
                    PricingGroup.is_deleted == False,
                    PricingGroup.company_id == self.tenant_ctx.company_id,
                    PricingGroup.branch_id == self.tenant_ctx.branch_id,
                )
            )
            if not pg_res.scalars().first():
                raise HTTPException(status_code=400, detail="Specified Pricing Group does not exist")

        db_customer = Customer(
            **customer_in.model_dump(),
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )
        self.db.add(db_customer)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="Customer with this mobile number or details already exists"
            )
        await self.db.refresh(db_customer)
        return db_customer

    async def check_credit_limit(self, customer_id: str, new_amount: float) -> bool:
        stmt = select(Customer).filter(
            Customer.id == customer_id,
            Customer.is_deleted == False,
            Customer.company_id == self.tenant_ctx.company_id,
            Customer.branch_id == self.tenant_ctx.branch_id
        )
        res = await self.db.execute(stmt)
        customer = res.scalars().first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        group_stmt = select(CustomerGroup).filter(
            CustomerGroup.id == customer.customer_group_id,
            CustomerGroup.is_deleted == False,
            CustomerGroup.company_id == self.tenant_ctx.company_id,
            CustomerGroup.branch_id == self.tenant_ctx.branch_id
        )
        group_res = await self.db.execute(group_stmt)
        group = group_res.scalars().first()
        if not group:
            return True  # No group limits

        if group.unlimited_credit:
            return True

        # Assert outstanding + new purchase is within limit
        limit = float(group.credit_limit)
        current_outstanding = float(customer.outstanding)
        if current_outstanding + new_amount > limit:
            if group.auto_block_sales:
                raise HTTPException(
                    status_code=400,
                    detail=f"Credit limit exceeded. Limit: {limit}, Current Outstanding: {current_outstanding}"
                )
            return False  # Limit warning
        return True


