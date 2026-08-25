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

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any, List, Optional
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.approval import ApprovalPolicy, ApprovalRequest, ApprovalAction
from ..schemas.approval import (
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


class ApprovalEngine:
    """
    Authoritative SMRITI Approval Matrix Engine (Section 7).
    Governs multi-tier threshold policies, transaction enforcement gates,
    role-based authorization checks, escalation workflows, and immutable decision audit trails.
    """

    ROLE_HIERARCHY = {
        "CASHIER": 1,
        "SALES_EXECUTIVE": 2,
        "STORE_MANAGER": 3,
        "FINANCE_CONTROLLER": 4,
        "DIRECTOR": 5,
        "SYSADMIN": 10,
    }

    @classmethod
    async def create_policy(
        cls,
        session: AsyncSession,
        company_id: str,
        req: ApprovalPolicyCreateRequest,
        created_by: Optional[str] = None,
    ) -> ApprovalPolicyResponse:
        """Creates an approval policy threshold configuration."""
        stmt = select(ApprovalPolicy).where(
            ApprovalPolicy.company_id == company_id,
            ApprovalPolicy.code == req.code,
            ApprovalPolicy.is_deleted == False
        )
        existing = (await session.execute(stmt)).scalars().first()
        if existing:
            raise ValueError(f"Approval policy with code '{req.code}' already exists.")

        policy = ApprovalPolicy(
            id=f"ap_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            name=req.name,
            code=req.code,
            document_type=req.document_type.upper(),
            min_amount=req.min_amount,
            max_amount=req.max_amount,
            required_role=req.required_role.upper(),
            priority=req.priority,
            status="ACTIVE",
            description=req.description,
            created_by=created_by,
            is_active=True,
            is_deleted=False,
        )
        session.add(policy)
        await session.commit()

        return ApprovalPolicyResponse(
            id=policy.id,
            name=policy.name,
            code=policy.code,
            document_type=policy.document_type,
            min_amount=policy.min_amount,
            max_amount=policy.max_amount,
            required_role=policy.required_role,
            priority=policy.priority,
            status=policy.status,
            description=policy.description,
        )

    @classmethod
    async def check_transaction_enforcement(
        cls,
        session: AsyncSession,
        company_id: str,
        req: ApprovalEnforcementCheckRequest,
    ) -> ApprovalEnforcementCheckResponse:
        """
        Evaluates whether a transaction amount triggers an approval policy requirement.
        """
        doc_type = req.document_type.upper()
        stmt = (
            select(ApprovalPolicy)
            .where(
                ApprovalPolicy.company_id == company_id,
                ApprovalPolicy.document_type == doc_type,
                ApprovalPolicy.status == "ACTIVE",
                ApprovalPolicy.is_deleted == False,
                ApprovalPolicy.min_amount <= req.document_amount,
                or_(
                    ApprovalPolicy.max_amount == None,
                    ApprovalPolicy.max_amount >= req.document_amount,
                ),
            )
            .order_by(ApprovalPolicy.priority.desc(), ApprovalPolicy.min_amount.desc())
        )
        policy = (await session.execute(stmt)).scalars().first()

        if not policy:
            return ApprovalEnforcementCheckResponse(
                requires_approval=False,
                matching_policy_code=None,
                required_role=None,
                reason="Document amount within standard transaction limit.",
            )

        caller_level = cls.ROLE_HIERARCHY.get(req.caller_role.upper(), 1)
        required_level = cls.ROLE_HIERARCHY.get(policy.required_role.upper(), 3)

        if caller_level >= required_level:
            return ApprovalEnforcementCheckResponse(
                requires_approval=False,
                matching_policy_code=policy.code,
                required_role=policy.required_role,
                reason=f"Caller role '{req.caller_role}' holds sufficient authority for policy '{policy.name}'.",
            )

        return ApprovalEnforcementCheckResponse(
            requires_approval=True,
            matching_policy_code=policy.code,
            required_role=policy.required_role,
            reason=f"Amount ₹{req.document_amount} requires '{policy.required_role}' approval (Policy: {policy.name}).",
        )

    @classmethod
    async def submit_approval_request(
        cls,
        session: AsyncSession,
        company_id: str,
        req: ApprovalRequestCreateRequest,
        requested_by: str,
    ) -> ApprovalRequestResponse:
        """Submits a transaction approval request into the pending state."""
        doc_type = req.reference_doc_type.upper()

        # Find matching policy
        stmt = (
            select(ApprovalPolicy)
            .where(
                ApprovalPolicy.company_id == company_id,
                ApprovalPolicy.document_type == doc_type,
                ApprovalPolicy.status == "ACTIVE",
                ApprovalPolicy.is_deleted == False,
                ApprovalPolicy.min_amount <= req.document_amount,
                or_(
                    ApprovalPolicy.max_amount == None,
                    ApprovalPolicy.max_amount >= req.document_amount,
                ),
            )
            .order_by(ApprovalPolicy.priority.desc(), ApprovalPolicy.min_amount.desc())
        )
        policy = (await session.execute(stmt)).scalars().first()

        assigned_role = policy.required_role if policy else "STORE_MANAGER"
        policy_id = policy.id if policy else None

        now = datetime.now(timezone.utc)
        req_no = f"APR-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        app_req = ApprovalRequest(
            id=f"apr_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            request_no=req_no,
            reference_doc_type=doc_type,
            reference_doc_id=req.reference_doc_id,
            policy_id=policy_id,
            document_amount=req.document_amount,
            requested_by=requested_by,
            status="PENDING",
            current_assigned_role=assigned_role,
            notes=req.notes,
            created_by=requested_by,
            is_active=True,
            is_deleted=False,
        )
        session.add(app_req)
        await session.commit()

        return ApprovalRequestResponse(
            id=app_req.id,
            request_no=app_req.request_no,
            reference_doc_type=app_req.reference_doc_type,
            reference_doc_id=app_req.reference_doc_id,
            policy_id=app_req.policy_id,
            document_amount=app_req.document_amount,
            requested_by=app_req.requested_by,
            status=app_req.status,
            current_assigned_role=app_req.current_assigned_role,
            notes=app_req.notes,
            actions=[],
        )

    @classmethod
    async def process_approval_action(
        cls,
        session: AsyncSession,
        company_id: str,
        req: ApprovalActionRequest,
        action_by: str,
        action_by_role: str,
    ) -> ApprovalActionResponse:
        """
        Executes an approval decision (APPROVE, REJECT, REQUEST_CHANGES) with strict RBAC enforcement.
        """
        stmt = (
            select(ApprovalRequest)
            .options(selectinload(ApprovalRequest.actions))
            .where(
                ApprovalRequest.company_id == company_id,
                or_(
                    ApprovalRequest.id == req.request_id,
                    ApprovalRequest.request_no == req.request_id,
                ),
                ApprovalRequest.is_deleted == False,
            )
        )
        app_req = (await session.execute(stmt)).scalars().first()
        if not app_req:
            raise ValueError(f"Approval request '{req.request_id}' not found.")

        if app_req.status != "PENDING":
            raise ValueError(f"Approval request is already in '{app_req.status}' state.")

        # RBAC Check: Ensure caller possesses required or senior role
        caller_level = cls.ROLE_HIERARCHY.get(action_by_role.upper(), 1)
        required_level = cls.ROLE_HIERARCHY.get(app_req.current_assigned_role.upper(), 3)

        if caller_level < required_level:
            raise ValueError(
                f"Access Denied: Role '{action_by_role}' is insufficient to act on request assigned to '{app_req.current_assigned_role}'."
            )

        act_upper = req.action.upper()
        if act_upper == "APPROVE":
            new_status = "APPROVED"
        elif act_upper == "REJECT":
            new_status = "REJECTED"
        elif act_upper == "REQUEST_CHANGES":
            new_status = "CHANGES_REQUESTED"
        else:
            raise ValueError(f"Invalid approval action '{req.action}'. Allowed: APPROVE, REJECT, REQUEST_CHANGES.")

        now = datetime.now(timezone.utc)
        action_record = ApprovalAction(
            id=f"apa_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            request_id=app_req.id,
            action=act_upper,
            action_by=action_by,
            action_by_role=action_by_role,
            comments=req.comments,
            action_at=now,
            created_by=action_by,
            is_active=True,
            is_deleted=False,
        )
        session.add(action_record)
        app_req.status = new_status
        await session.commit()

        return ApprovalActionResponse(
            request_id=app_req.id,
            request_no=app_req.request_no,
            action=act_upper,
            action_by=action_by,
            action_by_role=action_by_role,
            new_status=new_status,
            timestamp=now,
            message=f"Request {app_req.request_no} has been {new_status.lower()}.",
        )

    @classmethod
    async def escalate_approval_request(
        cls,
        session: AsyncSession,
        company_id: str,
        req: ApprovalEscalationRequest,
        action_by: str,
        action_by_role: str,
    ) -> ApprovalEscalationResponse:
        """Escalates a pending approval request to a senior role."""
        stmt = (
            select(ApprovalRequest)
            .where(
                ApprovalRequest.company_id == company_id,
                or_(
                    ApprovalRequest.id == req.request_id,
                    ApprovalRequest.request_no == req.request_id,
                ),
                ApprovalRequest.is_deleted == False,
            )
        )
        app_req = (await session.execute(stmt)).scalars().first()
        if not app_req:
            raise ValueError(f"Approval request '{req.request_id}' not found.")

        if app_req.status != "PENDING":
            raise ValueError(f"Cannot escalate non-pending request (Current: {app_req.status}).")

        prev_role = app_req.current_assigned_role
        target_role = req.escalate_to_role.upper()

        now = datetime.now(timezone.utc)
        action_record = ApprovalAction(
            id=f"apa_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            request_id=app_req.id,
            action="ESCALATE",
            action_by=action_by,
            action_by_role=action_by_role,
            comments=f"Escalated from {prev_role} to {target_role}. Reason: {req.reason or 'Hierarchical escalation'}",
            action_at=now,
            created_by=action_by,
            is_active=True,
            is_deleted=False,
        )
        session.add(action_record)
        app_req.current_assigned_role = target_role
        await session.commit()

        return ApprovalEscalationResponse(
            request_id=app_req.id,
            request_no=app_req.request_no,
            previous_role=prev_role,
            new_role=target_role,
            status=app_req.status,
            escalated_at=now,
        )
