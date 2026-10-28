# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Designation  : Chief Systems Architect & Creator
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 3.132.0
# Created      : 2026-10-28
# Modified     : 2026-10-28
# Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal

import pytest
from unittest.mock import AsyncMock, MagicMock
from decimal import Decimal
from fastapi import HTTPException

from backend.app.services.inventory_wms import InventoryWmsService
from backend.app.schemas.wms import (
    CartonDockStageRequest,
    DispatchManifestCreate,
    GateScanItemRequest,
    ManifestDispatchConfirmRequest,
)
from backend.app.api.deps import TenantContext
from backend.app.models.inventory import StockMovement, Warehouse, WarehouseLocation
from backend.app.api.v1.wms import (
    list_warehouse_dock_doors,
    stage_cartons_at_dock as api_stage_cartons_at_dock,
    create_dispatch_manifest as api_create_dispatch_manifest,
    list_dispatch_manifests as api_list_dispatch_manifests,
    get_dispatch_manifest_details as api_get_dispatch_manifest_details,
    scan_carton_at_gate as api_scan_carton_at_gate,
    confirm_manifest_dispatch as api_confirm_manifest_dispatch,
)


@pytest.fixture
def mock_tenant():
    return TenantContext(
        company_id="comp-test-01",
        branch_id="br-test-01",
    )


def _mock_db_with_warehouse():
    db = AsyncMock()
    wh = Warehouse(
        id="wh-test-01",
        code="WH-MUM-001",
        name="Mumbai Central Distribution Center",
        company_id="comp-test-01",
        branch_id="br-test-01",
        is_active=True,
    )

    mock_execute = AsyncMock()
    # Mock location query
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = []
    mock_scalars.first.return_value = wh
    mock_execute.scalars.return_value = mock_scalars
    mock_execute.scalar_one_or_none.return_value = wh

    db.execute = AsyncMock(return_value=mock_execute)
    db.scalar = AsyncMock(return_value=wh)
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    return db


@pytest.mark.asyncio
async def test_dock_doors_listing_default_and_custom(mock_tenant):
    """Test 1: Retrieves shipping dock doors with fallback defaults when none configured."""
    db = _mock_db_with_warehouse()
    service = InventoryWmsService(db, mock_tenant)

    docks = await service.get_dock_doors(warehouse_id="wh-test-01")
    assert len(docks) >= 4
    assert docks[0]["code"] == "DOCK-01"
    assert docks[0]["status"] in ("AVAILABLE", "LOADING", "OCCUPIED")


@pytest.mark.asyncio
async def test_carton_staging_at_dock(mock_tenant):
    """Test 2: Stages packed cartons at a specific dock door."""
    db = _mock_db_with_warehouse()
    service = InventoryWmsService(db, mock_tenant)

    res = await service.stage_cartons_at_dock(
        warehouse_id="wh-test-01",
        dock_door_code="DOCK-02",
        carton_barcodes=["BOX-20261028-001", "BOX-20261028-002"],
    )
    assert res["dock_door_code"] == "DOCK-02"
    assert res["staged_cartons_count"] >= 2


@pytest.mark.asyncio
async def test_create_dispatch_manifest(mock_tenant):
    """Test 3: Creates a carrier dispatch manifest assembling sealed cartons."""
    db = _mock_db_with_warehouse()
    service = InventoryWmsService(db, mock_tenant)

    manifest = await service.create_dispatch_manifest(
        warehouse_id="wh-test-01",
        dock_door_code="DOCK-01",
        carton_barcodes=["BOX-001", "BOX-002", "BOX-003"],
        transporter_name="Blue Dart Express",
        vehicle_no="MH-04-AB-1234",
        driver_name="Ramesh Kumar",
        driver_phone="+919876543210",
        destination="Pune Regional Hub",
    )

    assert manifest["manifest_id"].startswith("man-")
    assert manifest["transporter_name"] == "Blue Dart Express"
    assert manifest["vehicle_no"] == "MH-04-AB-1234"
    assert manifest["total_cartons"] == 3
    assert manifest["scanned_cartons"] == 0
    assert manifest["is_fully_scanned"] is False
    assert manifest["status"] == "STAGED"


@pytest.mark.asyncio
async def test_manifest_gate_scan_success(mock_tenant):
    """Test 4: Scans carton at dock gate and tracks progress."""
    db = _mock_db_with_warehouse()
    service = InventoryWmsService(db, mock_tenant)

    manifest = await service.create_dispatch_manifest(
        warehouse_id="wh-test-01",
        dock_door_code="DOCK-01",
        carton_barcodes=["BOX-A", "BOX-B"],
        transporter_name="Safechem Logistics",
        vehicle_no="DL-01-XY-5678",
    )

    scan_res = await service.scan_carton_at_gate(
        warehouse_id="wh-test-01",
        manifest_id=manifest["manifest_id"],
        carton_barcode="BOX-A",
    )

    assert scan_res["carton_barcode"] == "BOX-A"
    assert scan_res["scanned_cartons"] == 1
    assert scan_res["total_cartons"] == 2
    assert scan_res["is_fully_scanned"] is False
    assert scan_res["status"] == "LOADING"


@pytest.mark.asyncio
async def test_manifest_gate_scan_unauthorized_carton_rejected(mock_tenant):
    """Test 5: Scanning an unauthorized carton not in manifest raises HTTP 400."""
    db = _mock_db_with_warehouse()
    service = InventoryWmsService(db, mock_tenant)

    manifest = await service.create_dispatch_manifest(
        warehouse_id="wh-test-01",
        dock_door_code="DOCK-01",
        carton_barcodes=["BOX-A", "BOX-B"],
        transporter_name="VRL Logistics",
        vehicle_no="KA-01-EE-9999",
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.scan_carton_at_gate(
            warehouse_id="wh-test-01",
            manifest_id=manifest["manifest_id"],
            carton_barcode="BOX-UNAUTHORIZED-999",
        )
    assert exc_info.value.status_code == 400
    assert "is not part of Manifest" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_manifest_gate_scan_completes_and_sets_gate_verified(mock_tenant):
    """Test 6: 100% carton scan sets status to GATE_VERIFIED."""
    db = _mock_db_with_warehouse()
    service = InventoryWmsService(db, mock_tenant)

    manifest = await service.create_dispatch_manifest(
        warehouse_id="wh-test-01",
        dock_door_code="DOCK-01",
        carton_barcodes=["BOX-X1", "BOX-X2"],
        transporter_name="Gati KWE",
        vehicle_no="MH-12-QQ-4321",
    )

    await service.scan_carton_at_gate("wh-test-01", manifest["manifest_id"], "BOX-X1")
    scan_res = await service.scan_carton_at_gate("wh-test-01", manifest["manifest_id"], "BOX-X2")

    assert scan_res["scanned_cartons"] == 2
    assert scan_res["is_fully_scanned"] is True
    assert scan_res["status"] == "GATE_VERIFIED"


@pytest.mark.asyncio
async def test_dispatch_blocked_when_unscanned(mock_tenant):
    """Test 7: Attempting to dispatch an incomplete manifest without override raises HTTP 400."""
    db = _mock_db_with_warehouse()
    service = InventoryWmsService(db, mock_tenant)

    manifest = await service.create_dispatch_manifest(
        warehouse_id="wh-test-01",
        dock_door_code="DOCK-01",
        carton_barcodes=["BOX-P1", "BOX-P2"],
        transporter_name="TCI Express",
        vehicle_no="GJ-01-CC-1111",
    )

    # Only scan 1 out of 2
    await service.scan_carton_at_gate("wh-test-01", manifest["manifest_id"], "BOX-P1")

    with pytest.raises(HTTPException) as exc_info:
        await service.confirm_manifest_dispatch(
            warehouse_id="wh-test-01",
            manifest_id=manifest["manifest_id"],
            supervisor_override=False,
        )
    assert exc_info.value.status_code == 400
    assert "Gate departure blocked" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_dispatch_confirm_posts_stock_movements_and_gate_pass(mock_tenant):
    """Test 8: 100% verified manifest confirms dispatch, posts DISPATCH_OUT movements, and issues Gate Pass."""
    db = _mock_db_with_warehouse()
    service = InventoryWmsService(db, mock_tenant)

    manifest = await service.create_dispatch_manifest(
        warehouse_id="wh-test-01",
        dock_door_code="DOCK-03",
        carton_barcodes=["BOX-FULL-1", "BOX-FULL-2"],
        transporter_name="DTDC Courier",
        vehicle_no="MH-02-ZZ-8888",
    )

    # Scan both
    await service.scan_carton_at_gate("wh-test-01", manifest["manifest_id"], "BOX-FULL-1")
    await service.scan_carton_at_gate("wh-test-01", manifest["manifest_id"], "BOX-FULL-2")

    disp_res = await service.confirm_manifest_dispatch(
        warehouse_id="wh-test-01",
        manifest_id=manifest["manifest_id"],
    )

    assert disp_res["status"] == "DISPATCHED"
    assert disp_res["gate_pass_no"].startswith("GP-")
    assert disp_res["dispatched_cartons_count"] == 2
    assert db.add.called

    # Validate StockMovement
    created_movements = [call.args[0] for call in db.add.call_args_list if isinstance(call.args[0], StockMovement)]
    assert len(created_movements) >= 2
    for sm in created_movements:
        assert sm.movement_type == "DISPATCH_OUT"
        assert sm.reference_doc_type == "WMS_DISPATCH"
        assert sm.bin == "DOCK-03"
        assert sm.quantity < 0


@pytest.mark.asyncio
async def test_dispatch_supervisor_override_partial_load(mock_tenant):
    """Test 9: Supervisor override allows partial truck departure with audit note."""
    db = _mock_db_with_warehouse()
    service = InventoryWmsService(db, mock_tenant)

    manifest = await service.create_dispatch_manifest(
        warehouse_id="wh-test-01",
        dock_door_code="DOCK-02",
        carton_barcodes=["BOX-PARTIAL-1", "BOX-PARTIAL-2", "BOX-PARTIAL-3"],
        transporter_name="Internal Fleet",
        vehicle_no="MH-43-TRUCK-01",
    )

    # Scan only 2 out of 3
    await service.scan_carton_at_gate("wh-test-01", manifest["manifest_id"], "BOX-PARTIAL-1")
    await service.scan_carton_at_gate("wh-test-01", manifest["manifest_id"], "BOX-PARTIAL-2")

    disp_res = await service.confirm_manifest_dispatch(
        warehouse_id="wh-test-01",
        manifest_id=manifest["manifest_id"],
        supervisor_override=True,
        override_reason="Box 3 missing at dock; vehicle must depart per tight SLA schedule",
    )

    assert disp_res["status"] == "DISPATCHED"
    assert disp_res["dispatched_cartons_count"] == 2


@pytest.mark.asyncio
async def test_dispatch_api_router_endpoints(mock_tenant):
    """Test 10: Full FastAPI router endpoints for dock doors, staging, manifest, gate scan, and dispatch."""
    db = _mock_db_with_warehouse()

    # 1. List Docks
    docks = await list_warehouse_dock_doors("wh-test-01", db, mock_tenant)
    assert len(docks) >= 1

    # 2. Stage Cartons
    stage_req = CartonDockStageRequest(
        dock_door_code="DOCK-01",
        carton_barcodes=["API-BOX-01", "API-BOX-02"],
    )
    stage_res = await api_stage_cartons_at_dock("wh-test-01", stage_req, db, mock_tenant)
    assert stage_res.dock_door_code == "DOCK-01"

    # 3. Create Manifest
    man_req = DispatchManifestCreate(
        warehouse_id="wh-test-01",
        dock_door_code="DOCK-01",
        carton_barcodes=["API-BOX-01", "API-BOX-02"],
        transporter_name="API Transport",
        vehicle_no="MH-01-API-99",
    )
    man_res = await api_create_dispatch_manifest("wh-test-01", man_req, db, mock_tenant)
    assert man_res.status == "STAGED"
    manifest_id = man_res.manifest_id

    # 4. List Manifests
    man_list = await api_list_dispatch_manifests("wh-test-01", None, db, mock_tenant)
    assert man_list.total_manifests >= 1

    # 5. Manifest Details
    details = await api_get_dispatch_manifest_details("wh-test-01", manifest_id, db, mock_tenant)
    assert details.manifest_id == manifest_id

    # 6. Gate Scan
    scan_req = GateScanItemRequest(carton_barcode="API-BOX-01")
    scan_res = await api_scan_carton_at_gate("wh-test-01", manifest_id, scan_req, db, mock_tenant)
    assert scan_res.carton_barcode == "API-BOX-01"

    scan_req2 = GateScanItemRequest(carton_barcode="API-BOX-02")
    scan_res2 = await api_scan_carton_at_gate("wh-test-01", manifest_id, scan_req2, db, mock_tenant)
    assert scan_res2.is_fully_scanned is True

    # 7. Confirm Dispatch
    disp_req = ManifestDispatchConfirmRequest()
    disp_res = await api_confirm_manifest_dispatch("wh-test-01", manifest_id, disp_req, db, mock_tenant)
    assert disp_res.status == "DISPATCHED"
    assert disp_res.gate_pass_no.startswith("GP-")
