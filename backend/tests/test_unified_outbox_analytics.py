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
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy import select, delete
from app.db.session import get_company_sessionmaker
from app.services.unified_outbox_analytics_service import UnifiedOutboxAnalyticsService
from app.services.unified_sales_ledger_service import UnifiedSalesLedgerService
from app.services.outbox_service import OutboxService
from app.services.outbox_worker import OutboxQueueWorker
from app.models.outbox import IntegrationOutboxEvent, OutboxEvent
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.inventory import Product, StockMovement
from app.models.crm import Customer


@pytest.fixture(autouse=True)
async def cleanup_outbox_test_data():
    """Clean up test outbox events, sales invoices, stock movements, and test products before and after tests."""
    for db in ["smriti001", "smriti002"]:
        session_factory = get_company_sessionmaker(db)
        async with session_factory() as session:
            await session.execute(delete(IntegrationOutboxEvent).where(IntegrationOutboxEvent.aggregate_id.like("TEST-%")))
            await session.execute(delete(IntegrationOutboxEvent).where(IntegrationOutboxEvent.correlation_id.like("TEST-%")))
            await session.execute(delete(IntegrationOutboxEvent).where(IntegrationOutboxEvent.target_channel.like("TEST_%")))
            await session.execute(delete(StockMovement).where(StockMovement.remarks.like("%TEST-OUTBOX%")))
            await session.execute(delete(SalesInvoice).where(SalesInvoice.invoice_no.like("INV-TEST-OUTBOX-%")))
            await session.execute(delete(SalesInvoice).where(SalesInvoice.invoice_no.like("INV-TEST-ATOMIC-%")))

            # Ensure test customer exists
            cust = (await session.execute(
                select(Customer).where(Customer.id == "cust_outbox_test_01")
            )).scalar_one_or_none()
            if not cust:
                session.add(Customer(
                    id="cust_outbox_test_01",
                    company_id="COMP-001",
                    code="CUST-OBX-01",
                    name="Outbox Test Customer",
                    mobile="9820099887",
                    status="Active",
                    is_active=True,
                    is_deleted=False
                ))

            # Ensure test product exists
            prod = (await session.execute(
                select(Product).where(Product.id == "prod_outbox_test_01")
            )).scalar_one_or_none()
            if not prod:
                session.add(Product(
                    id="prod_outbox_test_01",
                    company_id="COMP-001",
                    code="PROD-OBX-01",
                    name="Outbox Test SKU",
                    category="General",
                    price=500.00,
                    mrp=600.00,
                    barcode="8901234567890",
                    cost_price=300.00,
                    stock=100,
                    is_active=True,
                    is_deleted=False
                ))

            await session.commit()
    yield
    for db in ["smriti001", "smriti002"]:
        session_factory = get_company_sessionmaker(db)
        async with session_factory() as session:
            await session.execute(delete(IntegrationOutboxEvent).where(IntegrationOutboxEvent.aggregate_id.like("TEST-%")))
            await session.execute(delete(IntegrationOutboxEvent).where(IntegrationOutboxEvent.correlation_id.like("TEST-%")))
            await session.execute(delete(IntegrationOutboxEvent).where(IntegrationOutboxEvent.target_channel.like("TEST_%")))
            await session.execute(delete(StockMovement).where(StockMovement.remarks.like("%TEST-OUTBOX%")))
            await session.execute(delete(SalesInvoice).where(SalesInvoice.invoice_no.like("INV-TEST-OUTBOX-%")))
            await session.execute(delete(SalesInvoice).where(SalesInvoice.invoice_no.like("INV-TEST-ATOMIC-%")))
            await session.commit()


@pytest.mark.asyncio
async def test_real_domain_service_sales_invoice_outbox_atomicity():
    """Verify that UnifiedSalesLedgerService.post_sales_invoice atomically writes invoice and outbox event."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        inv = await UnifiedSalesLedgerService.post_sales_invoice(
            session=session,
            company_id="COMP-001",
            invoice_no="INV-TEST-OUTBOX-001",
            customer_id="cust_outbox_test_01",
            items_data=[{
                "product_id": "prod_outbox_test_01",
                "code": "PROD-OBX-01",
                "name": "Outbox Test SKU",
                "quantity": 2,
                "price": 500.00,
                "gst_rate": 18.0
            }]
        )

        assert inv is not None
        assert inv.invoice_no == "INV-TEST-OUTBOX-001"
        assert inv.grand_total == Decimal("1180.00")

        # Verify Canonical Outbox Event was staged and committed in the SAME transaction
        outbox_evt = (await session.execute(
            select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.aggregate_id == inv.id)
        )).scalar_one()

        assert outbox_evt is not None
        assert outbox_evt.status == "PENDING"
        assert outbox_evt.event_type == "SALES_INVOICE_CONFIRMED"
        assert outbox_evt.target_channel == "SALES_INVOICE_PUBLISH"
        assert outbox_evt.payload_json["invoice_no"] == "INV-TEST-OUTBOX-001"
        assert outbox_evt.payload_json["grand_total"] == 1180.00


@pytest.mark.asyncio
async def test_real_domain_service_sales_invoice_cancellation_outbox_atomicity():
    """Verify that UnifiedSalesLedgerService.cancel_sales_invoice atomically stages cancellation outbox event."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        inv = await UnifiedSalesLedgerService.post_sales_invoice(
            session=session,
            company_id="COMP-001",
            invoice_no="INV-TEST-OUTBOX-002",
            customer_id="cust_outbox_test_01",
            items_data=[{
                "product_id": "prod_outbox_test_01",
                "code": "PROD-OBX-01",
                "name": "Outbox Test SKU",
                "quantity": 1,
                "price": 500.00,
                "gst_rate": 18.0
            }]
        )

        # Cancel the invoice
        cancelled = await UnifiedSalesLedgerService.cancel_sales_invoice(
            session=session,
            company_id="COMP-001",
            invoice_no="INV-TEST-OUTBOX-002",
            reason="Customer cancelled order"
        )
        assert cancelled.status == "Cancelled"

        # Verify cancellation event in outbox
        cancel_evt = (await session.execute(
            select(IntegrationOutboxEvent).where(
                IntegrationOutboxEvent.aggregate_id == inv.id,
                IntegrationOutboxEvent.event_type == "SALES_INVOICE_CANCELLED"
            )
        )).scalar_one()

        assert cancel_evt is not None
        assert cancel_evt.status == "PENDING"
        assert cancel_evt.payload_json["reason"] == "Customer cancelled order"


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
                customer_id="cust_outbox_test_01",
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
async def test_outbox_dispatcher_two_phase_claim_and_retry_backoff():
    """Verify two-phase non-blocking claim, external callback dispatch, and exponential retry backoff."""
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
            target_channel="TEST_DISPATCH_CHANNEL",
            base_backoff_seconds=2
        )

        assert res["dispatched_count"] == 1
        assert res["failed_count"] == 1
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
        assert saved_fail.next_attempt_at is not None
        assert "503" in saved_fail.error_message

        # 5. Immediate second dispatch poll must SKIP the failed event because next_attempt_at is in the future
        res2 = await UnifiedOutboxAnalyticsService.dispatch_pending_outbox_events(
            session=session,
            limit=10,
            dispatcher_callback=mock_publisher,
            max_retries=3,
            target_channel="TEST_DISPATCH_CHANNEL"
        )
        assert res2["dispatched_count"] == 0
        assert res2["failed_count"] == 0

        # 6. Simulate arrival of next_attempt_at by setting it to the past
        saved_fail.next_attempt_at = datetime.now(timezone.utc) - timedelta(seconds=10)
        await session.commit()

        # Now mock publisher succeeds on retry
        async def mock_publisher_retry_success(evt):
            published_events.append(evt.outbox_id)

        res3 = await UnifiedOutboxAnalyticsService.dispatch_pending_outbox_events(
            session=session,
            limit=10,
            dispatcher_callback=mock_publisher_retry_success,
            max_retries=3,
            target_channel="TEST_DISPATCH_CHANNEL"
        )
        assert res3["dispatched_count"] == 1
        assert evt_fail.outbox_id in res3["dispatched_event_ids"]


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

        # Dispatch with max_retries = 3 -> Should transition to DEAD_LETTER
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
async def test_outbox_dispatcher_rejects_missing_callback():
    """Verify dispatcher rejects invocation with missing callback to prevent false positive dispatch."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        with pytest.raises(ValueError, match="No dispatcher_callback configured"):
            await UnifiedOutboxAnalyticsService.dispatch_pending_outbox_events(
                session=session,
                limit=10,
                dispatcher_callback=None
            )


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


@pytest.mark.asyncio
async def test_outbox_queue_worker_multi_tenant_cycle():
    """Verify OutboxQueueWorker processes batches across multiple company tenant databases."""
    # 1. Stage events in both smriti001 and smriti002
    session_001 = get_company_sessionmaker("smriti001")
    session_002 = get_company_sessionmaker("smriti002")

    async with session_001() as s1:
        await UnifiedOutboxAnalyticsService.stage_outbox_event(
            session=s1,
            company_id="COMP-001",
            event_type="STOCK_AUDIT_SYNC",
            aggregate_type="STOCK_AUDIT",
            aggregate_id="TEST-AUD-01",
            target_channel="TEST_WORKER_CHANNEL",
            payload={"audit_id": "aud_01"}
        )
        await s1.commit()

    async with session_002() as s2:
        await UnifiedOutboxAnalyticsService.stage_outbox_event(
            session=s2,
            company_id="COMP-002",
            event_type="STOCK_AUDIT_SYNC",
            aggregate_type="STOCK_AUDIT",
            aggregate_id="TEST-AUD-02",
            target_channel="TEST_WORKER_CHANNEL",
            payload={"audit_id": "aud_02"}
        )
        await s2.commit()

    # 2. Run worker cycle across both databases
    dispatched_worker_events = []
    async def mock_worker_adapter(evt):
        dispatched_worker_events.append((evt.company_id, evt.aggregate_id))

    cycle_results = await OutboxQueueWorker.run_worker_cycle(
        company_databases=["smriti001", "smriti002"],
        dispatcher_callback=mock_worker_adapter,
        target_channel="TEST_WORKER_CHANNEL"
    )

    assert "smriti001" in cycle_results
    assert "smriti002" in cycle_results
    assert cycle_results["smriti001"]["dispatched_count"] >= 1
    assert cycle_results["smriti002"]["dispatched_count"] >= 1
    assert ("COMP-001", "TEST-AUD-01") in dispatched_worker_events
    assert ("COMP-002", "TEST-AUD-02") in dispatched_worker_events


