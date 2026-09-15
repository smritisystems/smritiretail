"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.27.0
Created      : 2026-09-16
Modified     : 2026-09-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Platform Kernel Test Suite — Stage 5
"""

import uuid
import pytest
from datetime import datetime, timezone, timedelta
from typing import Dict, Any
from sqlalchemy import select, delete

from app.db.session import get_company_sessionmaker
from app.models.outbox import IntegrationOutboxEvent
from app.platform.events import (
    EventEnvelope,
    EventRegistry,
    PlatformEventService,
    PostgresEventOutbox,
    PlatformOutboxWorker,
)


@pytest.fixture
def session_factory():
    return get_company_sessionmaker("smriti001")


@pytest.fixture(autouse=True)
async def cleanup_test_outbox(session_factory):
    """Clean up test outbox records before and after each test."""
    async with session_factory() as session:
        await session.execute(
            delete(IntegrationOutboxEvent).where(
                IntegrationOutboxEvent.source_event_id.like("evt-test-outbox-%")
            )
        )
        await session.commit()
    yield
    async with session_factory() as session:
        await session.execute(
            delete(IntegrationOutboxEvent).where(
                IntegrationOutboxEvent.source_event_id.like("evt-test-outbox-%")
            )
        )
        await session.commit()


@pytest.mark.asyncio
async def test_outbox_stage_and_rollback(session_factory):
    """Criterion 1: Atomic Rollback — staged outbox events are discarded on transaction rollback."""
    outbox = PostgresEventOutbox()
    test_id = f"evt-test-outbox-{uuid.uuid4().hex[:8]}"

    envelope = EventEnvelope[Dict[str, Any]](
        id=test_id,
        eventType="billing.invoice.issued",
        schemaVersion="1.0",
        source="billing.service",
        tenantId="smriti001",
        correlationId="corr-test-rb",
        payload={"invoice_no": "INV-TEST-RB-001", "total": "1500.00"},
    )

    async with session_factory() as session:
        outbox_id = await outbox.stage(envelope, session)
        assert outbox_id.startswith("obx_")
        # Explicit Rollback without committing
        await session.rollback()

    # Verify event is NOT in database
    async with session_factory() as session:
        stmt = select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.source_event_id == test_id)
        record = (await session.execute(stmt)).scalar_one_or_none()
        assert record is None


@pytest.mark.asyncio
async def test_outbox_stage_and_commit(session_factory):
    """Criterion 2: Atomic Commit — staged outbox event is persisted with status PENDING."""
    outbox = PostgresEventOutbox()
    test_id = f"evt-test-outbox-{uuid.uuid4().hex[:8]}"

    envelope = EventEnvelope[Dict[str, Any]](
        id=test_id,
        eventType="billing.invoice.issued",
        schemaVersion="1.0",
        source="billing.service",
        tenantId="smriti001",
        correlationId="corr-test-commit",
        causationId="caus-test-commit",
        actorId="usr-cashier-01",
        payload={"invoice_no": "INV-TEST-CM-001", "total": "2500.00"},
    )

    async with session_factory() as session:
        outbox_id = await outbox.stage(envelope, session)
        await session.commit()

    async with session_factory() as session:
        stmt = select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.source_event_id == test_id)
        record = (await session.execute(stmt)).scalar_one_or_none()
        assert record is not None
        assert record.outbox_id == outbox_id
        assert record.status == "PENDING"
        assert record.event_type == "BILLING.INVOICE.ISSUED"
        assert record.correlation_id == "corr-test-commit"
        assert record.retry_count == 0


@pytest.mark.asyncio
async def test_outbox_fetch_pending_and_claim_skip_locked(session_factory):
    """Criterion 3: Non-blocking batch claim with SELECT FOR UPDATE SKIP LOCKED."""
    outbox = PostgresEventOutbox()
    test_id_1 = f"evt-test-outbox-{uuid.uuid4().hex[:8]}"
    test_id_2 = f"evt-test-outbox-{uuid.uuid4().hex[:8]}"

    env1 = EventEnvelope(
        id=test_id_1,
        eventType="inventory.stock.depleted",
        schemaVersion="1.0",
        source="wms.service",
        tenantId="smriti001",
        correlationId="corr-batch-1",
        payload={"sku": "TSHIRT-01", "qty": 10},
    )
    env2 = EventEnvelope(
        id=test_id_2,
        eventType="inventory.stock.depleted",
        schemaVersion="1.0",
        source="wms.service",
        tenantId="smriti001",
        correlationId="corr-batch-2",
        payload={"sku": "TSHIRT-02", "qty": 20},
    )

    async with session_factory() as session:
        await outbox.stage(env1, session)
        await outbox.stage(env2, session)
        await session.commit()

    # Claim batch
    async with session_factory() as session:
        claimed = await outbox.fetch_pending_and_claim(session, limit=10)
        claimed_ids = [e.id for _, e in claimed]
        assert test_id_1 in claimed_ids
        assert test_id_2 in claimed_ids

    # Immediate second claim should return 0 un-claimed records
    async with session_factory() as session:
        second_claim = await outbox.fetch_pending_and_claim(session, limit=10)
        second_ids = [e.id for _, e in second_claim]
        assert test_id_1 not in second_ids
        assert test_id_2 not in second_ids

    # Verify status in database is PROCESSING with active claim lease
    async with session_factory() as session:
        stmt = select(IntegrationOutboxEvent).where(
            IntegrationOutboxEvent.source_event_id.in_([test_id_1, test_id_2])
        )
        recs = list((await session.execute(stmt)).scalars().all())
        assert len(recs) == 2
        for r in recs:
            assert r.status == "PROCESSING"
            assert r.claim_expires_at is not None
            assert r.claim_expires_at > datetime.now(timezone.utc)


@pytest.mark.asyncio
async def test_outbox_zombie_claim_recovery(session_factory):
    """Criterion 4: Zombie Recovery — timed-out PROCESSING claims are reclaimed."""
    outbox = PostgresEventOutbox()
    test_id = f"evt-test-outbox-zombie-{uuid.uuid4().hex[:8]}"

    # Insert a PROCESSING record with expired claim
    expired_time = datetime.now(timezone.utc) - timedelta(minutes=5)
    async with session_factory() as session:
        zombie_event = IntegrationOutboxEvent(
            outbox_id=f"obx_{uuid.uuid4().hex[:16]}",
            source_event_id=test_id,
            correlation_id="corr-zombie",
            event_type="SALES.ORDER.CONFIRMED",
            company_id="smriti001",
            target_channel="PLATFORM_EVENTS",
            payload_json={"order_id": "ORD-ZOMBIE"},
            status="PROCESSING",
            claim_expires_at=expired_time,
            created_at=expired_time,
        )

        session.add(zombie_event)
        await session.commit()

    # Claim should recover the zombie event
    async with session_factory() as session:
        claimed = await outbox.fetch_pending_and_claim(session, limit=10)
        claimed_ids = [e.id for _, e in claimed]
        assert test_id in claimed_ids

    # Verify status renewed in DB
    async with session_factory() as session:
        stmt = select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.source_event_id == test_id)
        rec = (await session.execute(stmt)).scalar_one()
        assert rec.status == "PROCESSING"
        assert rec.claim_expires_at > datetime.now(timezone.utc)


@pytest.mark.asyncio
async def test_platform_outbox_worker_end_to_end(session_factory):
    """Criterion 5: OutboxWorker end-to-end claim, publish to PlatformEventService, and mark DISPATCHED."""
    registry = EventRegistry()
    registry.register("billing.invoice.issued", {"1.0"}, "Statutory invoice issued")

    service = PlatformEventService.create_in_memory(registry=registry)
    await service.start()

    received_envelopes = []

    async def invoice_listener(env: EventEnvelope[Dict[str, Any]]):
        received_envelopes.append(env)

    await service.subscribe("billing.invoice.*", "listener-audit", invoice_listener)

    outbox = PostgresEventOutbox()
    worker = PlatformOutboxWorker(
        session_factory=session_factory,
        outbox=outbox,
        event_service=service,
        poll_interval_seconds=0.1,
    )

    test_id = f"evt-test-outbox-{uuid.uuid4().hex[:8]}"
    envelope = EventEnvelope[Dict[str, Any]](
        id=test_id,
        eventType="billing.invoice.issued",
        schemaVersion="1.0",
        source="billing.service",
        tenantId="smriti001",
        correlationId="corr-e2e-worker",
        actorId="usr-billing-clerk",
        payload={"invoice_no": "INV-E2E-999", "net_amount": "9999.00"},
    )

    async with session_factory() as session:
        outbox_id = await outbox.stage(envelope, session)
        await session.commit()

    # Execute one single worker cycle
    stats = await worker.run_cycle()

    assert stats["claimed_count"] >= 1
    assert stats["dispatched_count"] >= 1
    assert outbox_id in stats["dispatched_ids"]

    # Verify subscriber received the exact envelope
    assert len(received_envelopes) == 1
    received = received_envelopes[0]
    assert received.id == test_id
    assert received.payload["invoice_no"] == "INV-E2E-999"
    assert received.actorId == "usr-billing-clerk"

    # Verify database record is marked DISPATCHED
    async with session_factory() as session:
        stmt = select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.outbox_id == outbox_id)
        rec = (await session.execute(stmt)).scalar_one()
        assert rec.status == "DISPATCHED"
        assert rec.dispatched_at is not None
        assert rec.claim_expires_at is None

    await service.stop()


@pytest.mark.asyncio
async def test_outbox_retry_and_dead_letter_routing(session_factory):
    """Criterion 6: Publishing failure triggers retry backoff and transitions to DEAD_LETTER after max retries."""
    registry = EventRegistry()
    registry.register("failing.event", {"1.0"}, "Event destined to fail")

    service = PlatformEventService.create_in_memory(registry=registry)
    await service.start()

    async def failing_publish(env):
        raise RuntimeError("Transport connection timed out")

    service.publish = failing_publish

    outbox = PostgresEventOutbox()
    worker = PlatformOutboxWorker(
        session_factory=session_factory,
        outbox=outbox,
        event_service=service,
        max_retries=2,
        base_backoff_seconds=1,
    )


    test_id = f"evt-test-outbox-{uuid.uuid4().hex[:8]}"
    env = EventEnvelope(
        id=test_id,
        eventType="failing.event",
        schemaVersion="1.0",
        source="test.fail",
        tenantId="smriti001",
        correlationId="corr-fail-1",
        payload={"data": "bad"},
    )

    async with session_factory() as session:
        outbox_id = await outbox.stage(env, session)
        await session.commit()

    # Attempt 1: Should fail and set status=FAILED, retry_count=1
    stats1 = await worker.run_cycle()
    assert stats1["failed_count"] >= 1
    assert outbox_id in stats1["failed_ids"]

    async with session_factory() as session:
        stmt = select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.outbox_id == outbox_id)
        rec = (await session.execute(stmt)).scalar_one()
        assert rec.status == "FAILED"
        assert rec.retry_count == 1
        assert "Transport connection timed out" in rec.error_message
        # Force next_attempt_at to now for immediate second attempt

        rec.next_attempt_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        await session.commit()

    # Attempt 2: Reaches max_retries (2) -> Should transition to DEAD_LETTER
    stats2 = await worker.run_cycle()
    assert stats2["failed_count"] >= 1

    async with session_factory() as session:
        stmt = select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.outbox_id == outbox_id)
        rec = (await session.execute(stmt)).scalar_one()
        assert rec.status == "DEAD_LETTER"
        assert rec.retry_count >= 2

    await service.stop()


@pytest.mark.asyncio
async def test_platform_event_service_stage_event_facade(session_factory):
    """Criterion 7: PlatformEventService.stage_event validates registry and delegates to outbox."""
    registry = EventRegistry()
    registry.register("crm.customer.created", {"1.0"}, "Customer created")

    outbox = PostgresEventOutbox()
    service = PlatformEventService.create_in_memory(registry=registry)
    service.outbox = outbox

    test_id = f"evt-test-outbox-{uuid.uuid4().hex[:8]}"
    valid_env = EventEnvelope(
        id=test_id,
        eventType="crm.customer.created",
        schemaVersion="1.0",
        source="crm.portal",
        tenantId="smriti001",
        correlationId="corr-stage-valid",
        payload={"customer_id": "CUST-001"},
    )

    async with session_factory() as session:
        obx_id = await service.stage_event(valid_env, session)
        assert obx_id.startswith("obx_")
        await session.commit()

    # Unregistered event raises ValueError
    invalid_env = EventEnvelope(
        eventType="unregistered.event",
        schemaVersion="1.0",
        source="test",
        tenantId="smriti001",
        payload={},
    )
    async with session_factory() as session:
        with pytest.raises(ValueError, match="Unregistered event type"):
            await service.stage_event(invalid_env, session)
