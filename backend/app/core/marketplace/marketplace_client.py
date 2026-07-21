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
Classification: Remote Marketplace Client Communication Gateway
"""

import logging
from typing import Dict, Any, List
from app.core.marketplace.catalog_service import CatalogService

logger = logging.getLogger("smriti.marketplace.client")


class MarketplaceClient:
    """Remote Marketplace Communication Gateway."""

    def __init__(self, catalog_service: CatalogService):
        self.catalog_service = catalog_service

    async def list_available_extensions(self, channel: str = "Stable") -> List[Dict[str, Any]]:
        """Queries registered repository providers for available extension packages."""
        return await self.catalog_service.get_aggregated_catalog(channel=channel)

    async def get_extension_details(self, module_id: str) -> Dict[str, Any]:
        """Queries metadata details for a given module ID."""
        pkg = await self.catalog_service.find_package(module_id)
        if not pkg:
            raise ValueError(f"Extension module '{module_id}' not found in registered repositories")
        return pkg
