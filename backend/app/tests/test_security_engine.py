"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.24.0
Created      : 2026-07-18
Modified     : 2026-07-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from httpx import AsyncClient, ASGITransport
import uuid
from sqlalchemy import text

from app.main import app
from app.models.auth import User, UserRole
from app.models.security import (
    SMRITIRole,
    SMRITIPermission,
    SMRITIPolicy,
    SMRITIRolePolicy,
    SMRITIPolicyPermission,
    SMRITIUserRole,
    SMRITIMenu,
    PermissionType
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
    clear_all_permissions_cache()
    for table in _SECURITY_TEST_TABLES:
        await db_session.execute(text(f"DELETE FROM {table}"))
    # Remove only the test-specific user created by _setup_test_environment
    await db_session.execute(text("DELETE FROM users WHERE id = 'usr-test-subject'"))
    await db_session.commit()
    yield
    clear_all_permissions_cache()


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
    clear_all_permissions_cache()
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
    clear_all_permissions_cache()
    menus = await service.get_visible_menus(user.id)
    titles = {m["title"] for m in menus}

    assert "Sales Workspace" in titles
    assert "Approve Desk" in titles
    assert "System Admin Settings" not in titles
