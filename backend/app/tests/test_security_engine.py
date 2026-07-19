"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-07-18
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import asyncio
import uuid

import pytest
from sqlalchemy import text

from app.models.auth import User, UserRole
from app.models.security import (
    PermissionType,
    SMRITIMenu,
    SMRITIPermission,
    SMRITIPolicy,
    SMRITIPolicyPermission,
    SMRITIRole,
    SMRITIRolePolicy,
    SMRITIUserRole,
)
from app.services.security import SecurityService, clear_all_permissions_cache

_SECURITY_TEST_TABLES = [
    "smriti_security_audits",
    "smriti_menus",
    "smriti_user_roles",
    "smriti_policy_permissions",
    "smriti_role_policies",
    "smriti_policies",
    "smriti_permissions",
    "smriti_roles",
]


@pytest.fixture(autouse=True)
async def clean_security_tables(db_session):
    """Clear all security test tables and test user before each test."""
    await clear_all_permissions_cache()
    for table in _SECURITY_TEST_TABLES:
        await db_session.execute(text(f"DELETE FROM {table}"))
    # Remove only the test-specific user created by _setup_test_environment
    await db_session.execute(text("DELETE FROM users WHERE id = 'usr-test-subject'"))
    await db_session.commit()
    yield
    await clear_all_permissions_cache()


async def _setup_test_environment(db):
    """
    Helper to set up default dynamic roles, permissions, policies, and a test user.
    """
    # 1. Create permissions
    perm_sales_create = SMRITIPermission(
        id="perm-sales-create",
        code="SALES.CREATE",
        resource="Invoice",
        action="Create",
        scope="OWN_BRANCH",
        module="Sales"
    )
    perm_sales_approve = SMRITIPermission(
        id="perm-sales-approve",
        code="SALES.APPROVE",
        resource="Invoice",
        action="Approve",
        scope="OWN_BRANCH",
        module="Sales"
    )
    db.add_all([perm_sales_create, perm_sales_approve])

    # 2. Create policies
    policy_cashier = SMRITIPolicy(
        id="policy-cashier",
        code="POL-CASHIER",
        name="Cashier Policy"
    )
    policy_manager = SMRITIPolicy(
        id="policy-manager",
        code="POL-MANAGER",
        name="Manager Policy"
    )
    db.add_all([policy_cashier, policy_manager])
    await db.commit()

    # Map permissions to policies
    # Cashier policy allows SALES.CREATE
    pp_cashier = SMRITIPolicyPermission(
        id="pp-1",
        policy_id="policy-cashier",
        permission_id="perm-sales-create",
        permission_type=PermissionType.ALLOW
    )
    # Manager policy allows SALES.APPROVE
    pp_mgr = SMRITIPolicyPermission(
        id="pp-2",
        policy_id="policy-manager",
        permission_id="perm-sales-approve",
        permission_type=PermissionType.ALLOW
    )
    db.add_all([pp_cashier, pp_mgr])

    # 3. Create roles (Cashier inherits from Guest, Manager inherits from Cashier)
    role_guest = SMRITIRole(
        id="role-test-guest",
        code="TEST_GUEST",
        name="Guest Role"
    )
    role_cashier = SMRITIRole(
        id="role-test-cashier",
        code="TEST_CASHIER",
        name="Cashier Role",
        parent_role_id="role-test-guest"
    )
    role_manager = SMRITIRole(
        id="role-test-manager",
        code="TEST_MANAGER",
        name="Manager Role",
        parent_role_id="role-test-cashier"
    )
    db.add_all([role_guest, role_cashier, role_manager])
    await db.commit()

    # Map roles to policies
    rp_cashier = SMRITIRolePolicy(
        id="rp-1",
        role_id="role-test-cashier",
        policy_id="policy-cashier"
    )
    rp_mgr = SMRITIRolePolicy(
        id="rp-2",
        role_id="role-test-manager",
        policy_id="policy-manager"
    )
    db.add_all([rp_cashier, rp_mgr])

    # 4. Create user
    user = User(
        id="usr-test-subject",
        uuid=str(uuid.uuid4()),
        username="test_subject",
        email="test_subject@smritibooks.com",
        hashed_password="hashed_pw_here",
        role=UserRole.CASHIER
    )
    db.add(user)
    await db.commit()

    # Assign manager role to user
    ur_mgr = SMRITIUserRole(
        id="ur-1",
        user_id="usr-test-subject",
        role_id="role-test-manager"
    )
    db.add(ur_mgr)
    await db.commit()

    return user


@pytest.mark.asyncio
async def test_role_inheritance_resolves_all_roles(db_session):
    """
    Verify that resolving user roles correctly walks the inheritance tree.
    """
    user = await _setup_test_environment(db_session)
    service = SecurityService(db_session)

    roles = await service.get_effective_roles(user.id)
    role_codes = {r.code for r in roles}

    # Test subject should have TEST_MANAGER, TEST_CASHIER, and TEST_GUEST
    assert "TEST_MANAGER" in role_codes
    assert "TEST_CASHIER" in role_codes
    assert "TEST_GUEST" in role_codes


@pytest.mark.asyncio
async def test_permissions_resolution_precedence(db_session):
    """
    Verify that permissions are correctly compiled, and explicit DENY overrides ALLOW.
    """
    user = await _setup_test_environment(db_session)
    service = SecurityService(db_session)

    # Initially allowed (inherited from Cashier, directly from Manager)
    perms = await service.resolve_user_permissions(user.id)
    assert "SALES.CREATE" in perms
    assert "SALES.APPROVE" in perms

    # Add an explicit DENY on SALES.CREATE in manager policy
    deny_perm = SMRITIPolicyPermission(
        id="pp-deny",
        policy_id="policy-manager",
        permission_id="perm-sales-create",
        permission_type=PermissionType.DENY
    )
    db_session.add(deny_perm)
    await db_session.commit()

    # Clear cache and resolve
    await clear_all_permissions_cache()
    resolved_perms = await service.resolve_user_permissions(user.id)

    # SALES.CREATE should now be denied, but SALES.APPROVE remains allowed
    assert "SALES.CREATE" not in resolved_perms
    assert "SALES.APPROVE" in resolved_perms


@pytest.mark.asyncio
async def test_dynamic_menu_presentation_filtering(db_session):
    """
    Verify that dynamic menus are filtered based on permission visibility rules.
    """
    user = await _setup_test_environment(db_session)
    service = SecurityService(db_session)

    # Seed dynamic menus
    menu_a = SMRITIMenu(
        id="menu-a",
        title="Sales Workspace",
        module="Sales",
        route="/sales",
        permission="SALES.CREATE",
        sequence=1,
        is_active=True
    )
    menu_b = SMRITIMenu(
        id="menu-b",
        title="Approve Desk",
        module="Sales",
        route="/sales/approve",
        permission="SALES.APPROVE",
        sequence=2,
        is_active=True
    )
    menu_c = SMRITIMenu(
        id="menu-c",
        title="System Admin Settings",
        module="Admin",
        route="/admin/settings",
        permission="SECURITY.VIEW_SETTINGS",
        sequence=3,
        is_active=True
    )
    db_session.add_all([menu_a, menu_b, menu_c])
    await db_session.commit()

    # Subject user (with manager role) can access Sales (SALES.CREATE) and Approve Desk (SALES.APPROVE)
    await clear_all_permissions_cache()
    menus = await service.get_visible_menus(user.id)
    titles = {m["title"] for m in menus}

    assert "Sales Workspace" in titles
    assert "Approve Desk" in titles
    assert "System Admin Settings" not in titles


@pytest.mark.asyncio
async def test_memory_permission_cache_ttl_and_metrics():
    """
    Verify that MemoryPermissionCache respects TTL, handles evictions, and increments metrics.
    """
    from app.services.cache import MemoryPermissionCache
    cache = MemoryPermissionCache(default_ttl=1)  # 1 second TTL
    user_id = "test-user-ttl"
    perms = {"SALES.CREATE", "INVENTORY.VIEW"}

    # Initially empty
    assert await cache.get(user_id) is None

    # Set and get immediately
    await cache.set(user_id, perms)
    assert await cache.get(user_id) == perms

    # Check metrics (1 hit, 1 miss)
    metrics = await cache.get_metrics()
    assert metrics["hits"] == 1
    assert metrics["misses"] == 1
    assert metrics["evictions"] == 0

    # Wait for TTL to expire
    await asyncio.sleep(1.1)

    # Should expire and return None
    assert await cache.get(user_id) is None

    # Check metrics after eviction
    metrics = await cache.get_metrics()
    assert metrics["misses"] == 2
    assert metrics["evictions"] == 1


@pytest.mark.asyncio
async def test_redis_permission_cache_failover():
    """
    Verify that RedisPermissionCache logs connection failures and fails over to MemoryPermissionCache.
    """
    from app.services.cache import RedisPermissionCache
    # Create Redis cache pointing to an invalid/non-existent port
    cache = RedisPermissionCache(
        redis_url="redis://127.0.0.1:9999/0",
        default_ttl=60,
        prefix="smriti_test",
        version=1,
        failover_to_memory=True
    )
    user_id = "test-user-failover"
    perms = {"SALES.VIEW"}

    # Set should fallback to memory cache and complete without throwing exception
    await cache.set(user_id, perms)

    # Get should successfully return the permissions from memory cache fallback
    resolved = await cache.get(user_id)
    assert resolved == perms

    # Verify metrics show error and fallback usage
    metrics = await cache.get_metrics()
    assert metrics["redis_errors"] > 0
    assert metrics["redis_using_fallback"] == 1
    assert metrics["memory_hits"] == 1


@pytest.mark.asyncio
async def test_sysadmin_bypass(db_session):
    """
    Verify that SYSADMIN user role bypasses all permission verification.
    """
    import uuid
    from app.models.auth import User, UserRole
    from app.core.security import hash_password
    super_id = f"usr-super-{uuid.uuid4().hex[:6]}"
    super_user = User(
        id=super_id,
        username=f"super_admin_{uuid.uuid4().hex[:6]}",
        role=UserRole.SYSADMIN,
        hashed_password=hash_password("Super@123"),
        is_active=True,
        is_deleted=False,
    )
    db_session.add(super_user)
    await db_session.commit()

    from app.services.security import SecurityService
    service = SecurityService(db_session)
    is_allowed = await service.verify_user_permission(super_id, "ANY.RANDOM.PERMISSION")
    assert is_allowed is True


@pytest.mark.asyncio
async def test_multi_policy_aggregation(db_session):
    """
    Verify that multiple policies mapped to a user aggregate allowed permissions.
    """
    import uuid

    from app.services.security import SecurityService

    service = SecurityService(db_session)
    await _setup_test_environment(db_session)

    # 1. Create a subject role
    role_id = f"role-test-{uuid.uuid4().hex[:6]}"
    await db_session.execute(
        text("INSERT INTO smriti_roles (id, uuid, code, name, description, is_system_role, is_active, is_deleted, created_at, modified_at) "
             "VALUES (:id, :uuid, :code, :name, 'desc', false, true, false, now(), now())"),
        {"id": role_id, "uuid": str(uuid.uuid4()), "code": "TEST_ROLE", "name": "Test Role"}
    )

    # 2. Map test user 'usr-test-subject' to this role
    await db_session.execute(
        text("INSERT INTO smriti_user_roles (id, uuid, user_id, role_id, is_active, is_deleted, created_at, modified_at) "
             "VALUES (:id, :uuid, 'usr-test-subject', :role_id, true, false, now(), now())"),
        {"id": f"ur-{uuid.uuid4().hex[:6]}", "uuid": str(uuid.uuid4()), "role_id": role_id}
    )

    # 3. Create two policies
    pol_id_1 = f"pol-{uuid.uuid4().hex[:6]}"
    pol_id_2 = f"pol-{uuid.uuid4().hex[:6]}"
    await db_session.execute(
        text("INSERT INTO smriti_policies (id, uuid, code, name, description, is_active, is_deleted, created_at, modified_at) "
             "VALUES (:id, :uuid, :code, :name, 'desc', true, false, now(), now())"),
        {"id": pol_id_1, "uuid": str(uuid.uuid4()), "code": "POL_TEST_1", "name": "Policy 1"}
    )
    await db_session.execute(
        text("INSERT INTO smriti_policies (id, uuid, code, name, description, is_active, is_deleted, created_at, modified_at) "
             "VALUES (:id, :uuid, :code, :name, 'desc', true, false, now(), now())"),
        {"id": pol_id_2, "uuid": str(uuid.uuid4()), "code": "POL_TEST_2", "name": "Policy 2"}
    )

    # 4. Map policies to role
    await db_session.execute(
        text("INSERT INTO smriti_role_policies (id, uuid, role_id, policy_id, created_at, modified_at) "
             "VALUES (:id, :uuid, :role_id, :policy_id, now(), now())"),
        {"id": f"rp-{uuid.uuid4().hex[:6]}", "uuid": str(uuid.uuid4()), "role_id": role_id, "policy_id": pol_id_1}
    )
    await db_session.execute(
        text("INSERT INTO smriti_role_policies (id, uuid, role_id, policy_id, created_at, modified_at) "
             "VALUES (:id, :uuid, :role_id, :policy_id, now(), now())"),
        {"id": f"rp-{uuid.uuid4().hex[:6]}", "uuid": str(uuid.uuid4()), "role_id": role_id, "policy_id": pol_id_2}
    )

    # 5. Map permissions to policies
    perm_create_id = await db_session.scalar(text("SELECT id FROM smriti_permissions WHERE code = 'SALES.CREATE'"))
    perm_approve_id = await db_session.scalar(text("SELECT id FROM smriti_permissions WHERE code = 'SALES.APPROVE'"))

    await db_session.execute(
        text("INSERT INTO smriti_policy_permissions (id, uuid, policy_id, permission_id, permission_type, created_at, modified_at) "
             "VALUES (:id, :uuid, :policy_id, :perm_id, 'ALLOW', now(), now())"),
        {"id": f"pp-{uuid.uuid4().hex[:6]}", "uuid": str(uuid.uuid4()), "policy_id": pol_id_1, "perm_id": perm_create_id}
    )
    await db_session.execute(
        text("INSERT INTO smriti_policy_permissions (id, uuid, policy_id, permission_id, permission_type, created_at, modified_at) "
             "VALUES (:id, :uuid, :policy_id, :perm_id, 'ALLOW', now(), now())"),
        {"id": f"pp-{uuid.uuid4().hex[:6]}", "uuid": str(uuid.uuid4()), "policy_id": pol_id_2, "perm_id": perm_approve_id}
    )

    await db_session.commit()

    # Clear cache and resolve
    await clear_all_permissions_cache()
    resolved_perms = await service.resolve_user_permissions("usr-test-subject")

    assert "SALES.CREATE" in resolved_perms
    assert "SALES.APPROVE" in resolved_perms


@pytest.mark.asyncio
async def test_cache_invalidation_after_policy_change(db_session):
    """
    Verify that cache is successfully invalidated when permissions/policy changes.
    """
    from app.services.cache import PermissionCacheFactory
    from app.services.security import invalidate_user_permission_cache
    provider = PermissionCacheFactory.get_provider()

    # 1. Warm cache
    await provider.set("usr-test-subject", {"SALES.CREATE"})
    assert await provider.get("usr-test-subject") == {"SALES.CREATE"}

    # 2. Invalidate cache for this user
    await invalidate_user_permission_cache("usr-test-subject")

    # 3. Cache should be None
    assert await provider.get("usr-test-subject") is None


