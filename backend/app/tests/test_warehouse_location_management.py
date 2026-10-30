"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.72.9
Created      : 2026-10-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Test Suite: Warehouse Location & Matrix Management Standardization
Validates CRUD, filtering, 1-click matrix generation, and stock inspection.
"""

import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from app.main import app
from app.models.tenant import Company, Branch
from app.models.inventory import Warehouse, WarehouseLocation
from app.models.auth import User, UserRole
from app.models.capability_template import FeatureFlag
from app.core.security import create_access_token
from app.api.deps import get_db, get_company_db

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
async def setup_test_context(db_session):
    """Wire test session into FastAPI dependency overrides."""
    async def _get_test_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_test_db
    app.dependency_overrides[get_company_db] = _get_test_db
    yield
    app.dependency_overrides.clear()


async def _create_test_tenant(db_session, suffix: str, enable_bin_locations: bool = True):
    """Create test company, branch, warehouse, and sysadmin user."""
    uid = uuid.uuid4().hex[:6]
    co_id = f"comp-loc-{suffix}-{uid}"
    br_id = f"br-loc-{suffix}-{uid}"
    wh_id = f"wh-loc-{suffix}-{uid}"

    company = Company(
        id=co_id,
        name=f"Location Test Co {uid}",
        gst_number="27AAAAA0000A1Z5",
        is_active=True,
    )
    branch = Branch(
        id=br_id,
        company_id=co_id,
        name=f"Location Test Br {uid}",
        code=f"LBR-{uid}",
        is_active=True,
    )
    warehouse = Warehouse(
        id=wh_id,
        company_id=co_id,
        branch_id=br_id,
        code=f"WH-{uid.upper()}",
        name=f"Central Godown {uid}",
        is_active=True,
        is_central_godown=True,
    )
    user = User(
        id=f"usr-loc-{uid}",
        company_id=co_id,
        branch_id=br_id,
        username=f"admin_loc_{uid}",
        email=f"loc_{uid}@test.com",
        hashed_password="mock_hash",
        role=UserRole.SYSADMIN,
        is_active=True,
    )

    db_session.add(company)
    await db_session.flush()
    db_session.add(branch)
    await db_session.flush()
    db_session.add(warehouse)
    await db_session.flush()
    db_session.add(user)
    feature_flag = await db_session.scalar(
        select(FeatureFlag).where(FeatureFlag.key == "BIN_LOCATION_MANAGEMENT")
    )
    if not feature_flag:
        feature_flag = FeatureFlag(
            id="ff_bin_location_management_test",
            key="BIN_LOCATION_MANAGEMENT",
            name="Bin and Rack Location Management",
            category="INVENTORY",
            is_global_enabled=False,
            company_overrides={},
            is_active=True,
            is_deleted=False,
        )
        db_session.add(feature_flag)
        await db_session.flush()
    overrides = dict(feature_flag.company_overrides or {})
    overrides[co_id] = enable_bin_locations
    feature_flag.company_overrides = overrides
    await db_session.commit()

    token = create_access_token(data={
        "sub": user.id,
        "company_id": co_id,
        "branch_id": br_id,
        "role": UserRole.SYSADMIN.value,
    })
    headers = {"Authorization": f"Bearer {token}"}
    return company, branch, warehouse, user, headers


async def test_create_and_list_warehouse_location(db_session):
    """Verify single location creation with auto-barcode generation and listing."""
    company, branch, warehouse, user, headers = await _create_test_tenant(db_session, "create")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Create a location
        payload = {
            "warehouse_id": warehouse.id,
            "code": "ST-A01-R01-S01-B01",
            "name": "Aisle 1, Rack 1, Shelf 1, Bin 1",
            "zone": "STORAGE",
            "aisle": "A01",
            "rack": "R01",
            "shelf": "S01",
            "bin_code": "B01",
            "max_capacity_units": 150,
        }
        resp = await ac.post(f"/api/v1/wms/warehouses/{warehouse.id}/locations", json=payload, headers=headers)
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["code"] == "ST-A01-R01-S01-B01"
        assert data["zone"] == "STORAGE"
        assert data["barcode"] == f"LOC-{warehouse.code}-ST-A01-R01-S01-B01"
        loc_id = data["id"]

        # 2. Reject duplicate code in same warehouse
        dup_resp = await ac.post(f"/api/v1/wms/warehouses/{warehouse.id}/locations", json=payload, headers=headers)
        assert dup_resp.status_code == 400
        assert "already exists" in dup_resp.json()["detail"]

        # 3. List locations across company
        list_resp = await ac.get(f"/api/v1/wms/locations?warehouse_id={warehouse.id}", headers=headers)
        assert list_resp.status_code == 200
        items = list_resp.json()
        assert len(items) == 1
        assert items[0]["id"] == loc_id


async def test_update_and_delete_warehouse_location(db_session):
    """Verify updating and soft-deleting a warehouse location."""
    company, branch, warehouse, user, headers = await _create_test_tenant(db_session, "upddel")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create
        create_resp = await ac.post(f"/api/v1/wms/warehouses/{warehouse.id}/locations", json={
            "warehouse_id": warehouse.id,
            "code": "PK-A01-R01-S01-B01",
            "name": "Front Picking Bin",
            "zone": "PICKING",
        }, headers=headers)
        assert create_resp.status_code == 201
        loc_id = create_resp.json()["id"]

        # Update
        update_resp = await ac.put(f"/api/v1/wms/locations/{loc_id}", json={
            "name": "Front Counter Fast Picking Tier",
            "max_capacity_units": 200,
            "is_locked": True,
        }, headers=headers)
        assert update_resp.status_code == 200
        upd_data = update_resp.json()
        assert upd_data["name"] == "Front Counter Fast Picking Tier"
        assert upd_data["max_capacity_units"] == 200
        assert upd_data["is_locked"] is True

        # Delete
        del_resp = await ac.delete(f"/api/v1/wms/locations/{loc_id}", headers=headers)
        assert del_resp.status_code == 200
        assert del_resp.json()["success"] is True

        # Verify not in active list
        list_resp = await ac.get(f"/api/v1/wms/locations?warehouse_id={warehouse.id}", headers=headers)
        assert list_resp.status_code == 200
        assert len(list_resp.json()) == 0


async def test_generate_warehouse_locations_matrix(db_session):
    """Verify 1-click batch matrix generation (Aisles x Racks x Shelves x Bins)."""
    company, branch, warehouse, user, headers = await _create_test_tenant(db_session, "matrix")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 2 Aisles (1..2) x 2 Racks (1..2) x 2 Shelves (1..2) x 1 Bin (1..1) = 8 Bins
        matrix_req = {
            "zone": "STORAGE",
            "aisle_prefix": "A",
            "aisle_from": 1,
            "aisle_to": 2,
            "rack_prefix": "R",
            "rack_from": 1,
            "rack_to": 2,
            "shelf_prefix": "S",
            "shelf_from": 1,
            "shelf_to": 2,
            "bin_prefix": "B",
            "bin_from": 1,
            "bin_to": 1,
            "max_capacity_units": 100,
        }
        gen_resp = await ac.post(f"/api/v1/wms/warehouses/{warehouse.id}/locations/generate", json=matrix_req, headers=headers)
        assert gen_resp.status_code == 201, gen_resp.text
        res_data = gen_resp.json()
        assert res_data["created_count"] == 8
        assert res_data["skipped_count"] == 0
        assert len(res_data["locations"]) == 8

        # Calling again should skip all 8 as existing duplicates
        dup_gen_resp = await ac.post(f"/api/v1/wms/warehouses/{warehouse.id}/locations/generate", json=matrix_req, headers=headers)
        assert dup_gen_resp.status_code == 201
        dup_data = dup_gen_resp.json()
        assert dup_data["created_count"] == 0
        assert dup_data["skipped_count"] == 8


async def test_inspect_location_stock(db_session):
    """Verify location stock inspector endpoint."""
    company, branch, warehouse, user, headers = await _create_test_tenant(db_session, "stock")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        create_resp = await ac.post(f"/api/v1/wms/warehouses/{warehouse.id}/locations", json={
            "warehouse_id": warehouse.id,
            "code": "ST-A01-R01-S01-B01",
            "name": "Main Test Bin",
            "zone": "STORAGE",
        }, headers=headers)
        assert create_resp.status_code == 201
        loc_id = create_resp.json()["id"]

        stock_resp = await ac.get(f"/api/v1/wms/locations/{loc_id}/stock", headers=headers)
        assert stock_resp.status_code == 200
        stock_data = stock_resp.json()
        assert stock_data["location"]["id"] == loc_id
        assert stock_data["assigned_items_count"] == 0
        assert stock_data["items"] == []


async def test_location_management_is_disabled_without_company_override(db_session):
    company, branch, warehouse, user, headers = await _create_test_tenant(
        db_session, "disabled", enable_bin_locations=False
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post(f"/api/v1/wms/warehouses/{warehouse.id}/locations", json={
            "warehouse_id": warehouse.id,
            "code": "ST-A01-R01-S01-B01",
            "name": "Main Test Bin",
            "zone": "STORAGE",
        }, headers=headers)

    assert resp.status_code == 403
    assert "disabled" in resp.json()["detail"]
