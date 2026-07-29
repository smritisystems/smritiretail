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
Classification: Local Filesystem Repository Provider
"""

import json
from pathlib import Path
from typing import Dict, Any, List, Optional
from app.core.marketplace.providers.base_provider import BaseRepositoryProvider


class FilesystemRepositoryProvider(BaseRepositoryProvider):
    """Local Disk Repository Provider for Enterprise & Development."""

    def __init__(self, repo_dir: str):
        super().__init__("local_filesystem", "Local Filesystem Repository", "FILESYSTEM")
        self.repo_path = Path(repo_dir)

    async def fetch_catalog(self, channel: str = "Stable") -> List[Dict[str, Any]]:
        catalog = []
        if not self.repo_path.exists():
            return catalog

        for item in self.repo_path.iterdir():
            if item.is_dir() and (item / "module.json").exists():
                try:
                    with open(item / "module.json", "r", encoding="utf-8") as f:
                        data = json.load(f)
                        catalog.append({
                            "module_id": data.get("id"),
                            "name": data.get("name"),
                            "version": data.get("version", "1.0.0"),
                            "channel": channel,
                            "publisher": "Local Enterprise",
                            "trust_tier": data.get("trust_tier", "PRIVATE_INTERNAL"),
                            "description": data.get("display_name", "")
                        })
                except Exception:
                    pass
        return catalog

    async def get_package_metadata(self, module_id: str) -> Optional[Dict[str, Any]]:
        mod_dir = self.repo_path / module_id
        if mod_dir.exists() and (mod_dir / "module.json").exists():
            with open(mod_dir / "module.json", "r", encoding="utf-8") as f:
                return json.load(f)
        return None

    async def download_package(self, module_id: str, version: str, destination_path: str) -> str:
        return destination_path
