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
from decimal import Decimal
from typing import Dict, Any
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError

from app.db.session import get_company_sessionmaker
from app.models.outbox import IntegrationOutboxEvent
from app.models.sales import SalesInvoice
from app.platform.events import (
    EventEnvelope,
    EventRegistry,
    PlatformEventService,
    PostgresEventOutbox,
    PlatformOutboxWorker,
    RetentionTier,
    EventRetentionPolicy,
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


@pytest.mark.asyncio
async def test_database_level_unique_constraint_on_source_event_id(session_factory):
    """Criterion 8: Database Uniqueness Constraint — DB engine strictly rejects duplicate source_event_id."""
    outbox = PostgresEventOutbox()
    fixed_event_id = f"evt-test-outbox-unique-{uuid.uuid4().hex[:8]}"

    env1 = EventEnvelope(
        id=fixed_event_id,
        eventType="pos.bill.created",
        schemaVersion="1.0",
        source="pos.checkout",
        tenantId="smriti001",
        payload={"bill_id": "B-001"},
    )
    env2 = EventEnvelope(
        id=fixed_event_id,  # Identical source_event_id
        eventType="pos.bill.created",
        schemaVersion="1.0",
        source="pos.checkout",
        tenantId="smriti001",
        payload={"bill_id": "B-002"},
    )

    # First insert commits cleanly
    async with session_factory() as session:
        await outbox.stage(env1, session)
        await session.commit()

    # Second insert MUST fail with PostgreSQL database IntegrityError (unique violation)
    async with session_factory() as session:
        await outbox.stage(env2, session)
        with pytest.raises(IntegrityError):
            await session.commit()


@pytest.mark.asyncio
async def test_outbox_dlq_operational_lifecycle(session_factory):
    """Criterion 9: DLQ Operational Recovery — Replay reverts to PENDING and Abandon marks ABANDONED."""
    outbox = PostgresEventOutbox()
    test_id = f"evt-test-outbox-dlq-{uuid.uuid4().hex[:8]}"

    env = EventEnvelope(
        id=test_id,
        eventType="wms.goods.receipt",
        schemaVersion="1.0",
        source="wms.grn",
        tenantId="smriti001",
        payload={"grn_no": "GRN-999"},
    )

    async with session_factory() as session:
        outbox_id = await outbox.stage(env, session)
        await session.commit()

    # Transition to DEAD_LETTER via max retries
    async with session_factory() as session:
        await outbox.mark_failed(session, outbox_id, "External GRN partner timeout", max_retries=1)

    # Verify status is DEAD_LETTER
    async with session_factory() as session:
        stmt = select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.outbox_id == outbox_id)
        rec = (await session.execute(stmt)).scalar_one()
        assert rec.status == "DEAD_LETTER"

    # Test Operational Replay: resets to PENDING
    async with session_factory() as session:
        replayed = await outbox.replay_dead_letter(session, outbox_id)
        assert replayed is True

    async with session_factory() as session:
        stmt = select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.outbox_id == outbox_id)
        rec = (await session.execute(stmt)).scalar_one()
        assert rec.status == "PENDING"
        assert rec.retry_count == 0
        assert "[REPLAYED AT" in rec.error_message

    # Transition back to DEAD_LETTER and test Abandon
    async with session_factory() as session:
        await outbox.mark_failed(session, outbox_id, "Permanent schema corruption", max_retries=1)
        abandoned = await outbox.abandon_dead_letter(session, outbox_id, "Business canceled transaction")
        assert abandoned is True

    async with session_factory() as session:
        stmt = select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.outbox_id == outbox_id)
        rec = (await session.execute(stmt)).scalar_one()
        assert rec.status == "ABANDONED"
        assert "[ABANDONED: Business canceled transaction]" in rec.error_message


def test_event_retention_policy_resolution():
    """Criterion 10: Retention Policy — Prevents blind 30-day purge for statutory financial events."""
    # Statutory financial events: 8 Years (2920 days) per CGST Act 2017 Sec 36
    assert EventRetentionPolicy.resolve_tier("billing.invoice.issued") == RetentionTier.STATUTORY_FINANCIAL
    assert EventRetentionPolicy.resolve_retention_days("billing.invoice.issued") == 2920
    assert EventRetentionPolicy.resolve_tier("accounting.voucher.posted") == RetentionTier.STATUTORY_FINANCIAL
    assert EventRetentionPolicy.resolve_retention_days("accounting.voucher.posted") == 2920

    # Ephemeral events: 7 days
    assert EventRetentionPolicy.resolve_tier("heartbeat.worker.ping") == RetentionTier.EPHEMERAL
    assert EventRetentionPolicy.resolve_retention_days("heartbeat.worker.ping") == 7

    # Audit & Compliance: Permanent (-1)
    assert EventRetentionPolicy.resolve_tier("compliance.immutable.audit") == RetentionTier.AUDIT_COMPLIANCE
    assert EventRetentionPolicy.resolve_retention_days("compliance.immutable.audit") == -1

    # Default operational: 90 days
    assert EventRetentionPolicy.resolve_tier("custom.unknown.event") == RetentionTier.OPERATIONAL
    assert EventRetentionPolicy.resolve_retention_days("custom.unknown.event") == 90


@pytest.mark.asyncio
async def test_transaction_rollback_removes_domain_change_and_event(session_factory):
    """Criterion 11: Business Coupling Rollback — Proves domain business record and outbox event are atomically discarded on rollback."""
    outbox = PostgresEventOutbox()
    test_inv_no = f"INV-TEST-RB-{uuid.uuid4().hex[:8].upper()}"
    test_event_id = f"evt-rb-{uuid.uuid4().hex[:8]}"

    # Transaction 1: Create domain invoice + stage event, then ROLLBACK
    async with session_factory() as session:
        inv = SalesInvoice(
            id=f"inv_{uuid.uuid4().hex[:12]}",
            invoice_no=test_inv_no,
            grand_total=Decimal("1500.00"),
        )
        session.add(inv)

        env = EventEnvelope(
            id=test_event_id,
            eventType="pos.bill.created",
            schemaVersion="1.0",
            source="sales.pos",
            tenantId="smriti001",
            payload={"invoice_no": test_inv_no, "grand_total": 1500.00},
            metadata={"aggregate_id": inv.id},
        )
        await outbox.stage(env, session)
        await session.rollback()

    # Verify both are absent in a fresh query session
    async with session_factory() as session:
        db_inv = (await session.execute(
            select(SalesInvoice).where(SalesInvoice.invoice_no == test_inv_no)
        )).scalar_one_or_none()
        assert db_inv is None

        db_outbox = (await session.execute(
            select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.source_event_id == test_event_id)
        )).scalar_one_or_none()
        assert db_outbox is None


@pytest.mark.asyncio
async def test_transaction_commit_persists_domain_change_and_event(session_factory):
    """Criterion 12: Business Coupling Commit — Proves domain business record and outbox event are atomically committed together."""
    outbox = PostgresEventOutbox()
    test_inv_no = f"INV-TEST-CM-{uuid.uuid4().hex[:8].upper()}"
    test_event_id = f"evt-cm-{uuid.uuid4().hex[:8]}"
    invoice_id = f"inv_{uuid.uuid4().hex[:12]}"

    # Transaction 1: Create domain invoice + stage event, then COMMIT
    async with session_factory() as session:
        inv = SalesInvoice(
            id=invoice_id,
            invoice_no=test_inv_no,
            grand_total=Decimal("2500.00"),
        )
        session.add(inv)

        env = EventEnvelope(
            id=test_event_id,
            eventType="pos.bill.created",
            schemaVersion="1.0",
            source="sales.pos",
            tenantId="smriti001",
            payload={"invoice_no": test_inv_no, "grand_total": 2500.00},
            metadata={"aggregate_id": inv.id},
        )
        outbox_id = await outbox.stage(env, session)
        await session.commit()

    # Verify both exist in the database in the exact same transaction boundary
    async with session_factory() as session:
        db_inv = (await session.execute(
            select(SalesInvoice).where(SalesInvoice.invoice_no == test_inv_no)
        )).scalar_one_or_none()
        assert db_inv is not None
        assert db_inv.grand_total == Decimal("2500.00")

        db_outbox = (await session.execute(
            select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.outbox_id == outbox_id)
        )).scalar_one_or_none()
        assert db_outbox is not None
        assert db_outbox.status == "PENDING"
        assert db_outbox.aggregate_id == invoice_id


