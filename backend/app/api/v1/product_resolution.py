"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-10-03
Modified     : 2026-10-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: SMRITI Global Product Resolution & Validation API Router (Phase 1 & 9)
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status, Body
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_tenant_context, TenantContext, get_current_user
from ...models.auth import User
from ...schemas.product_resolution import (
    ProductResolutionResult,
    TransactionLineItemInput,
    TransactionValidationResult,
    BatchProductResolutionRequest,
    BatchProductResolutionResponse,
)
from ...services.product_resolution_service import ProductResolutionService

router = APIRouter(prefix="/products", tags=["Product Resolution & Validation"])


class ProductResolutionRequest(BaseModel):
    identifier: str
    identifier_type: Optional[str] = None  # PRODUCT_ID | BARCODE | SKU | AUTO
    allow_inactive: bool = False


class BatchLinesValidationRequest(BaseModel):
    lines: List[TransactionLineItemInput]
    allow_inactive: bool = False


@router.get(
    "/resolve",
    response_model=ProductResolutionResult,
    summary="Resolve Product by Identifier",
    description="Resolves product identifier against authoritative catalog respecting priority (Product ID -> Barcode -> SKU).",
)
async def resolve_product_get(
    identifier: str = Query(..., description="Barcode, SKU, or Product ID to resolve"),
    identifier_type: Optional[str] = Query(None, description="Explicit identifier type (PRODUCT_ID, BARCODE, SKU)"),
    allow_inactive: bool = Query(False, description="Whether to allow inactive items (e.g. for historical auditing)"),
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> ProductResolutionResult:
    result = await ProductResolutionService.resolve(
        session=db,
        company_id=tenant.company_id,
        identifier=identifier,
        identifier_type=identifier_type,
        allow_inactive=allow_inactive,
    )
    if not result.success:
        err = result.error_detail
        status_code = status.HTTP_404_NOT_FOUND if result.code == "PRODUCT_NOT_FOUND" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(
            status_code=status_code,
            detail={
                "code": result.code or "PRODUCT_NOT_FOUND",
                "title": err.title if err else "Product Not Found",
                "explanation": err.explanation if err else result.message,
                "suggested_action": err.suggested_action if err else "Please add the product to Product List before continuing.",
                "identifier": identifier,
                "identifier_type": result.identifier_type or identifier_type,
            },
        )
    return result


@router.post(
    "/resolve",
    response_model=ProductResolutionResult,
    summary="Resolve Product Identifier (POST)",
    description="Resolves product identifier against authoritative catalog.",
)
async def resolve_product_post(
    req: ProductResolutionRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> ProductResolutionResult:
    result = await ProductResolutionService.resolve(
        session=db,
        company_id=tenant.company_id,
        identifier=req.identifier,
        identifier_type=req.identifier_type,
        allow_inactive=req.allow_inactive,
    )
    if not result.success:
        err = result.error_detail
        status_code = status.HTTP_404_NOT_FOUND if result.code == "PRODUCT_NOT_FOUND" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(
            status_code=status_code,
            detail={
                "code": result.code or "PRODUCT_NOT_FOUND",
                "title": err.title if err else "Product Not Found",
                "explanation": err.explanation if err else result.message,
                "suggested_action": err.suggested_action if err else "Please add the product to Product List before continuing.",
                "identifier": req.identifier,
                "identifier_type": result.identifier_type or req.identifier_type,
            },
        )
    return result


@router.post(
    "/validate-lines",
    response_model=TransactionValidationResult,
    summary="Atomic Transaction Lines Validation",
    description="Validates a batch of transaction lines against the authoritative catalog before commit.",
)
async def validate_transaction_lines(
    req: BatchLinesValidationRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> TransactionValidationResult:
    return await ProductResolutionService.validate_transaction_lines(
        session=db,
        company_id=tenant.company_id,
        lines=req.lines,
        allow_inactive=req.allow_inactive,
    )


@router.post(
    "/batch-resolve",
    response_model=BatchProductResolutionResponse,
    summary="Batch Product Resolution",
    description="Resolves a list of product identifiers in batch for grid input, Excel paste, and CSV import.",
)
async def batch_resolve_products(
    req: BatchProductResolutionRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> BatchProductResolutionResponse:
    return await ProductResolutionService.resolve_batch(
        session=db,
        company_id=tenant.company_id,
        items=req.items,
        allow_inactive=req.allow_inactive,
    )

