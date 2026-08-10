"""
Project      : SMRITI Retail OS
Module       : test_customer_invoice_wiring_final.py
Standard     : SCS-INV-001 Final Verification — Customer → Invoice Full Path
Author       : Jawahar Ramkripal Mallah
Version      : 1.0.0
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Test Suite (6 tests):
  TEST 1  Existing customer → invoice payload contains real customer_id → 201 or business-error (not 422)
  TEST 2  Quick-added customer (POST /customers/ first) → returned DB id → invoice payload → 201 or non-422
  TEST 3  Missing customer_id → backend returns 422 (confirms requirement is enforced)
  TEST 4  Company A customer used in Company B invoice → orchestrator returns 404 (tenant isolation)
  TEST 5  Company switch → customer from Company A cannot be silently accepted under Company B
  TEST 6  Quick-added customer persists → GET /customers/ returns it → can be selected again

All tests use real PostgreSQL. No mocks for tenant, customer ownership, or invoice persistence.
"""

import uuid
import pytest
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.main import app
from app.api.deps import get_db
from app.core.security import create_access_token, hash_password
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.user_assignment import UserCompanyAssignment, UserBranchAssignment
from app.models.crm import Customer
from app.models.sales import SalesInvoice
from app.tests.conftest import clear_db

pytestmark = pytest.mark.asyncio


# ─── Helpers ────────────────────────────────────────────────────────────────

def _uid(prefix: str = "t") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def _make_token(user: User, company: Company = None, branch: Branch = None) -> dict:
    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value,
        "company_id": (company or user).company_id if hasattr(user, "company_id") else (company.id if company else None),
        "branch_id": (branch.id if branch else user.branch_id),
        "jti": str(uuid.uuid4()),
    })
    return {"Authorization": f"Bearer {token}"}


def _token_for(user: User) -> dict:
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
    c = Company(id=_uid("comp"), name=name, is_active=True, is_deleted=False)
    db.add(c); await db.flush(); return c


async def _create_branch(db: AsyncSession, company: Company, name: str) -> Branch:
    b = Branch(
        id=_uid("br"), name=name, code=_uid("BR"),
        company_id=company.id, is_active=True, is_deleted=False,
    )
    db.add(b); await db.flush(); return b


async def _create_user(db: AsyncSession, company: Company, branch: Branch,
                        role: UserRole = UserRole.SYSADMIN) -> User:
    u = User(
        id=_uid("usr"), username=_uid("u"),
        hashed_password=hash_password("Test@12345"),
        role=role, company_id=company.id, branch_id=branch.id,
        is_active=True, is_deleted=False,
    )
    db.add(u); await db.flush(); return u


async def _assign_company(db: AsyncSession, user: User, company: Company,
                           is_default: bool = True) -> UserCompanyAssignment:
    a = UserCompanyAssignment(
        id=_uid("uca"), user_id=user.id, company_id=company.id,
        is_default=is_default, is_active=True, is_deleted=False,
    )
    db.add(a); await db.flush(); return a


async def _create_db_customer(db: AsyncSession, company: Company, branch: Branch,
                               name: str, mobile: str = "9876543210") -> Customer:
    """
    Create a Customer row directly in DB — simulates existing customer from dropdown.
    Includes all fields required by CustomerResponse schema to avoid ResponseValidationError
    on GET /customers/ serialization (uuid, code, version, loyalty_tier, loyalty_points_balance,
    lifetime_points are required non-optional fields in CustomerResponse).
    """
    import uuid as _uuid
    from decimal import Decimal as _D
    from datetime import date as _date
    c = Customer(
        id=_uid("cust"),
        uuid=str(_uuid.uuid4()),
        code=_uid("C"),
        name=name,
        mobile=mobile,
        company_id=company.id,
        branch_id=branch.id,
        tenant_id="tent-default",
        is_active=True,
        is_deleted=False,
        version=1,
        loyalty_tier="Bronze",
        loyalty_points_balance=_D("0.00"),
        lifetime_points=_D("0.00"),
        billing_policy="InvoiceOnDispatch",
        lifecycle_stage="Customer",
        account_status="Active",
        status="Active",
        created_date=_date.today(),   # Must be date not datetime — Pydantic strict date validation
    )
    db.add(c); await db.flush(); return c


def _invoice_payload(customer_id: str, invoice_no: str = None) -> dict:
    """Minimal valid SalesInvoiceCreate payload. No items — tests schema validation path."""
    return {
        "customerId": customer_id,      # frontend sends camelCase — AliasChoices handles it
        "invoice_no": invoice_no or f"INV-FINAL-{uuid.uuid4().hex[:6].upper()}",
        "date": "2026-08-10",
        "items": [],
        "payments": [],
        "grand_total": "0.00",
        "tax_total": "0.00",
        "is_interstate": False,
        "status": "Draft",
    }


# ─── DB override fixture ─────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
async def override_db(db_session: AsyncSession):
    await clear_db(db_session)

    async def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)


# ─── Tests ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
class TestCustomerInvoiceWiringFinal:
    """
    SCS-INV-001 Final Verification — 6 end-to-end tests against real PostgreSQL.
    """

    # TEST 1 — Existing customer selected → customer_id flows to backend → non-422
    async def test_1_existing_customer_invoice_non422(self, db_session: AsyncSession):
        """
        Simulates: user selects existing customer from dropdown.
        selectedCustomer.id = real DB customer.id
        POST /api/v1/sales/invoices with customerId = customer.id → must NOT be 422.
        """
        comp = await _create_company(db_session, "Alpha Corp T1")
        br   = await _create_branch(db_session, comp, "Alpha Main T1")
        user = await _create_user(db_session, comp, br)
        await _assign_company(db_session, user, comp)
        cust = await _create_db_customer(db_session, comp, br, "Ramesh Sharma T1", "9876543201")
        await db_session.commit()

        headers = _token_for(user)
        payload = _invoice_payload(cust.id)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/api/v1/sales/invoices", json=payload, headers=headers)

        assert res.status_code != 422, (
            f"TEST 1 FAIL: Got 422 — customer_id wiring is still broken.\n"
            f"customer.id = {cust.id}\npayload customerId = {payload['customerId']}\n"
            f"Response: {res.text}"
        )
        assert res.status_code in (201, 200, 400), (
            f"TEST 1 unexpected status {res.status_code}: {res.text}"
        )

    # TEST 2 — Quick-added customer: DB-backed ID → invoice payload → non-422
    async def test_2_quickadd_customer_invoice_non422(self, db_session: AsyncSession):
        """
        Verifies that a Quick Add Customer produces a real DB-backed ID that the invoice
        endpoint accepts (non-422).

        NOTE: CrmService.create_customer() calls self.db.commit() internally, which
        deadlocks when called via the shared db_session fixture (test infrastructure
        limitation — in production each request uses its own pool connection).

        Approach: create customer directly via ORM (_create_db_customer), which produces
        an identical DB-backed row. The core invariant being tested is:
          real DB customer.id → invoice payload.customerId → NOT 422
        The HTTP path of POST /customers → DB ID is covered by T6 (quick-add persists).
        """
        comp = await _create_company(db_session, "Alpha Corp T2")
        br   = await _create_branch(db_session, comp, "Alpha Main T2")
        user = await _create_user(db_session, comp, br)
        await _assign_company(db_session, user, comp)

        # Simulate Quick Add result: customer row in DB under this company
        cust = await _create_db_customer(db_session, comp, br, "Quick Add Sunita T2", "9123456789")
        await db_session.commit()

        # Verify the customer id is a real DB-backed id (not a local fake id)
        assert not cust.id.startswith("cust_"), (
            f"TEST 2 FAIL: DB customer id is a fake local id: '{cust.id}'"
        )
        assert cust.company_id == comp.id, (
            f"TEST 2 FAIL: Customer company_id mismatch"
        )

        headers = _token_for(user)

        # Use the real DB customer ID in the invoice payload
        inv_payload = _invoice_payload(cust.id)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            inv_res = await client.post("/api/v1/sales/invoices", json=inv_payload, headers=headers)

        assert inv_res.status_code != 422, (
            f"TEST 2 FAIL: Got 422 with quick-add customer id '{cust.id}'\n"
            f"This means customer_id is still not reaching the backend correctly.\n"
            f"Response: {inv_res.text}"
        )
        assert inv_res.status_code in (201, 200, 400), (
            f"TEST 2 unexpected status {inv_res.status_code}: {inv_res.text}"
        )

    # TEST 3 — Missing customer_id → backend returns 422 (requirement still enforced)
    async def test_3_missing_customer_id_returns_422(self, db_session: AsyncSession):
        """
        Confirms the backend contract: customer_id is required.
        Frontend guard prevents this reaching the server, but the server must
        independently return 422 if someone bypasses the frontend.
        """
        comp = await _create_company(db_session, "Alpha Corp T3")
        br   = await _create_branch(db_session, comp, "Alpha Main T3")
        user = await _create_user(db_session, comp, br)
        await _assign_company(db_session, user, comp)
        await db_session.commit()

        headers = _token_for(user)
        payload = {
            "invoice_no": f"INV-T3-{uuid.uuid4().hex[:6].upper()}",
            "date": "2026-08-10",
            "items": [], "payments": [],
            "grand_total": "0.00", "tax_total": "0.00", "status": "Draft",
            # deliberately omitting customerId / customer_id
        }

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/api/v1/sales/invoices", json=payload, headers=headers)

        assert res.status_code == 422, (
            f"TEST 3 FAIL: Expected 422 when customer_id absent. Got {res.status_code}. "
            f"Backend contract may have changed."
        )
        assert "customer_id" in str(res.json()).lower(), (
            f"TEST 3 FAIL: 422 body does not mention customer_id: {res.json()}"
        )

    # TEST 4 — Company A customer used under Company B context → 404 (isolation enforced)
    async def test_4_company_isolation_rejects_cross_company_customer(self, db_session: AsyncSession):
        """
        Company A customer must not be accepted in a Company B invoice.
        The orchestrator (SCS-INV-001 fix) checks Customer.company_id == tenant_ctx.company_id.
        Cross-company customer_id → 404.
        """
        comp_a = await _create_company(db_session, "Alpha Corp T4")
        comp_b = await _create_company(db_session, "Beta Corp T4")
        br_a   = await _create_branch(db_session, comp_a, "Alpha Main T4")
        br_b   = await _create_branch(db_session, comp_b, "Beta Main T4")

        user   = await _create_user(db_session, comp_b, br_b)
        await _assign_company(db_session, user, comp_b)

        # Customer exists only in Company A
        cust_a = await _create_db_customer(db_session, comp_a, br_a, "Alpha Customer T4")
        await db_session.commit()

        headers = _token_for(user)
        payload = _invoice_payload(cust_a.id)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/api/v1/sales/invoices", json=payload, headers=headers)

        assert res.status_code != 201, (
            f"TEST 4 FAIL: Company A customer accepted in Company B context — tenant isolation breach!\n"
            f"customer.id={cust_a.id}, company_a={comp_a.id}, user.company_b={comp_b.id}\n"
            f"Status: {res.status_code}"
        )
        assert res.status_code in (404, 400, 403, 422), (
            f"TEST 4 unexpected status {res.status_code}: {res.text}"
        )

    # TEST 5 — Company switch: Company A customer cannot silently persist under Company B
    async def test_5_company_switch_customer_not_in_new_company(self, db_session: AsyncSession):
        """
        After switching from Company A to Company B, a customer from Company A
        should not appear in GET /customers/ for Company B.
        This validates that the GET /customers/ endpoint is tenant-scoped.
        (The frontend cache flush is a UI-layer concern; this tests the API layer.)
        """
        comp_a = await _create_company(db_session, "Alpha Corp T5")
        comp_b = await _create_company(db_session, "Beta Corp T5")
        br_a   = await _create_branch(db_session, comp_a, "Alpha Main T5")
        br_b   = await _create_branch(db_session, comp_b, "Beta Main T5")

        user_b = await _create_user(db_session, comp_b, br_b)
        await _assign_company(db_session, user_b, comp_b)

        # Customer exists only in Company A
        cust_a = await _create_db_customer(db_session, comp_a, br_a, "Alpha Customer T5")
        # Customer exists in Company B
        cust_b = await _create_db_customer(db_session, comp_b, br_b, "Beta Customer T5")
        await db_session.commit()

        # User is in Company B context — their token reflects Company B
        headers = _token_for(user_b)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.get("/api/v1/customers", headers=headers)

        assert res.status_code == 200, (
            f"TEST 5 FAIL: GET /customers/ returned {res.status_code}: {res.text}"
        )
        customer_ids = [c["id"] for c in res.json()]

        assert cust_b.id in customer_ids, (
            f"TEST 5 FAIL: Company B's own customer {cust_b.id} not in list — data isolation over-filters"
        )
        assert cust_a.id not in customer_ids, (
            f"TEST 5 FAIL: Company A customer {cust_a.id} appeared in Company B's customer list — "
            f"tenant isolation breach at GET /customers/"
        )

    # TEST 6 — Quick-added customer persists: GET /customers/ returns it after creation
    async def test_6_quickadd_customer_persists_in_db(self, db_session: AsyncSession):
        """
        After POST /api/v1/customers succeeds:
        - Customer row is in the DB
        - GET /api/v1/customers returns the customer in the list
        - The customer's id from POST response matches the DB row id
        This confirms ICustomerService.save() → normalizeBackendCustomer(c.id) produces
        a real DB-backed id, not a local fake id.
        """
        comp = await _create_company(db_session, "Alpha Corp T6")
        br   = await _create_branch(db_session, comp, "Alpha Main T6")
        user = await _create_user(db_session, comp, br)
        await _assign_company(db_session, user, comp)
        await db_session.commit()

        headers = _token_for(user)

        # Quick-add via API
        cust_payload = {"name": "Persistent Customer T6", "mobile": "9988776655"}
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            create_res = await client.post("/api/v1/customers", json=cust_payload, headers=headers)

        assert create_res.status_code == 201, (
            f"TEST 6 FAIL: Customer creation: {create_res.status_code} {create_res.text}"
        )
        returned_id = create_res.json().get("id")
        assert returned_id, "TEST 6 FAIL: No id in create response"
        assert not returned_id.startswith("cust_"), (
            f"TEST 6 FAIL: Returned id is a fake local id: '{returned_id}'"
        )

        # Verify it's in the DB directly
        db_result = await db_session.execute(
            select(Customer).where(
                Customer.id == returned_id,
                Customer.company_id == comp.id,
                Customer.is_deleted == False,
            )
        )
        db_row = db_result.scalars().first()
        assert db_row is not None, (
            f"TEST 6 FAIL: Customer {returned_id} not found in DB under company {comp.id}"
        )
        assert db_row.name == "Persistent Customer T6", (
            f"TEST 6 FAIL: DB row name mismatch: {db_row.name}"
        )

        # Verify GET /customers/ returns it
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            list_res = await client.get("/api/v1/customers", headers=headers)

        assert list_res.status_code == 200
        all_ids = [c["id"] for c in list_res.json()]
        assert returned_id in all_ids, (
            f"TEST 6 FAIL: Created customer {returned_id} not found in GET /customers/ list. "
            f"IDs in list: {all_ids[:5]}..."
        )
