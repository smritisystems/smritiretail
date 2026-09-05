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
from ...api.deps import get_db, get_company_db, get_tenant_context, TenantContext, require_role, get_current_user

from ...models.auth import UserRole
from ...models.crm import Customer
from ...schemas.crm import (
    CustomerCreate, CustomerUpdate, CustomerResponse,
    CustomerGroupCreate, CustomerGroupUpdate, CustomerGroupResponse,
    CustomerGSTRegistrationCreate, CustomerGSTRegistrationUpdate, CustomerGSTRegistrationResponse,
    CustomerDeliveryLocationCreate, CustomerDeliveryLocationUpdate, CustomerDeliveryLocationResponse,
    CustomerBillingLocationCreate, CustomerBillingLocationUpdate, CustomerBillingLocationResponse,
    CustomerExternalIdentityCreate, CustomerExternalIdentityResponse,
    CustomerDuplicateCheckRequest, CustomerDuplicateCheckResponse,
)
from ...repositories.customer import CustomerRepository, CustomerGroupRepository
from ...services.crm import CrmService

router = APIRouter()


# --- Customer Identity & Duplicate Protection ---

@router.post(
    "/customers/check-duplicate",
    response_model=CustomerDuplicateCheckResponse,
    status_code=200,
)
async def check_customer_duplicate(
    payload: CustomerDuplicateCheckRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Authoritative duplicate detection check for Customer Master & integrations."""
    service = CrmService(db, tenant_ctx)
    return await service.identity_service.check_duplicate_customer(payload)


# --- Customer Endpoints ---

@router.post(
    "/customers",
    response_model=CustomerResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN, UserRole.CASHIER))],
)
async def create_customer(
    customer_in: CustomerCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new customer. CASHIER, MANAGER, and SYSADMIN may create customers."""
    service = CrmService(db, tenant_ctx)
    customer = await service.create_customer(customer_in)
    return CustomerResponse.from_orm_customer(customer)


class CustomerValidationRequest(BaseModel):
    customer: Dict[str, Any]
    existingCustomers: Optional[List[Dict[str, Any]]] = None


@router.post(
    "/customers/validate-add",
)
async def validate_customer_add(
    validation_request: CustomerValidationRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Validate a new customer payload before creation."""
    payload = validation_request.customer
    existing_customers = validation_request.existingCustomers or []

    # Normalize existing customer contacts
    seen_mobiles = set()
    seen_emails = set()
    for cust in existing_customers:
        m = str(cust.get("mobile") or "").strip().replace(" ", "").replace("-", "")
        if m:
            seen_mobiles.add(m)
        email = str(cust.get("email") or "").strip().lower()
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
    invoice_series: Optional[str] = Query(None, max_length=50),
    invoice_from: Optional[int] = Query(None, ge=0),
    invoice_to: Optional[int] = Query(None, ge=0),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    repo = CustomerRepository(db, tenant_ctx)
    customers = await repo.get_all(skip=skip, limit=limit, invoice_series=invoice_series, invoice_from=invoice_from, invoice_to=invoice_to)
    return [CustomerResponse.from_orm_customer(c) for c in customers]


@router.get("/customers/search", response_model=List[CustomerResponse])
async def search_customers(
    q: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    invoice_series: Optional[str] = Query(None, max_length=50),
    invoice_from: Optional[int] = Query(None, ge=0),
    invoice_to: Optional[int] = Query(None, ge=0),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    repo = CustomerRepository(db, tenant_ctx)
    customers = await repo.search(q=q, skip=skip, limit=limit, invoice_series=invoice_series, invoice_from=invoice_from, invoice_to=invoice_to)
    return [CustomerResponse.from_orm_customer(c) for c in customers]


@router.get("/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    repo = CustomerRepository(db, tenant_ctx)
    customer = await repo.get(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return CustomerResponse.from_orm_customer(customer)


@router.put("/customers/{customer_id}", response_model=CustomerResponse)
@router.patch("/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    customer_in: CustomerUpdate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update or upsert an existing customer."""
    service = CrmService(db, tenant_ctx)
    customer = await service.update_customer(customer_id, customer_in)
    return CustomerResponse.from_orm_customer(customer)


@router.put("/customers", response_model=CustomerResponse)
async def upsert_customer(
    customer_in: CustomerCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Upsert a customer record."""
    service = CrmService(db, tenant_ctx)
    target_id = customer_in.id or f"cust-{customer_in.name.lower().replace(' ', '-')[:20]}"
    customer = await service.update_customer(target_id, customer_in)
    return CustomerResponse.from_orm_customer(customer)


@router.delete("/customers/{customer_id}")
async def delete_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Soft delete a customer."""
    service = CrmService(db, tenant_ctx)
    await service.delete_customer(customer_id)
    return {"status": "success", "message": f"Customer '{customer_id}' deleted."}


# --- Customer Group Endpoints ---

@router.post(
    "/customer-groups",
    response_model=CustomerGroupResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_customer_group(
    group_in: CustomerGroupCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new customer group. Requires MANAGER or SYSADMIN role."""
    service = CrmService(db, tenant_ctx)
    return await service.create_customer_group(group_in)


@router.get("/customer-groups", response_model=List[CustomerGroupResponse])
async def list_customer_groups(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    repo = CustomerGroupRepository(db, tenant_ctx)
    return await repo.get_all(skip=skip, limit=limit)


@router.get("/customer-groups/{group_id}", response_model=CustomerGroupResponse)
async def get_customer_group(
    group_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    repo = CustomerGroupRepository(db, tenant_ctx)
    group = await repo.get(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Customer group not found")
    return group


# --- Customer GST Registration Endpoints ---

@router.get(
    "/customers/{customer_id}/gst-registrations",
    response_model=List[CustomerGSTRegistrationResponse],
)
async def list_customer_gst_registrations(
    customer_id: str,
    include_inactive: bool = Query(False, alias="includeInactive"),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all GST registrations for a customer."""
    service = CrmService(db, tenant_ctx)
    registrations = await service.list_gst_registrations(customer_id, include_inactive=include_inactive)
    return [CustomerGSTRegistrationResponse.model_validate(r) for r in registrations]


@router.post(
    "/customers/{customer_id}/gst-registrations",
    response_model=CustomerGSTRegistrationResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_customer_gst_registration(
    customer_id: str,
    reg_in: CustomerGSTRegistrationCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new multi-state GST registration for a customer. Requires MANAGER or SYSADMIN role."""
    service = CrmService(db, tenant_ctx)
    registration = await service.create_gst_registration(customer_id, reg_in)
    return CustomerGSTRegistrationResponse.model_validate(registration)


@router.get(
    "/customers/{customer_id}/gst-registrations/{reg_id}",
    response_model=CustomerGSTRegistrationResponse,
)
async def get_customer_gst_registration(
    customer_id: str,
    reg_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get a specific GST registration for a customer."""
    service = CrmService(db, tenant_ctx)
    registration = await service.get_gst_registration(customer_id, reg_id)
    return CustomerGSTRegistrationResponse.model_validate(registration)


@router.put(
    "/customers/{customer_id}/gst-registrations/{reg_id}",
    response_model=CustomerGSTRegistrationResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def update_customer_gst_registration(
    customer_id: str,
    reg_id: str,
    reg_in: CustomerGSTRegistrationUpdate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update a customer's GST registration. Requires MANAGER or SYSADMIN role."""
    service = CrmService(db, tenant_ctx)
    registration = await service.update_gst_registration(customer_id, reg_id, reg_in)
    return CustomerGSTRegistrationResponse.model_validate(registration)


@router.put(
    "/customers/{customer_id}/gst-registrations/{reg_id}/primary",
    response_model=CustomerGSTRegistrationResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
@router.patch(
    "/customers/{customer_id}/gst-registrations/{reg_id}/primary",
    response_model=CustomerGSTRegistrationResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def set_primary_customer_gst_registration(
    customer_id: str,
    reg_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Set a GST registration as the customer's primary registration. Requires MANAGER or SYSADMIN role."""
    service = CrmService(db, tenant_ctx)
    registration = await service.set_primary_gst_registration(customer_id, reg_id)
    return CustomerGSTRegistrationResponse.model_validate(registration)


@router.delete(
    "/customers/{customer_id}/gst-registrations/{reg_id}",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def delete_customer_gst_registration(
    customer_id: str,
    reg_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Soft-delete / deactivate a customer's GST registration. Requires MANAGER or SYSADMIN role."""
    service = CrmService(db, tenant_ctx)
    return await service.delete_gst_registration(customer_id, reg_id)


# --- Customer Delivery Location Endpoints ---

@router.get(
    "/delivery-locations/search",
    response_model=List[CustomerDeliveryLocationResponse],
    dependencies=[Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN, UserRole.REPORT_USER, UserRole.VIEWER))],
)
async def search_delivery_locations(
    q: Optional[str] = Query(None, description="Search by store code, location name, city, state, or PIN"),
    customer_id: Optional[str] = Query(None, alias="customerId", description="Optional customer filter"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Search delivery locations across the tenant company. Accessible by Cashiers and Managers."""
    service = CrmService(db, tenant_ctx)
    locations = await service.search_delivery_locations(q=q, customer_id=customer_id, skip=skip, limit=limit)
    return [CustomerDeliveryLocationResponse.model_validate(l) for l in locations]


@router.get(
    "/customers/{customer_id}/delivery-locations",
    response_model=List[CustomerDeliveryLocationResponse],
)
async def list_customer_delivery_locations(
    customer_id: str,
    include_inactive: bool = Query(False, alias="includeInactive"),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all delivery locations for a customer."""
    service = CrmService(db, tenant_ctx)
    locations = await service.list_delivery_locations(customer_id, include_inactive=include_inactive)
    return [CustomerDeliveryLocationResponse.model_validate(l) for l in locations]


@router.post(
    "/customers/{customer_id}/delivery-locations",
    response_model=CustomerDeliveryLocationResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_customer_delivery_location(
    customer_id: str,
    loc_in: CustomerDeliveryLocationCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new delivery location / store code for a customer. Requires MANAGER or SYSADMIN role."""
    service = CrmService(db, tenant_ctx)
    location = await service.create_delivery_location(customer_id, loc_in)
    return CustomerDeliveryLocationResponse.model_validate(location)


@router.get(
    "/customers/{customer_id}/delivery-locations/{location_id}",
    response_model=CustomerDeliveryLocationResponse,
)
async def get_customer_delivery_location(
    customer_id: str,
    location_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get a specific delivery location for a customer."""
    service = CrmService(db, tenant_ctx)
    location = await service.get_delivery_location(customer_id, location_id)
    return CustomerDeliveryLocationResponse.model_validate(location)


@router.put(
    "/customers/{customer_id}/delivery-locations/{location_id}",
    response_model=CustomerDeliveryLocationResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def update_customer_delivery_location(
    customer_id: str,
    location_id: str,
    loc_in: CustomerDeliveryLocationUpdate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update a customer delivery location. Requires MANAGER or SYSADMIN role."""
    service = CrmService(db, tenant_ctx)
    location = await service.update_delivery_location(customer_id, location_id, loc_in)
    return CustomerDeliveryLocationResponse.model_validate(location)


@router.delete(
    "/customers/{customer_id}/delivery-locations/{location_id}",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def delete_customer_delivery_location(
    customer_id: str,
    location_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Soft-delete / deactivate a customer delivery location. Requires MANAGER or SYSADMIN role."""
    service = CrmService(db, tenant_ctx)
    return await service.delete_delivery_location(customer_id, location_id)


@router.put(
    "/customers/{customer_id}/delivery-locations/{location_id}/default",
    response_model=CustomerDeliveryLocationResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN, UserRole.CASHIER))],
)
async def set_default_customer_delivery_location(
    customer_id: str,
    location_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Set a delivery location as the customer's active default shipping location."""
    service = CrmService(db, tenant_ctx)
    location = await service.set_default_delivery_location(customer_id, location_id)
    return CustomerDeliveryLocationResponse.model_validate(location)


# --- Customer Billing Locations Endpoints ---

@router.get(
    "/customers/{customer_id}/billing-locations",
    response_model=List[CustomerBillingLocationResponse],
)
async def list_customer_billing_locations(
    customer_id: str,
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all billing locations for a customer."""
    service = CrmService(db, tenant_ctx)
    locations = await service.list_billing_locations(customer_id, include_inactive=include_inactive)
    return [CustomerBillingLocationResponse.model_validate(loc) for loc in locations]


@router.post(
    "/customers/{customer_id}/billing-locations",
    response_model=CustomerBillingLocationResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN, UserRole.CASHIER))],
)
async def create_customer_billing_location(
    customer_id: str,
    loc_in: CustomerBillingLocationCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new billing location / billing store for a customer."""
    service = CrmService(db, tenant_ctx)
    location = await service.create_billing_location(customer_id, loc_in)
    return CustomerBillingLocationResponse.model_validate(location)


@router.get(
    "/customers/{customer_id}/billing-locations/{location_id}",
    response_model=CustomerBillingLocationResponse,
)
async def get_customer_billing_location(
    customer_id: str,
    location_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get a single customer billing location."""
    service = CrmService(db, tenant_ctx)
    location = await service.get_billing_location(customer_id, location_id)
    return CustomerBillingLocationResponse.model_validate(location)


@router.put(
    "/customers/{customer_id}/billing-locations/{location_id}",
    response_model=CustomerBillingLocationResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def update_customer_billing_location(
    customer_id: str,
    location_id: str,
    loc_in: CustomerBillingLocationUpdate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update a customer billing location."""
    service = CrmService(db, tenant_ctx)
    location = await service.update_billing_location(customer_id, location_id, loc_in)
    return CustomerBillingLocationResponse.model_validate(location)


@router.put(
    "/customers/{customer_id}/billing-locations/{location_id}/default",
    response_model=CustomerBillingLocationResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN, UserRole.CASHIER))],
)
async def set_default_customer_billing_location(
    customer_id: str,
    location_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Set a billing location as the customer's active default billing location."""
    service = CrmService(db, tenant_ctx)
    location = await service.set_default_billing_location(customer_id, location_id)
    return CustomerBillingLocationResponse.model_validate(location)


@router.delete(
    "/customers/{customer_id}/billing-locations/{location_id}",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def delete_customer_billing_location(
    customer_id: str,
    location_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Soft-delete a customer billing location."""
    service = CrmService(db, tenant_ctx)
    return await service.delete_billing_location(customer_id, location_id)


# --- Customer External Identities Endpoints ---

@router.get(
    "/customers/{customer_id}/external-identities",
    response_model=List[CustomerExternalIdentityResponse],
)
async def list_customer_external_identities(
    customer_id: str,
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all external identities mapped to this customer."""
    service = CrmService(db, tenant_ctx)
    identities = await service.list_external_identities(customer_id, include_inactive=include_inactive)
    return [CustomerExternalIdentityResponse.model_validate(ident) for ident in identities]


@router.post(
    "/customers/{customer_id}/external-identities",
    response_model=CustomerExternalIdentityResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN, UserRole.CASHIER))],
)
async def create_customer_external_identity(
    customer_id: str,
    ext_in: CustomerExternalIdentityCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Register an external ERP identity for a customer."""
    service = CrmService(db, tenant_ctx)
    identity = await service.create_external_identity(customer_id, ext_in)
    return CustomerExternalIdentityResponse.model_validate(identity)


@router.delete(
    "/customers/{customer_id}/external-identities/{identity_id}",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def delete_customer_external_identity(
    customer_id: str,
    identity_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Deactivate an external identity mapping."""
    service = CrmService(db, tenant_ctx)
    return await service.delete_external_identity(customer_id, identity_id)



# ---------------------------------------------------------------------------
# LYL-ADJ-001: Grant Bonus Points  (Sprint 19)
# POST /api/v1/crm/loyalty/members/{member_id}/bonus
# ---------------------------------------------------------------------------

from pydantic import BaseModel as _BaseModel

class LoyaltyAdjIn(_BaseModel):
    points: float
    reason: str
    reference_id: str = ""

@router.post("/loyalty/members/{member_id}/bonus", status_code=201)
async def grant_loyalty_bonus(
    member_id: str,
    body:      LoyaltyAdjIn,
    tenant:    TenantContext    = Depends(get_tenant_context),
    db:        AsyncSession     = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    LYL-ADJ-001 -- Grant BONUS points to a loyalty member.
    MANAGER role required. Points added to current_points_balance and
    a BONUS row written to loyalty_transactions.
    """
    role = (getattr(current_user, "role", "") or "").upper()
    if role not in ("ADMIN", "SYSADMIN", "SUPERADMIN", "MANAGER"):
        raise HTTPException(status_code=403, detail={
            "code": "SMRITI-PERM-001",
            "message": "Only managers or administrators can grant loyalty bonus points.",
        })
    if body.points <= 0:
        raise HTTPException(status_code=422, detail={
            "code": "SMRITI-VAL-001",
            "message": "Points must be greater than zero.",
        })

    from ...services.sales_hook import write_loyalty_bonus
    creator = getattr(current_user, "id", None) or "system"
    ok = await write_loyalty_bonus(
        db=db,
        member_id=member_id,
        company_id=tenant.company_id,
        branch_id=tenant.branch_id,
        points=body.points,
        reason=body.reason,
        reference_id=body.reference_id or f"BONUS-{member_id}",
        creator=creator,
    )
    await db.commit()
    if not ok:
        raise HTTPException(status_code=404, detail={
            "code": "SMRITI-DATA-001",
            "message": f"Loyalty member '{member_id}' not found or inactive.",
        })
    return {"member_id": member_id, "bonus_points": body.points, "status": "granted"}


# ---------------------------------------------------------------------------
# LYL-ADJ-002: Expire Points  (Sprint 19)
# POST /api/v1/crm/loyalty/members/{member_id}/expire
# ---------------------------------------------------------------------------

@router.post("/loyalty/members/{member_id}/expire", status_code=201)
async def expire_loyalty_points(
    member_id: str,
    body:      LoyaltyAdjIn,
    tenant:    TenantContext    = Depends(get_tenant_context),
    db:        AsyncSession     = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    LYL-ADJ-002 -- Expire / deduct points from a loyalty member.
    MANAGER role required. Points deducted from current_points_balance (floor 0)
    and an EXPIRY row written to loyalty_transactions.
    """
    role = (getattr(current_user, "role", "") or "").upper()
    if role not in ("ADMIN", "SYSADMIN", "SUPERADMIN", "MANAGER"):
        raise HTTPException(status_code=403, detail={
            "code": "SMRITI-PERM-001",
            "message": "Only managers or administrators can expire loyalty points.",
        })
    if body.points <= 0:
        raise HTTPException(status_code=422, detail={
            "code": "SMRITI-VAL-001",
            "message": "Points must be greater than zero.",
        })

    from ...services.sales_hook import write_loyalty_expiry
    creator = getattr(current_user, "id", None) or "system"
    ok = await write_loyalty_expiry(
        db=db,
        member_id=member_id,
        company_id=tenant.company_id,
        branch_id=tenant.branch_id,
        points=body.points,
        reason=body.reason,
        reference_id=body.reference_id or f"EXPIRY-{member_id}",
        creator=creator,
    )
    await db.commit()
    if not ok:
        raise HTTPException(status_code=404, detail={
            "code": "SMRITI-DATA-001",
            "message": f"Loyalty member '{member_id}' not found or inactive.",
        })
    return {"member_id": member_id, "expired_points": body.points, "status": "expired"}