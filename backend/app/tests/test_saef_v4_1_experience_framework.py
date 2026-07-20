"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.1.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.api.deps import get_db
from app.services.communicator_service import SMRITICommunicatorConnectorManager, SMRITICommunicatorService
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
async def test_communicator_connector_manager_6_stage_pipeline():
    """Verifies Communicator ConnectorManager 6-stage pipeline (Connector -> Protocol -> Transport -> Transformation -> Queue -> Audit)."""
    mgr = SMRITICommunicatorConnectorManager()
    res = await mgr.execute_connector_pipeline(
        connector_name="TALLY_PRIME",
        records=[{
            "voucher_type": "Sales",
            "voucher_number": "INV-SAEF-01",
            "date_str": "20260720",
            "party_name": "Retail Shopper",
            "amount": 3500.0,
        }],
        transport_type="HTTP_REST",
    )

    assert res["connector"] == "TALLY_PRIME"
    assert res["status"] == "PROCESSED"
    assert len(res["pipeline_stages"]) == 6
    assert "<TALLYREQUEST>Import Data</TALLYREQUEST>" in res["queue_payloads"][0]


@pytest.mark.asyncio
async def test_communicator_busy_json_protocol():
    """Verifies Busy JSON protocol payload transformation."""
    svc = SMRITICommunicatorService()
    res = await svc.process_sync_queue(
        connector_type="BUSY",
        records=[{"voucher_type": "Sales", "voucher_number": "INV-BUSY-1", "party_name": "Vendor A", "amount": 1200.0}],
    )
    assert res["connector"] == "BUSY"
    assert res["processed_count"] == 1
    assert res["queue_payloads"][0]["protocol"] == "BUSY_JSON_V1"


@pytest.mark.asyncio
async def test_communicator_rest_api_integration(db_session):
    """Verifies REST endpoints under /api/v1/communicator/*."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/communicator/tally/export",
            json={
                "voucher_type": "Sales",
                "voucher_number": "INV-REST-SAEF",
                "party_name": "Walkin Customer",
                "amount": 990.0,
            }
        )
        assert res.status_code == 200
        assert res.json()["connector"] == "TALLY_PRIME"
