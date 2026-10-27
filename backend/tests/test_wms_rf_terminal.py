"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.19.0
Created      : 2026-10-28
Modified     : 2026-10-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Test Suite: WMS Phase 4 - RF Gun Handheld Barcode Terminal & Mobile Relocation
Validates:
1. RF barcode verification auto-disambiguation (Location vs Item/Product).
2. Unknown barcode graceful failure response.
3. Real-time bin occupancy summary and headroom computation from StockMovement ledger.
4. Quick stock relocation (TRANSFER_OUT + TRANSFER_IN with WMS_RF_TRANSFER).
5. Quick stock relocation negative guards (insufficient stock, locked bin).
6. Multi-scan directed replenishment confirmation (3-scan proof with WMS_REPLENISHMENT).
7. FastAPI router endpoints for all 4 RF services.
"""

import pytest
import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

from app.models.inventory import Warehouse, WarehouseLocation, StockMovement, Product
from app.models.item_master import ItemWarehouseLocation, Item
from app.schemas.wms import (
    RfBarcodeVerifyRequest,
    RfBarcodeVerifyResponse,
    RfBinSummaryResponse,
    RfQuickTransferRequest,
    RfQuickTransferResponse,
    RfReplenishConfirmRequest,
    RfReplenishConfirmResponse,
)
from app.services.inventory_wms import InventoryWmsService
from app.api.deps import TenantContext
from app.api.v1.wms import (
    verify_rf_barcode,
    get_rf_bin_summary,
    execute_rf_quick_transfer,
    confirm_rf_replenishment,
)


pytestmark = pytest.mark.asyncio


def _make_location(
    loc_id: str,
    warehouse_id: str,
    code: str,
    zone: str = "PICKING",
    barcode: str = None,
    max_capacity_units: int = 100,
    is_locked: bool = False,
) -> WarehouseLocation:
    loc = WarehouseLocation(
        id=loc_id,
        warehouse_id=warehouse_id,
        code=code,
        name=f"Location {code}",
        zone=zone,
        barcode=barcode or f"LOC-{code}",
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


# =============================================================================
# 1. Barcode Verification Tests
# =============================================================================

async def test_rf_barcode_verify_location():
    """Verify that scanning a location code or barcode resolves to entity_type='LOCATION'."""
    db = AsyncMock()
    tenant_ctx = TenantContext(company_id="test-comp-1", branch_id="branch-1")
    service = InventoryWmsService(db, tenant_ctx)

    loc = _make_location("loc-1", "wh-1", "A-01-R01-S01-B01", zone="STORAGE", barcode="BC-A01-R01")

    # Mock location query result
    mock_res = MagicMock()
    mock_res.scalars.return_value.first.return_value = loc
    db.execute.return_value = mock_res

    res = await service.verify_rf_barcode(
        warehouse_id="wh-1",
        barcode="BC-A01-R01",
    )

    assert res["matched"] is True
    assert res["entity_type"] == "LOCATION"
    assert res["location"]["code"] == "A-01-R01-S01-B01"
    assert res["location"]["zone"] == "STORAGE"
    assert res["location"]["barcode"] == "BC-A01-R01"
    assert res["location"]["is_locked"] is False


async def test_rf_barcode_verify_item():
    """Verify that scanning an item barcode or SKU resolves to entity_type='ITEM'."""
    db = AsyncMock()
    tenant_ctx = TenantContext(company_id="test-comp-1", branch_id="branch-1")
    service = InventoryWmsService(db, tenant_ctx)

    item = _make_item("item-101", "SKU-DENIM-01", "Classic Slim Fit Denim")

    # 1. Location query -> None
    # 2. Item by code -> None (clean_code is barcode)
    # 3. Item by ItemBarcode join -> item
    # 4. ItemWarehouseLocation slotting -> "PICK-01"
    mock_empty = MagicMock()
    mock_empty.scalars.return_value.first.return_value = None

    mock_item = MagicMock()
    mock_item.scalars.return_value.first.return_value = item

    mock_slot = MagicMock()
    mock_slot.scalars.return_value.first.return_value = "PICK-01"

    db.execute.side_effect = [mock_empty, mock_empty, mock_item, mock_slot]
    db.scalar.return_value = Decimal("45.0")  # total_stock

    res = await service.verify_rf_barcode(
        warehouse_id="wh-1",
        barcode="8901234567890",
    )

    assert res["matched"] is True
    assert res["entity_type"] == "ITEM"
    assert res["item"]["item_code"] == "SKU-DENIM-01"
    assert res["item"]["item_name"] == "Classic Slim Fit Denim"
    assert res["item"]["current_bin"] == "PICK-01"
    assert res["item"]["total_stock"] == 45.0


async def test_rf_barcode_verify_unknown():
    """Verify that an unrecognized barcode returns matched=False and UNKNOWN."""
    db = AsyncMock()
    tenant_ctx = TenantContext(company_id="test-comp-1", branch_id="branch-1")
    service = InventoryWmsService(db, tenant_ctx)

    mock_empty = MagicMock()
    mock_empty.scalars.return_value.first.return_value = None
    db.execute.return_value = mock_empty

    res = await service.verify_rf_barcode(
        warehouse_id="wh-1",
        barcode="NONEXISTENT-99999",
    )

    assert res["matched"] is False
    assert res["entity_type"] == "UNKNOWN"
    assert "could not be resolved" in res["message"]


# =============================================================================
# 2. Bin Summary & Headroom Query Tests
# =============================================================================

async def test_rf_bin_summary_occupancy_and_headroom():
    """Verify that get_rf_bin_summary computes occupied units and headroom correctly."""
    db = AsyncMock()
    tenant_ctx = TenantContext(company_id="test-comp-1", branch_id="branch-1")
    service = InventoryWmsService(db, tenant_ctx)

    wh = Warehouse(id="wh-1", code="WH-MAIN", name="Central Godown")
    loc = _make_location("loc-1", "wh-1", "A-02-R01-S01-B01", zone="STORAGE", max_capacity_units=150)

    # 1. _get_warehouse_resilient -> wh
    # 2. Location lookup -> loc
    # 3. StockMovement aggregation rows
    mock_wh_res = MagicMock()
    mock_wh_res.scalars.return_value.first.return_value = wh

    mock_loc_res = MagicMock()
    mock_loc_res.scalars.return_value.first.return_value = loc

    class MockStockRow:
        def __init__(self, item_id, product_id, sku, product_name, batch, total_qty):
            self.item_id = item_id
            self.product_id = product_id
            self.sku = sku
            self.product_name = product_name
            self.batch = batch
            self.total_qty = total_qty

    stock_rows = [
        MockStockRow("it-1", "pr-1", "SHIRT-BLUE-M", "Blue Formal Shirt", "BATCH-01", Decimal("40.0")),
        MockStockRow("it-2", "pr-2", "SHIRT-BLUE-L", "Blue Formal Shirt Large", "BATCH-02", Decimal("35.0")),
    ]
    mock_sm_res = MagicMock()
    mock_sm_res.all.return_value = stock_rows

    with patch.object(service, "_get_warehouse_resilient", return_value=wh):
        db.execute.side_effect = [mock_loc_res, mock_sm_res]

        summary = await service.get_rf_bin_summary(
            warehouse_id="wh-1",
            bin_code="A-02-R01-S01-B01",
        )

        assert summary["bin_code"] == "A-02-R01-S01-B01"
        assert summary["max_capacity_units"] == 150
        assert summary["total_units_occupied"] == 75.0  # 40 + 35
        assert summary["headroom_units"] == 75.0        # 150 - 75
        assert len(summary["items"]) == 2
        assert summary["items"][0]["item_code"] == "SHIRT-BLUE-M"


# =============================================================================
# 3. Quick Relocation Tests
# =============================================================================

async def test_rf_quick_transfer_execution():
    """Verify that execute_rf_quick_transfer creates dual StockMovements with WMS_RF_TRANSFER."""
    db = AsyncMock()
    tenant_ctx = TenantContext(company_id="test-comp-1", branch_id="branch-1")
    service = InventoryWmsService(db, tenant_ctx)

    wh = Warehouse(id="wh-1", code="WH-MAIN", name="Central Godown")
    loc_from = _make_location("loc-src", "wh-1", "BIN-SOURCE", zone="BULK")
    loc_to = _make_location("loc-dst", "wh-1", "BIN-TARGET", zone="STORAGE")
    item = _make_item("item-1", "SKU-TSHIRT-BLK", "Black Round Neck Tee")

    mock_res_from = MagicMock()
    mock_res_from.scalars.return_value.first.return_value = loc_from

    mock_res_to = MagicMock()
    mock_res_to.scalars.return_value.first.return_value = loc_to

    mock_res_item = MagicMock()
    mock_res_item.scalars.return_value.first.return_value = item

    added_objects = []
    db.add = MagicMock(side_effect=lambda obj: added_objects.append(obj))
    db.scalar.side_effect = [Decimal("50.0"), Decimal("20.0")]  # src_stock, tgt_stock

    with patch.object(service, "_get_warehouse_resilient", return_value=wh):
        db.execute.side_effect = [mock_res_from, mock_res_to, mock_res_item]

        res = await service.execute_rf_quick_transfer(
            warehouse_id="wh-1",
            from_bin="BIN-SOURCE",
            to_bin="BIN-TARGET",
            item_id="item-1",
            quantity=Decimal("15.0"),
            notes="Move to overflow rack",
        )

        assert res["status"] == "COMPLETED"
        assert res["from_bin"] == "BIN-SOURCE"
        assert res["to_bin"] == "BIN-TARGET"
        assert res["quantity"] == 15.0
        assert res["remaining_source_stock"] == 35.0  # 50 - 15

        # Verify dual StockMovement ledger records
        assert len(added_objects) == 2
        sm_out = added_objects[0]
        sm_in = added_objects[1]

        assert isinstance(sm_out, StockMovement)
        assert sm_out.movement_type == "TRANSFER_OUT"
        assert sm_out.quantity == Decimal("-15.0")
        assert sm_out.bin == "BIN-SOURCE"
        assert sm_out.reference_doc_type == "WMS_RF_TRANSFER"

        assert isinstance(sm_in, StockMovement)
        assert sm_in.movement_type == "TRANSFER_IN"
        assert sm_in.quantity == Decimal("15.0")
        assert sm_in.bin == "BIN-TARGET"
        assert sm_in.reference_doc_type == "WMS_RF_TRANSFER"


async def test_rf_quick_transfer_insufficient_stock():
    """Verify rejection when source bin stock is less than requested quantity."""
    db = AsyncMock()
    tenant_ctx = TenantContext(company_id="test-comp-1", branch_id="branch-1")
    service = InventoryWmsService(db, tenant_ctx)

    wh = Warehouse(id="wh-1", code="WH-MAIN")
    loc_from = _make_location("loc-src", "wh-1", "BIN-SRC")
    loc_to = _make_location("loc-dst", "wh-1", "BIN-DST")
    item = _make_item("item-1", "SKU-JEANS-01", "Jeans")

    mock_res_from = MagicMock()
    mock_res_from.scalars.return_value.first.return_value = loc_from

    mock_res_to = MagicMock()
    mock_res_to.scalars.return_value.first.return_value = loc_to

    mock_res_item = MagicMock()
    mock_res_item.scalars.return_value.first.return_value = item

    db.scalar.return_value = Decimal("5.0")  # Only 5 available

    with patch.object(service, "_get_warehouse_resilient", return_value=wh):
        db.execute.side_effect = [mock_res_from, mock_res_to, mock_res_item]

        with pytest.raises(HTTPException) as exc:
            await service.execute_rf_quick_transfer(
                warehouse_id="wh-1",
                from_bin="BIN-SRC",
                to_bin="BIN-DST",
                item_id="item-1",
                quantity=Decimal("20.0"),  # Requesting 20
            )
        assert exc.value.status_code == 400
        assert "Insufficient stock" in exc.value.detail


async def test_rf_quick_transfer_locked_bin():
    """Verify rejection when either source or destination bin is locked."""
    db = AsyncMock()
    tenant_ctx = TenantContext(company_id="test-comp-1", branch_id="branch-1")
    service = InventoryWmsService(db, tenant_ctx)

    wh = Warehouse(id="wh-1", code="WH-MAIN")
    loc_from = _make_location("loc-src", "wh-1", "BIN-SRC", is_locked=True)

    mock_res_from = MagicMock()
    mock_res_from.scalars.return_value.first.return_value = loc_from

    with patch.object(service, "_get_warehouse_resilient", return_value=wh):
        db.execute.side_effect = [mock_res_from]

        with pytest.raises(HTTPException) as exc:
            await service.execute_rf_quick_transfer(
                warehouse_id="wh-1",
                from_bin="BIN-SRC",
                to_bin="BIN-DST",
                item_id="item-1",
                quantity=Decimal("10.0"),
            )
        assert exc.value.status_code == 400
        assert "locked" in exc.value.detail


# =============================================================================
# 4. Directed Replenishment Confirmation Tests
# =============================================================================

async def test_rf_replenish_confirm():
    """Verify 3-step scan directed replenishment confirmation writes atomic movements."""
    db = AsyncMock()
    tenant_ctx = TenantContext(company_id="test-comp-1", branch_id="branch-1")
    service = InventoryWmsService(db, tenant_ctx)

    wh = Warehouse(id="wh-1", code="WH-MAIN")
    src_loc = _make_location("src-id", "wh-1", "BULK-01", zone="BULK")
    dst_loc = _make_location("dst-id", "wh-1", "PICK-01", zone="PICKING")
    item = _make_item("item-1", "SKU-POLO-NAVY", "Navy Polo T-Shirt")

    mock_src = MagicMock()
    mock_src.scalars.return_value.first.return_value = src_loc

    mock_dst = MagicMock()
    mock_dst.scalars.return_value.first.return_value = dst_loc

    mock_item = MagicMock()
    mock_item.scalars.return_value.first.return_value = item

    added_objects = []
    db.add = MagicMock(side_effect=lambda obj: added_objects.append(obj))
    db.scalar.return_value = Decimal("100.0")  # Source bin has 100 units

    with patch.object(service, "_get_warehouse_resilient", return_value=wh):
        db.execute.side_effect = [mock_src, mock_dst, mock_item]

        res = await service.confirm_rf_replenishment(
            warehouse_id="wh-1",
            scanned_source_bin="BULK-01",
            scanned_item_barcode="890001",
            scanned_destination_bin="PICK-01",
            quantity=Decimal("25.0"),
            task_id="TASK-999",
        )

        assert res["success"] is True
        assert res["status"] == "EXECUTED"
        assert res["source_bin"] == "BULK-01"
        assert res["destination_bin"] == "PICK-01"
        assert res["transferred_units"] == 25.0

        # Verify dual movements created
        assert len(added_objects) == 2
        assert added_objects[0].movement_type == "TRANSFER_OUT"
        assert added_objects[0].quantity == Decimal("-25.0")
        assert added_objects[0].reference_doc_type == "WMS_REPLENISHMENT"

        assert added_objects[1].movement_type == "TRANSFER_IN"
        assert added_objects[1].quantity == Decimal("25.0")
        assert added_objects[1].reference_doc_type == "WMS_REPLENISHMENT"


# =============================================================================
# 5. FastAPI Endpoints Smoke Test
# =============================================================================

async def test_rf_api_router_endpoints():
    """Verify that the 4 API router endpoints call the corresponding service methods."""
    db = AsyncMock()
    tenant_ctx = TenantContext(company_id="test-comp-1", branch_id="branch-1")

    # 1. verify_barcode router
    with patch.object(InventoryWmsService, "verify_rf_barcode", return_value={
        "matched": True,
        "entity_type": "LOCATION",
        "barcode": "BIN-01",
        "location": {
            "id": "loc-1", "code": "BIN-01", "name": "Bin 1", "zone": "PICKING",
            "barcode": "BIN-01", "max_capacity_units": 100, "is_locked": False
        },
        "item": None,
        "message": "Matched",
    }):
        resp = await verify_rf_barcode(
            warehouse_id="wh-1",
            req=RfBarcodeVerifyRequest(barcode="BIN-01"),
            db=db,
            tenant_ctx=tenant_ctx,
            guard=True,
        )
        assert isinstance(resp, RfBarcodeVerifyResponse)
        assert resp.matched is True

    # 2. bin_summary router
    with patch.object(InventoryWmsService, "get_rf_bin_summary", return_value={
        "warehouse_id": "wh-1",
        "warehouse_code": "WH-01",
        "location_id": "loc-1",
        "bin_code": "BIN-01",
        "barcode": "BIN-01",
        "zone": "PICKING",
        "max_capacity_units": 100,
        "total_units_occupied": 20.0,
        "headroom_units": 80.0,
        "is_locked": False,
        "items": [],
    }):
        resp = await get_rf_bin_summary(
            warehouse_id="wh-1",
            bin_code="BIN-01",
            db=db,
            tenant_ctx=tenant_ctx,
            guard=True,
        )
        assert isinstance(resp, RfBinSummaryResponse)
        assert resp.headroom_units == 80.0

    # 3. quick_transfer router
    with patch.object(InventoryWmsService, "execute_rf_quick_transfer", return_value={
        "transfer_id": "RF-MOV-1234",
        "warehouse_id": "wh-1",
        "from_bin": "BIN-A",
        "to_bin": "BIN-B",
        "item_id": "item-1",
        "item_code": "SKU-1",
        "quantity": 10.0,
        "remaining_source_stock": 40.0,
        "new_target_stock": 10.0,
        "status": "COMPLETED",
        "message": "Transferred",
    }):
        resp = await execute_rf_quick_transfer(
            warehouse_id="wh-1",
            req=RfQuickTransferRequest(from_bin="BIN-A", to_bin="BIN-B", item_id="item-1", quantity=Decimal("10.0")),
            db=db,
            tenant_ctx=tenant_ctx,
            guard=True,
        )
        assert isinstance(resp, RfQuickTransferResponse)
        assert resp.status == "COMPLETED"

    # 4. replenish_confirm router
    with patch.object(InventoryWmsService, "confirm_rf_replenishment", return_value={
        "success": True,
        "run_id": "RF-REP-9999",
        "task_id": "T-1",
        "transferred_units": 15.0,
        "source_bin": "BULK-1",
        "destination_bin": "PICK-1",
        "status": "EXECUTED",
        "message": "Confirmed",
    }):
        resp = await confirm_rf_replenishment(
            warehouse_id="wh-1",
            req=RfReplenishConfirmRequest(
                scanned_source_bin="BULK-1",
                scanned_item_barcode="BAR-1",
                scanned_destination_bin="PICK-1",
                quantity=Decimal("15.0"),
            ),
            db=db,
            tenant_ctx=tenant_ctx,
            guard=True,
        )
        assert isinstance(resp, RfReplenishConfirmResponse)
        assert resp.success is True
