"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Module       : Warehouse Management System (WMS) Multi-Bin REST API Gateway (Milestone 5 — Tasks G-1 to G-5)
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 18.2.0
Created      : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Purpose:
    REST API endpoints for Warehouse Multi-Bin Locations, Zones, and Bin Stock Assignments.
"""

import uuid
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import get_db
from app.api.deps import get_current_tenant, TenantContext
from app.models.wms import WarehouseZone, WarehouseBin, StockBinAssignment

router = APIRouter(prefix="/wms", tags=["Warehouse Management System (WMS) Multi-Bin"])


class WarehouseZoneCreate(BaseModel):
    warehouse_id: str = Field(..., max_length=50)
    zone_code: str = Field(..., max_length=50)
    zone_name: str = Field(..., max_length=200)
    zone_type: str = Field("STORAGE", max_length=50)


class WarehouseZoneResponse(WarehouseZoneCreate):
    id: str
    is_active: bool
    model_config = ConfigDict(from_attributes=True)


class WarehouseBinCreate(BaseModel):
    warehouse_id: str = Field(..., max_length=50)
    zone_id: Optional[str] = Field(None, max_length=50)
    bin_code: str = Field(..., max_length=50)
    aisle: Optional[str] = Field(None, max_length=20)
    rack: Optional[str] = Field(None, max_length=20)
    shelf: Optional[str] = Field(None, max_length=20)
    bin_type: str = Field("STANDARD", max_length=50)
    max_weight_kg: Decimal = Field(Decimal("500.00"), ge=Decimal("0.00"))


class WarehouseBinResponse(WarehouseBinCreate):
    id: str
    current_weight_kg: Decimal
    is_occupied: bool
    is_active: bool
    model_config = ConfigDict(from_attributes=True)


@router.get("/zones", response_model=List[WarehouseZoneResponse])
async def list_zones(
    warehouse_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant),
):
    """List warehouse zones."""
    stmt = select(WarehouseZone).where(WarehouseZone.is_deleted == False)
    if warehouse_id:
        stmt = stmt.where(WarehouseZone.warehouse_id == warehouse_id)
    if tenant and tenant.company_id:
        stmt = stmt.where(WarehouseZone.company_id == tenant.company_id)
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.post("/zones", response_model=WarehouseZoneResponse, status_code=status.HTTP_201_CREATED)
async def create_zone(
    payload: WarehouseZoneCreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    """Create a warehouse zone."""
    zone_id = f"ZONE-{uuid.uuid4().hex[:8]}"
    zone = WarehouseZone(
        id=zone_id,
        uuid=str(uuid.uuid4()),
        tenant_id=tenant.tenant_id if tenant else "default",
        company_id=tenant.company_id if tenant else "comp-default",
        branch_id=tenant.branch_id if tenant else "br-default",
        warehouse_id=payload.warehouse_id,
        zone_code=payload.zone_code,
        zone_name=payload.zone_name,
        zone_type=payload.zone_type,
    )
    db.add(zone)
    await db.commit()
    return zone


@router.get("/bins", response_model=List[WarehouseBinResponse])
async def list_bins(
    warehouse_id: Optional[str] = Query(None),
    zone_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    """List warehouse bin locations."""
    stmt = select(WarehouseBin).where(WarehouseBin.is_deleted == False)
    if warehouse_id:
        stmt = stmt.where(WarehouseBin.warehouse_id == warehouse_id)
    if zone_id:
        stmt = stmt.where(WarehouseBin.zone_id == zone_id)
    if tenant and tenant.company_id:
        stmt = stmt.where(WarehouseBin.company_id == tenant.company_id)
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.post("/bins", response_model=WarehouseBinResponse, status_code=status.HTTP_201_CREATED)
async def create_bin(
    payload: WarehouseBinCreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    """Create a warehouse bin location."""
    bin_id = f"BIN-{uuid.uuid4().hex[:8]}"
    wb = WarehouseBin(
        id=bin_id,
        uuid=str(uuid.uuid4()),
        tenant_id=tenant.tenant_id if tenant else "default",
        company_id=tenant.company_id if tenant else "comp-default",
        branch_id=tenant.branch_id if tenant else "br-default",
        warehouse_id=payload.warehouse_id,
        zone_id=payload.zone_id,
        bin_code=payload.bin_code,
        aisle=payload.aisle,
        rack=payload.rack,
        shelf=payload.shelf,
        bin_type=payload.bin_type,
        max_weight_kg=payload.max_weight_kg,
    )
    db.add(wb)
    await db.commit()
    return wb
