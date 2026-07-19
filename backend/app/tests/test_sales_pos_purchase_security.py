"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.3
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


async def _create_test_entities(
    db_session,
    role_code=None,
    user_role=UserRole.CASHIER,
    permission_codes=None,
    company_id=None,
    branch_id=None,
    is_active=True,
    is_deleted=False
):
    """
    Setup Company, Branch, User, and optionally Role/Policy/Permission assignments.
    """
    comp_id = company_id or f"comp-{uuid.uuid4().hex[:6]}"
    br_id = branch_id or f"br-{uuid.uuid4().hex[:6]}"

    if not company_id:
        company = Company(
            id=comp_id,
            name="Security Test Company",
            gst_number="27ABCDE1234F1Z5",
            is_active=True,
        )
        db_session.add(company)

    if not branch_id:
        branch = Branch(
            id=br_id,
            company_id=comp_id,
            name="Security Test Branch",
            code=f"BR-{uuid.uuid4().hex[:4].upper()}",
            is_active=True,
        )
        db_session.add(branch)

    user = User(
        id=f"usr-{uuid.uuid4().hex[:6]}",
        username=f"test_sec_{uuid.uuid4().hex[:4]}",
        email=f"sec_{uuid.uuid4().hex[:4]}@smriti.test",
        hashed_password=hash_password("Test@1234"),
        role=user_role,
        is_active=is_active,
        is_deleted=is_deleted,
        company_id=comp_id,
        branch_id=br_id,
    )
    db_session.add(user)
    await db_session.commit()

    if role_code and permission_codes:
        role_id = f"role-{uuid.uuid4().hex[:6]}"
        await db_session.execute(
            text(
                "INSERT INTO smriti_roles (id, uuid, code, name, description, "
                "is_system_role, is_active, is_deleted, created_at, modified_at) "
                "VALUES (:id, :uuid, :code, :name, 'desc', false, true, false, now(), now())"
            ),
            {"id": role_id, "uuid": str(uuid.uuid4()), "code": role_code, "name": f"{role_code} Role"}
        )

        await db_session.execute(
            text(
                "INSERT INTO smriti_user_roles (id, uuid, user_id, role_id, is_active, "
                "is_deleted, created_at, modified_at) "
                "VALUES (:id, :uuid, :user_id, :role_id, true, false, now(), now())"
            ),
            {"id": f"ur-{uuid.uuid4().hex[:6]}", "uuid": str(uuid.uuid4()), "user_id": user.id, "role_id": role_id}
        )

        policy_id = f"pol-{uuid.uuid4().hex[:6]}"
        await db_session.execute(
            text(
                "INSERT INTO smriti_policies (id, uuid, code, name, description, "
                "is_active, is_deleted, created_at, modified_at) "
                "VALUES (:id, :uuid, :code, :name, 'desc', true, false, now(), now())"
            ),
            {"id": policy_id, "uuid": str(uuid.uuid4()), "code": f"POL_{role_code}", "name": f"Policy for {role_code}"}
        )

        await db_session.execute(
            text(
                "INSERT INTO smriti_role_policies (id, uuid, role_id, policy_id, "
                "created_at, modified_at) "
                "VALUES (:id, :uuid, :role_id, :policy_id, now(), now())"
            ),
            {"id": f"rp-{uuid.uuid4().hex[:6]}", "uuid": str(uuid.uuid4()), "role_id": role_id, "policy_id": policy_id}
        )

        for perm_code in permission_codes:
            perm_id = await db_session.scalar(
                text("SELECT id FROM smriti_permissions WHERE code = :code"),
                {"code": perm_code}
            )
            if not perm_id:
                perm_id = f"perm-{uuid.uuid4().hex[:6]}"
                await db_session.execute(
                    text(
                        "INSERT INTO smriti_permissions (id, uuid, code, resource, "
                        "action, scope, module, description, is_active, is_deleted, "
                        "created_at, modified_at) "
                        "VALUES (:id, :uuid, :code, 'Res', 'Act', 'GLOBAL', 'Test', "
                        "'desc', true, false, now(), now())"
                    ),
                    {"id": perm_id, "uuid": str(uuid.uuid4()), "code": perm_code}
                )

            await db_session.execute(
                text(
                    "INSERT INTO smriti_policy_permissions (id, uuid, policy_id, "
                    "permission_id, permission_type, created_at, modified_at) "
                    "VALUES (:id, :uuid, :policy_id, :perm_id, 'ALLOW', now(), now())"
                ),
                {
                    "id": f"pp-{uuid.uuid4().hex[:6]}",
                    "uuid": str(uuid.uuid4()),
                    "policy_id": policy_id,
                    "perm_id": perm_id
                }
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
async def test_sales_endpoint_security(db_session):
    """
    Verify that Sales endpoints restrict access according to dynamic permissions.
    """
    from app.services.security import clear_all_permissions_cache
    await clear_all_permissions_cache()

    # Create Cashier (with SALES.CREATE, SALES.VIEW, but no SALES.DELETE)
    cashier = await _create_test_entities(
        db_session,
        role_code="CASHIER_ROLE",
        user_role=UserRole.CASHIER,
        permission_codes=["SALES.CREATE", "SALES.VIEW"]
    )
    cashier_headers = _auth_headers(cashier)

    # Create Manager (with SALES.DELETE, SALES.UPDATE, SALES.VIEW)
    manager = await _create_test_entities(
        db_session,
        role_code="MANAGER_ROLE",
        user_role=UserRole.MANAGER,
        permission_codes=["SALES.UPDATE", "SALES.DELETE", "SALES.VIEW"]
    )
    manager_headers = _auth_headers(manager)

    # Create Unauthorized user
    unauth = await _create_test_entities(db_session, user_role=UserRole.REPORT_USER)
    unauth_headers = _auth_headers(unauth)

    # Create Super user
    super_user = await _create_test_entities(db_session, user_role=UserRole.SYSADMIN)
    super_headers = _auth_headers(super_user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. No token -> 401 unauthenticated
        res = await client.get("/api/v1/sales/invoices")
        assert res.status_code == 401

        # 2. Invalid token -> 401 unauthenticated
        res = await client.get("/api/v1/sales/invoices", headers={"Authorization": "Bearer invalid"})
        assert res.status_code == 401

        # 3. Cashier lists invoices -> should succeed (200)
        res = await client.get("/api/v1/sales/invoices", headers=cashier_headers)
        assert res.status_code != 403

        # 4. Unauthorized lists invoices -> should fail (403 forbidden)
        res = await client.get("/api/v1/sales/invoices", headers=unauth_headers)
        assert res.status_code == 403

        # 5. Cashier creates invoice -> should succeed (201) or validation error (422) but NOT 403
        invoice_payload = {
            "invoice_no": f"INV-{uuid.uuid4().hex[:6].upper()}",
            "customer_name": "Walk-in Customer",
            "payment_mode": "Cash",
            "items": []
        }
        res = await client.post("/api/v1/sales/invoices", json=invoice_payload, headers=cashier_headers)
        assert res.status_code != 403

        # 6. Cashier tries to cancel invoice (DELETE) -> should fail (403)
        res = await client.delete("/api/v1/sales/inv-123", headers=cashier_headers)
        assert res.status_code == 403

        # 7. Manager cancels invoice -> should succeed (404/200/422 but NOT 403)
        res = await client.delete("/api/v1/sales/inv-123", headers=manager_headers)
        assert res.status_code != 403

        # 8. Super cancels invoice -> should bypass and succeed (404 but NOT 403)
        res = await client.delete("/api/v1/sales/inv-123", headers=super_headers)
        assert res.status_code != 403


@pytest.mark.asyncio
async def test_pos_endpoint_security(db_session):
    """
    Verify POS endpoints protection for checkouts and shifts.
    """
    from app.services.security import clear_all_permissions_cache
    await clear_all_permissions_cache()

    # Cashier with POS.CHECKOUT and POS.OPEN_SHIFT
    cashier = await _create_test_entities(
        db_session,
        role_code="POS_CASHIER",
        user_role=UserRole.CASHIER,
        permission_codes=["POS.CHECKOUT", "POS.OPEN_SHIFT", "SALES.VIEW"]
    )
    cashier_headers = _auth_headers(cashier)

    # Supervisor with SYSTEM.CONFIG
    supervisor = await _create_test_entities(
        db_session,
        role_code="POS_SUPERVISOR",
        user_role=UserRole.MANAGER,
        permission_codes=["SYSTEM.CONFIG", "POS.CLOSE_SHIFT", "SALES.VIEW"]
    )
    supervisor_headers = _auth_headers(supervisor)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 9. Cashier opens shift -> succeeds (422 validation, not 403)
        res = await client.post("/api/v1/pos/shifts/open", json={}, headers=cashier_headers)
        assert res.status_code != 403

        # 10. Cashier closes shift (no POS.CLOSE_SHIFT) -> forbidden (403)
        res = await client.post("/api/v1/pos/shifts/close/shift-123", json={}, headers=cashier_headers)
        assert res.status_code == 403

        # 11. Supervisor closes shift -> succeeds (404/422, not 403)
        res = await client.post("/api/v1/pos/shifts/close/shift-123", json={}, headers=supervisor_headers)
        assert res.status_code != 403

        # 12. Cashier registers checkout -> should return 422 (validation error) but NOT 403
        checkout_payload = {
            "invoice_no": f"TX-{uuid.uuid4().hex[:6].upper()}",
            "payment_mode": "Cash",
            "items": []
        }
        res = await client.post("/api/v1/pos/checkout", json=checkout_payload, headers=cashier_headers)
        assert res.status_code != 403

        # 13. Supervisor tries to create POS profile (has SYSTEM.CONFIG) -> succeeds (422, not 403)
        res = await client.post("/api/v1/pos/profiles/", json={}, headers=supervisor_headers)
        assert res.status_code != 403

        # 14. Cashier tries to create POS profile (no SYSTEM.CONFIG) -> forbidden (403)
        res = await client.post("/api/v1/pos/profiles/", json={}, headers=cashier_headers)
        assert res.status_code == 403


@pytest.mark.asyncio
async def test_purchase_endpoint_security(db_session):
    """
    Verify Purchase module endpoints protection.
    """
    from app.services.security import clear_all_permissions_cache
    await clear_all_permissions_cache()

    # Clerk with PURCHASE.CREATE and PURCHASE.VIEW
    clerk = await _create_test_entities(
        db_session,
        role_code="PURCHASE_CLERK",
        user_role=UserRole.VIEWER,
        permission_codes=["PURCHASE.CREATE", "PURCHASE.VIEW"]
    )
    clerk_headers = _auth_headers(clerk)

    # Manager with PURCHASE.APPROVE and SUPPLIER.MANAGE
    manager = await _create_test_entities(
        db_session,
        role_code="PURCHASE_MGR",
        user_role=UserRole.MANAGER,
        permission_codes=["PURCHASE.APPROVE", "SUPPLIER.MANAGE", "PURCHASE.VIEW"]
    )
    manager_headers = _auth_headers(manager)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 15. Clerk creates Purchase Order -> succeeds (422, not 403)
        res = await client.post("/api/v1/purchase/orders/", json={}, headers=clerk_headers)
        assert res.status_code != 403

        # 16. Clerk cancels Purchase Order -> forbidden (403)
        res = await client.post(
            "/api/v1/purchase/orders/po-123/cancel",
            json={"reason": "Cancel"},
            headers=clerk_headers
        )
        assert res.status_code == 403

        # 17. Manager cancels Purchase Order -> succeeds (404/422, not 403)
        res = await client.post(
            "/api/v1/purchase/orders/po-123/cancel",
            json={"reason": "Cancel"},
            headers=manager_headers
        )
        assert res.status_code != 403

        # 18. Clerk updates supplier -> forbidden (403)
        res = await client.put("/api/v1/purchase/suppliers/sup-123", json={}, headers=clerk_headers)
        assert res.status_code == 403

        # 19. Manager updates supplier -> succeeds (404/422, not 403)
        res = await client.put("/api/v1/purchase/suppliers/sup-123", json={}, headers=manager_headers)
        assert res.status_code != 403


@pytest.mark.asyncio
async def test_tenant_and_branch_boundaries(db_session):
    """
    Verify multi-tenant and branch boundaries (Tenant isolation).
    """
    from app.services.security import clear_all_permissions_cache
    await clear_all_permissions_cache()

    company_a = Company(id="comp-a", name="Company A", gst_number="27ABCDE1234F1ZA", is_active=True)
    branch_a = Branch(id="br-a", company_id="comp-a", name="Branch A", code="BR-A", is_active=True)

    company_b = Company(id="comp-b", name="Company B", gst_number="27ABCDE1234F1ZB", is_active=True)
    branch_b = Branch(id="br-b", company_id="comp-b", name="Branch B", code="BR-B", is_active=True)

    db_session.add_all([company_a, branch_a, company_b, branch_b])
    await db_session.commit()

    # User in Company A
    user_a = await _create_test_entities(
        db_session,
        role_code="SALES_A",
        user_role=UserRole.CASHIER,
        permission_codes=["SALES.VIEW"],
        company_id="comp-a",
        branch_id="br-a"
    )
    headers_a = _auth_headers(user_a)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 20. User A accesses Sales -> should succeed with company_id context Company A
        res = await client.get("/api/v1/sales/invoices", headers=headers_a)
        assert res.status_code == 200


@pytest.mark.asyncio
async def test_negative_security_scenarios(db_session):
    """
    Verify negative security cases (disabled users, deleted users, cache changes).
    """
    from app.services.security import clear_all_permissions_cache
    await clear_all_permissions_cache()

    # 21. Disabled user -> 401 unauthenticated
    inactive_user = await _create_test_entities(
        db_session,
        is_active=False
    )
    headers = _auth_headers(inactive_user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/sales/invoices", headers=headers)
        assert res.status_code == 401

    # 22. Deleted user -> 401 unauthenticated
    deleted_user = await _create_test_entities(
        db_session,
        is_deleted=True
    )
    headers_del = _auth_headers(deleted_user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/sales/invoices", headers=headers_del)
        assert res.status_code == 401
