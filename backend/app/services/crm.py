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
                (CustomerGroup.company_id == self.tenant_ctx.company_id) | (CustomerGroup.company_id.is_(None))
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Customer group with this name already exists")
        
        grp_dict = group_in.model_dump()
        if not grp_dict.get("id"):
            import uuid
            grp_dict["id"] = f"cg-{uuid.uuid4().hex[:8]}"
        
        db_group = CustomerGroup(
            **grp_dict,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )
        self.db.add(db_group)
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            err_msg = str(exc.orig) if hasattr(exc, "orig") else str(exc)
            if "customer_groups_name_key" in err_msg or "name" in err_msg:
                raise HTTPException(status_code=400, detail="Customer group with this name already exists")
            elif "customer_groups_pkey" in err_msg or "id" in err_msg:
                raise HTTPException(status_code=400, detail="Customer group with this ID already exists")
            elif "branch_id" in err_msg or "company_id" in err_msg:
                raise HTTPException(status_code=400, detail="Specified company or branch does not exist")
            else:
                raise HTTPException(status_code=400, detail="Customer group could not be created due to database integrity constraints")
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
                )
            )
            if existing_mobile.scalars().first():
                raise HTTPException(status_code=400, detail="Customer with this mobile number already exists")

        # Validate customer group exists if specified
        if customer_in.customer_group_id:
            stmt = select(CustomerGroup).filter(
                CustomerGroup.id == customer_in.customer_group_id,
                CustomerGroup.is_deleted == False,
            )
            if self.tenant_ctx.company_id:
                stmt = stmt.filter(
                    (CustomerGroup.company_id == self.tenant_ctx.company_id) | (CustomerGroup.company_id.is_(None))
                )
            res = await self.db.execute(stmt)
            group = res.scalars().first()
            if not group:
                raise HTTPException(status_code=400, detail="Specified Customer Group does not exist")

        cust_dict = customer_in.model_dump()
        if not cust_dict.get("id"):
            import uuid
            cust_dict["id"] = f"cust-{uuid.uuid4().hex[:8]}"
        if not cust_dict.get("code"):
            import uuid
            cust_dict["code"] = f"CUST-{uuid.uuid4().hex[:8].upper()}"

        db_customer = Customer(
            **cust_dict,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )

        self.db.add(db_customer)
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            err_msg = str(exc.orig) if hasattr(exc, "orig") else str(exc)
            if "customers_pkey" in err_msg:
                raise HTTPException(status_code=400, detail="Customer with this ID already exists")
            elif "mobile" in err_msg:
                raise HTTPException(status_code=400, detail="Customer with this mobile number already exists")
            elif "customer_group_id" in err_msg:
                raise HTTPException(status_code=400, detail="Specified Customer Group does not exist")
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Customer with this mobile number or details already exists"
                )
        await self.db.refresh(db_customer)
        return db_customer

    async def get_customer(self, customer_id: str) -> Optional[Customer]:
        stmt = select(Customer).filter(
            Customer.id == customer_id,
            Customer.is_deleted == False,
        )
        if self.tenant_ctx.company_id:
            stmt = stmt.filter((Customer.company_id == self.tenant_ctx.company_id) | (Customer.company_id.is_(None)))
        if self.tenant_ctx.branch_id:
            stmt = stmt.filter((Customer.branch_id == self.tenant_ctx.branch_id) | (Customer.branch_id.is_(None)))
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def check_credit_limit(self, customer_id: str, new_amount: float) -> bool:
        if customer_id == "CUST-WALKIN":
            return True

        customer = await self.get_customer(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        group_stmt = select(CustomerGroup).filter(
            CustomerGroup.id == customer.customer_group_id,
            CustomerGroup.is_deleted == False,
        )
        if self.tenant_ctx.company_id:
            group_stmt = group_stmt.filter(
                (CustomerGroup.company_id == self.tenant_ctx.company_id) | (CustomerGroup.company_id.is_(None))
            )
        group_res = await self.db.execute(group_stmt)
        group = group_res.scalars().first()
        if not group:
            return True # No group limits
            
        if getattr(group, "credit_hold", False):
            raise HTTPException(
                status_code=400,
                detail="SMRITI-CREDIT-002: Customer account is on credit hold. Invoicing blocked."
            )

        if getattr(group, "unlimited_credit", False):
            return True
            
        # Assert outstanding + new purchase is within limit
        limit = float(getattr(group, "credit_limit", 0.0) or 0.0)
        current_outstanding = float(customer.outstanding or 0.0)
        if limit > 0 and (current_outstanding + new_amount > limit):
            if getattr(group, "auto_block_sales", True):
                raise HTTPException(
                    status_code=400, 
                    detail=f"SMRITI-CREDIT-001: Customer credit limit of ₹{limit:,.2f} exceeded. Current Balance: ₹{current_outstanding:,.2f}, New Invoice: ₹{new_amount:,.2f}. Sales blocked."
                )
            return False # Limit warning
        return True

