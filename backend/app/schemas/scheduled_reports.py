"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.72.0
Created      : 2026-08-28
Modified     : 2026-08-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field


class RecipientConfig(BaseModel):
    emails: list[str] = Field(default_factory=list)
    phone_numbers: list[str] = Field(default_factory=list)
    vault_folder: str | None = None


class ReportScheduleCreate(BaseModel):
    schedule_name: str = Field(..., max_length=150, description="Descriptive schedule name")
    report_code: str = Field(..., max_length=50, description="Canonical report code (e.g., 'RPT-SAL-001')")
    cron_expression: str = Field("0 21 * * *", max_length=50, description="Standard 5-part cron expression")
    export_format: Literal["XLSX", "PDF", "CSV", "JSON"] = Field("XLSX", description="Target export format")
    channels: list[Literal["EMAIL", "WHATSAPP", "STATUTORY_VAULT"]] = Field(
        default_factory=lambda: ["EMAIL"],
        description="Target distribution channels"
    )
    recipients: RecipientConfig = Field(default_factory=RecipientConfig)
    filter_overrides: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class ReportScheduleUpdate(BaseModel):
    schedule_name: str | None = None
    report_code: str | None = None
    cron_expression: str | None = None
    export_format: Literal["XLSX", "PDF", "CSV", "JSON"] | None = None
    channels: list[Literal["EMAIL", "WHATSAPP", "STATUTORY_VAULT"]] | None = None
    recipients: RecipientConfig | None = None
    filter_overrides: dict[str, Any] | None = None
    is_active: bool | None = None


class ReportDispatchLogOut(BaseModel):
    id: str
    schedule_id: str
    report_code: str
    dispatch_channel: str
    recipient_target: str
    export_format: str
    payload_size_bytes: int
    execution_time_ms: int
    status: str
    error_message: str | None = None
    forensic_envelope_hash: str | None = None
    delivery_metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    class Config:
        from_attributes = True


class ReportScheduleOut(BaseModel):
    id: str
    company_id: str | None = None
    branch_id: str | None = None
    schedule_name: str
    report_code: str
    cron_expression: str
    export_format: str
    channels: list[str]
    recipients: dict[str, Any]
    filter_overrides: dict[str, Any]
    is_active: bool
    status: str
    last_run_at: datetime | None = None
    next_run_at: datetime | None = None
    last_execution_latency_ms: int | None = None
    last_status_message: str | None = None
    created_at: datetime
    modified_at: datetime

    class Config:
        from_attributes = True


class TriggerScheduleResponse(BaseModel):
    schedule_id: str
    status: str
    report_code: str
    export_format: str
    dispatches: list[ReportDispatchLogOut]
    total_execution_time_ms: int
    forensic_envelope_hash: str
