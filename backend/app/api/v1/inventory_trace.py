"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-02
Modified     : 2026-08-02
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import TenantContext, get_db, get_tenant_context
from ...schemas.inventory import StockMovementResponse
from ...services.inventory_trace import InventoryTraceService

router = APIRouter()


@router.get(
    "/product/{product_id}",
    response_model=list[StockMovementResponse],
    summary="Get inventory trace history for a product",
)
async def get_product_inventory_trace(
    product_id: str,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = InventoryTraceService(db, tenant_ctx)
    return await svc.get_product_trace(product_id, limit=limit)


@router.get(
    "/reference/{reference_doc_id}",
    response_model=list[StockMovementResponse],
    summary="Get inventory trace history by reference document",
)
async def get_reference_inventory_trace(
    reference_doc_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = InventoryTraceService(db, tenant_ctx)
    return await svc.get_reference_trace(reference_doc_id)


@router.get(
    "/sku",
    response_model=list[StockMovementResponse],
    summary="Get inventory trace history by SKU",
)
async def get_sku_inventory_trace(
    sku: str = Query(..., min_length=1),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = InventoryTraceService(db, tenant_ctx)
    return await svc.get_sku_trace(sku, limit=limit)
