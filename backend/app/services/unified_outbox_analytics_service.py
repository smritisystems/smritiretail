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
from datetime import datetime, timezone
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
        event_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Polls and dispatches pending outbox events using row-locking (SKIP LOCKED)
        to prevent duplicate dispatch by concurrent workers.
        Invokes dispatcher_callback for actual external publishing.
        Updates status to DISPATCHED or increments retry_count / transitions to DEAD_LETTER.
        """
        filters = [IntegrationOutboxEvent.status == "PENDING"]
        if target_channel:
            filters.append(IntegrationOutboxEvent.target_channel == target_channel)
        if event_type:
            filters.append(IntegrationOutboxEvent.event_type == event_type.strip().upper())

        stmt = (
            select(IntegrationOutboxEvent)
            .where(*filters)
            .order_by(IntegrationOutboxEvent.created_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        events = (await session.execute(stmt)).scalars().all()


        dispatched_ids: List[str] = []
        failed_ids: List[str] = []
        dead_letter_ids: List[str] = []
        now_utc = datetime.now(timezone.utc)

        for evt in events:
            try:
                if dispatcher_callback:
                    await dispatcher_callback(evt)

                evt.status = "DISPATCHED"
                evt.dispatched_at = now_utc
                evt.error_message = None
                dispatched_ids.append(evt.outbox_id)
            except Exception as exc:
                evt.retry_count += 1
                evt.error_message = str(exc)
                if evt.retry_count >= max_retries:
                    evt.status = "DEAD_LETTER"
                    dead_letter_ids.append(evt.outbox_id)
                else:
                    evt.status = "FAILED"
                    failed_ids.append(evt.outbox_id)

        await session.commit()

        return {
            "dispatched_count": len(dispatched_ids),
            "failed_count": len(failed_ids),
            "dead_letter_count": len(dead_letter_ids),
            "dispatched_event_ids": dispatched_ids,
            "failed_event_ids": failed_ids,
            "dead_letter_event_ids": dead_letter_ids,
            "processed_at": now_utc.isoformat()
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

