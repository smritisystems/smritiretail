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
from typing import Callable, Awaitable, Dict, Any, Optional
import logging
from .envelope import EventEnvelope
from .transport import IEventTransport
from .serializer import EventSerializer
from .idempotency import IIdempotencyStore
from .policies import RetryPolicy, DeadLetterPolicy

logger = logging.getLogger("smriti.platform.events.subscriber")

EventHandler = Callable[[EventEnvelope[Dict[str, Any]]], Awaitable[None]]


class EventSubscriber:
    """
    Contract-First Event Subscriber for Stage 4 Platform Event Service.
    Enforces contractual idempotency, tenant isolation filtering, exponential backoff retries,
    and dead-letter routing.
    """

    def __init__(
        self,
        transport: IEventTransport,
        idempotency_store: IIdempotencyStore,
        retry_policy: Optional[RetryPolicy] = None,
        dead_letter_policy: Optional[DeadLetterPolicy] = None,
        serializer: Optional[EventSerializer] = None,
    ):
        self._transport = transport
        self._idempotency = idempotency_store
        self._retry_policy = retry_policy or RetryPolicy()
        self._dead_letter = dead_letter_policy or DeadLetterPolicy()
        self._serializer = serializer or EventSerializer()

    async def subscribe(
        self,
        topic_pattern: str,
        consumer_id: str,
        handler: EventHandler,
        tenant_filter: Optional[str] = None,
    ) -> None:
        """
        Subscribe a consumer handler to a topic pattern with idempotency and isolation.
        If tenant_filter is provided, envelopes with different tenantId are skipped.
        """

        async def raw_message_handler(raw_bytes: bytes) -> None:
            envelope = self._serializer.deserialize(raw_bytes)

            # Tenant isolation check
            if tenant_filter and tenant_filter != "*" and envelope.tenantId != tenant_filter:
                logger.debug(
                    f"Skipping event {envelope.id} for consumer {consumer_id} due to tenant mismatch: "
                    f"{envelope.tenantId} != {tenant_filter}"
                )
                return

            # Contractual Idempotency check
            is_dup = await self._idempotency.is_duplicate(envelope.id, consumer_id)
            if is_dup:
                logger.info(
                    f"Idempotency Guard: Event {envelope.id} already executed by consumer {consumer_id}. Ignoring duplicate."
                )
                return

            # Execution with Retry Policy
            attempts = 0
            last_error = ""
            while attempts <= self._retry_policy.max_retries:
                try:
                    await handler(envelope)
                    # Record successful idempotent completion
                    await self._idempotency.record_execution(envelope.id, consumer_id)
                    return
                except Exception as e:
                    attempts += 1
                    last_error = str(e)
                    logger.warning(
                        f"Handler {consumer_id} failed attempt {attempts}/{self._retry_policy.max_retries + 1} "
                        f"for event {envelope.id}: {e}"
                    )
                    if attempts <= self._retry_policy.max_retries:
                        delay = self._retry_policy.calculate_delay_seconds(attempts - 1)
                        await asyncio.sleep(delay)

            # If all retries exhausted, capture to Dead Letter Policy
            logger.error(
                f"Handler {consumer_id} exhausted all retries for event {envelope.id}. Routing to dead letter."
            )
            self._dead_letter.capture(
                event_id=envelope.id,
                consumer_id=consumer_id,
                topic=envelope.eventType,
                payload=envelope.payload if isinstance(envelope.payload, dict) else {},
                error=last_error,
                attempts=attempts,
            )

        await self._transport.subscribe(topic_pattern, raw_message_handler)
