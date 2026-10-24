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

Universal Document Lifecycle API.
Canonical cross-document state transition, concurrency verification,
approval evaluation, and event audit retrieval endpoint.
"""

from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_tenant_context, TenantContext, get_current_user
from app.models.auth import User
from app.models.workflow import WorkflowEvent
from app.services.lifecycle import (
    UniversalLifecycleEngine,
    LifecycleTransitionContext,
    LifecycleTransitionResult,
    LifecycleStateResponse,
    LifecycleException,
    DocumentNotFoundException,
    TenantIsolationException,
    ConcurrencyConflictException,
    InvalidTransitionException,
    PermissionDeniedException,
    ApprovalRequiredException,
    HandlerValidationException,
)

router = APIRouter()


class LifecycleTransitionRequest(BaseModel):
    """Payload for executing a lifecycle state transition."""
    expected_version: Optional[int] = Field(None, description="Optimistic concurrency control version counter")
    notes: Optional[str] = Field(None, description="Optional transition notes or audit remarks")
    payload: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Domain-specific action payload (e.g. reason, reason_code)")


class WorkflowEventSummaryResponse(BaseModel):
    id: str
    doc_type: str
    doc_id: str
    action: str
    from_status: Optional[str] = None
    to_status: str
    performed_by_id: Optional[str] = None
    performed_by_name: Optional[str] = None
    company_id: str
    branch_id: str
    notes: Optional[str] = None
    created_at: Any

    model_config = {"from_attributes": True}


@router.post(
    "/{doc_type}/{doc_id}/{action}",
    response_model=LifecycleTransitionResult,
    summary="Execute Universal Document Lifecycle Transition",
    description="Atomically validates, executes, stamps, and audits a document state machine transition.",
)
async def execute_lifecycle_transition(
    doc_type: str,
    doc_id: str,
    action: str,
    body: Optional[LifecycleTransitionRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    req_body = body or LifecycleTransitionRequest()
    ctx = LifecycleTransitionContext(
        doc_type=doc_type,
        doc_id=doc_id,
        action=action,
        expected_version=req_body.expected_version,
        notes=req_body.notes,
        payload=req_body.payload or {},
    )

    try:
        result = await UniversalLifecycleEngine.execute_transition(
            db=db,
            tenant_ctx=tenant_ctx,
            user=current_user,
            ctx=ctx,
        )
        return result
    except ConcurrencyConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.message)
    except (DocumentNotFoundException, TenantIsolationException) as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except (PermissionDeniedException, ApprovalRequiredException) as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except (InvalidTransitionException, HandlerValidationException, LifecycleException) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/{doc_type}/{doc_id}/state",
    response_model=LifecycleStateResponse,
    summary="Get Document Lifecycle State & Available Actions",
)
async def get_document_lifecycle_state(
    doc_type: str,
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    try:
        return await UniversalLifecycleEngine.get_lifecycle_state(
            db=db,
            doc_type=doc_type,
            doc_id=doc_id,
            tenant_ctx=tenant_ctx,
            user=current_user,
        )
    except DocumentNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/{doc_type}/{doc_id}/events",
    response_model=List[WorkflowEventSummaryResponse],
    summary="Get Chronological Workflow Events Audit Trail",
)
async def get_document_workflow_events(
    doc_type: str,
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    stmt = (
        select(WorkflowEvent)
        .where(
            WorkflowEvent.doc_id == doc_id,
            WorkflowEvent.company_id == tenant_ctx.company_id,
        )
        .order_by(WorkflowEvent.created_at.asc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()
