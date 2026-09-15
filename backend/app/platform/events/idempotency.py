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

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
import asyncio


class IdempotencyRecord(BaseModel):
    event_id: str
    consumer_id: str
    status: str = Field(default="COMPLETED")  # PROCESSING | COMPLETED | FAILED
    processed_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    result_payload: Optional[Any] = None


class IIdempotencyStore(ABC):
    """
    Contractual Platform Interface for Consumer Idempotency.
    Guarantees exactly-once processing semantics across distributed retries and at-least-once deliveries.
    """

    @abstractmethod
    async def is_duplicate(self, event_id: str, consumer_id: str) -> bool:
        """Check if an event has already been executed by this consumer."""
        pass

    @abstractmethod
    async def record_execution(
        self, event_id: str, consumer_id: str, result_payload: Optional[Any] = None
    ) -> None:
        """Record successful execution of an event by a specific consumer."""
        pass


class MemoryIdempotencyStore(IIdempotencyStore):
    """In-memory idempotency ledger for unit tests and single-node instances."""

    def __init__(self):
        self._records: Dict[str, IdempotencyRecord] = {}
        self._lock = asyncio.Lock()

    def _key(self, event_id: str, consumer_id: str) -> str:
        return f"{consumer_id}::{event_id}"

    async def is_duplicate(self, event_id: str, consumer_id: str) -> bool:
        async with self._lock:
            key = self._key(event_id, consumer_id)
            return key in self._records

    async def record_execution(
        self, event_id: str, consumer_id: str, result_payload: Optional[Any] = None
    ) -> None:
        async with self._lock:
            key = self._key(event_id, consumer_id)
            self._records[key] = IdempotencyRecord(
                event_id=event_id,
                consumer_id=consumer_id,
                status="COMPLETED",
                result_payload=result_payload,
            )

    @property
    def total_records(self) -> int:
        return len(self._records)
