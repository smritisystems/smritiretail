"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import uuid
import pytest
from decimal import Decimal
from sqlalchemy import select, delete
from app.db.session import get_company_sessionmaker
from app.services.unified_outbox_analytics_service import UnifiedOutboxAnalyticsService
from app.services.outbox_service import OutboxService
from app.models.outbox import IntegrationOutboxEvent, OutboxEvent
from app.models.sales import SalesInvoice


@pytest.fixture(autouse=True)
async def cleanup_outbox_test_data():
    """Clean up test outbox events and test sales invoices before and after tests."""
    for db in ["smriti001", "smriti002"]:
        session_factory = get_company_sessionmaker(db)
        async with session_factory() as session:
            await session.execute(delete(IntegrationOutboxEvent).where(IntegrationOutboxEvent.aggregate_id.like("TEST-%")))
            await session.execute(delete(IntegrationOutboxEvent).where(IntegrationOutboxEvent.correlation_id.like("TEST-%")))
            await session.execute(delete(SalesInvoice).where(SalesInvoice.invoice_no.like("INV-TEST-ATOMIC-%")))
            await session.commit()
    yield
    for db in ["smriti001", "smriti002"]:
        session_factory = get_company_sessionmaker(db)
        async with session_factory() as session:
            await session.execute(delete(IntegrationOutboxEvent).where(IntegrationOutboxEvent.aggregate_id.like("TEST-%")))
            await session.execute(delete(IntegrationOutboxEvent).where(IntegrationOutboxEvent.correlation_id.like("TEST-%")))
            await session.execute(delete(SalesInvoice).where(SalesInvoice.invoice_no.like("INV-TEST-ATOMIC-%")))
            await session.commit()


@pytest.mark.asyncio
async def test_real_domain_transaction_outbox_atomicity():
    """Verify that domain entities and outbox events are written and committed in the exact same transaction."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # 1. Create a business domain record
        inv = SalesInvoice(
            id=f"inv_{uuid.uuid4().hex[:12]}",
            company_id="COMP-001",
            branch_id="BR-001",
            customer_id="cust_sales_test_01",
            invoice_no="INV-TEST-ATOMIC-001",
            customer_name="Atomic Customer",
            tax_total=Decimal("180.00"),
            grand_total=Decimal("1180.00"),
            status="CONFIRMED"
        )
        session.add(inv)

        # 2. Record outbox event via OutboxService in the SAME transaction (without committing yet)
        outbox_evt = await OutboxService.record_event(
            session=session,
            target_channel="SALES_INVOICE_PUBLISH",
            payload={"invoice_id": inv.id, "grand_total": 1180.00, "customer": "Atomic Customer"},
            correlation_id="TEST-CORR-001",
            causation_id=inv.id,
            event_type="SALES_INVOICE_CONFIRMED",
            aggregate_type="SALES_INVOICE",
            aggregate_id=inv.id,
            company_id="COMP-001"
        )

        # 3. Single atomic commit
        await session.commit()

        # 4. Verify both exist in database
        saved_inv = (await session.execute(
            select(SalesInvoice).where(SalesInvoice.invoice_no == "INV-TEST-ATOMIC-001")
        )).scalar_one()
        assert saved_inv is not None
        assert saved_inv.grand_total == Decimal("1180.00")

        saved_evt = (await session.execute(
            select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.outbox_id == outbox_evt.outbox_id)
        )).scalar_one()
        assert saved_evt is not None
        assert saved_evt.status == "PENDING"
        assert saved_evt.aggregate_id == inv.id
        assert saved_evt.target_channel == "SALES_INVOICE_PUBLISH"
        assert saved_evt.payload_json["grand_total"] == 1180.00


@pytest.mark.asyncio
async def test_outbox_transaction_rollback_guarantee():
    """Verify that a rollback on failure leaves zero phantom records in both domain and outbox tables."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        try:
            # 1. Add domain invoice
            inv = SalesInvoice(
                id=f"inv_{uuid.uuid4().hex[:12]}",
                company_id="COMP-001",
                branch_id="BR-001",
                customer_id="cust_sales_test_01",
                invoice_no="INV-TEST-ATOMIC-ROLLBACK",
                customer_name="Rollback Customer",
                tax_total=Decimal("90.00"),
                grand_total=Decimal("590.00"),
                status="CONFIRMED"
            )
            session.add(inv)

            # 2. Stage outbox event in same session
            await OutboxService.record_event(
                session=session,
                target_channel="SALES_INVOICE_PUBLISH",
                payload={"invoice_id": inv.id},
                correlation_id="TEST-CORR-ROLLBACK",
                aggregate_type="SALES_INVOICE",
                aggregate_id="TEST-AGG-ROLLBACK"
            )

            # 3. Simulate failure before commit
            raise RuntimeError("Simulated database failure during checkout transaction")
        except RuntimeError:
            await session.rollback()

        # 4. Verify ZERO phantom records were persisted
        inv_check = (await session.execute(
            select(SalesInvoice).where(SalesInvoice.invoice_no == "INV-TEST-ATOMIC-ROLLBACK")
        )).scalar_one_or_none()
        assert inv_check is None, "Failed transaction must not leave invoice record!"

        evt_check = (await session.execute(
            select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.correlation_id == "TEST-CORR-ROLLBACK")
        )).scalar_one_or_none()
        assert evt_check is None, "Failed transaction must not leave orphaned outbox record!"



@pytest.mark.asyncio
async def test_outbox_dispatcher_with_external_adapter_and_retry_backoff():
    """Verify outbox dispatcher executes external adapter callback, increments retries on failure, and moves to DLQ."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # 1. Stage an event that will succeed
        evt_success = await UnifiedOutboxAnalyticsService.stage_outbox_event(
            session=session,
            company_id="COMP-001",
            event_type="STOCK_SYNC",
            aggregate_type="STOCK_MOVEMENT",
            aggregate_id="TEST-SM-SUCC",
            target_channel="TEST_DISPATCH_CHANNEL",
            payload={"item": "SKU-001", "qty": 10}
        )
        # 2. Stage an event that will fail
        evt_fail = await UnifiedOutboxAnalyticsService.stage_outbox_event(
            session=session,
            company_id="COMP-001",
            event_type="ECOM_WEBHOOK",
            aggregate_type="ECOM_ORDER",
            aggregate_id="TEST-ECOM-FAIL",
            target_channel="TEST_DISPATCH_CHANNEL",
            payload={"order_id": "ORD-999"}
        )
        await session.commit()

        # Mock external publisher adapter
        published_events = []
        async def mock_publisher(evt: IntegrationOutboxEvent):
            if evt.aggregate_id == "TEST-ECOM-FAIL":
                raise ConnectionError("External Webhook Endpoint 503 Service Unavailable")
            published_events.append(evt.outbox_id)

        # 3. Dispatch batch for TEST_DISPATCH_CHANNEL
        res = await UnifiedOutboxAnalyticsService.dispatch_pending_outbox_events(
            session=session,
            limit=10,
            dispatcher_callback=mock_publisher,
            max_retries=3,
            target_channel="TEST_DISPATCH_CHANNEL"
        )

        assert res["dispatched_count"] >= 1
        assert evt_success.outbox_id in res["dispatched_event_ids"]
        assert evt_fail.outbox_id in res["failed_event_ids"]

        # 4. Verify database states
        saved_succ = (await session.execute(
            select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.outbox_id == evt_success.outbox_id)
        )).scalar_one()
        assert saved_succ.status == "DISPATCHED"
        assert saved_succ.dispatched_at is not None

        saved_fail = (await session.execute(
            select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.outbox_id == evt_fail.outbox_id)
        )).scalar_one()
        assert saved_fail.status == "FAILED"
        assert saved_fail.retry_count == 1
        assert "503" in saved_fail.error_message


@pytest.mark.asyncio
async def test_outbox_dead_letter_queue_transition():
    """Verify that events exceeding max_retries transition to DEAD_LETTER status."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Stage an event with retry_count already at 2
        evt = await UnifiedOutboxAnalyticsService.stage_outbox_event(
            session=session,
            company_id="COMP-001",
            event_type="PAYMENT_GATEWAY_SYNC",
            aggregate_type="PAYMENT_TRANSACTION",
            aggregate_id="TEST-PAY-DLQ",
            target_channel="TEST_DLQ_CHANNEL",
            payload={"txn_id": "TXN-999"}
        )
        evt.retry_count = 2  # Already failed twice
        await session.commit()

        # Failing publisher
        async def failing_publisher(evt):
            raise TimeoutError("Gateway Timeout")

        # Dispatch with max_retries = 3 for TEST_DLQ_CHANNEL -> Should transition to DEAD_LETTER
        res = await UnifiedOutboxAnalyticsService.dispatch_pending_outbox_events(
            session=session,
            limit=10,
            dispatcher_callback=failing_publisher,
            max_retries=3,
            target_channel="TEST_DLQ_CHANNEL"
        )

        assert evt.outbox_id in res["dead_letter_event_ids"]

        # Check DB state
        dlq_evt = (await session.execute(
            select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.outbox_id == evt.outbox_id)
        )).scalar_one()
        assert dlq_evt.status == "DEAD_LETTER"
        assert dlq_evt.retry_count == 3



@pytest.mark.asyncio
async def test_authoritative_operational_analytics_summary():
    """Verify operational KPI analytics compute authoritative metrics directly from Postgres ledgers."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        summary = await UnifiedOutboxAnalyticsService.get_authoritative_operational_summary(
            session=session,
            company_id="COMP-001"
        )

        assert "company_id" in summary
        assert summary["company_id"] == "COMP-001"
        assert "total_revenue" in summary
        assert isinstance(summary["total_revenue"], (int, float))
        assert "confirmed_invoice_count" in summary
        assert "total_payments_collected" in summary
        assert "total_stock_movements" in summary
        assert "pending_outbox_events" in summary


@pytest.mark.asyncio
async def test_outbox_and_analytics_tenant_isolation():
    """Verify outbox events in smriti001 do not leak into smriti002."""
    session_001 = get_company_sessionmaker("smriti001")
    session_002 = get_company_sessionmaker("smriti002")

    async with session_001() as s1:
        evt = await UnifiedOutboxAnalyticsService.stage_outbox_event(
            session=s1,
            company_id="COMP-001",
            event_type="APPROVAL_DECISION",
            aggregate_type="APPROVAL_REQUEST",
            aggregate_id="TEST-APR-99",
            payload={"status": "APPROVED"}
        )
        await s1.commit()

    async with session_002() as s2:
        stmt = select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.aggregate_id == "TEST-APR-99")
        leaked = (await s2.execute(stmt)).scalar_one_or_none()
        assert leaked is None, "IntegrationOutboxEvent from smriti001 must not leak into smriti002!"
