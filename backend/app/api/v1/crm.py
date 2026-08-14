"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.9.0
Created      : 2026-07-11
Modified     : 2026-07-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ...api.deps import get_db, get_tenant_context, TenantContext, require_role
from ...models.auth import UserRole
from ...models.crm import Customer
from ...schemas.crm import (
    CustomerCreate, CustomerResponse,
    CustomerGroupCreate, CustomerGroupResponse,
)
from ...repositories.customer import CustomerRepository, CustomerGroupRepository
from ...services.crm import CrmService

router = APIRouter()


# --- Customer Endpoints ---

@router.post(
    "/customers",
    response_model=CustomerResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN, UserRole.CASHIER))],
)
async def create_customer(
    customer_in: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new customer. CASHIER, MANAGER, and SYSADMIN may create customers."""
    service = CrmService(db, tenant_ctx)
    return await service.create_customer(customer_in)


class CustomerValidationRequest(BaseModel):
    customer: Dict[str, Any]
    existingCustomers: Optional[List[Dict[str, Any]]] = None


@router.post(
    "/customers/validate-add",
)
async def validate_customer_add(
    validation_request: CustomerValidationRequest,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Validate a new customer payload before creation."""
    payload = validation_request.customer
    existing_customers = validation_request.existingCustomers or []

    # Normalize existing customer contacts
    seen_mobiles = set()
    seen_emails = set()
    for cust in existing_customers:
        mobile = str(cust.get("mobile") or cust.get("phone") or "").strip()
        email = str(cust.get("email") or "").strip().lower()
        if mobile:
            seen_mobiles.add(mobile)
        if email:
            seen_emails.add(email)

    stmt = select(Customer).filter(
        Customer.is_deleted == False,
        Customer.company_id == tenant_ctx.company_id,
        Customer.branch_id == tenant_ctx.branch_id,
    )
    res = await db.execute(stmt)
    for cust in res.scalars().all():
        mobile = str(cust.mobile or "").strip()
        email = str(cust.email or "").strip().lower()
        if mobile:
            seen_mobiles.add(mobile)
        if email:
            seen_emails.add(email)

    errors: List[str] = []
    warnings: List[str] = []

    name = str(payload.get("name") or "").strip()
    mobile = str(payload.get("mobile") or "").strip()
    email = str(payload.get("email") or "").strip().lower()
    customer_group_id = str(payload.get("customer_group_id") or payload.get("customerGroupId") or "").strip()

    if not name:
        errors.append("Customer name is required.")
    if not mobile:
        errors.append("Mobile number is required.")
    else:
        clean_mobile = mobile.replace(" ", "").replace("-", "")
        if not clean_mobile.isdigit() or len(clean_mobile) != 10:
            errors.append("Mobile number must be exactly 10 digits.")
        elif clean_mobile in seen_mobiles:
            errors.append(f"Mobile number '{mobile}' is already registered.")

    if email:
        if "@" not in email or "." not in email:
            errors.append("Email address format is invalid.")
        elif email in seen_emails:
            errors.append(f"Email address '{email}' is already registered.")
    else:
        warnings.append("No email address provided. This is recommended for customer follow-up.")

    if not customer_group_id:
        errors.append("Customer group selection is required.")

    valid = len(errors) == 0
    return {"valid": valid, "errors": errors, "warnings": warnings}


@router.get("/customers", response_model=List[CustomerResponse])
async def list_customers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    repo = CustomerRepository(db, tenant_ctx)
    return await repo.get_all(skip=skip, limit=limit)


@router.get("/customers/search", response_model=List[CustomerResponse])
async def search_customers(
    q: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    repo = CustomerRepository(db, tenant_ctx)
    return await repo.search(q=q, skip=skip, limit=limit)


@router.get("/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    repo = CustomerRepository(db, tenant_ctx)
    customer = await repo.get(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


# --- Customer Group Endpoints ---

@router.post(
    "/customer-groups",
    response_model=CustomerGroupResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_customer_group(
    group_in: CustomerGroupCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new customer group. Requires MANAGER or SYSADMIN role."""
    service = CrmService(db, tenant_ctx)
    return await service.create_customer_group(group_in)


@router.get("/customer-groups", response_model=List[CustomerGroupResponse])
async def list_customer_groups(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    repo = CustomerGroupRepository(db, tenant_ctx)
    return await repo.get_all(skip=skip, limit=limit)


@router.get("/customer-groups/{group_id}", response_model=CustomerGroupResponse)
async def get_customer_group(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    repo = CustomerGroupRepository(db, tenant_ctx)
    group = await repo.get(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Customer group not found")
    return group
