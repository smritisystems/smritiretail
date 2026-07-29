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
Classification: Pydantic DTO Schemas for E-Commerce Engine
"""

from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class SalesChannelCreate(BaseModel):
    channel_name: str
    store_url: str


class SalesChannelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    channel_name: str
    store_url: str
    sync_status: str


class OrderFulfillmentRequest(BaseModel):
    channel_order_id: str
    channel_name: str
    items: List[dict]
    preferred_fulfillment_source: Optional[str] = "WAREHOUSE"
