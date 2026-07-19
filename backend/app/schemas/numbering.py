"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class DocumentSeriesCreate(BaseModel):
    name: str
    documentType: str = Field(..., alias="documentType")
    module: Optional[str] = None
    prefix: Optional[str] = ""
    suffix: Optional[str] = ""
    runningLength: Optional[int] = Field(6, alias="runningLength")
    resetRule: Optional[str] = Field("Financial Year", alias="resetRule")
    currentNumber: Optional[int] = Field(0, alias="currentNumber")
    financialYear: Optional[str] = Field("2026-2027", alias="financialYear")
    companyCode: Optional[str] = Field("SMRITI_IND", alias="companyCode")
    mode: Optional[str] = "Auto"
    description: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class DocumentSeriesUpdate(BaseModel):
    name: Optional[str] = None
    documentType: Optional[str] = Field(None, alias="documentType")
    module: Optional[str] = None
    prefix: Optional[str] = None
    suffix: Optional[str] = None
    runningLength: Optional[int] = Field(None, alias="runningLength")
    resetRule: Optional[str] = Field(None, alias="resetRule")
    currentNumber: Optional[int] = Field(None, alias="currentNumber")
    financialYear: Optional[str] = Field(None, alias="financialYear")
    companyCode: Optional[str] = Field(None, alias="companyCode")
    mode: Optional[str] = None
    description: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class DocumentSeriesResponse(BaseModel):
    id: str
    name: str
    documentType: str = Field(..., serialization_alias="documentType")
    module: Optional[str] = None
    prefix: str
    suffix: str
    runningLength: int = Field(..., serialization_alias="runningLength")
    resetRule: str = Field(..., serialization_alias="resetRule")
    currentNumber: int = Field(..., serialization_alias="currentNumber")
    lastResetKey: Optional[str] = Field(None, serialization_alias="lastResetKey")
    financialYear: Optional[str] = Field(None, serialization_alias="financialYear")
    companyCode: Optional[str] = Field(None, serialization_alias="companyCode")
    mode: str
    description: Optional[str] = None
    isActive: bool = Field(..., serialization_alias="isActive")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class NumberingAuditLogResponse(BaseModel):
    id: str
    timestamp: str
    seriesId: str = Field(..., serialization_alias="seriesId")
    seriesName: str = Field(..., serialization_alias="seriesName")
    action: str
    user: str = Field(..., serialization_alias="user")
    documentNo: str = Field(..., serialization_alias="documentNo")
    oldValue: Optional[str] = Field(None, serialization_alias="oldValue")
    newValue: Optional[str] = Field(None, serialization_alias="newValue")
    details: Optional[str] = None

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class AllocationRequest(BaseModel):
    branch: Optional[str] = "HQ"
    fy: Optional[str] = "26-27"
