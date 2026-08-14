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

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class DataExchangeTaskCreate(BaseModel):
    name: str
    direction: str
    entityType: str = Field(..., alias="entityType")
    fileType: Optional[str] = Field("CSV", alias="fileType")
    mappingId: Optional[str] = Field(None, alias="mappingId")

    model_config = ConfigDict(populate_by_name=True)


class DataExchangeTaskUpdate(BaseModel):
    name: Optional[str] = None
    direction: Optional[str] = None
    entityType: Optional[str] = Field(None, alias="entityType")
    fileType: Optional[str] = Field(None, alias="fileType")
    mappingId: Optional[str] = Field(None, alias="mappingId")

    model_config = ConfigDict(populate_by_name=True)


class DataExchangeTaskResponse(BaseModel):
    id: str
    name: str
    direction: str
    entityType: str = Field(..., serialization_alias="entityType")
    fileType: str = Field(..., serialization_alias="fileType")
    mappingId: Optional[str] = Field(None, serialization_alias="mappingId")
    status: str
    lastRun: Optional[str] = Field(None, serialization_alias="lastRun")
    lastLog: Optional[str] = Field(None, serialization_alias="lastLog")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class FieldMappingCreate(BaseModel):
    name: str
    entityType: str = Field(..., alias="entityType")
    mappingRules: Dict[str, str] = Field(..., alias="mappingRules")

    model_config = ConfigDict(populate_by_name=True)


class FieldMappingUpdate(BaseModel):
    name: Optional[str] = None
    entityType: Optional[str] = Field(None, alias="entityType")
    mappingRules: Optional[Dict[str, str]] = Field(None, alias="mappingRules")

    model_config = ConfigDict(populate_by_name=True)


class FieldMappingResponse(BaseModel):
    id: str
    name: str
    entityType: str = Field(..., serialization_alias="entityType")
    mappingRules: Dict[str, str] = Field(..., serialization_alias="mappingRules")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class ExecuteTaskRequest(BaseModel):
    payload: Optional[List[Dict[str, Any]]] = None
