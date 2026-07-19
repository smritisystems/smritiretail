"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.26.0
Created      : 2026-07-11
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import TenantContext, get_db, get_tenant_context, require_permission
from ...models.crm import Customer
from ...repositories.customer import CustomerGroupRepository, CustomerRepository, PricingGroupRepository
from ...schemas.crm import (
    CustomerCreate,
    CustomerGroupCreate,
    CustomerGroupResponse,
    CustomerResponse,
    PricingGroupCreate,
    PricingGroupResponse,
    PricingGroupUpdate,
)
from ...services.crm import CrmService

router = APIRouter()


# ---------------------------------------------------------------------------
# Customer Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/customers",
    response_model=CustomerResponse,
    status_code=201,
    dependencies=[Depends(require_permission("CRM.MANAGE_CUSTOMERS"))],
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
    customer: dict[str, Any]
    existingCustomers: list[dict[str, Any]] | None = None  # noqa: N815


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

    seen_mobiles: set = set()
    seen_emails: set = set()
    for cust in existing_customers:
        mobile = str(cust.get("mobile") or cust.get("phone") or "").strip()
        email = str(cust.get("email") or "").strip().lower()
        if mobile:
            seen_mobiles.add(mobile)
        if email:
            seen_emails.add(email)

    stmt = select(Customer).filter(
        not Customer.is_deleted,
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

    errors: list[str] = []
    warnings: list[str] = []

    name = str(payload.get("name") or "").strip()
    mobile = str(payload.get("mobile") or "").strip()
    email = str(payload.get("email") or "").strip().lower()
    customer_group_id = str(
        payload.get("customer_group_id") or payload.get("customerGroupId") or ""
    ).strip()

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
        warnings.append(
            "No email address provided. This is recommended for customer follow-up."
        )

    if not customer_group_id:
        errors.append("Customer group selection is required.")

    valid = len(errors) == 0
    return {"valid": valid, "errors": errors, "warnings": warnings}


@router.get("/customers", response_model=list[CustomerResponse])
async def list_customers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    repo = CustomerRepository(db, tenant_ctx)
    return await repo.get_all(skip=skip, limit=limit)


@router.get("/customers/search", response_model=list[CustomerResponse])
async def search_customers(
    q: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    repo = CustomerRepository(db, tenant_ctx)
    return await repo.search(q=q, skip=skip, limit=limit)


@router.get("/customers/{customer_id}/resolve-pricing")
async def resolve_customer_pricing(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Price Engine integration endpoint.

    Returns the effective pricing parameters for a customer based on their
    assigned PricingGroup (or system defaults if none is assigned).

    The sales invoice and POS pipeline call this to determine:
    base_price_field, discount_percent, price_adjustment, rounding_rule,
    max_additional_discount_percent, scheme_eligible, quantity_break_eligible.

    Flow:  Customer → PricingGroup → Price Engine → Discount Engine → GST Engine → Invoice
    """
    service = CrmService(db, tenant_ctx)
    return await service.resolve_customer_pricing(customer_id)


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


# ---------------------------------------------------------------------------
# CustomerGroup Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/customer-groups",
    response_model=CustomerGroupResponse,
    status_code=201,
    dependencies=[Depends(require_permission("CRM.MANAGE_CUSTOMERS"))],
)
async def create_customer_group(
    group_in: CustomerGroupCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Create a new Customer Group.  MANAGER or SYSADMIN only.

    CustomerGroup classifies customers for business segmentation, credit policy,
    reporting, and marketing.  It answers: 'What TYPE of customer is this?'

    Examples: Retailer | Distributor | Corporate | Government | VIP | Employee
    """
    service = CrmService(db, tenant_ctx)
    return await service.create_customer_group(group_in)


@router.get("/customer-groups", response_model=list[CustomerGroupResponse])
async def list_customer_groups(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all Customer Groups for the current tenant."""
    repo = CustomerGroupRepository(db, tenant_ctx)
    return await repo.get_all(skip=skip, limit=limit)


@router.get("/customer-groups/{group_id}", response_model=CustomerGroupResponse)
async def get_customer_group(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Fetch a single Customer Group by ID."""
    repo = CustomerGroupRepository(db, tenant_ctx)
    group = await repo.get(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Customer group not found")
    return group


# ---------------------------------------------------------------------------
# PricingGroup Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/pricing-groups",
    response_model=PricingGroupResponse,
    status_code=201,
    dependencies=[Depends(require_permission("CRM.MANAGE_CUSTOMERS"))],
)
async def create_pricing_group(
    group_in: PricingGroupCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Create a new Pricing Group.  MANAGER or SYSADMIN only.

    PricingGroup controls commercial pricing strategy independently of the
    CustomerGroup classification.  It answers: 'Which price list applies?'

    Examples: Retail Price | Distributor Price | VIP Price | Festival Price | Employee Price

    A customer of group 'Retailer' can have any PricingGroup — this flexibility
    is the key reason the two masters are kept separate.
    """
    service = CrmService(db, tenant_ctx)
    return await service.create_pricing_group(group_in)


@router.get("/pricing-groups", response_model=list[PricingGroupResponse])
async def list_pricing_groups(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all Pricing Groups for the current tenant."""
    repo = PricingGroupRepository(db, tenant_ctx)
    return await repo.get_all(skip=skip, limit=limit)


@router.get("/pricing-groups/{group_id}", response_model=PricingGroupResponse)
async def get_pricing_group(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Fetch a single Pricing Group by ID."""
    repo = PricingGroupRepository(db, tenant_ctx)
    group = await repo.get(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Pricing group not found")
    return group


@router.put(
    "/pricing-groups/{group_id}",
    response_model=PricingGroupResponse,
    dependencies=[Depends(require_permission("CRM.MANAGE_CUSTOMERS"))],
)
async def update_pricing_group(
    group_id: str,
    group_in: PricingGroupUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update the commercial pricing parameters of a Pricing Group."""
    service = CrmService(db, tenant_ctx)
    return await service.update_pricing_group(group_id, group_in)


@router.delete(
    "/pricing-groups/{group_id}",
    dependencies=[Depends(require_permission("CRM.MANAGE_CUSTOMERS"))],
)
async def delete_pricing_group(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Soft-delete a Pricing Group.

    Customers whose pricing_group_id pointed to this group will have that FK
    set to NULL automatically (ON DELETE SET NULL), so they fall back to system
    default pricing until a new group is assigned.
    """
    repo = PricingGroupRepository(db, tenant_ctx)
    group = await repo.get(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Pricing group not found")
    await repo.soft_delete(group)
    return {"success": True, "message": "Pricing group deleted successfully"}
