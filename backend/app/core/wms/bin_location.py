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
Classification: Hierarchical Bin Location Manager
"""

import uuid
from typing import Dict, Any, List


class BinLocationRecord:
    def __init__(self, bin_id: str, warehouse_id: str, zone: str, aisle: str, rack: str, shelf: str, bin_code: str, max_capacity: int = 1000):
        self.id = bin_id
        self.warehouse_id = warehouse_id
        self.zone = zone
        self.aisle = aisle
        self.rack = rack
        self.shelf = shelf
        self.bin_code = bin_code
        self.max_capacity_units = max_capacity
        self.current_occupancy_units = 0
        self.is_active = "ACTIVE"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "warehouse_id": self.warehouse_id,
            "zone": self.zone,
            "aisle": self.aisle,
            "rack": self.rack,
            "shelf": self.shelf,
            "bin_code": self.bin_code,
            "max_capacity_units": self.max_capacity_units,
            "current_occupancy_units": self.current_occupancy_units,
            "is_active": self.is_active
        }


class BinLocationManager:
    """Hierarchical Bin Location Manager (Aisle-Rack-Shelf-Bin)."""

    _bins: Dict[str, BinLocationRecord] = {}

    @classmethod
    def create_bin(cls, warehouse_id: str, zone: str, aisle: str, rack: str, shelf: str, bin_code: str, max_capacity: int = 1000) -> BinLocationRecord:
        bin_id = str(uuid.uuid4())
        bin_rec = BinLocationRecord(bin_id, warehouse_id, zone, aisle, rack, shelf, bin_code, max_capacity)
        cls._bins[bin_id] = bin_rec
        return bin_rec

    @classmethod
    def get_bins_for_warehouse(cls, warehouse_id: str) -> List[Dict[str, Any]]:
        return [b.to_dict() for b in cls._bins.values() if b.warehouse_id == warehouse_id]
