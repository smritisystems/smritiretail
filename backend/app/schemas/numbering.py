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
    terminalId: Optional[str] = Field("COMMON", alias="terminalId")
    isCommonAcrossTerminals: Optional[bool] = Field(True, alias="isCommonAcrossTerminals")
    transactionGroup: Optional[str] = Field("SALES", alias="transactionGroup")
    startNumber: Optional[int] = Field(1, alias="startNumber")
    isVoidUnified: Optional[bool] = Field(False, alias="isVoidUnified")

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
    terminalId: Optional[str] = Field(None, alias="terminalId")
    isCommonAcrossTerminals: Optional[bool] = Field(None, alias="isCommonAcrossTerminals")
    transactionGroup: Optional[str] = Field(None, alias="transactionGroup")
    startNumber: Optional[int] = Field(None, alias="startNumber")
    isVoidUnified: Optional[bool] = Field(None, alias="isVoidUnified")

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
    terminalId: Optional[str] = Field("COMMON", serialization_alias="terminalId")
    isCommonAcrossTerminals: bool = Field(True, serialization_alias="isCommonAcrossTerminals")
    transactionGroup: Optional[str] = Field("SALES", serialization_alias="transactionGroup")
    startNumber: int = Field(1, serialization_alias="startNumber")
    isVoidUnified: bool = Field(False, serialization_alias="isVoidUnified")

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


# =========================================================================
# Shoper 9 Bill Prefix Resolution, Batch Definition, & Year-End Schemas
# =========================================================================

class BillPrefixResolveRequest(BaseModel):
    transactionType: str = Field(..., alias="transactionType")  # e.g. SALES_CASH, SALES_CREDIT, SALES_RETURN, VOID_SALES, BILL_HOLD
    terminalId: Optional[str] = Field("COMMON", alias="terminalId")
    branchId: Optional[str] = Field(None, alias="branchId")
    billType: Optional[str] = Field("Product", alias="billType")

    model_config = ConfigDict(populate_by_name=True)


class BillPrefixResolveResponse(BaseModel):
    seriesId: str
    prefix: str
    suffix: str
    nextDocNo: int
    formattedDocNo: str
    fullPreview: str
    runningLength: int
    terminalId: str
    isCommonAcrossTerminals: bool
    gstRule46bValid: bool
    gstRule46bLength: int
    validationMessage: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class BillPrefixBatchSaveItem(BaseModel):
    id: Optional[str] = None
    name: str
    documentType: str = Field(..., alias="documentType")
    transactionGroup: str = Field("SALES", alias="transactionGroup")
    terminalId: Optional[str] = Field("COMMON", alias="terminalId")
    isCommonAcrossTerminals: bool = Field(True, alias="isCommonAcrossTerminals")
    prefix: str
    suffix: Optional[str] = ""
    startNumber: int = Field(1, alias="startNumber")
    currentNumber: Optional[int] = Field(0, alias="currentNumber")
    runningLength: int = Field(4, alias="runningLength")
    isActive: bool = Field(True, alias="isActive")
    isVoidUnified: bool = Field(False, alias="isVoidUnified")

    model_config = ConfigDict(populate_by_name=True)


class BillPrefixBatchSaveRequest(BaseModel):
    terminalId: Optional[str] = Field("COMMON", alias="terminalId")
    isCommonAcrossTerminals: bool = Field(True, alias="isCommonAcrossTerminals")
    companyCodeAsPrefix: bool = Field(False, alias="companyCodeAsPrefix")
    branchId: Optional[str] = Field(None, alias="branchId")
    items: list[BillPrefixBatchSaveItem]

    model_config = ConfigDict(populate_by_name=True)


class YearEndRolloverRequest(BaseModel):
    newFinancialYear: str = Field(..., alias="newFinancialYear")  # e.g. "2026-2027"
    newYearSuffix: str = Field(..., alias="newYearSuffix")  # e.g. "26-27" or "26"
    resetToStartNumber: bool = Field(True, alias="resetToStartNumber")

    model_config = ConfigDict(populate_by_name=True)


class YearEndRolloverResponse(BaseModel):
    success: bool
    seriesUpdated: int
    oldYear: Optional[str] = None
    newYear: str
    updatedSeries: list[dict]

    model_config = ConfigDict(populate_by_name=True)

