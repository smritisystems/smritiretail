"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.8.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import json
import logging
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.api.deps import get_db
from app.core.logging_config import StructuredJSONFormatter
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
async def test_x_request_id_middleware_header_injection(db_session):
    """Verifies X-Request-ID correlation tracing header injection by middleware."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/diagnostics/health")
        assert res.status_code == 200
        assert "X-Request-ID" in res.headers
        assert "X-Response-Time-Ms" in res.headers
        assert res.headers["X-Request-ID"].startswith("req_")


@pytest.mark.asyncio
async def test_prometheus_metrics_export_endpoint(db_session):
    """Verifies Prometheus text format metrics export at /api/v1/diagnostics/metrics."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/diagnostics/metrics")
        assert res.status_code == 200
        assert "text/plain" in res.headers["content-type"]
        assert "smriti_system_health 1" in res.text
        assert "smriti_db_latency_milliseconds" in res.text


def test_structured_json_formatter():
    """Verifies StructuredJSONFormatter JSON log formatting."""
    formatter = StructuredJSONFormatter()
    record = logging.LogRecord(
        name="smriti.test",
        level=logging.INFO,
        pathname="test.py",
        lineno=10,
        msg="Test structured log",
        args=(),
        exc_info=None,
    )
    record.request_id = "req_12345678"
    formatted_json = formatter.format(record)
    parsed = json.loads(formatted_json)

    assert parsed["level"] == "INFO"
    assert parsed["message"] == "Test structured log"
    assert parsed["request_id"] == "req_12345678"
