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

pharma_fefo.py — Pharma FEFO (First-Expiry-First-Out) Batch Picker Service
Conforms to Level 1 SMRITI Architecture Constitution (ADR-003 & ADR-006).
"""

from typing import List, Dict, Any
from datetime import date
from decimal import Decimal

class PharmaFEFOService:
    """Service handling FEFO (First-Expiry-First-Out) batch allocation for Pharma Retail."""

    @staticmethod
    def sort_batches_by_fefo(batches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Sorts product stock batches by earliest expiry date (FEFO).
        Ignores expired batches (expiry_date < today) or zero stock.
        """
        today = date.today()
        valid_batches = [
            b for b in batches
            if b.get("expiry_date") and b["expiry_date"] >= today and Decimal(str(b.get("quantity_available", 0))) > Decimal("0.00")
        ]
        return sorted(valid_batches, key=lambda b: b["expiry_date"])

    @staticmethod
    def allocate_fefo_stock(batches: List[Dict[str, Any]], required_qty: Decimal) -> List[Dict[str, Any]]:
        """
        Allocates required stock quantity across available batches using FEFO order.
        """
        sorted_batches = PharmaFEFOService.sort_batches_by_fefo(batches)
        allocations = []
        remaining_qty = Decimal(str(required_qty))

        for batch in sorted_batches:
            if remaining_qty <= Decimal("0.00"):
                break
            available = Decimal(str(batch["quantity_available"]))
            alloc_qty = min(available, remaining_qty)
            allocations.append({
                "batch_id": batch["id"],
                "batch_number": batch["batch_number"],
                "expiry_date": str(batch["expiry_date"]),
                "allocated_quantity": alloc_qty,
                "mrp": batch.get("mrp", Decimal("0.00"))
            })
            remaining_qty -= alloc_qty

        return allocations
