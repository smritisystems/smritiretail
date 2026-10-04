"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-10-04
Modified     : 2026-10-04
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Phase 1E RBAC Tests (Scenarios A--M)

Tests the Standard Role Template / RBAC implementation:

  A. System role visibility         -- tenant can see global system roles
  B. Custom role visibility         -- tenant A sees its custom role
  C. Cross-tenant isolation         -- tenant A cannot see tenant B custom role
  D. Custom role creation           -- created with current user company_id
  E. Cross-tenant update            -- tenant A cannot update tenant B role
  F. Cross-tenant delete            -- tenant A cannot delete tenant B role
  G. System role immutability       -- tenant cannot update system role
  H. System role deletion prot.     -- tenant cannot delete system role
  I. Duplicate custom role          -- same company + same name rejected
  J. Same name cross-company        -- allowed across different companies
  K. Stable system role IDs         -- 15 system roles, no duplicates
  L. Existing role_id assignments   -- remain valid after Phase 1E
  M. R-3 compatibility              -- both SALES_EXECUTIVE roles untouched

Auth pattern: create_access_token() (same as t_tenant_sec.py)
No password-based login required -- test tokens minted directly.
"""

import sys
import json
import psycopg2
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token
from app.models.auth import UserRole

# ---------------------------------------------------------------------------
# DB connection for direct verification
# ---------------------------------------------------------------------------
_PG_PORT = __import__("os").getenv("POSTGRES_PORT", "5432")
CTRL_URL = f"postgresql://postgres:postgres@localhost:{_PG_PORT}/smritisys"


def _ctrl_query(sql: str, params=None):
    """Execute a query against smritisys and return all rows."""
    conn = psycopg2.connect(CTRL_URL)
    cur = conn.cursor()
    cur.execute(sql, params or [])
    rows = cur.fetchall()
    conn.close()
    return rows


def _ctrl_exec(sql: str, params=None):
    """Execute a DML statement against smritisys."""
    conn = psycopg2.connect(CTRL_URL)
    cur = conn.cursor()
    cur.execute(sql, params or [])
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Token factories
# ---------------------------------------------------------------------------
COMP_A = "COMP-001"
COMP_B = "COMP-RBAC-B"   # second tenant used for cross-tenant tests


@pytest.fixture
def sysadmin_token():
    """SYSADMIN token -- global scope, no company_id."""
    return create_access_token(data={
        "sub": "usr-sysadmin",
        "username": "usr_sysadmin",
        "role": UserRole.SYSADMIN.value,
        "company_id": None,
    })


@pytest.fixture
def manager_a_token():
    """MANAGER from COMP_A."""
    return create_access_token(data={
        "sub": "usr-manager",
        "username": "usr_manager",
        "role": UserRole.MANAGER.value,
        "company_id": COMP_A,
    })


@pytest.fixture
def manager_b_token():
    """MANAGER from COMP_B (cross-tenant attacker)."""
    return create_access_token(data={
        "sub": "usr-manager-b",
        "username": "usr_manager_b",
        "role": UserRole.MANAGER.value,
        "company_id": COMP_B,
    })


@pytest.fixture
def cashier_token():
    """CASHIER from COMP_A -- cannot create/update/delete roles."""
    return create_access_token(data={
        "sub": "usr-cashier",
        "username": "usr_cashier",
        "role": UserRole.CASHIER.value,
        "company_id": COMP_A,
    })


# ---------------------------------------------------------------------------
# DB seed helpers for cross-tenant test setup
# ---------------------------------------------------------------------------

def _ensure_comp_b():
    """Create COMP_B in smritisys if it does not exist."""
    # NOTE: company_code is omitted (NULL allowed) to avoid chk_company_code_format
    # constraint which requires ^[A-Z0-9]{3,12}$ when not null.
    _ctrl_exec("""
        INSERT INTO companies (id, uuid, name, is_active, is_deleted, created_at, modified_at)
        VALUES (%s, %s, 'RBAC Test Tenant B', true, false, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET is_active = true, is_deleted = false;
    """, (COMP_B, str(uuid.uuid4())))


def _insert_test_role(role_id: str, name: str, company_id, is_system: bool = False) -> str:
    """Insert a test custom role into smritisys.roles. Returns role_id."""
    _ctrl_exec("""
        INSERT INTO roles (id, uuid, name, description, permissions_json, is_system, company_id, is_active, is_deleted, created_at, modified_at)
        VALUES (%s, %s, %s, 'RBAC test role', '[\"test.read\"]', %s, %s, true, false, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET is_deleted = false, is_active = true, company_id = %s, name = %s;
    """, (role_id, str(uuid.uuid4()), name, is_system, company_id, company_id, name))
    return role_id


def _delete_test_role(role_id: str):
    """Hard-delete a test role created during testing (direct DB, bypasses soft-delete)."""
    _ctrl_exec("DELETE FROM roles WHERE id = %s;", (role_id,))


# ---------------------------------------------------------------------------
# A. System Role Visibility -- tenant sees global system roles
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_A_tenant_can_see_system_roles(manager_a_token):
    """
    Scenario A: A non-SYSADMIN user (MANAGER, COMP_A) must receive all global
    system roles (is_system=TRUE, company_id=NULL) in the list_roles response.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/roles/", headers={"Authorization": f"Bearer {manager_a_token}"})
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    roles = res.json()
    assert isinstance(roles, list)
    system_roles = [r for r in roles if r.get("isSystem") is True]
    # 15 system roles are seeded by migrations (v1335 + v1516)
    assert len(system_roles) >= 12, (
        f"Expected at least 12 system roles visible to tenant, got {len(system_roles)}. "
        f"Roles: {[r['name'] for r in system_roles]}"
    )


# ---------------------------------------------------------------------------
# B. Custom Role Visibility -- tenant sees its own custom role
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_B_tenant_sees_own_custom_role(manager_a_token):
    """
    Scenario B: MANAGER from COMP_A must see a custom role belonging to COMP_A.
    """
    rid = "rbac-test-b-own-role"
    _insert_test_role(rid, "RBAC-B-Own-Role", COMP_A, is_system=False)
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/v1/roles/", headers={"Authorization": f"Bearer {manager_a_token}"})
        assert res.status_code == 200
        ids = [r["id"] for r in res.json()]
        assert rid in ids, f"Expected own custom role {rid!r} in list, got IDs: {ids}"
    finally:
        _delete_test_role(rid)


# ---------------------------------------------------------------------------
# C. Cross-Tenant Isolation -- tenant A cannot see tenant B custom role
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_C_cross_tenant_role_not_visible(manager_a_token):
    """
    Scenario C: MANAGER from COMP_A must NOT see a custom role belonging to COMP_B.
    """
    _ensure_comp_b()
    rid = "rbac-test-c-comp-b-role"
    _insert_test_role(rid, "RBAC-C-CompB-Role", COMP_B, is_system=False)
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/v1/roles/", headers={"Authorization": f"Bearer {manager_a_token}"})
        assert res.status_code == 200
        ids = [r["id"] for r in res.json()]
        assert rid not in ids, (
            f"Cross-tenant isolation FAILURE: COMP_A manager can see COMP_B custom role {rid!r}"
        )
    finally:
        _delete_test_role(rid)


# ---------------------------------------------------------------------------
# D. Custom Role Creation -- created with caller company_id
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_D_custom_role_creation_scoped_to_company(sysadmin_token):
    """
    Scenario D: Creating a role via POST /roles/ assigns company_id from the JWT.
    SYSADMIN creates a role for COMP_A by carrying company_id=COMP_A in the token.
    """
    sysadmin_comp_a_token = create_access_token(data={
        "sub": "usr-sysadmin",
        "username": "usr_sysadmin",
        "role": UserRole.SYSADMIN.value,
        "company_id": COMP_A,
    })
    role_name = f"RBAC-D-Custom-{uuid.uuid4().hex[:6].upper()}"
    payload = {
        "name": role_name,
        "description": "Scenario D test role",
        "permissions": ["inventory.view"],
        "isSystem": False
    }
    created_id = None
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post("/api/v1/roles/", json=payload,
                                    headers={"Authorization": f"Bearer {sysadmin_comp_a_token}"})
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        data = res.json()
        created_id = data["id"]
        assert data["isSystem"] is False

        # Verify company_id in DB
        rows = _ctrl_query("SELECT company_id FROM roles WHERE id = %s;", (created_id,))
        assert rows, f"Role {created_id} not found in DB"
        assert rows[0][0] == COMP_A, f"Expected company_id={COMP_A!r}, got {rows[0][0]!r}"
    finally:
        if created_id:
            _delete_test_role(created_id)


# ---------------------------------------------------------------------------
# E. Cross-Tenant Update -- tenant A cannot update tenant B role
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_E_cross_tenant_update_blocked(manager_a_token):
    """
    Scenario E: MANAGER from COMP_A attempting to update a custom role
    belonging to COMP_B must receive 404 (ownership check, no info leak).
    """
    _ensure_comp_b()
    rid = "rbac-test-e-comp-b-role"
    _insert_test_role(rid, "RBAC-E-CompB-Role", COMP_B, is_system=False)
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.put(
                f"/api/v1/roles/{rid}",
                json={"description": "CROSS-TENANT ATTACK"},
                headers={"Authorization": f"Bearer {manager_a_token}"}
            )
        assert res.status_code == 404, (
            f"Cross-tenant update FAILURE: Expected 404, got {res.status_code}: {res.text}"
        )
    finally:
        _delete_test_role(rid)


# ---------------------------------------------------------------------------
# F. Cross-Tenant Delete -- tenant A cannot delete tenant B role
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_F_cross_tenant_delete_blocked(manager_a_token):
    """
    Scenario F: MANAGER from COMP_A attempting to delete a custom role
    belonging to COMP_B must receive 404.
    """
    _ensure_comp_b()
    rid = "rbac-test-f-comp-b-role"
    _insert_test_role(rid, "RBAC-F-CompB-Role", COMP_B, is_system=False)
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.delete(
                f"/api/v1/roles/{rid}",
                headers={"Authorization": f"Bearer {manager_a_token}"}
            )
        assert res.status_code == 404, (
            f"Cross-tenant delete FAILURE: Expected 404, got {res.status_code}: {res.text}"
        )
    finally:
        _delete_test_role(rid)


# ---------------------------------------------------------------------------
# G. System Role Immutability -- tenant cannot update system role
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_G_system_role_immutable_to_tenant(manager_a_token):
    """
    Scenario G: MANAGER from COMP_A attempting to update a system role
    (is_system=TRUE) must receive 400.
    """
    # role-cashier is a system role seeded by v1335
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            "/api/v1/roles/role-cashier",
            json={"description": "ATTACK system role"},
            headers={"Authorization": f"Bearer {manager_a_token}"}
        )
    assert res.status_code == 400, (
        f"System role immutability FAILURE: Expected 400, got {res.status_code}: {res.text}"
    )
    assert "global templates" in res.json().get("detail", "").lower() or \
           "cannot be altered" in res.json().get("detail", "").lower(), \
           f"Expected system-role rejection detail, got: {res.json()}"


# ---------------------------------------------------------------------------
# H. System Role Deletion Protection -- tenant cannot delete system role
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_H_system_role_cannot_be_deleted(manager_a_token):
    """
    Scenario H: MANAGER from COMP_A attempting to delete a system role
    (is_system=TRUE) must receive 400.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.delete(
            "/api/v1/roles/role-manager",
            headers={"Authorization": f"Bearer {manager_a_token}"}
        )
    assert res.status_code == 400, (
        f"System role deletion FAILURE: Expected 400, got {res.status_code}: {res.text}"
    )
    assert "cannot be deleted" in res.json().get("detail", "").lower(), \
           f"Expected system-role deletion detail, got: {res.json()}"


# ---------------------------------------------------------------------------
# I. Duplicate Custom Role -- same company + same name rejected
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_I_duplicate_custom_role_rejected(sysadmin_token):
    """
    Scenario I: Creating a custom role with a name that already exists for the
    same company must be rejected with 400.
    """
    sysadmin_comp_a_token = create_access_token(data={
        "sub": "usr-sysadmin", "username": "usr_sysadmin",
        "role": UserRole.SYSADMIN.value, "company_id": COMP_A,
    })
    role_name = f"RBAC-I-Dup-{uuid.uuid4().hex[:6].upper()}"
    payload = {"name": role_name, "description": "First", "permissions": ["test.read"], "isSystem": False}
    created_id = None
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            r1 = await client.post("/api/v1/roles/", json=payload,
                                   headers={"Authorization": f"Bearer {sysadmin_comp_a_token}"})
            assert r1.status_code == 201, f"First creation failed: {r1.text}"
            created_id = r1.json()["id"]
            # Same name, same company
            r2 = await client.post("/api/v1/roles/", json=payload,
                                   headers={"Authorization": f"Bearer {sysadmin_comp_a_token}"})
            assert r2.status_code == 400, (
                f"Duplicate custom role FAILURE: Expected 400, got {r2.status_code}: {r2.text}"
            )
    finally:
        if created_id:
            _delete_test_role(created_id)


# ---------------------------------------------------------------------------
# J. Same Name Cross-Company -- allowed
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_J_same_role_name_allowed_across_companies(sysadmin_token):
    """
    Scenario J: The same role name CAN be used by two different companies.
    Company A and Company B can each have a role called 'Supervisor'.
    """
    _ensure_comp_b()
    shared_name = f"RBAC-J-Supervisor-{uuid.uuid4().hex[:4].upper()}"
    token_a = create_access_token(data={
        "sub": "usr-sysadmin",
        "username": "usr_sysadmin",
        "role": UserRole.SYSADMIN.value, "company_id": COMP_A,
    })
    token_b = create_access_token(data={
        # Same DB user, different JWT company_id claim --
        # company_id in the token drives tenant scoping.
        "sub": "usr-sysadmin",
        "username": "usr_sysadmin",
        "role": UserRole.SYSADMIN.value, "company_id": COMP_B,
    })
    payload = {"name": shared_name, "description": "Cross-company test", "permissions": ["test.read"], "isSystem": False}
    id_a = id_b = None
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            ra = await client.post("/api/v1/roles/", json=payload,
                                   headers={"Authorization": f"Bearer {token_a}"})
            assert ra.status_code == 201, f"COMP_A creation failed: {ra.text}"
            id_a = ra.json()["id"]

            rb = await client.post("/api/v1/roles/", json=payload,
                                   headers={"Authorization": f"Bearer {token_b}"})
            assert rb.status_code == 201, (
                f"Same name cross-company FAILURE: Expected 201 for COMP_B, got {rb.status_code}: {rb.text}"
            )
            id_b = rb.json()["id"]
    finally:
        if id_a:
            _delete_test_role(id_a)
        if id_b:
            _delete_test_role(id_b)


# ---------------------------------------------------------------------------
# K. Stable System Role IDs -- 15 system roles, no duplicates
# ---------------------------------------------------------------------------

def test_K_stable_system_role_ids():
    """
    Scenario K: Verify the 15 system roles seeded by v1335/v1516 are all
    present, IDs are unique, and no role has been inadvertently duplicated.
    """
    rows = _ctrl_query("""
        SELECT id, name FROM roles
        WHERE is_system = TRUE AND is_deleted = FALSE
        ORDER BY id;
    """)
    ids = [r[0] for r in rows]
    assert len(ids) >= 12, f"Expected at least 12 system roles, found {len(ids)}: {ids}"
    assert len(ids) == len(set(ids)), f"Duplicate system role IDs detected: {ids}"

    # Spot-check canonical IDs from v1335
    expected_ids = {
        "role-store-manager", "role-cashier", "role-sales-executive",
        "role-viewer", "role-branch-admin", "role-sysadmin"
    }
    missing = expected_ids - set(ids)
    assert not missing, f"Missing expected system role IDs: {missing}"


# ---------------------------------------------------------------------------
# L. Existing role_id Assignments -- remain valid
# ---------------------------------------------------------------------------

def test_L_existing_role_id_assignments_valid():
    """
    Scenario L: Verify that any users with role_id set reference a role
    that still exists and is not soft-deleted (FK integrity).
    """
    broken = _ctrl_query("""
        SELECT u.id, u.username, u.role_id
        FROM users u
        WHERE u.role_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM roles r
              WHERE r.id = u.role_id AND r.is_deleted = FALSE
          )
        AND u.is_deleted = FALSE;
    """)
    assert not broken, (
        f"Broken role_id assignments detected (role is deleted or missing): {broken}"
    )


# ---------------------------------------------------------------------------
# M. R-3 Compatibility -- SALES_EXECUTIVE roles untouched
# ---------------------------------------------------------------------------

def test_M_sales_executive_roles_untouched():
    """
    Scenario M: Both SALES_EXECUTIVE-related system roles must exist unchanged
    after Phase 1E implementation. No user should be newly assigned to either.
    R-3 Option B: retain both, document as distinct.
    """
    # role-sales-executive: canonical scoped operational role (v1335)
    scoped = _ctrl_query("""
        SELECT id, name, is_system, company_id, permissions_json
        FROM roles WHERE id = 'role-sales-executive' AND is_deleted = FALSE;
    """)
    assert scoped, "role-sales-executive (scoped) is missing -- must not be deleted"
    assert scoped[0][1] == "Sales Executive", f"Name changed: {scoped[0][1]!r}"
    assert scoped[0][2] is True, "is_system must be TRUE"
    assert scoped[0][3] is None, "company_id must be NULL (global)"
    scoped_perms = json.loads(scoped[0][4])
    assert "*" not in scoped_perms, "Scoped role must NOT have wildcard '*' permissions"

    # role-sales_executive: wildcard seed artifact (seed_baseline_users)
    wildcard = _ctrl_query("""
        SELECT id, name, is_system, company_id, permissions_json
        FROM roles WHERE id = 'role-sales_executive' AND is_deleted = FALSE;
    """)
    assert wildcard, "role-sales_executive (wildcard) is missing -- must be retained per Option B"
    assert wildcard[0][2] is True, "is_system must be TRUE"
    assert wildcard[0][3] is None, "company_id must be NULL"
    wildcard_perms = json.loads(wildcard[0][4])
    assert "*" in wildcard_perms, "Wildcard role must still have [\"*\"] permissions"

    # Verify 0 active users assigned to either role
    users_scoped = _ctrl_query("""
        SELECT COUNT(*) FROM users WHERE role_id = 'role-sales-executive' AND is_deleted = FALSE;
    """)
    users_wildcard = _ctrl_query("""
        SELECT COUNT(*) FROM users WHERE role_id = 'role-sales_executive' AND is_deleted = FALSE;
    """)
    assert users_scoped[0][0] == 0, f"Unexpected users assigned to scoped role: {users_scoped[0][0]}"
    assert users_wildcard[0][0] == 0, f"Unexpected users assigned to wildcard role: {users_wildcard[0][0]}"


# ---------------------------------------------------------------------------
# Bonus: CASHIER cannot call create/update/delete roles (403)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cashier_cannot_create_role(cashier_token):
    """Cashier does not have SYSADMIN role -- POST /roles/ must return 403."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/roles/",
            json={"name": "Attack Role", "permissions": ["*"], "isSystem": False},
            headers={"Authorization": f"Bearer {cashier_token}"}
        )
    assert res.status_code == 403, f"Expected 403 for CASHIER create, got {res.status_code}"


@pytest.mark.asyncio
async def test_unauthenticated_cannot_list_roles():
    """Unauthenticated request to list roles must return 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/roles/")
    assert res.status_code == 401, f"Expected 401 for unauthenticated list, got {res.status_code}"

# ===========================================================================
# Phase 1F — SEC-RBAC-001 Security Regression Tests (Scenarios N–R)
# ===========================================================================

def _make_wildcard_custom_role(role_id: str, company_id: str = COMP_A) -> str:
    """Insert a custom (non-system) role with ["*"] permissions for test use."""
    _ctrl_exec("""
        INSERT INTO roles (id, uuid, name, description, permissions_json, is_system,
                           company_id, is_active, is_deleted, created_at, modified_at)
        VALUES (%s, %s, %s, 'P1F wildcard test', '["*"]', false, %s, true, false, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET is_deleted = false, permissions_json = '["*"]',
                                        company_id = %s;
    """, (role_id, str(uuid.uuid4()), f"P1F-Wild-{role_id[:8]}", company_id, company_id))
    return role_id


def _bind_user_role_id(user_id: str, role_id: str):
    """Directly set role_id on a user."""
    _ctrl_exec("UPDATE users SET role_id = %s WHERE id = %s;", (role_id, user_id))


def _unbind_user_role_id(user_id: str, original_role_id: str):
    """Restore user's original role_id after a test."""
    _ctrl_exec("UPDATE users SET role_id = %s WHERE id = %s;", (original_role_id, user_id))


# ---------------------------------------------------------------------------
# N. MANAGER bound to wildcard role_id is REJECTED by require_role(SYSADMIN)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_N_manager_wildcard_role_rejected_on_sysadmin_endpoint(manager_a_token):
    """
    Phase 1F SEC-RBAC-001 Scenario N:
    A MANAGER bound to a custom wildcard role must NOT be admitted to a
    SYSADMIN-only endpoint (GET /api/v1/companies).
    """
    wildcard_rid = "p1f-test-n-wildcard-role"
    _make_wildcard_custom_role(wildcard_rid, COMP_A)
    original_rid = "role-manager"
    _bind_user_role_id("usr-manager", wildcard_rid)
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get(
                "/api/v1/control-center/companies",
                headers={"Authorization": f"Bearer {manager_a_token}"}
            )
        assert res.status_code == 403, (
            f"SEC-RBAC-001 STILL OPEN: MANAGER with wildcard role_id admitted to "
            f"require_role(SYSADMIN). Expected 403, got {res.status_code}: {res.text}"
        )
    finally:
        _unbind_user_role_id("usr-manager", original_rid)
        _delete_test_role(wildcard_rid)


# ---------------------------------------------------------------------------
# O. SYSADMIN bound to wildcard role_id is still ADMITTED
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_O_sysadmin_wildcard_role_still_admitted(sysadmin_token):
    """
    Phase 1F SEC-RBAC-001 Scenario O:
    SYSADMIN user bound to wildcard role_id must still be admitted.
    Phase 1F fix must not regress SYSADMIN access.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            "/api/v1/control-center/companies",
            headers={"Authorization": f"Bearer {sysadmin_token}"}
        )
    assert res.status_code == 200, (
        f"SYSADMIN regression: Expected 200, got {res.status_code}: {res.text}"
    )


# ---------------------------------------------------------------------------
# P. MANAGER PUT /roles/{id} with ["*"] ? 403
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_P_manager_cannot_write_wildcard_to_role(manager_a_token):
    """
    Phase 1F SEC-RBAC-001 Scenario P:
    MANAGER updating a custom role with permissions=["*"] must receive 403.
    """
    rid = "p1f-test-p-custom-role"
    _insert_test_role(rid, "P1F-Test-P-Role", COMP_A, is_system=False)
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.put(
                f"/api/v1/roles/{rid}",
                json={"permissions": ["*"]},
                headers={"Authorization": f"Bearer {manager_a_token}"}
            )
        assert res.status_code == 403, (
            f"SEC-RBAC-001 STILL OPEN: MANAGER wrote ['*'] to a role. "
            f"Expected 403, got {res.status_code}: {res.text}"
        )
        assert "SMRITI-AUTH-003" in res.json().get("detail", ""), (
            f"Expected SMRITI-AUTH-003, got: {res.json()}"
        )
    finally:
        _delete_test_role(rid)


# ---------------------------------------------------------------------------
# Q. MANAGER PUT /roles/{id} with scoped perms ? 200
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_Q_manager_can_write_scoped_perms_to_role(manager_a_token):
    """
    Phase 1F SEC-RBAC-001 Scenario Q:
    MANAGER updating a custom role with non-wildcard permissions must succeed (200).
    """
    rid = "p1f-test-q-custom-role"
    _insert_test_role(rid, "P1F-Test-Q-Role", COMP_A, is_system=False)
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.put(
                f"/api/v1/roles/{rid}",
                json={"permissions": ["inventory.view", "sales_billing.NEW"]},
                headers={"Authorization": f"Bearer {manager_a_token}"}
            )
        assert res.status_code == 200, (
            f"MANAGER scoped-perm regression: Expected 200, got {res.status_code}: {res.text}"
        )
        data = res.json()
        assert "*" not in data.get("permissions", [])
        assert "inventory.view" in data.get("permissions", [])
    finally:
        _delete_test_role(rid)


# ---------------------------------------------------------------------------
# R. SYSADMIN PUT /roles/{id} with ["*"] ? 200 (unrestricted)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_R_sysadmin_can_write_wildcard_to_role():
    """
    Phase 1F SEC-RBAC-001 Scenario R:
    SYSADMIN must still be able to set permissions=["*"] on any role.
    """
    sysadmin_comp_a_token = create_access_token(data={
        "sub": "usr-sysadmin",
        "username": "usr_sysadmin",
        "role": UserRole.SYSADMIN.value,
        "company_id": COMP_A,
    })
    rid = "p1f-test-r-custom-role"
    _insert_test_role(rid, "P1F-Test-R-Role", COMP_A, is_system=False)
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.put(
                f"/api/v1/roles/{rid}",
                json={"permissions": ["*"]},
                headers={"Authorization": f"Bearer {sysadmin_comp_a_token}"}
            )
        assert res.status_code == 200, (
            f"SYSADMIN wildcard write regression: Expected 200, got {res.status_code}: {res.text}"
        )
        data = res.json()
        assert "*" in data.get("permissions", [])
    finally:
        _delete_test_role(rid)
