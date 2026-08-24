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

import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy import select, and_, or_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.outbox import IntegrationOutboxEvent, OutboxEvent
from ..models.sales import SalesInvoice
from ..models.payment_ledger import PaymentTransaction
from ..models.inventory import StockMovement


class UnifiedOutboxAnalyticsService:
    """
    Domain service orchestrating transactional outbox event lifecycle and
    authoritative operational KPI analytics querying directly from PostgreSQL ledgers.
    """

    # =========================================================================
    # 1. TRANSACTIONAL OUTBOX RECORDING & DISPATCH
    # =========================================================================
    @classmethod
    async def stage_outbox_event(
        cls,
        session: AsyncSession,
        company_id: str,
        event_type: str,
        aggregate_type: str,
        aggregate_id: str,
        payload: Dict[str, Any],
        branch_id: str = "BR-001",
        target_channel: str = "GENERAL_OUTBOX",
        correlation_id: Optional[str] = None,
        causation_id: Optional[str] = None
    ) -> IntegrationOutboxEvent:
        """
        Stages a domain event in integration_outbox_events table within the active database transaction.
        Must be committed alongside the domain entity changes.
        """
        ts_us_hex = f"{int(datetime.now(timezone.utc).timestamp() * 1000000):016x}"
        random_hex = uuid.uuid4().hex[:16]
        source_event_id = f"evt_{ts_us_hex}_{random_hex}"
        if not correlation_id:
            correlation_id = f"corr_{uuid.uuid4().hex[:16]}"

        event = IntegrationOutboxEvent(
            outbox_id=f"obx_{uuid.uuid4().hex[:16]}",
            source_event_id=source_event_id,
            correlation_id=correlation_id,
            causation_id=causation_id,
            company_id=company_id,
            branch_id=branch_id,
            event_type=event_type.strip().upper(),
            aggregate_type=aggregate_type.strip().upper(),
            aggregate_id=aggregate_id,
            target_channel=target_channel,
            payload_json=payload,
            status="PENDING",
            retry_count=0,
            created_at=datetime.now(timezone.utc)
        )
        session.add(event)
        return event

    @classmethod
    async def dispatch_pending_outbox_events(
        cls,
        session: AsyncSession,
        limit: int = 50,
        dispatcher_callback=None,
        max_retries: int = 5,
        target_channel: Optional[str] = None,
        event_type: Optional[str] = None,
        base_backoff_seconds: int = 2,
        claim_timeout_seconds: int = 60
    ) -> Dict[str, Any]:
        """
        Polls and dispatches pending and retryable outbox events using a resilient two-phase claim:
        1. Phase 1 (Claim): Selects eligible events (PENDING, retryable FAILED with next_attempt_at <= now,
           or timed-out PROCESSING claims) with SKIP LOCKED, marks them PROCESSING, and commits claim.
        2. Phase 2 (Publish): Dispatches events via dispatcher_callback WITHOUT holding DB locks.
        3. Phase 3 (Settle): Updates events to DISPATCHED or FAILED with exponential backoff / DEAD_LETTER.
        """
        if not dispatcher_callback:
            raise ValueError("No dispatcher_callback configured. Refusing to mark outbox events as dispatched without publisher.")

        now_utc = datetime.now(timezone.utc)
        claim_expires_at = now_utc + timedelta(seconds=claim_timeout_seconds)

        # Eligibility criteria:
        # 1. status == 'PENDING'
        # 2. status == 'FAILED' AND (next_attempt_at IS NULL OR next_attempt_at <= now)
        # 3. status == 'PROCESSING' AND claim_expires_at <= now (zombie recovery)
        eligibility_clause = or_(
            IntegrationOutboxEvent.status == "PENDING",
            and_(
                IntegrationOutboxEvent.status == "FAILED",
                or_(
                    IntegrationOutboxEvent.next_attempt_at == None,
                    IntegrationOutboxEvent.next_attempt_at <= now_utc
                )
            ),
            and_(
                IntegrationOutboxEvent.status == "PROCESSING",
                IntegrationOutboxEvent.claim_expires_at != None,
                IntegrationOutboxEvent.claim_expires_at <= now_utc
            )
        )

        filters = [eligibility_clause]
        if target_channel:
            filters.append(IntegrationOutboxEvent.target_channel == target_channel)
        if event_type:
            filters.append(IntegrationOutboxEvent.event_type == event_type.strip().upper())

        # Phase 1: Claim Batch
        stmt = (
            select(IntegrationOutboxEvent)
            .where(*filters)
            .order_by(IntegrationOutboxEvent.created_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        events = list((await session.execute(stmt)).scalars().all())
        if not events:
            return {
                "dispatched_count": 0,
                "failed_count": 0,
                "dead_letter_count": 0,
                "dispatched_event_ids": [],
                "failed_event_ids": [],
                "dead_letter_event_ids": [],
                "processed_at": now_utc.isoformat()
            }

        claimed_events_data = []
        for evt in events:
            evt.status = "PROCESSING"
            evt.last_attempt_at = now_utc
            evt.claim_expires_at = claim_expires_at
            claimed_events_data.append((evt.outbox_id, evt.retry_count, evt))

        await session.commit()

        # Phase 2: Publish Outside DB Lock
        dispatched_ids: List[str] = []
        failed_records: List[tuple[str, int, str]] = []
        dead_letter_records: List[tuple[str, int, str]] = []

        for outbox_id, current_retry_count, evt in claimed_events_data:
            try:
                await dispatcher_callback(evt)
                dispatched_ids.append(outbox_id)
            except Exception as exc:
                new_retry_count = current_retry_count + 1
                if new_retry_count >= max_retries:
                    dead_letter_records.append((outbox_id, new_retry_count, str(exc)))
                else:
                    failed_records.append((outbox_id, new_retry_count, str(exc)))

        # Phase 3: Settle Results
        settle_now = datetime.now(timezone.utc)
        all_ids = dispatched_ids + [r[0] for r in failed_records] + [r[0] for r in dead_letter_records]
        settle_stmt = select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.outbox_id.in_(all_ids))
        settle_events = {e.outbox_id: e for e in (await session.execute(settle_stmt)).scalars().all()}

        for outbox_id in dispatched_ids:
            if outbox_id in settle_events:
                se = settle_events[outbox_id]
                se.status = "DISPATCHED"
                se.dispatched_at = settle_now
                se.claim_expires_at = None
                se.error_message = None

        for outbox_id, retry_cnt, err in failed_records:
            if outbox_id in settle_events:
                se = settle_events[outbox_id]
                se.status = "FAILED"
                se.retry_count = retry_cnt
                se.error_message = err
                se.claim_expires_at = None
                backoff = base_backoff_seconds * (2 ** max(0, retry_cnt - 1))
                se.next_attempt_at = settle_now + timedelta(seconds=backoff)

        for outbox_id, retry_cnt, err in dead_letter_records:
            if outbox_id in settle_events:
                se = settle_events[outbox_id]
                se.status = "DEAD_LETTER"
                se.retry_count = retry_cnt
                se.error_message = err
                se.claim_expires_at = None
                se.next_attempt_at = None

        await session.commit()

        return {
            "dispatched_count": len(dispatched_ids),
            "failed_count": len(failed_records),
            "dead_letter_count": len(dead_letter_records),
            "dispatched_event_ids": dispatched_ids,
            "failed_event_ids": [r[0] for r in failed_records],
            "dead_letter_event_ids": [r[0] for r in dead_letter_records],
            "processed_at": settle_now.isoformat()
        }


    # =========================================================================
    # 2. AUTHORITATIVE OPERATIONAL ANALYTICS PLANE
    # =========================================================================
    @classmethod
    async def get_authoritative_operational_summary(
        cls,
        session: AsyncSession,
        company_id: str
    ) -> Dict[str, Any]:
        """
        Computes real-time operational KPIs directly from PostgreSQL system-of-record ledgers:
        - sales_invoices (CONFIRMED)
        - payment_transactions (COMPLETED)
        - stock_movements
        - integration_outbox_events (PENDING)
        """
        # 1. Total Confirmed Revenue & Invoice Count
        inv_stmt = select(
            func.coalesce(func.sum(SalesInvoice.grand_total), 0.0).label("total_revenue"),
            func.count(SalesInvoice.id).label("confirmed_count")
        ).where(
            SalesInvoice.status == "CONFIRMED",
            SalesInvoice.is_deleted == False
        )
        inv_res = (await session.execute(inv_stmt)).one()
        total_revenue = Decimal(str(inv_res.total_revenue))
        confirmed_invoices = int(inv_res.confirmed_count)

        # 2. Total Settled Payments
        pay_stmt = select(
            func.coalesce(func.sum(PaymentTransaction.amount), 0.0).label("total_paid")
        ).where(
            PaymentTransaction.status == "COMPLETED",
            PaymentTransaction.is_deleted == False
        )
        pay_res = (await session.execute(pay_stmt)).scalar_one()
        total_payments = Decimal(str(pay_res))

        # 3. Total Stock Movements Count
        sm_stmt = select(func.count(StockMovement.id)).where(StockMovement.is_deleted == False)
        sm_count = (await session.execute(sm_stmt)).scalar_one()

        # 4. Pending Outbox Events
        out_stmt = select(func.count(IntegrationOutboxEvent.outbox_id)).where(
            IntegrationOutboxEvent.status == "PENDING"
        )
        pending_outbox = (await session.execute(out_stmt)).scalar_one()

        return {
            "company_id": company_id,
            "total_revenue": float(total_revenue),
            "confirmed_invoice_count": confirmed_invoices,
            "total_payments_collected": float(total_payments),
            "total_stock_movements": int(sm_count),
            "pending_outbox_events": int(pending_outbox),
            "generated_at": datetime.now(timezone.utc).isoformat()
        }

