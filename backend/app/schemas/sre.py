# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Version      : 3.31.0
# Modified     : 2026-07-19
# Copyright    : © SMRITIBooks.com. All Rights Reserved.

from typing import Optional, List
from decimal import Decimal
from datetime import date, datetime
from pydantic import BaseModel, Field


# --- CorporateGstinRegistry Schemas ---

class CorporateGstinRegistryBase(BaseModel):
    gstin: str = Field(..., max_length=15)
    state_code: str = Field(..., max_length=2)
    warehouse_name: str = Field(..., max_length=100)


class CorporateGstinRegistryCreate(CorporateGstinRegistryBase):
    pass


class CorporateGstinRegistryUpdate(BaseModel):
    gstin: Optional[str] = Field(None, max_length=15)
    state_code: Optional[str] = Field(None, max_length=2)
    warehouse_name: Optional[str] = Field(None, max_length=100)


class CorporateGstinRegistryResponse(CorporateGstinRegistryBase):
    id: str
    uuid: str
    tenant_id: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None

    class Config:
        from_attributes = True


# --- SreRuleEngine Schemas ---

class SreRuleEngineBase(BaseModel):
    dispatch_type: str = Field(..., max_length=50)
    tax_timing: str = Field(..., max_length=20)
    max_deferral_days: int = 0
    warning_buffer_days: int = 15
    required_document_type: str = Field(..., max_length=30)


class SreRuleEngineCreate(SreRuleEngineBase):
    pass


class SreRuleEngineUpdate(BaseModel):
    tax_timing: Optional[str] = Field(None, max_length=20)
    max_deferral_days: Optional[int] = None
    warning_buffer_days: Optional[int] = None
    required_document_type: Optional[str] = Field(None, max_length=30)


class SreRuleEngineResponse(SreRuleEngineBase):
    id: str
    uuid: str
    tenant_id: str

    class Config:
        from_attributes = True


# --- SreStatutoryLedger Schemas ---

class SreStatutoryLedgerBase(BaseModel):
    sku: str = Field(..., max_length=50)
    batch_no: str = Field(..., max_length=50)
    dispatch_id: str = Field(..., max_length=50)
    origin_gstin_id: str = Field(..., max_length=50)
    destination_gstin: str = Field(..., max_length=15)
    total_qty: Decimal
    approved_qty: Decimal = Decimal("0.0000")
    returned_qty: Decimal = Decimal("0.0000")
    unit_cost: Decimal
    gst_rate: Decimal
    tax_type_applied: str = Field(..., max_length=15)
    statutory_state: str = Field(..., max_length=30)
    dispatch_date: date
    expiry_date: date
    is_asset_on_balance_sheet: bool = True


class SreStatutoryLedgerCreate(SreStatutoryLedgerBase):
    pass


class SreStatutoryLedgerResponse(SreStatutoryLedgerBase):
    id: str
    uuid: str
    tenant_id: str

    class Config:
        from_attributes = True


# --- SreComplianceDecision Schemas ---

class SreComplianceDecisionBase(BaseModel):
    dispatch_id: str = Field(..., max_length=50)
    evaluated_rule: str = Field(..., max_length=255)
    decision: str = Field(..., max_length=255)
    reason: Optional[str] = None
    evaluated_at: datetime
    engine_version: str = Field(..., max_length=20)


class SreComplianceDecisionResponse(SreComplianceDecisionBase):
    id: str
    uuid: str
    tenant_id: str

    class Config:
        from_attributes = True
