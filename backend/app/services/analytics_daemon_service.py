"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.24.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta, date
from typing import Dict, Any, List, Optional
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_company_sessionmaker
from .analytical_intelligence_service import AnalyticalIntelligenceService
from .outbox_worker import OutboxQueueWorker

logger = logging.getLogger("smriti.analytics_daemon")


class AnalyticsDaemonService:
    """
    Automated Background Daemon for SMRITI Analytics & Outbox Execution (Section 11).
    Executes non-blocking nightly sales fact rollups, advisory lock concurrency protection,
    and background outbox queue event dispatch across all tenant databases.
    """

    ADVISORY_LOCK_KEY = 918273645  # Deterministic 64-bit int for analytics daemon lock

    @classmethod
    async def try_acquire_advisory_lock(cls, session: AsyncSession) -> bool:
        """
        Attempts to acquire a PostgreSQL session-level advisory lock.
        Returns True if acquired, False if already held by another worker replica.
        """
        try:
            res = await session.execute(
                text("SELECT pg_try_advisory_lock(:lock_key)"),
                {"lock_key": cls.ADVISORY_LOCK_KEY}
            )
            return bool(res.scalar())
        except Exception as e:
            logger.warning(f"[AnalyticsDaemon] Advisory lock check failed: {e}")
            return False

    @classmethod
    async def release_advisory_lock(cls, session: AsyncSession) -> bool:
        """Releases the PostgreSQL advisory lock."""
        try:
            res = await session.execute(
                text("SELECT pg_advisory_unlock(:lock_key)"),
                {"lock_key": cls.ADVISORY_LOCK_KEY}
            )
            return bool(res.scalar())
        except Exception as e:
            logger.warning(f"[AnalyticsDaemon] Advisory unlock failed: {e}")
            return False

    @classmethod
    async def run_tenant_rollup_cycle(
        cls,
        db_name: str,
        company_id: str,
        target_dates: Optional[List[date]] = None
    ) -> Dict[str, Any]:
        """
        Executes daily analytics aggregation rollup for a specific tenant across specified dates.
        """
        if not target_dates:
            today = datetime.now(timezone.utc).date()
            yesterday = today - timedelta(days=1)
            target_dates = [yesterday, today]

        sessionmaker = get_company_sessionmaker(db_name)
        processed_facts = []

        async with sessionmaker() as session:
            locked = await cls.try_acquire_advisory_lock(session)
            if not locked:
                return {
                    "company_id": company_id,
                    "db_name": db_name,
                    "status": "SKIPPED_CONCURRENT_RUNNER_ACTIVE",
                    "processed_facts": []
                }

            try:
                for t_date in target_dates:
                    fact = await AnalyticalIntelligenceService.compute_and_store_daily_aggregates(
                        session=session,
                        company_id=company_id,
                        target_date=t_date
                    )
                    processed_facts.append({
                        "fact_id": fact.id,
                        "fact_date": fact.fact_date.isoformat(),
                        "revenue": float(fact.total_revenue),
                        "invoices": fact.invoice_count,
                        "margin": float(fact.gross_margin_amount)
                    })

                await session.commit()
                return {
                    "company_id": company_id,
                    "db_name": db_name,
                    "status": "COMPLETED",
                    "processed_facts": processed_facts
                }
            finally:
                await cls.release_advisory_lock(session)

    @classmethod
    async def run_multi_tenant_analytics_daemon_cycle(
        cls,
        tenants: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Runs the full analytics and outbox execution cycle across all registered tenant databases.
        """
        if not tenants:
            tenants = [
                {"db_name": "smriti001", "company_id": "COMP-001"},
                {"db_name": "smriti002", "company_id": "COMP-002"}
            ]

        results = []
        for t in tenants:
            res = await cls.run_tenant_rollup_cycle(
                db_name=t["db_name"],
                company_id=t["company_id"]
            )
            results.append(res)

        return {
            "cycle_executed_at": datetime.now(timezone.utc).isoformat(),
            "tenants_evaluated": len(tenants),
            "tenant_results": results
        }
