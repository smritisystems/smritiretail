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

from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field


class CommChannel(str, Enum):
    WHATSAPP = "WHATSAPP"
    SMS = "SMS"
    EMAIL = "EMAIL"
    PUSH = "PUSH"


class CommCategory(str, Enum):
    TRANSACTIONAL = "TRANSACTIONAL"
    OTP = "OTP"
    PROMOTIONAL = "PROMOTIONAL"
    ALERT = "ALERT"


class CommStatus(str, Enum):
    QUEUED = "QUEUED"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    READ = "READ"
    FAILED = "FAILED"
    BOUNCED = "BOUNCED"
    BLOCKED_DND = "BLOCKED_DND"
    BLOCKED_QUIET_HOURS = "BLOCKED_QUIET_HOURS"


# Template Schemas
class CommTemplateCreate(BaseModel):
    name: str = Field(..., max_length=200)
    code: str = Field(..., max_length=50)
    channel: CommChannel = Field(default=CommChannel.WHATSAPP)
    category: CommCategory = Field(default=CommCategory.TRANSACTIONAL)
    subject_template: Optional[str] = Field(None, max_length=255)
    body_template: str
    dlt_template_id: Optional[str] = Field(None, max_length=100)
    dlt_header_id: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None


class CommTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    subject_template: Optional[str] = Field(None, max_length=255)
    body_template: Optional[str] = None
    dlt_template_id: Optional[str] = Field(None, max_length=100)
    dlt_header_id: Optional[str] = Field(None, max_length=50)
    status: Optional[str] = Field(None, max_length=30)
    description: Optional[str] = None


class CommTemplateResponse(BaseModel):
    id: str
    name: str
    code: str
    channel: CommChannel
    category: CommCategory = CommCategory.TRANSACTIONAL
    subject_template: Optional[str] = None
    body_template: str
    dlt_template_id: Optional[str] = None
    dlt_header_id: Optional[str] = None
    status: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None


# Single Message Send Request & Response
class SendMessageRequest(BaseModel):
    channel: CommChannel = Field(default=CommChannel.WHATSAPP)
    category: CommCategory = Field(default=CommCategory.TRANSACTIONAL)
    recipient: str = Field(..., description="Phone number with country code, email address, or device token")
    template_code: Optional[str] = None
    variables: Dict[str, Any] = Field(default_factory=dict)
    direct_subject: Optional[str] = None
    direct_body: Optional[str] = None
    reference_doc_type: Optional[str] = Field(None, description="e.g. SALES_INVOICE, PURCHASE_ORDER, OTP")
    reference_doc_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    enable_fallback_channel: bool = Field(default=True, description="Fallback from WhatsApp to SMS if delivery fails")
    fallback_channel: Optional[CommChannel] = CommChannel.SMS


class SendMessageResponse(BaseModel):
    success: bool
    log_id: str
    status: CommStatus
    channel: CommChannel
    recipient: str
    rendered_subject: Optional[str] = None
    rendered_body: str
    gateway_message_id: Optional[str] = None
    gateway_response: Optional[str] = None
    fallback_invoked: bool = False
    error_reason: Optional[str] = None
    dispatched_at: datetime


# Batch Send Request & Response
class BatchSendRequest(BaseModel):
    channel: CommChannel = Field(default=CommChannel.WHATSAPP)
    category: CommCategory = Field(default=CommCategory.PROMOTIONAL)
    template_code: str
    recipients: List[Dict[str, Any]] = Field(
        ...,
        description="List of dicts containing 'recipient' and 'variables' per recipient"
    )
    reference_doc_type: Optional[str] = None


class BatchSendItemResult(BaseModel):
    recipient: str
    success: bool
    log_id: Optional[str] = None
    status: CommStatus
    error: Optional[str] = None


class BatchSendResponse(BaseModel):
    total_requested: int
    total_sent: int
    total_failed: int
    total_blocked: int
    results: List[BatchSendItemResult]


# Log Inspection & Filter
class CommLogItemResponse(BaseModel):
    id: str
    template_id: Optional[str] = None
    channel: str
    recipient: str
    reference_doc_type: Optional[str] = None
    reference_doc_id: Optional[str] = None
    rendered_subject: Optional[str] = None
    rendered_body: str
    status: str
    gateway_response: Optional[str] = None
    dispatched_at: Optional[datetime] = None


class CommLogListResponse(BaseModel):
    total: int
    items: List[CommLogItemResponse]


# Webhook Delivery Event
class WebhookDeliveryEventRequest(BaseModel):
    provider: str
    gateway_message_id: str
    status: CommStatus
    recipient: Optional[str] = None
    timestamp: Optional[datetime] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    raw_payload: Dict[str, Any] = Field(default_factory=dict)


class WebhookDeliveryEventResponse(BaseModel):
    acknowledged: bool
    log_id: Optional[str] = None
    updated_status: Optional[str] = None


# Provider Info
class CommProviderInfo(BaseModel):
    channel: CommChannel
    provider_name: str
    adapter_status: str
    is_default: bool
    rate_limit_per_hour: int
    sent_this_hour: int
    supports_dlt: bool
    supports_templates: bool
    health_status: str


class CommProvidersResponse(BaseModel):
    providers: List[CommProviderInfo]
