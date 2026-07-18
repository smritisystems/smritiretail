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


class DocumentSeriesCreate(BaseModel):
    name: str
    documentType: str = Field(..., alias="documentType")
    module: str | None = None
    prefix: str | None = ""
    suffix: str | None = ""
    runningLength: int | None = Field(6, alias="runningLength")
    resetRule: str | None = Field("Financial Year", alias="resetRule")
    currentNumber: int | None = Field(0, alias="currentNumber")
    financialYear: str | None = Field("2026-2027", alias="financialYear")
    companyCode: str | None = Field("SMRITI_IND", alias="companyCode")
    mode: str | None = "Auto"
    description: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class DocumentSeriesUpdate(BaseModel):
    name: str | None = None
    documentType: str | None = Field(None, alias="documentType")
    module: str | None = None
    prefix: str | None = None
    suffix: str | None = None
    runningLength: int | None = Field(None, alias="runningLength")
    resetRule: str | None = Field(None, alias="resetRule")
    currentNumber: int | None = Field(None, alias="currentNumber")
    financialYear: str | None = Field(None, alias="financialYear")
    companyCode: str | None = Field(None, alias="companyCode")
    mode: str | None = None
    description: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class DocumentSeriesResponse(BaseModel):
    id: str
    name: str
    documentType: str = Field(..., serialization_alias="documentType")
    module: str | None = None
    prefix: str
    suffix: str
    runningLength: int = Field(..., serialization_alias="runningLength")
    resetRule: str = Field(..., serialization_alias="resetRule")
    currentNumber: int = Field(..., serialization_alias="currentNumber")
    lastResetKey: str | None = Field(None, serialization_alias="lastResetKey")
    financialYear: str | None = Field(None, serialization_alias="financialYear")
    companyCode: str | None = Field(None, serialization_alias="companyCode")
    mode: str
    description: str | None = None
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
    oldValue: str | None = Field(None, serialization_alias="oldValue")
    newValue: str | None = Field(None, serialization_alias="newValue")
    details: str | None = None

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class AllocationRequest(BaseModel):
    branch: str | None = "HQ"
    fy: str | None = "26-27"
