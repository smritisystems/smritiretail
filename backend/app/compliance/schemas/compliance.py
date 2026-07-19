"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class GovernmentServiceBase(BaseModel):
    name: str = Field(..., max_length=255, description="Full name of compliance service")
    version: str = Field(..., max_length=50, description="Version of the service connector")
    provider: str = Field(..., max_length=100, description="Government or NIC provider name")
    api_version: str = Field(..., max_length=50, description="Underlying API version")
    status: str = Field("ACTIVE", description="Service configuration status (ACTIVE, DISABLED, DEPRECATED)")
    display_name: str | None = Field(None, max_length=255)
    description: str | None = Field(None)
    environments: str | None = Field(None, description="Serialized JSON configuration dictionary")
    capabilities: str | None = Field(None, description="Comma-separated or JSON list of capabilities")

class GovernmentServiceCreate(GovernmentServiceBase):
    id: str = Field(..., max_length=50, description="Unique string service identifier (e.g. ewaybill)")

class GovernmentServiceOut(GovernmentServiceBase):
    id: str
    uuid: str
    is_active: bool
    created_at: datetime
    modified_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ComplianceCredentialsBase(BaseModel):
    service_id: str = Field(..., max_length=50)
    encrypted_username: str
    encrypted_password: str
    encrypted_client_secret: str | None = None

class ComplianceCredentialsCreate(ComplianceCredentialsBase):
    pass

class ComplianceCredentialsOut(ComplianceCredentialsBase):
    id: str
    uuid: str
    company_id: str | None = None
    branch_id: str | None = None
    is_active: bool
    created_at: datetime
    modified_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ComplianceAuditLogBase(BaseModel):
    service_id: str = Field(..., max_length=50)
    endpoint: str = Field(..., max_length=255)
    request_payload: str | None = None
    response_payload: str | None = None
    status_code: int | None = None
    duration_ms: int | None = None

class ComplianceAuditLogCreate(ComplianceAuditLogBase):
    pass

class ComplianceAuditLogOut(ComplianceAuditLogBase):
    id: str
    uuid: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

class ComplianceOutboxBase(BaseModel):
    service_id: str = Field(..., max_length=50)
    state: str = Field(..., max_length=50)
    action: str = Field(..., max_length=100)
    payload: str
    idempotency_key: str = Field(..., max_length=100)
    attempts: int = 0
    next_retry_at: datetime | None = None
    error_message: str | None = None

class ComplianceOutboxCreate(ComplianceOutboxBase):
    pass

class ComplianceOutboxOut(ComplianceOutboxBase):
    id: str
    uuid: str
    company_id: str | None = None
    branch_id: str | None = None
    created_at: datetime
    modified_at: datetime

    model_config = ConfigDict(from_attributes=True)

class HealthStatusOut(BaseModel):
    status: str
    database: str
    vault: str
    registry: str
    connectors: int
    version: str
    milestone: str

class DebugOutboxIn(BaseModel):
    service_id: str = Field(..., max_length=50)
    action: str = Field(..., max_length=100)
    payload: str
    idempotency_key: str = Field(..., max_length=100)
