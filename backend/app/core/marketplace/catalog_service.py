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
Classification: Marketplace Feed & Catalog Service
"""

import logging
from typing import Dict, Any, List, Optional
from app.core.marketplace.providers.base_provider import BaseRepositoryProvider
from app.core.marketplace.providers.official_provider import OfficialMarketplaceProvider

logger = logging.getLogger("smriti.marketplace.catalog")


class CatalogService:
    """Catalog Service: Coordinates repositories, feeds, and channels (Stable, LTS, Beta, etc.)."""

    def __init__(self):
        self.providers: Dict[str, BaseRepositoryProvider] = {}
        # Register default official provider
        off = OfficialMarketplaceProvider()
        self.providers[off.repository_id] = off

    def register_provider(self, provider: BaseRepositoryProvider) -> None:
        """Registers a new repository provider (e.g. Enterprise, Filesystem, USB)."""
        self.providers[provider.repository_id] = provider
        logger.info("[CatalogService] Registered provider '%s' (%s).", provider.name, provider.repository_id)

    async def get_aggregated_catalog(self, channel: str = "Stable") -> List[Dict[str, Any]]:
        """Aggregates catalog entries across all registered repository providers."""
        aggregated = []
        for repo_id, provider in self.providers.items():
            try:
                entries = await provider.fetch_catalog(channel=channel)
                for entry in entries:
                    entry["repository_id"] = repo_id
                    aggregated.append(entry)
            except Exception as e:
                logger.error("[CatalogService] Failed to fetch catalog from %s: %s", repo_id, e)
        return aggregated

    async def find_package(self, module_id: str) -> Optional[Dict[str, Any]]:
        """Searches across providers for a specific module ID."""
        for provider in self.providers.values():
            meta = await provider.get_package_metadata(module_id)
            if meta:
                return meta
        return None
