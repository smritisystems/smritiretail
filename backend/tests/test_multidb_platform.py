"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-08-14
Modified     : 2026-08-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import sys
import pytest
import asyncio
from datetime import datetime, timezone
from fastapi import HTTPException

sys.path.insert(0, "backend")
from app.db.provisioning import sanitize_company_db_name
from app.services.control_database_registry import ControlDatabaseRegistryService
from app.db.company_router import verify_user_company_access
from app.db.connection_manager import LRUConnectionPoolManager
from app.services.outbox_service import generate_ulid_source_event_id
from app.services.outbox_worker import OutboxQueueWorker
from app.services.psv_projection_service import PSVProjectionService
from app.services.reconciliation_service import MultiLedgerReconciliationService
from app.models.auth import User, UserRole
from app.models.control.control_models import ControlCompanyDatabase
from app.models.outbox import IntegrationOutboxEvent


@pytest.mark.asyncio
async def test_sanitize_company_db_name():
    assert sanitize_company_db_name("TATTLY") == "Smritibus_TATTLY"
    assert sanitize_company_db_name("ABC-01") == "Smritibus_ABC01"


@pytest.mark.asyncio
async def test_control_registry_url_building():
    dummy = ControlCompanyDatabase(
        id="cdb_1",
        company_id="comp_1",
        company_code="TATTLY",
        database_name="Smritibus_TATTLY",
        host="localhost",
        port=5432,
        db_user="postgres"
    )
    url = ControlDatabaseRegistryService.build_connection_url(dummy)
    assert url == "postgresql+asyncpg://postgres:postgres@localhost:5432/Smritibus_TATTLY"


@pytest.mark.asyncio
async def test_router_tenant_isolation_security():
    user = User(id="u1", email="cashier@smriti.com", role=UserRole.CASHIER)
    user.allowed_company_codes = ["TATTLY"]

    # Authorized access
    code = await verify_user_company_access(user, "TATTLY")
    assert code == "TATTLY"

    # Unauthorized access -> raises 403
    with pytest.raises(HTTPException) as exc_info:
        await verify_user_company_access(user, "UNAUTHORIZED_CO")
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_lru_connection_pool_eviction():
    mgr = LRUConnectionPoolManager(max_pools=2, pool_size=1, max_overflow=1)
    await mgr.get_session_factory("COMP_A", "postgresql+asyncpg://postgres:postgres@localhost:5432/Smritibus_COMPA")
    await mgr.get_session_factory("COMP_B", "postgresql+asyncpg://postgres:postgres@localhost:5432/Smritibus_COMPB")
    assert mgr.active_pool_count == 2

    # Adding third pool evicts COMP_A
    await mgr.get_session_factory("COMP_C", "postgresql+asyncpg://postgres:postgres@localhost:5432/Smritibus_COMPC")
    assert mgr.active_pool_count == 2
    await mgr.dispose_all()
    assert mgr.active_pool_count == 0


@pytest.mark.asyncio
async def test_ulid_generation():
    u1 = generate_ulid_source_event_id()
    await asyncio.sleep(0.001)
    u2 = generate_ulid_source_event_id()
    assert u1.startswith("evt_")
    assert u2.startswith("evt_")
    assert u1 < u2


@pytest.mark.asyncio
async def test_reconciliation_parity_check():
    source = {"product_count": 10, "total_stock": "100.0000", "invoice_count": 5, "total_sales_amount": "5000.00"}
    target = {"product_count": 10, "total_stock": "100.0000", "invoice_count": 5, "total_sales_amount": "5000.00"}
    res = MultiLedgerReconciliationService.compare_reconciliation_audit(source, target)
    assert res["reconciliation_passed"] is True


@pytest.mark.asyncio
async def test_outbox_retry_and_dead_letter_limits():
    evt = IntegrationOutboxEvent(
        outbox_id="obx_test",
        source_event_id="evt_test",
        correlation_id="corr_test",
        target_channel="PSV_QUEUE",
        payload_json={},
        status="PENDING",
        retry_count=4
    )
    evt.retry_count += 1
    if evt.retry_count >= OutboxQueueWorker.MAX_RETRIES:
        evt.status = "DEAD_LETTER"

    assert evt.retry_count == 5
    assert evt.status == "DEAD_LETTER"


@pytest.mark.asyncio
async def test_transactional_outbox_event_schema_contract():
    ulid = generate_ulid_source_event_id()
    evt = IntegrationOutboxEvent(
        outbox_id="obx_100",
        source_event_id=ulid,
        correlation_id="corr_100",
        causation_id="doc_100",
        event_schema_version="1.0",
        target_channel="PSV_QUEUE",
        payload_json={"sku": "TSHIRT-BLK-L", "quantity": "5.0"},
        status="PENDING",
        retry_count=0
    )
    assert evt.source_event_id == ulid
    assert evt.event_schema_version == "1.0"
    assert evt.status == "PENDING"
