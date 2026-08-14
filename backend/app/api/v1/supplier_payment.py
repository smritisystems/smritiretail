"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.13.0
* Created    : 2026-07-11
* Modified   : 2026-07-11
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_tenant_context, require_role, TenantContext
from ...models.auth import UserRole
from ...schemas.supplier_payment import SupplierPaymentCreate, SupplierPaymentResponse
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
    Record a payment to a supplier. Atomically decrements supplier.outstanding.

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
