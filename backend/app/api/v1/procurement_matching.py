"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.8.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import get_db
from app.api.deps import TenantContext, get_tenant_context
from app.procurement.engine.matching_engine import MatchingEngine
from app.procurement.engine.landed_cost_engine import LandedCostEngine
from app.models.purchase import ProcurementTolerancePolicy
from app.schemas.purchase import (
    ThreeWayMatchRequest,
    ThreeWayMatchResponse,
    LandedCostAllocationRequest,
    TolerancePolicyCreate,
    TolerancePolicyResponse,
)

router = APIRouter(prefix="/purchase/matching", tags=["Procurement Matching & Valuation"])


@router.post("/three-way-match", response_model=ThreeWayMatchResponse, status_code=status.HTTP_201_CREATED)
async def execute_three_way_match(
    req: ThreeWayMatchRequest,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Executes automated 3-Way Matching (PO <-> GRN <-> Vendor Bill).
    Evaluates variances against tolerance policies and flags blocked bills for payment approval.
    """
    engine = MatchingEngine(db, tenant)
    billed_items_dict = [b.model_dump() for b in req.billed_items]
    return await engine.execute_three_way_match(
        po_id=req.po_id,
        grn_id=req.grn_id,
        vendor_bill_no=req.vendor_bill_no,
        billed_items=billed_items_dict,
        vendor_bill_date=req.vendor_bill_date
    )


@router.post("/grn/{grn_id}/allocate-landed-cost", status_code=status.HTTP_200_OK)
async def allocate_landed_cost(
    grn_id: str,
    req: LandedCostAllocationRequest,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Allocates secondary landed costs (Freight, Customs, Insurance, Handling) over GRN items.
    Supports VALUE, WEIGHT, VOLUME, QUANTITY, and MANUAL allocation methods.
    """
    engine = LandedCostEngine(db, tenant)
    vouchers_dict = [v.model_dump() for v in req.vouchers]
    updated_items = await engine.allocate_landed_costs(
        grn_id=grn_id,
        vouchers_in=vouchers_dict,
        manual_ratios=req.manual_ratios
    )
    return {
        "grn_id": grn_id,
        "items_updated": len(updated_items),
        "status": "Landed costs allocated successfully"
    }


@router.post("/{match_id}/approve", response_model=ThreeWayMatchResponse)
async def approve_variance_block(
    match_id: str,
    approved_by: str = Query(...),
    approval_notes: str = Query(...),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Supervisor Approval Override Workflow for Blocked 3-Way Matches.
    """
    engine = MatchingEngine(db, tenant)
    return await engine.approve_variance_block(match_id=match_id, approved_by=approved_by, approval_notes=approval_notes)


@router.post("/tolerance-policies", response_model=TolerancePolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_tolerance_policy(
    policy_in: TolerancePolicyCreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Configures a multi-level tolerance policy (SYSTEM, COMPANY, VENDOR, PRODUCT).
    """
    policy_obj = ProcurementTolerancePolicy(
        id=f"ptp-{uuid.uuid4().hex[:12]}",
        uuid=str(uuid.uuid4()),
        tenant_id=getattr(tenant, "tenant_id", None) or tenant.company_id,
        company_id=tenant.company_id,
        branch_id=tenant.branch_id,
        level=policy_in.level.upper(),
        target_id=policy_in.target_id,
        allowed_price_variance_pct=policy_in.allowed_price_variance_pct,
        allowed_qty_variance_pct=policy_in.allowed_qty_variance_pct,
        auto_approve_under_threshold=policy_in.auto_approve_under_threshold
    )
    db.add(policy_obj)
    await db.commit()
    await db.refresh(policy_obj)
    return policy_obj
