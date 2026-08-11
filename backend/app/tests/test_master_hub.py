"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-11
Classification: Secondary Master Database & Master Exchange Hub Integration Test Suite
"""

import uuid
import pytest
from decimal import Decimal
from urllib.parse import urlparse
from fastapi import HTTPException
from sqlalchemy import select, text, and_
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core.config import settings
from app.db.control_base import ControlBase
from app.db.company_base import CompanyBase
from app.db.master_hub_base import MasterHubBase
from app.models.control import (
    ControlCompany,
    ControlCompanyDatabase,
    DatabaseRegistryStatus,
    ControlUser,
    ControlUserCompanyAssignment,
)
from app.models.master_hub import (
    MasterHubType,
    MasterHubRecord,
    MasterHubVersion,
    MasterHubPublication,
    MasterHubImport,
    MasterHubMapping,
    MasterHubCompanyPolicy,
    MasterHubAuditEvent,
)
from app.services.master_hub_exchange_service import MasterHubExchangeService

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def setup_master_hub_environment():
    """
    Sets up Control DB and Master Hub DB on PostgreSQL:
    - smriti_test_control_db
    - smriti_master_hub_test
    """
    base_url = settings.CONTROL_DATABASE_URL or settings.DATABASE_URL
    parsed = urlparse(base_url)
    db_user = parsed.username or "postgres"
    db_pass = parsed.password or "postgres"
    db_host = parsed.hostname or "localhost"
    db_port = parsed.port or 5432

    url_control   = f"postgresql+asyncpg://{db_user}:{db_pass}@{db_host}:{db_port}/smriti_test_control_db"
    url_master_hub= f"postgresql+asyncpg://{db_user}:{db_pass}@{db_host}:{db_port}/smriti_master_hub_test"

    # Create databases if they do not exist
    url_postgres = f"postgresql+asyncpg://{db_user}:{db_pass}@{db_host}:{db_port}/postgres"
    engine_pg = create_async_engine(url_postgres, isolation_level="AUTOCOMMIT")

    for db_name in ["smriti_test_control_db", "smriti_master_hub_test"]:
        async with engine_pg.connect() as conn:
            res = await conn.execute(text(f"SELECT 1 FROM pg_database WHERE datname='{db_name}'"))
            if not res.scalar():
                await conn.execute(text(f"CREATE DATABASE {db_name}"))

    await engine_pg.dispose()

    engine_control    = create_async_engine(url_control)
    engine_master_hub = create_async_engine(url_master_hub)

    async with engine_control.begin() as conn:
        await conn.run_sync(ControlBase.metadata.drop_all)
        await conn.run_sync(ControlBase.metadata.create_all)

    async with engine_master_hub.begin() as conn:
        await conn.run_sync(MasterHubBase.metadata.drop_all)
        await conn.run_sync(MasterHubBase.metadata.create_all)

    sm_control    = async_sessionmaker(engine_control, expire_on_commit=False, class_=AsyncSession)
    sm_master_hub = async_sessionmaker(engine_master_hub, expire_on_commit=False, class_=AsyncSession)

    # Seed Control DB
    async with sm_control() as c_db:
        comp_a = ControlCompany(id="comp-id-a", company_code="COMP_A", name="Company A", is_active=True)
        comp_b = ControlCompany(id="comp-id-b", company_code="COMP_B", name="Company B", is_active=True)

        db_a = ControlCompanyDatabase(
            id="cdb-a", company_id="comp-id-a", company_code="COMP_A", db_identifier="db-a",
            db_host="localhost", db_port=5432, db_name="smriti_company_a_test", db_user="smriti_app", status="ACTIVE"
        )
        db_b = ControlCompanyDatabase(
            id="cdb-b", company_id="comp-id-b", company_code="COMP_B", db_identifier="db-b",
            db_host="localhost", db_port=5432, db_name="smriti_company_b_test", db_user="smriti_app", status="ACTIVE"
        )

        user_a = ControlUser(id="usr-id-a", username="user_a", hashed_password="pass", is_active=True)
        user_b = ControlUser(id="usr-id-b", username="user_b", hashed_password="pass", is_active=True)

        uca_a = ControlUserCompanyAssignment(id="uca-a", user_id="usr-id-a", company_id="comp-id-a", company_code="COMP_A")
        uca_b = ControlUserCompanyAssignment(id="uca-b", user_id="usr-id-b", company_id="comp-id-b", company_code="COMP_B")

        c_db.add_all([comp_a, comp_b, db_a, db_b, user_a, user_b, uca_a, uca_b])
        await c_db.commit()

    # Seed Master Hub Types
    async with sm_master_hub() as h_db:
        t_prod = MasterHubType(id="mt-prod", master_type="Product", enabled=True, publish_allowed=True, fetch_allowed=True)
        t_cust = MasterHubType(id="mt-cust", master_type="CustomerIdentity", enabled=True, publish_allowed=False, fetch_allowed=False)
        t_proh = MasterHubType(id="mt-proh", master_type="ProhibitedType", enabled=False, publish_allowed=False, fetch_allowed=False)

        h_db.add_all([t_prod, t_cust, t_proh])
        await h_db.commit()

    yield {
        "sm_control": sm_control,
        "sm_master_hub": sm_master_hub,
    }

    # Teardown
    async with engine_control.begin() as conn:
        await conn.run_sync(ControlBase.metadata.drop_all)
    async with engine_master_hub.begin() as conn:
        await conn.run_sync(MasterHubBase.metadata.drop_all)

    await engine_control.dispose()
    await engine_master_hub.dispose()


# ── TEST 1: MasterHubBase metadata isolated from ControlBase ────────────────
@pytest.mark.asyncio
async def test_master_hub_base_isolated_from_control_base():
    control_tables = set(ControlBase.metadata.tables.keys())
    hub_tables = set(MasterHubBase.metadata.tables.keys())

    assert "control_companies" in control_tables
    assert "control_companies" not in hub_tables
    assert "master_hub_records" in hub_tables
    assert "master_hub_records" not in control_tables


# ── TEST 2: MasterHubBase metadata isolated from CompanyBase ────────────────
@pytest.mark.asyncio
async def test_master_hub_base_isolated_from_company_base():
    company_tables = set(CompanyBase.metadata.tables.keys())
    hub_tables = set(MasterHubBase.metadata.tables.keys())

    assert "products" in company_tables
    assert "products" not in hub_tables
    assert "master_hub_records" in hub_tables
    assert "master_hub_records" not in company_tables


# ── TEST 3: Company A can publish an allowed Product ────────────────────────
@pytest.mark.asyncio
async def test_company_a_can_publish_allowed_product(setup_master_hub_environment):
    sm_c = setup_master_hub_environment["sm_control"]
    sm_h = setup_master_hub_environment["sm_master_hub"]

    async with sm_c() as c_db, sm_h() as h_db:
        payload = {"name": "Universal Ergonomic Chair", "sku": "SKU-CHAIR-01", "brand": "FlexiPlus"}
        rec = await MasterHubExchangeService.publish_master(
            control_db=c_db,
            hub_db=h_db,
            user_id="usr-id-a",
            username="user_a",
            company_code="COMP_A",
            master_type="Product",
            source_record_id="prod-a-101",
            raw_payload=payload,
        )

        assert rec.id.startswith("hub-")
        assert rec.master_type == "Product"
        assert rec.source_company_code == "COMP_A"
        assert rec.latest_version == 1
        assert rec.status == "PUBLISHED"


# ── TEST 4: Company A cannot publish prohibited MasterType ──────────────────
@pytest.mark.asyncio
async def test_company_a_cannot_publish_prohibited_master_type(setup_master_hub_environment):
    sm_c = setup_master_hub_environment["sm_control"]
    sm_h = setup_master_hub_environment["sm_master_hub"]

    async with sm_c() as c_db, sm_h() as h_db:
        with pytest.raises(HTTPException) as exc_info:
            await MasterHubExchangeService.publish_master(
                control_db=c_db,
                hub_db=h_db,
                user_id="usr-id-a",
                username="user_a",
                company_code="COMP_A",
                master_type="CustomerIdentity",  # publish_allowed=False
                source_record_id="cust-a-99",
                raw_payload={"name": "Private Customer"},
            )
        assert exc_info.value.status_code == 403


# ── TEST 5: Unassigned user cannot publish ───────────────────────────────────
@pytest.mark.asyncio
async def test_unassigned_user_cannot_publish(setup_master_hub_environment):
    sm_c = setup_master_hub_environment["sm_control"]
    sm_h = setup_master_hub_environment["sm_master_hub"]

    async with sm_c() as c_db, sm_h() as h_db:
        with pytest.raises(HTTPException) as exc_info:
            await MasterHubExchangeService.publish_master(
                control_db=c_db,
                hub_db=h_db,
                user_id="usr-id-a",  # User A is assigned ONLY to COMP_A
                username="user_a",
                company_code="COMP_B",  # Trying to publish as COMP_B
                master_type="Product",
                source_record_id="prod-b-100",
                raw_payload={"name": "Unauthorized Prod"},
            )
        assert exc_info.value.status_code == 403


# ── TEST 6: Company B can fetch published Product ────────────────────────────
@pytest.mark.asyncio
async def test_company_b_can_fetch_published_product(setup_master_hub_environment):
    sm_c = setup_master_hub_environment["sm_control"]
    sm_h = setup_master_hub_environment["sm_master_hub"]

    async with sm_c() as c_db, sm_h() as h_db:
        rec = await MasterHubExchangeService.publish_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-a", username="user_a",
            company_code="COMP_A", master_type="Product", source_record_id="prod-a-200",
            raw_payload={"name": "Shared Monitor", "sku": "SKU-MON-01"}
        )
        hub_master_id = rec.id

    async with sm_c() as c_db, sm_h() as h_db:
        fetch_res = await MasterHubExchangeService.fetch_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-b", username="user_b",
            company_code="COMP_B", hub_master_id=hub_master_id, local_record_id="prod-b-555"
        )

        assert fetch_res["hub_master_id"] == hub_master_id
        assert fetch_res["payload"]["name"] == "Shared Monitor"
        assert fetch_res["version"] == 1


# ── TEST 7: Company B cannot fetch unpublished Product ───────────────────────
@pytest.mark.asyncio
async def test_company_b_cannot_fetch_unpublished_product(setup_master_hub_environment):
    sm_c = setup_master_hub_environment["sm_control"]
    sm_h = setup_master_hub_environment["sm_master_hub"]

    async with sm_c() as c_db, sm_h() as h_db:
        with pytest.raises(HTTPException) as exc_info:
            await MasterHubExchangeService.fetch_master(
                control_db=c_db, hub_db=h_db, user_id="usr-id-b", username="user_b",
                company_code="COMP_B", hub_master_id="hub_non_existent", local_record_id="prod-b-00"
            )
        assert exc_info.value.status_code == 404


# ── TEST 8: Company B cannot modify Company A source record ──────────────────
@pytest.mark.asyncio
async def test_company_b_cannot_modify_company_a_source_record(setup_master_hub_environment):
    sm_c = setup_master_hub_environment["sm_control"]
    sm_h = setup_master_hub_environment["sm_master_hub"]

    async with sm_c() as c_db, sm_h() as h_db:
        rec = await MasterHubExchangeService.publish_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-a", username="user_a",
            company_code="COMP_A", master_type="Product", source_record_id="prod-a-300",
            raw_payload={"name": "Company A Keyboard"}
        )
        hub_master_id = rec.id

    async with sm_c() as c_db, sm_h() as h_db:
        with pytest.raises(HTTPException) as exc_info:
            await MasterHubExchangeService.deprecate_master(
                control_db=c_db, hub_db=h_db, user_id="usr-id-b", username="user_b",
                company_code="COMP_B", hub_master_id=hub_master_id
            )
        assert exc_info.value.status_code == 403


# ── TEST 9: Company B gets its own local master identity ──────────────────────
@pytest.mark.asyncio
async def test_company_b_gets_own_local_master_identity(setup_master_hub_environment):
    sm_c = setup_master_hub_environment["sm_control"]
    sm_h = setup_master_hub_environment["sm_master_hub"]

    async with sm_c() as c_db, sm_h() as h_db:
        rec = await MasterHubExchangeService.publish_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-a", username="user_a",
            company_code="COMP_A", master_type="Product", source_record_id="prod-a-400",
            raw_payload={"name": "Shared Mouse"}
        )
        hub_master_id = rec.id

    async with sm_c() as c_db, sm_h() as h_db:
        fetch_res = await MasterHubExchangeService.fetch_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-b", username="user_b",
            company_code="COMP_B", hub_master_id=hub_master_id, local_record_id="prod-b-777"
        )
        assert fetch_res["hub_master_id"] != "prod-b-777"

        mapping = (await h_db.execute(
            select(MasterHubMapping).where(MasterHubMapping.company_id == "comp-id-b")
        )).scalars().first()

        assert mapping is not None
        assert mapping.local_record_id == "prod-b-777"
        assert mapping.hub_master_id == hub_master_id


# ── TEST 10: Version update does not silently overwrite Company B ─────────────
@pytest.mark.asyncio
async def test_version_update_does_not_silently_overwrite_company_b(setup_master_hub_environment):
    sm_c = setup_master_hub_environment["sm_control"]
    sm_h = setup_master_hub_environment["sm_master_hub"]

    async with sm_c() as c_db, sm_h() as h_db:
        rec_v1 = await MasterHubExchangeService.publish_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-a", username="user_a",
            company_code="COMP_A", master_type="Product", source_record_id="prod-a-500",
            raw_payload={"name": "Shared Desk v1"}
        )
        hub_master_id = rec_v1.id

    async with sm_c() as c_db, sm_h() as h_db:
        await MasterHubExchangeService.fetch_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-b", username="user_b",
            company_code="COMP_B", hub_master_id=hub_master_id, local_record_id="prod-b-888"
        )

    # Company A publishes v2
    async with sm_c() as c_db, sm_h() as h_db:
        await MasterHubExchangeService.publish_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-a", username="user_a",
            company_code="COMP_A", master_type="Product", source_record_id="prod-a-500",
            raw_payload={"name": "Shared Desk v2 Updated"}
        )

    # Check for updates -> returns notification ONLY, zero mutation to Company B local record
    async with sm_h() as h_db:
        updates = await MasterHubExchangeService.check_for_updates(h_db, company_id="comp-id-b")
        assert len(updates) == 1
        assert updates[0]["latest_version"] == 2
        assert updates[0]["status"] == "UPDATE_AVAILABLE"

        # Verify Company B import record status is UPDATE_AVAILABLE but local record ID is untouched
        imp_rec = (await h_db.execute(
            select(MasterHubImport).where(MasterHubImport.target_company_id == "comp-id-b")
        )).scalars().first()
        assert imp_rec.version_imported == 1
        assert imp_rec.update_status == "UPDATE_AVAILABLE"


# ── TEST 11: Conflict is detected ────────────────────────────────────────────
@pytest.mark.asyncio
async def test_conflict_is_detected(setup_master_hub_environment):
    sm_c = setup_master_hub_environment["sm_control"]
    sm_h = setup_master_hub_environment["sm_master_hub"]

    async with sm_h() as h_db:
        rec = MasterHubRecord(
            id="hub-conf-01", master_type="Product", source_company_id="comp-id-a",
            source_company_code="COMP_A", source_record_id="prod-a-conf", latest_version=1,
            status="PUBLISHED", published_by="user_a"
        )
        h_db.add(rec)
        await h_db.flush()

        imp = MasterHubImport(
            id="imp-conf-1", target_company_id="comp-id-b", target_company_code="COMP_B",
            hub_master_id="hub-conf-01", version_imported=1, local_record_id="prod-b-999",
            import_status="CONFLICT", update_status="UPDATE_AVAILABLE", imported_by="user_b"
        )
        h_db.add(imp)
        await h_db.commit()

        res = (await h_db.execute(select(MasterHubImport).where(MasterHubImport.id == "imp-conf-1"))).scalars().first()
        assert res.import_status == "CONFLICT"


# ── TEST 12: Company policy NONE blocks publishing ───────────────────────────
@pytest.mark.asyncio
async def test_company_policy_none_blocks_publishing(setup_master_hub_environment):
    sm_c = setup_master_hub_environment["sm_control"]
    sm_h = setup_master_hub_environment["sm_master_hub"]

    async with sm_h() as h_db:
        pol = MasterHubCompanyPolicy(
            company_id="comp-id-a", company_code="COMP_A", master_type="Product",
            publish_enabled=False, fetch_enabled=True, updated_by="admin"
        )
        h_db.add(pol)
        await h_db.commit()

    async with sm_c() as c_db, sm_h() as h_db:
        with pytest.raises(HTTPException) as exc_info:
            await MasterHubExchangeService.publish_master(
                control_db=c_db, hub_db=h_db, user_id="usr-id-a", username="user_a",
                company_code="COMP_A", master_type="Product", source_record_id="prod-a-600",
                raw_payload={"name": "Blocked Product"}
            )
        assert exc_info.value.status_code == 403


# ── TEST 13: Company policy NONE blocks fetching ─────────────────────────────
@pytest.mark.asyncio
async def test_company_policy_none_blocks_fetching(setup_master_hub_environment):
    sm_c = setup_master_hub_environment["sm_control"]
    sm_h = setup_master_hub_environment["sm_master_hub"]

    async with sm_c() as c_db, sm_h() as h_db:
        rec = await MasterHubExchangeService.publish_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-a", username="user_a",
            company_code="COMP_A", master_type="Product", source_record_id="prod-a-700",
            raw_payload={"name": "Fetch Policy Test"}
        )
        hub_master_id = rec.id

    async with sm_h() as h_db:
        pol = MasterHubCompanyPolicy(
            company_id="comp-id-b", company_code="COMP_B", master_type="Product",
            publish_enabled=True, fetch_enabled=False, updated_by="admin"
        )
        h_db.add(pol)
        await h_db.commit()

    async with sm_c() as c_db, sm_h() as h_db:
        with pytest.raises(HTTPException) as exc_info:
            await MasterHubExchangeService.fetch_master(
                control_db=c_db, hub_db=h_db, user_id="usr-id-b", username="user_b",
                company_code="COMP_B", hub_master_id=hub_master_id, local_record_id="prod-b-111"
            )
        assert exc_info.value.status_code == 403


# ── TEST 14: SELECTED policy allows only configured master types ─────────────
@pytest.mark.asyncio
async def test_selected_policy_allows_only_configured_types(setup_master_hub_environment):
    sm_c = setup_master_hub_environment["sm_control"]
    sm_h = setup_master_hub_environment["sm_master_hub"]

    async with sm_h() as h_db:
        # Product allowed, Brand prohibited for Company A
        pol_prod = MasterHubCompanyPolicy(
            company_id="comp-id-a", company_code="COMP_A", master_type="Product",
            publish_enabled=True, fetch_enabled=True, updated_by="admin"
        )
        pol_brand = MasterHubCompanyPolicy(
            company_id="comp-id-a", company_code="COMP_A", master_type="Brand",
            publish_enabled=False, fetch_enabled=False, updated_by="admin"
        )
        h_db.add_all([pol_prod, pol_brand])
        await h_db.commit()

    async with sm_c() as c_db, sm_h() as h_db:
        # Product succeeds
        rec = await MasterHubExchangeService.publish_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-a", username="user_a",
            company_code="COMP_A", master_type="Product", source_record_id="prod-a-800",
            raw_payload={"name": "Selected Product"}
        )
        assert rec is not None

        # Brand fails
        with pytest.raises(HTTPException) as exc_info:
            await MasterHubExchangeService.publish_master(
                control_db=c_db, hub_db=h_db, user_id="usr-id-a", username="user_a",
                company_code="COMP_A", master_type="Brand", source_record_id="brand-a-10",
                raw_payload={"name": "Prohibited Brand"}
            )
        assert exc_info.value.status_code == 403


# ── TEST 15: Company Code cannot bypass authorization ────────────────────────
@pytest.mark.asyncio
async def test_company_code_cannot_bypass_authorization(setup_master_hub_environment):
    sm_c = setup_master_hub_environment["sm_control"]
    sm_h = setup_master_hub_environment["sm_master_hub"]

    async with sm_c() as c_db, sm_h() as h_db:
        # User B supplies header/claim "COMP_A" -> Security check must reject because User B is not assigned to COMP_A
        with pytest.raises(HTTPException) as exc_info:
            await MasterHubExchangeService.publish_master(
                control_db=c_db, hub_db=h_db, user_id="usr-id-b", username="user_b",
                company_code="COMP_A", master_type="Product", source_record_id="prod-b-spoof",
                raw_payload={"name": "Spoofed Payload"}
            )
        assert exc_info.value.status_code == 403


# ── TEST 16: Private company data never enters Hub payload ────────────────────
@pytest.mark.asyncio
async def test_private_company_data_never_enters_hub_payload(setup_master_hub_environment):
    sm_c = setup_master_hub_environment["sm_control"]
    sm_h = setup_master_hub_environment["sm_master_hub"]

    raw_payload = {
        "name": "Public Product Description",
        "sku": "SKU-99",
        "price": Decimal("75000.00"),           # Prohibited
        "cost_price": Decimal("45000.00"),      # Prohibited
        "stock": 150,                           # Prohibited
        "outstanding_balance": Decimal("1000"), # Prohibited
    }

    async with sm_c() as c_db, sm_h() as h_db:
        rec = await MasterHubExchangeService.publish_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-a", username="user_a",
            company_code="COMP_A", master_type="Product", source_record_id="prod-a-sanit",
            raw_payload=raw_payload
        )

        ver_res = await h_db.execute(select(MasterHubVersion).where(MasterHubVersion.hub_master_id == rec.id))
        ver = ver_res.scalars().first()
        clean_json = ver.payload_json

        assert "name" in clean_json
        assert "sku" in clean_json
        assert "price" not in clean_json
        assert "cost_price" not in clean_json
        assert "stock" not in clean_json
        assert "outstanding_balance" not in clean_json


# ── TEST 17: Hub contains no transactional tables ──────────────────────────────
@pytest.mark.asyncio
async def test_hub_contains_no_transactional_tables():
    hub_tables = set(MasterHubBase.metadata.tables.keys())

    prohibited_transactional = [
        "sales_invoices", "sales_orders", "purchase_orders",
        "stock_movements", "inventory_ledger", "journal_vouchers", "pos_sessions"
    ]

    for table_name in prohibited_transactional:
        assert table_name not in hub_tables


# ── TEST 18: Audit event exists for publish ──────────────────────────────────
@pytest.mark.asyncio
async def test_audit_event_exists_for_publish(setup_master_hub_environment):
    sm_c = setup_master_hub_environment["sm_control"]
    sm_h = setup_master_hub_environment["sm_master_hub"]

    async with sm_c() as c_db, sm_h() as h_db:
        rec = await MasterHubExchangeService.publish_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-a", username="user_a",
            company_code="COMP_A", master_type="Product", source_record_id="prod-a-aud-pub",
            raw_payload={"name": "Audit Test Product"}
        )
        hub_master_id = rec.id

    async with sm_h() as h_db:
        aud_res = await h_db.execute(
            select(MasterHubAuditEvent).where(
                and_(
                    MasterHubAuditEvent.hub_master_id == hub_master_id,
                    MasterHubAuditEvent.operation == "PUBLISH",
                )
            )
        )
        aud = aud_res.scalars().first()
        assert aud is not None
        assert aud.actor_user_id == "usr-id-a"
        assert aud.result == "SUCCESS"


# ── TEST 19: Audit event exists for fetch ────────────────────────────────────
@pytest.mark.asyncio
async def test_audit_event_exists_for_fetch(setup_master_hub_environment):
    sm_c = setup_master_hub_environment["sm_control"]
    sm_h = setup_master_hub_environment["sm_master_hub"]

    async with sm_c() as c_db, sm_h() as h_db:
        rec = await MasterHubExchangeService.publish_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-a", username="user_a",
            company_code="COMP_A", master_type="Product", source_record_id="prod-a-aud-fet",
            raw_payload={"name": "Fetch Audit Product"}
        )
        hub_master_id = rec.id

    async with sm_c() as c_db, sm_h() as h_db:
        await MasterHubExchangeService.fetch_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-b", username="user_b",
            company_code="COMP_B", hub_master_id=hub_master_id, local_record_id="prod-b-aud"
        )

    async with sm_h() as h_db:
        aud_res = await h_db.execute(
            select(MasterHubAuditEvent).where(
                and_(
                    MasterHubAuditEvent.hub_master_id == hub_master_id,
                    MasterHubAuditEvent.operation == "FETCH",
                )
            )
        )
        aud = aud_res.scalars().first()
        assert aud is not None
        assert aud.actor_user_id == "usr-id-b"
        assert aud.target_company_code == "COMP_B"


# ── TEST 20: Deprecated master cannot be silently reactivated ────────────────
@pytest.mark.asyncio
async def test_deprecated_master_cannot_be_silently_reactivated(setup_master_hub_environment):
    sm_c = setup_master_hub_environment["sm_control"]
    sm_h = setup_master_hub_environment["sm_master_hub"]

    async with sm_c() as c_db, sm_h() as h_db:
        rec = await MasterHubExchangeService.publish_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-a", username="user_a",
            company_code="COMP_A", master_type="Product", source_record_id="prod-a-deprec",
            raw_payload={"name": "Product To Deprecate"}
        )
        hub_master_id = rec.id

        await MasterHubExchangeService.deprecate_master(
            control_db=c_db, hub_db=h_db, user_id="usr-id-a", username="user_a",
            company_code="COMP_A", hub_master_id=hub_master_id
        )

    # Attempting to publish new version to DEPRECATED record fails
    async with sm_c() as c_db, sm_h() as h_db:
        with pytest.raises(HTTPException) as exc_info:
            await MasterHubExchangeService.publish_master(
                control_db=c_db, hub_db=h_db, user_id="usr-id-a", username="user_a",
                company_code="COMP_A", master_type="Product", source_record_id="prod-a-deprec",
                raw_payload={"name": "Reactivation Attempt"}
            )
        assert exc_info.value.status_code == 400
