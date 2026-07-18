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

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class DataExchangeTaskCreate(BaseModel):
    name: str
    direction: str
    entityType: str = Field(..., alias="entityType")
    fileType: str | None = Field("CSV", alias="fileType")
    mappingId: str | None = Field(None, alias="mappingId")

    model_config = ConfigDict(populate_by_name=True)


class DataExchangeTaskUpdate(BaseModel):
    name: str | None = None
    direction: str | None = None
    entityType: str | None = Field(None, alias="entityType")
    fileType: str | None = Field(None, alias="fileType")
    mappingId: str | None = Field(None, alias="mappingId")

    model_config = ConfigDict(populate_by_name=True)


class DataExchangeTaskResponse(BaseModel):
    id: str
    name: str
    direction: str
    entityType: str = Field(..., serialization_alias="entityType")
    fileType: str = Field(..., serialization_alias="fileType")
    mappingId: str | None = Field(None, serialization_alias="mappingId")
    status: str
    lastRun: str | None = Field(None, serialization_alias="lastRun")
    lastLog: str | None = Field(None, serialization_alias="lastLog")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class FieldMappingCreate(BaseModel):
    name: str
    entityType: str = Field(..., alias="entityType")
    mappingRules: dict[str, str] = Field(..., alias="mappingRules")

    model_config = ConfigDict(populate_by_name=True)


class FieldMappingUpdate(BaseModel):
    name: str | None = None
    entityType: str | None = Field(None, alias="entityType")
    mappingRules: dict[str, str] | None = Field(None, alias="mappingRules")

    model_config = ConfigDict(populate_by_name=True)


class FieldMappingResponse(BaseModel):
    id: str
    name: str
    entityType: str = Field(..., serialization_alias="entityType")
    mappingRules: dict[str, str] = Field(..., serialization_alias="mappingRules")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class ExecuteTaskRequest(BaseModel):
    payload: list[dict[str, Any]] | None = None
