"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites : aitdl.com | erpnbook.com | smritibooks.com

* Version    : 1.0.0
* Created    : 2026-07-16
* Modified   : 2026-07-16
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
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
