"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.0.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from app.core.stock_transfer import (
    StockTransferEngine,
    StockTransferItem,
    TransferStatus,
)

def test_inter_store_stock_transfer_lifecycle():
    initial_stock = {
        "WH-CENTRAL": {"SKU-SHIRT-BLUE": 100.0, "SKU-JEANS-BLACK": 50.0},
        "WH-STORE-01": {"SKU-SHIRT-BLUE": 10.0, "SKU-JEANS-BLACK": 5.0},
    }

    engine = StockTransferEngine(warehouse_stock=initial_stock)

    # 1. Create Transfer Request
    items = [
        StockTransferItem(sku="SKU-SHIRT-BLUE", item_name="Casual Shirt", requested_qty=20.0),
        StockTransferItem(sku="SKU-JEANS-BLACK", item_name="Denim Jeans", requested_qty=10.0),
    ]
    tr = engine.create_transfer_request("TR-1001", "WH-CENTRAL", "WH-STORE-01", items)
    assert tr.status == TransferStatus.REQUESTED

    # 2. Dispatch Transfer
    tr_dispatched = engine.dispatch_transfer("TR-1001", {"SKU-SHIRT-BLUE": 20.0, "SKU-JEANS-BLACK": 10.0})
    assert tr_dispatched.status == TransferStatus.DISPATCHED_IN_TRANSIT

    # Stock at source should be reduced, and lock added
    assert engine.get_stock("WH-CENTRAL", "SKU-SHIRT-BLUE") == 80.0
    assert engine.get_in_transit_stock("WH-CENTRAL", "SKU-SHIRT-BLUE") == 20.0

    # 3. Receive Transfer
    tr_received = engine.receive_transfer("TR-1001", {"SKU-SHIRT-BLUE": 20.0, "SKU-JEANS-BLACK": 10.0})
    assert tr_received.status == TransferStatus.RECEIVED

    # Target stock updated, and in-transit lock released
    assert engine.get_stock("WH-STORE-01", "SKU-SHIRT-BLUE") == 30.0
    assert engine.get_in_transit_stock("WH-CENTRAL", "SKU-SHIRT-BLUE") == 0.0

def test_insufficient_stock_dispatch_error():
    initial_stock = {"WH-CENTRAL": {"SKU-SHIRT": 5.0}}
    engine = StockTransferEngine(warehouse_stock=initial_stock)

    items = [StockTransferItem(sku="SKU-SHIRT", item_name="Casual Shirt", requested_qty=20.0)]
    engine.create_transfer_request("TR-1002", "WH-CENTRAL", "WH-STORE-02", items)

    with pytest.raises(ValueError, match="Insufficient stock"):
        engine.dispatch_transfer("TR-1002", {"SKU-SHIRT": 20.0})
