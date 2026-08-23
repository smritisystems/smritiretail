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
* Modified   : 2026-08-23
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""


from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_tenant_context, require_role, TenantContext, get_current_user
from ...models.auth import UserRole, User
from ...schemas.pos import (
    CashRegisterCreate, CashRegisterResponse,
    POSProfileCreate, POSProfileResponse,
    ShiftOpen, ShiftClose, ShiftResponse, POSZReportResponse,
    ShiftCashInRequest, ShiftCashDropRequest, ShiftTillExpenseRequest, ShiftCashTransactionResponse,
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
    db: AsyncSession = Depends(get_company_db),
):
    """Create a new POS cash register. MANAGER or SYSADMIN only."""
    return await POSService(db, tenant).create_register(req)


@router.get(
    "/registers/",
    response_model=List[CashRegisterResponse],
    dependencies=[Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def list_registers(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """List all cash registers for the current tenant."""
    return await POSService(db, tenant).list_registers()


@router.get(
    "/registers/{register_id}",
    response_model=CashRegisterResponse,
    dependencies=[Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def get_register(
    register_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
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
    current_user: User = Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN)),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
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
    current_user: User = Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN)),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Close an open shift — canonical contract URL. Replaces /shifts/{id}/close (deprecated)."""
    return await POSService(db, tenant).close_shift(shift_id, req, current_user.id, requesting_user_role=current_user.role)


@router.post(
    "/pos/shifts/{shift_id}/cash-in",
    response_model=ShiftCashTransactionResponse,
    status_code=201,
    summary="Record Mid-Shift Cash In (Till Float Injection)",
    description="Records a cash injection from the main safe/vault into the register drawer, creating an automated double-entry GL journal voucher.",
)
@router.post(
    "/shifts/{shift_id}/cash-in",
    response_model=ShiftCashTransactionResponse,
    status_code=201,
    include_in_schema=False,
)
async def record_shift_cash_in(
    shift_id: str,
    req: ShiftCashInRequest,
    current_user: User = Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN)),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Record mid-shift cash injection into till and post GL transfer voucher."""
    return await POSService(db, tenant).record_cash_in(shift_id, req, current_user.id, requesting_user_role=current_user.role)


@router.post(
    "/pos/shifts/{shift_id}/cash-drop",
    response_model=ShiftCashTransactionResponse,
    status_code=201,
    summary="Record Mid-Shift Cash Drop",
    description="Records a cash transfer from the register drawer to the main safe or bank account, creating an automated double-entry GL journal voucher.",
)
@router.post(
    "/shifts/{shift_id}/cash-drop",
    response_model=ShiftCashTransactionResponse,
    status_code=201,
    include_in_schema=False,
)
async def record_shift_cash_drop(
    shift_id: str,
    req: ShiftCashDropRequest,
    current_user: User = Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN)),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Record mid-shift cash drop and post GL transfer voucher."""
    return await POSService(db, tenant).record_cash_drop(shift_id, req, current_user.id, requesting_user_role=current_user.role)


@router.post(
    "/pos/shifts/{shift_id}/till-expense",
    response_model=ShiftCashTransactionResponse,
    status_code=201,
    summary="Record Mid-Shift Till Expense",
    description="Records an immediate petty cash payout from the register drawer, creating an automated double-entry GL journal voucher.",
)
@router.post(
    "/shifts/{shift_id}/till-expense",
    response_model=ShiftCashTransactionResponse,
    status_code=201,
    include_in_schema=False,
)
async def record_shift_till_expense(
    shift_id: str,
    req: ShiftTillExpenseRequest,
    current_user: User = Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN)),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Record mid-shift till petty expense and post GL expense voucher."""
    return await POSService(db, tenant).record_till_expense(shift_id, req, current_user.id, requesting_user_role=current_user.role)


@router.get(
    "/pos/shifts/{shift_id}/z-report",
    response_model=POSZReportResponse,
    summary="Get Shift Z-Report",
    description="Returns comprehensive shift closing totals, cash drops, till expenses, physical denominations, tender variance breakdown, and linked GL voucher reference.",
)
@router.get(
    "/shifts/{shift_id}/z-report",
    response_model=POSZReportResponse,
    include_in_schema=False,
)
async def get_shift_z_report(
    shift_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN)),
):
    """Get authoritative Z-Report data for a shift."""
    return await POSService(db, tenant).get_z_report(shift_id)




@router.get(
    "/pos/shifts/active/{register_id}",
    response_model=ShiftResponse,
    summary="Get Active Shift (Contract URL)",
    description="Returns the currently OPEN shift for the given register. 404 if none.",
)
@router.get(
    "/shifts/active/{register_id}",
    response_model=ShiftResponse,
    summary="Get Active Shift",
    description="Returns the currently OPEN shift for the given register. 404 if none.",
    include_in_schema=False,
)
async def get_active_shift(
    register_id: str,
    db:           AsyncSession  = Depends(get_company_db),
    tenant:       TenantContext = Depends(get_tenant_context),
    current_user: User          = Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN)),
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
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN)),
):
    """
    Process a POS sale and persist it durably to PostgreSQL.
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

@router.post(
    "/pos/profiles/",
    response_model=POSProfileResponse,
    status_code=201,
    summary="Create POS Profile",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_pos_profile(
    req: POSProfileCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Create a new POS terminal profile (CashRegister with cashier/warehouse)."""
    reg = await POSService(db, tenant).create_profile(req)
    return POSProfileResponse.from_register(reg)


@router.get(
    "/pos/profiles/",
    response_model=List[POSProfileResponse],
    summary="List POS Profiles",
    dependencies=[Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def list_pos_profiles(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """List all active POS profiles for the current tenant."""
    registers = await POSService(db, tenant).list_registers()
    return [POSProfileResponse.from_register(r) for r in registers]


@router.post(
    "/pos/profiles/{profile_id}/clone",
    response_model=POSProfileResponse,
    status_code=201,
    summary="Clone POS Profile",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def clone_pos_profile(
    profile_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Clone an existing POS profile with (Copy) suffix."""
    clone = await POSService(db, tenant).clone_register(profile_id)
    return POSProfileResponse.from_register(clone)


@router.post(
    "/pos/profiles/{profile_id}/archive",
    response_model=POSProfileResponse,
    summary="Archive POS Profile",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def archive_pos_profile(
    profile_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Soft-delete a POS profile. Sets is_deleted=True, is_active=False."""
    reg = await POSService(db, tenant).archive_register(profile_id)
    return POSProfileResponse.from_register(reg)


@router.post(
    "/pos/profiles/{profile_id}/toggle-lock",
    response_model=POSProfileResponse,
    summary="Toggle Lock POS Profile",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def toggle_lock_pos_profile(
    profile_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
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
    dependencies=[Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def list_shifts(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    """List all shifts for this tenant, newest first."""
    return await POSService(db, tenant).list_shifts()

