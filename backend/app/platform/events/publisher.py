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

from typing import Any, Optional, Dict
import logging
from .envelope import EventEnvelope
from .transport import IEventTransport
from .registry import EventRegistry
from .serializer import EventSerializer

logger = logging.getLogger("smriti.platform.events.publisher")


class EventPublisher:
    """
    Contract-First Event Publisher for Stage 4 Platform Event Service.
    Validates schema compatibility against EventRegistry before serializing and dispatching to IEventTransport.
    """

    def __init__(
        self,
        transport: IEventTransport,
        registry: EventRegistry,
        serializer: Optional[EventSerializer] = None,
    ):
        self._transport = transport
        self._registry = registry
        self._serializer = serializer or EventSerializer()

    async def publish(self, envelope: EventEnvelope[Any]) -> None:
        """
        Validate and publish an event envelope to the platform transport.
        Raises ValueError if eventType is unregistered or schemaVersion is incompatible.
        """
        # Validate against Registry
        if not self._registry.is_registered(envelope.eventType):
            raise ValueError(f"Unregistered event type: '{envelope.eventType}'. Register it before publishing.")

        if not self._registry.is_compatible(envelope.eventType, envelope.schemaVersion):
            raise ValueError(
                f"Incompatible schema version '{envelope.schemaVersion}' for event type '{envelope.eventType}'."
            )

        # Serialize
        raw_bytes = self._serializer.serialize(envelope)

        # Topic format: <eventType>
        topic = envelope.eventType
        await self._transport.publish(topic, raw_bytes)
        logger.debug(
            f"Published event {envelope.id} [{envelope.eventType} v{envelope.version} "
            f"schema:{envelope.schemaVersion}] tenant:{envelope.tenantId}"
        )
