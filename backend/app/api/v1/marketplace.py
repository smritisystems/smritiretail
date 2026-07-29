"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 14.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Marketplace REST API Gateway Router
"""

from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Query, Body

from app.core.marketplace.catalog_service import CatalogService
from app.core.marketplace.marketplace_client import MarketplaceClient
from app.core.marketplace.package_manager import PackageManager
from app.core.marketplace.smriti_cli import SmritiCLI

router = APIRouter(prefix="/marketplace", tags=["SMP Marketplace Ecosystem"])

catalog_service = CatalogService()
client = MarketplaceClient(catalog_service)
package_manager = PackageManager()


@router.get("/catalog", response_model=List[Dict[str, Any]])
async def get_marketplace_catalog(channel: str = Query("Stable", description="Release channel track")):
    """Retrieves aggregated Marketplace catalog entries across providers."""
    return await client.list_available_extensions(channel=channel)


@router.get("/channels")
async def get_release_channels():
    """Returns available distribution channels."""
    return SmritiCLI.run_command("channels", {})


@router.get("/doctor")
async def get_developer_doctor():
    """Runs developer & system environment diagnostic checks."""
    return SmritiCLI.run_command("doctor", {})


@router.post("/install")
async def install_extension_package(smx_path: str = Body(..., embed=True)):
    """Installs a distributable .smx extension package with atomic rollback protection."""
    success, msg = await package_manager.install_package(smx_path)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"success": True, "message": msg}


@router.post("/rollback/{module_id}")
async def rollback_extension_module(module_id: str):
    """Rolls back a module to its previous state."""
    ok = await package_manager.rollback_package(module_id)
    if not ok:
        raise HTTPException(status_code=400, detail=f"Failed to rollback module '{module_id}'")
    return {"success": True, "message": f"Module '{module_id}' successfully rolled back"}
