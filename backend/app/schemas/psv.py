"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-10-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, field_validator


class PSVSkuTrackingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    party_id: str
    sku: str
    invoiced_qty: int = 0
    confirmed_sold_qty: int = 0
    returned_qty: int = 0


class PSVPartyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: Optional[str] = None
    host_customer_id: Optional[str] = None
    delivery_location_id: Optional[str] = None
    store_code: Optional[str] = None
    store_name_snapshot: Optional[str] = None
    stock_model: str = "OUTRIGHT_SALE"
    name: str
    location: str
    stock_count: int = 0
    sell_through: Decimal = Decimal("0.00")
    weeks_of_cover: Decimal = Decimal("0.00")
    capital_locked: Decimal = Decimal("0.00")
    # CamelCase compatibility fields for frontend UI
    stockCount: int = 0
    sellThrough: float = 0.0
    weeksOfCover: float = 0.0
    capitalLocked: float = 0.0
    status: str = "Healthy"
    sku_tracking: List[PSVSkuTrackingResponse] = Field(default_factory=list)
    # history: computed time-series for velocity chart (populated by GET /parties)
    # shape: [{"date": "YYYY-MM-DD", "stock": int, "sales": int}]
    history: List[Dict[str, Any]] = Field(default_factory=list)


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
    host_customer_id: Optional[str] = None
    delivery_location_id: Optional[str] = None
    store_code_snapshot: Optional[str] = None
    invoice_id: Optional[str] = None
    invoice_line_id: Optional[str] = None
    staff_placement_id: Optional[str] = None
    approval_status: str = "APPROVED"
    reported_by: Optional[str] = None
    approval_reason: Optional[str] = None
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
    store_code: Optional[str] = None
    reconciliation_status: str = "AUTO_MATCHED"
    stock_status: str = "IN_STOCK"
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


class PSVStoreResolutionReq(BaseModel):
    delivery_location_id: str = Field(..., max_length=50, description="Canonical Customer Delivery Location ID")
    customer_id: Optional[str] = Field(None, max_length=50, description="Optional host customer ID for cross-validation")


class PSVStoreResolutionResp(BaseModel):
    psv_party_id: str
    store_code: str
    delivery_location_id: str
    host_customer_id: str
    company_id: str
    name: str
    location: str
    stock_model: str = "OUTRIGHT_SALE"
    is_newly_created: bool
    status: str = "Healthy"


class PSVQuantityReconciliationItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    invoice_id: str
    invoice_no: str
    invoice_date: Optional[str] = None
    party_id: str
    party_name: str
    store_code: Optional[str] = None
    delivery_location_id: Optional[str] = None
    invoice_line_id: str
    sku: str
    barcodes: List[str] = Field(default_factory=list)
    product_name: str
    style_code: Optional[str] = None
    vendor_code: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    mrp: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    document_qty: Decimal = Decimal("0.0000")
    received_qty: Decimal = Decimal("0.0000")
    pending_approval_qty: Decimal = Decimal("0.0000")
    approved_qty: Decimal = Decimal("0.0000")
    short_qty: Decimal = Decimal("0.0000")
    excess_qty: Decimal = Decimal("0.0000")
    rejected_qty: Decimal = Decimal("0.0000")
    reconciliation_status: str = "READY_FOR_RECEIVING"
    workflow_status: str = "Ready for Receiving"
    events_count: int = 0
    pending_event_ids: List[str] = Field(default_factory=list)


class PSVQuantityReconciliationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_items: int = 0
    total_document_qty: Decimal = Decimal("0.0000")
    total_received_qty: Decimal = Decimal("0.0000")
    total_pending_approval_qty: Decimal = Decimal("0.0000")
    total_approved_qty: Decimal = Decimal("0.0000")
    total_short_qty: Decimal = Decimal("0.0000")
    total_excess_qty: Decimal = Decimal("0.0000")
    total_rejected_qty: Decimal = Decimal("0.0000")
    reconciled_count: int = 0
    discrepancy_count: int = 0
    pending_approval_count: int = 0


class PSVQuantityReconciliationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    summary: PSVQuantityReconciliationSummary
    items: List[PSVQuantityReconciliationItem] = Field(default_factory=list)


class PSVReceiveInvoiceLineReq(BaseModel):
    invoice_line_id: Optional[str] = None
    sku: Optional[str] = None
    style_code: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    received_qty: Decimal = Field(default=Decimal("0.0000"), ge=Decimal("0.0000"))
    rejected_qty: Decimal = Field(default=Decimal("0.0000"), ge=Decimal("0.0000"))
    rejection_reason: Optional[str] = None
    scanned_barcode_counts: Dict[str, int] = Field(default_factory=dict)

    @field_validator("scanned_barcode_counts")
    @classmethod
    def validate_scanned_barcode_counts(cls, value: Dict[str, int]) -> Dict[str, int]:
        if any(not barcode.strip() or count < 1 for barcode, count in value.items()):
            raise ValueError("Scanned barcodes must be non-empty and have a positive scan count.")
        return value


class PSVReceiveInvoiceReq(BaseModel):
    invoice_id: str
    party_id: Optional[str] = None
    receipt_reference: Optional[str] = None
    receipt_date: Optional[datetime] = None
    remarks: Optional[str] = Field(None, max_length=1000)
    auto_approve: bool = False
    items: List[PSVReceiveInvoiceLineReq]


class PSVReceiveInvoiceResp(BaseModel):
    status: str
    invoice_id: str
    party_id: str
    events_created: int
    approved_count: int
    pending_count: int
    event_ids: List[str] = Field(default_factory=list)
