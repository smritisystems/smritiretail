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
Classification: Pydantic DTO Schemas for Enterprise WMS
"""

from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class BinLocationCreate(BaseModel):
    warehouse_id: str
    zone: str = "MAIN"
    aisle: str
    rack: str
    shelf: str
    bin_code: str
    max_capacity_units: int = 1000


class BinLocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    warehouse_id: str
    zone: str
    aisle: str
    rack: str
    shelf: str
    bin_code: str
    max_capacity_units: int
    current_occupancy_units: int
    is_active: str


class StockTransferCreate(BaseModel):
    from_warehouse_id: str
    to_warehouse_id: str
    items: List[dict]
    notes: Optional[str] = None


class BatchAllocationRequest(BaseModel):
    item_id: str
    required_qty: int
