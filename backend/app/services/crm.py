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

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from ..models.crm import Customer, CustomerGroup
from ..schemas.crm import CustomerCreate, CustomerUpdate, CustomerGroupCreate
from ..api.deps import TenantContext

class CrmService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx

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
            return True # No group limits
            
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
            return False # Limit warning
        return True

