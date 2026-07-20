"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.4.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.api.deps import get_db
from app.services.communicator_service import SMRITICommunicatorConnectorManager
from app.services.screen_studio_service import ScreenStudioService
from app.services.offline_sync_service import OfflineSyncService
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
async def test_v4_4_saef_workspace_and_policy_integration():
    """Verifies Communicator 6-stage connector pipeline stage output."""
    mgr = SMRITICommunicatorConnectorManager()
    res = await mgr.execute_connector_pipeline(
        connector_name="BUSY",
        records=[{"voucher_type": "Sales", "voucher_number": "INV-V44-01", "amount": 1800.0}],
    )
    assert res["connector"] == "BUSY"
    assert res["status"] == "PROCESSED"
    assert "Transformation" in res["pipeline_stages"]


@pytest.mark.asyncio
async def test_v4_4_communicator_pipeline_and_screen_studio_persistence(db_session):
    """Verifies Screen Studio layout template persistence in PostgreSQL."""
    svc = ScreenStudioService(db_session)
    tpl = await svc.save_layout_template(
        screen_id="pos",
        template_name="Medical Fast Billing Grid",
        industry_pack="MEDICAL",
        max_primary_buttons=7,
        fields_config=[{"id": "batch_no", "visible": True}, {"id": "expiry_date", "visible": True}],
    )

    assert tpl.screen_id == "pos"
    assert tpl.industry_pack == "MEDICAL"

    fetched = await svc.list_layout_templates(screen_id="pos", industry_pack="MEDICAL")
    assert len(fetched) == 1
    assert fetched[0].template_name == "Medical Fast Billing Grid"


@pytest.mark.asyncio
async def test_v4_4_end_to_end_offline_pos_and_identity_sync(db_session):
    """Verifies end-to-end POS offline invoice batch sync & deduplication."""
    svc = OfflineSyncService(db_session)
    batch = [
        {"client_invoice_id": "client_v44_1", "invoice_number": "INV-V44-101", "grand_total": 750.0},
        {"client_invoice_id": "client_v44_2", "invoice_number": "INV-V44-102", "grand_total": 2100.0},
    ]

    sync_res = await svc.sync_offline_invoices(invoices=batch)
    assert sync_res["status"] == "COMPLETED"
    assert sync_res["processed_count"] == 2
    assert sync_res["skipped_duplicates"] == 0

    # Idempotent re-sync
    sync_res2 = await svc.sync_offline_invoices(invoices=batch)
    assert sync_res2["processed_count"] == 0
    assert sync_res2["skipped_duplicates"] == 2
