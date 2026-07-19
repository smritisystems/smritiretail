"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.27.0
Created      : 2026-07-19
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Consignment / Modern Trade API endpoints.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...schemas.consignment import (
    ConsignmentPartnerCreate, ConsignmentPartnerResponse,
    ConsignmentTransferCreate, ConsignmentTransferResponse,
    ConsignmentSaleReportCreate, ConsignmentSaleReportResponse,
    ConsignmentSettlementCreate, ConsignmentSettlementResponse,
    ConsignmentReturnCreate, ConsignmentReturnResponse
)
from ...services.consignment import ConsignmentService
from ...api.deps import get_db, get_tenant_context, TenantContext

router = APIRouter()


# ──────────────────────────────────────────────────────────────
# Consignment Partners
# ──────────────────────────────────────────────────────────────

@router.post("/partners", response_model=ConsignmentPartnerResponse)
async def create_partner(
    partner_in: ConsignmentPartnerCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = ConsignmentService(db, tenant_ctx)
    return await service.create_partner(partner_in)


@router.get("/partners", response_model=List[ConsignmentPartnerResponse])
async def get_partners(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = ConsignmentService(db, tenant_ctx)
    return await service.get_partners()


@router.get("/partners/{partner_id}", response_model=ConsignmentPartnerResponse)
async def get_partner(
    partner_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = ConsignmentService(db, tenant_ctx)
    partner = await service.get_partner(partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Consignment partner not found")
    return partner


# ──────────────────────────────────────────────────────────────
# Consignment Stock Transfers
# ──────────────────────────────────────────────────────────────

@router.post("/transfers", response_model=ConsignmentTransferResponse)
async def create_transfer(
    transfer_in: ConsignmentTransferCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = ConsignmentService(db, tenant_ctx)
    return await service.create_transfer(transfer_in)


@router.get("/transfers", response_model=List[ConsignmentTransferResponse])
async def get_transfers(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = ConsignmentService(db, tenant_ctx)
    return await service.get_transfers()


@router.get("/transfers/{transfer_id}", response_model=ConsignmentTransferResponse)
async def get_transfer(
    transfer_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = ConsignmentService(db, tenant_ctx)
    transfer = await service.get_transfer(transfer_id)
    if not transfer:
        raise HTTPException(status_code=404, detail="Consignment transfer not found")
    return transfer


@router.post("/transfers/{transfer_id}/dispatch", response_model=ConsignmentTransferResponse)
async def dispatch_transfer(
    transfer_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = ConsignmentService(db, tenant_ctx)
    return await service.dispatch_transfer(transfer_id)


# ──────────────────────────────────────────────────────────────
# Consignment Sales Reports
# ──────────────────────────────────────────────────────────────

@router.post("/sale-reports", response_model=ConsignmentSaleReportResponse)
async def submit_sale_report(
    report_in: ConsignmentSaleReportCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = ConsignmentService(db, tenant_ctx)
    return await service.submit_sale_report(report_in)


@router.get("/sale-reports", response_model=List[ConsignmentSaleReportResponse])
async def get_sale_reports(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = ConsignmentService(db, tenant_ctx)
    return await service.get_sale_reports()


@router.post("/sale-reports/{report_id}/process", response_model=ConsignmentSaleReportResponse)
async def process_sale_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = ConsignmentService(db, tenant_ctx)
    return await service.process_sale_report(report_id)


# ──────────────────────────────────────────────────────────────
# Consignment Settlements
# ──────────────────────────────────────────────────────────────

@router.post("/settlements", response_model=ConsignmentSettlementResponse)
async def create_settlement(
    settlement_in: ConsignmentSettlementCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = ConsignmentService(db, tenant_ctx)
    return await service.create_settlement(settlement_in)


@router.get("/settlements", response_model=List[ConsignmentSettlementResponse])
async def get_settlements(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = ConsignmentService(db, tenant_ctx)
    return await service.get_settlements()


# ──────────────────────────────────────────────────────────────
# Consignment Returns
# ──────────────────────────────────────────────────────────────

@router.post("/returns", response_model=ConsignmentReturnResponse)
async def process_return(
    return_in: ConsignmentReturnCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = ConsignmentService(db, tenant_ctx)
    return await service.process_return(return_in)


@router.get("/returns", response_model=List[ConsignmentReturnResponse])
async def get_returns(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    service = ConsignmentService(db, tenant_ctx)
    return await service.get_returns()
