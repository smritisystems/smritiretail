"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.49.7
* Created    : 2026-07-11
* Modified   : 2026-10-02
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_tenant_context, require_role, TenantContext
from ...models.auth import UserRole
from ...schemas.supplier_payment import (
    SupplierPaymentCreate,
    SupplierPaymentResponse,
    SupplierAdvanceKnockoffRequest,
    SupplierAdvanceKnockoffResponse,
    SupplierAdvanceBatchKnockoffRequest,
    SupplierAdvanceBatchKnockoffResponse,
)
from ...services.supplier_payment import SupplierPaymentService

router = APIRouter()


@router.post(
    "/supplier-payments/",
    response_model=SupplierPaymentResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def record_payment(
    req: SupplierPaymentCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Record a payment to a supplier.
    Atomically decrements supplier.outstanding, knocks off open purchase bills,
    and posts authoritative double-entry general ledger vouchers.

    Rules:
    - MANAGER or SYSADMIN only.
    - Amount must be > 0.
    - Amount must not exceed supplier outstanding balance (overpayment guard).
    - payment_mode: CASH | BANK_TRANSFER | CHEQUE | UPI
    """
    return await SupplierPaymentService(db, tenant).record_payment(req)


@router.get("/supplier-payments/", response_model=List[SupplierPaymentResponse])
async def list_payments(
    supplier_id: Optional[str] = Query(default=None, description="Filter by supplier"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """List all supplier payments, optionally filtered by supplier."""
    return await SupplierPaymentService(db, tenant).list_payments(supplier_id=supplier_id)


@router.get("/supplier-payments/{payment_id}", response_model=SupplierPaymentResponse)
async def get_payment(
    payment_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific supplier payment by ID."""
    return await SupplierPaymentService(db, tenant).get_payment(payment_id)


@router.post(
    "/supplier-payments/{payment_id}/cancel",
    response_model=SupplierPaymentResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def cancel_payment(
    payment_id: str,
    reason: Optional[str] = Query(default=None, description="Reason for voiding/cancelling payment"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Cancel / void a supplier payment.
    Reverses double-entry GL vouchers, restores supplier outstanding, and reverts knocked-off bills.
    """
    return await SupplierPaymentService(db, tenant).cancel_payment(
        payment_id=payment_id,
        reason=reason,
    )


@router.post(
    "/supplier-payments/advance/knockoff",
    response_model=SupplierAdvanceKnockoffResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def knockoff_advance(
    req: SupplierAdvanceKnockoffRequest,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Knock off an existing supplier advance payment against a confirmed purchase bill.
    Posts DR 2010 (Accounts Payable) / CR 2050 (Supplier Advance Liability) with zero cash movement.
    """
    return await SupplierPaymentService(db, tenant).knockoff_advance(
        supplier_id=req.supplier_id,
        advance_payment_id=req.advance_payment_id,
        bill_id=req.bill_id,
        amount=req.amount,
        user_id=tenant.user_id,
    )


@router.post(
    "/supplier-payments/advance/batch-knockoff",
    response_model=SupplierAdvanceBatchKnockoffResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def batch_knockoff_advance(
    req: SupplierAdvanceBatchKnockoffRequest,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Knock off an unallocated supplier advance across multiple purchase bills (or FIFO auto-allocate).
    Posts an atomic compound DR 2010 (Accounts Payable) / CR 2050 (Supplier Advance Liability) GL voucher
    with zero cash movement.
    """
    return await SupplierPaymentService(db, tenant).batch_knockoff_advance(
        supplier_id=req.supplier_id,
        advance_payment_id=req.advance_payment_id,
        allocations=req.allocations,
        auto_fifo=req.auto_fifo,
        notes=req.notes,
        user_id=tenant.user_id,
    )

