"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-09-11
Modified     : 2026-09-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import date
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
from ...schemas.vendor_statement import VendorStatementResponse
from ...schemas.tds import (
    TdsCalculationRequest,
    TdsCalculationResult,
    TdsVendorSummaryResponse,
)
from ...services.vendor_svc import VendorService
from ...services.vendor_code_allocator import allocate_next_vendor_code
from ...services.unified_ledger import UnifiedAccountingLedgerService
from ...services.tds_engine import StatutoryTdsEngine
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
    status: Optional[str] = Query(None, description="Filter by vendor status (e.g. ACTIVE, INACTIVE, BLOCKED, ON_HOLD, PENDING_VERIFICATION, ARCHIVED, MERGED, or ALL). Defaults to active/operational vendors (excludes ARCHIVED and MERGED)."),
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
    lookup_type = await control_db.scalar(
        select(MasterType).where(MasterType.code == "vendor_code")
    )
    if not lookup_type:
        raise HTTPException(status_code=404, detail="Vendor Code master lookup is not configured.")

    vendor_code = (req.code or "").strip().upper()
    if not vendor_code:
        existing_codes = await control_db.scalars(
            select(MasterValue.code).where(
                MasterValue.master_type_id == lookup_type.id,
                MasterValue.is_deleted.is_(False),
            )
        )
        vendor_code = allocate_next_vendor_code(existing_codes.all())
        control_db.add(
            MasterValue(
                master_type_id=lookup_type.id,
                company_id=getattr(tenant, "company_id", None),
                branch_id=getattr(tenant, "branch_id", None),
                code=vendor_code,
                name=vendor_code,
                data={"allocation": "AUTO", "format": "V-[0-9A-Z]{3}"},
                active=True,
                sort_order=0,
                is_deleted=False,
            )
        )
        await control_db.commit()

    governed_code = None
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


@router.get(
    "/{vendor_id}/statement",
    response_model=VendorStatementResponse,
    summary="Get Vendor Statement of Account (Subledger Audit)",
)
async def get_vendor_statement(
    vendor_id: str,
    from_date: Optional[date] = Query(None, description="Start date for statement period (YYYY-MM-DD)"),
    to_date: Optional[date] = Query(None, description="End date for statement period (YYYY-MM-DD)"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """
    Retrieves the authoritative Vendor Statement of Account (Subledger Audit)
    for Account 2010 (Accounts Payable) and Account 2050 (Supplier Advances).
    Computes opening balances, running transaction ledger lines, and unallocated advance balances.
    """
    return await UnifiedAccountingLedgerService.get_vendor_statement_of_account(
        session=db,
        company_id=tenant.company_id,
        supplier_id=vendor_id,
        from_date=from_date,
        to_date=to_date,
        branch_id=tenant.branch_id,
    )


@router.post(
    "/tds/calculate",
    response_model=TdsCalculationResult,
    summary="Calculate Statutory TDS Withholding Preview",
)
async def calculate_tds(
    req: TdsCalculationRequest,
    tenant: TenantContext = Depends(get_tenant_context),
):
    """
    Computes statutory TDS withholding preview under Indian Income Tax Act, 1961
    (Sections 194Q, 194C, 194J, 194H) applying PAN validity and Section 206AA penal rates.
    """
    return StatutoryTdsEngine.calculate_tds(
        gross_amount=req.gross_amount,
        section=req.section,
        pan=req.pan,
        is_company_or_firm=req.is_company_or_firm,
        custom_rate=req.custom_rate,
    )


@router.get(
    "/{vendor_id}/tds-summary",
    response_model=TdsVendorSummaryResponse,
    summary="Get Statutory Vendor TDS Summary (Account 2030 Audit)",
)
async def get_vendor_tds_summary(
    vendor_id: str,
    financial_year: Optional[str] = Query(None, description="Financial Year (e.g. 2026-27)"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """
    Retrieves the statutory TDS withholding summary for a vendor:
    PAN validity check, active section/rate, cumulative FY purchases, Section 194Q threshold status,
    and cumulative TDS withheld under Account 2030.
    """
    return await UnifiedAccountingLedgerService.get_vendor_tds_summary(
        session=db,
        company_id=tenant.company_id,
        supplier_id=vendor_id,
        financial_year=financial_year,
    )

