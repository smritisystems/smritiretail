"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-09-11
Modified     : 2026-09-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..deps import get_company_db, get_db, get_tenant_context, require_role, TenantContext
from ...models.auth import UserRole
from ...models.master_lookup import MasterType, MasterValue
from ...schemas.vendor import (
    VendorSummary,
    VendorDetail,
    VendorCreateRequest,
    VendorUpdateRequest,
    VendorMergeRequest,
    VendorMergeResponse,
)
from ...services.vendor_svc import VendorService
from ...core.governance import smriti_capability

router = APIRouter(prefix="/vendors", tags=["Vendor 360 & Universal Party"])
smriti_capability(
    entity="vendor",
    capability="vendor.api",
    role="CANONICAL",
    description="Canonical REST API endpoints for Vendor 360",
    decision_id="ADR-VEND-01",
)(router)


@router.get(
    "/",
    response_model=List[VendorSummary],
    summary="List Vendors (Universal Party Master)",
)
async def list_vendors(
    search: Optional[str] = Query(None, description="Search by name, code, GSTIN, PAN, or mobile"),
    status: Optional[str] = Query(None, description="Filter by vendor status"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Lists vendor summaries with operational statuses, classifications, and payables."""
    # VendorService also enforces Party.party_code uniqueness at the company DB
    # boundary; the control-plane check above ensures the code is governed.
    service = VendorService(db, tenant)
    return await service.list_vendors(
        search=search,
        status_filter=status,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/",
    response_model=VendorDetail,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
    summary="Create Vendor (Atomic Universal Party Creation)",
)
async def create_vendor(
    req: VendorCreateRequest,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    control_db: AsyncSession = Depends(get_db),
):
    """
    Atomically creates a Vendor with Universal Party identity, SUPPLIER role,
    statutory compliance, addresses, categorized contacts, and bank accounts.
    Maintains backward-compatible non-destructive projection into legacy suppliers.
    """
    vendor_code = (req.code or "").strip().upper()
    if not vendor_code:
        raise HTTPException(status_code=400, detail="Vendor Code must be selected from System Lookups.")

    lookup_type = await control_db.scalar(
        select(MasterType).where(MasterType.code == "vendor_code")
    )
    governed_code = None
    if lookup_type:
        governed_code = await control_db.scalar(
            select(MasterValue).where(
                MasterValue.master_type_id == lookup_type.id,
                MasterValue.code == vendor_code,
                MasterValue.active.is_(True),
                MasterValue.is_deleted.is_(False),
            )
        )
    if not governed_code:
        raise HTTPException(
            status_code=400,
            detail=f"Vendor Code '{vendor_code}' is not an active System Lookup value.",
        )

    req.code = vendor_code
    service = VendorService(db, tenant)
    return await service.create_vendor(req)


@router.get(
    "/{vendor_id}",
    response_model=VendorDetail,
    summary="Get Vendor 360 Details",
)
async def get_vendor_details(
    vendor_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Retrieves full Vendor 360 detail contract by Universal Party ID or legacy supplier code."""
    service = VendorService(db, tenant)
    return await service.get_vendor_by_id(vendor_id)


@router.put(
    "/{vendor_id}",
    response_model=VendorDetail,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
    summary="Update Vendor Profile & Statutory Coordinates",
)
async def update_vendor(
    vendor_id: str,
    req: VendorUpdateRequest,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Partially updates vendor profile, MSME, TDS, contacts, and syncs legacy projection."""
    service = VendorService(db, tenant)
    return await service.update_vendor(vendor_id, req)


@router.post(
    "/merge",
    response_model=VendorMergeResponse,
    dependencies=[Depends(require_role(UserRole.SYSADMIN))],
    summary="Merge Duplicate Vendors",
)
async def merge_vendors(
    req: VendorMergeRequest,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """
    Safely merges secondary vendor into primary vendor with auditable migration ledger.
    Never physically deletes historical transactional data.
    """
    service = VendorService(db, tenant)
    return await service.merge_vendors(req)
