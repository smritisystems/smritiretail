"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-07-14
Modified     : 2026-07-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class MasterTypeCreate(BaseModel):
    code: str
    label: str
    category_type: str | None = "SYSTEM"  # 'SYSTEM' | 'REFERENCE' | 'BUSINESS'
    is_system: bool | None = True
    field_schema: dict[str, Any]
    ui_schema: dict[str, Any] | None = None
    used_in_modules: list[str] | None = None
    depends_on: str | None = None
    version: int | None = 1
    evidence_level: str | None = 'D'
    created_by: str | None = None


class MasterTypeResponse(BaseModel):
    id: UUID
    code: str
    label: str
    category_type: str
    is_system: bool
    field_schema: dict[str, Any]
    ui_schema: dict[str, Any] | None = None
    used_in_modules: list[str] | None = None
    depends_on: str | None = None
    version: int
    evidence_level: str
    created_by: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MasterValueCreate(BaseModel):
    code: str
    name: str
    parent_value_id: UUID | None = None
    data: dict[str, Any] | None = None
    active: bool | None = True
    is_default: bool | None = False
    branch_id: str | None = None
    sort_order: int | None = 0


class MasterValueUpdate(BaseModel):
    name: str | None = None
    parent_value_id: UUID | None = None
    data: dict[str, Any] | None = None
    active: bool | None = None
    is_default: bool | None = None
    branch_id: str | None = None
    sort_order: int | None = None


class MasterValueReplace(BaseModel):
    new_name: str
    new_data: dict[str, Any] | None = None
    reason: str | None = None


class MasterValueResponse(BaseModel):
    id: UUID
    master_type_id: UUID
    code: str
    name: str
    parent_value_id: UUID | None = None
    supersedes_id: UUID | None = None
    data: dict[str, Any]
    active: bool
    is_default: bool = False
    sort_order: int
    is_system: bool = False
    tenant_id: str | None = None
    branch_id: str | None = None
    usage_count: int | None = 0
    effective_from: datetime
    effective_to: datetime | None = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class MasterValueHistoryResponse(BaseModel):
    id: UUID
    code: str
    name: str
    supersedes_id: UUID | None = None
    effective_from: datetime
    effective_to: datetime | None = None
    active: bool
    data: dict[str, Any]

    model_config = {"from_attributes": True}


class BulkActivateRequest(BaseModel):
    value_ids: list[UUID]
    active: bool


class BulkDeleteRequest(BaseModel):
    value_ids: list[UUID]


class BulkReorderItem(BaseModel):
    id: UUID
    sort_order: int


class BulkReorderRequest(BaseModel):
    items: list[BulkReorderItem]


class AIDuplicateMatch(BaseModel):
    id1: UUID
    code1: str
    name1: str
    id2: UUID
    code2: str
    name2: str
    similarity_score: float
    suggestion: str


class AIDuplicateReport(BaseModel):
    type_code: str
    total_scanned: int
    duplicate_candidates: list[AIDuplicateMatch]


