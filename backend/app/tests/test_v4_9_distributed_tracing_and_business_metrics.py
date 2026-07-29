"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.9.0
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
from app.core.logging_config import StructuredJSONFormatter, ErrorCategoryTaxonomy
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
async def test_w3c_traceparent_distributed_tracing_headers(db_session):
    """Verifies W3C traceparent (Trace-ID and Span-ID) header injection and propagation."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"}
        res = await ac.get("/api/v1/diagnostics/health", headers=headers)
        assert res.status_code == 200
        assert "X-Trace-ID" in res.headers
        assert "X-Span-ID" in res.headers
        assert "traceparent" in res.headers
        assert res.headers["X-Trace-ID"] == "4bf92f3577b34da6a3ce929d0e0e4736"


@pytest.mark.asyncio
async def test_business_metrics_prometheus_export(db_session):
    """Verifies Prometheus exposition format exports business metrics (smriti_pos_transactions_total)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/diagnostics/metrics")
        assert res.status_code == 200
        assert "smriti_pos_transactions_total" in res.text
        assert "smriti_invoice_generation_seconds" in res.text
        assert "smriti_sync_queue_pending" in res.text
        assert "smriti_login_total" in res.text


def test_error_taxonomy_json_logging():
    """Verifies ErrorCategoryTaxonomy classification in StructuredJSONFormatter."""
    formatter = StructuredJSONFormatter()
    record = logging.LogRecord(
        name="smriti.db",
        level=logging.ERROR,
        pathname="db.py",
        lineno=45,
        msg="Database deadlock detected",
        args=(),
        exc_info=None,
    )
    record.error_category = ErrorCategoryTaxonomy.DATABASE
    record.trace_id = "trace_999"
    record.span_id = "span_888"

    formatted = formatter.format(record)
    parsed = json.loads(formatted)

    assert parsed["level"] == "ERROR"
    assert parsed["error_category"] == "DATABASE"
    assert parsed["trace_id"] == "trace_999"
    assert parsed["span_id"] == "span_888"
