"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from pathlib import Path
from typing import Any

from app.compliance.registry.registry import ConnectorRegistry


class RegistryService:
    """
    Service coordinating connector discovery, registry lookup, and status checks.
    """
    def __init__(self, registry: ConnectorRegistry | None = None) -> None:
        self.registry = registry or ConnectorRegistry()
        # Default auto-discovery path points to compliance connectors folder
        self._default_path = Path(__file__).resolve().parent.parent / "connectors"
        self.registry.discover_connectors(self._default_path)

    def discover_from_path(self, path: Path) -> None:
        """
        Triggers codebase discovery from a custom path (useful for tests).
        """
        self.registry.discover_connectors(path)

    def get_manifest(self, connector_id: str) -> dict[str, Any] | None:
        """
        Lookup a specific connector by ID.
        """
        return self.registry.get_manifest(connector_id)

    def list_manifests(self) -> list[dict[str, Any]]:
        """
        List all discovered connector manifests.
        """
        return self.registry.list_manifests()

    def get_connectors_count(self) -> int:
        """
        Returns the total number of successfully registered connectors.
        """
        return len(self.registry.list_manifests())
