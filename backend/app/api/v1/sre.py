# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Version      : 3.31.0
# Modified     : 2026-07-19
# Copyright    : © SMRITIBooks.com. All Rights Reserved.

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...schemas.sre import (
    CorporateGstinRegistryCreate, CorporateGstinRegistryResponse,
    SreRuleEngineCreate, SreRuleEngineResponse,
    SreStatutoryLedgerResponse, SreComplianceDecisionResponse
)
from ...services.sre.sre_service import SreService
from ...api.deps import get_db, get_tenant_context, TenantContext

router = APIRouter()


@router.post("/gstin", response_model=CorporateGstinRegistryResponse)
async def register_gstin(
    payload: CorporateGstinRegistryCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = SreService(db, tenant_ctx)
    return await service.register_gstin(payload.gstin, payload.warehouse_name)


@router.get("/gstins", response_model=List[CorporateGstinRegistryResponse])
async def list_gstins(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = SreService(db, tenant_ctx)
    return await service.get_gstin_registrations()


@router.post("/rules", response_model=SreRuleEngineResponse)
async def create_compliance_rule(
    payload: SreRuleEngineCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = SreService(db, tenant_ctx)
    return await service.create_compliance_rule(
        payload.dispatch_type,
        payload.tax_timing,
        payload.max_deferral_days,
        payload.required_document_type
    )


@router.post("/evaluate")
async def evaluate_dispatch(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = SreService(db, tenant_ctx)
    return await service.evaluate_dispatch_compliance(payload)


@router.get("/explain/{dispatch_id}")
async def explain_dispatch(
    dispatch_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = SreService(db, tenant_ctx)
    return await service.get_compliance_explanation(dispatch_id)


@router.post("/scan")
async def run_compliance_scan(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = SreService(db, tenant_ctx)
    return await service.run_nightly_compliance_scan()
