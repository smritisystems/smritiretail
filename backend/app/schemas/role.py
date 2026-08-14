"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str]
    isSystem: Optional[bool] = Field(False, alias="isSystem")

    model_config = ConfigDict(populate_by_name=True)


class RoleUpdate(BaseModel):
    description: Optional[str] = None
    permissions: Optional[List[str]] = None

    model_config = ConfigDict(populate_by_name=True)


class RoleResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    permissions: List[str]
    isSystem: bool = Field(..., serialization_alias="isSystem")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }
