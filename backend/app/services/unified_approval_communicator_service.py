"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import re
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import select, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.approval import ApprovalPolicy, ApprovalRequest, ApprovalAction
from ..models.communicator import CommunicatorTemplate, CommunicatorLog


class UnifiedApprovalCommunicatorService:
    """
    Authoritative Multi-Tier Approval State Machine and Unified Notification Dispatch Engine.
    Enforces threshold-based approval routing and multi-channel communication audit logs.
    """

    # =========================================================================
    # 1. APPROVAL POLICY EVALUATION & REQUEST SUBMISSION
    # =========================================================================
    @classmethod
    async def evaluate_and_create_approval_request(
        cls,
        session: AsyncSession,
        company_id: str,
        reference_doc_type: str,
        reference_doc_id: str,
        document_amount: float | Decimal,
        requested_by: str,
        branch_id: str = "BR-001",
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluates transaction amount against configured approval policies.
        If a policy triggers, instantiates a PENDING ApprovalRequest.
        """
        amt = Decimal(str(document_amount))
        clean_doc_type = reference_doc_type.strip().upper()

        # Find highest priority matching policy
        policy_stmt = (
            select(ApprovalPolicy)
            .where(
                ApprovalPolicy.document_type == clean_doc_type,
                ApprovalPolicy.min_amount <= amt,
                ApprovalPolicy.status == "ACTIVE",
                ApprovalPolicy.is_deleted == False
            )
            .order_by(desc(ApprovalPolicy.min_amount), ApprovalPolicy.priority)
        )
        policies = (await session.execute(policy_stmt)).scalars().all()
        
        # Check max_amount bounds if applicable
        matching_policy: Optional[ApprovalPolicy] = None
        for p in policies:
            if p.max_amount is None or amt <= Decimal(str(p.max_amount)):
                matching_policy = p
                break

        if not matching_policy:
            return {
                "requires_approval": False,
                "approval_request": None,
                "reason": "No triggering approval policy criteria met."
            }

        req_id = f"apr_{uuid.uuid4().hex[:12]}"
        req_no = f"APR-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        req = ApprovalRequest(
            id=req_id,
            company_id=company_id,
            branch_id=branch_id,
            request_no=req_no,
            reference_doc_type=clean_doc_type,
            reference_doc_id=reference_doc_id,
            policy_id=matching_policy.id,
            document_amount=amt,
            requested_by=requested_by,
            status="PENDING",
            current_assigned_role=matching_policy.required_role,
            notes=notes or f"Triggered by policy '{matching_policy.name}' (Threshold >= {matching_policy.min_amount})",
            is_active=True,
            is_deleted=False
        )
        session.add(req)
        await session.commit()

        refetch_stmt = (
            select(ApprovalRequest)
            .where(ApprovalRequest.id == req_id)
            .options(selectinload(ApprovalRequest.actions))
        )
        saved_req = (await session.execute(refetch_stmt)).scalar_one()

        return {
            "requires_approval": True,
            "approval_request": saved_req,
            "required_role": matching_policy.required_role,
            "policy_name": matching_policy.name
        }

    # =========================================================================
    # 2. APPROVAL ACTION PROCESSING
    # =========================================================================
    @classmethod
    async def process_approval_action(
        cls,
        session: AsyncSession,
        company_id: str,
        request_id: str,
        action: str,  # APPROVE, REJECT, REQUEST_CHANGES
        action_by: str,
        action_by_role: str,
        comments: Optional[str] = None,
        branch_id: str = "BR-001"
    ) -> ApprovalRequest:
        """
        Executes an approval decision, transitioning the state machine and logging the immutable action audit.
        """
        clean_action = action.strip().upper()
        if clean_action not in ["APPROVE", "REJECT", "REQUEST_CHANGES"]:
            raise ValueError(f"Invalid approval action '{clean_action}'. Must be APPROVE, REJECT, or REQUEST_CHANGES.")

        stmt = (
            select(ApprovalRequest)
            .where(
                ApprovalRequest.id == request_id,
                ApprovalRequest.is_deleted == False
            )
            .options(selectinload(ApprovalRequest.actions))
        )
        req = (await session.execute(stmt)).scalar_one_or_none()
        if not req:
            raise ValueError(f"Approval request with ID '{request_id}' not found.")

        if req.status in ["APPROVED", "REJECTED"]:
            raise ValueError(f"Approval request '{req.request_no}' is already in terminal state '{req.status}'.")

        # Record action
        act = ApprovalAction(
            id=f"apa_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            branch_id=branch_id,
            request_id=req.id,
            action=clean_action,
            action_by=action_by,
            action_by_role=action_by_role,
            comments=comments,
            is_active=True,
            is_deleted=False
        )
        session.add(act)

        # Transition Request Status
        if clean_action == "APPROVE":
            req.status = "APPROVED"
        elif clean_action == "REJECT":
            req.status = "REJECTED"
        elif clean_action == "REQUEST_CHANGES":
            req.status = "CHANGES_REQUESTED"

        await session.commit()
        session.expire_all()

        refetch_stmt = (
            select(ApprovalRequest)
            .where(ApprovalRequest.id == request_id)
            .options(selectinload(ApprovalRequest.actions))
        )
        return (await session.execute(refetch_stmt)).scalar_one()

    # =========================================================================
    # 3. COMMUNICATOR TEMPLATE RENDERING & DISPATCH LOGGING
    # =========================================================================
    @classmethod
    async def render_and_dispatch_message(
        cls,
        session: AsyncSession,
        company_id: str,
        template_code: str,
        recipient: str,
        context_data: Dict[str, Any],
        reference_doc_type: Optional[str] = None,
        reference_doc_id: Optional[str] = None,
        branch_id: str = "BR-001"
    ) -> CommunicatorLog:
        """
        Renders template variables and writes an immutable dispatch audit record to communicator_logs.
        """
        clean_code = template_code.strip().upper()
        tpl_stmt = select(CommunicatorTemplate).where(
            CommunicatorTemplate.code == clean_code,
            CommunicatorTemplate.status == "ACTIVE",
            CommunicatorTemplate.is_deleted == False
        )
        tpl = (await session.execute(tpl_stmt)).scalar_one_or_none()
        if not tpl:
            raise ValueError(f"Active communicator template '{clean_code}' not found.")

        # Replace {{key}} placeholders
        rendered_body = tpl.body_template
        rendered_subject = tpl.subject_template

        for key, val in context_data.items():
            pattern = re.compile(r"\{\{\s*" + re.escape(key) + r"\s*\}\}")
            rendered_body = pattern.sub(str(val), rendered_body)
            if rendered_subject:
                rendered_subject = pattern.sub(str(val), rendered_subject)

        log = CommunicatorLog(
            id=f"cml_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            branch_id=branch_id,
            template_id=tpl.id,
            channel=tpl.channel,
            recipient=recipient,
            reference_doc_type=reference_doc_type,
            reference_doc_id=reference_doc_id,
            rendered_subject=rendered_subject,
            rendered_body=rendered_body,
            status="SENT",
            gateway_response="SIMULATED_DISPATCH_SUCCESS",
            is_active=True,
            is_deleted=False
        )
        session.add(log)
        await session.commit()

        res_stmt = select(CommunicatorLog).where(CommunicatorLog.id == log.id)
        return (await session.execute(res_stmt)).scalar_one()
