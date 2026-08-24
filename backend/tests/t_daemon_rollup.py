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

import sys
import uuid
import pytest
from decimal import Decimal
from datetime import datetime, timezone, timedelta, date
from fastapi.testclient import TestClient
from sqlalchemy import select

sys.path.insert(0, "backend")
from app.main import app
from app.db.session import get_company_sessionmaker
from app.models.analytics import AnalyticsDailySalesFact
from app.models.auth import UserRole
from app.core.security import create_access_token
from app.services.analytics_daemon import AnalyticsDaemonService


def get_auth_headers(role: str = "SYSADMIN", company_id: str = "COMP-001", branch_id: str = "BR-001") -> dict:
    """Helper to generate JWT auth headers with tenant claims."""
    token = create_access_token(
        data={
            "sub": "usr-super",
            "role": UserRole.SYSADMIN.value,
            "company_id": company_id,
            "branch_id": branch_id,
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {"Authorization": f"Bearer {token}", "x-company-id": "001"}


@pytest.mark.asyncio
async def test_analytics_daemon_advisory_lock_concurrency_guard():
    """
    Verifies that PostgreSQL advisory locks prevent concurrent daemon executions
    across multiple worker replicas on the same tenant database.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session_a:
        # 1. Session A acquires lock
        locked_a = await AnalyticsDaemonService.try_acquire_advisory_lock(session_a)
        assert locked_a is True

        # 2. Session B attempts to acquire same lock -> Should fail closed (False)
        async with sessionmaker() as session_b:
            locked_b = await AnalyticsDaemonService.try_acquire_advisory_lock(session_b)
            assert locked_b is False

        # 3. Session A releases lock
        released_a = await AnalyticsDaemonService.release_advisory_lock(session_a)
        assert released_a is True

        # 4. Session B can now acquire the lock
        async with sessionmaker() as session_b:
            locked_b_after = await AnalyticsDaemonService.try_acquire_advisory_lock(session_b)
            assert locked_b_after is True
            await AnalyticsDaemonService.release_advisory_lock(session_b)


@pytest.mark.asyncio
async def test_analytics_daemon_tenant_daily_rollup_execution():
    """
    Verifies execution of daily materialized sales fact rollups for a tenant.
    """
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)

    res = await AnalyticsDaemonService.run_tenant_rollup_cycle(
        db_name="smriti001",
        company_id="COMP-001",
        target_dates=[yesterday, today]
    )

    assert res["status"] == "COMPLETED"
    assert res["company_id"] == "COMP-001"
    assert len(res["processed_facts"]) == 2

    # Verify fact stored in PostgreSQL table
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as db:
        stmt = select(AnalyticsDailySalesFact).where(
            AnalyticsDailySalesFact.company_id == "COMP-001",
            AnalyticsDailySalesFact.fact_date == today
        )
        fact = (await db.execute(stmt)).scalar_one_or_none()
        assert fact is not None
        assert fact.total_revenue >= Decimal("0.00")


@pytest.mark.asyncio
async def test_analytics_daemon_multi_tenant_cycle():
    """
    Verifies orchestration of the analytics daemon across multi-tenant database clusters.
    """
    res = await AnalyticsDaemonService.run_multi_tenant_analytics_daemon_cycle(
        tenants=[
            {"db_name": "smriti001", "company_id": "COMP-001"},
            {"db_name": "smriti002", "company_id": "COMP-002"}
        ]
    )

    assert res["tenants_evaluated"] == 2
    assert len(res["tenant_results"]) == 2
    assert all(r["status"] in ["COMPLETED", "SKIPPED_CONCURRENT_RUNNER_ACTIVE"] for r in res["tenant_results"])


def test_analytics_daemon_api_trigger():
    """
    Verifies REST API endpoint /api/v1/analytics/trigger-daemon-cycle.
    """
    client = TestClient(app)
    headers = get_auth_headers()

    res = client.post("/api/v1/analytics/trigger-daemon-cycle", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ["COMPLETED", "SKIPPED_CONCURRENT_RUNNER_ACTIVE"]
    assert data["company_id"] == "COMP-001"
