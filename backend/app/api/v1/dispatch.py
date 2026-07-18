# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Version      : 3.31.0
# Modified     : 2026-07-19
# Copyright    : © SMRITIBooks.com. All Rights Reserved.

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ...schemas.dispatch import (
    StockDispatchCreate, StockDispatchResponse,
    DispatchApprovalEventResponse
)
from ...services.dispatch_service import DispatchService
from ...api.deps import get_db, get_tenant_context, TenantContext

router = APIRouter()


@router.post("", response_model=StockDispatchResponse)
async def create_dispatch(
    payload: StockDispatchCreate,
    origin_gstin_id: str,
    destination_gstin: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    ip_address = request.client.host if request.client else None
    service = DispatchService(db, tenant_ctx)
    return await service.create_dispatch(
        payload=payload,
        origin_gstin_id=origin_gstin_id,
        destination_gstin=destination_gstin,
        ip_address=ip_address
    )


@router.get("/{dispatch_id}", response_model=StockDispatchResponse)
async def get_dispatch(
    dispatch_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = DispatchService(db, tenant_ctx)
    return await service.get_dispatch(dispatch_id)


@router.post("/{dispatch_id}/sale", response_model=StockDispatchResponse)
async def record_sale_report(
    dispatch_id: str,
    payload: List[Dict[str, Any]],
    request: Request,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    ip_address = request.client.host if request.client else None
    service = DispatchService(db, tenant_ctx)
    return await service.submit_sale_report(
        dispatch_id=dispatch_id,
        items=payload,
        ip_address=ip_address
    )


@router.post("/{dispatch_id}/return", response_model=StockDispatchResponse)
async def process_return(
    dispatch_id: str,
    payload: List[Dict[str, Any]],
    request: Request,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    ip_address = request.client.host if request.client else None
    service = DispatchService(db, tenant_ctx)
    return await service.process_return(
        dispatch_id=dispatch_id,
        items=payload,
        ip_address=ip_address
    )
