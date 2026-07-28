"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 12.0.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from datetime import date, timedelta
from decimal import Decimal
from app.services.pharma_fefo import PharmaFEFOService

def test_fefo_batch_sorting():
    today = date.today()
    batches = [
        {"id": "b2", "batch_number": "B002", "expiry_date": today + timedelta(days=90), "quantity_available": Decimal("50.00")},
        {"id": "b1", "batch_number": "B001", "expiry_date": today + timedelta(days=30), "quantity_available": Decimal("20.00")},
        {"id": "b3_expired", "batch_number": "B003", "expiry_date": today - timedelta(days=10), "quantity_available": Decimal("100.00")},
    ]

    sorted_batches = PharmaFEFOService.sort_batches_by_fefo(batches)
    assert len(sorted_batches) == 2
    assert sorted_batches[0]["batch_number"] == "B001"  # Earliest expiry first
    assert sorted_batches[1]["batch_number"] == "B002"

def test_fefo_stock_allocation():
    today = date.today()
    batches = [
        {"id": "b1", "batch_number": "B001", "expiry_date": today + timedelta(days=30), "quantity_available": Decimal("20.00")},
        {"id": "b2", "batch_number": "B002", "expiry_date": today + timedelta(days=90), "quantity_available": Decimal("50.00")},
    ]

    allocations = PharmaFEFOService.allocate_fefo_stock(batches, Decimal("35.00"))
    assert len(allocations) == 2
    assert allocations[0]["batch_number"] == "B001"
    assert allocations[0]["allocated_quantity"] == Decimal("20.00")
    assert allocations[1]["batch_number"] == "B002"
    assert allocations[1]["allocated_quantity"] == Decimal("15.00")
