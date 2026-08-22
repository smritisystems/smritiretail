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

from ..models.outbox import OutboxEvent
from ..models.sales import SalesInvoice
from ..models.payment_ledger import PaymentTransaction
from ..models.inventory import StockMovement


class UnifiedOutboxAnalyticsService:
    """
    Domain service orchestrating transactional outbox event lifecycle and
    authoritative operational analytics querying directly from PostgreSQL ledgers.
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
        branch_id: str = "BR-001"
    ) -> OutboxEvent:
        """
        Stages a domain event in outbox_events table within the active database transaction.
        Must be committed alongside the domain entity changes.
        """
        event = OutboxEvent(
            id=f"evt_{uuid.uuid4().hex[:14]}",
            company_id=company_id,
            branch_id=branch_id,
            event_type=event_type.strip().upper(),
            aggregate_type=aggregate_type.strip().upper(),
            aggregate_id=aggregate_id,
            payload=payload,
            status="PENDING",
            retry_count=0,
            is_active=True,
            is_deleted=False
        )
        session.add(event)
        return event

    @classmethod
    async def dispatch_pending_outbox_events(
        cls,
        session: AsyncSession,
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        Polls and dispatches pending outbox events using row-locking (SKIP LOCKED)
        to prevent duplicate dispatch by concurrent workers.
        """
        stmt = (
            select(OutboxEvent)
            .where(
                OutboxEvent.status == "PENDING",
                OutboxEvent.is_deleted == False
            )
            .order_by(OutboxEvent.created_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        events = (await session.execute(stmt)).scalars().all()

        dispatched_ids: List[str] = []
        now_utc = datetime.now(timezone.utc)

        for evt in events:
            evt.status = "DISPATCHED"
            evt.dispatched_at = now_utc
            dispatched_ids.append(evt.id)

        await session.commit()

        return {
            "dispatched_count": len(dispatched_ids),
            "dispatched_event_ids": dispatched_ids,
            "dispatched_at": now_utc.isoformat()
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
        - outbox_events (PENDING)
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
        out_stmt = select(func.count(OutboxEvent.id)).where(
            OutboxEvent.status == "PENDING",
            OutboxEvent.is_deleted == False
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
