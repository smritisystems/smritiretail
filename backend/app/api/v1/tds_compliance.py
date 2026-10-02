"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.52.0
* Created    : 2026-10-02
* Modified   : 2026-10-02
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Statutory Compliance & Taxation REST Endpoints
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_tenant_context, get_current_user, TenantContext
from app.models.tenant import Company
from app.schemas.challan_281 import Challan281Create, Challan281Response
from app.schemas.form26q import Form26QSummaryResponse, Form26QExportResponse
from app.services.challan_281 import Challan281Service
from app.services.form26q_generator import Form26QGeneratorService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/challan281", response_model=Challan281Response)
async def record_challan_281(
    payload: Challan281Create,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user = Depends(get_current_user),
):
    """
    Records a government TDS remittance via Challan ITNS 281.
    Debits Account 2030 (TDS Payable), debits Account 5090 (Interest/Fee if > 0),
    and credits Account 1020 (Bank Account).
    """
    company_id = tenant.company_id or "00000000-0000-0000-0000-000000000001"
    branch_id = tenant.branch_id
    user_id = getattr(current_user, "id", None) or "system"

    try:
        res = await Challan281Service.record_challan_281(
            session=db,
            company_id=company_id,
            payload=payload,
            branch_id=branch_id,
            created_by=user_id,
        )
        await db.commit()
        return res
    except HTTPException:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        logger.error(f"Failed to record Challan 281 deposit: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error recording Challan 281 deposit")


@router.get("/challan281", response_model=List[Challan281Response])
async def list_challan_281(
    quarter: Optional[str] = Query(None, description="Quarter filter (Q1, Q2, Q3, Q4)"),
    financial_year: Optional[str] = Query(None, description="Financial year (e.g. 2026-27)"),
    tds_section: Optional[str] = Query(None, description="TDS section filter (194Q, 194C, etc.)"),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    """
    Lists recorded Challan 281 vouchers matching specified filters.
    """
    company_id = tenant.company_id or "00000000-0000-0000-0000-000000000001"
    try:
        return await Challan281Service.list_challan_281(
            session=db,
            company_id=company_id,
            quarter=quarter,
            financial_year=financial_year,
            tds_section=tds_section,
        )
    except Exception as exc:
        logger.error(f"Failed to list Challan 281 records: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error listing Challan 281 records")


@router.post("/challan281/{challan_id}/cancel", response_model=Challan281Response)
async def cancel_challan_281(
    challan_id: str,
    reason: Optional[str] = Query(None, description="Reason for cancellation"),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user = Depends(get_current_user),
):
    """
    Cancels a recorded Challan 281 voucher and generates an exact symmetrical reversal voucher.
    """
    company_id = tenant.company_id or "00000000-0000-0000-0000-000000000001"
    user_id = getattr(current_user, "id", None) or "system"

    try:
        res = await Challan281Service.cancel_challan_281(
            session=db,
            company_id=company_id,
            challan_identifier=challan_id,
            reason=reason,
            cancelled_by=user_id,
        )
        await db.commit()
        return res
    except HTTPException:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        logger.error(f"Failed to cancel Challan 281 {challan_id}: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error cancelling Challan 281 deposit")


@router.get("/form26q/summary", response_model=Form26QSummaryResponse)
async def get_form26q_summary(
    quarter: str = Query("Q2", description="Quarter: Q1 | Q2 | Q3 | Q4"),
    financial_year: str = Query("2026-27", description="Financial year (e.g. 2026-27)"),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    """
    Returns quarterly Form 26Q reconciliation summary comparing total TDS deducted
    vs total TDS deposited via Challan 281, with full deductee line audit trail.
    """
    company_id = tenant.company_id or "00000000-0000-0000-0000-000000000001"
    try:
        return await Form26QGeneratorService.get_quarterly_summary(
            session=db,
            company_id=company_id,
            quarter=quarter,
            financial_year=financial_year,
        )
    except Exception as exc:
        logger.error(f"Failed to get Form 26Q summary: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error compiling Form 26Q summary")


@router.get("/form26q/export", response_model=Form26QExportResponse)
async def export_form26q_text(
    quarter: str = Query("Q2", description="Quarter: Q1 | Q2 | Q3 | Q4"),
    financial_year: str = Query("2026-27", description="Financial year (e.g. 2026-27)"),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    """
    Generates standard NSDL e-TDS ASCII text file payload (FH, BH, CD, DD records)
    for filing Form 26Q with the Income Tax Department.
    """
    company_id = tenant.company_id or "00000000-0000-0000-0000-000000000001"
    try:
        return await Form26QGeneratorService.generate_form26q_text(
            session=db,
            company_id=company_id,
            quarter=quarter,
            financial_year=financial_year,
        )
    except Exception as exc:
        logger.error(f"Failed to export Form 26Q text: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error exporting Form 26Q return file")
