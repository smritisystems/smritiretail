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
Classification: Enterprise WMS REST API Gateway
"""

from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Body

from app.core.wms.bin_location import BinLocationManager
from app.core.wms.stock_transfer import StockTransferEngine
from app.core.wms.batch_serial import BatchSerialManager
from app.core.wms.inventory_count import InventoryCountEngine

router = APIRouter(prefix="/wms", tags=["Domain Release: Enterprise WMS & Multi-Bin Engine (v18.0.0)"])


@router.post("/bins")
async def create_bin_location(warehouse_id: str = Body(...), zone: str = Body("MAIN"), aisle: str = Body(...), rack: str = Body(...), shelf: str = Body(...), bin_code: str = Body(...), max_capacity: int = Body(1000)):
    """Creates a new bin location in a warehouse."""
    bin_rec = BinLocationManager.create_bin(warehouse_id, zone, aisle, rack, shelf, bin_code, max_capacity)
    return bin_rec.to_dict()


@router.get("/bins/{warehouse_id}")
async def get_bins_by_warehouse(warehouse_id: str):
    """Returns all bin locations in a given warehouse."""
    return BinLocationManager.get_bins_for_warehouse(warehouse_id)


@router.post("/transfers/initiate")
async def initiate_stock_transfer(from_warehouse_id: str = Body(...), to_warehouse_id: str = Body(...), items: List[dict] = Body(...), notes: str = Body(None)):
    """Initiates an in-transit stock transfer between warehouses."""
    tr = StockTransferEngine.initiate_transfer(from_warehouse_id, to_warehouse_id, items, notes)
    return tr.to_dict()


@router.post("/transfers/{transfer_id}/ship")
async def ship_stock_transfer(transfer_id: str):
    """Marks a stock transfer as SHIPPED / IN_TRANSIT."""
    ok = StockTransferEngine.ship_transfer(transfer_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Transfer ID not found")
    return {"success": True, "status": "IN_TRANSIT"}


@router.post("/transfers/{transfer_id}/receive")
async def receive_stock_transfer(transfer_id: str):
    """Reconciles and completes a stock transfer as RECEIVED."""
    ok = StockTransferEngine.receive_transfer(transfer_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Transfer ID not found")
    return {"success": True, "status": "RECEIVED"}


@router.post("/batches/fefo-allocate")
async def allocate_fefo_batches(item_id: str = Body(...), required_qty: int = Body(...), available_batches: List[dict] = Body(...)):
    """Allocates inventory picking batches based on FEFO rules."""
    return BatchSerialManager.allocate_fefo_batches(item_id, required_qty, available_batches)


@router.post("/inventory-count/variance")
async def calculate_count_variance(item_id: str = Body(...), expected_qty: int = Body(...), actual_counted_qty: int = Body(...)):
    """Calculates cycle count inventory variance."""
    return InventoryCountEngine.calculate_variance(item_id, expected_qty, actual_counted_qty)
