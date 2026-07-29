"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 23.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Master Version Release & Health REST API Gateway
"""

from typing import Dict, Any
from fastapi import APIRouter

from app.core.release_manifest import MasterReleaseManifest
from app.core.master_health import MasterHealthChecker

router = APIRouter(prefix="/release-info", tags=["Master Platform Baseline & Certified Telemetry (v23.0.0)"])


@router.get("")
async def get_master_release_manifest():
    """Returns the certified Master Release Manifest for SMRITI Retail OS (v23.0.0)."""
    return MasterReleaseManifest.get_manifest()


@router.get("/health")
async def get_master_system_health():
    """Runs master diagnostic probes across all platform layers & domain modules."""
    return MasterHealthChecker.run_health_checks()
