"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-09-27
Modified     : 2026-09-27
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Billing API & Transaction Router (Phase 1)
"""

from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_tenant_context, get_current_user, TenantContext
from ...models.auth import User
from ...schemas.canonical_posting import (
    CanonicalPostingRequest,
    CanonicalPostingResult,
    BillingCalculationResult,
)
from ...services.canonical_sales_writer import CanonicalSalesPostingWriter
from ...services.headless_billing import HeadlessBillingCore

router = APIRouter()


@router.post(
    "/preview",
    response_model=BillingCalculationResult,
    status_code=status.HTTP_200_OK,
    summary="Statutory Headless Billing Calculation Preview",
    description=(
        "Pure read-only computation endpoint for the Unified Billing Engine. "
        "Executes dual-key resolution, commercial discount policies, 5-tier tax-inclusivity hierarchy, "
        "and statutory GST with commercial ROUND_HALF_UP arithmetic. "
        "Guarantees 100% calculation parity with /checkout. "
        "Creates NO invoices, mutates NO stock, and writes NO ledger or financial records."
    ),
    tags=["Unified Billing Engine"],
)
async def preview(
    req: CanonicalPostingRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> BillingCalculationResult:
    """
    POST /api/v1/billing/preview (Read-Only Statutory Calculation Preview)
    """
    # 1. Enforce Strict Tenant Isolation
    if req.context.company_id != tenant.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SMRITI-TENANT-001: Cross-tenant transaction access forbidden. Company ID mismatch.",
        )

    # 2. Execute Headless Billing Core Calculation
    return await HeadlessBillingCore.calculate_billing(
        session=db,
        req=req,
    )


@router.post(
    "/checkout",
    response_model=CanonicalPostingResult,
    status_code=status.HTTP_201_CREATED,
    summary="Universal Billing Checkout & Atomic Sales Posting",
    description=(
        "Standardized transactional entry point for the Unified Billing Engine. "
        "Consumes canonical items, enforces strict company tenant boundaries, "
        "evaluates credit authorization and exposure, computes statutory GST with ROUND_HALF_UP, "
        "and atomically commits invoice, stock movements, customer credit ledger, and outbox."
    ),
    tags=["Unified Billing Engine"],
)
async def checkout(
    req: CanonicalPostingRequest,
    idempotency_key_header: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> CanonicalPostingResult:
    """
    POST /api/v1/billing/checkout (Universal Billing Transaction Submission)
    Supports both retail/POS sales (with optional shift_id) and enterprise B2B / Credit Billing.
    """
    # 1. Enforce Strict Tenant Isolation
    if req.context.company_id != tenant.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SMRITI-TENANT-001: Cross-tenant transaction access forbidden. Company ID mismatch.",
        )

    # 2. Extract & Prioritize Idempotency Key
    idempotency_key = idempotency_key_header or req.context.idempotency_key
    if not idempotency_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMRITI-IDEMP-003: Mandatory Idempotency-Key missing from header or context payload.",
        )

    # 3. Authoritative Atomic Transaction Execution
    result = await CanonicalSalesPostingWriter.post_sales_transaction(
        session=db,
        req=req,
        idempotency_key=idempotency_key,
        commit=True,
    )

    return result
