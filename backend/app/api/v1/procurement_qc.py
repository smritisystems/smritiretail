"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.2.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import get_db
from app.api.deps import TenantContext, get_tenant_context
from app.models.purchase import QualityInspection, QualityInspectionItem, SupplierDebitNote
from app.schemas.purchase import (
    QCInspectionResponse, QCEvaluationRequest, SupplierDebitNoteResponse
)
from app.procurement.engine.qc_inspection_engine import QCInspectionEngine

router = APIRouter(prefix="/purchase/qc", tags=["Procurement Quality Control & Debit Notes"])


@router.post("/inspections", response_model=QCInspectionResponse, status_code=status.HTTP_201_CREATED)
async def create_quality_inspection(
    receipt_id: str,
    inspector_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Creates a new Quality Inspection record from a Purchase Receipt (GRN).
    """
    engine = QCInspectionEngine(db, tenant)
    return await engine.create_inspection_from_receipt(receipt_id=receipt_id, inspector_id=inspector_id)


@router.get("/inspections", response_model=List[QCInspectionResponse])
async def list_quality_inspections(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Lists all Quality Inspections for the tenant.
    """
    stmt = select(QualityInspection).where(
        QualityInspection.company_id == tenant.company_id,
        QualityInspection.is_deleted == False
    )
    inspections = list((await db.execute(stmt)).scalars().all())
    for insp in inspections:
        l_stmt = select(QualityInspectionItem).where(QualityInspectionItem.inspection_id == insp.id)
        insp.items = list((await db.execute(l_stmt)).scalars().all())
    return inspections


@router.get("/inspections/{inspection_id}", response_model=QCInspectionResponse)
async def get_quality_inspection(
    inspection_id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Retrieves a Quality Inspection record by ID.
    """
    stmt = select(QualityInspection).where(
        QualityInspection.id == inspection_id,
        QualityInspection.company_id == tenant.company_id,
        QualityInspection.is_deleted == False
    )
    insp = (await db.execute(stmt)).scalars().first()
    if not insp:
        raise HTTPException(status_code=404, detail="Quality Inspection record not found")

    l_stmt = select(QualityInspectionItem).where(QualityInspectionItem.inspection_id == insp.id)
    insp.items = list((await db.execute(l_stmt)).scalars().all())
    return insp


@router.post("/inspections/{inspection_id}/evaluate", response_model=QCInspectionResponse)
async def evaluate_quality_inspection(
    inspection_id: str,
    req_body: QCEvaluationRequest,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Submits QC line item evaluations, updates inspection outcome, and generates automated Supplier Debit Note draft if rejected items exist.
    """
    engine = QCInspectionEngine(db, tenant)
    items_in = [eval_req.model_dump() for eval_req in req_body.evaluations]
    return await engine.evaluate_inspection(inspection_id=inspection_id, line_evaluations=items_in, remarks=req_body.remarks)


@router.get("/debit-notes", response_model=List[SupplierDebitNoteResponse])
async def list_supplier_debit_notes(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Lists all Supplier Debit Notes generated from rejected QC inspections for the tenant.
    """
    stmt = select(SupplierDebitNote).where(
        SupplierDebitNote.company_id == tenant.company_id,
        SupplierDebitNote.is_deleted == False
    )
    return list((await db.execute(stmt)).scalars().all())
