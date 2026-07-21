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

import uuid
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

from ..models.crm import (
    Customer, CustomerGroup, PricingGroup,
    CustomerAddress, CustomerContact, CustomerCreditProfile,
    CustomerTaxProfile, CustomerCommunicationPreference,
)
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
    # Customer Code Generator Engine (CUS-100001)
    # ------------------------------------------------------------------

    async def _generate_customer_code(self) -> str:
        stmt = select(func.count(Customer.id)).filter(
            Customer.company_id == self.tenant_ctx.company_id
        )
        res = await self.db.execute(stmt)
        count = res.scalar() or 0
        return f"CUS-{100001 + count}"

    # ------------------------------------------------------------------
    # Customer Aggregate Operations
    # ------------------------------------------------------------------

    async def create_customer(self, customer_in: CustomerCreate) -> Customer:
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

        if customer_in.customer_group_id:
            stmt = select(CustomerGroup).filter(
                CustomerGroup.id == customer_in.customer_group_id,
                CustomerGroup.is_deleted == False,
                CustomerGroup.company_id == self.tenant_ctx.company_id,
                CustomerGroup.branch_id == self.tenant_ctx.branch_id
            )
            res = await self.db.execute(stmt)
            if not res.scalars().first():
                raise HTTPException(status_code=400, detail="Specified Customer Group does not exist")

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

        # Auto-generate customer code if omitted
        code = customer_in.code or await self._generate_customer_code()
        customer_id = customer_in.id or f"cust-{uuid.uuid4().hex[:12]}"

        # Dump base model attributes excluding nested child entity payloads
        customer_dict = customer_in.model_dump(exclude={
            "id", "code", "tax_profile", "credit_profile", "addresses", "contacts", "channel_preferences"
        })

        db_customer = Customer(
            id=customer_id,
            code=code,
            **customer_dict,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )
        self.db.add(db_customer)

        # Handle nested CustomerTaxProfile
        if customer_in.tax_profile:
            tax_dict = customer_in.tax_profile.model_dump()
            db_tax = CustomerTaxProfile(
                id=f"tax-{uuid.uuid4().hex[:12]}",
                customer_id=customer_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                **tax_dict
            )
            self.db.add(db_tax)

        # Handle nested CustomerCreditProfile
        if customer_in.credit_profile:
            credit_dict = customer_in.credit_profile.model_dump()
            db_credit = CustomerCreditProfile(
                id=f"cred-{uuid.uuid4().hex[:12]}",
                customer_id=customer_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                **credit_dict
            )
            self.db.add(db_credit)

        # Handle nested CustomerAddress list
        for addr_in in customer_in.addresses:
            db_addr = CustomerAddress(
                id=f"addr-{uuid.uuid4().hex[:12]}",
                customer_id=customer_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                **addr_in.model_dump()
            )
            self.db.add(db_addr)

        # Handle nested CustomerContact list
        for contact_in in customer_in.contacts:
            db_contact = CustomerContact(
                id=f"cnt-{uuid.uuid4().hex[:12]}",
                customer_id=customer_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                **contact_in.model_dump()
            )
            self.db.add(db_contact)

        # Handle nested CustomerChannelPreference list
        for chan_in in customer_in.channel_preferences:
            db_chan = CustomerCommunicationPreference(
                id=f"chan-{uuid.uuid4().hex[:12]}",
                customer_id=customer_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                **chan_in.model_dump()
            )
            self.db.add(db_chan)

        try:
            await self.db.commit()
        except Exception as exc:
            await self.db.rollback()
            print("CRM SERVICE COMMIT ERROR:", type(exc), exc)
            raise HTTPException(
                status_code=400,
                detail=f"Customer creation failed due to exception: {type(exc)} {str(exc)}"
            )

        # Fetch full aggregate graph with eager loaded child entities
        stmt_full = (
            select(Customer)
            .options(
                selectinload(Customer.tax_profile),
                selectinload(Customer.credit_profile),
                selectinload(Customer.addresses),
                selectinload(Customer.contacts),
                selectinload(Customer.channel_preferences),
            )
            .filter(Customer.id == customer_id)
        )
        res_full = await self.db.execute(stmt_full)
        return res_full.scalars().first()

    async def check_credit_limit(self, customer_id: Optional[str], new_invoice_amount: float) -> None:
        if not customer_id:
            return

        res = await self.db.execute(
            select(Customer)
            .options(selectinload(Customer.credit_profile))
            .filter(
                Customer.id == customer_id,
                Customer.is_deleted == False,
                Customer.company_id == self.tenant_ctx.company_id,
                Customer.branch_id == self.tenant_ctx.branch_id,
            )
        )
        customer = res.scalars().first()
        if not customer:
            return

        # Check account status block
        if customer.account_status == "Blocked":
            raise HTTPException(
                status_code=400,
                detail=f"Sales blocked for customer '{customer.name}': Account status is Blocked.",
            )

        # Check 1:1 CustomerCreditProfile first if present
        if customer.credit_profile:
            cp = customer.credit_profile
            if cp.block_sales_on_limit and not cp.allow_override and cp.credit_limit > 0:
                current_outstanding = float(customer.outstanding or 0.0)
                limit = float(cp.credit_limit)
                if (current_outstanding + new_invoice_amount) > limit:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Credit limit exceeded for customer '{customer.name}'. "
                            f"Limit: ₹{limit:,.2f}, Outstanding: ₹{current_outstanding:,.2f}, New Invoice: ₹{new_invoice_amount:,.2f}"
                        ),
                    )
            return

        # Fallback to CustomerGroup policy if no individual credit profile exists
        if not customer.customer_group_id:
            return

        group_res = await self.db.execute(
            select(CustomerGroup).filter(
                CustomerGroup.id == customer.customer_group_id,
                CustomerGroup.is_deleted == False,
            )
        )
        group = group_res.scalars().first()
        if not group:
            return

        if group.credit_hold:
            raise HTTPException(
                status_code=400,
                detail=f"Sales blocked for customer '{customer.name}': Account group is on credit hold.",
            )

        if not group.unlimited_credit and group.auto_block_sales and group.credit_limit and float(group.credit_limit) > 0:
            current_outstanding = float(customer.outstanding or 0.0)
            limit = float(group.credit_limit)
            if (current_outstanding + new_invoice_amount) > limit:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Credit limit exceeded for customer '{customer.name}'. "
                        f"Limit: ₹{limit:,.2f}, Outstanding: ₹{current_outstanding:,.2f}, New Invoice: ₹{new_invoice_amount:,.2f}"
                    ),
                )
