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
from typing import Optional, List, Dict, Any
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


# =============================================================================
# WMS Phase 5: Automated Wave Picking, Batch Picking & Packing Station Schemas
# =============================================================================

class WavePickLineCreate(BaseModel):
    order_id: Optional[str] = None
    line_no: Optional[int] = 1
    item_id: str
    product_id: Optional[str] = None
    item_code: str
    product_name: str
    sku: Optional[str] = None
    requested_qty: Decimal
    preferred_bin: Optional[str] = None


class WaveCreateRequest(BaseModel):
    wave_name: Optional[str] = None
    order_lines: Optional[List[WavePickLineCreate]] = None
    order_ids: Optional[List[str]] = None
    zone: Optional[str] = None
    pickers: Optional[List[str]] = None
    staging_bay: Optional[str] = "BAY-04"


class WaveTaskResponse(BaseModel):
    task_id: str
    order_id: Optional[str] = None
    line_no: Optional[int] = 1
    item_id: str
    item_code: str
    product_name: str
    sku: Optional[str] = None
    bin_location: str
    bin_rfid_tag: Optional[str] = None
    aisle: Optional[str] = None
    zone: Optional[str] = None
    requested_qty: float
    picked_qty: float = 0.0
    short_qty: float = 0.0
    picker_id: Optional[str] = None
    status: str = "PENDING"  # PENDING, IN_PROGRESS, PICKED, SHORTED, SKIPPED
    sort_key: int = 0
    model_config = ConfigDict(from_attributes=True)


class WaveResponse(BaseModel):
    wave_id: str
    wave_no: int = 1
    warehouse_id: str
    warehouse_code: str
    staging_bay: str = "BAY-04"
    status: str = "OPEN"  # OPEN, IN_PROGRESS, COMPLETED, CANCELLED
    total_tasks: int = 0
    completed_tasks: int = 0
    shorted_tasks: int = 0
    total_units_requested: float = 0.0
    total_units_picked: float = 0.0
    progress_percent: int = 0
    created_at: str
    completed_at: Optional[str] = None
    tasks: List[WaveTaskResponse] = []
    model_config = ConfigDict(from_attributes=True)


class WaveListResponse(BaseModel):
    warehouse_id: str
    warehouse_code: str
    total_waves: int
    waves: List[WaveResponse]
    model_config = ConfigDict(from_attributes=True)


class WavePickActionRequest(BaseModel):
    task_id: str
    picked_qty: Decimal
    scanned_code: Optional[str] = None  # Barcode or RFID tag scanned
    is_shortage: bool = False
    reason: Optional[str] = None


class WavePickActionResponse(BaseModel):
    wave_id: str
    task_id: str
    status: str
    picked_qty: float
    progress_percent: int
    message: str
    model_config = ConfigDict(from_attributes=True)


class WaveCompleteRequest(BaseModel):
    staging_bay: Optional[str] = None
    packing_station_id: Optional[str] = "PACKING-STATION-01"
    notes: Optional[str] = None


class WaveCompleteResponse(BaseModel):
    wave_id: str
    warehouse_id: str
    status: str
    staging_bay: str
    total_units_transferred: float
    transfers_count: int
    message: str
    model_config = ConfigDict(from_attributes=True)


class PackingManifestItem(BaseModel):
    item_id: str
    item_code: str
    product_name: str
    sku: Optional[str] = None
    wave_id: str
    quantity: float
    packed_quantity: float = 0.0
    status: str = "STAGED"  # STAGED, PACKED
    model_config = ConfigDict(from_attributes=True)


class PackingStationManifestResponse(BaseModel):
    warehouse_id: str
    warehouse_code: str
    staging_bay: str
    total_items: int
    total_units: float
    items: List[PackingManifestItem]
    model_config = ConfigDict(from_attributes=True)


class CartonPackRequest(BaseModel):
    wave_id: str
    carton_no: Optional[str] = None
    items: List[Dict[str, Any]]
    gross_weight_kg: Optional[Decimal] = None
    notes: Optional[str] = None


class CartonPackResponse(BaseModel):
    carton_id: str
    carton_no: str
    wave_id: str
    total_packed_units: float
    gross_weight_kg: Optional[float] = None
    status: str = "SEALED"
    message: str
    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# WMS Phase 6: Warehouse Physical Bin Cycle Counting & Blind Audits Schemas
# =============================================================================

class CycleCountPlanCreate(BaseModel):
    warehouse_id: str
    plan_name: Optional[str] = None
    zone: Optional[str] = None  # PICKING, BULK, STORAGE, QUARANTINE, or None
    aisle: Optional[str] = None  # e.g., A-01 or None
    bins: Optional[List[str]] = None  # Explicit list of bin codes (e.g., ["A-01-01"])
    is_blind: bool = True  # Blind audit mode (hides system_qty from floor counters)
    variance_threshold_value: Decimal = Decimal("1000.00")  # Monetary limit requiring approval
    variance_threshold_pct: Decimal = Decimal("5.00")  # Percentage limit requiring approval
    notes: Optional[str] = None


class CycleCountItemResponse(BaseModel):
    item_id: str
    product_id: str
    item_code: str
    product_name: str
    sku: Optional[str] = None
    bin_location: str
    zone: Optional[str] = None
    aisle: Optional[str] = None
    batch_no: Optional[str] = None
    system_qty: Optional[float] = None  # None/hidden when is_blind is active and not revealed
    counted_qty: float = 0.0
    variance_qty: Optional[float] = None
    variance_value: Optional[float] = None
    unit_cost: float = 0.0
    discrepancy_reason: Optional[str] = None  # MATCHED, DAMAGED, EXPIRED, THEFT_LOSS, SURPLUS_FOUND, COUNTING_ERROR
    status: str = "PENDING"  # PENDING, COUNTED, RECOUNT_REQUESTED, AUTO_APPROVED, APPROVAL_REQUIRED, APPROVED, RECONCILED
    recount_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class CycleCountPlanResponse(BaseModel):
    plan_id: str
    plan_no: str
    warehouse_id: str
    warehouse_code: str
    plan_name: str
    zone: Optional[str] = None
    aisle: Optional[str] = None
    is_blind: bool = True
    status: str = "IN_PROGRESS"  # IN_PROGRESS, PENDING_APPROVAL, APPROVED, RECONCILED, CANCELLED
    variance_threshold_value: float = 1000.00
    variance_threshold_pct: float = 5.00
    total_bins: int = 0
    total_items: int = 0
    counted_items: int = 0
    matched_items: int = 0
    variance_items: int = 0
    requires_approval: bool = False
    created_at: str
    completed_at: Optional[str] = None
    items: List[CycleCountItemResponse] = []
    notes: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class CycleCountPlanListResponse(BaseModel):
    warehouse_id: str
    warehouse_code: str
    total_plans: int
    plans: List[CycleCountPlanResponse]
    model_config = ConfigDict(from_attributes=True)


class CycleCountRecordCountRequest(BaseModel):
    item_id: str
    counted_qty: Decimal
    scanned_barcode: Optional[str] = None
    discrepancy_reason: Optional[str] = None
    notes: Optional[str] = None


class CycleCountRecordCountResponse(BaseModel):
    plan_id: str
    item_id: str
    bin_location: str
    counted_qty: float
    status: str  # COUNTED, AUTO_APPROVED, APPROVAL_REQUIRED
    variance_qty: Optional[float] = None
    variance_value: Optional[float] = None
    requires_approval: bool
    message: str
    model_config = ConfigDict(from_attributes=True)


class CycleCountRecountRequest(BaseModel):
    item_id: str
    reason: str
    assigned_counter: Optional[str] = None


class CycleCountRecountResponse(BaseModel):
    plan_id: str
    item_id: str
    status: str = "RECOUNT_REQUESTED"
    message: str
    model_config = ConfigDict(from_attributes=True)


class CycleCountApproveRequest(BaseModel):
    supervisor_notes: Optional[str] = None


class CycleCountApproveResponse(BaseModel):
    plan_id: str
    status: str = "APPROVED"
    approved_by: str
    message: str
    model_config = ConfigDict(from_attributes=True)


class CycleCountReconcileResponse(BaseModel):
    plan_id: str
    warehouse_id: str
    status: str = "RECONCILED"
    adjustments_posted: int
    net_variance_value: float
    reconciled_at: str
    message: str
    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# WMS Phase 7: Outbound Shipping Dock Management & Dispatch Manifest Schemas
# =============================================================================

class DockDoorResponse(BaseModel):
    id: str
    code: str
    name: str
    zone: str = "DOCK"
    status: str = "AVAILABLE"  # AVAILABLE, OCCUPIED, LOADING, MAINTENANCE
    assigned_vehicle: Optional[str] = None
    staged_cartons_count: int = 0
    active_manifest_id: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class CartonDockStageRequest(BaseModel):
    carton_barcodes: List[str]
    dock_door_code: str


class CartonDockStageResponse(BaseModel):
    dock_door_code: str
    staged_cartons_count: int
    message: str
    model_config = ConfigDict(from_attributes=True)


class ManifestCartonItem(BaseModel):
    carton_barcode: str
    wave_id: Optional[str] = None
    gross_weight_kg: float = 0.0
    items_count: int = 0
    destination_branch: Optional[str] = None
    destination_customer: Optional[str] = None
    is_gate_scanned: bool = False
    scanned_at: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class DispatchManifestCreate(BaseModel):
    warehouse_id: str
    dock_door_code: str
    carton_barcodes: List[str]
    transporter_name: str
    vehicle_no: str
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    lr_docket_no: Optional[str] = None
    eway_bill_no: Optional[str] = None
    destination: Optional[str] = None
    notes: Optional[str] = None


class DispatchManifestResponse(BaseModel):
    manifest_id: str
    manifest_no: str
    warehouse_id: str
    dock_door_code: str
    transporter_name: str
    vehicle_no: str
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    lr_docket_no: Optional[str] = None
    eway_bill_no: Optional[str] = None
    destination: Optional[str] = None
    status: str = "STAGED"  # STAGED, LOADING, GATE_VERIFIED, DISPATCHED, CANCELLED
    total_cartons: int = 0
    scanned_cartons: int = 0
    total_weight_kg: float = 0.0
    is_fully_scanned: bool = False
    created_at: str
    dispatched_at: Optional[str] = None
    gate_pass_no: Optional[str] = None
    cartons: List[ManifestCartonItem] = []
    notes: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class DispatchManifestListResponse(BaseModel):
    warehouse_id: str
    total_manifests: int
    manifests: List[DispatchManifestResponse]
    model_config = ConfigDict(from_attributes=True)


class GateScanItemRequest(BaseModel):
    carton_barcode: str


class GateScanItemResponse(BaseModel):
    manifest_id: str
    carton_barcode: str
    scanned_cartons: int
    total_cartons: int
    is_fully_scanned: bool
    status: str
    message: str
    model_config = ConfigDict(from_attributes=True)


class ManifestDispatchConfirmRequest(BaseModel):
    supervisor_override: bool = False
    override_reason: Optional[str] = None


class ManifestDispatchConfirmResponse(BaseModel):
    manifest_id: str
    manifest_no: str
    warehouse_id: str
    status: str = "DISPATCHED"
    vehicle_no: str
    transporter_name: str
    dispatched_cartons_count: int
    gate_pass_no: str
    dispatched_at: str
    message: str
    model_config = ConfigDict(from_attributes=True)





