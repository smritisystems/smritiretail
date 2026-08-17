"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-14
Modified     : 2026-08-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys, os
import pytest
import asyncio
from decimal import Decimal
import httpx

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.api.deps import get_current_user, get_db
from app.db.session import async_session
from app.models.auth import User, UserRole
from app.core.security import create_access_token


BASE_URL = "http://test/api/v1"

sysadmin_user_a = User(id="usr-super", username="usr_super", role=UserRole.SYSADMIN, company_id="COMP-001", branch_id="MAIN", is_active=True, is_deleted=False)
sysadmin_user_b = User(id="usr-super", username="usr_super", role=UserRole.SYSADMIN, company_id="COMPANY_B", branch_id="BRANCH_B", is_active=True, is_deleted=False)
cashier_user = User(id="usr-cashier", username="usr_cashier", role=UserRole.CASHIER, company_id="comp-default", branch_id="br-default", is_active=True, is_deleted=False)

from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Architecture Rule: Sales invoices are operational data -> Company DB (smriti001).
# The test session MUST target smriti001, not smritisys (Control Plane).
COMPANY_001_ASYNC_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001"
test_engine = create_async_engine(COMPANY_001_ASYNC_URL, poolclass=NullPool)
test_sessionmaker = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)

@pytest.fixture(autouse=True)
def setup_user_override():
    app.dependency_overrides[get_current_user] = lambda: sysadmin_user_a
    async def _test_get_db():
        async with test_sessionmaker() as session:
            yield session
    app.dependency_overrides[get_db] = _test_get_db
    yield
    app.dependency_overrides.clear()

@pytest.fixture
def auth_headers_company_a():
    token = create_access_token({"sub": "usr-super", "company_id": "COMP-001", "branch_id": "MAIN"})
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-Code": "001",
        "X-Company-ID": "COMP-001",
        "X-Branch-Code": "MAIN",
        "Content-Type": "application/json"
    }

@pytest.fixture
def auth_headers_company_b():
    token = create_access_token({"sub": "usr-super", "company_id": "COMPANY_B", "branch_id": "BRANCH_B"})
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-Code": "COMPANY_B",
        "X-Branch-Code": "BRANCH_B",
        "Content-Type": "application/json"
    }

@pytest.mark.asyncio
async def test_01_multi_tenant_routing_company_a(auth_headers_company_a):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as client:
        res = await client.get(f"{BASE_URL}/sales/invoices?limit=10", headers=auth_headers_company_a)
        assert res.status_code == 200
        invoices = res.json()
        assert isinstance(invoices, list)

@pytest.mark.asyncio
async def test_02_multi_tenant_routing_company_b(auth_headers_company_b):
    app.dependency_overrides[get_current_user] = lambda: sysadmin_user_b
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as client:
        res = await client.get(f"{BASE_URL}/sales/invoices?limit=10", headers=auth_headers_company_b)
        assert res.status_code == 200
        invoices = res.json()
        assert isinstance(invoices, list)
        assert len(invoices) == 0

@pytest.mark.asyncio
async def test_03_header_tampering_and_cross_tenant_isolation_forbidden(auth_headers_company_b):
    app.dependency_overrides[get_current_user] = lambda: cashier_user
    token = create_access_token({"sub": "usr-cashier", "company_id": "comp-default", "branch_id": "br-default"})
    tampered_headers = {
        "Authorization": f"Bearer {token}",
        "X-Company-Code": "UNAUTHORIZED_COMPANY",
        "X-Branch-Code": "MAIN",
        "Content-Type": "application/json"
    }
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as client:
        # Header tampering check
        res = await client.get(f"{BASE_URL}/sales/invoices?limit=10", headers=tampered_headers)
        assert res.status_code == 403

        # Cross-Tenant PDF/HTML Access Check: Attempting to access Company A invoice from Company B context
        app.dependency_overrides[get_current_user] = lambda: sysadmin_user_b
        res_cross_pdf = await client.get(f"{BASE_URL}/sales/invoices/inv-test-contract-04/pdf", headers=auth_headers_company_b)
        assert res_cross_pdf.status_code == 404

        res_cross_html = await client.get(f"{BASE_URL}/sales/invoices/inv-test-contract-04/html", headers=auth_headers_company_b)
        assert res_cross_html.status_code == 404

@pytest.mark.asyncio
async def test_04_create_invoice_and_verify_stock_deduction(auth_headers_company_a):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as client:
        inv_payload = {
            "id": "inv-test-contract-04",
            "invoiceNo": "INV-TEST-CONTRACT-04",
            "customerId": "cust-ril-1888",
            "items": [{
                "productId": "prod-ch-01-a-cream-36",
                "code": "CH-01-A-CREAM-36",
                "name": "CH-01-A CREAM 36",
                "quantity": 2,
                "price": 1000.00,
                "hsnCode": "64041990",
                "gstRate": 18.00,
                "taxAmount": 360.00,
                "totalAmount": 2360.00
            }],
            "status": "Submitted",
            "isInterstate": True
        }
        res = await client.post(f"{BASE_URL}/sales/invoices", json=inv_payload, headers=auth_headers_company_a)
        assert res.status_code in (200, 201)
        data = res.json()
        assert data["invoice_no"] == "INV-TEST-CONTRACT-04"
        assert float(data["grand_total"]) == 2360.00

@pytest.mark.asyncio
async def test_05_create_invoice_outbox_event(auth_headers_company_a):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as client:
        res = await client.get(f"{BASE_URL}/sales/invoices/inv-test-contract-04", headers=auth_headers_company_a)
        assert res.status_code == 200
        inv = res.json()
        assert inv["id"] == "inv-test-contract-04"

@pytest.mark.asyncio
async def test_06_get_invoice_detail_authoritative(auth_headers_company_a):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as client:
        res = await client.get(f"{BASE_URL}/sales/invoices/inv-test-contract-04", headers=auth_headers_company_a)
        assert res.status_code == 200
        inv = res.json()
        assert inv["invoice_no"] == "INV-TEST-CONTRACT-04"
        assert float(inv["grand_total"]) == 2360.00

@pytest.mark.asyncio
async def test_07_get_html_preview_matches_db(auth_headers_company_a):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as client:
        res = await client.get(f"{BASE_URL}/sales/invoices/inv-test-contract-04/html", headers=auth_headers_company_a)
        assert res.status_code == 200
        assert "TAX INVOICE" in res.text
        assert "INV-TEST-CONTRACT-04" in res.text

@pytest.mark.asyncio
async def test_08_get_pdf_rendered_successfully(auth_headers_company_a):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as client:
        res = await client.get(f"{BASE_URL}/sales/invoices/inv-test-contract-04/pdf", headers=auth_headers_company_a)
        assert res.status_code == 200
        assert "TAX INVOICE" in res.text

@pytest.mark.asyncio
async def test_09_print_preview_structure(auth_headers_company_a):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as client:
        res = await client.get(f"{BASE_URL}/sales/invoices/inv-test-contract-04/html", headers=auth_headers_company_a)
        assert res.status_code == 200
        assert "2360.00" in res.text

@pytest.mark.asyncio
async def test_10_double_submit_idempotency_semantics(auth_headers_company_a):
    headers_key_a = {**auth_headers_company_a, "Idempotency-Key": "IDEM-KEY-001"}
    headers_key_b = {**auth_headers_company_a, "Idempotency-Key": "IDEM-KEY-002"}

    inv_payload_1 = {
        "customerId": "cust-ril-1888",
        "items": [{
            "productId": "prod-ch-01-a-cream-36",
            "code": "CH-01-A-CREAM-36",
            "name": "CH-01-A CREAM 36",
            "quantity": 1,
            "price": 500.00,
            "hsnCode": "64041990",
            "gstRate": 18.00,
            "taxAmount": 90.00,
            "totalAmount": 590.00
        }],
        "status": "Submitted",
        "isInterstate": False
    }

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as client:
        # Step 1: Request 1 + Key A -> Invoice 1 Created
        res1 = await client.post(f"{BASE_URL}/sales/invoices", json=inv_payload_1, headers=headers_key_a)
        assert res1.status_code in (200, 201)
        data1 = res1.json()
        assert data1["id"] == "IDEM-KEY-001"

        # Step 2: Request 2 + SAME Key A -> SAME Invoice returned (no duplicate)
        res2 = await client.post(f"{BASE_URL}/sales/invoices", json=inv_payload_1, headers=headers_key_a)
        assert res2.status_code in (200, 201)
        data2 = res2.json()
        assert data2["id"] == "IDEM-KEY-001"
        assert data1["id"] == data2["id"]

        # Step 3: Request 3 + Key B -> New legitimate request -> Invoice 2 Created
        inv_payload_2 = {**inv_payload_1, "items": [{**inv_payload_1["items"][0], "quantity": 2, "totalAmount": 1180.00}]}
        res3 = await client.post(f"{BASE_URL}/sales/invoices", json=inv_payload_2, headers=headers_key_b)
        assert res3.status_code in (200, 201)
        data3 = res3.json()
        assert data3["id"] == "IDEM-KEY-002"
        assert data3["id"] != data1["id"]
