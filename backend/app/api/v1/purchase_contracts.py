"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.7.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import TenantContext, get_tenant_context
from app.services.purchase import PurchaseService
from app.schemas.purchase import (
    VendorContractCreate,
    VendorContractUpdate,
    VendorContractResponse,
    ProcurementSourcingResolution,
)

router = APIRouter(prefix="/purchase/contracts", tags=["Purchase Contracts"])


@router.post("", response_model=VendorContractResponse, status_code=status.HTTP_201_CREATED)
async def create_vendor_contract(
    contract_in: VendorContractCreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Creates a commercial VendorContract Aggregate with volume-tiered lines.
    """
    service = PurchaseService(db, tenant)
    return await service.create_vendor_contract(contract_in)


@router.get("", response_model=List[VendorContractResponse])
async def list_vendor_contracts(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Lists all active vendor contracts for the current company context.
    """
    service = PurchaseService(db, tenant)
    return await service.list_vendor_contracts()


@router.get("/{contract_id}", response_model=VendorContractResponse)
async def get_vendor_contract(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Retrieves a single vendor contract with its tiered pricing lines.
    """
    service = PurchaseService(db, tenant)
    return await service.get_vendor_contract(contract_id)


@router.post("/{contract_id}/activate", response_model=VendorContractResponse)
async def activate_vendor_contract(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Activates an approved vendor contract for procurement.
    """
    service = PurchaseService(db, tenant)
    return await service.activate_vendor_contract(contract_id)


@router.post("/{contract_id}/amend", response_model=VendorContractResponse)
async def amend_vendor_contract(
    contract_id: str,
    amendment_in: VendorContractUpdate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Amends an active vendor contract by creating version +1 and archiving the previous version.
    """
    service = PurchaseService(db, tenant)
    return await service.amend_vendor_contract(contract_id, amendment_in)


@router.post("/resolve-sourcing", response_model=ProcurementSourcingResolution)
async def resolve_sourcing(
    product_id: str = Query(...),
    order_qty: float = Query(1.0),
    strategy: str = Query("CONTRACT_FIRST"),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Orchestrates strategic procurement sourcing resolution (CONTRACT_FIRST, LOWEST_COST, FASTEST_DELIVERY, PREFERRED).
    """
    service = PurchaseService(db, tenant)
    return await service.resolve_procurement_source(product_id=product_id, order_qty=order_qty, strategy=strategy)
