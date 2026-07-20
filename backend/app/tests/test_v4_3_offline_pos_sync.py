"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.3.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.api.deps import get_db
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
async def test_offline_pos_sync_service(db_session):
    """Verifies OfflineSyncService batch syncing and duplicate invoice deduplication."""
    svc = OfflineSyncService(db_session)
    invoices = [
        {"client_invoice_id": "c_101", "invoice_number": "INV-OFF-101", "grand_total": 450.0},
        {"client_invoice_id": "c_102", "invoice_number": "INV-OFF-102", "grand_total": 1250.0},
    ]

    res1 = await svc.sync_offline_invoices(invoices=invoices)
    assert res1["status"] == "COMPLETED"
    assert res1["processed_count"] == 2
    assert res1["skipped_duplicates"] == 0

    # Re-submitting same batch should skip duplicates idempotently
    res2 = await svc.sync_offline_invoices(invoices=invoices)
    assert res2["processed_count"] == 0
    assert res2["skipped_duplicates"] == 2


@pytest.mark.asyncio
async def test_offline_pos_sync_rest_api(db_session):
    """Verifies REST API endpoint /api/v1/pos/offline-sync."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/pos/offline-sync",
            json={
                "shift_id": "SHIFT-99",
                "invoices": [
                    {"client_invoice_id": "c_201", "invoice_number": "INV-OFF-201", "grand_total": 880.0}
                ]
            }
        )
        assert res.status_code == 200
        assert res.json()["success"] is True
        assert res.json()["processed_count"] == 1
        assert "INV-OFF-201" in res.json()["synced_invoice_numbers"]
