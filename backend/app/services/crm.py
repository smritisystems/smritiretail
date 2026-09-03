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

from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
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
        cust_dict = customer_in.model_dump()
        target_id = cust_dict.get("id")

        # 1. Check if customer with this ID already exists
        if target_id:
            existing_by_id = await self.db.execute(
                select(Customer).filter(
                    Customer.id == target_id,
                    Customer.is_deleted == False,
                    (Customer.company_id == self.tenant_ctx.company_id) | (Customer.company_id.is_(None)),
                )
            )
            existing_cust = existing_by_id.scalars().first()
            if existing_cust:
                for k, v in cust_dict.items():
                    if v is not None and hasattr(existing_cust, k):
                        setattr(existing_cust, k, v)
                existing_cust.company_id = self.tenant_ctx.company_id or existing_cust.company_id
                existing_cust.branch_id = self.tenant_ctx.branch_id or existing_cust.branch_id
                existing_cust.modified_at = datetime.utcnow()
                await self.db.commit()
                await self.db.refresh(existing_cust)
                return existing_cust

        # 2. Check for duplicate mobile
        if customer_in.mobile:
            existing_mobile = await self.db.execute(
                select(Customer).filter(
                    Customer.mobile == customer_in.mobile,
                    Customer.is_deleted == False,
                    (Customer.company_id == self.tenant_ctx.company_id) | (Customer.company_id.is_(None)),
                )
            )
            mobile_cust = existing_mobile.scalars().first()
            if mobile_cust:
                raise HTTPException(
                    status_code=400,
                    detail="Customer with this mobile number already exists",
                )

        # 3. Validate customer group exists if specified, or auto-assign/create default group
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
                cust_dict["customer_group_id"] = None

        if not cust_dict.get("id"):
            import uuid
            cust_dict["id"] = f"cust-{uuid.uuid4().hex[:8]}"
        if not cust_dict.get("code"):
            import uuid
            cust_dict["code"] = f"CUST-{uuid.uuid4().hex[:8].upper()}"

        # Clean virtual policy fields before database column instantiation
        cust_dict.pop("credit_limit", None)
        cust_dict.pop("credit_days", None)
        cust_dict.pop("unlimited_credit", None)
        cust_dict.pop("credit_hold", None)

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
            # If conflict occurred concurrently, attempt fetch and return
            existing = await self.get_customer(cust_dict["id"])
            if existing:
                return existing
            raise HTTPException(
                status_code=400,
                detail="Customer could not be created due to database integrity constraints."
            )
        # Eagerly load customer with group relationship before returning for response serialization
        refreshed = await self.get_customer(db_customer.id)
        return refreshed or db_customer

    async def update_customer(self, customer_id: str, customer_in: CustomerUpdate | CustomerCreate | dict) -> Customer:
        stmt = select(Customer).options(selectinload(Customer.group)).filter(
            Customer.id == customer_id,
            Customer.is_deleted == False,
        )
        if self.tenant_ctx.company_id:
            stmt = stmt.filter((Customer.company_id == self.tenant_ctx.company_id) | (Customer.company_id.is_(None)))
        res = await self.db.execute(stmt)
        customer = res.scalars().first()

        data_dict = customer_in.model_dump(exclude_unset=True) if hasattr(customer_in, "model_dump") else dict(customer_in)

        if not customer:
            # Upsert create if not found
            create_payload = {**data_dict, "id": customer_id}
            if not create_payload.get("name"):
                create_payload["name"] = f"Customer {customer_id}"
            return await self.create_customer(CustomerCreate(**create_payload))

        for k, v in data_dict.items():
            if v is not None and hasattr(customer, k):
                setattr(customer, k, v)

        customer.modified_at = datetime.utcnow()
        await self.db.commit()
        refreshed = await self.get_customer(customer.id)
        return refreshed or customer

    async def delete_customer(self, customer_id: str) -> bool:
        stmt = select(Customer).filter(
            Customer.id == customer_id,
            Customer.is_deleted == False,
        )
        if self.tenant_ctx.company_id:
            stmt = stmt.filter((Customer.company_id == self.tenant_ctx.company_id) | (Customer.company_id.is_(None)))
        res = await self.db.execute(stmt)
        customer = res.scalars().first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        customer.is_deleted = True
        customer.modified_at = datetime.utcnow()
        await self.db.commit()
        return True

    async def get_customer(self, customer_id: str) -> Optional[Customer]:
        stmt = (
            select(Customer)
            .options(selectinload(Customer.group))
            .filter(
                Customer.id == customer_id,
                Customer.is_deleted == False,
            )
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

