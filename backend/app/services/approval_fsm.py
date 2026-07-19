"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..models.approval import (
    ApprovalRequestStatus,
    SMRITIApprovalRequest,
    SMRITIApprovalAction,
    SMRITIApprovalHistory,
    SMRITIApprovalOutbox,
)
from .approval_resolver import ApprovalResolver

logger = logging.getLogger("smriti.approval_fsm")


class ApprovalFSM:
    """
    Finite State Machine for Approval Workflows.
    Enforces optimistic locking (`version`), document hash integrity,
    and transactional outbox event publishing.
    """

    def __init__(self, resolver: Optional[ApprovalResolver] = None):
        self.resolver = resolver or ApprovalResolver()

    @staticmethod
    def calculate_document_hash(payload: Dict[str, Any]) -> str:
        """Compute SHA-256 digest of normalized document payload."""
        normalized_str = json.dumps(payload, sort_keys=True, default=str)
        return hashlib.sha256(normalized_str.encode("utf-8")).hexdigest()

    async def submit_document(
        self,
        db: AsyncSession,
        document_type: str,
        document_id: str,
        payload: Dict[str, Any],
        requester_id: str,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Submit a document for approval evaluation.
        If no policy matches or amount is within threshold, returns auto-approved.
        Otherwise creates an active SMRITIApprovalRequest with state SUBMITTED.
        """
        doc_hash = self.calculate_document_hash(payload)
        amount = Decimal(str(payload.get("amount", 0.00)))

        policy = await self.resolver.get_active_policy(db, document_type, company_id, branch_id)
        if not policy:
            logger.info(f"No active approval policy for {document_type}. Auto-approving.")
            return {
                "approved": True,
                "auto_approved": True,
                "request_id": None,
                "status": ApprovalRequestStatus.APPROVED.value,
                "message": "Auto-approved: No active approval policy.",
            }

        # Find matching matrix band
        matching_matrix = None
        for matrix in policy.matrices:
            min_amt = matrix.min_amount or Decimal("0.00")
            max_amt = matrix.max_amount
            if amount >= min_amt and (max_amt is None or amount <= max_amt):
                matching_matrix = matrix
                break

        if not matching_matrix or not matching_matrix.steps:
            logger.info(f"Document amount {amount} requires no step approval under policy {policy.code}. Auto-approving.")
            return {
                "approved": True,
                "auto_approved": True,
                "request_id": None,
                "status": ApprovalRequestStatus.APPROVED.value,
                "message": "Auto-approved: Within initial threshold.",
            }

        # Create approval request
        request_no = f"APR-{uuid.uuid4().hex[:8].upper()}"
        req = SMRITIApprovalRequest(
            id=str(uuid.uuid4()),
            request_no=request_no,
            document_type=document_type,
            document_id=document_id,
            document_hash=doc_hash,
            policy_version=policy.policy_version,
            requester_id=requester_id,
            current_step_number=1,
            status=ApprovalRequestStatus.PENDING.value,
            company_id=company_id,
            branch_id=branch_id,
        )
        db.add(req)

        # Log initial action and history
        action = SMRITIApprovalAction(
            id=str(uuid.uuid4()),
            request_id=req.id,
            step_number=1,
            action="SUBMIT",
            action_by=requester_id,
            remarks="Document submitted for approval",
        )
        history = SMRITIApprovalHistory(
            id=str(uuid.uuid4()),
            request_id=req.id,
            state_from=ApprovalRequestStatus.DRAFT.value,
            state_to=ApprovalRequestStatus.PENDING.value,
            transition_by=requester_id,
        )
        db.add(action)
        db.add(history)

        # Add transactional outbox event
        outbox = SMRITIApprovalOutbox(
            id=str(uuid.uuid4()),
            event_type="approval.requested",
            payload_json={
                "request_id": req.id,
                "request_no": request_no,
                "document_type": document_type,
                "document_id": document_id,
                "requester_id": requester_id,
            },
        )
        db.add(outbox)

        await db.commit()
        await db.refresh(req)

        return {
            "approved": False,
            "auto_approved": False,
            "request_id": req.id,
            "request_no": req.request_no,
            "status": req.status,
            "current_step": 1,
            "message": "Document submitted for multi-level approval.",
        }

    async def execute_action(
        self,
        db: AsyncSession,
        request_id: str,
        user_id: str,
        user_role: str,
        action: str,  # APPROVE, REJECT, OVERRIDE
        payload: Dict[str, Any],
        expected_version: int,
        remarks: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        is_platform_admin: bool = False,
    ) -> Dict[str, Any]:
        """Execute FSM step action with optimistic locking check."""
        stmt = select(SMRITIApprovalRequest).where(SMRITIApprovalRequest.id == request_id).with_for_update()
        res = await db.execute(stmt)
        req = res.scalars().first()

        if not req:
            raise ValueError(f"Approval request {request_id} not found.")

        # Optimistic locking check
        if req.version != expected_version:
            raise ValueError(f"Concurrency conflict: Request version is {req.version}, but expected {expected_version}.")

        # Verify payload hash integrity
        current_hash = self.calculate_document_hash(payload)
        if current_hash != req.document_hash:
            raise ValueError("Document payload integrity mismatch! Payload has been altered since submission.")

        if req.status not in (ApprovalRequestStatus.SUBMITTED.value, ApprovalRequestStatus.PENDING.value):
            raise ValueError(f"Cannot perform action on request in status '{req.status}'.")

        # Emergency override check
        if action == "OVERRIDE":
            if not is_platform_admin:
                raise PermissionError("Only Platform Administrators can perform emergency overrides.")

            old_status = req.status
            req.status = ApprovalRequestStatus.APPROVED.value
            req.version += 1

            act = SMRITIApprovalAction(
                id=str(uuid.uuid4()),
                request_id=req.id,
                step_number=req.current_step_number,
                action="EMERGENCY_OVERRIDE",
                action_by=user_id,
                remarks=remarks or "Emergency Admin Override",
                ip_address=ip_address,
                user_agent=user_agent,
            )
            hist = SMRITIApprovalHistory(
                id=str(uuid.uuid4()),
                request_id=req.id,
                state_from=old_status,
                state_to=ApprovalRequestStatus.APPROVED.value,
                transition_by=user_id,
            )
            outbox = SMRITIApprovalOutbox(
                id=str(uuid.uuid4()),
                event_type="approval.completed",
                payload_json={
                    "request_id": req.id,
                    "document_type": req.document_type,
                    "document_id": req.document_id,
                    "action": "EMERGENCY_OVERRIDE",
                },
            )
            db.add(act)
            db.add(hist)
            db.add(outbox)
            await db.commit()

            return {
                "success": True,
                "status": req.status,
                "message": "Emergency override completed.",
            }

        if action == "REJECT":
            old_status = req.status
            req.status = ApprovalRequestStatus.REJECTED.value
            req.version += 1

            act = SMRITIApprovalAction(
                id=str(uuid.uuid4()),
                request_id=req.id,
                step_number=req.current_step_number,
                action="REJECT",
                action_by=user_id,
                remarks=remarks,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            hist = SMRITIApprovalHistory(
                id=str(uuid.uuid4()),
                request_id=req.id,
                state_from=old_status,
                state_to=ApprovalRequestStatus.REJECTED.value,
                transition_by=user_id,
            )
            outbox = SMRITIApprovalOutbox(
                id=str(uuid.uuid4()),
                event_type="approval.rejected",
                payload_json={
                    "request_id": req.id,
                    "document_type": req.document_type,
                    "document_id": req.document_id,
                    "action_by": user_id,
                    "remarks": remarks,
                },
            )
            db.add(act)
            db.add(hist)
            db.add(outbox)
            await db.commit()

            return {
                "success": True,
                "status": req.status,
                "message": "Document approval request rejected.",
            }

        if action == "APPROVE":
            old_status = req.status
            req.status = ApprovalRequestStatus.APPROVED.value
            req.version += 1

            act = SMRITIApprovalAction(
                id=str(uuid.uuid4()),
                request_id=req.id,
                step_number=req.current_step_number,
                action="APPROVE",
                action_by=user_id,
                remarks=remarks,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            hist = SMRITIApprovalHistory(
                id=str(uuid.uuid4()),
                request_id=req.id,
                state_from=old_status,
                state_to=ApprovalRequestStatus.APPROVED.value,
                transition_by=user_id,
            )
            outbox = SMRITIApprovalOutbox(
                id=str(uuid.uuid4()),
                event_type="approval.completed",
                payload_json={
                    "request_id": req.id,
                    "document_type": req.document_type,
                    "document_id": req.document_id,
                    "action_by": user_id,
                },
            )
            db.add(act)
            db.add(hist)
            db.add(outbox)
            await db.commit()

            return {
                "success": True,
                "status": req.status,
                "message": "Document approval request approved successfully.",
            }

        raise ValueError(f"Unsupported action '{action}'.")
