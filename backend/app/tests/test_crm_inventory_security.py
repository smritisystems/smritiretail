"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-07-19
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.api.deps import get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Branch, Company
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db(db_session):
    await clear_db(db_session)

    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_db, None)
        try:
            await clear_db(db_session)
        except Exception:
            pass


async def _create_test_entities(db_session, role_code=None, user_role=UserRole.CASHIER, permission_codes=None):
    """
    Setup Company, Branch, User, and optionally Role/Policy/Permission assignments.
    """
    comp_id = f"comp-{uuid.uuid4().hex[:6]}"
    br_id = f"br-{uuid.uuid4().hex[:6]}"
    company = Company(
        id=comp_id,
        name="Security Test Company",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    branch = Branch(
        id=br_id,
        company_id=company.id,
        name="Security Test Branch",
        code=f"BR-{uuid.uuid4().hex[:4].upper()}",
        is_active=True,
    )
    user = User(
        id=f"usr-{uuid.uuid4().hex[:6]}",
        username=f"test_sec_{uuid.uuid4().hex[:4]}",
        email=f"sec_{uuid.uuid4().hex[:4]}@smriti.test",
        hashed_password=hash_password("Test@1234"),
        role=user_role,
        is_active=True,
        is_deleted=False,
        company_id=company.id,
        branch_id=branch.id,
    )
    db_session.add_all([company, branch, user])
    await db_session.commit()

    if role_code and permission_codes:
        # Create a dynamic role
        role_id = f"role-{uuid.uuid4().hex[:6]}"
        await db_session.execute(
            text("INSERT INTO smriti_roles (id, uuid, code, name, description, is_system_role, is_active, is_deleted, created_at, modified_at) "
                 "VALUES (:id, :uuid, :code, :name, 'desc', false, true, false, now(), now())"),
            {"id": role_id, "uuid": str(uuid.uuid4()), "code": role_code, "name": f"{role_code} Role"}
        )

        # Map user to role
        await db_session.execute(
            text("INSERT INTO smriti_user_roles (id, uuid, user_id, role_id, is_active, is_deleted, created_at, modified_at) "
                 "VALUES (:id, :uuid, :user_id, :role_id, true, false, now(), now())"),
            {"id": f"ur-{uuid.uuid4().hex[:6]}", "uuid": str(uuid.uuid4()), "user_id": user.id, "role_id": role_id}
        )

        # Create permission set
        permission_set_id = f"pol-{uuid.uuid4().hex[:6]}"
        await db_session.execute(
            text("INSERT INTO smriti_permission_sets (id, uuid, code, name, description, is_active, is_deleted, created_at, modified_at) "
                 "VALUES (:id, :uuid, :code, :name, 'desc', true, false, now(), now())"),
            {"id": permission_set_id, "uuid": str(uuid.uuid4()), "code": f"POL_{role_code}", "name": f"Policy for {role_code}"}
        )

        # Map permission set to role
        await db_session.execute(
            text("INSERT INTO smriti_role_permission_sets (id, uuid, role_id, permission_set_id, created_at, modified_at) "
                 "VALUES (:id, :uuid, :role_id, :permission_set_id, now(), now())"),
            {"id": f"rp-{uuid.uuid4().hex[:6]}", "uuid": str(uuid.uuid4()), "role_id": role_id, "permission_set_id": permission_set_id}
        )

        # Map permissions to permission set
        for perm_code in permission_codes:
            # Get or create permission
            perm_id = await db_session.scalar(
                text("SELECT id FROM smriti_permissions WHERE code = :code"),
                {"code": perm_code}
            )
            if not perm_id:
                perm_id = f"perm-{uuid.uuid4().hex[:6]}"
                await db_session.execute(
                    text("INSERT INTO smriti_permissions (id, uuid, code, resource, action, scope, module, description, is_active, is_deleted, created_at, modified_at) "
                         "VALUES (:id, :uuid, :code, 'Res', 'Act', 'GLOBAL', 'Test', 'desc', true, false, now(), now())"),
                    {"id": perm_id, "uuid": str(uuid.uuid4()), "code": perm_code}
                )

            await db_session.execute(
                text("INSERT INTO smriti_permission_set_permissions (id, uuid, permission_set_id, permission_id, permission_type, created_at, modified_at) "
                     "VALUES (:id, :uuid, :permission_set_id, :perm_id, 'ALLOW', now(), now())"),
                {"id": f"pp-{uuid.uuid4().hex[:6]}", "uuid": str(uuid.uuid4()), "permission_set_id": permission_set_id, "perm_id": perm_id}
            )

        await db_session.commit()

    return user


def _auth_headers(user: User):
    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value,
        "company_id": user.company_id,
        "branch_id": user.branch_id,
        "jti": str(uuid.uuid4()),
        "type": "access",
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_crm_endpoint_permissions(db_session):
    """
    Verify that CRM endpoints restrict access according to dynamic permissions.
    """
    from app.services.security import clear_all_permissions_cache
    await clear_all_permissions_cache()

    # 1. Create a user with CRM.MANAGE_CUSTOMERS permission
    auth_user = await _create_test_entities(
        db_session,
        role_code="CRM_MANAGER",
        user_role=UserRole.CASHIER,
        permission_codes=["CRM.MANAGE_CUSTOMERS"]
    )
    headers = _auth_headers(auth_user)

    # 2. Create a user WITHOUT CRM.MANAGE_CUSTOMERS permission
    unauth_user = await _create_test_entities(
        db_session,
        user_role=UserRole.VIEWER
    )
    unauth_headers = _auth_headers(unauth_user)

    # 3. Create a SYSADMIN (SUPER) user
    super_user = await _create_test_entities(
        db_session,
        user_role=UserRole.SYSADMIN
    )
    super_headers = _auth_headers(super_user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # A. Authorized user creates customer group -> should succeed (201)
        res_create = await client.post(
            "/api/v1/customer-groups",
            json={"id": "cg-auth-123", "name": "VIP Clients", "description": "VIPs"},
            headers=headers
        )
        assert res_create.status_code == 201

        # B. Unauthorized user creates customer group -> should fail (403)
        res_unauth = await client.post(
            "/api/v1/customer-groups",
            json={"id": "cg-unauth-123", "name": "VIP Clients 2", "description": "VIPs"},
            headers=unauth_headers
        )
        assert res_unauth.status_code == 403

        # C. SYSADMIN (SUPER) creates customer group -> should bypass and succeed (201)
        res_super = await client.post(
            "/api/v1/customer-groups",
            json={"id": "cg-super-123", "name": "VIP Clients Super", "description": "VIPs"},
            headers=super_headers
        )
        assert res_super.status_code == 201


@pytest.mark.asyncio
async def test_inventory_endpoint_permissions(db_session):
    """
    Verify that Inventory endpoints restrict access according to dynamic permissions.
    """
    from app.services.security import clear_all_permissions_cache
    await clear_all_permissions_cache()

    # 1. Create a user with ITEM.CREATE permission
    auth_user = await _create_test_entities(
        db_session,
        role_code="INVENTORY_CLERK",
        user_role=UserRole.CASHIER,
        permission_codes=["ITEM.CREATE"]
    )
    headers = _auth_headers(auth_user)

    # 2. Create a user WITHOUT ITEM.CREATE permission
    unauth_user = await _create_test_entities(
        db_session,
        user_role=UserRole.CASHIER
    )
    unauth_headers = _auth_headers(unauth_user)

    # 3. Create a SYSADMIN (SUPER) user
    super_user = await _create_test_entities(
        db_session,
        user_role=UserRole.SYSADMIN
    )
    super_headers = _auth_headers(super_user)

    product_payload = {
        "id": "prod-auth-123",
        "code": "PROD-TEST-123",
        "sku": "PROD-TEST-123",
        "name": "Super Test Product",
        "price": 100.0,
        "mrp": 120.0,
        "stock": 10,
        "category": "Apparel",
        "barcode": f"B-{uuid.uuid4().hex[:6]}"
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # A. Authorized user creates product -> should succeed (201)
        res_create = await client.post(
            "/api/v1/inventory/",
            json=product_payload,
            headers=headers
        )
        assert res_create.status_code == 201

        # B. Unauthorized user creates product -> should fail (403)
        res_unauth = await client.post(
            "/api/v1/inventory/",
            json={**product_payload, "id": "prod-unauth-123", "code": "PROD-UNAUTH", "sku": "PROD-UNAUTH", "barcode": f"B-{uuid.uuid4().hex[:6]}"},
            headers=unauth_headers
        )
        assert res_unauth.status_code == 403

        # C. SYSADMIN (SUPER) creates product -> should bypass and succeed (201)
        res_super = await client.post(
            "/api/v1/inventory/",
            json={**product_payload, "id": "prod-super-123", "code": "PROD-SUPER", "sku": "PROD-SUPER", "barcode": f"B-{uuid.uuid4().hex[:6]}"},
            headers=super_headers
        )
        assert res_super.status_code == 201
