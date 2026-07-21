"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.1.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import uuid
from decimal import Decimal
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import get_db
from app.api.deps import TenantContext, get_tenant_context
from app.models.purchase import (
    PurchaseRequisition, PurchaseRequisitionLine, RequisitionApproval, RequisitionApprovalPolicy
)
from app.models.inventory import Product
from app.schemas.purchase import (
    RequisitionCreate, RequisitionResponse,
    ApprovalDecisionRequest, RequisitionConvertRequest,
    ApprovalPolicyCreate, ApprovalPolicyResponse
)
from app.procurement.engine.approval_chain_engine import ApprovalChainEngine
from app.procurement.engine.requisition_conversion_engine import RequisitionConversionEngine

router = APIRouter(prefix="/purchase/requisitions", tags=["Procurement Purchase Requisitions"])


@router.post("", response_model=RequisitionResponse, status_code=status.HTTP_201_CREATED)
async def create_requisition(
    req_in: RequisitionCreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Creates a new draft Purchase Requisition with line items and computes estimated total.
    """
    req_id = f"req-{uuid.uuid4().hex[:12]}"
    est_total = Decimal("0.00")
    line_objs = []

    for line in req_in.lines:
        # Validate product
        p_stmt = select(Product).where(Product.id == line.product_id, Product.is_deleted == False)
        product = (await db.execute(p_stmt)).scalars().first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product '{line.product_id}' not found")

        qty = Decimal(str(line.requested_quantity))
        price = Decimal(str(line.estimated_unit_price))
        line_tot = (qty * price).quantize(Decimal("0.01"))
        est_total += line_tot

        r_line = PurchaseRequisitionLine(
            id=f"reql-{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(tenant, "tenant_id", None) or tenant.company_id,
            company_id=tenant.company_id,
            branch_id=tenant.branch_id,
            requisition_id=req_id,
            product_id=line.product_id,
            requested_quantity=qty,
            estimated_unit_price=price,
            line_total=line_tot,
            preferred_supplier_id=line.preferred_supplier_id,
            notes=line.notes
        )
        line_objs.append(r_line)

    requisition = PurchaseRequisition(
        id=req_id,
        uuid=str(uuid.uuid4()),
        tenant_id=getattr(tenant, "tenant_id", None) or tenant.company_id,
        company_id=tenant.company_id,
        branch_id=tenant.branch_id,
        requisition_no=req_in.requisition_no,
        title=req_in.title,
        requestor_id=req_in.requestor_id,
        department=req_in.department,
        cost_center=req_in.cost_center,
        required_by_date=req_in.required_by_date,
        estimated_total=est_total.quantize(Decimal("0.01")),
        notes=req_in.notes,
        status="Draft"
    )

    db.add(requisition)
    db.add_all(line_objs)
    await db.commit()
    await db.refresh(requisition)

    requisition.lines = line_objs
    requisition.approvals = []
    return requisition


@router.get("", response_model=List[RequisitionResponse])
async def list_requisitions(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Lists all Purchase Requisitions for the tenant.
    """
    stmt = select(PurchaseRequisition).where(
        PurchaseRequisition.company_id == tenant.company_id,
        PurchaseRequisition.is_deleted == False
    )
    reqs = list((await db.execute(stmt)).scalars().all())
    for r in reqs:
        l_stmt = select(PurchaseRequisitionLine).where(PurchaseRequisitionLine.requisition_id == r.id)
        a_stmt = select(RequisitionApproval).where(RequisitionApproval.requisition_id == r.id).order_by(RequisitionApproval.stage_order.asc())
        r.lines = list((await db.execute(l_stmt)).scalars().all())
        r.approvals = list((await db.execute(a_stmt)).scalars().all())
    return reqs


@router.get("/{requisition_id}", response_model=RequisitionResponse)
async def get_requisition(
    requisition_id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Retrieves a Purchase Requisition by ID.
    """
    stmt = select(PurchaseRequisition).where(
        PurchaseRequisition.id == requisition_id,
        PurchaseRequisition.company_id == tenant.company_id,
        PurchaseRequisition.is_deleted == False
    )
    req = (await db.execute(stmt)).scalars().first()
    if not req:
        raise HTTPException(status_code=404, detail="Purchase Requisition not found")

    l_stmt = select(PurchaseRequisitionLine).where(PurchaseRequisitionLine.requisition_id == req.id)
    a_stmt = select(RequisitionApproval).where(RequisitionApproval.requisition_id == req.id).order_by(RequisitionApproval.stage_order.asc())
    req.lines = list((await db.execute(l_stmt)).scalars().all())
    req.approvals = list((await db.execute(a_stmt)).scalars().all())
    return req


@router.post("/{requisition_id}/submit", response_model=RequisitionResponse)
async def submit_requisition(
    requisition_id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Submits a Purchase Requisition for approval using the ApprovalChainEngine.
    """
    engine = ApprovalChainEngine(db, tenant)
    req = await engine.submit_for_approval(requisition_id)
    return await get_requisition(req.id, db, tenant)


@router.post("/{requisition_id}/approve", response_model=RequisitionResponse)
async def record_approval_decision(
    requisition_id: str,
    req_body: ApprovalDecisionRequest,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Records an approval decision (APPROVED or REJECTED) on the active stage of a requisition.
    """
    engine = ApprovalChainEngine(db, tenant)
    req = await engine.record_decision(
        requisition_id=requisition_id,
        approver_id=req_body.approver_id,
        decision=req_body.decision,
        notes=req_body.notes
    )
    return await get_requisition(req.id, db, tenant)


@router.post("/{requisition_id}/convert")
async def convert_requisition(
    requisition_id: str,
    req_body: RequisitionConvertRequest,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Converts an Approved Purchase Requisition into a Direct PO, RFQ, or BPA Release PO.
    """
    engine = RequisitionConversionEngine(db, tenant)
    res = await engine.convert(
        requisition_id=requisition_id,
        strategy=req_body.strategy,
        supplier_id=req_body.supplier_id,
        bpa_id=req_body.bpa_id
    )
    return {
        "status": "SUCCESS",
        "requisition_id": requisition_id,
        "converted_doc_type": res["converted_doc_type"],
        "converted_doc_id": res["converted_doc_id"]
    }


@router.post("/policies", response_model=ApprovalPolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_approval_policy(
    pol_in: ApprovalPolicyCreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Creates a new data-driven Requisition Approval Policy for the tenant.
    """
    pol_id = f"pol-{uuid.uuid4().hex[:10]}"
    policy = RequisitionApprovalPolicy(
        id=pol_id,
        uuid=str(uuid.uuid4()),
        tenant_id=getattr(tenant, "tenant_id", None) or tenant.company_id,
        company_id=tenant.company_id,
        branch_id=tenant.branch_id,
        policy_name=pol_in.policy_name,
        min_value=pol_in.min_value,
        max_value=pol_in.max_value,
        required_approver_role=pol_in.required_approver_role,
        stage_order=pol_in.stage_order,
        auto_approve=pol_in.auto_approve
    )
    db.add(policy)
    await db.commit()
    await db.refresh(policy)
    return policy


@router.get("/policies", response_model=List[ApprovalPolicyResponse])
async def list_approval_policies(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Lists all Requisition Approval Policies for the tenant.
    """
    stmt = select(RequisitionApprovalPolicy).where(
        RequisitionApprovalPolicy.company_id == tenant.company_id,
        RequisitionApprovalPolicy.is_deleted == False
    ).order_by(RequisitionApprovalPolicy.stage_order.asc())
    return list((await db.execute(stmt)).scalars().all())
