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

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_current_user
from ...models.auth import User
from ...services.communicator_engine import CommunicatorEngine
from ...schemas.communicator import (
    CommChannel,
    CommTemplateCreate,
    CommTemplateUpdate,
    CommTemplateResponse,
    SendMessageRequest,
    SendMessageResponse,
    BatchSendRequest,
    BatchSendResponse,
    CommLogListResponse,
    WebhookDeliveryEventRequest,
    WebhookDeliveryEventResponse,
    CommProvidersResponse,
)

router = APIRouter()


@router.post("/send", response_model=SendMessageResponse)
async def send_single_message(
    req: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_company_db),
):
    """
    Dispatches a single transactional, OTP, or promotional message across WhatsApp, SMS, Email, or Push.
    """
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    user_id = getattr(current_user, "id", None)
    try:
        return await CommunicatorEngine.send_message(
            session=session,
            company_id=company_id,
            req=req,
            user_id=user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Message dispatch error: {str(e)}")


@router.post("/send/batch", response_model=BatchSendResponse)
async def send_batch_messages(
    req: BatchSendRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_company_db),
):
    """
    Dispatches batch notifications using a pre-registered template with variable interpolation.
    """
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    user_id = getattr(current_user, "id", None)
    try:
        return await CommunicatorEngine.send_batch(
            session=session,
            company_id=company_id,
            req=req,
            user_id=user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Batch dispatch error: {str(e)}")


@router.get("/templates", response_model=List[CommTemplateResponse])
async def list_communication_templates(
    channel: Optional[CommChannel] = Query(None, description="Filter by channel (WHATSAPP, SMS, EMAIL, PUSH)"),
    search: Optional[str] = Query(None, description="Search template name or code"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_company_db),
):
    """
    Lists registered communication templates for the tenant company.
    """
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    templates = await CommunicatorEngine.list_templates(
        session=session,
        company_id=company_id,
        channel=channel,
        search_query=search,
    )
    return [
        CommTemplateResponse(
            id=t.id,
            name=t.name,
            code=t.code,
            channel=CommChannel(t.channel),
            subject_template=t.subject_template,
            body_template=t.body_template,
            status=t.status,
            description=t.description,
            created_at=t.created_at,
        )
        for t in templates
    ]


@router.post("/templates", response_model=CommTemplateResponse)
async def create_communication_template(
    req: CommTemplateCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_company_db),
):
    """
    Registers a new standardized notification template.
    """
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    user_id = getattr(current_user, "id", None)
    try:
        t = await CommunicatorEngine.create_template(
            session=session,
            company_id=company_id,
            req=req,
            user_id=user_id,
        )
        return CommTemplateResponse(
            id=t.id,
            name=t.name,
            code=t.code,
            channel=CommChannel(t.channel),
            subject_template=t.subject_template,
            body_template=t.body_template,
            status=t.status,
            description=t.description,
            created_at=t.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/templates/{template_id}", response_model=CommTemplateResponse)
async def update_communication_template(
    template_id: str,
    req: CommTemplateUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_company_db),
):
    """
    Updates an existing communication template.
    """
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    user_id = getattr(current_user, "id", None)
    try:
        t = await CommunicatorEngine.update_template(
            session=session,
            company_id=company_id,
            template_id=template_id,
            req=req,
            user_id=user_id,
        )
        return CommTemplateResponse(
            id=t.id,
            name=t.name,
            code=t.code,
            channel=CommChannel(t.channel),
            subject_template=t.subject_template,
            body_template=t.body_template,
            status=t.status,
            description=t.description,
            created_at=t.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/logs", response_model=CommLogListResponse)
async def list_communication_logs(
    channel: Optional[str] = Query(None),
    recipient: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_company_db),
):
    """
    Queries immutable communication audit logs.
    """
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    return await CommunicatorEngine.list_logs(
        session=session,
        company_id=company_id,
        channel=channel,
        recipient=recipient,
        status_filter=status_filter,
        limit=limit,
    )


@router.post("/webhook/{provider}", response_model=WebhookDeliveryEventResponse)
async def receive_delivery_webhook(
    provider: str,
    event: WebhookDeliveryEventRequest,
    session: AsyncSession = Depends(get_company_db),
):
    """
    Inbound webhook receiver for provider status callbacks (Meta WhatsApp, Twilio, SES, FCM).
    """
    return await CommunicatorEngine.process_delivery_webhook(
        session=session,
        company_id="COMP-001",
        event=event,
    )


@router.get("/providers", response_model=CommProvidersResponse)
async def list_active_providers(
    current_user: User = Depends(get_current_user),
):
    """
    Lists communication providers and their active status.
    """
    return CommunicatorEngine.get_providers_info()
