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
Classification: Pydantic DTO Schemas for Master Release Manifest
"""

from typing import Dict, Any, List
from pydantic import BaseModel


class MasterReleaseManifestResponse(BaseModel):
    master_version: str
    foundation_baseline: str
    spk_kernel_version: str
    cmp_governance_policy: str
    gcr_engineering_standard: str
    platform_layers: Dict[str, str]
    domain_releases: Dict[str, str]
    system_status: str


class MasterHealthResponse(BaseModel):
    status: str
    subsystems_checked: int
    passed_subsystems: int
    health_metrics: Dict[str, Any]
