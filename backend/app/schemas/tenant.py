"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.8.0
Created      : 2026-07-11
Modified     : 2026-07-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

# --- Company Schemas ---
class CompanyBase(BaseModel):
    name: str = Field(..., max_length=255)
    gst_number: Optional[str] = Field(None, max_length=15)
    is_active: bool = True

class CompanyCreate(CompanyBase):
    id: str = Field(..., max_length=50)

class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    gst_number: Optional[str] = Field(None, max_length=15)
    is_active: Optional[bool] = None

class CompanyResponse(CompanyBase):
    id: str
    uuid: str
    is_deleted: bool
    created_at: datetime
    modified_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Branch Schemas ---
class BranchBase(BaseModel):
    name: str = Field(..., max_length=255)
    code: str = Field(..., max_length=50)
    is_active: bool = True

class BranchCreate(BranchBase):
    id: str = Field(..., max_length=50)
    company_id: str = Field(..., max_length=50)

class BranchUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None

class BranchResponse(BranchBase):
    id: str
    uuid: str
    company_id: str
    is_deleted: bool
    created_at: datetime
    modified_at: datetime

    model_config = ConfigDict(from_attributes=True)
