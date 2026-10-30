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

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
import math


class RetryPolicy(BaseModel):
    """Configurable exponential backoff and retry policy for event handlers."""
    max_retries: int = Field(default=3, ge=0)
    initial_delay_ms: int = Field(default=50, ge=1)
    backoff_multiplier: float = Field(default=2.0, ge=1.0)
    max_delay_ms: int = Field(default=2000, ge=10)

    def calculate_delay_seconds(self, attempt: int) -> float:
        """Calculate backoff delay in seconds for a given attempt index (0-indexed)."""
        delay_ms = self.initial_delay_ms * math.pow(self.backoff_multiplier, attempt)
        capped_ms = min(delay_ms, self.max_delay_ms)
        return capped_ms / 1000.0


class DeadLetterEntry(BaseModel):
    """Captured dead-letter record when handler retries are exhausted."""
    id: str
    event_id: str
    consumer_id: str
    topic: str
    payload: Dict[str, Any]
    error_message: str
    failed_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    attempts_made: int


class DeadLetterPolicy:
    """Manages routing and in-memory retention of failed event envelopes."""

    def __init__(self, dead_letter_topic: str = "platform.dead_letter"):
        self.dead_letter_topic = dead_letter_topic
        self.dead_letter_log: List[DeadLetterEntry] = []

    def capture(
        self,
        event_id: str,
        consumer_id: str,
        topic: str,
        payload: Dict[str, Any],
        error: str,
        attempts: int,
    ) -> DeadLetterEntry:
        import uuid
        entry = DeadLetterEntry(
            id=f"dlq-{uuid.uuid4().hex[:12]}",
            event_id=event_id,
            consumer_id=consumer_id,
            topic=topic,
            payload=payload,
            error_message=error,
            attempts_made=attempts,
        )
        self.dead_letter_log.append(entry)
        return entry

    @property
    def total_failures(self) -> int:
        return len(self.dead_letter_log)
