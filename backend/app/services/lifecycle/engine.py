"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.47.4
* Created    : 2026-10-01
* Modified   : 2026-10-01
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal

SMRITI UNIVERSAL TRANSACTION LIFECYCLE FRAMEWORK — CORE KERNEL.
Completely document-type agnostic orchestration engine. Operates exclusively
via BaseDocumentLifecycleHandler contract, WorkflowDefinition state graphs,
RBAC security matrix, multi-tier ApprovalEngine, and immutable WorkflowEvent audit logging.

Contains ZERO document-type branching (no if doc_type == ...).
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Dict, Any, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.models.auth import User
from app.models.governed_logic import WorkflowDefinition
from app.models.workflow import WorkflowEvent
from app.services.governed_rules import GovernedRuleEngine
from app.services.approval_engine import ApprovalEngine
from app.schemas.approval import ApprovalEnforcementCheckRequest
from app.core.security_matrix import evaluate_action_permission

from .contracts import BaseDocumentLifecycleHandler
from .registry import LifecycleRegistry
from .context import (
    LifecycleTransitionContext,
    LifecycleTransitionResult,
    LifecycleStateResponse,
)
from .exceptions import (
    LifecycleException,
    DocumentNotFoundException,
    TenantIsolationException,
    ConcurrencyConflictException,
    InvalidTransitionException,
    PermissionDeniedException,
    ApprovalRequiredException,
    HandlerValidationException,
)

logger = logging.getLogger(__name__)


class UniversalLifecycleEngine:
    """
    Authoritative Universal Transaction Lifecycle Engine.
    Executes and coordinates state machine transitions across ALL SMRITI document families:
    - Purchase (PurchaseOrder, GRN, PurchaseBill, DebitNote, etc.)
    - Sales (SalesQuotation, SalesOrder, SalesInvoice, CreditNote, etc.)
    - Inventory (StockTransfer, StockReceipt, StockAdjustment, etc.)
    - Payments / Finance (PaymentTransaction, SupplierPayment, CustomerPayment, etc.)
    - Distribution (DistributionOrder, Dispatch, Receipt, etc.)
    - Future Transactional Documents

    OPERATES ONLY ON:
    - Target Document Entity (loaded via Handler)
    - Active WorkflowDefinition state machine
    - Tenant isolation & ownership
    - RBAC / User permissions
    - Financial approval policies
    - Optimistic concurrency versioning
    - BaseDocumentLifecycleHandler strategy hooks
    - Immutable audit event logging
    - Atomic database transaction boundary
    """

    @classmethod
    async def resolve_workflow_definition(
        cls,
        db: AsyncSession,
        handler: BaseDocumentLifecycleHandler,
    ) -> Dict[str, Any]:
        """
        Resolves the active WorkflowDefinition state machine graph.
        Queries database workflow_definitions table first, falling back to
        the handler's registered default definition if unseeded.
        """
        stmt = (
            select(WorkflowDefinition)
            .where(
                WorkflowDefinition.doc_type == handler.document_type,
                WorkflowDefinition.status == "ACTIVE",
                WorkflowDefinition.is_active == True,
                WorkflowDefinition.is_deleted == False,
            )
            .order_by(WorkflowDefinition.version.desc())
        )
        res = await db.execute(stmt)
        wf_record = res.scalars().first()
        if wf_record and wf_record.transitions:
            return {
                "code": wf_record.code,
                "version": wf_record.version,
                "doc_type": wf_record.doc_type,
                "initial_state": wf_record.initial_state,
                "states": wf_record.states if isinstance(wf_record.states, list) else [],
                "transitions": wf_record.transitions if isinstance(wf_record.transitions, list) else [],
            }
        
        fallback = handler.get_default_workflow_definition()
        if fallback:
            return fallback

        raise LifecycleException(
            message=f"No active workflow definition configured for document type '{handler.document_type}'.",
            status_code=400,
            details={"doc_type": handler.document_type},
        )

    @classmethod
    async def get_lifecycle_state(
        cls,
        db: AsyncSession,
        doc_type: str,
        doc_id: str,
        tenant_ctx: TenantContext,
        user: User,
    ) -> LifecycleStateResponse:
        """Retrieves active lifecycle state, version, and dynamic available actions for any document."""
        handler = LifecycleRegistry.get(doc_type)
        doc = await handler.get_document(db, doc_id, tenant_ctx)
        curr_status = handler.get_current_status(doc)
        version = handler.get_version(doc)
        
        wf_def = await cls.resolve_workflow_definition(db, handler)
        available_actions = await handler.get_available_actions(
            db, doc, user, tenant_ctx, wf_def.get("transitions", [])
        )

        return LifecycleStateResponse(
            doc_type=handler.document_type,
            doc_id=doc_id,
            status=curr_status,
            version=version,
            available_actions=available_actions,
            pending_approval=False,
            audit_info={
                "modified_at": getattr(doc, "modified_at", None),
                "summary": handler.get_document_summary(doc),
            },
        )

    @classmethod
    async def execute_transition(
        cls,
        db: AsyncSession,
        tenant_ctx: TenantContext,
        user: User,
        ctx: LifecycleTransitionContext,
    ) -> LifecycleTransitionResult:
        """
        Executes a canonical document state machine transition atomically.

        Zero document-specific branching:
        1. Resolve registered domain handler from LifecycleRegistry
        2. Safely load target entity enforcing multi-tenancy
        3. Optimistic concurrency check (expected_version vs doc.version)
        4. Resolve active WorkflowDefinition state graph
        5. State graph & transition validation (GovernedRuleEngine)
        6. Fine-grained RBAC permission evaluation (security_matrix)
        7. Financial ApprovalPolicy evaluation (ApprovalEngine)
        8. Handler.validate_transition & Handler.before_transition hooks
        9. Handler.apply_transition state mutation & audit stamping (is_deleted = False)
        10. Create immutable WorkflowEvent row
        11. Handler.after_transition post-event hook
        12. Atomic commit
        13. Return LifecycleTransitionResult with available actions
        """
        doc_type = ctx.doc_type
        doc_id = ctx.doc_id
        action = ctx.action.strip().upper()
        payload = ctx.payload or {}

        # 1. Resolve registered domain handler (strategy pattern)
        handler = LifecycleRegistry.get(doc_type)

        # 2. Safely load document entity (enforces tenant isolation)
        doc = await handler.get_document(db, doc_id, tenant_ctx)
        from_status = handler.get_current_status(doc)
        current_version = handler.get_version(doc)

        # 3. Optimistic concurrency validation (HTTP 409)
        if ctx.expected_version is not None and current_version != ctx.expected_version:
            raise ConcurrencyConflictException(
                current_version=current_version,
                expected_version=ctx.expected_version,
            )

        # 4. Resolve WorkflowDefinition state machine
        wf_def = await cls.resolve_workflow_definition(db, handler)

        # 5. Evaluate state machine transition via GovernedRuleEngine
        user_roles = [user.role.value] if hasattr(user.role, "value") else [str(user.role)]
        eval_result = GovernedRuleEngine.evaluate_workflow_transition(
            workflow_def=wf_def,
            current_state=from_status,
            action=action,
            user_roles=user_roles,
        )

        if not eval_result.get("allowed"):
            err = eval_result.get("error", f"Transition forbidden from state '{from_status}' with action '{action}'.")
            if "Permission denied" in err:
                raise PermissionDeniedException(action, handler.document_type, required=err)
            
            # Extract allowed actions from current state for helpful error message
            candidate_actions = [
                t["action"] for t in wf_def.get("transitions", []) if t.get("from") == from_status
            ]
            raise InvalidTransitionException(
                current_state=from_status,
                action=action,
                allowed_actions=candidate_actions,
            )

        to_status = eval_result.get("next_state") or from_status

        # 6. Fine-grained RBAC permission evaluation via security_matrix
        resource_key = handler.get_resource_name()
        action_key = action.lower()
        has_perm = await evaluate_action_permission(
            db=db,
            current_user=user,
            tenant=tenant_ctx,
            resource=resource_key,
            action=action_key,
        )
        if not has_perm:
            raise PermissionDeniedException(action=action, doc_type=handler.document_type)

        # 7. Financial Threshold & Approval Policy Check
        doc_amount = handler.get_document_amount(doc)
        if handler.is_approval_action(action) and doc_amount > Decimal("0.00"):
            check_req = ApprovalEnforcementCheckRequest(
                document_type=handler.document_type.upper(),
                document_amount=doc_amount,
                caller_role=user_roles[0] if user_roles else "CASHIER",
            )
            enforcement = await ApprovalEngine.check_transaction_enforcement(
                session=db,
                company_id=tenant_ctx.company_id,
                req=check_req,
            )
            if enforcement.requires_approval:
                raise ApprovalRequiredException(
                    policy_code=enforcement.matching_policy_code or "APPROVAL_GATE",
                    required_role=enforcement.required_role or "MANAGER",
                    reason=enforcement.reason,
                )

        # 8. Handler domain-specific pre-conditions & pre-hooks
        await handler.validate_transition(
            db=db,
            doc=doc,
            action=action,
            next_state=to_status,
            user=user,
            tenant_ctx=tenant_ctx,
            payload=payload,
        )
        await handler.before_transition(
            db=db,
            doc=doc,
            action=action,
            next_state=to_status,
            user=user,
            tenant_ctx=tenant_ctx,
            payload=payload,
        )

        # 9. Apply entity state mutation
        await handler.apply_transition(
            db=db,
            doc=doc,
            action=action,
            next_state=to_status,
            user=user,
            tenant_ctx=tenant_ctx,
            payload=payload,
        )

        # 10. Append immutable audit event in workflow_events table
        actor_name = (
            getattr(user, "username", None)
            or getattr(user, "email", None)
            or getattr(user, "name", None)
            or str(getattr(user, "id", ""))
        )
        event_notes = ctx.notes or payload.get("reason") or payload.get("notes")
        event = WorkflowEvent(
            doc_type=handler.document_type,
            doc_id=str(doc.id),
            action=action,
            from_status=from_status,
            to_status=to_status,
            performed_by_id=str(user.id),
            performed_by_name=actor_name,
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id or "BR-001",
            notes=event_notes,
            created_at=datetime.now(timezone.utc),
        )
        db.add(event)

        # 11. Post-transition handler hook
        await handler.after_transition(
            db=db,
            doc=doc,
            action=action,
            next_state=to_status,
            user=user,
            tenant_ctx=tenant_ctx,
            event=event,
            payload=payload,
        )

        # 12. Atomic commit
        await db.commit()

        # 13. Determine dynamic available actions for next state
        next_available_actions = await handler.get_available_actions(
            db, doc, user, tenant_ctx, wf_def.get("transitions", [])
        )
        new_version = handler.get_version(doc)

        return LifecycleTransitionResult(
            success=True,
            doc_type=handler.document_type,
            doc_id=str(doc.id),
            from_status=from_status,
            to_status=to_status,
            action=action,
            event_id=str(event.id),
            version=new_version,
            available_actions=next_available_actions,
            pending_approval=False,
            message=f"{handler.document_type} successfully transitioned to '{to_status}' via '{action}'.",
            details=handler.get_document_summary(doc),
        )
