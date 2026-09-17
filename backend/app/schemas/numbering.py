"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.18.0
Created      : 2026-07-12
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict, AliasChoices, field_validator

# ---------------------------------------------------------------------------
# Bill number segment arrangement enum
# ---------------------------------------------------------------------------
NumberFormat = Literal[
    "PREFIX_NUM_SUFFIX",    # {prefix}{num}{suffix}  ← default / backward-compatible
    "PREFIX_YEAR_SEP_NUM",  # {prefix}{year}/{num}
    "NUM_ONLY",             # {num}
    "PREFIX_SEP_NUM",       # {prefix}/{num}
]


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
    numberFormat: Optional[NumberFormat] = Field("PREFIX_NUM_SUFFIX", alias="numberFormat")

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
    numberFormat: Optional[NumberFormat] = Field(None, alias="numberFormat")

    model_config = ConfigDict(populate_by_name=True)


class DocumentSeriesResponse(BaseModel):
    id: str
    name: str
    documentType: str = Field(..., validation_alias=AliasChoices("document_type", "documentType"), serialization_alias="documentType")
    module: Optional[str] = None
    prefix: str = ""
    suffix: str = ""
    runningLength: int = Field(4, validation_alias=AliasChoices("running_length", "runningLength"), serialization_alias="runningLength")
    resetRule: str = Field("Financial Year", validation_alias=AliasChoices("reset_rule", "resetRule"), serialization_alias="resetRule")
    currentNumber: int = Field(0, validation_alias=AliasChoices("current_number", "currentNumber"), serialization_alias="currentNumber")
    lastResetKey: Optional[str] = Field(None, validation_alias=AliasChoices("last_reset_key", "lastResetKey"), serialization_alias="lastResetKey")
    financialYear: Optional[str] = Field(None, validation_alias=AliasChoices("financial_year", "financialYear"), serialization_alias="financialYear")
    companyCode: Optional[str] = Field(None, validation_alias=AliasChoices("company_code", "companyCode"), serialization_alias="companyCode")
    mode: str = "Auto"
    description: Optional[str] = None
    isActive: bool = Field(True, validation_alias=AliasChoices("is_active", "isActive"), serialization_alias="isActive")
    terminalId: Optional[str] = Field("COMMON", validation_alias=AliasChoices("terminal_id", "terminalId"), serialization_alias="terminalId")
    isCommonAcrossTerminals: bool = Field(True, validation_alias=AliasChoices("is_common_across_terminals", "isCommonAcrossTerminals"), serialization_alias="isCommonAcrossTerminals")
    transactionGroup: Optional[str] = Field("SALES", validation_alias=AliasChoices("transaction_group", "transactionGroup"), serialization_alias="transactionGroup")
    startNumber: int = Field(1, validation_alias=AliasChoices("start_number", "startNumber"), serialization_alias="startNumber")
    isVoidUnified: bool = Field(False, validation_alias=AliasChoices("is_void_unified", "isVoidUnified"), serialization_alias="isVoidUnified")
    numberFormat: str = Field("PREFIX_NUM_SUFFIX", validation_alias=AliasChoices("number_format", "numberFormat"), serialization_alias="numberFormat")

    @field_validator("numberFormat", mode="before")
    @classmethod
    def default_number_format(cls, v):
        _valid = {"PREFIX_NUM_SUFFIX", "PREFIX_YEAR_SEP_NUM", "NUM_ONLY", "PREFIX_SEP_NUM"}
        return v if v in _valid else "PREFIX_NUM_SUFFIX"

    @field_validator("prefix", "suffix", mode="before")
    def default_str_empty(cls, v):
        return v if v is not None else ""

    @field_validator("runningLength", mode="before")
    def default_running_length(cls, v):
        return v if v is not None else 4

    @field_validator("currentNumber", mode="before")
    def default_current_number(cls, v):
        return v if v is not None else 0

    @field_validator("startNumber", mode="before")
    def default_start_number(cls, v):
        return v if v is not None else 1

    @field_validator("isCommonAcrossTerminals", mode="before")
    def default_common_terminals(cls, v):
        return v if v is not None else True

    @field_validator("isVoidUnified", mode="before")
    def default_void_unified(cls, v):
        return v if v is not None else False

    @field_validator("isActive", mode="before")
    def default_is_active(cls, v):
        return v if v is not None else True

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class NumberingAuditLogResponse(BaseModel):
    id: str
    timestamp: str = Field(..., validation_alias=AliasChoices("created_at", "timestamp"), serialization_alias="timestamp")
    seriesId: str = Field(..., validation_alias=AliasChoices("series_id", "seriesId"), serialization_alias="seriesId")
    seriesName: str = Field(..., validation_alias=AliasChoices("series_name", "seriesName"), serialization_alias="seriesName")
    action: str
    user: str = Field(..., validation_alias=AliasChoices("operator", "user"), serialization_alias="user")
    documentNo: str = Field(..., validation_alias=AliasChoices("document_no", "documentNo"), serialization_alias="documentNo")
    oldValue: Optional[str] = Field(None, validation_alias=AliasChoices("old_value", "oldValue"), serialization_alias="oldValue")
    newValue: Optional[str] = Field(None, validation_alias=AliasChoices("new_value", "newValue"), serialization_alias="newValue")
    details: Optional[str] = None

    @field_validator("timestamp", mode="before")
    def format_timestamp(cls, v):
        if hasattr(v, "isoformat"):
            return v.isoformat()
        return str(v) if v is not None else ""

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
    numberFormat: str = "PREFIX_NUM_SUFFIX"

    model_config = ConfigDict(populate_by_name=True)


class BillPrefixBatchSaveItem(BaseModel):
    id: Optional[str] = None
    name: str
    documentType: str = Field(..., alias="documentType")
    transactionGroup: str = Field("SALES", alias="transactionGroup")
    terminalId: Optional[str] = Field("COMMON", alias="terminalId")
    isCommonAcrossTerminals: bool = Field(True, alias="isCommonAcrossTerminals")
    prefix: str = ""
    suffix: Optional[str] = ""
    startNumber: int = Field(1, alias="startNumber", ge=1)
    currentNumber: Optional[int] = Field(0, alias="currentNumber")
    runningLength: int = Field(4, alias="runningLength", ge=1, le=10)
    isActive: bool = Field(True, alias="isActive")
    isVoidUnified: bool = Field(False, alias="isVoidUnified")
    numberFormat: Optional[NumberFormat] = Field("PREFIX_NUM_SUFFIX", alias="numberFormat")

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, v):
        if v is None:
            raise ValueError("Series name is required.")
        v = str(v).strip()
        if not v:
            raise ValueError("Series name cannot be blank.")
        if len(v) > 200:
            raise ValueError("Series name must be 200 characters or fewer.")
        return v

    @field_validator("prefix", mode="before")
    @classmethod
    def validate_prefix(cls, v):
        import re
        if v is None:
            return ""
        v = str(v).strip().upper()
        # Empty prefix is permitted (some series have no prefix)
        if v and not re.match(r'^[A-Z0-9\-\/]{1,10}$', v):
            raise ValueError(
                "Prefix must be 1–10 uppercase alphanumeric characters (A-Z, 0-9, -, /) "
                "to comply with GST Rule 46(b)."
            )
        return v

    @field_validator("suffix", mode="before")
    @classmethod
    def default_suffix(cls, v):
        return str(v).strip() if v is not None else ""

    @field_validator("startNumber", mode="before")
    @classmethod
    def default_start_number(cls, v):
        if v is None:
            return 1
        try:
            return int(v)
        except (ValueError, TypeError):
            return 1

    @field_validator("runningLength", mode="before")
    @classmethod
    def default_running_length(cls, v):
        if v is None:
            return 4
        try:
            return int(v)
        except (ValueError, TypeError):
            return 4

    @field_validator("currentNumber", mode="before")
    @classmethod
    def default_current_number(cls, v):
        if v is None:
            return 0
        try:
            return int(v)
        except (ValueError, TypeError):
            return 0

    @field_validator("isVoidUnified", mode="before")
    @classmethod
    def default_void_unified(cls, v):
        return bool(v) if v is not None else False

    @field_validator("isActive", mode="before")
    @classmethod
    def default_is_active(cls, v):
        return bool(v) if v is not None else True

    @field_validator("isCommonAcrossTerminals", mode="before")
    @classmethod
    def default_common_terminals(cls, v):
        return bool(v) if v is not None else True

    model_config = ConfigDict(
        populate_by_name=True,
        str_strip_whitespace=True
    )


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

