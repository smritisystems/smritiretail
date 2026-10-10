"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.27.1
Created      : 2026-09-16
Modified     : 2026-09-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Platform Kernel Contract — Stage 5.1 Hardened
"""

from abc import ABC, abstractmethod
from typing import Any, List, Optional, Tuple
from .envelope import EventEnvelope


class IEventOutbox(ABC):
    """
    Conceptual boundary contract for Transactional Outbox integration.
    Guarantees strict, explicit database session ownership across the entire outbox lifecycle:
    Stage -> Claim -> Settle (Dispatched / Failed) -> Replay / Abandon.
    Eliminates ambient/hidden session confusion.
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
    async def claim(
        self,
        db_session: Any,
        limit: int = 50,
        claim_timeout_seconds: int = 60,
        target_channel: Optional[str] = "PLATFORM_EVENTS",
    ) -> List[Tuple[str, EventEnvelope[Any]]]:
        """
        Atomically fetch and claim un-dispatched staged events using SELECT FOR UPDATE SKIP LOCKED.
        Returns a list of tuples (outbox_id, EventEnvelope).
        """
        pass

    @abstractmethod
    async def mark_dispatched(self, db_session: Any, outbox_id: str) -> None:
        """Mark outbox record as successfully dispatched to transport using active database session."""
        pass

    @abstractmethod
    async def mark_failed(
        self,
        db_session: Any,
        outbox_id: str,
        error_message: str,
        max_retries: int = 5,
        base_backoff_seconds: int = 2,
    ) -> None:
        """Record attempt failure, schedule exponential backoff or DEAD_LETTER using active database session."""
        pass

    @abstractmethod
    async def replay_dead_letter(self, db_session: Any, outbox_id: str) -> bool:
        """Reset a DEAD_LETTER record back to PENDING for re-processing."""
        pass

    @abstractmethod
    async def abandon_dead_letter(self, db_session: Any, outbox_id: str, reason: str) -> bool:
        """Mark a DEAD_LETTER record as ABANDONED with audit rationale."""
        pass

    # Aliases for transition and testkit compatibility
    async def fetch_pending_and_claim(
        self,
        db_session: Any,
        limit: int = 50,
        claim_timeout_seconds: int = 60,
        target_channel: Optional[str] = "PLATFORM_EVENTS",
    ) -> List[Tuple[str, EventEnvelope[Any]]]:
        return await self.claim(db_session, limit, claim_timeout_seconds, target_channel)

    async def mark_dispatched_with_session(self, db_session: Any, outbox_id: str) -> None:
        await self.mark_dispatched(db_session, outbox_id)

    async def mark_failed_with_session(
        self,
        db_session: Any,
        outbox_id: str,
        error_message: str,
        max_retries: int = 5,
        base_backoff_seconds: int = 2,
    ) -> None:
        await self.mark_failed(db_session, outbox_id, error_message, max_retries, base_backoff_seconds)
