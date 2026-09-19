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

import asyncio
from abc import ABC, abstractmethod
from typing import Callable, Awaitable, Dict, List, Set
import fnmatch
import logging

logger = logging.getLogger("smriti.platform.events.transport")


class IEventTransport(ABC):
    """
    Abstract transport boundary isolating SMRITI Platform Kernel from physical brokers.
    Physical transports (NATS, Kafka, RabbitMQ, Redis, AWS SQS) implement this contract.
    """

    @abstractmethod
    async def start(self) -> None:
        """Initialize transport connection or runtime resources."""
        pass

    @abstractmethod
    async def stop(self) -> None:
        """Gracefully drain and close transport connections."""
        pass

    @abstractmethod
    async def publish(self, topic: str, envelope_bytes: bytes) -> None:
        """Publish raw serialized envelope bytes to a specific topic."""
        pass

    @abstractmethod
    async def subscribe(
        self, topic_pattern: str, handler: Callable[[bytes], Awaitable[None]]
    ) -> None:
        """Register a handler for a topic or wildcard pattern (e.g. 'billing.*')."""
        pass


class MemoryTransport(IEventTransport):
    """
    High-performance in-memory event transport for local execution, unit testing,
    and single-node container deployments. Does NOT depend on any external service.
    """

    def __init__(self):
        self._subscriptions: Dict[str, List[Callable[[bytes], Awaitable[None]]]] = {}
        self._running = False
        self._lock = asyncio.Lock()
        self._published_history: List[tuple[str, bytes]] = []

    async def start(self) -> None:
        self._running = True

    async def stop(self) -> None:
        self._running = False
        self._subscriptions.clear()

    async def publish(self, topic: str, envelope_bytes: bytes) -> None:
        if not self._running:
            raise RuntimeError("Cannot publish to MemoryTransport while it is stopped.")

        self._published_history.append((topic, envelope_bytes))

        # Deliver to matching subscriptions concurrently
        matching_handlers: List[Callable[[bytes], Awaitable[None]]] = []
        async with self._lock:
            for pattern, handlers in self._subscriptions.items():
                if pattern == topic or fnmatch.fnmatch(topic, pattern):
                    matching_handlers.extend(handlers)

        if matching_handlers:
            tasks = [asyncio.create_task(h(envelope_bytes)) for h in matching_handlers]
            await asyncio.gather(*tasks, return_exceptions=True)

    async def subscribe(
        self, topic_pattern: str, handler: Callable[[bytes], Awaitable[None]]
    ) -> None:
        async with self._lock:
            if topic_pattern not in self._subscriptions:
                self._subscriptions[topic_pattern] = []
            self._subscriptions[topic_pattern].append(handler)

    @property
    def published_count(self) -> int:
        return len(self._published_history)
