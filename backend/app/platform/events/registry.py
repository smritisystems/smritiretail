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
        return event_type in self._registry

    def is_compatible(self, event_type: str, schema_version: str) -> bool:
        if event_type not in self._registry:
            return False
        return schema_version in self._registry[event_type].supported_schema_versions

    def get_metadata(self, event_type: str) -> Optional[EventMetadata]:
        return self._registry.get(event_type)

    def list_all(self) -> Dict[str, EventMetadata]:
        return dict(self._registry)
