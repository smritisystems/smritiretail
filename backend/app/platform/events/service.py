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

from typing import Optional, Any
from .transport import IEventTransport, MemoryTransport
from .registry import EventRegistry
from .idempotency import IIdempotencyStore, MemoryIdempotencyStore
from .policies import RetryPolicy, DeadLetterPolicy
from .serializer import EventSerializer
from .publisher import EventPublisher
from .subscriber import EventSubscriber, EventHandler
from .envelope import EventEnvelope
from .outbox import IEventOutbox


class PlatformEventService:
    """
    SMRITI Stage 4 Platform Event Service.
    Acts as the single unified kernel facade for contract-first asynchronous event publishing,
    subscription, idempotency enforcement, and transport abstraction.
    """

    def __init__(
        self,
        transport: IEventTransport,
        registry: EventRegistry,
        idempotency_store: IIdempotencyStore,
        retry_policy: Optional[RetryPolicy] = None,
        dead_letter_policy: Optional[DeadLetterPolicy] = None,
        serializer: Optional[EventSerializer] = None,
        outbox: Optional[IEventOutbox] = None,
    ):
        self.transport = transport
        self.registry = registry
        self.idempotency = idempotency_store
        self.retry_policy = retry_policy or RetryPolicy()
        self.dead_letter = dead_letter_policy or DeadLetterPolicy()
        self.serializer = serializer or EventSerializer()
        self.outbox = outbox

        self.publisher = EventPublisher(
            transport=self.transport,
            registry=self.registry,
            serializer=self.serializer,
        )
        self.subscriber = EventSubscriber(
            transport=self.transport,
            idempotency_store=self.idempotency,
            retry_policy=self.retry_policy,
            dead_letter_policy=self.dead_letter,
            serializer=self.serializer,
        )

    @classmethod
    def create_in_memory(
        cls,
        registry: Optional[EventRegistry] = None,
        retry_policy: Optional[RetryPolicy] = None,
    ) -> "PlatformEventService":
        """Factory creating a fully operational in-memory Platform Event Service."""
        return cls(
            transport=MemoryTransport(),
            registry=registry or EventRegistry(),
            idempotency_store=MemoryIdempotencyStore(),
            retry_policy=retry_policy or RetryPolicy(),
            dead_letter_policy=DeadLetterPolicy(),
            serializer=EventSerializer(),
        )

    async def start(self) -> None:
        await self.transport.start()

    async def stop(self) -> None:
        await self.transport.stop()

    async def publish(self, envelope: EventEnvelope[Any]) -> None:
        await self.publisher.publish(envelope)

    async def subscribe(
        self,
        topic_pattern: str,
        consumer_id: str,
        handler: EventHandler,
        tenant_filter: Optional[str] = None,
    ) -> None:
        await self.subscriber.subscribe(
            topic_pattern=topic_pattern,
            consumer_id=consumer_id,
            handler=handler,
            tenant_filter=tenant_filter,
        )
