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

import pytest
from decimal import Decimal
from sqlalchemy import select, delete
from app.db.session import get_company_sessionmaker
from app.services.unified_outbox_analytics_service import UnifiedOutboxAnalyticsService
from app.models.outbox import OutboxEvent


@pytest.fixture(autouse=True)
async def cleanup_outbox_test_data():
    """Clean up test outbox events before and after tests."""
    for db in ["smriti001", "smriti002"]:
        session_factory = get_company_sessionmaker(db)
        async with session_factory() as session:
            await session.execute(delete(OutboxEvent).where(OutboxEvent.aggregate_id.like("TEST-%")))
            await session.commit()
    yield
    for db in ["smriti001", "smriti002"]:
        session_factory = get_company_sessionmaker(db)
        async with session_factory() as session:
            await session.execute(delete(OutboxEvent).where(OutboxEvent.aggregate_id.like("TEST-%")))
            await session.commit()


@pytest.mark.asyncio
async def test_transactional_outbox_event_staging_and_persistence():
    """Verify outbox event is staged and persisted atomically."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        evt = await UnifiedOutboxAnalyticsService.stage_outbox_event(
            session=session,
            company_id="COMP-001",
            event_type="INVOICE_CONFIRMED",
            aggregate_type="SALES_INVOICE",
            aggregate_id="TEST-INV-8899",
            payload={
                "invoice_number": "INV/2026-27/8899",
                "customer_id": "cust_test_01",
                "total_amount": 14500.00
            }
        )
        await session.commit()

        # Verify persisted state
        stmt = select(OutboxEvent).where(OutboxEvent.id == evt.id)
        saved = (await session.execute(stmt)).scalar_one()

        assert saved.event_type == "INVOICE_CONFIRMED"
        assert saved.aggregate_type == "SALES_INVOICE"
        assert saved.status == "PENDING"
        assert saved.payload["invoice_number"] == "INV/2026-27/8899"
        assert saved.dispatched_at is None


@pytest.mark.asyncio
async def test_locked_batch_outbox_event_dispatch():
    """Verify outbox dispatcher queries pending events with row locks and marks them DISPATCHED."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # 1. Stage 2 test events
        evt1 = await UnifiedOutboxAnalyticsService.stage_outbox_event(
            session=session,
            company_id="COMP-001",
            event_type="STOCK_ADJUSTED",
            aggregate_type="STOCK_MOVEMENT",
            aggregate_id="TEST-SM-01",
            payload={"item_id": "item_01", "qty": -5}
        )
        evt2 = await UnifiedOutboxAnalyticsService.stage_outbox_event(
            session=session,
            company_id="COMP-001",
            event_type="PAYMENT_SETTLED",
            aggregate_type="PAYMENT_TRANSACTION",
            aggregate_id="TEST-PAY-01",
            payload={"amount": 5000.00, "mode": "UPI"}
        )
        await session.commit()

        # 2. Dispatch pending batch
        res = await UnifiedOutboxAnalyticsService.dispatch_pending_outbox_events(
            session=session,
            limit=10
        )

        assert res["dispatched_count"] >= 2
        assert evt1.id in res["dispatched_event_ids"]
        assert evt2.id in res["dispatched_event_ids"]

        # 3. Verify status updated to DISPATCHED
        stmt = select(OutboxEvent).where(OutboxEvent.id.in_([evt1.id, evt2.id]))
        dispatched_evts = (await session.execute(stmt)).scalars().all()
        for d in dispatched_evts:
            assert d.status == "DISPATCHED"
            assert d.dispatched_at is not None


@pytest.mark.asyncio
async def test_authoritative_operational_analytics_summary():
    """Verify operational analytics queries compute authoritative metrics directly from Postgres ledgers."""
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
        stmt = select(OutboxEvent).where(OutboxEvent.aggregate_id == "TEST-APR-99")
        leaked = (await s2.execute(stmt)).scalar_one_or_none()
        assert leaked is None, "OutboxEvent from smriti001 must not leak into smriti002!"
