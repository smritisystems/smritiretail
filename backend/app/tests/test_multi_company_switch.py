"""
Project      : SMRITI Retail OS
Module       : test_multi_company_switch.py
Standard     : SCS-WSC-001 / SCS-WSC-002 — Multi-Company Switch Hardening
Author       : Jawahar Ramkripal Mallah
Version      : 1.0.0
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Test Suite   : 15 tests covering:
  - Authentication enforcement (T1, T4)
  - Authorization via UserCompanyAssignment (T2, T3)
  - DB mutation persistence (T5, T6)
  - Data isolation after switch (T7, T8, T9, T10, T11)
  - GET /auth/my-companies scoping (T12)
  - No re-login required after switch (T13)
  - Cross-company boundary enforcement (T14)
  - Critical regression: second request reflects new company (T15)
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.main import app
from app.api.deps import get_db
from app.core.security import create_access_token, hash_password
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.user_assignment import UserCompanyAssignment, UserBranchAssignment
from app.models.inventory import Product
from app.tests.conftest import clear_db

pytestmark = pytest.mark.asyncio


# ─── Helpers ────────────────────────────────────────────────────────────────

def _uid(prefix: str = "test") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def _make_token(user: User) -> dict:
    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value,
        "company_id": user.company_id,
        "branch_id": user.branch_id,
        "jti": str(uuid.uuid4()),
    })
    return {"Authorization": f"Bearer {token}"}


async def _create_company(db: AsyncSession, name: str) -> Company:
    # Company extends Base directly — no created_by/updated_by/tenant_id columns
    company = Company(
        id=_uid("comp"),
        name=name,
        is_active=True,
        is_deleted=False,
    )
    db.add(company)
    await db.flush()
    return company


async def _create_branch(db: AsyncSession, company: Company, name: str) -> Branch:
    # Branch extends Base directly — needs 'code' column (unique)
    branch = Branch(
        id=_uid("br"),
        name=name,
        code=_uid("BR"),
        company_id=company.id,
        is_active=True,
        is_deleted=False,
    )
    db.add(branch)
    await db.flush()
    return branch


async def _create_user(
    db: AsyncSession,
    company: Company,
    branch: Branch,
    role: UserRole = UserRole.CASHIER,
) -> User:
    # User extends BaseEntity — has all BaseEntity columns
    user = User(
        id=_uid("usr"),
        username=_uid("u"),
        hashed_password=hash_password("Test@12345"),
        role=role,
        company_id=company.id,
        branch_id=branch.id,
        is_active=True,
        is_deleted=False,
    )
    db.add(user)
    await db.flush()
    return user


async def _assign_company(db: AsyncSession, user: User, company: Company, is_default: bool = False) -> UserCompanyAssignment:
    # UserCompanyAssignment extends BaseEntity
    assignment = UserCompanyAssignment(
        id=_uid("uca"),
        user_id=user.id,
        company_id=company.id,
        is_default=is_default,
        is_active=True,
        is_deleted=False,
    )
    db.add(assignment)
    await db.flush()
    return assignment


async def _assign_branch(db: AsyncSession, user: User, company: Company, branch: Branch, is_default: bool = False) -> UserBranchAssignment:
    # UserBranchAssignment extends BaseEntity
    assignment = UserBranchAssignment(
        id=_uid("uba"),
        user_id=user.id,
        company_id=company.id,
        branch_id=branch.id,
        is_default=is_default,
        is_active=True,
        is_deleted=False,
    )
    db.add(assignment)
    await db.flush()
    return assignment


async def _create_product(db: AsyncSession, company: Company, branch: Branch, name: str) -> Product:
    # Product extends BaseEntity — requires: code, name, barcode, category
    uid = _uid("prod")
    product = Product(
        id=uid,
        name=name,
        code=_uid("ITM"),
        barcode=f"200{uuid.uuid4().hex[:10]}",  # SMRITI internal barcode prefix
        category="Test",
        price=0.00,
        stock=0,
        company_id=company.id,
        branch_id=branch.id,
        tenant_id="tent-default",
        is_active=True,
        is_deleted=False,
    )
    db.add(product)
    await db.flush()
    return product


# ─── Test suite ─────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
async def override_db(db_session: AsyncSession):
    """
    Inject the test db_session into the FastAPI app so that HTTP calls made
    via AsyncClient share the same transaction as the test setup helpers.
    Without this, the app opens its own DB connection and cannot see the
    data created by the test fixtures (different connection = different tx).
    Pattern mirrors test_auth.py override_db fixture.
    """
    await clear_db(db_session)

    async def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
class TestMultiCompanySwitch:
    """
    SCS-WSC-002 — Multi-Company Switch Hardening (15 tests).
    All tests require a live PostgreSQL connection (skipped automatically if DB is absent).
    """

    # T1 — Authenticated user can switch to assigned Company A
    async def test_t1_switch_to_assigned_company_a(self, db_session: AsyncSession):
        comp_a = await _create_company(db_session, "Alpha Corp T1")
        br_a   = await _create_branch(db_session, comp_a, "Alpha Main")
        user   = await _create_user(db_session, comp_a, br_a)
        await _assign_company(db_session, user, comp_a, is_default=True)
        await _assign_branch(db_session, user, comp_a, br_a, is_default=True)
        await db_session.commit()

        headers = _make_token(user)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/api/v1/workspace/switch",
                json={"companyId": comp_a.id}, headers=headers)

        assert res.status_code == 200, f"T1 FAIL: {res.status_code} {res.text}"
        data = res.json()
        assert "workspace" in data, f"T1 FAIL: no 'workspace' key in response"
        assert data["workspace"]["companyId"] == comp_a.id

    # T2 — User cannot switch to unassigned Company C → 403
    async def test_t2_switch_to_unassigned_company_403(self, db_session: AsyncSession):
        comp_a  = await _create_company(db_session, "Alpha Corp T2")
        comp_c  = await _create_company(db_session, "Unassigned Corp T2")
        br_a    = await _create_branch(db_session, comp_a, "Alpha Main T2")
        user    = await _create_user(db_session, comp_a, br_a)
        await _assign_company(db_session, user, comp_a)
        await db_session.commit()

        headers = _make_token(user)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/api/v1/workspace/switch",
                json={"companyId": comp_c.id}, headers=headers)

        assert res.status_code == 403, f"T2 FAIL: expected 403, got {res.status_code}"

    # T3 — User can switch to assigned Company B (multi-assignment)
    async def test_t3_switch_to_assigned_company_b(self, db_session: AsyncSession):
        comp_a = await _create_company(db_session, "Alpha Corp T3")
        comp_b = await _create_company(db_session, "Beta Corp T3")
        br_a   = await _create_branch(db_session, comp_a, "Alpha Main T3")
        br_b   = await _create_branch(db_session, comp_b, "Beta Main T3")
        user   = await _create_user(db_session, comp_a, br_a)
        await _assign_company(db_session, user, comp_a)
        await _assign_company(db_session, user, comp_b)
        await _assign_branch(db_session, user, comp_b, br_b, is_default=True)
        await db_session.commit()

        headers = _make_token(user)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/api/v1/workspace/switch",
                json={"companyId": comp_b.id}, headers=headers)

        assert res.status_code == 200, f"T3 FAIL: {res.status_code} {res.text}"
        assert res.json()["workspace"]["companyId"] == comp_b.id

    # T4 — Anonymous switch → 401
    async def test_t4_anonymous_switch_401(self, db_session: AsyncSession):
        comp_a = await _create_company(db_session, "Alpha Corp T4")
        await db_session.commit()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/api/v1/workspace/switch",
                json={"companyId": comp_a.id})  # no auth header

        assert res.status_code == 401, f"T4 FAIL: expected 401, got {res.status_code}"

    # T5 — DB mutation: user.company_id updated after switch (critical)
    async def test_t5_db_mutation_company_id_updated(self, db_session: AsyncSession):
        comp_a = await _create_company(db_session, "Alpha Corp T5")
        comp_b = await _create_company(db_session, "Beta Corp T5")
        br_a   = await _create_branch(db_session, comp_a, "Alpha Main T5")
        br_b   = await _create_branch(db_session, comp_b, "Beta Main T5")
        user   = await _create_user(db_session, comp_a, br_a)
        await _assign_company(db_session, user, comp_a)
        await _assign_company(db_session, user, comp_b)
        await _assign_branch(db_session, user, comp_b, br_b, is_default=True)
        await db_session.commit()

        headers = _make_token(user)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/api/v1/workspace/switch",
                json={"companyId": comp_b.id}, headers=headers)
        assert res.status_code == 200

        # Verify DB mutation
        await db_session.refresh(user)
        assert user.company_id == comp_b.id, (
            f"T5 FAIL: user.company_id not updated. Expected {comp_b.id}, got {user.company_id}"
        )

    # T6 — DB mutation: user.branch_id resolved to correct branch after switch
    async def test_t6_db_mutation_branch_id_resolved(self, db_session: AsyncSession):
        comp_a = await _create_company(db_session, "Alpha Corp T6")
        comp_b = await _create_company(db_session, "Beta Corp T6")
        br_a   = await _create_branch(db_session, comp_a, "Alpha Main T6")
        br_b   = await _create_branch(db_session, comp_b, "Beta Default T6")
        user   = await _create_user(db_session, comp_a, br_a)
        await _assign_company(db_session, user, comp_a)
        await _assign_company(db_session, user, comp_b)
        await _assign_branch(db_session, user, comp_b, br_b, is_default=True)
        await db_session.commit()

        headers = _make_token(user)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/api/v1/workspace/switch",
                json={"companyId": comp_b.id}, headers=headers)

        await db_session.refresh(user)
        assert user.branch_id == br_b.id, (
            f"T6 FAIL: branch not resolved. Expected {br_b.id}, got {user.branch_id}"
        )

    # T7 — Product isolation: Company A products absent in Company B context
    async def test_t7_product_isolation_company_a_absent_in_b(self, db_session: AsyncSession):
        comp_a = await _create_company(db_session, "Alpha Corp T7")
        comp_b = await _create_company(db_session, "Beta Corp T7")
        br_a   = await _create_branch(db_session, comp_a, "Alpha Main T7")
        br_b   = await _create_branch(db_session, comp_b, "Beta Main T7")
        user   = await _create_user(db_session, comp_b, br_b)  # user starts in B
        await _assign_company(db_session, user, comp_b)
        await _assign_branch(db_session, user, comp_b, br_b, is_default=True)
        # Create a product only in Company A
        prod_a = await _create_product(db_session, comp_a, br_a, "Alpha-Only Widget T7")
        await db_session.commit()

        headers = _make_token(user)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # User is in Company B — should NOT see Company A's product
            res = await client.get("/api/v1/inventory/", headers=headers)

        assert res.status_code == 200
        product_ids = [p.get("id") for p in (res.json() if isinstance(res.json(), list) else [])]
        assert prod_a.id not in product_ids, (
            f"T7 FAIL: Company A product '{prod_a.id}' leaked into Company B context"
        )

    # T8 — Product isolation: Company B products absent in Company A context
    async def test_t8_product_isolation_company_b_absent_in_a(self, db_session: AsyncSession):
        comp_a = await _create_company(db_session, "Alpha Corp T8")
        comp_b = await _create_company(db_session, "Beta Corp T8")
        br_a   = await _create_branch(db_session, comp_a, "Alpha Main T8")
        br_b   = await _create_branch(db_session, comp_b, "Beta Main T8")
        user   = await _create_user(db_session, comp_a, br_a)  # user starts in A
        await _assign_company(db_session, user, comp_a)
        await _assign_branch(db_session, user, comp_a, br_a, is_default=True)
        prod_b = await _create_product(db_session, comp_b, br_b, "Beta-Only Widget T8")
        await db_session.commit()

        headers = _make_token(user)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.get("/api/v1/inventory/", headers=headers)

        assert res.status_code == 200
        product_ids = [p.get("id") for p in (res.json() if isinstance(res.json(), list) else [])]
        assert prod_b.id not in product_ids, (
            f"T8 FAIL: Company B product '{prod_b.id}' leaked into Company A context"
        )

    # T9 — /auth/my-companies returns ONLY assigned companies
    async def test_t9_my_companies_returns_only_assigned(self, db_session: AsyncSession):
        comp_a    = await _create_company(db_session, "Alpha Corp T9")
        comp_b    = await _create_company(db_session, "Beta Corp T9")
        comp_c    = await _create_company(db_session, "Unassigned Corp T9")
        br_a      = await _create_branch(db_session, comp_a, "Alpha Main T9")
        user      = await _create_user(db_session, comp_a, br_a)
        await _assign_company(db_session, user, comp_a)
        await _assign_company(db_session, user, comp_b)
        # comp_c intentionally NOT assigned
        await db_session.commit()

        headers = _make_token(user)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.get("/api/v1/auth/my-companies", headers=headers)

        assert res.status_code == 200
        ids = [c["id"] for c in res.json()["companies"]]
        assert comp_a.id in ids, f"T9 FAIL: comp_a missing from my-companies"
        assert comp_b.id in ids, f"T9 FAIL: comp_b missing from my-companies"
        assert comp_c.id not in ids, (
            f"T9 FAIL: unassigned comp_c '{comp_c.id}' appeared in my-companies"
        )

    # T10 — /auth/my-companies returns active_company_id correctly
    async def test_t10_my_companies_returns_active_company_id(self, db_session: AsyncSession):
        comp_a = await _create_company(db_session, "Alpha Corp T10")
        br_a   = await _create_branch(db_session, comp_a, "Alpha Main T10")
        user   = await _create_user(db_session, comp_a, br_a)
        await _assign_company(db_session, user, comp_a, is_default=True)
        await db_session.commit()

        headers = _make_token(user)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.get("/api/v1/auth/my-companies", headers=headers)

        assert res.status_code == 200
        data = res.json()
        assert data["active_company_id"] == comp_a.id, (
            f"T10 FAIL: active_company_id mismatch. Expected {comp_a.id}, got {data['active_company_id']}"
        )

    # T11 — /auth/tenants returns all assigned companies (not just the current one)
    async def test_t11_tenants_returns_all_assigned(self, db_session: AsyncSession):
        comp_a = await _create_company(db_session, "Alpha Corp T11")
        comp_b = await _create_company(db_session, "Beta Corp T11")
        br_a   = await _create_branch(db_session, comp_a, "Alpha Main T11")
        user   = await _create_user(db_session, comp_a, br_a)
        await _assign_company(db_session, user, comp_a)
        await _assign_company(db_session, user, comp_b)
        await db_session.commit()

        headers = _make_token(user)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.get("/api/v1/auth/tenants", headers=headers)

        assert res.status_code == 200
        ids = [c["id"] for c in res.json()["companies"]]
        assert comp_a.id in ids, f"T11 FAIL: comp_a missing"
        assert comp_b.id in ids, f"T11 FAIL: comp_b missing"

    # T12 — Switching does not require logout/re-login (session token reused)
    async def test_t12_switch_preserves_session_no_relogin(self, db_session: AsyncSession):
        comp_a = await _create_company(db_session, "Alpha Corp T12")
        comp_b = await _create_company(db_session, "Beta Corp T12")
        br_a   = await _create_branch(db_session, comp_a, "Alpha Main T12")
        br_b   = await _create_branch(db_session, comp_b, "Beta Main T12")
        user   = await _create_user(db_session, comp_a, br_a)
        await _assign_company(db_session, user, comp_a)
        await _assign_company(db_session, user, comp_b)
        await _assign_branch(db_session, user, comp_b, br_b)
        await db_session.commit()

        # Same token used throughout — no new login
        headers = _make_token(user)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Call /auth/me before switch
            me_before = await client.get("/api/v1/auth/me", headers=headers)
            assert me_before.status_code == 200

            # Switch without re-login
            switch_res = await client.post("/api/v1/workspace/switch",
                json={"companyId": comp_b.id}, headers=headers)
            assert switch_res.status_code == 200, f"T12 FAIL: switch failed {switch_res.text}"

            # Same token still works
            me_after = await client.get("/api/v1/auth/me", headers=headers)
            assert me_after.status_code == 200, f"T12 FAIL: session lost after switch"

    # T13 — Branch assignment cannot cross company boundary (must belong to target company)
    async def test_t13_branch_cannot_cross_company_boundary(self, db_session: AsyncSession):
        comp_a = await _create_company(db_session, "Alpha Corp T13")
        comp_b = await _create_company(db_session, "Beta Corp T13")
        br_a   = await _create_branch(db_session, comp_a, "Alpha Main T13")
        br_b   = await _create_branch(db_session, comp_b, "Beta Main T13")
        user   = await _create_user(db_session, comp_a, br_a)
        await _assign_company(db_session, user, comp_a)
        await _assign_company(db_session, user, comp_b)
        # Assign a branch ONLY for comp_b
        await _assign_branch(db_session, user, comp_b, br_b, is_default=True)
        await db_session.commit()

        headers = _make_token(user)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Switch to comp_b — should resolve br_b (not br_a from comp_a)
            res = await client.post("/api/v1/workspace/switch",
                json={"companyId": comp_b.id}, headers=headers)

        assert res.status_code == 200
        await db_session.refresh(user)
        assert user.branch_id == br_b.id, (
            f"T13 FAIL: branch crossed company boundary. Got {user.branch_id}, expected {br_b.id}"
        )
        assert user.branch_id != br_a.id, (
            f"T13 FAIL: branch from Company A assigned to Company B context"
        )

    # T14 — Deactivated/deleted company cannot be switched to → 404
    async def test_t14_deleted_company_switch_404(self, db_session: AsyncSession):
        comp_del = await _create_company(db_session, "Deleted Corp T14")
        comp_del.is_deleted = True  # soft-delete
        br_a     = await _create_branch(db_session, comp_del, "Del Branch T14")
        user_comp = await _create_company(db_session, "Active Corp T14")
        br_user  = await _create_branch(db_session, user_comp, "Active Branch T14")
        user     = await _create_user(db_session, user_comp, br_user)
        await _assign_company(db_session, user, user_comp)
        # Assign deleted company (assignment exists but company is deleted)
        await _assign_company(db_session, user, comp_del)
        await db_session.commit()

        headers = _make_token(user)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/api/v1/workspace/switch",
                json={"companyId": comp_del.id}, headers=headers)

        assert res.status_code == 404, (
            f"T14 FAIL: deleted company switch should return 404, got {res.status_code}"
        )

    # T15 — CRITICAL REGRESSION: A SECOND REQUEST after switch returns new company's data
    # This test verifies get_tenant_context() reads the updated user.company_id from DB —
    # the business endpoint result (not the switch response) must reflect the new company.
    async def test_t15_second_request_after_switch_reflects_new_company(self, db_session: AsyncSession):
        comp_a = await _create_company(db_session, "Alpha Corp T15")
        comp_b = await _create_company(db_session, "Beta Corp T15")
        br_a   = await _create_branch(db_session, comp_a, "Alpha Main T15")
        br_b   = await _create_branch(db_session, comp_b, "Beta Main T15")
        user   = await _create_user(db_session, comp_a, br_a)
        await _assign_company(db_session, user, comp_a)
        await _assign_company(db_session, user, comp_b)
        await _assign_branch(db_session, user, comp_b, br_b, is_default=True)

        # Create one product in A and one in B
        prod_a = await _create_product(db_session, comp_a, br_a, "Alpha Product T15")
        prod_b = await _create_product(db_session, comp_b, br_b, "Beta Product T15")
        await db_session.commit()

        headers = _make_token(user)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Confirm starting context (Company A)
            inv_before = await client.get("/api/v1/inventory/", headers=headers)
            assert inv_before.status_code == 200
            ids_before = [p.get("id") for p in (inv_before.json() if isinstance(inv_before.json(), list) else [])]
            assert prod_a.id in ids_before, "T15 PRE-FAIL: Alpha product not visible in Company A"
            assert prod_b.id not in ids_before, "T15 PRE-FAIL: Beta product leaked into Company A"

            # Switch to Company B
            switch_res = await client.post("/api/v1/workspace/switch",
                json={"companyId": comp_b.id}, headers=headers)
            assert switch_res.status_code == 200, f"T15 FAIL: switch failed {switch_res.text}"

            # CRITICAL: This second request (not the switch response) must reflect Company B
            inv_after = await client.get("/api/v1/inventory/", headers=headers)
            assert inv_after.status_code == 200
            ids_after = [p.get("id") for p in (inv_after.json() if isinstance(inv_after.json(), list) else [])]

        assert prod_b.id in ids_after, (
            f"T15 FAIL: Beta product NOT visible after switching to Company B. "
            f"get_tenant_context() may not have picked up DB mutation."
        )
        assert prod_a.id not in ids_after, (
            f"T15 FAIL: Alpha product STILL visible after switching to Company B. "
            f"Data isolation breach — tenant filter not applied correctly."
        )
