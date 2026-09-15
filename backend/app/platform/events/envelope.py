"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.26.0
Created      : 2026-09-16
Modified     : 2026-09-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Platform Kernel Contract — Stage 4
"""

from datetime import datetime, timezone
from typing import Generic, Optional, TypeVar, Dict, Any
from pydantic import BaseModel, Field
import uuid

T = TypeVar("T")


class EventEnvelope(BaseModel, Generic[T]):
    """
    Standard SMRITI Stage 4 Platform Event Envelope.
    Provides strict contract separation between semantic event versioning and payload schema contracts,
    full distributed tracing (correlation/causation), multi-tenant routing, and audit identity.
    """
    id: str = Field(default_factory=lambda: f"evt-{uuid.uuid4().hex[:16]}", description="Globally unique Event ID")
    eventType: str = Field(..., description="Dot-notated canonical event type, e.g. 'billing.invoice.issued'")
    version: str = Field(default="1.0.0", description="Semantic event release version")
    schemaVersion: str = Field(default="1.0", description="Payload schema/contract specification version")
    source: str = Field(..., description="Originating service or kernel subsystem, e.g. 'smriti.billing.service'")
    tenantId: str = Field(..., description="Target tenant isolation domain, e.g. 'smriti001' or 'TENANT-DEFAULT'")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO-8601 UTC timestamp of creation"
    )
    correlationId: str = Field(
        default_factory=lambda: f"corr-{uuid.uuid4().hex[:16]}",
        description="End-to-end distributed transaction correlation ID"
    )
    causationId: Optional[str] = Field(
        default=None,
        description="Event ID or command ID that directly caused this event"
    )
    actorId: Optional[str] = Field(
        default=None,
        description="User, API key, or system principal that initiated the action"
    )
    payload: T = Field(..., description="Domain payload data conforming to schemaVersion")
    metadata: Dict[str, str] = Field(
        default_factory=dict,
        description="Extensible message metadata, transport headers, or tracing tags"
    )

    model_config = {"frozen": True}
