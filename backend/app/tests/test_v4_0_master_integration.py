"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.0.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.api.deps import get_db
from app.models.auth import User
from app.services.communicator_service import SMRITICommunicatorService
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
async def test_v4_0_communicator_tally_xml_generator():
    """Verifies SMRITI Communicator TallyPrime XML VOUCHER generation."""
    svc = SMRITICommunicatorService()
    xml_out = await svc.generate_tally_xml_payload(
        voucher_type="Sales",
        voucher_number="INV-v4-001",
        date_str="20260720",
        party_name="Retail Customer",
        amount=1500.0,
    )
    assert "<TALLYREQUEST>Import Data</TALLYREQUEST>" in xml_out
    assert 'VOUCHER VCHTYPE="Sales"' in xml_out
    assert "<AMOUNT>1500.0</AMOUNT>" in xml_out


@pytest.mark.asyncio
async def test_v4_0_communicator_sync_queue_submit():
    """Verifies SMRITI Communicator multi-record queue sync processing for Busy/Marg/Zoho."""
    svc = SMRITICommunicatorService()
    res = await svc.process_sync_queue(
        connector_type="BUSY",
        records=[{"inv": "INV-1", "amt": 500.0}, {"inv": "INV-2", "amt": 1200.0}],
    )
    assert res["connector"] == "BUSY"
    assert res["status"] == "SYNCED"
    assert res["processed_records"] == 2


@pytest.mark.asyncio
async def test_v4_0_communicator_rest_endpoints(db_session):
    """Verifies REST endpoints under /api/v1/communicator/*."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Tally Export Endpoint
        res_tally = await ac.post(
            "/api/v1/communicator/tally/export",
            json={
                "voucher_type": "Sales",
                "voucher_number": "INV-API-40",
                "party_name": "Test Party",
                "amount": 2500.0,
            }
        )
        assert res_tally.status_code == 200
        assert res_tally.json()["connector"] == "TALLY_PRIME"
        assert "<ENVELOPE>" in res_tally.json()["xml_payload"]

        # 2. Sync Submit Endpoint
        res_sync = await ac.post(
            "/api/v1/communicator/sync/submit",
            json={
                "connector": "ZOHO",
                "records": [{"id": 1}],
            }
        )
        assert res_sync.status_code == 200
        assert res_sync.json()["status"] == "SYNCED"
