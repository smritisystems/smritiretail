"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from pathlib import Path
from typing import Any

import yaml

from app.compliance.exceptions import ConnectorLoadException, ManifestValidationException


class ConnectorRegistry:
    """
    Registry for dynamic compliance connectors. Handles discovery, validation,
    and lookup of manifest definitions.
    """

    def __init__(self) -> None:
        self._connectors: dict[str, dict[str, Any]] = {}

    def validate_manifest(self, manifest: dict[str, Any]) -> None:
        """
        Validates the structure and data types of a connector manifest.
        Raises ManifestValidationException if schema validation fails.
        """
        required_fields = ["id", "name", "version", "provider", "api_version", "status", "environments", "capabilities"]
        for field in required_fields:
            if field not in manifest:
                raise ManifestValidationException(f"Missing required manifest field: '{field}'")

        if not isinstance(manifest["id"], str) or not manifest["id"].strip():
            raise ManifestValidationException("Field 'id' must be a non-empty string.")

        if not isinstance(manifest["name"], str) or not manifest["name"].strip():
            raise ManifestValidationException("Field 'name' must be a non-empty string.")

        if not isinstance(manifest["version"], str):
            raise ManifestValidationException("Field 'version' must be a string.")

        if not isinstance(manifest["provider"], str):
            raise ManifestValidationException("Field 'provider' must be a string.")

        if not isinstance(manifest["api_version"], str):
            raise ManifestValidationException("Field 'api_version' must be a string.")

        if not isinstance(manifest["status"], str):
            raise ManifestValidationException("Field 'status' must be a string.")

        if not isinstance(manifest["environments"], dict):
            raise ManifestValidationException("Field 'environments' must be a dictionary.")

        for env_name, env_config in manifest["environments"].items():
            if not isinstance(env_config, dict) or "enabled" not in env_config:
                raise ManifestValidationException(
                    f"Environment '{env_name}' configuration must include 'enabled' boolean."
                )
            if not isinstance(env_config["enabled"], bool):
                raise ManifestValidationException(f"Environment '{env_name}.enabled' must be a boolean.")

        if not isinstance(manifest["capabilities"], list):
            raise ManifestValidationException("Field 'capabilities' must be a list.")

        for cap in manifest["capabilities"]:
            if not isinstance(cap, str):
                raise ManifestValidationException("Capabilities list must contain strings only.")

    def load_manifest(self, file_path: Path) -> dict[str, Any]:
        """
        Loads and parses a single manifest YAML file.
        """
        if not file_path.exists():
            raise ConnectorLoadException(f"Manifest file not found: {file_path}")
        try:
            with open(file_path, encoding="utf-8") as f:
                manifest = yaml.safe_load(f)
            if not isinstance(manifest, dict):
                raise ManifestValidationException("Manifest root must be a dictionary.")
            self.validate_manifest(manifest)
            return manifest
        except yaml.YAMLError as e:
            raise ManifestValidationException(f"Failed to parse manifest YAML: {e}") from e
        except ManifestValidationException:
            raise
        except Exception as e:
            raise ConnectorLoadException(f"Error loading manifest: {e}") from e

    def discover_connectors(self, base_dir: Path) -> None:
        """
        Discovers all manifests recursively under a given directory.
        Detects duplicate connector IDs.
        """
        self._connectors.clear()
        if not base_dir.exists() or not base_dir.is_dir():
            return

        # Look for manifest variations in all directories recursively
        for path in base_dir.rglob("*manifest*.y*ml"):
            try:
                manifest = self.load_manifest(path)
                connector_id = manifest["id"]
                if connector_id in self._connectors:
                    raise ConnectorLoadException(f"Duplicate connector ID detected in registry: '{connector_id}'")
                self._connectors[connector_id] = manifest
            except (ManifestValidationException, ConnectorLoadException):
                raise
            except Exception as e:
                raise ConnectorLoadException(f"Failed to discover connector at {path}: {e}") from e

    def get_manifest(self, connector_id: str) -> dict[str, Any] | None:
        """
        Retrieves a registered connector's manifest.
        """
        return self._connectors.get(connector_id)

    def list_manifests(self) -> list[dict[str, Any]]:
        """
        Returns a list of all registered connector manifests.
        """
        return list(self._connectors.values())
