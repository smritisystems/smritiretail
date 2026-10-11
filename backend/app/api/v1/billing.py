"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.1
Created      : 2026-09-27
Modified     : 2026-10-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Billing API & Transaction Router (Phase 1)
"""

from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_tenant_context, get_current_user, TenantContext
from ...models.auth import User
from ...schemas.canonical_posting import (
    CanonicalPostingRequest,
    CanonicalPostingResult,
    BillingCalculationResult,
)
from ...schemas.billing_catalog import (
    BillingCatalogResponse,
    BillingProductItem,
    BillingCustomerListResponse,
    BillingCustomerItem,
)
from ...services.canonical_sales_writer import CanonicalSalesPostingWriter
from ...services.headless_billing import HeadlessBillingCore
from ...services.billing_catalog_service import BillingCatalogService

router = APIRouter()


@router.get(
    "/products",
    response_model=BillingCatalogResponse,
    status_code=status.HTTP_200_OK,
    summary="Billing Catalog & Product Facet Explorer (Phase 3)",
    description="Faceted product explorer with category counts, stock status filters, and multi-attribute search.",
    tags=["Unified Billing Engine"],
)
async def list_billing_products(
    q: Optional[str] = Query(None, description="Search by Code, Name, Barcode, Brand, SKU"),
    category: Optional[str] = Query(None, description="Category filter"),
    brand: Optional[str] = Query(None, description="Brand filter"),
    stock_status: Optional[str] = Query(None, description="IN_STOCK, OUT_OF_STOCK, LOW_STOCK"),
    min_price: Optional[Decimal] = Query(None, description="Min price"),
    max_price: Optional[Decimal] = Query(None, description="Max price"),
    is_active: Optional[bool] = Query(None, description="Only active products"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> BillingCatalogResponse:
    """
    GET /api/v1/billing/products
    """
    return await BillingCatalogService.get_products(
        session=db,
        company_id=tenant.company_id,
        q=q,
        category=category,
        brand=brand,
        stock_status=stock_status,
        min_price=min_price,
        max_price=max_price,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/scan/{barcode}",
    response_model=BillingProductItem,
    status_code=status.HTTP_200_OK,
    summary="Fast Barcode Lookup for Scanner Guns (Phase 3)",
    description="Resolves barcode, code, or SKU into a billing-ready product line item.",
    tags=["Unified Billing Engine"],
)
async def scan_barcode(
    barcode: str,
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> BillingProductItem:
    """
    GET /api/v1/billing/scan/{barcode}
    """
    item = await BillingCatalogService.scan_barcode(
        session=db,
        company_id=tenant.company_id,
        barcode=barcode,
    )
    if not item:
        clean_bc = barcode.strip()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "PRODUCT_NOT_FOUND",
                "title": "Product Not Found",
                "explanation": f"This product is not registered in Product List. Barcode '{clean_bc}' was not found in Product List.",
                "suggested_action": "Please add the product to Product List before continuing.",
                "identifier": clean_bc,
                "identifier_type": "BARCODE",
            },
        )
    return item


@router.get(
    "/customers",
    response_model=BillingCustomerListResponse,
    status_code=status.HTTP_200_OK,
    summary="Billing Customer Directory & Real-time Credit Exposure (Phase 4)",
    description="Customer search with credit limits, current outstanding balance, and available exposure.",
    tags=["Unified Billing Engine"],
)
async def list_billing_customers(
    q: Optional[str] = Query(None, description="Search by Code, Name, Phone, GSTIN"),
    status_tab: Optional[str] = Query("All", description="All, Active, Inactive"),
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> BillingCustomerListResponse:
    """
    GET /api/v1/billing/customers
    """
    return await BillingCatalogService.get_customers(
        session=db,
        company_id=tenant.company_id,
        q=q,
        status_tab=status_tab,
    )


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


@router.get(
    "/reconcile/{idempotency_key}",
    status_code=status.HTTP_200_OK,
    summary="Reconcile Billing Transaction by Idempotency Key",
)
@router.get(
    "/billing/reconcile/{idempotency_key}",
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def reconcile_billing_transaction(
    idempotency_key: str,
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    """
    Non-destructive transaction reconciliation check.
    Queries the Transaction Integrity Engine ledger without triggering any mutations.
    """
    from ...models.transaction_integrity import TransactionIdempotencyRecord
    from sqlalchemy import select

    stmt = select(TransactionIdempotencyRecord).where(
        TransactionIdempotencyRecord.company_id == tenant.company_id,
        TransactionIdempotencyRecord.entity_type == "SALES_INVOICE",
        TransactionIdempotencyRecord.idempotency_key == idempotency_key,
    )
    rec = (await db.execute(stmt)).scalars().first()
    if not rec:
        return {
            "status": "NOT_FOUND",
            "is_committed": False,
            "idempotency_key": idempotency_key,
            "reconciliation_advice": (
                "No transaction record currently exists for this idempotency key. "
                "An absent record does not guarantee an in-flight network request cannot arrive later. "
                "Retain this stable key if retrying."
            ),
        }

    is_committed = (rec.status == "COMMITTED")
    return {
        "status": rec.status,
        "is_committed": is_committed,
        "idempotency_key": idempotency_key,
        "invoice_no": rec.document_no,
        "invoice_id": rec.document_id,
        "completed_at": rec.completed_at.isoformat() if rec.completed_at else None,
        "error_detail": rec.error_detail,
        "reconciliation_advice": (
            "Transaction committed and posted." if is_committed else
            "Transaction actively in progress on server. Do not dispatch duplicate." if rec.status == "IN_FLIGHT" else
            "Transaction previously failed. Safe to review and retry with a new or clean key."
        ),
    }

