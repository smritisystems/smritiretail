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


from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from ...api.deps import get_company_db, get_tenant_context, require_role, TenantContext, get_current_user
from ...models.auth import UserRole, User
from ...models.pos import POSParkedCart, POSShiftDenominationCount
from ...models.sales import InvoiceCustomerChangeLog
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


@router.put(
    "/pos/profiles/{profile_id}",
    response_model=POSProfileResponse,
    summary="Update POS Profile",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def update_pos_profile(
    profile_id: str,
    req: POSProfileCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Update an existing POS terminal profile."""
    reg = await POSService(db, tenant).update_profile(profile_id, req)
    return POSProfileResponse.from_register(reg)


@router.delete(
    "/pos/profiles/{profile_id}",
    response_model=POSProfileResponse,
    summary="Delete POS Profile",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def delete_pos_profile(
    profile_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    """Soft-delete a POS profile."""
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


# ─────────────────────────── F12 Park & Recall Carts (v6.30.0) ───────────────────────────

@router.post(
    "/pos/parked-carts",
    summary="Park Active POS Cart (F12)",
    description="Parks in-progress transaction with 4-hour automatic expiration window.",
    dependencies=[Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def park_cart(
    payload: Dict[str, Any],
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    expiration_hours = int(payload.get("expiration_hours", 4))
    expires_at = now + timedelta(hours=expiration_hours)

    slip_no = payload.get("hold_slip_number")
    if not slip_no:
        date_str = now.strftime("%Y%m%d")
        rand_suffix = uuid.uuid4().hex[:4].upper()
        slip_no = f"HOLD-{date_str}-{rand_suffix}"

    parked_cart = POSParkedCart(
        id=f"park-{uuid.uuid4().hex[:12]}",
        tenant_id=tenant.tenant_id,
        company_id=tenant.company_id,
        branch_id=payload.get("branch_id", "BR-001"),
        session_id=payload.get("session_id", "SESSION-DEFAULT"),
        cashier_id=payload.get("cashier_id") or getattr(current_user, "id", "cashier-1"),
        hold_slip_number=slip_no,
        customer_id=payload.get("customer_id"),
        customer_name=payload.get("customer_name"),
        customer_phone=payload.get("customer_phone"),
        items_count=int(payload.get("items_count", 0)),
        total_amount=float(payload.get("total_amount", 0.00)),
        cart_snapshot=payload.get("cart_snapshot", {}),
        status="PARKED",
        parked_at=now,
        expires_at=expires_at,
    )
    db.add(parked_cart)
    await db.commit()
    await db.refresh(parked_cart)
    return {
        "status": "SUCCESS",
        "id": parked_cart.id,
        "hold_slip_number": parked_cart.hold_slip_number,
        "parked_at": parked_cart.parked_at.isoformat(),
        "expires_at": parked_cart.expires_at.isoformat(),
        "items_count": parked_cart.items_count,
        "total_amount": float(parked_cart.total_amount),
    }


@router.get(
    "/pos/parked-carts",
    summary="List Active Parked Carts",
    description="Lists active, non-expired parked carts for the current tenant and branch.",
    dependencies=[Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def list_active_parked_carts(
    branch_id: Optional[str] = Query(None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    now = datetime.now(timezone.utc)
    query = select(POSParkedCart).where(
        and_(
            POSParkedCart.company_id == tenant.company_id,
            POSParkedCart.status == "PARKED",
            POSParkedCart.expires_at > now,
            POSParkedCart.is_deleted == False,
        )
    )
    if branch_id:
        query = query.where(POSParkedCart.branch_id == branch_id)
    query = query.order_by(POSParkedCart.parked_at.desc())

    res = await db.execute(query)
    carts = res.scalars().all()
    return [
        {
            "id": c.id,
            "hold_slip_number": c.hold_slip_number,
            "branch_id": c.branch_id,
            "session_id": c.session_id,
            "cashier_id": c.cashier_id,
            "customer_id": c.customer_id,
            "customer_name": c.customer_name,
            "customer_phone": c.customer_phone,
            "items_count": c.items_count,
            "total_amount": float(c.total_amount),
            "cart_snapshot": c.cart_snapshot,
            "parked_at": c.parked_at.isoformat(),
            "expires_at": c.expires_at.isoformat(),
        }
        for c in carts
    ]


@router.post(
    "/pos/parked-carts/{hold_slip_number}/recall",
    summary="Recall Parked Cart",
    description="Marks a parked cart as RECALLED and returns its snapshot for terminal restoration.",
    dependencies=[Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def recall_parked_cart(
    hold_slip_number: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    res = await db.execute(
        select(POSParkedCart).where(
            and_(
                POSParkedCart.company_id == tenant.company_id,
                POSParkedCart.hold_slip_number == hold_slip_number,
            )
        )
    )
    cart = res.scalars().first()
    if not cart:
        raise HTTPException(status_code=404, detail=f"Hold slip {hold_slip_number} not found")

    if cart.status == "EXPIRED" or (cart.expires_at and cart.expires_at < datetime.now(timezone.utc)):
        cart.status = "EXPIRED"
        await db.commit()
        raise HTTPException(status_code=400, detail=f"Hold slip {hold_slip_number} has expired (> 4 hours)")

    cart.status = "RECALLED"
    cart.recalled_at = datetime.now(timezone.utc)
    cart.recalled_by = getattr(current_user, "id", "cashier-1")
    await db.commit()
    return {
        "status": "SUCCESS",
        "hold_slip_number": cart.hold_slip_number,
        "customer_id": cart.customer_id,
        "customer_name": cart.customer_name,
        "customer_phone": cart.customer_phone,
        "items_count": cart.items_count,
        "total_amount": float(cart.total_amount),
        "cart_snapshot": cart.cart_snapshot,
    }


@router.delete(
    "/pos/parked-carts/{hold_slip_number}",
    summary="Cancel Parked Cart",
    dependencies=[Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def cancel_parked_cart(
    hold_slip_number: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    res = await db.execute(
        select(POSParkedCart).where(
            and_(
                POSParkedCart.company_id == tenant.company_id,
                POSParkedCart.hold_slip_number == hold_slip_number,
            )
        )
    )
    cart = res.scalars().first()
    if not cart:
        raise HTTPException(status_code=404, detail="Parked cart not found")
    cart.status = "CANCELLED"
    await db.commit()
    return {"status": "SUCCESS", "message": f"Hold slip {hold_slip_number} cancelled"}


# ────────────────── Alt+M Mid-Bill Customer Switch Audit Log ──────────────────

@router.post(
    "/pos/customer-switch-log",
    summary="Record Mid-Bill Customer Switch (Alt+M)",
    description="Audits customer switch and promotion re-evaluation events during active checkout.",
    dependencies=[Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def log_customer_switch(
    payload: Dict[str, Any],
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    log_record = InvoiceCustomerChangeLog(
        id=f"cswitch-{uuid.uuid4().hex[:12]}",
        tenant_id=getattr(tenant, "tenant_id", None) or tenant.company_id,
        company_id=tenant.company_id,
        session_id=payload.get("session_id", "SESSION-DEFAULT"),
        draft_invoice_id=payload.get("draft_invoice_id"),
        old_customer_id=payload.get("old_customer_id"),
        old_customer_name=payload.get("old_customer_name"),
        old_customer_group=payload.get("old_customer_group"),
        new_customer_id=payload.get("new_customer_id", "C01"),
        new_customer_name=payload.get("new_customer_name", "Walk-in"),
        new_customer_group=payload.get("new_customer_group"),
        line_items_count=int(payload.get("line_items_count", 0)),
        cart_subtotal=float(payload.get("cart_subtotal", 0.00)),
        promotions_reevaluated=bool(payload.get("promotions_reevaluated", True)),
        promo_diff_summary=payload.get("promo_diff_summary"),
        changed_by=payload.get("changed_by") or getattr(current_user, "id", "cashier-1"),
        changed_at=datetime.now(timezone.utc),
    )
    db.add(log_record)
    await db.commit()
    return {"status": "SUCCESS", "log_id": log_record.id}


# ─────────────── Shift-End Cash Denomination Reconciliation ───────────────

@router.post(
    "/pos/shifts/{shift_id}/denominations",
    summary="Save Shift Cash Denomination Breakdown",
    description="Saves denomination counts and calculates variance for cashier handover / manager sign-off.",
    dependencies=[Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def save_shift_denominations(
    shift_id: str,
    payload: List[Dict[str, Any]],
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    user_id = getattr(current_user, "id", "cashier-1")

    # Clear existing counts for this shift to allow update
    existing = await db.execute(
        select(POSShiftDenominationCount).where(
            and_(
                POSShiftDenominationCount.company_id == tenant.company_id,
                POSShiftDenominationCount.shift_id == shift_id,
            )
        )
    )
    for row in existing.scalars().all():
        await db.delete(row)

    records = []
    for item in payload:
        denom_val = float(item.get("denomination_value", 0))
        act_count = int(item.get("actual_count", 0))
        exp_count = int(item.get("expected_count", 0))
        act_amt = denom_val * act_count
        exp_amt = denom_val * exp_count
        variance = act_amt - exp_amt

        rec = POSShiftDenominationCount(
            id=f"denom-{uuid.uuid4().hex[:12]}",
            tenant_id=tenant.tenant_id,
            company_id=tenant.company_id,
            shift_id=shift_id,
            denomination_value=denom_val,
            expected_count=exp_count,
            actual_count=act_count,
            expected_amount=exp_amt,
            actual_amount=act_amt,
            variance_amount=variance,
            reconciled_by=user_id,
            reconciled_at=now,
            notes=item.get("notes"),
        )
        db.add(rec)
        records.append(rec)

    await db.commit()
    return {"status": "SUCCESS", "records_saved": len(records), "shift_id": shift_id}

