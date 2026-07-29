"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 18.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pytest Suite for Domain Release Phase 24 WMS Engine

test_wms_engine.py — Integration test suite for Enterprise WMS Engine (v18.0.0).
"""

import pytest

from app.core.wms.bin_location import BinLocationManager
from app.core.wms.stock_transfer import StockTransferEngine
from app.core.wms.batch_serial import BatchSerialManager
from app.core.wms.inventory_count import InventoryCountEngine


@pytest.mark.asyncio
async def test_bin_location_manager_hierarchical_creation():
    """Verify BinLocationManager creates bin locations."""
    b1 = BinLocationManager.create_bin("WH-NORTH", "ZONE-A", "Aisle-01", "Rack-04", "Shelf-02", "BIN-A01-R04-S02")
    assert b1.bin_code == "BIN-A01-R04-S02"
    assert b1.warehouse_id == "WH-NORTH"

    wh_bins = BinLocationManager.get_bins_for_warehouse("WH-NORTH")
    assert len(wh_bins) == 1
    assert wh_bins[0]["bin_code"] == "BIN-A01-R04-S02"


@pytest.mark.asyncio
async def test_stock_transfer_in_transit_lifecycle():
    """Verify StockTransferEngine state transitions (INITIATED -> IN_TRANSIT -> RECEIVED)."""
    items = [{"item_id": "SKU-FOOTWEAR-01", "qty": 50}]
    tr = StockTransferEngine.initiate_transfer("WH-MAIN", "WH-STORE-NORTH", items, "Inter-branch replenishment")

    assert tr.status == "INITIATED"
    assert tr.transfer_number.startswith("TR-WMS-")

    # Ship transfer
    ship_ok = StockTransferEngine.ship_transfer(tr.id)
    assert ship_ok is True
    assert tr.status == "IN_TRANSIT"

    # Receive transfer
    recv_ok = StockTransferEngine.receive_transfer(tr.id)
    assert recv_ok is True
    assert tr.status == "RECEIVED"


@pytest.mark.asyncio
async def test_batch_serial_fefo_allocation():
    """Verify BatchSerialManager sorts batches by FEFO rules."""
    available_batches = [
        {"batch_number": "BATCH-2026-B", "expiry_date": "2026-11-30", "available_qty": 30},
        {"batch_number": "BATCH-2026-A", "expiry_date": "2026-08-15", "available_qty": 20},  # Earliest expiry
        {"batch_number": "BATCH-2026-C", "expiry_date": "2027-02-28", "available_qty": 50}
    ]

    res = BatchSerialManager.allocate_fefo_batches("SKU-MED-101", required_qty=35, available_batches=available_batches)
    assert res["is_fully_allocated"] is True
    assert len(res["allocated_batches"]) == 2

    # First allocated batch MUST be earliest expiring BATCH-2026-A (20 units)
    assert res["allocated_batches"][0]["batch_number"] == "BATCH-2026-A"
    assert res["allocated_batches"][0]["allocated_qty"] == 20

    # Second allocated batch MUST be BATCH-2026-B (remaining 15 units)
    assert res["allocated_batches"][1]["batch_number"] == "BATCH-2026-B"
    assert res["allocated_batches"][1]["allocated_qty"] == 15


@pytest.mark.asyncio
async def test_inventory_count_variance_calculation():
    """Verify InventoryCountEngine variance calculations."""
    res_match = InventoryCountEngine.calculate_variance("SKU-101", expected_qty=100, actual_counted_qty=100)
    assert res_match["status"] == "MATCH"
    assert res_match["requires_gl_adjustment"] is False

    res_deficit = InventoryCountEngine.calculate_variance("SKU-101", expected_qty=100, actual_counted_qty=95)
    assert res_deficit["status"] == "DEFICIT"
    assert res_deficit["variance_qty"] == -5
    assert res_deficit["requires_gl_adjustment"] is True
