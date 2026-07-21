"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 11.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

tax.py — REST API gateway for GST Monthly Tax Settlements, Outward GSTR-1 Return Filing DTOs, and E-Way Bills.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_tenant, TenantContext
from app.models.tax import EWayBill
from app.services.gst_tax_engine import GstTaxEngine
from app.schemas.tax import (
    GstSettlementResponse, Gstr1PayloadResponse,
    EWayBillCreateReq, EWayBillResponse
)

router = APIRouter(prefix="/tax", tags=["GST Tax Settlement & Statutory E-Way Bills"])


@router.get("/gst/settlement", response_model=GstSettlementResponse)
async def calculate_gst_settlement(
    tax_period: str = Query(..., description="Tax Period in YYYY-MM format"),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Calculates monthly GST Output Tax Liability vs Inward Input Tax Credit (ITC).
    """
    engine = GstTaxEngine(db, tenant)
    return await engine.calculate_monthly_settlement(tax_period=tax_period)


@router.get("/gst/gstr1", response_model=Gstr1PayloadResponse)
async def generate_gstr1_payload(
    tax_period: str = Query(..., description="Tax Period in YYYY-MM format"),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Compiles structured GSTR-1 return filing JSON payload for GSTN portal submission.
    """
    engine = GstTaxEngine(db, tenant)
    return await engine.generate_gstr1_payload(tax_period=tax_period)


@router.post("/eway-bills", response_model=EWayBillResponse, status_code=status.HTTP_201_CREATED)
async def generate_eway_bill(
    payload: EWayBillCreateReq,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Generates a statutory E-Way Bill for consignments exceeding ₹50,000 threshold.
    """
    engine = GstTaxEngine(db, tenant)
    return await engine.generate_eway_bill(
        invoice_id=payload.invoice_id,
        transporter_id=payload.transporter_id,
        transporter_name=payload.transporter_name,
        transport_mode=payload.transport_mode or "ROAD",
        vehicle_no=payload.vehicle_no,
        distance_km=payload.distance_km
    )


@router.get("/eway-bills/{id}", response_model=EWayBillResponse)
async def get_eway_bill(
    id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Retrieves details of an E-Way Bill.
    """
    stmt = select(EWayBill).where(
        EWayBill.id == id,
        EWayBill.is_deleted == False,
        EWayBill.company_id == tenant.company_id
    )
    ewb = (await db.execute(stmt)).scalars().first()
    if not ewb:
        raise HTTPException(status_code=404, detail=f"E-Way Bill '{id}' not found.")
    return ewb
