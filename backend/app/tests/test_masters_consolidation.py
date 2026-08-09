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
        assert len(data_list) >= 2  # default test-1 company + new one (and optionally comp-default)
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
        assert len(data_list_after) in (1, 2)
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


async def test_organization_and_extended_branch_crud(db_session):
    company, branch, user, headers = await _setup_admin_and_auth_headers(db_session)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create Organization
        res_org = await client.post("/api/v1/masters/organizations", headers=headers, json={
            "name": "Smriti Enterprise Network",
            "org_type": "HOLDING",
            "is_active": True
        })
        assert res_org.status_code == 201
        data_org = res_org.json()
        assert "org-" in data_org["id"]
        assert data_org["name"] == "Smriti Enterprise Network"
        assert data_org["org_type"] == "HOLDING"
        org_id = data_org["id"]

        # 2. List Organizations
        res_org_list = await client.get("/api/v1/masters/organizations", headers=headers)
        assert res_org_list.status_code == 200
        assert any(x["id"] == org_id for x in res_org_list.json())

        # 3. Create Extended Branch with ADR-015 fields
        res_ext_br = await client.post("/api/v1/masters/branches", headers=headers, json={
            "company": company.id,
            "name": "Connaught Place Flagship",
            "code": "BR-DELHI-CP",
            "branch_type": "RETAIL",
            "gstin": "07AAAAA0000A1Z5",
            "phone": "+919876543210",
            "email": "cp@smriti.retail"
        })
        assert res_ext_br.status_code == 201
        data_ext_br = res_ext_br.json()
        assert data_ext_br["code"] == "BR-DELHI-CP"
        assert data_ext_br["branch_type"] == "RETAIL"
        assert data_ext_br["gstin"] == "07AAAAA0000A1Z5"
        ext_br_id = data_ext_br["id"]

        # 4. Update Extended Branch
        res_br_upd = await client.put(f"/api/v1/masters/branches/{ext_br_id}", headers=headers, json={
            "name": "Connaught Place Superstore",
            "email": "cp.superstore@smriti.retail"
        })
        assert res_br_upd.status_code == 200
        assert res_br_upd.json()["name"] == "Connaught Place Superstore"
        assert res_br_upd.json()["email"] == "cp.superstore@smriti.retail"


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
        assert res_del.json()["active"] is False

        # 7. Verify soft deleted item is filtered out from active list
        res_list_after = await client.get("/api/v1/masters/lookup/department/values", headers=headers)
        assert len(res_list_after.json()) == 0


# ===========================================================================
# Cross-tenant isolation & field preservation tests
# ===========================================================================

async def _setup_tenant_user_and_headers(db_session, suffix: str):
    tenant_id = f"tenant-{suffix}"
    comp_id = f"comp-{suffix}"
    br_id = f"br-{suffix}"
    user_id = f"usr-{suffix}"

    comp = Company(
        id=comp_id,
        name=f"Company {suffix}",
        gst_number=f"27ABCDE{suffix[:4].upper()}1Z5"[:15],
        is_active=True,
        tenant_id=tenant_id,
    )
    branch = Branch(
        id=br_id,
        company_id=comp.id,
        name=f"Branch {suffix}",
        code=f"BR-{suffix.upper()}",
        is_active=True,
        tenant_id=tenant_id,
    )
    user = User(
        id=user_id,
        username=f"user_{suffix}",
        email=f"user_{suffix}@smriti.test",
        hashed_password=hash_password("Pass@1234"),
        role=UserRole.SYSADMIN,
        is_active=True,
        is_deleted=False,
        is_platform_admin=True,
        company_id=comp.id,
        branch_id=branch.id,
        tenant_id=tenant_id,
    )
    db_session.add_all([comp, branch, user])
    await db_session.commit()

    token = create_access_token(data={
        "sub": user.id,
        "username": user.username,
        "role": user.role.value if isinstance(user.role, UserRole) else str(user.role),
        "company_id": user.company_id,
        "branch_id": user.branch_id,
        "tenant_id": tenant_id,
        "jti": str(uuid.uuid4()),
    })
    headers = {"Authorization": f"Bearer {token}"}
    return comp, branch, user, headers, tenant_id


async def test_organization_tenant_isolation(db_session):
    comp_a, br_a, user_a, headers_a, tenant_a_id = await _setup_tenant_user_and_headers(db_session, "org_a")
    comp_b, br_b, user_b, headers_b, tenant_b_id = await _setup_tenant_user_and_headers(db_session, "org_b")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1 & 2. Create Organization as Tenant A
        res_create = await client.post("/api/v1/masters/organizations", headers=headers_a, json={
            "name": "Tenant A Organization",
            "org_type": "HOLDING"
        })
        assert res_create.status_code == 201
        rec_id = res_create.json()["id"]

        # 3. List Organizations as Tenant B — Tenant A's record must NOT appear
        res_list_b = await client.get("/api/v1/masters/organizations", headers=headers_b)
        assert res_list_b.status_code == 200
        assert not any(x["id"] == rec_id for x in res_list_b.json())

        # 4. Update Organization as Tenant B — must be 403
        res_put = await client.put(f"/api/v1/masters/organizations/{rec_id}", headers=headers_b, json={
            "name": "Hacked Org Name"
        })
        assert res_put.status_code == 403

        # 5. Delete Organization as Tenant B — must be 403
        res_del = await client.delete(f"/api/v1/masters/organizations/{rec_id}", headers=headers_b)
        assert res_del.status_code == 403

        # 6. List Organizations as Tenant A — record is untouched
        res_list_a = await client.get("/api/v1/masters/organizations", headers=headers_a)
        assert res_list_a.status_code == 200
        matching = [x for x in res_list_a.json() if x["id"] == rec_id]
        assert len(matching) == 1
        assert matching[0]["name"] == "Tenant A Organization"


async def test_company_tenant_isolation(db_session):
    comp_a, br_a, user_a, headers_a, tenant_a_id = await _setup_tenant_user_and_headers(db_session, "cmp_a")
    comp_b, br_b, user_b, headers_b, tenant_b_id = await _setup_tenant_user_and_headers(db_session, "cmp_b")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1 & 2. Create Company as Tenant A
        res_create = await client.post("/api/v1/masters/companies", headers=headers_a, json={
            "name": "Tenant A Company LLC",
            "gstNumber": "27AAAAA1234F1ZA",
            "status": "Active"
        })
        assert res_create.status_code == 201
        rec_id = res_create.json()["id"]

        # 3. List Companies as Tenant B — Tenant A's record must NOT appear
        res_list_b = await client.get("/api/v1/masters/companies", headers=headers_b)
        assert res_list_b.status_code == 200
        assert not any(x["id"] == rec_id for x in res_list_b.json())

        # 4. Update Company as Tenant B — must be 403
        res_put = await client.put(f"/api/v1/masters/companies/{rec_id}", headers=headers_b, json={
            "name": "Hacked Company LLC"
        })
        assert res_put.status_code == 403

        # 5. Delete Company as Tenant B — must be 403
        res_del = await client.delete(f"/api/v1/masters/companies/{rec_id}", headers=headers_b)
        assert res_del.status_code == 403

        # 6. List Companies as Tenant A — record is untouched
        res_list_a = await client.get("/api/v1/masters/companies", headers=headers_a)
        assert res_list_a.status_code == 200
        matching = [x for x in res_list_a.json() if x["id"] == rec_id]
        assert len(matching) == 1
        assert matching[0]["name"] == "Tenant A Company LLC"


async def test_branch_tenant_isolation(db_session):
    comp_a, br_a, user_a, headers_a, tenant_a_id = await _setup_tenant_user_and_headers(db_session, "br_a")
    comp_b, br_b, user_b, headers_b, tenant_b_id = await _setup_tenant_user_and_headers(db_session, "br_b")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1 & 2. Create Branch as Tenant A
        res_create = await client.post("/api/v1/masters/branches", headers=headers_a, json={
            "company": comp_a.id,
            "name": "Tenant A Flagship Branch",
            "code": "BR-T-A-01"
        })
        assert res_create.status_code == 201
        rec_id = res_create.json()["id"]

        # 3. List Branches as Tenant B — Tenant A's record must NOT appear
        res_list_b = await client.get("/api/v1/masters/branches", headers=headers_b)
        assert res_list_b.status_code == 200
        assert not any(x["id"] == rec_id for x in res_list_b.json())

        # 4. Update Branch as Tenant B — must be 403
        res_put = await client.put(f"/api/v1/masters/branches/{rec_id}", headers=headers_b, json={
            "name": "Hacked Branch Name"
        })
        assert res_put.status_code == 403

        # 5. Delete Branch as Tenant B — must be 403
        res_del = await client.delete(f"/api/v1/masters/branches/{rec_id}", headers=headers_b)
        assert res_del.status_code == 403

        # 6. List Branches as Tenant A — record is untouched
        res_list_a = await client.get("/api/v1/masters/branches", headers=headers_a)
        assert res_list_a.status_code == 200
        matching = [x for x in res_list_a.json() if x["id"] == rec_id]
        assert len(matching) == 1
        assert matching[0]["name"] == "Tenant A Flagship Branch"


async def test_store_tenant_isolation(db_session):
    comp_a, br_a, user_a, headers_a, tenant_a_id = await _setup_tenant_user_and_headers(db_session, "st_a")
    comp_b, br_b, user_b, headers_b, tenant_b_id = await _setup_tenant_user_and_headers(db_session, "st_b")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1 & 2. Create Store as Tenant A
        res_create = await client.post("/api/v1/masters/stores", headers=headers_a, json={
            "branch": br_a.id,
            "code": "ST-T-A-01",
            "name": "Tenant A Retail Outlet",
            "store_type": "Retail",
            "status": "Active"
        })
        assert res_create.status_code == 201
        rec_id = res_create.json()["id"]

        # 3. List Stores as Tenant B — Tenant A's record must NOT appear
        res_list_b = await client.get("/api/v1/masters/stores", headers=headers_b)
        assert res_list_b.status_code == 200
        assert not any(x["id"] == rec_id for x in res_list_b.json())

        # 4. Update Store as Tenant B — must be 403
        res_put = await client.put(f"/api/v1/masters/stores/{rec_id}", headers=headers_b, json={
            "name": "Hacked Store Name"
        })
        assert res_put.status_code == 403

        # 5. Delete Store as Tenant B — must be 403
        res_del = await client.delete(f"/api/v1/masters/stores/{rec_id}", headers=headers_b)
        assert res_del.status_code == 403

        # 6. List Stores as Tenant A — record is untouched
        res_list_a = await client.get("/api/v1/masters/stores", headers=headers_a)
        assert res_list_a.status_code == 200
        matching = [x for x in res_list_a.json() if x["id"] == rec_id]
        assert len(matching) == 1
        assert matching[0]["name"] == "Tenant A Retail Outlet"


async def test_warehouse_tenant_isolation(db_session):
    comp_a, br_a, user_a, headers_a, tenant_a_id = await _setup_tenant_user_and_headers(db_session, "wh_a")
    comp_b, br_b, user_b, headers_b, tenant_b_id = await _setup_tenant_user_and_headers(db_session, "wh_b")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1 & 2. Create Warehouse as Tenant A
        res_create = await client.post("/api/v1/masters/warehouses", headers=headers_a, json={
            "branch": br_a.id,
            "code": "WH-T-A-01",
            "name": "Tenant A Central Warehouse",
            "is_transit": False,
            "status": "Active"
        })
        assert res_create.status_code == 201
        rec_id = res_create.json()["id"]

        # 3. List Warehouses as Tenant B — Tenant A's record must NOT appear
        res_list_b = await client.get("/api/v1/masters/warehouses", headers=headers_b)
        assert res_list_b.status_code == 200
        assert not any(x["id"] == rec_id for x in res_list_b.json())

        # 4. Update Warehouse as Tenant B — must be 403
        res_put = await client.put(f"/api/v1/masters/warehouses/{rec_id}", headers=headers_b, json={
            "name": "Hacked Warehouse Name"
        })
        assert res_put.status_code == 403

        # 5. Delete Warehouse as Tenant B — must be 403
        res_del = await client.delete(f"/api/v1/masters/warehouses/{rec_id}", headers=headers_b)
        assert res_del.status_code == 403

        # 6. List Warehouses as Tenant A — record is untouched
        res_list_a = await client.get("/api/v1/masters/warehouses", headers=headers_a)
        assert res_list_a.status_code == 200
        matching = [x for x in res_list_a.json() if x["id"] == rec_id]
        assert len(matching) == 1
        assert matching[0]["name"] == "Tenant A Central Warehouse"


async def test_company_response_fields_preservation(db_session):
    company, branch, user, headers = await _setup_admin_and_auth_headers(db_session)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create company
        res_create = await client.post("/api/v1/masters/companies", headers=headers, json={
            "name": "LLP Enterprise Solutions",
            "gstNumber": "27LLPAA1234F1Z9",
            "status": "Active"
        })
        assert res_create.status_code == 201
        comp_id = res_create.json()["id"]

        # Update company with explicit company_type, fiscal_year_start_month, currency_code, is_gst_registered
        res_update = await client.put(f"/api/v1/masters/companies/{comp_id}", headers=headers, json={
            "company_type": "LLP",
            "fiscal_year_start_month": 4,
            "currency_code": "INR",
            "is_gst_registered": True
        })
        assert res_update.status_code == 200

        # 2. Get list of companies
        res_list = await client.get("/api/v1/masters/companies", headers=headers)
        assert res_list.status_code == 200
        matching = [x for x in res_list.json() if x["id"] == comp_id]
        assert len(matching) == 1
        c_data = matching[0]

        # 3. Assert fields preserved (company_type == "LLP", fiscal_year_start_month == 4, currency_code == "INR", is_gst_registered == True)
        assert c_data["company_type"] == "LLP"
        assert c_data["fiscal_year_start_month"] == 4
        assert c_data["currency_code"] == "INR"
        assert c_data["is_gst_registered"] is True

