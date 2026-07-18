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


from pydantic import BaseModel, ConfigDict, Field


class RoleCreate(BaseModel):
    name: str
    description: str | None = None
    permissions: list[str]
    isSystem: bool | None = Field(False, alias="isSystem")

    model_config = ConfigDict(populate_by_name=True)


class RoleUpdate(BaseModel):
    description: str | None = None
    permissions: list[str] | None = None

    model_config = ConfigDict(populate_by_name=True)


class RoleResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    permissions: list[str]
    isSystem: bool = Field(..., serialization_alias="isSystem")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }
