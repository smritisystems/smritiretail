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
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.purchase import (
    PurchaseRequisition, PurchaseRequisitionLine,
    RequisitionApproval, RequisitionApprovalPolicy
)
from app.api.deps import TenantContext


class ApprovalChainEngine:
    """
    ApprovalChainEngine — Domain service for multi-level Purchase Requisition approval routing.
    Evaluates data-driven policy thresholds, builds multi-stage approval chains, and manages FSM transitions.
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    async def submit_for_approval(self, requisition_id: str) -> PurchaseRequisition:
        # 1. Fetch & Validate Requisition
        stmt = select(PurchaseRequisition).where(
            PurchaseRequisition.id == requisition_id,
            PurchaseRequisition.company_id == self.tenant.company_id,
            PurchaseRequisition.is_deleted == False
        )
        req = (await self.db.execute(stmt)).scalars().first()
        if not req:
            raise HTTPException(status_code=404, detail=f"Purchase Requisition '{requisition_id}' not found")

        if req.status not in ("Draft", "Submitted"):
            raise HTTPException(status_code=400, detail=f"Cannot submit requisition in status '{req.status}' for approval.")

        # 2. Fetch Policies or Build Default Threshold Chains
        policy_stmt = select(RequisitionApprovalPolicy).where(
            RequisitionApprovalPolicy.company_id == self.tenant.company_id,
            RequisitionApprovalPolicy.is_deleted == False
        ).order_by(RequisitionApprovalPolicy.stage_order.asc())
        policies = list((await self.db.execute(policy_stmt)).scalars().all())

        est_total = Decimal(str(req.estimated_total))
        applicable_stages = []

        if policies:
            for pol in policies:
                min_v = Decimal(str(pol.min_value))
                max_v = Decimal(str(pol.max_value)) if pol.max_value is not None else None
                if est_total >= min_v and (max_v is None or est_total <= max_v):
                    if not pol.auto_approve and pol.required_approver_role:
                        applicable_stages.append({
                            "stage_name": pol.policy_name,
                            "role": pol.required_approver_role,
                        })
        else:
            # Standard Default Threshold Engine:
            # <= 10,000 -> Auto-Approve
            # 10,001..50,000 -> Department Head
            # 50,001..200,000 -> Department Head + Finance Manager
            # > 200,000 -> Department Head + Finance Manager + Executive Management
            if est_total > Decimal("10000.00"):
                applicable_stages.append({"stage_name": "Department Head Approval", "role": "DEPT_HEAD"})
            if est_total > Decimal("50000.00"):
                applicable_stages.append({"stage_name": "Finance Manager Approval", "role": "FINANCE"})
            if est_total > Decimal("200000.00"):
                applicable_stages.append({"stage_name": "Executive Management Approval", "role": "MANAGEMENT"})

        # 3. Process Approval Route
        if not applicable_stages:
            req.status = "Approved"
            req.current_approval_stage = None
        else:
            req.status = "UnderApproval"
            req.current_approval_stage = 1

            approval_objs = []
            for idx, stage in enumerate(applicable_stages, start=1):
                app_obj = RequisitionApproval(
                    id=f"req-app-{uuid.uuid4().hex[:10]}",
                    uuid=str(uuid.uuid4()),
                    tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
                    company_id=self.tenant.company_id,
                    branch_id=self.tenant.branch_id,
                    requisition_id=req.id,
                    stage_order=idx,
                    stage_name=stage["stage_name"],
                    required_approver_role=stage["role"],
                    decision="PENDING"
                )
                approval_objs.append(app_obj)

            self.db.add_all(approval_objs)

        self.db.add(req)
        await self.db.commit()
        await self.db.refresh(req)
        return req

    async def record_decision(
        self,
        requisition_id: str,
        approver_id: str,
        decision: str,
        notes: Optional[str] = None
    ) -> PurchaseRequisition:
        # 1. Fetch Requisition
        stmt = select(PurchaseRequisition).where(
            PurchaseRequisition.id == requisition_id,
            PurchaseRequisition.company_id == self.tenant.company_id,
            PurchaseRequisition.is_deleted == False
        )
        req = (await self.db.execute(stmt)).scalars().first()
        if not req:
            raise HTTPException(status_code=404, detail=f"Purchase Requisition '{requisition_id}' not found")

        if req.status != "UnderApproval":
            raise HTTPException(status_code=400, detail=f"Cannot record decision on requisition in status '{req.status}'. Must be 'UnderApproval'.")

        decision_upper = decision.upper()
        if decision_upper not in ("APPROVED", "REJECTED"):
            raise HTTPException(status_code=400, detail="Decision must be either 'APPROVED' or 'REJECTED'")

        # 2. Fetch Current Approval Stage
        app_stmt = select(RequisitionApproval).where(
            RequisitionApproval.requisition_id == req.id,
            RequisitionApproval.stage_order == req.current_approval_stage,
            RequisitionApproval.decision == "PENDING"
        )
        pending_app = (await self.db.execute(app_stmt)).scalars().first()
        if not pending_app:
            raise HTTPException(status_code=404, detail=f"No pending approval stage found for order {req.current_approval_stage}")

        now = datetime.now(timezone.utc)
        pending_app.approver_id = approver_id
        pending_app.decision = decision_upper
        pending_app.decided_at = now
        pending_app.notes = notes
        self.db.add(pending_app)

        if decision_upper == "REJECTED":
            req.status = "Rejected"
            self.db.add(req)
        else:
            # Check if there is a next pending stage
            next_stmt = select(RequisitionApproval).where(
                RequisitionApproval.requisition_id == req.id,
                RequisitionApproval.stage_order > req.current_approval_stage
            ).order_by(RequisitionApproval.stage_order.asc())
            next_app = (await self.db.execute(next_stmt)).scalars().first()

            if next_app:
                req.current_approval_stage = next_app.stage_order
            else:
                req.status = "Approved"

            self.db.add(req)

        await self.db.commit()
        await self.db.refresh(req)
        return req
