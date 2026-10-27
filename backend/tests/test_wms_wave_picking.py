# -*- coding: utf-8 -*-
"""
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.130.0
  Created      : 2026-10-28
  Modified     : 2026-10-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
"""

import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException

from app.api.deps import TenantContext
from app.models.inventory import Warehouse, WarehouseLocation, StockMovement
from app.services.inventory_wms import InventoryWmsService
from app.schemas.wms import (
    WaveCreateRequest, WavePickLineCreate, WavePickActionRequest,
    WaveCompleteRequest, CartonPackRequest
)
from app.api.v1.wms import (
    create_pick_wave, list_pick_waves, get_pick_wave_details,
    record_wave_item_pick, complete_wave_and_dispatch,
    get_packing_station_manifest, pack_wave_carton
)


pytestmark = pytest.mark.asyncio


# =============================================================================
# Helper Fixtures & Builders
# =============================================================================

def _mock_db_with_warehouse():
    db = AsyncMock()
    wh = Warehouse(id="wh-1", code="WH-CENTRAL", name="Central Godown")

    async def mock_execute(statement, *args, **kwargs):
        res = MagicMock()
        stmt_str = str(statement).lower()
        if "from warehouses" in stmt_str or "warehouses." in stmt_str:
            res.scalars.return_value.first.return_value = wh
            res.scalars.return_value.all.return_value = [wh]
        else:
            res.scalars.return_value.first.return_value = None
            res.scalars.return_value.all.return_value = []
        return res

    db.execute = AsyncMock(side_effect=mock_execute)
    return db, wh


# =============================================================================
# 1. Serpentine Key Calculation & Path Ordering Tests
# =============================================================================

async def test_serpentine_key_calculation():
    """Verify that serpentine traversal alternates bay direction between odd and even aisles."""
    db, wh = _mock_db_with_warehouse()
    tenant_ctx = TenantContext(company_id="test-comp-1", branch_id="branch-1")
    service = InventoryWmsService(db, tenant_ctx)

    # Aisle 1 (Odd): Bay 1 has smaller key than Bay 10 (traversing 1 -> 10)
    key_a1_b1 = service._compute_serpentine_key(zone="A", aisle_val="01", bay_val="01", level_val="01")
    key_a1_b10 = service._compute_serpentine_key(zone="A", aisle_val="01", bay_val="10", level_val="01")
    assert key_a1_b1 < key_a1_b10, "Odd aisle must sort low-to-high bay"

    # Aisle 2 (Even): Bay 10 has smaller key than Bay 1 (traversing 10 -> 1)
    key_a2_b10 = service._compute_serpentine_key(zone="A", aisle_val="02", bay_val="10", level_val="01")
    key_a2_b1 = service._compute_serpentine_key(zone="A", aisle_val="02", bay_val="01", level_val="01")
    assert key_a2_b10 < key_a2_b1, "Even aisle must sort high-to-low bay (serpentine turn)"

    # Zone hierarchy: Zone A comes before Zone B
    key_zone_a = service._compute_serpentine_key(zone="A", aisle_val="01", bay_val="01", level_val="01")
    key_zone_b = service._compute_serpentine_key(zone="B", aisle_val="01", bay_val="01", level_val="01")
    assert key_zone_a < key_zone_b, "Zone A must precede Zone B"


async def test_wave_create_serpentine_ordering():
    """Verify that create_pick_wave sorts tasks into a continuous single-pass serpentine sequence."""
    db, wh = _mock_db_with_warehouse()
    tenant_ctx = TenantContext(company_id="test-comp-1", branch_id="branch-1")
    service = InventoryWmsService(db, tenant_ctx)

    # Provide order lines across different aisles
    lines = [
        {"item_id": "i-1", "item_code": "SKU-01", "product_name": "P1", "requested_qty": 5, "preferred_bin": "BIN-A02-R01"},
        {"item_id": "i-2", "item_code": "SKU-02", "product_name": "P2", "requested_qty": 10, "preferred_bin": "BIN-A01-R01"},
        {"item_id": "i-3", "item_code": "SKU-03", "product_name": "P3", "requested_qty": 2, "preferred_bin": "BIN-A01-R08"},
    ]

    wave = await service.create_pick_wave(
        warehouse_id="wh-1",
        order_lines=lines,
        staging_bay="BAY-04",
    )

    assert wave["warehouse_id"] == "wh-1"
    assert wave["staging_bay"] == "BAY-04"
    assert wave["total_tasks"] == 3
    assert wave["status"] == "OPEN"

    # Tasks must be sorted ascending by sort_key
    sort_keys = [t["sort_key"] for t in wave["tasks"]]
    assert sort_keys == sorted(sort_keys), "Tasks in wave must be ordered strictly by serpentine sort key"


# =============================================================================
# 2. Picker Workload Assignment Tests
# =============================================================================

async def test_wave_picker_round_robin_assignment():
    """Verify that tasks are distributed evenly across assigned warehouse floor pickers."""
    db, wh = _mock_db_with_warehouse()
    tenant_ctx = TenantContext(company_id="test-comp-1", branch_id="branch-1")
    service = InventoryWmsService(db, tenant_ctx)

    lines = [
        {"item_id": f"i-{i}", "item_code": f"SKU-{i}", "product_name": f"Product {i}", "requested_qty": 2}
        for i in range(6)
    ]

    pickers = ["PICKER-ALICE", "PICKER-BOB"]
    wave = await service.create_pick_wave(
        warehouse_id="wh-1",
        order_lines=lines,
        pickers=pickers,
    )

    assigned_pickers = [t["picker_id"] for t in wave["tasks"]]
    assert "PICKER-ALICE" in assigned_pickers
    assert "PICKER-BOB" in assigned_pickers
    assert assigned_pickers.count("PICKER-ALICE") == 3
    assert assigned_pickers.count("PICKER-BOB") == 3


# =============================================================================
# 3. Wave Pick Execution & Scan Verification Tests
# =============================================================================

async def test_wave_record_pick_rfid_verification():
    """Verify scanning valid RFID tag updates task status to PICKED and recomputes wave progress."""
    db, wh = _mock_db_with_warehouse()
    tenant_ctx = TenantContext(company_id="test-comp-1", branch_id="branch-1")
    service = InventoryWmsService(db, tenant_ctx)

    lines = [
        {"item_id": "i-10", "item_code": "SKU-POLO-M", "product_name": "Polo M", "requested_qty": 10, "preferred_bin": "BIN-A01-R02"},
        {"item_id": "i-11", "item_code": "SKU-POLO-L", "product_name": "Polo L", "requested_qty": 10, "preferred_bin": "BIN-A01-R04"},
    ]

    wave = await service.create_pick_wave(warehouse_id="wh-1", order_lines=lines)
    wave_id = wave["wave_id"]
    task_1 = wave["tasks"][0]

    # Pick task 1 with matching RFID tag
    pick_res = await service.record_wave_pick(
        warehouse_id="wh-1",
        wave_id=wave_id,
        task_id=task_1["task_id"],
        picked_qty=Decimal("10.0"),
        scanned_code=task_1["bin_rfid_tag"],
    )

    assert pick_res["status"] == "PICKED"
    assert pick_res["picked_qty"] == 10.0
    assert pick_res["progress_percent"] == 50  # 10 out of 20 units picked


async def test_wave_record_pick_mismatched_scan_rejected():
    """Verify scanning an invalid barcode or RFID tag raises HTTP 400 error."""
    db, wh = _mock_db_with_warehouse()
    tenant_ctx = TenantContext(company_id="test-comp-1", branch_id="branch-1")
    service = InventoryWmsService(db, tenant_ctx)

    lines = [{"item_id": "i-10", "item_code": "SKU-POLO-M", "product_name": "Polo M", "requested_qty": 10}]
    wave = await service.create_pick_wave(warehouse_id="wh-1", order_lines=lines)
    task_id = wave["tasks"][0]["task_id"]

    with pytest.raises(HTTPException) as exc_info:
        await service.record_wave_pick(
            warehouse_id="wh-1",
            wave_id=wave["wave_id"],
            task_id=task_id,
            picked_qty=Decimal("10.0"),
            scanned_code="COMPLETELY-WRONG-TAG",
        )
    assert exc_info.value.status_code == 400
    assert "does not match expected bin or item" in str(exc_info.value.detail)


async def test_wave_record_pick_shortage_handling():
    """Verify that picking less than requested marks task as SHORTED with remaining shortage."""
    db, wh = _mock_db_with_warehouse()
    tenant_ctx = TenantContext(company_id="test-comp-1", branch_id="branch-1")
    service = InventoryWmsService(db, tenant_ctx)

    lines = [{"item_id": "i-20", "item_code": "SKU-HOODIE", "product_name": "Winter Hoodie", "requested_qty": 15}]
    wave = await service.create_pick_wave(warehouse_id="wh-1", order_lines=lines)
    task_id = wave["tasks"][0]["task_id"]

    # Pick only 10 out of 15 units due to bin shortage
    pick_res = await service.record_wave_pick(
        warehouse_id="wh-1",
        wave_id=wave["wave_id"],
        task_id=task_id,
        picked_qty=Decimal("10.0"),
        is_shortage=True,
        reason="BIN_DAMAGED",
    )

    assert pick_res["status"] == "SHORTED"
    details = await service.get_wave_details("wh-1", wave["wave_id"])
    target_task = details["tasks"][0]
    assert target_task["picked_qty"] == 10.0
    assert target_task["short_qty"] == 5.0
    assert details["shorted_tasks"] == 1


# =============================================================================
# 4. Atomic Ledger Commit & Dispatch to Staging Bay Tests
# =============================================================================

async def test_wave_complete_creates_dual_stock_movements():
    """Verify completing a wave creates linked StockMovement rows to staging bay under WMS_WAVE_PICK."""
    db, wh = _mock_db_with_warehouse()
    tenant_ctx = TenantContext(company_id="test-comp-1", branch_id="branch-1")
    service = InventoryWmsService(db, tenant_ctx)

    lines = [
        {"item_id": "i-31", "item_code": "SKU-JEANS-01", "product_name": "Jeans Slim", "requested_qty": 8, "preferred_bin": "BIN-A01-R01"},
        {"item_id": "i-32", "item_code": "SKU-JEANS-02", "product_name": "Jeans Loose", "requested_qty": 12, "preferred_bin": "BIN-A01-R03"},
    ]
    wave = await service.create_pick_wave(warehouse_id="wh-1", order_lines=lines, staging_bay="BAY-04")
    wave_id = wave["wave_id"]

    # Pick all units
    await service.record_wave_pick("wh-1", wave_id, wave["tasks"][0]["task_id"], Decimal("8.0"))
    await service.record_wave_pick("wh-1", wave_id, wave["tasks"][1]["task_id"], Decimal("12.0"))

    added_objects = []
    db.add = MagicMock(side_effect=lambda obj: added_objects.append(obj))

    complete_res = await service.complete_wave_and_dispatch(
        warehouse_id="wh-1",
        wave_id=wave_id,
        staging_bay="BAY-04",
        packing_station_id="PACKING-STATION-01",
    )

    assert complete_res["status"] == "COMPLETED"
    assert complete_res["staging_bay"] == "BAY-04"
    assert complete_res["total_units_transferred"] == 20.0
    assert complete_res["transfers_count"] == 2

    # Verify 4 StockMovements added (2 OUT from bins + 2 IN to BAY-04)
    assert len(added_objects) == 4
    for sm in added_objects:
        assert isinstance(sm, StockMovement)
        assert sm.reference_doc_type == "WMS_WAVE_PICK"
        assert sm.reference_doc_id == wave_id

    out_movements = [sm for sm in added_objects if sm.movement_type == "TRANSFER_OUT"]
    in_movements = [sm for sm in added_objects if sm.movement_type == "TRANSFER_IN"]
    assert len(out_movements) == 2
    assert len(in_movements) == 2

    # Check quantities
    assert sum(abs(sm.quantity) for sm in out_movements) == Decimal("20.0")
    assert sum(sm.quantity for sm in in_movements) == Decimal("20.0")
    assert all(sm.bin == "BAY-04" for sm in in_movements)


# =============================================================================
# 5. Packing Station Manifest & Carton Packing Tests
# =============================================================================

async def test_packing_station_manifest_and_pack():
    """Verify inspecting staged wave inventory at a staging bay and packing into a carton."""
    db, wh = _mock_db_with_warehouse()
    tenant_ctx = TenantContext(company_id="test-comp-1", branch_id="branch-1")
    service = InventoryWmsService(db, tenant_ctx)

    # Query staging bay
    manifest = await service.get_packing_station_manifest(
        warehouse_id="wh-1",
        staging_bay="BAY-04",
    )
    assert manifest["warehouse_id"] == "wh-1"
    assert manifest["staging_bay"] == "BAY-04"
    assert "items" in manifest

    # Pack carton
    pack_res = await service.pack_wave_carton(
        warehouse_id="wh-1",
        wave_id="WAVE-TEST-001",
        carton_no="CTN-20261028-001",
        items=[{"item_id": "i-31", "quantity": 8.0}],
        gross_weight_kg=Decimal("4.50"),
    )
    assert pack_res["carton_no"] == "CTN-20261028-001"
    assert pack_res["total_packed_units"] == 8.0
    assert pack_res["gross_weight_kg"] == 4.5
    assert pack_res["status"] == "SEALED"


# =============================================================================
# 6. FastAPI Router Endpoints Integration Test
# =============================================================================

async def test_wave_api_router_endpoints():
    """Verify all 7 FastAPI endpoints in api/v1/wms.py execute correctly."""
    db, wh = _mock_db_with_warehouse()
    tenant_ctx = TenantContext(company_id="test-comp-1", branch_id="branch-1")

    # 1. POST /warehouses/{id}/waves
    create_req = WaveCreateRequest(
        wave_name="Morning B2B Dispatch",
        order_lines=[WavePickLineCreate(item_id="i-1", item_code="SKU-A", product_name="Item A", requested_qty=Decimal("10.0"))],
        staging_bay="BAY-04",
    )
    wave_resp = await create_pick_wave("wh-1", create_req, db, tenant_ctx)
    assert wave_resp.warehouse_id == "wh-1"
    wave_id = wave_resp.wave_id
    task_id = wave_resp.tasks[0].task_id

    # 2. GET /warehouses/{id}/waves
    waves_list = await list_pick_waves("wh-1", None, db, tenant_ctx)
    assert waves_list.total_waves >= 1

    # 3. GET /warehouses/{id}/waves/{wave_id}
    details = await get_pick_wave_details("wh-1", wave_id, db, tenant_ctx)
    assert details.wave_id == wave_id

    # 4. POST /warehouses/{id}/waves/{wave_id}/pick
    pick_req = WavePickActionRequest(task_id=task_id, picked_qty=Decimal("10.0"))
    pick_res = await record_wave_item_pick("wh-1", wave_id, pick_req, db, tenant_ctx)
    assert pick_res.status == "PICKED"

    # 5. POST /warehouses/{id}/waves/{wave_id}/complete
    complete_req = WaveCompleteRequest(staging_bay="BAY-04")
    comp_res = await complete_wave_and_dispatch("wh-1", wave_id, complete_req, db, tenant_ctx)
    assert comp_res.status == "COMPLETED"

    # 6. GET /warehouses/{id}/packing-station
    pack_manifest = await get_packing_station_manifest("wh-1", "BAY-04", db, tenant_ctx)
    assert pack_manifest.staging_bay == "BAY-04"

    # 7. POST /warehouses/{id}/packing-station/pack
    carton_req = CartonPackRequest(
        wave_id=wave_id,
        carton_no="CTN-TEST-100",
        items=[{"item_id": "i-1", "quantity": 10.0}],
        gross_weight_kg=Decimal("3.20"),
    )
    carton_res = await pack_wave_carton("wh-1", carton_req, db, tenant_ctx)
    assert carton_res.carton_no == "CTN-TEST-100"
    assert carton_res.status == "SEALED"
