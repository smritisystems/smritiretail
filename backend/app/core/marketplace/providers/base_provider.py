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
Classification: Abstract Repository Provider Interface
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional


class BaseRepositoryProvider(ABC):
    """Abstract Base Class for Marketplace Repository Providers."""

    def __init__(self, repository_id: str, name: str, provider_type: str):
        self.repository_id = repository_id
        self.name = name
        self.provider_type = provider_type

    @abstractmethod
    async def fetch_catalog(self, channel: str = "Stable") -> List[Dict[str, Any]]:
        """Fetches available package catalog entries for a given release channel."""
        pass

    @abstractmethod
    async def get_package_metadata(self, module_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves metadata for a specific module package."""
        pass

    @abstractmethod
    async def download_package(self, module_id: str, version: str, destination_path: str) -> str:
        """Downloads/fetches the .smx distribution package file."""
        pass
