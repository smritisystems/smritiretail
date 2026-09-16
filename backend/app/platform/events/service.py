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

import os
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

    async def stage_event(self, envelope: EventEnvelope[Any], db_session: Any) -> str:
        """
        Stage an event atomically in the configured outbox table within the caller's db_session.
        Validates schema registration and compatibility prior to staging.
        Raises RuntimeError if no outbox is configured.
        """
        if not self.outbox:
            raise RuntimeError("Cannot stage event: No IEventOutbox configured on PlatformEventService")
        self.registry.validate(envelope.eventType, envelope.schemaVersion)
        return await self.outbox.stage(envelope, db_session)


_default_platform_event_service: Optional[PlatformEventService] = None


def set_platform_event_service(service: Optional[PlatformEventService]) -> None:
    """Explicitly injects or overrides the canonical PlatformEventService singleton (useful for testing)."""
    global _default_platform_event_service
    _default_platform_event_service = service


def reset_platform_event_service() -> None:
    """Resets the canonical PlatformEventService singleton to None."""
    global _default_platform_event_service
    _default_platform_event_service = None


def get_platform_event_service() -> PlatformEventService:
    """
    Returns the canonical PlatformEventService singleton for domain writer event staging.
    Configured with standard schema registrations and PostgresEventOutbox.
    Supports environment-driven distributed transport (EVENT_TRANSPORT="redis")
    with seamless local development/test fallback to MemoryTransport.
    """
    global _default_platform_event_service
    if _default_platform_event_service is None:
        from .postgres_outbox import PostgresEventOutbox

        registry = EventRegistry()
        registry.register("sales.invoice.confirmed", {"1.0"}, "Canonical Sales Invoice Confirmed")
        registry.register("SALES_INVOICE_CONFIRMED", {"1.0"}, "Canonical Sales Invoice Confirmed (Legacy Alias)")
        registry.register("sales.invoice.cancelled", {"1.0"}, "Canonical Sales Invoice Cancelled")
        registry.register("SALES_INVOICE_CANCELLED", {"1.0"}, "Canonical Sales Invoice Cancelled (Legacy Alias)")
        registry.register("pos.bill.created", {"1.0"}, "POS Bill Created")
        registry.register("wms.goods.receipt", {"1.0"}, "WMS Goods Receipt Note")
        registry.register("payment.received", {"1.0"}, "Payment Settle Received")

        transport_type = os.getenv("EVENT_TRANSPORT", "memory").lower().strip()
        redis_url = os.getenv("REDIS_URL")

        if transport_type == "redis" or (transport_type == "auto" and redis_url):
            from .redis_transport import RedisStreamTransport, RedisIdempotencyStore
            target_redis_url = redis_url or "redis://localhost:6379/0"
            transport = RedisStreamTransport(redis_url=target_redis_url)
            idempotency_store = RedisIdempotencyStore(redis_url=target_redis_url)
        else:
            transport = MemoryTransport()
            idempotency_store = MemoryIdempotencyStore()

        _default_platform_event_service = PlatformEventService(
            transport=transport,
            registry=registry,
            idempotency_store=idempotency_store,
            retry_policy=RetryPolicy(),
            dead_letter_policy=DeadLetterPolicy(),
            serializer=EventSerializer(),
            outbox=PostgresEventOutbox(),
        )
    return _default_platform_event_service


