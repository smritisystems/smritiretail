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
Classification: Platform TestKit — Stage 4 Verification
"""

import asyncio
import pytest
from typing import Dict, Any

from app.platform.events import (
    EventEnvelope,
    IEventTransport,
    MemoryTransport,
    EventRegistry,
    IIdempotencyStore,
    MemoryIdempotencyStore,
    RetryPolicy,
    DeadLetterPolicy,
    EventSerializer,
    EventPublisher,
    EventSubscriber,
    IEventOutbox,
    PlatformEventService,
)


@pytest.mark.asyncio
async def test_envelope_immutability_and_schema_version():
    """Criterion 1 & 2: EventEnvelope is frozen and includes schemaVersion and actorId."""
    envelope = EventEnvelope[Dict[str, Any]](
        eventType="billing.invoice.issued",
        version="1.0.0",
        schemaVersion="2.1",
        source="smriti.billing.service",
        tenantId="smriti001",
        correlationId="corr-12345",
        causationId="cmd-98765",
        actorId="usr-admin-01",
        payload={"invoice_no": "INV-2026-001", "total_amount": 1500.0},
        metadata={"channel": "POS"},
    )

    assert envelope.schemaVersion == "2.1"
    assert envelope.actorId == "usr-admin-01"
    assert envelope.correlationId == "corr-12345"
    assert envelope.causationId == "cmd-98765"

    # Verify frozen immutability
    with pytest.raises(Exception):
        envelope.eventType = "billing.invoice.cancelled"


@pytest.mark.asyncio
async def test_registry_contract_validation():
    """Criterion 3, 4, 5: EventRegistry validates types, schema versions, and rejects unregistered types."""
    registry = EventRegistry()
    registry.register(
        event_type="billing.invoice.issued",
        supported_schema_versions={"1.0", "2.0"},
        description="Emitted when tax invoice is finalized",
    )

    assert registry.is_registered("billing.invoice.issued") is True
    assert registry.is_compatible("billing.invoice.issued", "1.0") is True
    assert registry.is_compatible("billing.invoice.issued", "2.0") is True
    assert registry.is_compatible("billing.invoice.issued", "3.0") is False
    assert registry.is_registered("unknown.event") is False


@pytest.mark.asyncio
async def test_serializer_roundtrip():
    """Criterion 9: EventSerializer serializes to JSON bytes and reconstructs typed envelope."""
    envelope = EventEnvelope[Dict[str, Any]](
        eventType="inventory.stock.depleted",
        version="1.0.0",
        schemaVersion="1.0",
        source="smriti.inventory.service",
        tenantId="smriti001",
        actorId="system",
        payload={"item_id": "itm-001", "quantity": 5},
    )

    raw_bytes = EventSerializer.serialize(envelope)
    assert isinstance(raw_bytes, bytes)

    reconstructed = EventSerializer.deserialize(raw_bytes)
    assert reconstructed.id == envelope.id
    assert reconstructed.eventType == envelope.eventType
    assert reconstructed.schemaVersion == "1.0"
    assert reconstructed.payload["item_id"] == "itm-001"


@pytest.mark.asyncio
async def test_publisher_rejects_unregistered_event():
    """Criterion 4: Publisher prevents publishing of unregistered events."""
    transport = MemoryTransport()
    await transport.start()
    registry = EventRegistry()  # empty
    publisher = EventPublisher(transport, registry)

    envelope = EventEnvelope[Dict[str, Any]](
        eventType="unregistered.type",
        source="test",
        tenantId="smriti001",
        payload={"data": "test"},
    )

    with pytest.raises(ValueError, match="Unregistered event type"):
        await publisher.publish(envelope)

    await transport.stop()


@pytest.mark.asyncio
async def test_idempotency_duplicate_prevention():
    """Criterion 10: Contractual Idempotency prevents multiple executions of identical event."""
    transport = MemoryTransport()
    await transport.start()

    registry = EventRegistry()
    registry.register("order.created", {"1.0"}, "Order placed")

    idempotency = MemoryIdempotencyStore()
    subscriber = EventSubscriber(transport, idempotency_store=idempotency)
    publisher = EventPublisher(transport, registry)

    execution_count = 0

    async def order_handler(env: EventEnvelope[Dict[str, Any]]):
        nonlocal execution_count
        execution_count += 1

    await subscriber.subscribe(
        topic_pattern="order.created",
        consumer_id="consumer-order-processor",
        handler=order_handler,
    )

    envelope = EventEnvelope[Dict[str, Any]](
        id="evt-fixed-id-001",
        eventType="order.created",
        schemaVersion="1.0",
        source="pos.checkout",
        tenantId="smriti001",
        payload={"order_id": "ORD-101"},
    )

    # Publish the exact same event 3 times
    await publisher.publish(envelope)
    await publisher.publish(envelope)
    await publisher.publish(envelope)

    # Handler must be invoked EXACTLY once
    assert execution_count == 1
    assert await idempotency.is_duplicate("evt-fixed-id-001", "consumer-order-processor") is True

    await transport.stop()


@pytest.mark.asyncio
async def test_tenant_isolation_filtering():
    """Criterion 11: Tenant filtering ensures handlers only receive events for their tenant."""
    transport = MemoryTransport()
    await transport.start()

    registry = EventRegistry()
    registry.register("customer.created", {"1.0"}, "New customer registered")

    subscriber = EventSubscriber(transport, MemoryIdempotencyStore())
    publisher = EventPublisher(transport, registry)

    tenant_001_received = []
    tenant_002_received = []

    async def handler_001(env: EventEnvelope[Dict[str, Any]]):
        tenant_001_received.append(env.id)

    async def handler_002(env: EventEnvelope[Dict[str, Any]]):
        tenant_002_received.append(env.id)

    await subscriber.subscribe("customer.created", "cons-001", handler_001, tenant_filter="smriti001")
    await subscriber.subscribe("customer.created", "cons-002", handler_002, tenant_filter="smriti002")

    # Publish event for tenant smriti001
    env1 = EventEnvelope[Dict[str, Any]](
        eventType="customer.created",
        schemaVersion="1.0",
        source="crm",
        tenantId="smriti001",
        payload={"name": "Alice"},
    )
    await publisher.publish(env1)

    assert len(tenant_001_received) == 1
    assert len(tenant_002_received) == 0

    await transport.stop()


@pytest.mark.asyncio
async def test_retry_policy_and_dead_letter_routing():
    """Criterion 14 & 15: Transient failures retry and route to DeadLetterPolicy on exhaustion."""
    transport = MemoryTransport()
    await transport.start()

    registry = EventRegistry()
    registry.register("payment.processed", {"1.0"}, "Payment settlement")

    retry_policy = RetryPolicy(max_retries=2, initial_delay_ms=10, backoff_multiplier=1.5)
    dead_letter = DeadLetterPolicy()
    subscriber = EventSubscriber(
        transport=transport,
        idempotency_store=MemoryIdempotencyStore(),
        retry_policy=retry_policy,
        dead_letter_policy=dead_letter,
    )
    publisher = EventPublisher(transport, registry)

    attempts_witnessed = 0

    async def failing_handler(env: EventEnvelope[Dict[str, Any]]):
        nonlocal attempts_witnessed
        attempts_witnessed += 1
        raise ConnectionResetError("Simulated third-party payment gateway timeout")

    await subscriber.subscribe("payment.processed", "cons-payment-sync", failing_handler)

    env = EventEnvelope[Dict[str, Any]](
        eventType="payment.processed",
        schemaVersion="1.0",
        source="pos",
        tenantId="smriti001",
        payload={"amount": 500},
    )

    await publisher.publish(env)

    # Initial attempt + 2 retries = 3 attempts total
    assert attempts_witnessed == 3
    # Routed to dead letter
    assert dead_letter.total_failures == 1
    dlq_entry = dead_letter.dead_letter_log[0]
    assert dlq_entry.event_id == env.id
    assert dlq_entry.consumer_id == "cons-payment-sync"
    assert "payment gateway timeout" in dlq_entry.error_message
    assert dlq_entry.attempts_made == 3

    await transport.stop()


@pytest.mark.asyncio
async def test_platform_event_service_end_to_end_facade():
    """Criterion 16: PlatformEventService provides unified facade for start/stop/publish/subscribe."""
    registry = EventRegistry()
    registry.register("sales.dispatch.completed", {"1.0"}, "Goods dispatched to store")

    service = PlatformEventService.create_in_memory(registry=registry)
    await service.start()

    received = []

    async def dispatch_listener(env: EventEnvelope[Dict[str, Any]]):
        received.append(env.payload["dispatch_id"])

    await service.subscribe("sales.dispatch.*", "cons-dispatch", dispatch_listener)

    env = EventEnvelope[Dict[str, Any]](
        eventType="sales.dispatch.completed",
        schemaVersion="1.0",
        source="warehouse.dispatch",
        tenantId="smriti001",
        correlationId="corr-dispatch-999",
        actorId="usr-dispatcher-1",
        payload={"dispatch_id": "DSP-2026-888", "stores_count": 16},
    )

    await service.publish(env)

    assert len(received) == 1
    assert received[0] == "DSP-2026-888"

    await service.stop()


def test_outbox_interface_contract():
    """Criterion 17: IEventOutbox boundary interface is cleanly declared without distributed dependencies."""
    class DummyOutbox(IEventOutbox):
        async def stage(self, envelope, db_session):
            return "outbox-001"

        async def fetch_pending(self, limit: int = 100):
            return []

        async def mark_dispatched(self, outbox_id: str):
            pass

        async def mark_failed(self, outbox_id: str, error_message: str):
            pass

    outbox = DummyOutbox()
    assert isinstance(outbox, IEventOutbox)
