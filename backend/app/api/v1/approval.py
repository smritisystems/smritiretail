"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import traceback
from typing import Dict, Any, List, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...api.deps import get_company_db, get_current_user
from ...models.approval import ApprovalPolicy, ApprovalRequest, ApprovalAction
from ...services.approval_engine import ApprovalEngine
from ...schemas.approval import (
    ApprovalPolicyCreateRequest,
    ApprovalPolicyResponse,
    ApprovalEnforcementCheckRequest,
    ApprovalEnforcementCheckResponse,
    ApprovalRequestCreateRequest,
    ApprovalRequestResponse,
    ApprovalActionDetailResponse,
    ApprovalActionRequest,
    ApprovalActionResponse,
    ApprovalEscalationRequest,
    ApprovalEscalationResponse,
)

router = APIRouter()


def _extract_user_info(current_user: Any) -> Tuple[str, str, str]:
    if isinstance(current_user, dict):
        comp_id = current_user.get("company_id", "COMP-001")
        user_id = current_user.get("sub", "usr-system")
        role = current_user.get("role", "CASHIER")
    else:
        comp_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
        user_id = getattr(current_user, "id", None) or getattr(current_user, "username", "usr-system")
        role = getattr(current_user, "role", "CASHIER")
        if hasattr(role, "value"):
            role = role.value
    return comp_id, user_id, str(role).upper()


# ============================================================================
# APPROVAL POLICY ENDPOINTS
# ============================================================================

@router.post("/policies", response_model=ApprovalPolicyResponse, status_code=status.HTTP_201_CREATED, summary="Create Approval Policy")
async def create_approval_policy(
    req: ApprovalPolicyCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Creates a multi-tier threshold approval policy configuration."""
    try:
        company_id, user_id, _ = _extract_user_info(current_user)
        return await ApprovalEngine.create_policy(
            session=db,
            company_id=company_id,
            req=req,
            created_by=user_id,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/policies", response_model=List[ApprovalPolicyResponse], summary="List Approval Policies")
async def list_approval_policies(
    document_type: Optional[str] = None,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Lists configured threshold approval policies for the company."""
    company_id, _, _ = _extract_user_info(current_user)
    stmt = select(ApprovalPolicy).where(ApprovalPolicy.company_id == company_id, ApprovalPolicy.is_deleted == False)
    if document_type:
        stmt = stmt.where(ApprovalPolicy.document_type == document_type.upper())
    policies = (await db.execute(stmt.order_by(ApprovalPolicy.priority.desc()))).scalars().all()
    return [
        ApprovalPolicyResponse(
            id=p.id,
            name=p.name,
            code=p.code,
            document_type=p.document_type,
            min_amount=p.min_amount,
            max_amount=p.max_amount,
            required_role=p.required_role,
            priority=p.priority,
            status=p.status,
            description=p.description,
        )
        for p in policies
    ]


# ============================================================================
# TRANSACTION GATING & ENFORCEMENT ENDPOINTS
# ============================================================================

@router.post("/enforce", response_model=ApprovalEnforcementCheckResponse, summary="Evaluate Transaction Approval Gate")
async def check_enforcement(
    req: ApprovalEnforcementCheckRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Checks whether a transaction amount exceeds threshold limits for the caller role."""
    company_id, _, user_role = _extract_user_info(current_user)
    if not req.caller_role:
        req.caller_role = user_role
    return await ApprovalEngine.check_transaction_enforcement(db, company_id, req)


# ============================================================================
# APPROVAL REQUESTS & ACTIONS ENDPOINTS
# ============================================================================

@router.post("/requests", response_model=ApprovalRequestResponse, status_code=status.HTTP_201_CREATED, summary="Submit Approval Request")
async def submit_approval_request(
    req: ApprovalRequestCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Submits a transaction into the approval request state machine."""
    try:
        company_id, user_id, _ = _extract_user_info(current_user)
        return await ApprovalEngine.submit_approval_request(
            session=db,
            company_id=company_id,
            req=req,
            requested_by=user_id,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/requests", response_model=List[ApprovalRequestResponse], summary="Query Approval Requests")
async def list_approval_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Lists approval requests with embedded action audit history."""
    company_id, _, _ = _extract_user_info(current_user)
    stmt = (
        select(ApprovalRequest)
        .options(selectinload(ApprovalRequest.actions))
        .where(ApprovalRequest.company_id == company_id, ApprovalRequest.is_deleted == False)
    )
    if status_filter:
        stmt = stmt.where(ApprovalRequest.status == status_filter.upper())
    requests = (await db.execute(stmt.order_by(ApprovalRequest.created_at.desc()))).scalars().all()

    return [
        ApprovalRequestResponse(
            id=r.id,
            request_no=r.request_no,
            reference_doc_type=r.reference_doc_type,
            reference_doc_id=r.reference_doc_id,
            policy_id=r.policy_id,
            document_amount=r.document_amount,
            requested_by=r.requested_by,
            status=r.status,
            current_assigned_role=r.current_assigned_role,
            notes=r.notes,
            actions=[
                ApprovalActionDetailResponse(
                    id=a.id,
                    action=a.action,
                    action_by=a.action_by,
                    action_by_role=a.action_by_role,
                    comments=a.comments,
                    action_at=a.action_at or a.created_at,
                )
                for a in r.actions
            ],
        )
        for r in requests
    ]


@router.post("/action", response_model=ApprovalActionResponse, summary="Execute Approval Decision")
async def execute_approval_action(
    req: ApprovalActionRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Authorizes, rejects, or requests changes on an approval request with RBAC enforcement."""
    try:
        company_id, user_id, user_role = _extract_user_info(current_user)
        return await ApprovalEngine.process_approval_action(
            session=db,
            company_id=company_id,
            req=req,
            action_by=user_id,
            action_by_role=user_role,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/escalate", response_model=ApprovalEscalationResponse, summary="Escalate Approval Request")
async def escalate_request(
    req: ApprovalEscalationRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Escalates a pending approval request to a senior role."""
    try:
        company_id, user_id, user_role = _extract_user_info(current_user)
        return await ApprovalEngine.escalate_approval_request(
            session=db,
            company_id=company_id,
            req=req,
            action_by=user_id,
            action_by_role=user_role,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
