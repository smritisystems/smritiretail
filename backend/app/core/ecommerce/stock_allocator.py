"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 19.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Real-Time Stock Allocator & Safety Buffer Engine
"""

from typing import Dict, Any


class StockAllocator:
    """Real-Time E-Commerce Safety Buffer Stock Allocator."""

    DEFAULT_SAFETY_BUFFER = 5  # Reserve 5 units safety buffer to prevent online overselling

    @classmethod
    def allocate_online_stock(cls, total_physical_stock: int, requested_qty: int) -> Dict[str, Any]:
        allocatable_stock = max(0, total_physical_stock - cls.DEFAULT_SAFETY_BUFFER)
        can_allocate = requested_qty <= allocatable_stock

        return {
            "total_physical_stock": total_physical_stock,
            "safety_buffer_reserved": cls.DEFAULT_SAFETY_BUFFER,
            "allocatable_online_stock": allocatable_stock,
            "requested_qty": requested_qty,
            "can_allocate": can_allocate,
            "allocated_qty": requested_qty if can_allocate else allocatable_stock
        }
