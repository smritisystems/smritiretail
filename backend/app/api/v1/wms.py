"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.18.0
Created      : 2026-08-22
Modified     : 2026-10-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Any
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, defer
from sqlalchemy import func, text

from ...api.deps import (
    get_company_db, get_tenant_context, TenantContext,
    require_role, require_permission
)
from ...models.auth import UserRole
from ...models.tenant import Branch
from ...models.inventory import (
    Warehouse, WarehouseLocation, StockMovement, ProductBatchStock,
    StockTransfer, StockTransferItem, StockAudit, StockAuditItem
)
from ...schemas.wms import (
    WarehouseCreate, WarehouseUpdate, WarehouseResponse,
    WarehouseLocationCreate, WarehouseLocationResponse,
    WarehouseLocationUpdate, WarehouseLocationMatrixGenerateRequest, WarehouseLocationMatrixGenerateResponse,
    ProductBatchStockResponse, BatchAllocationRequest, BatchAllocationItem,
    StockTransferCreate, StockTransferResponse, StockTransferReceiptRequest,
    StockAuditCreate, StockAuditResponse, StockAuditItemResponse,
    StockAuditCountItemRequest, StockAuditBulkCountRequest, StockAuditBarcodeScanRequest,
    PutawayRecommendationRequest, PutawayCandidateLocation, PutawayRecommendationResponse,
    ReplenishmentTaskItem, ReplenishmentTasksResponse, ReplenishmentExecuteItem,
    ReplenishmentExecuteRequest, ReplenishmentExecuteResponse,
    ItemSlottingConfigItem, ItemSlottingSaveRequest,
    RfBarcodeVerifyRequest, RfBarcodeVerifyResponse,
    RfBinSummaryResponse, RfQuickTransferRequest, RfQuickTransferResponse,
    RfReplenishConfirmRequest, RfReplenishConfirmResponse,
    WaveCreateRequest, WaveResponse, WaveListResponse,
    WavePickActionRequest, WavePickActionResponse,
    WaveCompleteRequest, WaveCompleteResponse,
    PackingStationManifestResponse, CartonPackRequest, CartonPackResponse
)
from ...services.inventory_wms import InventoryWmsService
from ...services.eway_bill_service import EWayBillService
from ...services.stock_audit_service import StockAuditService

router = APIRouter()


async def _get_warehouse_resilient(
    db: AsyncSession, warehouse_id: str, company_id: str
) -> Optional[Warehouse]:
    """Retrieve warehouse by ID with automatic schema-drift fallback (is_default_for_branch)."""
    try:
        q = select(Warehouse).where(
            Warehouse.id == warehouse_id,
            Warehouse.company_id == company_id,
            Warehouse.is_deleted == False,
        )
        res = await db.execute(q)
        return res.scalars().first()
    except Exception:
        await db.rollback()
        stmt = (
            select(Warehouse)
            .options(defer(Warehouse.is_default_for_branch))
            .where(
                Warehouse.id == warehouse_id,
                Warehouse.company_id == company_id,
                Warehouse.is_deleted == False,
            )
        )
        res = await db.execute(stmt)
        return res.scalars().first()


# ─────────────────────────── Warehouse Masters ───────────────────────────

@router.get("/locations", response_model=List[WarehouseLocationResponse])
async def list_all_warehouse_locations(
    warehouse_id: Optional[str] = Query(None),
    zone: Optional[str] = Query(None),
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List locations across the active company with optional warehouse and zone filtering."""
    q = select(WarehouseLocation).where(
        WarehouseLocation.company_id == tenant_ctx.company_id,
        WarehouseLocation.is_deleted == False,
    )
    if not include_inactive:
        q = q.where(WarehouseLocation.is_active == True)
    if warehouse_id:
        q = q.where(WarehouseLocation.warehouse_id == warehouse_id)
    if zone:
        q = q.where(WarehouseLocation.zone == zone.upper())

    q = q.order_by(WarehouseLocation.warehouse_id.asc(), WarehouseLocation.code.asc())
    result = await db.execute(q)
    return [WarehouseLocationResponse.model_validate(location) for location in result.scalars().all()]

@router.get("/warehouses/{warehouse_id}/locations", response_model=List[WarehouseLocationResponse])
async def list_warehouse_locations(
    warehouse_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List active governed locations for a warehouse."""
    q = select(WarehouseLocation).where(
        WarehouseLocation.warehouse_id == warehouse_id,
        WarehouseLocation.company_id == tenant_ctx.company_id,
        WarehouseLocation.is_deleted == False,
        WarehouseLocation.is_active == True,
    ).order_by(WarehouseLocation.code.asc())
    result = await db.execute(q)
    return [WarehouseLocationResponse.model_validate(location) for location in result.scalars().all()]


@router.post("/warehouses/{warehouse_id}/locations", response_model=WarehouseLocationResponse, status_code=201)
async def create_warehouse_location(
    warehouse_id: str,
    req: WarehouseLocationCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "ADD")),
):
    """Create a governed warehouse location; Item Master consumes these values."""
    warehouse = await _get_warehouse_resilient(db, warehouse_id, tenant_ctx.company_id)
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found.")
    duplicate = await db.scalar(select(WarehouseLocation).where(
        WarehouseLocation.warehouse_id == warehouse_id,
        WarehouseLocation.code == req.code,
        WarehouseLocation.is_deleted == False,
    ))
    if duplicate:
        raise HTTPException(status_code=400, detail=f"Location code '{req.code}' already exists in this warehouse.")
    
    # Auto-generate barcode if not provided
    barcode = req.barcode or f"LOC-{warehouse.code}-{req.code}"
    
    location = WarehouseLocation(
        id=f"loc-{uuid.uuid4().hex[:12]}",
        uuid=str(uuid.uuid4()),
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        warehouse_id=warehouse_id,
        barcode=barcode,
        **req.model_dump(exclude={"warehouse_id", "barcode"}),
    )
    db.add(location)
    await db.commit()
    await db.refresh(location)
    return WarehouseLocationResponse.model_validate(location)


@router.put("/locations/{location_id}", response_model=WarehouseLocationResponse)
async def update_warehouse_location(
    location_id: str,
    req: WarehouseLocationUpdate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "EDIT")),
):
    """Update an existing warehouse location."""
    loc = await db.scalar(select(WarehouseLocation).where(
        WarehouseLocation.id == location_id,
        WarehouseLocation.company_id == tenant_ctx.company_id,
        WarehouseLocation.is_deleted == False,
    ))
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found.")

    update_data = req.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(loc, k, v)

    await db.commit()
    await db.refresh(loc)
    return WarehouseLocationResponse.model_validate(loc)


@router.delete("/locations/{location_id}")
async def delete_warehouse_location(
    location_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "DELETE")),
):
    """Soft-delete an existing warehouse location.

    R-012: Blocks deletion if any stock movement ledger rows reference this location.
    Historical stock movements must remain navigable even after a location is decommissioned.
    If references exist, use is_active=False (PUT /locations/{id}) to deactivate without
    breaking the audit trail.
    """
    loc = await db.scalar(select(WarehouseLocation).where(
        WarehouseLocation.id == location_id,
        WarehouseLocation.company_id == tenant_ctx.company_id,
        WarehouseLocation.is_deleted == False,
    ))
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found.")

    # R-012: Guard — check for historical stock movement references.
    ref_count_q = select(func.count(StockMovement.id)).where(
        StockMovement.location_id == location_id,
        StockMovement.company_id == tenant_ctx.company_id,
    )
    ref_count = await db.scalar(ref_count_q)
    if ref_count and ref_count > 0:
        raise HTTPException(
            status_code=409,
            detail=(
                f"This location has {ref_count} stock movement record(s) referencing it. "
                "Deleting it would make those records unnavigable in reports. "
                "To decommission this location, set is_active=false via PUT /locations/{id} instead."
            ),
        )

    loc.is_deleted = True
    loc.is_active = False
    loc.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"success": True, "message": f"Location '{loc.code}' deleted successfully."}



@router.post("/warehouses/{warehouse_id}/locations/generate", response_model=WarehouseLocationMatrixGenerateResponse, status_code=201)
async def generate_warehouse_locations_matrix(
    warehouse_id: str,
    req: WarehouseLocationMatrixGenerateRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "ADD")),
):
    """Generate a batch of locations for a warehouse based on an Aisle-Rack-Shelf matrix."""
    warehouse = await _get_warehouse_resilient(db, warehouse_id, tenant_ctx.company_id)
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found.")

    existing_q = select(WarehouseLocation.code).where(
        WarehouseLocation.warehouse_id == warehouse_id,
        WarehouseLocation.company_id == tenant_ctx.company_id,
        WarehouseLocation.is_deleted == False,
    )
    existing_res = await db.execute(existing_q)
    existing_codes = set(existing_res.scalars().all())

    new_locations: List[WarehouseLocation] = []
    skipped_count = 0

    zone_prefixes = {
        "STORAGE": "ST",
        "PICKING": "PK",
        "BULK": "BK",
        "QUARANTINE": "QN",
        "RECEIVING": "RC",
    }
    z_prefix = zone_prefixes.get(req.zone.upper(), req.zone[:2].upper())

    for a_idx in range(req.aisle_from, req.aisle_to + 1):
        a_str = f"{req.aisle_prefix}{a_idx:02d}"
        for r_idx in range(req.rack_from, req.rack_to + 1):
            r_str = f"{req.rack_prefix}{r_idx:02d}"
            for s_idx in range(req.shelf_from, req.shelf_to + 1):
                s_str = f"{req.shelf_prefix}{s_idx:02d}"
                for b_idx in range(req.bin_from, req.bin_to + 1):
                    b_str = f"{req.bin_prefix}{b_idx:02d}"

                    code = f"{z_prefix}-{a_str}-{r_str}-{s_str}-{b_str}"
                    if code in existing_codes:
                        skipped_count += 1
                        continue

                    name = f"Aisle {a_idx}, Rack {r_idx}, Shelf {s_idx}, Bin {b_idx}"
                    barcode = f"LOC-{warehouse.code}-{code}"

                    loc = WarehouseLocation(
                        id=f"loc-{uuid.uuid4().hex[:12]}",
                        uuid=str(uuid.uuid4()),
                        company_id=tenant_ctx.company_id,
                        branch_id=tenant_ctx.branch_id,
                        warehouse_id=warehouse_id,
                        code=code,
                        name=name,
                        zone=req.zone.upper(),
                        aisle=a_str,
                        rack=r_str,
                        shelf=s_str,
                        bin_code=b_str,
                        barcode=barcode,
                        max_capacity_units=req.max_capacity_units,
                        is_locked=False,
                        is_active=True,
                        is_deleted=False,
                    )
                    new_locations.append(loc)
                    existing_codes.add(code)

    if new_locations:
        db.add_all(new_locations)
        await db.commit()
        for loc in new_locations:
            await db.refresh(loc)

    return WarehouseLocationMatrixGenerateResponse(
        created_count=len(new_locations),
        skipped_count=skipped_count,
        locations=[WarehouseLocationResponse.model_validate(l) for l in new_locations]
    )


@router.post("/warehouses/{warehouse_id}/putaway-recommendation", response_model=PutawayRecommendationResponse)
async def get_putaway_recommendation(
    warehouse_id: str,
    req: PutawayRecommendationRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "VIEW")),
):
    """
    Automated Putaway Recommendation Engine:
    - Analyzes warehouse layout, physical capacity, and active inventory.
    - Evaluates 4-tier priority rules: Quarantine, Dedicated Bin, Co-located Stock, Nearest Empty Bin.
    - Generates primary recommended location and ranked alternatives.
    - Resilient to schema-drift on unmigrated tenant databases.
    """
    warehouse = await _get_warehouse_resilient(db, warehouse_id, tenant_ctx.company_id)
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found.")

    wms_service = InventoryWmsService(db, tenant_ctx)
    rec = await wms_service.recommend_putaway(
        warehouse_id=warehouse_id,
        warehouse_code=warehouse.code,
        product_id=req.product_id,
        item_id=req.item_id,
        sku=req.sku,
        quantity=req.quantity,
        batch_no=req.batch_no,
        is_damaged=req.is_damaged,
        preferred_zone=req.preferred_zone,
    )
    return PutawayRecommendationResponse.model_validate(rec)


@router.get("/warehouses/{warehouse_id}/replenishment-tasks", response_model=ReplenishmentTasksResponse)
async def get_warehouse_replenishment_tasks(
    warehouse_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "VIEW")),
):
    """
    Dynamic Picking Bin Replenishment Engine:
    - Scans all configured picking bins and identifies depleted stock levels (< min_reorder_level).
    - Identifies candidate bulk storage bins with available stock of the same item.
    - Generates actionable replenishment tasks with suggested transfer quantities.
    - Sorts by urgency (CRITICAL, HIGH, NORMAL, BULK_STOCKOUT).
    """
    wms_service = InventoryWmsService(db, tenant_ctx)
    res = await wms_service.get_replenishment_tasks(warehouse_id=warehouse_id)
    return ReplenishmentTasksResponse.model_validate(res)


@router.post("/warehouses/{warehouse_id}/replenishment/execute", response_model=ReplenishmentExecuteResponse)
async def execute_warehouse_replenishment(
    warehouse_id: str,
    req: ReplenishmentExecuteRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "EDIT")),
):
    """
    Executes internal stock replenishment transfers atomically:
    - Moves quantity from source bulk storage bin to destination picking bin.
    - Writes dual StockMovement ledger records (TRANSFER_OUT and TRANSFER_IN).
    - Preserves audit trails under reference_doc_type="WMS_REPLENISHMENT".
    """
    wms_service = InventoryWmsService(db, tenant_ctx)
    res = await wms_service.execute_replenishment_tasks(
        warehouse_id=warehouse_id,
        tasks=req.tasks,
        notes=req.notes
    )
    return ReplenishmentExecuteResponse.model_validate(res)


@router.get("/warehouses/{warehouse_id}/slotting", response_model=List[ItemSlottingConfigItem])
async def get_warehouse_slotting(
    warehouse_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "VIEW")),
):
    """List picking bin slotting configurations and current on-hand levels for a warehouse."""
    wms_service = InventoryWmsService(db, tenant_ctx)
    rows = await wms_service.get_warehouse_slotting(warehouse_id=warehouse_id)
    return [ItemSlottingConfigItem.model_validate(r) for r in rows]


@router.post("/warehouses/{warehouse_id}/slotting")
async def save_warehouse_item_slotting(
    warehouse_id: str,
    req: ItemSlottingSaveRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "EDIT")),
):
    """Create or update dedicated picking bin and min/max thresholds for an item."""
    wms_service = InventoryWmsService(db, tenant_ctx)
    return await wms_service.save_item_slotting(
        warehouse_id=warehouse_id,
        item_id=req.item_id,
        location_bin=req.location_bin,
        min_reorder_level=req.min_reorder_level,
        max_capacity=req.max_capacity,
        reorder_quantity=req.reorder_quantity,
    )


# =============================================================================
# WMS Phase 4: RF Gun Handheld Terminal Endpoints
# =============================================================================

@router.post("/warehouses/{warehouse_id}/rf/verify-barcode", response_model=RfBarcodeVerifyResponse)
async def verify_rf_barcode(
    warehouse_id: str,
    req: RfBarcodeVerifyRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "VIEW")),
):
    """
    Rapid barcode verification for handheld RF scanners:
    - Auto-disambiguates whether a scanned code is a Location Bin or an Item/Product SKU.
    - Returns metadata, current stock, and validation status in < 30ms.
    """
    wms_service = InventoryWmsService(db, tenant_ctx)
    res = await wms_service.verify_rf_barcode(
        warehouse_id=warehouse_id,
        barcode=req.barcode,
        expected_type=req.expected_type,
    )
    return RfBarcodeVerifyResponse.model_validate(res)


@router.get("/warehouses/{warehouse_id}/rf/bin-summary", response_model=RfBinSummaryResponse)
async def get_rf_bin_summary(
    warehouse_id: str,
    bin_code: str = Query(..., description="Bin code or barcode to inspect"),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "VIEW")),
):
    """
    Mobile bin inspection & audit query:
    - Returns real-time physical headroom, total occupied units, and active SKU list from StockMovement.
    """
    wms_service = InventoryWmsService(db, tenant_ctx)
    res = await wms_service.get_rf_bin_summary(
        warehouse_id=warehouse_id,
        bin_code=bin_code,
    )
    return RfBinSummaryResponse.model_validate(res)


@router.post("/warehouses/{warehouse_id}/rf/quick-transfer", response_model=RfQuickTransferResponse)
async def execute_rf_quick_transfer(
    warehouse_id: str,
    req: RfQuickTransferRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "EDIT")),
):
    """
    Instant ad-hoc stock relocation from mobile RF gun:
    - Validates source bin stock, destination bin lock status, and executes atomic dual StockMovements.
    - Tags records with reference_doc_type='WMS_RF_TRANSFER'.
    """
    wms_service = InventoryWmsService(db, tenant_ctx)
    res = await wms_service.execute_rf_quick_transfer(
        warehouse_id=warehouse_id,
        from_bin=req.from_bin,
        to_bin=req.to_bin,
        item_id=req.item_id,
        quantity=req.quantity,
        batch_no=req.batch_no,
        notes=req.notes,
    )
    return RfQuickTransferResponse.model_validate(res)


@router.post("/warehouses/{warehouse_id}/rf/replenish-confirm", response_model=RfReplenishConfirmResponse)
async def confirm_rf_replenishment(
    warehouse_id: str,
    req: RfReplenishConfirmRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "EDIT")),
):
    """
    Multi-scan guided replenishment completion from mobile RF gun:
    - Confirms that operator physically scanned source bin, item barcode, and destination picking bin.
    - Posts atomic dual StockMovement transfer under reference_doc_type='WMS_REPLENISHMENT'.
    """
    wms_service = InventoryWmsService(db, tenant_ctx)
    res = await wms_service.confirm_rf_replenishment(
        warehouse_id=warehouse_id,
        scanned_source_bin=req.scanned_source_bin,
        scanned_item_barcode=req.scanned_item_barcode,
        scanned_destination_bin=req.scanned_destination_bin,
        quantity=req.quantity,
        task_id=req.task_id,
        notes=req.notes,
    )
    return RfReplenishConfirmResponse.model_validate(res)


# =============================================================================
# WMS Phase 5: Automated Wave Picking, Batch Picking & Packing Station Routes
# =============================================================================

@router.post("/warehouses/{warehouse_id}/waves", response_model=WaveResponse, status_code=201)
async def create_pick_wave(
    warehouse_id: str,
    req: WaveCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "ADD")),
):
    """
    Creates an optimized batch pick wave from sales orders or demand lines.
    Calculates single-pass serpentine travel path and balances picker tasks.
    """
    wms_service = InventoryWmsService(db, tenant_ctx)
    res = await wms_service.create_pick_wave(
        warehouse_id=warehouse_id,
        wave_name=req.wave_name,
        order_lines=req.order_lines,
        order_ids=req.order_ids,
        zone=req.zone,
        pickers=req.pickers,
        staging_bay=req.staging_bay,
    )
    return WaveResponse.model_validate(res)


@router.get("/warehouses/{warehouse_id}/waves", response_model=WaveListResponse)
async def list_pick_waves(
    warehouse_id: str,
    status: Optional[str] = Query(None, description="Filter by wave status (OPEN, IN_PROGRESS, COMPLETED)"),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Lists all wave pick batches for a warehouse with progress metrics."""
    wms_service = InventoryWmsService(db, tenant_ctx)
    res = await wms_service.get_waves(warehouse_id=warehouse_id, status=status)
    return WaveListResponse.model_validate(res)


@router.get("/warehouses/{warehouse_id}/waves/{wave_id}", response_model=WaveResponse)
async def get_pick_wave_details(
    warehouse_id: str,
    wave_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Retrieves full pick manifest with serpentine task ordering for a specific wave."""
    wms_service = InventoryWmsService(db, tenant_ctx)
    res = await wms_service.get_wave_details(warehouse_id=warehouse_id, wave_id=wave_id)
    return WaveResponse.model_validate(res)


@router.post("/warehouses/{warehouse_id}/waves/{wave_id}/pick", response_model=WavePickActionResponse)
async def record_wave_item_pick(
    warehouse_id: str,
    wave_id: str,
    req: WavePickActionRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "EDIT")),
):
    """
    Records an optical barcode / RFID pick scan against a wave line item.
    Supports full quantity confirmation, partial shortage, or floor skip.
    """
    wms_service = InventoryWmsService(db, tenant_ctx)
    res = await wms_service.record_wave_pick(
        warehouse_id=warehouse_id,
        wave_id=wave_id,
        task_id=req.task_id,
        picked_qty=req.picked_qty,
        scanned_code=req.scanned_code,
        is_shortage=req.is_shortage,
        reason=req.reason,
    )
    return WavePickActionResponse.model_validate(res)


@router.post("/warehouses/{warehouse_id}/waves/{wave_id}/complete", response_model=WaveCompleteResponse)
async def complete_wave_and_dispatch(
    warehouse_id: str,
    wave_id: str,
    req: WaveCompleteRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "EDIT")),
):
    """
    Finalizes wave picking and atomically transfers picked inventory to the Staging Bay / Packing Station.
    Generates linked dual StockMovements under reference_doc_type='WMS_WAVE_PICK'.
    """
    wms_service = InventoryWmsService(db, tenant_ctx)
    res = await wms_service.complete_wave_and_dispatch(
        warehouse_id=warehouse_id,
        wave_id=wave_id,
        staging_bay=req.staging_bay,
        packing_station_id=req.packing_station_id,
        notes=req.notes,
    )
    return WaveCompleteResponse.model_validate(res)


@router.get("/warehouses/{warehouse_id}/packing-station", response_model=PackingStationManifestResponse)
async def get_packing_station_manifest(
    warehouse_id: str,
    staging_bay: Optional[str] = Query("BAY-04", description="Staging Bay code"),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Inspects staged wave inventory ready for carton packing and shipping label generation."""
    wms_service = InventoryWmsService(db, tenant_ctx)
    res = await wms_service.get_packing_station_manifest(
        warehouse_id=warehouse_id,
        staging_bay=staging_bay,
    )
    return PackingStationManifestResponse.model_validate(res)


@router.post("/warehouses/{warehouse_id}/packing-station/pack", response_model=CartonPackResponse)
async def pack_wave_carton(
    warehouse_id: str,
    req: CartonPackRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "ADD")),
):
    """Packs staged items into a barcoded shipping carton with gross weight verification."""
    wms_service = InventoryWmsService(db, tenant_ctx)
    res = await wms_service.pack_wave_carton(
        warehouse_id=warehouse_id,
        wave_id=req.wave_id,
        carton_no=req.carton_no,
        items=req.items,
        gross_weight_kg=req.gross_weight_kg,
        notes=req.notes,
    )
    return CartonPackResponse.model_validate(res)


@router.get("/locations/{location_id}/stock")
async def get_location_stock(
    location_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Retrieve items and stock assigned to this warehouse location."""
    loc = await db.scalar(select(WarehouseLocation).where(
        WarehouseLocation.id == location_id,
        WarehouseLocation.company_id == tenant_ctx.company_id,
        WarehouseLocation.is_deleted == False,
    ))
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found.")

    from ...models.item_master import ItemWarehouseLocation, Item
    stmt = select(ItemWarehouseLocation, Item).join(
        Item, ItemWarehouseLocation.item_id == Item.id, isouter=True
    ).where(
        ItemWarehouseLocation.warehouse_id == loc.warehouse_id,
        ItemWarehouseLocation.location_bin == loc.code,
        ItemWarehouseLocation.company_id == tenant_ctx.company_id,
        ItemWarehouseLocation.is_deleted == False,
    )
    res = await db.execute(stmt)
    rows = res.all()

    items = []
    for iwl, item in rows:
        items.append({
            "item_id": iwl.item_id,
            "item_code": item.code if item else "",
            "item_name": item.name if item else "",
            "min_reorder_level": float(iwl.min_reorder_level or 0),
            "max_capacity": float(iwl.max_capacity or 0),
            "reorder_quantity": float(iwl.reorder_quantity or 0),
        })

    return {
        "location": WarehouseLocationResponse.model_validate(loc),
        "assigned_items_count": len(items),
        "items": items,
    }

@router.get("/warehouses", response_model=List[WarehouseResponse])
async def list_warehouses(
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all warehouses for the active company tenant with schema drift resilience."""
    try:
        q = select(Warehouse).where(
            Warehouse.company_id == tenant_ctx.company_id,
            Warehouse.is_deleted == False
        ).order_by(Warehouse.created_at.asc())
        res = await db.execute(q)
        return [WarehouseResponse.model_validate(w) for w in res.scalars().all()]
    except Exception:
        # Schema-drift fallback: if is_default_for_branch column is absent on an unmigrated tenant DB
        await db.rollback()
        stmt = select(Warehouse).options(defer(Warehouse.is_default_for_branch)).where(
            Warehouse.company_id == tenant_ctx.company_id,
            Warehouse.is_deleted == False
        ).order_by(Warehouse.created_at.asc())
        res = await db.execute(stmt)
        warehouses = res.scalars().all()
        out = []
        for w in warehouses:
            out.append(WarehouseResponse(
                id=w.id,
                company_id=w.company_id,
                branch_id=w.branch_id,
                code=w.code,
                name=w.name,
                is_transit=w.is_transit or False,
                is_central_godown=w.is_central_godown or False,
                is_default_for_branch=False,
                address=w.address,
                city=w.city,
                state=w.state,
                pincode=w.pincode,
                contact_person=w.contact_person,
                phone=w.phone,
                is_active=w.is_active if w.is_active is not None else True,
                created_at=w.created_at,
                modified_at=w.modified_at,
            ))
        return out


@router.get("/branches")
async def list_branches_wms(
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """R-008: List all registered company branches directly for the active company tenant."""
    q = select(Branch).where(
        Branch.company_id == tenant_ctx.company_id,
        Branch.is_deleted == False,
    ).order_by(Branch.name.asc())
    res = await db.execute(q)
    return [
        {
            "id": b.id,
            "code": b.code,
            "name": b.name,
            "company_id": b.company_id,
            "city": getattr(b, "city", None),
            "state": getattr(b, "state", None),
            "pincode": getattr(b, "pincode", None),
            "address": getattr(b, "address", None),
            "phone": getattr(b, "phone", None),
            "email": getattr(b, "email", None),
            "is_active": b.is_active,
        }
        for b in res.scalars().all()
    ]


@router.post("/warehouses", response_model=WarehouseResponse, status_code=201)
async def create_warehouse(
    req: WarehouseCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "ADD")),
):
    """Create a new warehouse / godown under the active company tenant.

    Generates or validates unique warehouse code:
    - If code provided: validates format [A-Z0-9_-] and verifies uniqueness in company (cannot reuse deactivated codes).
    - If code omitted: auto-generates readable sequential code WH-{BRANCH}-{SEQ:03d} or WH-{SEQ:03d}.
    - Assigns stable technical ID wh-{uuid}.
    - Resilient to schema-drift on unmigrated tenant databases.
    """
    target_branch_id = req.branch_id or tenant_ctx.branch_id
    code = (req.code or "").strip().upper()

    if code:
        if not re.match(r"^[A-Z0-9_\-\.]{2,50}$", code):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid warehouse code '{code}'. Must be 2-50 alphanumeric characters (letters, numbers, hyphens, underscores).",
            )
        # Check uniqueness across active and deactivated records in company
        q_exist = select(Warehouse.id).where(
            Warehouse.company_id == tenant_ctx.company_id,
            func.upper(Warehouse.code) == code,
            Warehouse.is_deleted == False,
        )
        res_exist = await db.execute(q_exist)
        if res_exist.scalars().first():
            raise HTTPException(
                status_code=400,
                detail=f"Warehouse code '{code}' already exists or was previously deactivated in this company.",
            )
    else:
        # Auto-generate unique readable code
        prefix = "WH"
        if target_branch_id:
            b_stmt = select(Branch).where(
                Branch.id == target_branch_id,
                Branch.company_id == tenant_ctx.company_id,
                Branch.is_deleted == False,
            )
            b_res = await db.execute(b_stmt)
            branch_obj = b_res.scalars().first()
            if branch_obj and branch_obj.code:
                clean_tag = re.sub(r"[^A-Z0-9]", "", branch_obj.code.upper())[:4]
                if clean_tag:
                    prefix = f"WH-{clean_tag}"

        pattern = f"{prefix}-%"
        q_codes = select(Warehouse.code).where(
            Warehouse.company_id == tenant_ctx.company_id,
            Warehouse.code.like(pattern),
            Warehouse.is_deleted == False,
        )
        res_codes = await db.execute(q_codes)
        existing_codes = set(str(c).upper() for c in res_codes.scalars().all())

        max_seq = 0
        for ec in existing_codes:
            m = re.search(r"-(\d+)$", ec)
            if m:
                val = int(m.group(1))
                if val > max_seq:
                    max_seq = val

        seq = max_seq + 1
        allocated_code = f"{prefix}-{seq:03d}"
        while allocated_code in existing_codes:
            seq += 1
            allocated_code = f"{prefix}-{seq:03d}"
        code = allocated_code

    wh_id = f"wh-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    try:
        wh = Warehouse(
            id=wh_id,
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=target_branch_id,
            code=code,
            name=req.name,
            is_transit=req.is_transit,
            is_central_godown=req.is_central_godown,
            is_default_for_branch=req.is_default_for_branch,
            address=req.address,
            city=req.city,
            state=req.state,
            pincode=req.pincode,
            contact_person=req.contact_person,
            phone=req.phone,
            is_active=True,
            is_deleted=False,
        )
        db.add(wh)
        await db.commit()
        await db.refresh(wh)
        return WarehouseResponse.model_validate(wh)
    except Exception:
        # Schema-drift fallback: if is_default_for_branch column does not exist on unmigrated tenant DB
        await db.rollback()
        insert_sql = text("""
            INSERT INTO warehouses (
                id, uuid, company_id, branch_id, code, name, is_transit, is_central_godown,
                address, city, state, pincode, contact_person, phone, is_active, is_deleted,
                created_at, modified_at, version
            ) VALUES (
                :id, :uuid, :company_id, :branch_id, :code, :name, :is_transit, :is_central_godown,
                :address, :city, :state, :pincode, :contact_person, :phone, :is_active, :is_deleted,
                :created_at, :modified_at, :version
            )
        """)
        await db.execute(insert_sql, {
            "id": wh_id,
            "uuid": str(uuid.uuid4()),
            "company_id": tenant_ctx.company_id,
            "branch_id": target_branch_id,
            "code": code,
            "name": req.name,
            "is_transit": req.is_transit,
            "is_central_godown": req.is_central_godown,
            "address": req.address,
            "city": req.city,
            "state": req.state,
            "pincode": req.pincode,
            "contact_person": req.contact_person,
            "phone": req.phone,
            "is_active": True,
            "is_deleted": False,
            "created_at": now,
            "modified_at": now,
            "version": 1,
        })
        await db.commit()
        return WarehouseResponse(
            id=wh_id,
            company_id=tenant_ctx.company_id,
            branch_id=target_branch_id,
            code=code,
            name=req.name,
            is_transit=req.is_transit,
            is_central_godown=req.is_central_godown,
            is_default_for_branch=False,
            address=req.address,
            city=req.city,
            state=req.state,
            pincode=req.pincode,
            contact_person=req.contact_person,
            phone=req.phone,
            is_active=True,
            created_at=now,
            modified_at=now,
        )


@router.get("/warehouses/{warehouse_id}", response_model=WarehouseResponse)
async def get_warehouse(
    warehouse_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get warehouse details by ID with schema drift resilience."""
    try:
        q = select(Warehouse).where(
            Warehouse.id == warehouse_id,
            Warehouse.company_id == tenant_ctx.company_id,
            Warehouse.is_deleted == False
        )
        res = await db.execute(q)
        wh = res.scalars().first()
        if not wh:
            raise HTTPException(status_code=404, detail="Warehouse not found.")
        return WarehouseResponse.model_validate(wh)
    except HTTPException:
        raise
    except Exception:
        # Schema-drift fallback: if is_default_for_branch column is absent
        await db.rollback()
        stmt = select(Warehouse).options(defer(Warehouse.is_default_for_branch)).where(
            Warehouse.id == warehouse_id,
            Warehouse.company_id == tenant_ctx.company_id,
            Warehouse.is_deleted == False
        )
        res = await db.execute(stmt)
        w = res.scalars().first()
        if not w:
            raise HTTPException(status_code=404, detail="Warehouse not found.")
        return WarehouseResponse(
            id=w.id,
            company_id=w.company_id,
            branch_id=w.branch_id,
            code=w.code,
            name=w.name,
            is_transit=w.is_transit or False,
            is_central_godown=w.is_central_godown or False,
            is_default_for_branch=False,
            address=w.address,
            city=w.city,
            state=w.state,
            pincode=w.pincode,
            contact_person=w.contact_person,
            phone=w.phone,
            is_active=w.is_active if w.is_active is not None else True,
            created_at=w.created_at,
            modified_at=w.modified_at,
        )


@router.put("/warehouses/{warehouse_id}", response_model=WarehouseResponse)
async def update_warehouse(
    warehouse_id: str,
    req: WarehouseUpdate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "EDIT")),
):
    """Update warehouse details with schema drift resilience."""
    q = select(Warehouse).where(
        Warehouse.id == warehouse_id,
        Warehouse.company_id == tenant_ctx.company_id,
        Warehouse.is_deleted == False
    )
    res = await db.execute(q)
    wh = res.scalars().first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found.")

    update_data = req.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(wh, k, v)

    try:
        await db.commit()
        await db.refresh(wh)
        return WarehouseResponse.model_validate(wh)
    except Exception:
        await db.rollback()
        valid_cols = ["name", "is_central_godown", "address", "city", "state", "pincode", "contact_person", "phone", "is_active"]
        set_clauses = []
        params = {"wh_id": warehouse_id, "comp_id": tenant_ctx.company_id}
        for col in valid_cols:
            if col in update_data:
                set_clauses.append(f"{col} = :{col}")
                params[col] = update_data[col]
        if set_clauses:
            await db.execute(text(f"UPDATE warehouses SET {', '.join(set_clauses)} WHERE id = :wh_id AND company_id = :comp_id"), params)
            await db.commit()
        return WarehouseResponse(
            id=wh.id,
            company_id=wh.company_id,
            branch_id=wh.branch_id,
            code=wh.code,
            name=update_data.get("name", wh.name),
            is_transit=wh.is_transit or False,
            is_central_godown=update_data.get("is_central_godown", wh.is_central_godown or False),
            is_default_for_branch=False,
            address=update_data.get("address", wh.address),
            city=update_data.get("city", wh.city),
            state=update_data.get("state", wh.state),
            pincode=update_data.get("pincode", wh.pincode),
            contact_person=update_data.get("contact_person", wh.contact_person),
            phone=update_data.get("phone", wh.phone),
            is_active=update_data.get("is_active", wh.is_active if wh.is_active is not None else True),
            created_at=wh.created_at,
            modified_at=wh.modified_at,
        )


@router.patch("/warehouses/{warehouse_id}/deactivate", response_model=WarehouseResponse)
async def deactivate_warehouse(
    warehouse_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "DELETE")),
):
    """Deactivate a warehouse (set is_active=False) after verifying zero live stock.

    R-013: Blocks deactivation if any ProductBatchStock row for this warehouse holds
    a positive net quantity (quantity - reserved - damaged > 0). Transfer all stock out
    first, then deactivate.
    """
    q = select(Warehouse).where(
        Warehouse.id == warehouse_id,
        Warehouse.company_id == tenant_ctx.company_id,
        Warehouse.is_deleted == False,
    )
    res = await db.execute(q)
    wh = res.scalars().first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found.")

    if not wh.is_active:
        try:
            return WarehouseResponse.model_validate(wh)
        except Exception:
            return WarehouseResponse(
                id=wh.id,
                company_id=wh.company_id,
                branch_id=wh.branch_id,
                code=wh.code,
                name=wh.name,
                is_transit=wh.is_transit or False,
                is_central_godown=wh.is_central_godown or False,
                is_default_for_branch=False,
                address=wh.address,
                city=wh.city,
                state=wh.state,
                pincode=wh.pincode,
                contact_person=wh.contact_person,
                phone=wh.phone,
                is_active=False,
                created_at=wh.created_at,
                modified_at=wh.modified_at,
            )

    # R-013: Stock-zero gate — count batch stock rows with net positive quantity.
    non_zero_q = select(func.count(ProductBatchStock.id)).where(
        ProductBatchStock.warehouse_id == warehouse_id,
        ProductBatchStock.company_id == tenant_ctx.company_id,
        ProductBatchStock.is_deleted == False,
        (ProductBatchStock.quantity - ProductBatchStock.reserved_quantity - ProductBatchStock.damaged_quantity) > 0,
    )
    non_zero_count = await db.scalar(non_zero_q)
    if non_zero_count and non_zero_count > 0:
        raise HTTPException(
            status_code=409,
            detail=(
                f"This warehouse has {non_zero_count} batch(es) with positive stock on hand. "
                "Transfer all stock to another warehouse before deactivating."
            ),
        )

    wh.is_active = False
    # If this was the branch default, clear that flag so the resolver doesn't return an inactive warehouse.
    if hasattr(wh, "is_default_for_branch") and getattr(wh, "is_default_for_branch", None):
        wh.is_default_for_branch = False

    try:
        await db.commit()
        await db.refresh(wh)
        return WarehouseResponse.model_validate(wh)
    except Exception:
        await db.rollback()
        await db.execute(text("UPDATE warehouses SET is_active = false WHERE id = :id AND company_id = :comp_id"), {
            "id": warehouse_id, "comp_id": tenant_ctx.company_id
        })
        await db.commit()
        return WarehouseResponse(
            id=wh.id,
            company_id=wh.company_id,
            branch_id=wh.branch_id,
            code=wh.code,
            name=wh.name,
            is_transit=wh.is_transit or False,
            is_central_godown=wh.is_central_godown or False,
            is_default_for_branch=False,
            address=wh.address,
            city=wh.city,
            state=wh.state,
            pincode=wh.pincode,
            contact_person=wh.contact_person,
            phone=wh.phone,
            is_active=False,
            created_at=wh.created_at,
            modified_at=wh.modified_at,
        )


# ─────────────────────────── Batch Stock & FEFO ───────────────────────────


@router.get("/batch-stocks", response_model=List[ProductBatchStockResponse])
async def list_batch_stocks(
    product_id: Optional[str] = Query(None),
    warehouse_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List live batch stock records for active company."""
    q = select(ProductBatchStock).where(
        ProductBatchStock.company_id == tenant_ctx.company_id,
        ProductBatchStock.is_deleted == False
    )
    if product_id:
        q = q.where(ProductBatchStock.product_id == product_id)
    if warehouse_id:
        q = q.where(ProductBatchStock.warehouse_id == warehouse_id)

    q = q.order_by(ProductBatchStock.expiry_date.asc().nulls_last())
    res = await db.execute(q)
    items = res.scalars().all()

    resp = []
    for it in items:
        avail = Decimal(str(it.quantity)) - Decimal(str(it.reserved_quantity)) - Decimal(str(it.damaged_quantity))
        dto = ProductBatchStockResponse.model_validate(it)
        dto.available_quantity = avail
        resp.append(dto)
    return resp


@router.post("/allocate-fefo", response_model=List[BatchAllocationItem])
async def allocate_batches_fefo(
    req: BatchAllocationRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Allocate product quantities from available batches using FEFO ordering."""
    service = InventoryWmsService(db, tenant_ctx)
    allocations = await service.allocate_stock_fefo(
        product_id=req.product_id,
        warehouse_id=req.warehouse_id,
        requested_qty=req.quantity
    )
    return [BatchAllocationItem(**a) for a in allocations]


# ─────────────────────────── Stock Transfer Orders (STO) ───────────────────────────

@router.get("/transfers", response_model=List[StockTransferResponse])
async def list_transfers(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all stock transfers for the company."""
    q = select(StockTransfer).where(
        StockTransfer.company_id == tenant_ctx.company_id,
        StockTransfer.is_deleted == False
    ).options(selectinload(StockTransfer.items))
    if status:
        q = q.where(StockTransfer.status == status)

    q = q.order_by(StockTransfer.created_at.desc())
    res = await db.execute(q)
    return [StockTransferResponse.model_validate(st) for st in res.scalars().all()]


@router.post("/transfers", response_model=StockTransferResponse, status_code=201)
async def create_transfer(
    req: StockTransferCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    guard: Any = Depends(require_permission("stock_ledger", "ADD")),
):
    """Create a new Stock Transfer Order in DRAFT status."""
    service = InventoryWmsService(db, tenant_ctx)
    items_dict = [it.model_dump() for it in req.items]
    transfer = await service.create_stock_transfer(
        source_warehouse_id=req.source_warehouse_id,
        dest_warehouse_id=req.dest_warehouse_id,
        items_in=items_dict,
        transporter_name=req.transporter_name,
        lr_number=req.lr_number,
        vehicle_number=req.vehicle_number,
        e_way_bill_no=req.e_way_bill_no,
        notes=req.notes,
        idempotency_key=idempotency_key,
    )
    await db.commit()
    
    # Reload with items
    q_re = select(StockTransfer).where(StockTransfer.id == transfer.id).options(selectinload(StockTransfer.items))
    res_re = await db.execute(q_re)
    reloaded = res_re.scalars().first()
    return StockTransferResponse.model_validate(reloaded)


@router.get("/transfers/{transfer_id}", response_model=StockTransferResponse)
async def get_transfer(
    transfer_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get stock transfer details with line items."""
    q = select(StockTransfer).where(
        StockTransfer.id == transfer_id,
        StockTransfer.company_id == tenant_ctx.company_id,
        StockTransfer.is_deleted == False
    ).options(selectinload(StockTransfer.items))
    res = await db.execute(q)
    st = res.scalars().first()
    if not st:
        raise HTTPException(status_code=404, detail="Stock transfer not found.")
    return StockTransferResponse.model_validate(st)


@router.post("/transfers/{transfer_id}/request", response_model=StockTransferResponse)
async def request_transfer(
    transfer_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("stock_ledger", "ADD")),
):
    """R-005: Submit a stock transfer order for approval (DRAFT -> REQUESTED)."""
    service = InventoryWmsService(db, tenant_ctx)
    transfer = await service.request_stock_transfer(transfer_id)
    await db.commit()

    q_re = select(StockTransfer).where(StockTransfer.id == transfer.id).options(selectinload(StockTransfer.items))
    res_re = await db.execute(q_re)
    reloaded = res_re.scalars().first()
    return StockTransferResponse.model_validate(reloaded)


@router.post("/transfers/{transfer_id}/approve", response_model=StockTransferResponse)
async def approve_transfer(
    transfer_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("stock_ledger", "EDIT")),
):
    """R-005: Approve a requested stock transfer order (REQUESTED -> APPROVED)."""
    service = InventoryWmsService(db, tenant_ctx)
    transfer = await service.approve_stock_transfer(transfer_id)
    await db.commit()

    q_re = select(StockTransfer).where(StockTransfer.id == transfer.id).options(selectinload(StockTransfer.items))
    res_re = await db.execute(q_re)
    reloaded = res_re.scalars().first()
    return StockTransferResponse.model_validate(reloaded)


@router.post("/transfers/{transfer_id}/reject", response_model=StockTransferResponse)
async def reject_transfer(
    transfer_id: str,
    reason: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("stock_ledger", "EDIT")),
):
    """R-005: Reject a requested stock transfer order (REQUESTED -> REJECTED)."""
    service = InventoryWmsService(db, tenant_ctx)
    transfer = await service.reject_stock_transfer(transfer_id, reason=reason)
    await db.commit()

    q_re = select(StockTransfer).where(StockTransfer.id == transfer.id).options(selectinload(StockTransfer.items))
    res_re = await db.execute(q_re)
    reloaded = res_re.scalars().first()
    return StockTransferResponse.model_validate(reloaded)


@router.post("/transfers/{transfer_id}/dispatch", response_model=StockTransferResponse)
async def dispatch_transfer(
    transfer_id: str,
    bypass_approval: bool = Query(default=True, description="R-005 configurable approval bypass flag"),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("stock_ledger", "ADD")),
):
    """Dispatch a stock transfer from the source warehouse into IN_TRANSIT."""
    service = InventoryWmsService(db, tenant_ctx)
    transfer = await service.dispatch_stock_transfer(transfer_id, bypass_approval=bypass_approval)
    await db.commit()
    
    q_re = select(StockTransfer).where(StockTransfer.id == transfer.id).options(selectinload(StockTransfer.items))
    res_re = await db.execute(q_re)
    reloaded = res_re.scalars().first()
    return StockTransferResponse.model_validate(reloaded)


@router.post("/transfers/{transfer_id}/receive", response_model=StockTransferResponse)
async def receive_transfer(
    transfer_id: str,
    req: StockTransferReceiptRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("stock_ledger", "ADD")),
):
    """Receive a stock transfer at the destination warehouse with shortage/damage reconciliation."""
    service = InventoryWmsService(db, tenant_ctx)
    receipt_items = [r.model_dump() for r in req.receipt_details]
    transfer = await service.receive_stock_transfer(transfer_id, receipt_items)
    await db.commit()
    
    q_re = select(StockTransfer).where(StockTransfer.id == transfer.id).options(selectinload(StockTransfer.items))
    res_re = await db.execute(q_re)
    reloaded = res_re.scalars().first()
    return StockTransferResponse.model_validate(reloaded)


# ─────────────────────────── E-Way Bill & Delivery Challan ───────────────────────────

@router.get(
    "/transfers/{transfer_id}/eway-bill-payload",
    dependencies=[Depends(require_permission("stock_ledger", "VIEW"))],
)
async def get_transfer_eway_bill_payload(
    transfer_id: str,
    distance_km: int = Query(50, ge=1, le=4000),
    trans_mode: str = Query("1"),
    strict_validation: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Generate official GST NIC E-Way Bill JSON payload for Inter-Godown Stock Transfer."""
    service = EWayBillService(db, tenant_ctx)
    return await service.generate_transfer_eway_bill_payload(
        transfer_id=transfer_id,
        trans_distance_km=distance_km,
        trans_mode=trans_mode,
        strict_validation=strict_validation
    )


@router.get(
    "/transfers/{transfer_id}/delivery-challan",
    dependencies=[Depends(require_permission("stock_ledger", "VIEW"))],
)
async def get_transfer_delivery_challan(
    transfer_id: str,
    strict_validation: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Generate statutory Delivery Challan (Rule 55 CGST Rules 2017) for Inter-Godown Stock Transfer."""
    service = EWayBillService(db, tenant_ctx)
    return await service.generate_delivery_challan(
        transfer_id=transfer_id,
        strict_validation=strict_validation
    )


@router.post(
    "/transfers/{transfer_id}/transporter",
    dependencies=[Depends(require_permission("stock_ledger", "EDIT"))],
)
@router.put(
    "/transfers/{transfer_id}/transporter",
    dependencies=[Depends(require_permission("stock_ledger", "EDIT"))],
)
async def update_transfer_transporter(
    transfer_id: str,
    transporter_name: Optional[str] = Query(None),
    vehicle_number: Optional[str] = Query(None),
    lr_number: Optional[str] = Query(None),
    e_way_bill_no: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update transporter logistics and E-Way Bill metadata on a stock transfer."""
    q = select(StockTransfer).where(
        StockTransfer.id == transfer_id,
        StockTransfer.company_id == tenant_ctx.company_id,
        StockTransfer.is_deleted == False
    )
    res = await db.execute(q)
    st = res.scalars().first()
    if not st:
        raise HTTPException(status_code=404, detail="Stock transfer not found.")
    
    if transporter_name is not None:
        st.transporter_name = transporter_name
    if vehicle_number is not None:
        st.vehicle_number = vehicle_number
    if lr_number is not None:
        st.lr_number = lr_number
    if e_way_bill_no is not None:
        st.e_way_bill_no = e_way_bill_no

    await db.commit()
    await db.refresh(st)
    return StockTransferResponse.model_validate(st)


# ─────────────────────────── Physical Stock Audit & Reconciliation ───────────────────────────

@router.get(
    "/audits",
    response_model=List[StockAuditResponse],
    dependencies=[Depends(require_permission("stock_ledger", "VIEW"))],
)
async def list_stock_audits(
    warehouse_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List physical stock audits for the company."""
    service = StockAuditService(db, tenant_ctx)
    audits = await service.list_stock_audits(warehouse_id=warehouse_id, status=status, limit=limit)
    return [StockAuditResponse.model_validate(a) for a in audits]


@router.post(
    "/audits",
    response_model=StockAuditResponse,
    status_code=201,
    dependencies=[Depends(require_permission("stock_ledger", "EDIT"))],
)
async def create_stock_audit(
    req: StockAuditCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Initiate a new physical stock audit by snapshotting active batch balances."""
    service = StockAuditService(db, tenant_ctx)
    audit = await service.create_stock_audit(
        warehouse_id=req.warehouse_id,
        audit_type=req.audit_type,
        notes=req.notes
    )
    return StockAuditResponse.model_validate(audit)


@router.get(
    "/audits/{audit_id}",
    response_model=StockAuditResponse,
    dependencies=[Depends(require_permission("stock_ledger", "VIEW"))],
)
async def get_stock_audit(
    audit_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Fetch details and item variance list for a specific stock audit."""
    service = StockAuditService(db, tenant_ctx)
    audit = await service.get_stock_audit(audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail=f"Stock audit {audit_id} not found.")
    return StockAuditResponse.model_validate(audit)


@router.post(
    "/audits/{audit_id}/count",
    response_model=StockAuditItemResponse,
    dependencies=[Depends(require_permission("stock_ledger", "EDIT"))],
)
async def record_audit_item_count(
    audit_id: str,
    req: StockAuditCountItemRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Record physical count for a specific line item in a stock audit."""
    service = StockAuditService(db, tenant_ctx)
    item = await service.record_item_count(
        audit_id=audit_id,
        item_id=req.item_id,
        counted_qty=float(req.counted_qty),
        discrepancy_reason=req.discrepancy_reason,
        notes=req.notes
    )
    return StockAuditItemResponse.model_validate(item)


@router.post(
    "/audits/{audit_id}/scan",
    dependencies=[Depends(require_permission("stock_ledger", "EDIT"))],
)
async def scan_barcode_for_audit(
    audit_id: str,
    req: StockAuditBarcodeScanRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Rapid barcode scan action to increment counted quantity during physical audit."""
    service = StockAuditService(db, tenant_ctx)
    return await service.scan_barcode_increment(
        audit_id=audit_id,
        barcode_or_sku=req.barcode_or_sku,
        qty_increment=float(req.qty_increment or 1.0),
        batch_no=req.batch_no
    )


@router.post(
    "/audits/{audit_id}/reconcile",
    response_model=StockAuditResponse,
    dependencies=[Depends(require_permission("stock_ledger", "EDIT"))],
)
async def reconcile_stock_audit(
    audit_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Reconcile stock audit, post batch adjustments and ledger movements, and mark COMPLETED."""
    service = StockAuditService(db, tenant_ctx)
    audit = await service.reconcile_and_post_discrepancies(audit_id=audit_id)
    return StockAuditResponse.model_validate(audit)


