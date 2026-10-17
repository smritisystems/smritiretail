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

import json
from typing import Any, Dict
from .envelope import EventEnvelope


class EventSerializer:
    """
    Standard serializer/deserializer for Stage 4 Platform Event Envelopes.
    Converts between typed EventEnvelope instances and UTF-8 encoded JSON bytes.
    """

    @staticmethod
    def serialize(envelope: EventEnvelope[Any]) -> bytes:
        """Serialize an EventEnvelope into compact JSON bytes."""
        payload_dict = EventSerializer.to_dict(envelope)
        return json.dumps(payload_dict, ensure_ascii=False).encode("utf-8")

    @staticmethod
    def deserialize(raw_bytes: bytes) -> EventEnvelope[Dict[str, Any]]:
        """Deserialize raw bytes into a typed EventEnvelope containing dict payload."""
        data = json.loads(raw_bytes.decode("utf-8"))
        return EventSerializer.from_dict(data)

    @staticmethod
    def to_dict(envelope: EventEnvelope[Any]) -> Dict[str, Any]:
        """Convert an EventEnvelope into a JSON-serializable dictionary."""
        if hasattr(envelope, "model_dump"):
            payload_dict = envelope.model_dump()
        else:
            payload_dict = envelope.dict()
        return json.loads(json.dumps(payload_dict, default=str))

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> EventEnvelope[Dict[str, Any]]:
        """Reconstruct a typed EventEnvelope from a dictionary, safely handling root-level metadata."""
        known_fields = {
            "id", "eventType", "version", "schemaVersion", "source",
            "tenantId", "timestamp", "correlationId", "causationId",
            "actorId", "payload", "metadata"
        }
        filtered = {k: v for k, v in data.items() if k in known_fields}
        if "payload" not in filtered:
            filtered["payload"] = {k: v for k, v in data.items() if k not in known_fields}
        return EventEnvelope[Dict[str, Any]](**filtered)

