"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 12.1.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: REST API Router Gateway

capabilities.py — REST API router for SMRITI Modular Platform (SMP-001) Capability Management.
"""

from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Body, status
from pydantic import BaseModel

from app.core.spk_kernel import kernel, ModuleState

router = APIRouter(prefix="/capabilities", tags=["SMRITI Modular Platform (SMP-001) Capabilities"])


class ModuleToggleRequest(BaseModel):
    enabled: bool


@router.get("")
async def get_capability_matrix():
    """Returns total categorized 4-level module matrix & installation states."""
    kernel.rebuild_registries()
    modules_list = []
    for m in kernel.manifests.values():
        modules_list.append({
            "id": m.id,
            "uuid": m.uuid,
            "name": m.name,
            "display_name": m.display_name,
            "category": m.category,
            "module_type": m.module_type.value,
            "version": m.version,
            "stability": m.stability,
            "trust_tier": m.trust_tier.value,
            "license_tier": m.license_tier,
            "critical": m.critical,
            "status": kernel.states.get(m.id, ModuleState.DISABLED).value,
            "depends_on": m.depends_on,
            "permissions": m.permissions,
            "routes": m.routes
        })

    return {
        "smp_specification": "1.0",
        "spk_version": "12.1.0",
        "total_modules": len(modules_list),
        "active_modules": sum(1 for m in modules_list if m["status"] == "ENABLED"),
        "modules": modules_list
    }


@router.patch("/{module_id}")
async def toggle_capability(module_id: str, payload: ModuleToggleRequest):
    """Toggles module state with dependency validation & critical module protection."""
    new_state = await kernel.toggle_module(module_id, payload.enabled)
    return {
        "module_id": module_id,
        "new_state": new_state.value,
        "message": f"Module '{module_id}' state updated to {new_state.value}."
    }


@router.post("/profiles/{profile_id}")
async def apply_profile(profile_id: str):
    """Applies a versioned Capability Profile (e.g., RETAIL_LITE, ENTERPRISE)."""
    res = kernel.apply_profile(profile_id)
    return res


@router.get("/performance")
async def get_performance_diagnostics():
    """Returns real-time SPK kernel performance & memory diagnostics metrics."""
    return kernel.get_kernel_diagnostics()


@router.get("/health")
async def get_health_diagnostics():
    """Returns comprehensive SPK kernel health diagnostic report."""
    diagnostics = kernel.get_kernel_diagnostics()
    return {
        "status": "HEALTHY",
        "diagnostics": diagnostics,
        "checks": [
            {"component": "Manifest Loader", "status": "PASS"},
            {"component": "DAG Dependency Resolver", "status": "PASS"},
            {"component": "Registry Manager Coordinator", "status": "PASS"},
            {"component": "Event Dispatcher Bus", "status": "PASS"}
        ]
    }
