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
Classification: Stateful Multi-Warehouse Stock Transfer Engine
"""

import uuid
from datetime import datetime
from typing import Dict, Any, List


class StockTransferRecord:
    def __init__(self, transfer_id: str, transfer_number: str, from_wh: str, to_wh: str, items: List[dict], notes: str = None):
        self.id = transfer_id
        self.transfer_number = transfer_number
        self.from_warehouse_id = from_wh
        self.to_warehouse_id = to_wh
        self.items = items
        self.status = "INITIATED"
        self.notes = notes
        self.created_at = datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "transfer_number": self.transfer_number,
            "from_warehouse_id": self.from_warehouse_id,
            "to_warehouse_id": self.to_warehouse_id,
            "items": self.items,
            "status": self.status,
            "notes": self.notes,
            "created_at": self.created_at
        }


class StockTransferEngine:
    """Multi-Warehouse In-Transit Transfer Engine."""

    _transfers: Dict[str, StockTransferRecord] = {}

    @classmethod
    def initiate_transfer(cls, from_wh: str, to_wh: str, items: List[dict], notes: str = None) -> StockTransferRecord:
        tr_id = str(uuid.uuid4())
        num = f"TR-WMS-{len(cls._transfers) + 1001}"
        tr = StockTransferRecord(tr_id, num, from_wh, to_wh, items, notes)
        cls._transfers[tr_id] = tr
        return tr

    @classmethod
    def ship_transfer(cls, transfer_id: str) -> bool:
        if transfer_id in cls._transfers:
            cls._transfers[transfer_id].status = "IN_TRANSIT"
            return True
        return False

    @classmethod
    def receive_transfer(cls, transfer_id: str) -> bool:
        if transfer_id in cls._transfers:
            cls._transfers[transfer_id].status = "RECEIVED"
            return True
        return False
