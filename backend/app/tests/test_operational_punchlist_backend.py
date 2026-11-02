"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-11-03
Modified     : 2026-11-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from decimal import Decimal
from app.schemas.purchase import PurchaseOrderItemResponse, PurchaseOrderResponse


def test_purchase_order_item_schema_tracks_billed_and_pending_quantities():
    item_data = {
        "id": "poi-001",
        "product_id": "prod-101",
        "code": "SKU-FOOTWEAR-01",
        "name": "Men Leather Shoe",
        "quantity": Decimal("10.00"),
        "cost_price": Decimal("850.00"),
        "gst_rate": Decimal("18.00"),
        "tax_amount": Decimal("153.00"),
        "line_total": Decimal("10030.00"),
        "received_qty": Decimal("6.00"),
        "billed_qty": Decimal("6.00"),
        "pending_qty": Decimal("4.00"),
        "is_billed": False,
    }
    item = PurchaseOrderItemResponse(**item_data)
    assert item.received_qty == Decimal("6.00")
    assert item.pending_qty == Decimal("4.00")
    assert item.is_billed is False


def test_purchase_order_item_fully_billed_flag():
    item_data = {
        "id": "poi-002",
        "product_id": "prod-102",
        "code": "SKU-FOOTWEAR-02",
        "name": "Women Formal Heel",
        "quantity": Decimal("5.00"),
        "cost_price": Decimal("1200.00"),
        "gst_rate": Decimal("18.00"),
        "tax_amount": Decimal("216.00"),
        "line_total": Decimal("7080.00"),
        "received_qty": Decimal("5.00"),
        "billed_qty": Decimal("5.00"),
        "pending_qty": Decimal("0.00"),
        "is_billed": True,
    }
    item = PurchaseOrderItemResponse(**item_data)
    assert item.received_qty == Decimal("5.00")
    assert item.pending_qty == Decimal("0.00")
    assert item.is_billed is True


def test_purchase_order_response_tracks_order_level_pending_and_fully_billed():
    po_data = {
        "id": "po-101",
        "order_no": "PO-2026-0099",
        "supplier_id": "sup-001",
        "supplier_name": "Apex Footwear Ltd",
        "status": "PARTIALLY_RECEIVED",
        "subtotal": Decimal("10000.00"),
        "tax_total": Decimal("1800.00"),
        "grand_total": Decimal("11800.00"),
        "pending_qty": Decimal("4.00"),
        "pending_items_count": 1,
        "is_fully_billed": False,
        "items": [],
    }
    resp = PurchaseOrderResponse(**po_data)
    assert resp.pending_qty == Decimal("4.00")
    assert resp.pending_items_count == 1
    assert resp.is_fully_billed is False

