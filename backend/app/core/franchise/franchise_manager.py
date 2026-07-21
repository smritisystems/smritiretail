"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 21.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Franchise Store Organization Manager
"""

import uuid
from typing import Dict, Any, List


class FranchiseStoreRecord:
    def __init__(self, store_id: str, store_code: str, store_name: str, store_type: str = "FOFO", royalty_pct: float = 5.0, tech_fee: float = 250.0):
        self.id = store_id
        self.store_code = store_code
        self.store_name = store_name
        self.store_type = store_type.upper()
        self.royalty_percentage = royalty_pct
        self.tech_fee_monthly = tech_fee

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "store_code": self.store_code,
            "store_name": self.store_name,
            "store_type": self.store_type,
            "royalty_percentage": self.royalty_percentage,
            "tech_fee_monthly": self.tech_fee_monthly
        }


class FranchiseManager:
    """Franchise Store Organization Manager (COCO vs FOFO)."""

    _stores: Dict[str, FranchiseStoreRecord] = {}

    @classmethod
    def register_store(cls, store_code: str, store_name: str, store_type: str = "FOFO", royalty_pct: float = 5.0, tech_fee: float = 250.0) -> FranchiseStoreRecord:
        sid = str(uuid.uuid4())
        rec = FranchiseStoreRecord(sid, store_code, store_name, store_type, royalty_pct, tech_fee)
        cls._stores[store_code] = rec
        return rec

    @classmethod
    def get_store(cls, store_code: str) -> FranchiseStoreRecord:
        return cls._stores.get(store_code)

    @classmethod
    def list_stores(cls) -> List[Dict[str, Any]]:
        return [s.to_dict() for s in cls._stores.values()]
