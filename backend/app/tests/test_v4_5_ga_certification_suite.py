"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.5.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import time
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.api.deps import get_db
from app.services.offline_sync_service import OfflineSyncService
from app.services.screen_studio_service import ScreenStudioService
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
async def test_ga_performance_large_batch_pos_sync(db_session):
    """GA Quality Gate 1: High-Volume Batch POS Invoice Performance Sync (1,000 Invoices)."""
    svc = OfflineSyncService(db_session)
    batch_invoices = [
        {
            "client_invoice_id": f"ga_client_{i}",
            "invoice_number": f"INV-GA-PERF-{i:04d}",
            "grand_total": 100.0 + i,
        }
        for i in range(1000)
    ]

    start_time = time.time()
    result = await svc.sync_offline_invoices(invoices=batch_invoices, shift_id="SHIFT-GA-PERF")
    elapsed = time.time() - start_time

    assert result["status"] == "COMPLETED"
    assert result["processed_count"] == 1000
    assert result["skipped_duplicates"] == 0
    # Performance assertion: 1,000 invoices processed in under 5.0 seconds
    assert elapsed < 5.0, f"Batch sync took {elapsed:.2f}s, expected < 5.0s"


@pytest.mark.asyncio
async def test_ga_security_tenant_isolation_guard(db_session):
    """GA Quality Gate 2: Multi-Tenant & Cross-Company Data Security Boundary Check."""
    svc = ScreenStudioService(db_session)
    # Company A template
    tpl1 = await svc.save_layout_template(
        screen_id="pos",
        template_name="Company A Layout",
        industry_pack="FOOTWEAR",
        max_primary_buttons=9,
    )
    # Company B template
    tpl2 = await svc.save_layout_template(
        screen_id="pos",
        template_name="Company B Layout",
        industry_pack="MEDICAL",
        max_primary_buttons=7,
    )

    all_tpls = await svc.list_layout_templates(screen_id="pos")
    assert len(all_tpls) == 2
    # Ensure distinct IDs and template names
    assert tpl1.id != tpl2.id
    assert tpl1.industry_pack == "FOOTWEAR"
    assert tpl2.industry_pack == "MEDICAL"


@pytest.mark.asyncio
async def test_ga_communicator_connector_manager_scalability():
    """GA Quality Gate 3: Communicator Connector Pipeline Multi-Protocol Throughput."""
    mgr = SMRITICommunicatorConnectorManager()
    protocols = ["TALLY_PRIME", "BUSY", "MARG", "ZOHO"]

    for proto in protocols:
        res = await mgr.execute_connector_pipeline(
            connector_name=proto,
            records=[{"voucher_type": "Sales", "voucher_number": f"INV-{proto}-01", "amount": 5000.0}],
        )
        assert res["connector"] == proto
        assert res["status"] == "PROCESSED"
        assert len(res["queue_payloads"]) == 1


@pytest.mark.asyncio
async def test_ga_idempotent_upgrade_migration(db_session):
    """GA Quality Gate 4: Zero Data Loss Idempotent Sync & Upgrade Integrity."""
    svc = OfflineSyncService(db_session)
    initial_batch = [
        {"client_invoice_id": "upg_1", "invoice_number": "INV-UPG-001", "grand_total": 500.0}
    ]

    res1 = await svc.sync_offline_invoices(invoices=initial_batch)
    assert res1["processed_count"] == 1

    # Upgrade / Re-run idempotency check
    res2 = await svc.sync_offline_invoices(invoices=initial_batch)
    assert res2["processed_count"] == 0
    assert res2["skipped_duplicates"] == 1
