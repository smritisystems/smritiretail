"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.26.0
Created      : 2026-09-16
Modified     : 2026-09-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Platform Kernel Contract — Stage 4
"""

from typing import Dict, Set, Optional, NamedTuple
import logging

logger = logging.getLogger("smriti.platform.events.registry")


class EventMetadata(NamedTuple):
    event_type: str
    supported_schema_versions: Set[str]
    description: str
    deprecated: bool = False


class EventRegistry:
    """
    Contract-First Event Schema Registry.
    Guarantees that only registered, version-compatible platform events are published across SMRITI.
    """

    def __init__(self):
        self._registry: Dict[str, EventMetadata] = {}

    def register(
        self,
        event_type: str,
        supported_schema_versions: Set[str],
        description: str = "",
        deprecated: bool = False,
    ) -> None:
        """Register an event type and its permitted schema versions."""
        self._registry[event_type] = EventMetadata(
            event_type=event_type,
            supported_schema_versions=supported_schema_versions,
            description=description,
            deprecated=deprecated,
        )

    def is_registered(self, event_type: str) -> bool:
        if event_type in self._registry:
            return True
        normalized = event_type.strip().lower().replace("_", ".")
        return normalized in self._registry

    def is_compatible(self, event_type: str, schema_version: str) -> bool:
        if event_type in self._registry:
            return schema_version in self._registry[event_type].supported_schema_versions
        normalized = event_type.strip().lower().replace("_", ".")
        if normalized in self._registry:
            return schema_version in self._registry[normalized].supported_schema_versions
        return False

    def validate(self, event_type: str, schema_version: str) -> None:
        """Validate that an event type is registered and compatible; raise ValueError if not."""
        if not self.is_registered(event_type):
            raise ValueError(f"Unregistered event type: {event_type}")
        if not self.is_compatible(event_type, schema_version):
            raise ValueError(
                f"Incompatible schema version {schema_version} for event type {event_type}"
            )

    def list_all(self) -> Dict[str, EventMetadata]:
        return dict(self._registry)

