"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.api.deps import get_db, get_tenant_context, TenantContext
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Branch, Company
from app.models.crm import Customer, CustomerGroup
from app.models.sales import SalesInvoice
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db(db_session):
    await clear_db(db_session)

    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_tenant_context, None)
    await clear_db(db_session)


def _bearer(user: User, company_id: str, branch_id: str) -> dict:
    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value,
        "company_id": company_id,
        "branch_id": branch_id,
        "is_platform_admin": user.is_platform_admin,
        "jti": str(uuid.uuid4()),
        "type": "access",
    })
    return {"Authorization": f"Bearer {token}"}


async def _setup_rls_environment(db_session):
    """
    Setup two companies, two branches, one user per branch,
    and a few sales invoices to test RLS containment.
    """
    # 1. Company A & Branch A
    comp_a = Company(id="comp-a", name="Company A", gst_number="27ABCDE1234F1ZA", is_active=True)
    br_a = Branch(id="br-a", company_id="comp-a", name="Branch A", code="BR-A", is_active=True)
    
    # 2. Company B & Branch B
    comp_b = Company(id="comp-b", name="Company B", gst_number="27ABCDE1234F1ZB", is_active=True)
    br_b = Branch(id="br-b", company_id="comp-b", name="Branch B", code="BR-B", is_active=True)

    db_session.add_all([comp_a, br_a, comp_b, br_b])
    await db_session.commit()

    # 3. Customer Groups and Customers
    cg_a = CustomerGroup(id="cg-a", name="Group A", company_id="comp-a", branch_id="br-a")
    cust_a = Customer(id="cust-a", name="Customer A", customer_group_id="cg-a", company_id="comp-a", branch_id="br-a")

    cg_b = CustomerGroup(id="cg-b", name="Group B", company_id="comp-b", branch_id="br-b")
    cust_b = Customer(id="cust-b", name="Customer B", customer_group_id="cg-b", company_id="comp-b", branch_id="br-b")

    db_session.add_all([cg_a, cust_a, cg_b, cust_b])
    await db_session.commit()

    # 4. User Cashier A (assigned to Company A, Branch A)
    cashier_a = User(
        id="usr-cashier-a",
        username="cashier_a",
        hashed_password=hash_password("Pass@123"),
        role=UserRole.CASHIER,
        is_active=True,
        company_id="comp-a",
        branch_id="br-a",
        tenant_id="default"
    )

    # 5. User Cashier B (assigned to Company B, Branch B)
    cashier_b = User(
        id="usr-cashier-b",
        username="cashier_b",
        hashed_password=hash_password("Pass@123"),
        role=UserRole.CASHIER,
        is_active=True,
        company_id="comp-b",
        branch_id="br-b",
        tenant_id="default"
    )

    # 6. User Manager A (assigned to Company A, Branch A)
    manager_a = User(
        id="usr-manager-a",
        username="manager_a",
        hashed_password=hash_password("Pass@123"),
        role=UserRole.MANAGER,
        is_active=True,
        company_id="comp-a",
        branch_id="br-a",
        tenant_id="default"
    )

    db_session.add_all([cashier_a, cashier_b, manager_a])
    await db_session.commit()

    # Map users to roles (seeded by conftest default)
    await db_session.execute(text(
        "INSERT INTO smriti_user_roles (id, uuid, user_id, role_id, is_active, is_deleted, created_at, modified_at) "
        "VALUES ('ur-a', :uuid1, 'usr-cashier-a', 'role-cashier', true, false, now(), now()), "
        "       ('ur-b', :uuid2, 'usr-cashier-b', 'role-cashier', true, false, now(), now()), "
        "       ('ur-m', :uuid3, 'usr-manager-a', 'role-manager', true, false, now(), now())"
    ), {"uuid1": str(uuid.uuid4()), "uuid2": str(uuid.uuid4()), "uuid3": str(uuid.uuid4())})

    # 7. Sales Invoices
    # Invoice 1 (Branch A, Created by cashier_a)
    inv_1 = SalesInvoice(
        id="inv-a1",
        invoice_no="INV-A1",
        grand_total=100.00,
        customer_id="cust-a",
        company_id="comp-a",
        branch_id="br-a",
        tenant_id="default",
        created_by="usr-cashier-a",
        items=[]
    )

    # Invoice 2 (Branch A, Created by manager_a)
    inv_2 = SalesInvoice(
        id="inv-a2",
        invoice_no="INV-A2",
        grand_total=250.00,
        customer_id="cust-a",
        company_id="comp-a",
        branch_id="br-a",
        tenant_id="default",
        created_by="usr-manager-a",
        items=[]
    )

    # Invoice 3 (Branch B, Created by cashier_b)
    inv_3 = SalesInvoice(
        id="inv-b1",
        invoice_no="INV-B1",
        grand_total=450.00,
        customer_id="cust-b",
        company_id="comp-b",
        branch_id="br-b",
        tenant_id="default",
        created_by="usr-cashier-b",
        items=[]
    )

    db_session.add_all([inv_1, inv_2, inv_3])
    await db_session.commit()
    return cashier_a, cashier_b, manager_a


@pytest.mark.asyncio
async def test_rls_self_scope_containment(db_session):
    """
    Verify that a Cashier with SELF scope can only see invoices created by themselves.
    """
    cashier_a, _, _ = await _setup_rls_environment(db_session)

    # Force scope of SALES.VIEW to SELF in permission registry
    await db_session.execute(text(
        "UPDATE smriti_permissions SET scope = 'SELF' WHERE code = 'SALES.VIEW'"
    ))
    await db_session.commit()

    headers = _bearer(cashier_a, "comp-a", "br-a")

    async def _get_tenant():
        return TenantContext(company_id="comp-a", branch_id="br-a")
    app.dependency_overrides[get_tenant_context] = _get_tenant

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/sales/invoices", headers=headers)
        assert res.status_code == 200, res.text
        invoices = res.json()
        
        # Verify cashier_a only sees their own invoice (INV-A1), and NOT manager_a's invoice (INV-A2)
        invoice_nos = [inv["invoice_no"] for inv in invoices]
        assert "INV-A1" in invoice_nos
        assert "INV-A2" not in invoice_nos


@pytest.mark.asyncio
async def test_rls_branch_scope_containment(db_session):
    """
    Verify that a Cashier with OWN_BRANCH scope can see all branch invoices.
    """
    cashier_a, _, _ = await _setup_rls_environment(db_session)

    # Force scope of SALES.VIEW to OWN_BRANCH
    await db_session.execute(text(
        "UPDATE smriti_permissions SET scope = 'OWN_BRANCH' WHERE code = 'SALES.VIEW'"
    ))
    await db_session.commit()

    headers = _bearer(cashier_a, "comp-a", "br-a")

    async def _get_tenant():
        return TenantContext(company_id="comp-a", branch_id="br-a")
    app.dependency_overrides[get_tenant_context] = _get_tenant

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/sales/invoices", headers=headers)
        assert res.status_code == 200, res.text
        invoices = res.json()
        
        # Verify cashier_a sees all invoices from Branch A
        invoice_nos = [inv["invoice_no"] for inv in invoices]
        assert "INV-A1" in invoice_nos
        assert "INV-A2" in invoice_nos
        assert "INV-B1" not in invoice_nos


@pytest.mark.asyncio
async def test_rls_admin_bypass(db_session):
    """
    Verify that a platform admin bypasses RLS filters and sees all branch invoices.
    """
    await _setup_rls_environment(db_session)

    # Create a platform admin user
    admin_user = User(
        id="usr-super-admin",
        username="super_admin_rls",
        hashed_password=hash_password("Pass@123"),
        role=UserRole.SYSADMIN,
        is_active=True,
        is_platform_admin=True,
        company_id="comp-a",
        branch_id="br-a",
        tenant_id="default"
    )
    db_session.add(admin_user)
    await db_session.commit()

    # Set SALES.VIEW to SELF.
    # Cashier would be limited to their own records, but Admin bypasses it.
    await db_session.execute(text(
        "UPDATE smriti_permissions SET scope = 'SELF' WHERE code = 'SALES.VIEW'"
    ))
    await db_session.commit()

    headers = _bearer(admin_user, "comp-a", "br-a")

    async def _get_tenant():
        return TenantContext(company_id="comp-a", branch_id="br-a")
    app.dependency_overrides[get_tenant_context] = _get_tenant

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/sales/invoices", headers=headers)
        assert res.status_code == 200
        invoices = res.json()
        
        # Platform Admin bypasses RLS and sees all invoices in active branch context (both INV-A1 and INV-A2)
        invoice_nos = [inv["invoice_no"] for inv in invoices]
        assert "INV-A1" in invoice_nos
        assert "INV-A2" in invoice_nos
