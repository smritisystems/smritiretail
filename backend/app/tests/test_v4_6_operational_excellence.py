"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.6.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.api.deps import get_db
from app.services.telemetry_service import SystemTelemetryService
from app.tests.conftest import clear_db
from app.db.base import BaseEntity


@pytest.fixture(autouse=True)
async def override_db(db_session):
    async with db_session.bind.begin() as conn:
        await conn.run_sync(BaseEntity.metadata.create_all)
    try:
        await clear_db(db_session)
    except Exception:
        await db_session.rollback()
        await clear_db(db_session)

    async def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    try:
        await clear_db(db_session)
    except Exception:
        await db_session.rollback()
        await clear_db(db_session)


@pytest.mark.asyncio
async def test_telemetry_system_health_probe(db_session):
    """Verifies active system health probe latency and status."""
    svc = SystemTelemetryService(db_session)
    health = await svc.get_system_health()

    assert health["status"] == "HEALTHY"
    assert health["version"] == "4.6.0"
    assert health["database"]["status"] == "HEALTHY"
    assert health["database"]["latency_ms"] >= 0.0


@pytest.mark.asyncio
async def test_telemetry_environment_benchmark_report(db_session):
    """Verifies environment hardware spec reporting."""
    svc = SystemTelemetryService(db_session)
    report = await svc.get_environment_benchmark_report()

    assert "os" in report
    assert "python_version" in report
    assert report["database_engine"] == "PostgreSQL (AsyncSQLAlchemy)"
    assert report["benchmark_context"]["batch_pos_sync_throughput"] == "1000 invoices < 5.0s"


@pytest.mark.asyncio
async def test_telemetry_backup_verification(db_session):
    """Verifies automated database backup integrity probe."""
    svc = SystemTelemetryService(db_session)
    backup = await svc.verify_backup_integrity()

    assert backup["status"] == "VERIFIED"
    assert backup["restoration_test"] == "PASSED"
    assert "SHA256" in backup["integrity_hash"]


@pytest.mark.asyncio
async def test_diagnostics_rest_endpoints(db_session):
    """Verifies REST endpoints under /api/v1/diagnostics/*."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Health Probe Endpoint
        res_health = await ac.get("/api/v1/diagnostics/health")
        assert res_health.status_code == 200
        assert res_health.json()["status"] == "HEALTHY"
