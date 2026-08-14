"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-07-17
Modified     : 2026-07-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class UserCompanyAssignmentCreate(BaseModel):
    company_id: str = Field(..., max_length=50)
    is_default: bool = Field(False)


class UserBranchAssignmentCreate(BaseModel):
    branch_id: str = Field(..., max_length=50)
    is_default: bool = Field(False)


class UserStoreAssignmentCreate(BaseModel):
    store_id: str = Field(..., max_length=50)


class UserCompanyAssignmentResponse(BaseModel):
    id: str
    user_id: str
    company_id: str
    branch_id: Optional[str] = None
    is_default: bool
    created_at: datetime
    modified_at: datetime
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    is_active: bool
    is_deleted: bool
    version: int

    model_config = ConfigDict(from_attributes=True)


class UserBranchAssignmentResponse(BaseModel):
    id: str
    user_id: str
    company_id: Optional[str] = None
    branch_id: str
    is_default: bool
    created_at: datetime
    modified_at: datetime
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    is_active: bool
    is_deleted: bool
    version: int

    model_config = ConfigDict(from_attributes=True)


class UserStoreAssignmentResponse(BaseModel):
    id: str
    user_id: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    store_id: str
    created_at: datetime
    modified_at: datetime
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    is_active: bool
    is_deleted: bool
    version: int

    model_config = ConfigDict(from_attributes=True)


class UserAssignmentListResponse(BaseModel):
    user_id: str
    company_assignments: list[UserCompanyAssignmentResponse] = []
    branch_assignments: list[UserBranchAssignmentResponse] = []
    store_assignments: list[UserStoreAssignmentResponse] = []

    model_config = ConfigDict(from_attributes=True)
