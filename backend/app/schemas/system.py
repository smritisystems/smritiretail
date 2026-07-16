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

from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class TallyConfigCreate(BaseModel):
    endpoint: Optional[str] = "http://localhost:9000"
    companyName: str = Field(..., alias="companyName")
    syncIntervalMins: Optional[int] = Field(60, alias="syncIntervalMins")
    isActive: Optional[bool] = Field(True, alias="isActive")

    model_config = ConfigDict(populate_by_name=True)


class TallyConfigUpdate(BaseModel):
    endpoint: Optional[str] = None
    companyName: Optional[str] = Field(None, alias="companyName")
    syncIntervalMins: Optional[int] = Field(None, alias="syncIntervalMins")
    isActive: Optional[bool] = Field(None, alias="isActive")

    model_config = ConfigDict(populate_by_name=True)


class TallyConfigResponse(BaseModel):
    id: str
    endpoint: str
    companyName: str = Field(..., serialization_alias="companyName")
    syncIntervalMins: int = Field(..., serialization_alias="syncIntervalMins")
    isActive: bool = Field(..., serialization_alias="isActive")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class SystemConfigCreate(BaseModel):
    key: str
    value: str
    category: Optional[str] = "General"


class SystemConfigUpdate(BaseModel):
    value: str


class SystemConfigResponse(BaseModel):
    key: str
    value: str
    category: str

    model_config = {
        "from_attributes": True
    }
