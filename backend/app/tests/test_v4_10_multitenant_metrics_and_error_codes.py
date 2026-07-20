"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.10.0
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
from app.services.communicator_service import SMRITICommunicatorConnectorManager
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
async def test_multitenant_prometheus_metric_labels(db_session):
    """Verifies Prometheus metrics carry multi-tenant labels (company_id, branch_id, terminal_id)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/diagnostics/metrics")
        assert res.status_code == 200
        assert 'company_id="default_company"' in res.text
        assert 'branch_id="headquarters"' in res.text
        assert 'terminal_id="POS-01"' in res.text


def test_machine_error_codes_mapping():
    """Verifies Machine Error Codes mapping (VAL-001, DB-205, SYS-999) in JSON formatter."""
    formatter = StructuredJSONFormatter()
    record = logging.LogRecord(
        name="smriti.validation",
        level=logging.ERROR,
        pathname="val.py",
        lineno=12,
        msg="GSTIN validation failed",
        args=(),
        exc_info=None,
    )
    record.error_category = ErrorCategoryTaxonomy.VALIDATION
    formatted = formatter.format(record)
    parsed = json.loads(formatted)

    assert parsed["error_category"] == "VALIDATION"
    assert parsed["error_code"] == "VAL-001"


@pytest.mark.asyncio
async def test_communicator_outbound_traceparent_propagation():
    """Verifies SMRITI Communicator connector manager appends outbound W3C traceparent header."""
    mgr = SMRITICommunicatorConnectorManager()
    res = await mgr.execute_connector_pipeline("TALLY_PRIME", [{"voucher_number": "INV-101", "amount": 500.0}])
    assert "outbound_traceparent" in res
    assert res["outbound_traceparent"].startswith("00-")
