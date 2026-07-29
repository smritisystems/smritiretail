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
Classification: Batch & Serial Expiry Manager (FEFO)
"""

from typing import Dict, Any, List


class BatchRecord:
    def __init__(self, batch_id: str, item_id: str, batch_number: str, expiry_date: str, available_qty: int):
        self.batch_id = batch_id
        self.item_id = item_id
        self.batch_number = batch_number
        self.expiry_date = expiry_date
        self.available_qty = available_qty


class BatchSerialManager:
    """FEFO (First-Expiry-First-Out) Batch Manager."""

    @staticmethod
    def allocate_fefo_batches(item_id: str, required_qty: int, available_batches: List[dict]) -> Dict[str, Any]:
        sorted_batches = sorted(available_batches, key=lambda b: b.get("expiry_date", "9999-12-31"))

        allocated = []
        remaining = required_qty

        for b in sorted_batches:
            if remaining <= 0:
                break
            qty = min(remaining, b.get("available_qty", 0))
            allocated.append({
                "batch_number": b.get("batch_number"),
                "expiry_date": b.get("expiry_date"),
                "allocated_qty": qty
            })
            remaining -= qty

        return {
            "item_id": item_id,
            "requested_qty": required_qty,
            "allocated_qty": required_qty - remaining,
            "is_fully_allocated": remaining == 0,
            "allocated_batches": allocated
        }
