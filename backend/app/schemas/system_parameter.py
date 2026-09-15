"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.19.0
Created      : 2026-09-14
Modified     : 2026-09-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import date, datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class SystemParameterResponse(BaseModel):
    id: str
    uuid: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    param_code: str
    category: str
    category_name: str
    description: str
    data_type: str
    mutability: str
    profile_type: str
    val_boolean: Optional[bool] = None
    val_integer: Optional[int] = None
    val_text: Optional[str] = None
    val_decimal: Optional[float] = None
    val_date: Optional[str] = None
    effective_value: Any = None
    scope_level: str
    terminal_id: str
    is_locked: bool = False
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SystemParameterUpdateRequest(BaseModel):
    value: Any
    terminal_id: Optional[str] = "COMMON"
    branch_id: Optional[str] = None
    scope_level: Optional[str] = "COMPANY"


class SystemParameterBatchSaveItem(BaseModel):
    param_code: str
    value: Any
    terminal_id: Optional[str] = "COMMON"
    branch_id: Optional[str] = None
    scope_level: Optional[str] = "COMPANY"


class SystemParameterBatchSaveRequest(BaseModel):
    items: List[SystemParameterBatchSaveItem]


class SystemParameterResolveRequest(BaseModel):
    param_code: str
    terminal_id: Optional[str] = "COMMON"
    branch_id: Optional[str] = None


class SystemParameterResolveResponse(BaseModel):
    param_code: str
    value: Any
    data_type: str
    mutability: str
    source_scope: str


class SystemParameterSeedRequest(BaseModel):
    profile: str = "RETAIL"  # 'RETAIL' or 'DISTRIBUTOR'
    overwrite_existing: bool = False
