"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.17.1 (Phase 1 — POS Checkout)
* Created    : 2026-07-11
* Modified   : 2026-07-15 (Phase 1 — POS Checkout migration)
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""


from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_tenant_context, require_role, TenantContext, get_current_user
from ...models.auth import UserRole, User
from ...schemas.pos import (
    CashRegisterCreate, CashRegisterResponse,
    POSProfileCreate, POSProfileResponse,
    ShiftOpen, ShiftClose, ShiftResponse,
    POSCheckoutRequest, POSCheckoutResponse,
)
from ...services.pos import POSService

router = APIRouter()

# ─────────────────────────── Cash Registers ───────────────────────────

@router.post(
    "/registers/",
    response_model=CashRegisterResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_register(
    req: CashRegisterCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """Create a new POS cash register. MANAGER or SYSADMIN only."""
    return await POSService(db, tenant).create_register(req)


@router.get("/registers/", response_model=List[CashRegisterResponse])
async def list_registers(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """List all cash registers for the current tenant."""
    return await POSService(db, tenant).list_registers()


@router.get("/registers/{register_id}", response_model=CashRegisterResponse)
async def get_register(
    register_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific cash register."""
    return await POSService(db, tenant).get_register(register_id)



# ─────────────────────────── Shifts — Contract URL Aliases (Phase 4A) ───────────────────────────
# Contract URLs per frontend PAL: /pos/shifts/open and /pos/shifts/close/{shift_id}
# These are the canonical URLs. The legacy /shifts/open and /shifts/{id}/close are deprecated.

@router.post(
    "/pos/shifts/open",
    response_model=ShiftResponse,
    status_code=201,
    summary="Open Shift (Contract URL)",
)
async def open_shift_contract(
    req: ShiftOpen,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """Open a new shift — canonical contract URL. Replaces /shifts/open (deprecated)."""
    return await POSService(db, tenant).open_shift(req, cashier_id=current_user.id)


@router.post(
    "/pos/shifts/close/{shift_id}",
    response_model=ShiftResponse,
    summary="Close Shift (Contract URL)",
)
async def close_shift_contract(
    shift_id: str,
    req: ShiftClose,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """Close an open shift — canonical contract URL. Replaces /shifts/{id}/close (deprecated)."""
    return await POSService(db, tenant).close_shift(shift_id, req, current_user.id)


@router.get(
    "/shifts/active/{register_id}",
    response_model=ShiftResponse,
    summary="Get Active Shift",
    description="Returns the currently OPEN shift for the given register. 404 if none.",
)
async def get_active_shift(
    register_id: str,
    db:           AsyncSession  = Depends(get_db),
    tenant:       TenantContext = Depends(get_tenant_context),
    current_user: User          = Depends(get_current_user),
):
    """Get the currently open shift for a register."""
    return await POSService(db, tenant).get_active_shift(register_id)



@router.post(
    "/pos/checkout",
    response_model=POSCheckoutResponse,
    status_code=200,
)
async def pos_checkout(
    req: POSCheckoutRequest,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Process a POS sale and persist it durably to PostgreSQL.

    Replaces the Express in-memory `bills[]` array (HOTFIX: data lost on restart).

    - invoice_no acts as the idempotency key: submitting the same invoice_no
      twice returns the existing record (cached=True) without duplicate stock deduction.
    - Shift must be OPEN; stock is deducted and a StockMovement logged per item.
    - Bill-level discount (flat or percent) is applied server-side.
    """
    result = await POSService(db, tenant).pos_checkout(req)
    inv = result["invoice"]
    return POSCheckoutResponse(
        success=True,
        cached=result["cached"],
        invoice_no=inv.invoice_no,
        invoice_id=inv.id,
        grand_total=inv.grand_total,
        tax_total=inv.tax_total,
        payment_mode=inv.payment_mode,
        shift_id=inv.shift_id,
    )

# ─────────────────────────── POS Profiles (v3.22.0) ───────────────────────────
# Frontend POSProfile <-> FastAPI CashRegister mapping.
# Satisfies the ARCH-DEBT(v3.22.0) markers in PosProfilesTab.tsx.

@router.post(
    "/pos/profiles/",
    response_model=POSProfileResponse,
    status_code=201,
    summary="Create POS Profile",
)
async def create_pos_profile(
    req: POSProfileCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """Create a new POS terminal profile (CashRegister with cashier/warehouse)."""
    reg = await POSService(db, tenant).create_profile(req)
    return POSProfileResponse.from_register(reg)


@router.get(
    "/pos/profiles/",
    response_model=List[POSProfileResponse],
    summary="List POS Profiles",
)
async def list_pos_profiles(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """List all active POS profiles for the current tenant."""
    registers = await POSService(db, tenant).list_registers()
    return [POSProfileResponse.from_register(r) for r in registers]


@router.post(
    "/pos/profiles/{profile_id}/clone",
    response_model=POSProfileResponse,
    status_code=201,
    summary="Clone POS Profile",
)
async def clone_pos_profile(
    profile_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """Clone an existing POS profile with (Copy) suffix."""
    clone = await POSService(db, tenant).clone_register(profile_id)
    return POSProfileResponse.from_register(clone)


@router.post(
    "/pos/profiles/{profile_id}/archive",
    response_model=POSProfileResponse,
    summary="Archive POS Profile",
)
async def archive_pos_profile(
    profile_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a POS profile. Sets is_deleted=True, is_active=False."""
    reg = await POSService(db, tenant).archive_register(profile_id)
    return POSProfileResponse.from_register(reg)


@router.post(
    "/pos/profiles/{profile_id}/toggle-lock",
    response_model=POSProfileResponse,
    summary="Toggle Lock POS Profile",
)
async def toggle_lock_pos_profile(
    profile_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """Flip the is_locked flag of a POS profile terminal."""
    reg = await POSService(db, tenant).toggle_lock_register(profile_id)
    return POSProfileResponse.from_register(reg)


# ─────────────────────────── Shifts - List (v3.22.0) ───────────────────────────

@router.get(
    "/pos/shifts/",
    response_model=List[ShiftResponse],
    summary="List All Shifts",
    description="List the 100 most recent shifts for this tenant.",
)
async def list_shifts(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all shifts for this tenant, newest first."""
    return await POSService(db, tenant).list_shifts()

