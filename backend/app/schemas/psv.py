"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, Field


class PSVSkuTrackingResponse(BaseModel):
    id: int
    party_id: str
    sku: str
    invoiced_qty: int = 0
    confirmed_sold_qty: int = 0
    returned_qty: int = 0


class PSVPartyResponse(BaseModel):
    id: str
    name: str
    location: str
    stock_count: int = 0
    sell_through: Decimal = Decimal("0.00")
    weeks_of_cover: Decimal = Decimal("0.00")
    capital_locked: Decimal = Decimal("0.00")
    status: str = "Healthy"
    sku_tracking: List[PSVSkuTrackingResponse] = Field(default_factory=list)


class PSVEventProjectionReq(BaseModel):
    source_event_id: str = Field(..., description="Unique idempotency ULID from source domain")
    correlation_id: Optional[str] = None
    causation_id: Optional[str] = None
    event_schema_version: str = "1.0"
    company_code: str
    source_database: str = "smriti001"
    source_document_type: str
    source_document_id: str
    source_document_line_id: Optional[str] = None
    psv_party_id: str
    destination_type: str = "RETAIL_STORE"
    destination_id: Optional[str] = None
    psv_store_id: Optional[str] = None
    sku: str
    movement_type: str
    quantity: Decimal
    source_event_created_at: datetime
    event_date: Optional[datetime] = None


class PSVVisibilityPolicyCreateReq(BaseModel):
    policy_code: str
    name: str
    allowed_sku_patterns: List[str] = Field(default_factory=list)
    max_lookback_days: int = 90


class PSVPartyScopeCreateReq(BaseModel):
    party_id: str
    policy_code: str
    allowed_branch_ids: List[str] = Field(default_factory=list)
    allowed_categories: List[str] = Field(default_factory=list)


class PSVScopedBalanceItem(BaseModel):
    sku: str
    billed_qty: Decimal
    received_qty: Decimal
    sold_qty: Decimal
    returned_qty: Decimal
    current_balance: Decimal
    status: str = "SYNCHRONIZED"


class PSVScopedVisibilityResponse(BaseModel):
    party_id: str
    company_code: str
    is_scoped: bool = True
    policy_applied: Optional[str] = None
    balances: List[PSVScopedBalanceItem] = Field(default_factory=list)
    total_projected_units: Decimal = Decimal("0.0000")
    total_skus_tracked: int = 0
    non_authoritative_warning: str = "PSV is a non-authoritative projected visibility ledger and does not represent physical audit truth."
