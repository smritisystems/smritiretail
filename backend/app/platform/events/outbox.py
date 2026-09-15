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
from typing import Any, List, Optional
from .envelope import EventEnvelope


class IEventOutbox(ABC):
    """
    Conceptual boundary contract for Transactional Outbox integration.
    Allows business operations to atomically stage an event within an active SQL transaction,
    preventing dual-write distributed state drift between DB state and event transport state.

    Stage 4 defines this interface contract. The distributed background worker implementation
    is deferred to subsequent platform milestones.
    """

    @abstractmethod
    async def stage(self, envelope: EventEnvelope[Any], db_session: Any) -> str:
        """
        Stage an event envelope atomically into the transactional outbox table
        using the caller's active database transaction/session.
        Returns the staged outbox record ID.
        """
        pass

    @abstractmethod
    async def fetch_pending(self, limit: int = 100) -> List[EventEnvelope[Any]]:
        """Fetch un-dispatched staged events awaiting transport publishing."""
        pass

    @abstractmethod
    async def mark_dispatched(self, outbox_id: str) -> None:
        """Mark a staged outbox record as successfully dispatched to transport."""
        pass

    @abstractmethod
    async def mark_failed(self, outbox_id: str, error_message: str) -> None:
        """Record an attempt failure and schedule backoff retry."""
        pass
