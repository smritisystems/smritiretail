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
Classification: Physical Inventory Count & Variance Adjustment Engine
"""

from typing import Dict, Any


class InventoryCountEngine:
    """Cycle Count Verification & General Ledger Variance Adjuster."""

    @staticmethod
    def calculate_variance(item_id: str, expected_qty: int, actual_counted_qty: int) -> Dict[str, Any]:
        variance_qty = actual_counted_qty - expected_qty
        has_variance = variance_qty != 0
        status = "MATCH" if not has_variance else ("SURPLUS" if variance_qty > 0 else "DEFICIT")

        return {
            "item_id": item_id,
            "expected_qty": expected_qty,
            "actual_counted_qty": actual_counted_qty,
            "variance_qty": variance_qty,
            "status": status,
            "requires_gl_adjustment": has_variance
        }
