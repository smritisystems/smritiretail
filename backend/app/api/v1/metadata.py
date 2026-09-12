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

* Version    : 1.1.0
* Created    : 2026-07-11
* Modified   : 2026-09-11
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from ...core.config import settings

router = APIRouter()

class AppMetadata(BaseModel):
    productName: str
    version: str
    edition: str
    organization: str
    buildNumber: Optional[str] = None
    buildDate: Optional[str] = None
    uiVersion: Optional[str] = None

class AuthorMetadata(BaseModel):
    authorName: str
    role: str
    organization: str
    product: str
    website: str
    officialSites: List[str]
    supportEmail: str
    copyright: str
    license: str

class MetadataResponse(BaseModel):
    app: AppMetadata
    author: AuthorMetadata

@router.get("/metadata", response_model=MetadataResponse, tags=["Metadata"])
async def get_metadata():
    """
    Fetch SMRITI system metadata parameter bindings (name, version, license edition, author details).
    """
    return {
        "app": {
            "productName": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "edition": settings.EDITION,
            "organization": "SMRITI SYSTEMS | AITDL NETWORKS",
            "buildNumber": getattr(settings, "BUILD_NUMBER", None),
            "buildDate": getattr(settings, "BUILD_DATE", None),
            "uiVersion": getattr(settings, "UI_VERSION", None),
        },
        "author": {
            "authorName": "Jawahar Ramkripal Mallah",
            "role": "Chief Systems Architect & Creator",
            "organization": "SMRITI SYSTEMS | AITDL NETWORKS",
            "product": settings.PROJECT_NAME,
            "website": "smritibooks.com",
            "officialSites": ["aitdl.com", "SMRITISYS.com", "smritibooks.com"],
            "supportEmail": "support@smritibooks.com",
            "copyright": f"© AITDL.com and SMRITIBooks.com. All Rights Reserved.",
            "license": "Proprietary Commercial Software",
        }
    }
