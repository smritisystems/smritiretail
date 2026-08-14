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

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 1.0.0
* Created    : 2026-07-11
* Modified   : 2026-07-11
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

from fastapi import APIRouter
from pydantic import BaseModel
from ...core.config import settings

router = APIRouter()

class AppMetadata(BaseModel):
    productName: str
    version: str
    edition: str
    organization: str

class MetadataResponse(BaseModel):
    app: AppMetadata

@router.get("/metadata", response_model=MetadataResponse, tags=["Metadata"])
async def get_metadata():
    """
    Fetch SMRITI system metadata parameter bindings (name, version, license edition).
    """
    return {
        "app": {
            "productName": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "edition": settings.EDITION,
            "organization": settings.ORGANIZATION
        }
    }
