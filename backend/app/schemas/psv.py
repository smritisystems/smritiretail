"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class PSVPartySkuTrackingResponse(BaseModel):
    productId: Optional[str] = None
    sku: str
    productName: Optional[str] = None
    invoicedQty: int
    confirmedSoldQty: int
    returnedQty: int

    model_config = {"from_attributes": True}


class PSVPartyResponse(BaseModel):
    id: str
    name: str
    location: str
    stockCount: int
    sellThrough: float
    weeksOfCover: float
    capitalLocked: float
    status: str
    history: List[dict] = Field(default_factory=list)
    skuTracking: List[PSVPartySkuTrackingResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}
