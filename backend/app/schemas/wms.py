"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-22
Modified     : 2026-08-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import re
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from ..core.gst_engine import GST_STATE_CODES


# --- Warehouse Schemas ---
class WarehouseBase(BaseModel):
    code: Optional[str] = None
    name: str
    branch_id: Optional[str] = None
    is_transit: bool = False
    is_central_godown: bool = False
    is_default_for_branch: bool = False  # R-007: governs branch-level warehouse resolution
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None

    @field_validator("pincode")
    @classmethod
    def validate_pincode(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        cleaned = v.strip()
        if not cleaned:
            return None
        if not re.match(r"^[0-9]{6}$", cleaned):
            raise ValueError("PIN code must be exactly 6 Indian postal digits (e.g. '440029').")
        return cleaned

    @field_validator("state")
    @classmethod
    def validate_state(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        cleaned = v.strip()
        if not cleaned:
            return None
        if cleaned in GST_STATE_CODES:
            return GST_STATE_CODES[cleaned]
        state_names = {s.lower(): s for s in GST_STATE_CODES.values()}
        if cleaned.lower() in state_names:
            return state_names[cleaned.lower()]
        if "-" in cleaned:
            parts = cleaned.split("-", 1)
            code_part = parts[0].strip()
            name_part = parts[1].strip().lower()
            if code_part in GST_STATE_CODES:
                return GST_STATE_CODES[code_part]
            if name_part in state_names:
                return state_names[name_part]
        raise ValueError(f"Invalid Indian State/UT '{cleaned}'. Must match a valid Indian state or 2-digit GST state code.")


class WarehouseLocationCreate(BaseModel):
    warehouse_id: str
    code: str
    name: str
    zone: Optional[str] = "STORAGE"
    aisle: Optional[str] = None
    rack: Optional[str] = None
    shelf: Optional[str] = None
    bin_code: Optional[str] = None
    barcode: Optional[str] = None
    max_capacity_units: Optional[int] = 100
    is_locked: Optional[bool] = False


class WarehouseLocationUpdate(BaseModel):
    name: Optional[str] = None
    zone: Optional[str] = None
    aisle: Optional[str] = None
    rack: Optional[str] = None
    shelf: Optional[str] = None
    bin_code: Optional[str] = None
    barcode: Optional[str] = None
    max_capacity_units: Optional[int] = None
    is_locked: Optional[bool] = None
    is_active: Optional[bool] = None


class WarehouseLocationMatrixGenerateRequest(BaseModel):
    zone: str = "STORAGE"
    aisle_prefix: str = "A"
    aisle_from: int = 1
    aisle_to: int = 2
    rack_prefix: str = "R"
    rack_from: int = 1
    rack_to: int = 3
    shelf_prefix: str = "S"
    shelf_from: int = 1
    shelf_to: int = 3
    bin_prefix: str = "B"
    bin_from: int = 1
    bin_to: int = 2
    max_capacity_units: int = 100


class WarehouseLocationResponse(WarehouseLocationCreate):
    id: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    is_active: bool = True
    model_config = ConfigDict(from_attributes=True)


class WarehouseLocationMatrixGenerateResponse(BaseModel):
    created_count: int
    skipped_count: int
    locations: List[WarehouseLocationResponse]

class WarehouseCreate(WarehouseBase):
    pass

class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    is_central_godown: Optional[bool] = None
    is_default_for_branch: Optional[bool] = None  # R-007
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("pincode")
    @classmethod
    def validate_pincode(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        cleaned = v.strip()
        if not cleaned:
            return None
        if not re.match(r"^[0-9]{6}$", cleaned):
            raise ValueError("PIN code must be exactly 6 Indian postal digits (e.g. '440029').")
        return cleaned

    @field_validator("state")
    @classmethod
    def validate_state(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        cleaned = v.strip()
        if not cleaned:
            return None
        if cleaned in GST_STATE_CODES:
            return GST_STATE_CODES[cleaned]
        state_names = {s.lower(): s for s in GST_STATE_CODES.values()}
        if cleaned.lower() in state_names:
            return state_names[cleaned.lower()]
        return cleaned

class WarehouseResponse(WarehouseBase):
    id: str
    code: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    is_active: bool
    location_count: Optional[int] = None  # optionally populated by list endpoint
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# --- Product Batch Stock Schemas ---
class ProductBatchStockResponse(BaseModel):
    id: str
    product_id: str
    warehouse_id: str
    batch_no: str
    mfg_date: Optional[date] = None
    expiry_date: Optional[date] = None
    mrp: Optional[Decimal] = None
    purchase_rate: Optional[Decimal] = None
    sale_rate: Optional[Decimal] = None
    quantity: Decimal
    reserved_quantity: Decimal
    damaged_quantity: Decimal
    available_quantity: Optional[Decimal] = None
    last_counted_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class BatchAllocationItem(BaseModel):
    batch_id: str
    batch_no: str
    allocated_quantity: float
    mfg_date: Optional[date] = None
    expiry_date: Optional[date] = None
    mrp: Optional[float] = None
    purchase_rate: Optional[float] = None
    sale_rate: Optional[float] = None


class BatchAllocationRequest(BaseModel):
    product_id: str
    warehouse_id: str
    quantity: Decimal


# --- Stock Transfer Schemas ---
class StockTransferItemCreate(BaseModel):
    product_id: str
    batch_no: str
    quantity: Decimal
    unit_cost: Optional[Decimal] = Decimal("0.00")
    notes: Optional[str] = None

class StockTransferItemResponse(BaseModel):
    id: str
    transfer_id: str
    product_id: str
    batch_no: str
    quantity_dispatched: Decimal
    quantity_received: Decimal
    quantity_shortage: Decimal
    quantity_damaged: Decimal
    unit_cost: Decimal
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class StockTransferCreate(BaseModel):
    source_warehouse_id: str
    dest_warehouse_id: str
    items: List[StockTransferItemCreate]
    transporter_name: Optional[str] = None
    lr_number: Optional[str] = None
    vehicle_number: Optional[str] = None
    e_way_bill_no: Optional[str] = None
    notes: Optional[str] = None

class StockTransferReceiptItem(BaseModel):
    item_id: str
    quantity_received: Decimal
    quantity_shortage: Optional[Decimal] = Decimal("0.0000")
    quantity_damaged: Optional[Decimal] = Decimal("0.0000")

class StockTransferReceiptRequest(BaseModel):
    receipt_details: List[StockTransferReceiptItem]

class StockTransferResponse(BaseModel):
    id: str
    transfer_no: str
    source_warehouse_id: str
    dest_warehouse_id: str
    status: str
    dispatch_date: Optional[datetime] = None
    received_date: Optional[datetime] = None
    transporter_name: Optional[str] = None
    lr_number: Optional[str] = None
    vehicle_number: Optional[str] = None
    e_way_bill_no: Optional[str] = None
    notes: Optional[str] = None
    items: List[StockTransferItemResponse] = []
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# --- Stock Audit Schemas ---
class StockAuditItemResponse(BaseModel):
    id: str
    audit_id: str
    product_id: str
    batch_no: str
    system_qty: Decimal
    counted_qty: Decimal
    variance_qty: Decimal
    unit_cost: Decimal
    variance_value: Decimal
    discrepancy_reason: Optional[str] = None
    is_reconciled: bool
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class StockAuditCreate(BaseModel):
    warehouse_id: str
    audit_type: str = "CYCLE_COUNT"
    notes: Optional[str] = None


class StockAuditCountItemRequest(BaseModel):
    item_id: str
    counted_qty: Decimal
    discrepancy_reason: Optional[str] = None
    notes: Optional[str] = None


class StockAuditBulkCountRequest(BaseModel):
    counts: List[StockAuditCountItemRequest]


class StockAuditBarcodeScanRequest(BaseModel):
    barcode_or_sku: str
    qty_increment: Optional[Decimal] = Decimal("1.0000")
    batch_no: Optional[str] = None


class StockAuditResponse(BaseModel):
    id: str
    audit_no: str
    warehouse_id: str
    audit_date: datetime
    status: str
    audit_type: str
    notes: Optional[str] = None
    reconciled_at: Optional[datetime] = None
    reconciled_by: Optional[str] = None
    items: List[StockAuditItemResponse] = []
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# --- Putaway Engine Schemas ---
class PutawayRecommendationRequest(BaseModel):
    product_id: Optional[str] = None
    item_id: Optional[str] = None
    sku: Optional[str] = None
    quantity: Decimal = Decimal("1.0000")
    batch_no: Optional[str] = None
    is_damaged: bool = False
    preferred_zone: Optional[str] = None


class PutawayCandidateLocation(BaseModel):
    location_id: str
    code: str
    name: str
    zone: str
    aisle: Optional[str] = None
    rack: Optional[str] = None
    shelf: Optional[str] = None
    bin_code: Optional[str] = None
    barcode: Optional[str] = None
    max_capacity_units: Optional[int] = 100
    current_occupancy: float = 0.0
    available_capacity: float = 100.0
    rule_applied: str  # QUARANTINE_ISOLATION, DEDICATED_ITEM_BIN, CO_LOCATED_STOCK, EMPTY_BIN_ALLOCATION, ZONE_CAPACITY_FALLBACK
    model_config = ConfigDict(from_attributes=True)


class PutawayRecommendationResponse(BaseModel):
    warehouse_id: str
    warehouse_code: str
    status: str  # RECOMMENDED, OVER_CAPACITY, NO_LOCATIONS_DEFINED, FALLBACK
    recommended_location: Optional[PutawayCandidateLocation] = None
    alternatives: List[PutawayCandidateLocation] = []
    message: str


# --- Phase 3: Dynamic Picking Bin Replenishment & Slotting Schemas ---
class ReplenishmentTaskItem(BaseModel):
    task_id: str
    item_id: str
    product_id: Optional[str] = None
    item_code: str
    product_name: str
    sku: Optional[str] = None
    picking_location_id: Optional[str] = None
    picking_bin: str
    current_picking_stock: float
    min_reorder_level: float
    max_capacity: float
    reorder_quantity: float
    source_location_id: Optional[str] = None
    source_bin: Optional[str] = None
    available_bulk_stock: float
    suggested_quantity: float
    priority: str  # CRITICAL, HIGH, NORMAL, BULK_STOCKOUT
    status: str    # READY, BLOCKED, EXECUTED
    message: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ReplenishmentTasksResponse(BaseModel):
    warehouse_id: str
    warehouse_code: str
    total_tasks: int
    critical_count: int
    high_count: int
    normal_count: int
    bulk_stockout_count: int
    tasks: List[ReplenishmentTaskItem]
    model_config = ConfigDict(from_attributes=True)


class ReplenishmentExecuteItem(BaseModel):
    task_id: Optional[str] = None
    item_id: str
    product_id: Optional[str] = None
    item_code: Optional[str] = None
    product_name: Optional[str] = None
    sku: Optional[str] = None
    source_bin: str
    destination_bin: str
    quantity: Decimal
    batch_no: Optional[str] = None


class ReplenishmentExecuteRequest(BaseModel):
    tasks: List[ReplenishmentExecuteItem]
    notes: Optional[str] = None


class ReplenishmentExecuteResponse(BaseModel):
    warehouse_id: str
    run_id: str
    total_transfers: int
    total_units: float
    executed_tasks: List[ReplenishmentExecuteItem]
    message: str
    model_config = ConfigDict(from_attributes=True)


class ItemSlottingConfigItem(BaseModel):
    id: Optional[str] = None
    item_id: str
    item_code: str
    item_name: str
    warehouse_id: str
    location_bin: str
    zone: Optional[str] = None
    current_stock: float = 0.0
    min_reorder_level: float = 0.0
    max_capacity: float = 0.0
    reorder_quantity: float = 0.0
    model_config = ConfigDict(from_attributes=True)


class ItemSlottingSaveRequest(BaseModel):
    item_id: str
    location_bin: str
    min_reorder_level: Decimal = Decimal("10.00")
    max_capacity: Decimal = Decimal("100.00")
    reorder_quantity: Decimal = Decimal("50.00")


# --- WMS Phase 4: RF Gun Handheld Terminal Schemas ---

class RfBarcodeVerifyRequest(BaseModel):
    barcode: str
    expected_type: Optional[str] = None  # "LOCATION", "ITEM", or None for auto-detect


class RfLocationMatch(BaseModel):
    id: str
    code: str
    name: str
    zone: str
    barcode: Optional[str] = None
    max_capacity_units: int = 100
    is_locked: bool = False
    model_config = ConfigDict(from_attributes=True)


class RfItemMatch(BaseModel):
    id: str
    item_code: str
    item_name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    current_bin: Optional[str] = None
    total_stock: float = 0.0
    model_config = ConfigDict(from_attributes=True)


class RfBarcodeVerifyResponse(BaseModel):
    matched: bool
    entity_type: str  # "LOCATION", "ITEM", "UNKNOWN"
    barcode: str
    location: Optional[RfLocationMatch] = None
    item: Optional[RfItemMatch] = None
    message: str
    model_config = ConfigDict(from_attributes=True)


class RfBinItemSummary(BaseModel):
    item_id: str
    product_id: Optional[str] = None
    item_code: str
    item_name: str
    sku: Optional[str] = None
    batch_no: Optional[str] = None
    quantity: float
    model_config = ConfigDict(from_attributes=True)


class RfBinSummaryResponse(BaseModel):
    warehouse_id: str
    warehouse_code: str
    location_id: str
    bin_code: str
    barcode: Optional[str] = None
    zone: str
    max_capacity_units: int
    total_units_occupied: float
    headroom_units: float
    is_locked: bool
    items: List[RfBinItemSummary]
    model_config = ConfigDict(from_attributes=True)


class RfQuickTransferRequest(BaseModel):
    from_bin: str
    to_bin: str
    item_id: str
    quantity: Decimal
    batch_no: Optional[str] = None
    notes: Optional[str] = "RF Quick Relocate"


class RfQuickTransferResponse(BaseModel):
    transfer_id: str
    warehouse_id: str
    from_bin: str
    to_bin: str
    item_id: str
    item_code: str
    quantity: float
    remaining_source_stock: float
    new_target_stock: float
    status: str
    message: str
    model_config = ConfigDict(from_attributes=True)


class RfReplenishConfirmRequest(BaseModel):
    task_id: Optional[str] = None
    scanned_source_bin: str
    scanned_item_barcode: str
    scanned_destination_bin: str
    quantity: Decimal
    notes: Optional[str] = None


class RfReplenishConfirmResponse(BaseModel):
    success: bool
    run_id: str
    task_id: Optional[str] = None
    transferred_units: float
    source_bin: str
    destination_bin: str
    status: str
    message: str
    model_config = ConfigDict(from_attributes=True)



