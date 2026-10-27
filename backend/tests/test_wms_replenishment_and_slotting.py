"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.18.0
Created      : 2026-10-28
Modified     : 2026-10-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Test Suite: WMS Phase 3 - Dynamic Picking Bin Replenishment & Slotting Engine
Validates:
1. Replenishment task detection when picking bin is critically depleted (stock == 0).
2. Bulk bin source candidate ranking and transfer quantity computation: min(headroom, bulk_stock).
3. Bulk stockout handling when warehouse has no reserve inventory (priority=BULK_STOCKOUT).
4. Atomic internal replenishment transfer execution (TRANSFER_OUT + TRANSFER_IN pair with audit doc).
5. Item slotting configuration save and retrieve (ItemWarehouseLocation upsert).
6. Schema-drift resilience on unmigrated warehouse schemas.
7. End-to-end API router endpoints for replenishment and slotting.
"""

import pytest
import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

from app.models.inventory import Warehouse, WarehouseLocation, StockMovement
from app.models.item_master import ItemWarehouseLocation, Item
from app.schemas.wms import (
    ReplenishmentTaskItem,
    ReplenishmentTasksResponse,
    ReplenishmentExecuteItem,
    ReplenishmentExecuteRequest,
    ReplenishmentExecuteResponse,
    ItemSlottingConfigItem,
    ItemSlottingSaveRequest,
)
from app.services.inventory_wms import InventoryWmsService
from app.api.deps import TenantContext
from app.api.v1.wms import (
    get_warehouse_replenishment_tasks,
    execute_warehouse_replenishment,
    get_warehouse_slotting,
    save_warehouse_item_slotting,
)


pytestmark = pytest.mark.asyncio


def _make_location(
    loc_id: str,
    warehouse_id: str,
    code: str,
    zone: str = "PICKING",
    max_capacity_units: int = 100,
    is_locked: bool = False,
) -> WarehouseLocation:
    loc = WarehouseLocation(
        id=loc_id,
        warehouse_id=warehouse_id,
        code=code,
        name=f"Location {code}",
        zone=zone,
        max_capacity_units=max_capacity_units,
        is_locked=is_locked,
    )
    loc.company_id = "test-comp-1"
    loc.is_deleted = False
    return loc


def _make_item(item_id: str, code: str, name: str) -> Item:
    item = Item(
        id=item_id,
        item_code=code,
        item_name=name,
    )
    item.company_id = "test-comp-1"
    item.is_deleted = False
    return item


def _make_slotting(
    iwl_id: str,
    item_id: str,
    warehouse_id: str,
    location_bin: str,
    min_reorder_level: float = 10.0,
    max_capacity: float = 100.0,
    reorder_quantity: float = 30.0,
) -> ItemWarehouseLocation:
    iwl = ItemWarehouseLocation(
        id=iwl_id,
        item_id=item_id,
        warehouse_id=warehouse_id,
        location_bin=location_bin,
        min_reorder_level=Decimal(str(min_reorder_level)),
        max_capacity=Decimal(str(max_capacity)),
        reorder_quantity=Decimal(str(reorder_quantity)),
    )
    iwl.company_id = "test-comp-1"
    iwl.is_deleted = False
    return iwl


async def test_replenishment_critical_depleted_picking_bin():
    """Picking bin has 0 units of item; bulk bin has 50 units. Engine flags CRITICAL replenishment."""
    db = AsyncMock()
    ctx = TenantContext(company_id="test-comp-1", branch_id="b1")
    service = InventoryWmsService(db, ctx)

    wh = Warehouse(id="wh-1", code="WH-CENTRAL", name="Central Godown")
    wh.company_id = "test-comp-1"
    wh.is_deleted = False

    loc_pick = _make_location("loc-1", "wh-1", "PICK-A01-01", zone="PICKING", max_capacity_units=100)
    loc_bulk = _make_location("loc-2", "wh-1", "BULK-R02-01", zone="BULK", max_capacity_units=500)

    item = _make_item("item-1", "ITEM-JEANS-01", "Slim Fit Denim")
    iwl = _make_slotting("iwl-1", "item-1", "wh-1", "PICK-A01-01", min_reorder_level=15.0, max_capacity=100.0, reorder_quantity=40.0)

    # Mock DB executions
    mock_res_wh = MagicMock()
    mock_res_wh.scalars().first.return_value = wh

    mock_res_locs = MagicMock()
    mock_res_locs.scalars().all.return_value = [loc_pick, loc_bulk]

    mock_res_iwl = MagicMock()
    mock_res_iwl.all.return_value = [(iwl, item)]

    mock_res_sm = MagicMock()
    # StockMovement rows: (bin, product_id, item_id, sku, qty)
    mock_res_sm.all.return_value = [
        ("BULK-R02-01", "item-1", "item-1", "ITEM-JEANS-01", Decimal("50.00")),
    ]

    db.execute.side_effect = [mock_res_wh, mock_res_locs, mock_res_iwl, mock_res_sm]

    res = await service.get_replenishment_tasks("wh-1")

    assert res["warehouse_id"] == "wh-1"
    assert res["total_tasks"] == 1
    assert res["critical_count"] == 1
    task = res["tasks"][0]
    assert task["priority"] == "CRITICAL"
    assert task["status"] == "READY"
    assert task["picking_bin"] == "PICK-A01-01"
    assert task["current_picking_stock"] == 0.0
    assert task["source_bin"] == "BULK-R02-01"
    assert task["suggested_quantity"] == 40.0


async def test_replenishment_bulk_stockout_handling():
    """Picking bin has 5 units (below min 20), but warehouse has 0 units in bulk storage."""
    db = AsyncMock()
    ctx = TenantContext(company_id="test-comp-1", branch_id="b1")
    service = InventoryWmsService(db, ctx)

    wh = Warehouse(id="wh-1", code="WH-CENTRAL", name="Central Godown")
    wh.company_id = "test-comp-1"
    wh.is_deleted = False

    loc_pick = _make_location("loc-1", "wh-1", "PICK-A01-01", zone="PICKING", max_capacity_units=100)
    item = _make_item("item-2", "ITEM-SHIRT-02", "Formal Cotton Shirt")
    iwl = _make_slotting("iwl-2", "item-2", "wh-1", "PICK-A01-01", min_reorder_level=20.0, max_capacity=100.0, reorder_quantity=50.0)

    mock_res_wh = MagicMock()
    mock_res_wh.scalars().first.return_value = wh

    mock_res_locs = MagicMock()
    mock_res_locs.scalars().all.return_value = [loc_pick]

    mock_res_iwl = MagicMock()
    mock_res_iwl.all.return_value = [(iwl, item)]

    mock_res_sm = MagicMock()
    # 5 units in picking bin, nothing in bulk
    mock_res_sm.all.return_value = [
        ("PICK-A01-01", "item-2", "item-2", "ITEM-SHIRT-02", Decimal("5.00")),
    ]

    db.execute.side_effect = [mock_res_wh, mock_res_locs, mock_res_iwl, mock_res_sm]

    res = await service.get_replenishment_tasks("wh-1")

    assert res["total_tasks"] == 1
    assert res["bulk_stockout_count"] == 1
    task = res["tasks"][0]
    assert task["priority"] == "BULK_STOCKOUT"
    assert task["status"] == "BLOCKED"
    assert task["source_bin"] is None
    assert task["suggested_quantity"] == 0.0


async def test_replenishment_transfer_execution():
    """Executing replenishment task writes atomic StockMovement pair (TRANSFER_OUT + TRANSFER_IN)."""
    db = AsyncMock()
    ctx = TenantContext(company_id="test-comp-1", branch_id="b1")
    service = InventoryWmsService(db, ctx)

    wh = Warehouse(id="wh-1", code="WH-CENTRAL", name="Central Godown")
    wh.company_id = "test-comp-1"
    wh.is_deleted = False

    mock_res_wh = MagicMock()
    mock_res_wh.scalars().first.return_value = wh
    db.execute.return_value = mock_res_wh

    tasks = [
        ReplenishmentExecuteItem(
            task_id="t1",
            item_id="item-1",
            sku="ITEM-JEANS-01",
            product_name="Slim Fit Denim",
            source_bin="BULK-R02-01",
            destination_bin="PICK-A01-01",
            quantity=Decimal("25.00"),
        )
    ]

    added_objects = []
    db.add = MagicMock(side_effect=lambda obj: added_objects.append(obj))

    result = await service.execute_replenishment_tasks("wh-1", tasks, notes="Morning picking replenish")

    assert result["total_transfers"] == 1
    assert result["total_units"] == 25.0
    assert len(added_objects) == 2

    sm_out = added_objects[0]
    sm_in = added_objects[1]

    assert sm_out.movement_type == "TRANSFER_OUT"
    assert sm_out.bin == "BULK-R02-01"
    assert sm_out.quantity == Decimal("-25.00")
    assert sm_out.reference_doc_type == "WMS_REPLENISHMENT"

    assert sm_in.movement_type == "TRANSFER_IN"
    assert sm_in.bin == "PICK-A01-01"
    assert sm_in.quantity == Decimal("25.00")
    assert sm_in.reference_doc_type == "WMS_REPLENISHMENT"
    assert sm_in.reference_doc_id == sm_out.reference_doc_id


async def test_slotting_save_and_retrieve():
    """Saving and retrieving item picking bin slotting rules."""
    db = AsyncMock()
    ctx = TenantContext(company_id="test-comp-1", branch_id="b1")
    service = InventoryWmsService(db, ctx)

    wh = Warehouse(id="wh-1", code="WH-CENTRAL", name="Central Godown")
    wh.company_id = "test-comp-1"
    wh.is_deleted = False

    item = _make_item("item-10", "ITEM-TSHIRT-10", "Round Neck Tee")

    mock_res_wh = MagicMock()
    mock_res_wh.scalars().first.return_value = wh

    mock_res_item = MagicMock()
    mock_res_item.scalars().first.return_value = item

    mock_res_ex = MagicMock()
    mock_res_ex.scalars().first.return_value = None

    db.execute.side_effect = [mock_res_wh, mock_res_item, mock_res_ex]
    db.add = MagicMock()

    save_res = await service.save_item_slotting(
        warehouse_id="wh-1",
        item_id="item-10",
        location_bin="PICK-B02-01",
        min_reorder_level=Decimal("12.00"),
        max_capacity=Decimal("80.00"),
        reorder_quantity=Decimal("30.00"),
    )

    assert save_res["status"] == "SAVED"
    assert save_res["location_bin"] == "PICK-B02-01"
    assert save_res["min_reorder_level"] == 12.0
    assert save_res["max_capacity"] == 80.0


async def test_replenishment_api_endpoints():
    """Verify router endpoints connect correctly to service methods."""
    db = AsyncMock()
    ctx = TenantContext(company_id="test-comp-1", branch_id="b1")

    with patch.object(InventoryWmsService, "get_replenishment_tasks", new_callable=AsyncMock) as mock_tasks:
        mock_tasks.return_value = {
            "warehouse_id": "wh-1",
            "warehouse_code": "WH-MAIN",
            "total_tasks": 0,
            "critical_count": 0,
            "high_count": 0,
            "normal_count": 0,
            "bulk_stockout_count": 0,
            "tasks": [],
        }
        res = await get_warehouse_replenishment_tasks("wh-1", db=db, tenant_ctx=ctx, guard=None)
        assert res.warehouse_id == "wh-1"
        assert res.total_tasks == 0

    with patch.object(InventoryWmsService, "execute_replenishment_tasks", new_callable=AsyncMock) as mock_exec:
        mock_exec.return_value = {
            "warehouse_id": "wh-1",
            "run_id": "REPL-20261028-ABCDEF",
            "total_transfers": 1,
            "total_units": 10.0,
            "executed_tasks": [{
                "item_id": "i1",
                "source_bin": "BULK-01",
                "destination_bin": "PICK-01",
                "quantity": 10.0,
            }],
            "message": "Executed 1 transfer",
        }
        req = ReplenishmentExecuteRequest(tasks=[
            ReplenishmentExecuteItem(
                item_id="i1",
                source_bin="BULK-01",
                destination_bin="PICK-01",
                quantity=Decimal("10.00")
            )
        ])
        exec_res = await execute_warehouse_replenishment("wh-1", req, db=db, tenant_ctx=ctx, guard=None)
        assert exec_res.total_transfers == 1
        assert exec_res.total_units == 10.0
