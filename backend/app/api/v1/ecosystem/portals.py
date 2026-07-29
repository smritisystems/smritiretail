"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 27.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Portal Metadata Registry & Manifest REST API Gateway
"""

from typing import Dict, Any
from fastapi import APIRouter, Query

from app.core.ecosystem.portal_registry import PortalRegistry
from app.core.ecosystem.digital_platform_manifest import DigitalPlatformManifest

router = APIRouter(prefix="/ecosystem", tags=["SMRITI Digital Platform Portal Registry"])


@router.get("/manifest")
async def get_digital_platform_manifest():
    """Returns Master Ecosystem Manifest for SMRITI Digital Platform v27.0.0 (DPF-001 Compliant)."""
    return DigitalPlatformManifest.get_manifest()


@router.get("/portals")
async def get_registered_portals(visibility: str = Query(None)):

    """Returns dynamic metadata for all registered portals (CMP-001 & SIP-001 compliant)."""
    return PortalRegistry.get_portals(visibility_filter=visibility)


@router.get("/portals/{portal_id}/manifest")
async def validate_portal_manifest(portal_id: str):
    """Validates Portal Manifest compatibility against CMP-001 baseline."""
    return PortalRegistry.validate_portal_manifest(portal_id)
