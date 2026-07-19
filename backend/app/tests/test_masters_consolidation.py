"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-07-14
Modified     : 2026-07-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.master_lookup import MasterType, MasterValue
from app.api.deps import get_db
from app.core.security import hash_password, create_access_token
from app.tests.conftest import clear_db

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
async def override_db(db_session):
    await clear_db(db_session)

    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)


async def _setup_admin_and_auth_headers(db_session):
    company = Company(
        id="comp-test-1",
        name="Test Company",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    branch = Branch(
        id="br-test-1",
        company_id=company.id,
        name="Test Branch",
        code="BR-TEST-1",
        is_active=True,
    )
    user = User(
        id="usr-admin-1",
        username="admin_user",
        email="admin@smriti.test",
        hashed_password=hash_password("Admin@1234"),
        role=UserRole.SYSADMIN,
        is_active=True,
        is_deleted=False,
        company_id=company.id,
        branch_id=branch.id,
    )
    db_session.add_all([company, branch, user])
    await db_session.commit()

    token = create_access_token(data={"sub": user.id})
    headers = {"Authorization": f"Bearer {token}"}
    return company, branch, user, headers


# ===========================================================================
# Tier-2 masters tests
# ===========================================================================

async def test_company_crud(db_session):
    company, branch, user, headers = await _setup_admin_and_auth_headers(db_session)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create company
        res_create = await client.post("/api/v1/masters/companies", headers=headers, json={
            "name": "New Company LLC",
            "gstNumber": "27XXXXX1234F1ZX",
            "status": "Active"
        })
        assert res_create.status_code == 201
        data_create = res_create.json()
        assert "comp-" in data_create["id"]
        assert data_create["name"] == "New Company LLC"
        assert data_create["gstNumber"] == "27XXXXX1234F1ZX"
        assert data_create["status"] == "Active"

        new_comp_id = data_create["id"]

        # 2. Get list of companies
        res_list = await client.get("/api/v1/masters/companies", headers=headers)
        assert res_list.status_code == 200
        data_list = res_list.json()
        assert len(data_list) == 2  # default test-1 company + new one
        assert any(x["id"] == new_comp_id for x in data_list)

        # 3. Update company
        res_update = await client.put(f"/api/v1/masters/companies/{new_comp_id}", headers=headers, json={
            "name": "Updated Company LLC",
            "gstNumber": "27YYYYY1234F1ZX",
            "status": "Inactive"
        })
        assert res_update.status_code == 200
        data_update = res_update.json()
        assert data_update["name"] == "Updated Company LLC"
        assert data_update["gstNumber"] == "27YYYYY1234F1ZX"
        assert data_update["status"] == "Inactive"

        # 4. Delete (soft-delete) company
        res_delete = await client.delete(f"/api/v1/masters/companies/{new_comp_id}", headers=headers)
        assert res_delete.status_code == 200
        assert res_delete.json() == {"success": True, "deletedId": new_comp_id}

        # Check list again, it should be soft-deleted
        res_list_after = await client.get("/api/v1/masters/companies", headers=headers)
        assert res_list_after.status_code == 200
        data_list_after = res_list_after.json()
        assert len(data_list_after) == 1
        assert not any(x["id"] == new_comp_id for x in data_list_after)


async def test_branch_store_warehouse_crud(db_session):
    company, branch, user, headers = await _setup_admin_and_auth_headers(db_session)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create Branch
        res_branch = await client.post("/api/v1/masters/branches", headers=headers, json={
            "company": company.id,
            "name": "Second Branch",
            "code": "BR-SECOND"
        })
        assert res_branch.status_code == 201
        new_branch_id = res_branch.json()["id"]

        # Create Store
        res_store = await client.post("/api/v1/masters/stores", headers=headers, json={
            "branch": branch.id,
            "code": "ST-01",
            "name": "Main Retail Store",
            "store_type": "Retail",
            "address": "123 Main Street",
            "status": "Active"
        })
        assert res_store.status_code == 201
        new_store_id = res_store.json()["id"]

        # Create Warehouse
        res_wh = await client.post("/api/v1/masters/warehouses", headers=headers, json={
            "branch": branch.id,
            "code": "WH-01",
            "name": "Central Distribution Warehouse",
            "is_transit": False,
            "address": "456 industrial area",
            "status": "Active"
        })
        assert res_wh.status_code == 201
        new_wh_id = res_wh.json()["id"]

        # Get list stores
        res_stores = await client.get("/api/v1/masters/stores", headers=headers)
        assert len(res_stores.json()) == 1

        # Soft delete Store
        res_del = await client.delete(f"/api/v1/masters/stores/{new_store_id}", headers=headers)
        assert res_del.status_code == 200


# ===========================================================================
# Tier-1 lookups tests (types & values with jsonschema validation)
# ===========================================================================

async def test_lookups_validation_and_soft_delete(db_session):
    company, branch, user, headers = await _setup_admin_and_auth_headers(db_session)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create a MasterType (lookup definition)
        res_type = await client.post("/api/v1/masters/lookup-types", headers=headers, json={
            "code": "department",
            "label": "Company Department",
            "field_schema": {
                "type": "object",
                "properties": {
                    "cost_center": {"type": "string"},
                    "budget": {"type": "number"}
                },
                "required": ["cost_center"],
                "additionalProperties": False
            }
        })
        assert res_type.status_code == 201

        # 2. Attempt to create valid lookup value
        res_val_ok = await client.post("/api/v1/masters/lookup/department/values", headers=headers, json={
            "code": "HR",
            "name": "Human Resources",
            "data": {"cost_center": "CC-HR-01", "budget": 50000}
        })
        assert res_val_ok.status_code == 201
        val_id = res_val_ok.json()["id"]

        # 3. Attempt to create invalid lookup value (fails schema validation)
        res_val_fail = await client.post("/api/v1/masters/lookup/department/values", headers=headers, json={
            "code": "FIN",
            "name": "Finance",
            "data": {"cost_center": 12345}  # should be string
        })
        assert res_val_fail.status_code == 400
        assert "Validation failed" in res_val_fail.json()["detail"]

        # 4. Attempt to create invalid lookup value (violates additionalProperties)
        res_val_fail2 = await client.post("/api/v1/masters/lookup/department/values", headers=headers, json={
            "code": "IT",
            "name": "Information Tech",
            "data": {"cost_center": "CC-IT-01", "extra": "garbage"}
        })
        assert res_val_fail2.status_code == 400

        # 5. List lookup values (should have 1 HR)
        res_list = await client.get("/api/v1/masters/lookup/department/values", headers=headers)
        assert len(res_list.json()) == 1

        # 6. Soft delete lookup value
        res_del = await client.delete(f"/api/v1/masters/lookup/department/values/{val_id}", headers=headers)
        assert res_del.status_code == 200
        assert res_del.json()["success"] is True

        # 7. Verify soft deleted item is filtered out from active list
        res_list_after = await client.get("/api/v1/masters/lookup/department/values", headers=headers)
        assert len(res_list_after.json()) == 0
