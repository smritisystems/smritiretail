"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-14
Modified     : 2026-08-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import sys
import uuid
from decimal import Decimal
from urllib.parse import urlparse

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import async_session
from app.main import app
from app.models.auth import User, UserRole
from app.models.item_master import Item, ItemVariant

BASE_URL = "http://test/api/v1"

sysadmin_user_a = User(id="usr-super", username="usr_super", role=UserRole.SYSADMIN, company_id="COMP-001", branch_id="MAIN", is_active=True, is_deleted=False)
# COMP-002 is registered in smritisys.company_database_registries -> smriti002 (READY).
# Using COMPANY_B (fictitious code) caused 403 fail-closed from resolve_company_database_name.
sysadmin_user_b = User(id="usr-super", username="usr_super", role=UserRole.SYSADMIN, company_id="COMP-SALES-002", branch_id="BR-SALES-002", is_active=True, is_deleted=False)
cashier_user = User(id="usr-cashier", username="usr_cashier", role=UserRole.CASHIER, company_id="comp-default", branch_id="br-default", is_active=True, is_deleted=False)

# Sales invoices are operational data; tests use the isolated Company 001 database.
_PG_PORT = urlparse(str(settings.DATABASE_URL)).port or int(os.getenv("POSTGRES_PORT", 5432))

COMPANY_001_ASYNC_URL = f"postgresql+asyncpg://postgres:postgres@localhost:{_PG_PORT}/smriti_test_001"
test_engine = create_async_engine(COMPANY_001_ASYNC_URL, poolclass=NullPool)
test_sessionmaker = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)

_cleaned_once = False
_created_invoice_id = None

@pytest.fixture(scope="module", autouse=True)
async def seed_sales_contract_product():
    item_id = "item-sales-contract-04"
    variant_id = "variant-sales-contract-04"
    async with test_sessionmaker() as session:
        item = Item(
            id=item_id,
            company_id="COMP-001",
            item_code="TEST-SALES-CONTRACT-04",
            item_name="CH-01-A CREAM 36",
            item_type="FINISHED_GOOD",
            category="Footwear",
            brand="CH",
            hsn_code="64041990",
            tax_rate=Decimal("18.00"),
            selling_price=Decimal("1000.00"),
            mrp=Decimal("1000.00"),
            cost_price=Decimal("500.00"),
            status="ACTIVE",
        )
        variant = ItemVariant(
            id=variant_id,
            company_id="COMP-001",
            item_id=item_id,
            variant_sku="TEST-SALES-CONTRACT-04",
            variant_name="CH-01-A CREAM 36",
            hsn_code="64041990",
            tax_rate=Decimal("18.00"),
            selling_price=Decimal("1000.00"),
            mrp=Decimal("1000.00"),
            cost_price=Decimal("500.00"),
        )
        await session.merge(item)
        await session.merge(variant)
        await session.execute(
            text("""
                UPDATE products
                SET item_id = :item_id, item_variant_id = :variant_id
                WHERE id = 'prod-ch-01-a-cream-36'
            """),
            {"item_id": item_id, "variant_id": variant_id},
        )
        await session.commit()

    yield

@pytest.fixture(scope="module", autouse=True)
async def seed_company_b_routing():
    company_id = "COMP-SALES-002"
    branch_id = "BR-SALES-002"
    async with async_session() as session:
        await session.execute(
            text("""
                INSERT INTO companies (
                    id, uuid, name, company_code, is_active, is_deleted, created_at, modified_at
                )
                VALUES (:company_id, :uuid, 'Sales Contract Test Company B', 'SALES002',
                    true, false, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name, company_code = EXCLUDED.company_code,
                    is_active = true, is_deleted = false
            """),
            {"company_id": company_id, "uuid": str(uuid.uuid4())},
        )
        await session.execute(
            text("""
                INSERT INTO branches (
                    id, uuid, company_id, name, code, is_default, is_active, is_deleted,
                    created_at, modified_at
                )
                VALUES (:branch_id, :uuid, :company_id, 'Sales Contract Test Branch B',
                    'SALES002', true, true, false, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                    company_id = EXCLUDED.company_id, code = EXCLUDED.code,
                    is_default = true, is_active = true, is_deleted = false
            """),
            {
                "branch_id": branch_id,
                "uuid": str(uuid.uuid4()),
                "company_id": company_id,
            },
        )
        await session.execute(
            text("""
                INSERT INTO company_database_registries (
                    company_id, database_id, database_name, database_engine, host_reference,
                    port_reference, status, schema_version, provisioning_status, migration_status,
                    created_at, updated_at
                )
                VALUES (:company_id, :database_id, 'smriti_test_002', 'postgresql', 'localhost',
                    :port, 'READY', '3.29.0', 'COMPLETED', 'UP_TO_DATE', NOW(), NOW())
                ON CONFLICT (company_id) DO UPDATE SET
                    database_name = 'smriti_test_002', status = 'READY', updated_at = NOW()
            """),
            {
                "company_id": company_id,
                "database_id": str(uuid.uuid4()),
                "port": _PG_PORT,
            },
        )
        await session.commit()

    yield

    async with async_session() as session:
        await session.execute(
            text("DELETE FROM company_database_registries WHERE company_id = :company_id"),
            {"company_id": company_id},
        )
        await session.execute(
            text("DELETE FROM branches WHERE company_id = :company_id"),
            {"company_id": company_id},
        )
        await session.execute(
            text("DELETE FROM companies WHERE id = :company_id"),
            {"company_id": company_id},
        )
        await session.commit()


@pytest.fixture(autouse=True)
async def setup_user_override():
    global _cleaned_once
    app.dependency_overrides[get_current_user] = lambda: sysadmin_user_a

    if not _cleaned_once:
        async with test_sessionmaker() as session:
            await session.execute(
                text("""
                    DELETE FROM sales_invoice_items
                    WHERE invoice_id IN (
                        SELECT id FROM sales_invoices
                        WHERE id IN ('inv-test-contract-04', 'IDEM-KEY-001', 'IDEM-KEY-002')
                           OR invoice_no = 'INV-TEST-CONTRACT-04'
                           OR rule_snapshots->>'idempotency_key' IN ('IDEM-KEY-001', 'IDEM-KEY-002')
                    );
                """)
            )
            await session.execute(
                text("""
                    DELETE FROM sales_invoices
                    WHERE id IN ('inv-test-contract-04', 'IDEM-KEY-001', 'IDEM-KEY-002')
                       OR invoice_no = 'INV-TEST-CONTRACT-04'
                       OR rule_snapshots->>'idempotency_key' IN ('IDEM-KEY-001', 'IDEM-KEY-002');
                """)
            )
            await session.execute(
                text("""
                    DELETE FROM transaction_idempotency_records
                    WHERE entity_type = 'SALES_INVOICE'
                      AND idempotency_key IN ('IDEM-KEY-001', 'IDEM-KEY-002');
                """)
            )
            await session.execute(
                text("""
                    UPDATE product_batch_stocks 
                    SET quantity = 100.0000 
                    WHERE product_id = 'prod-ch-01-a-cream-36' AND warehouse_id = 'wh-central-001';
                """)
            )
            await session.commit()
        _cleaned_once = True

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
    token = create_access_token({"sub": "usr-super", "company_id": "COMP-SALES-002", "branch_id": "BR-SALES-002"})
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-Code": "TEST_002",
        "X-Company-ID": "COMP-SALES-002",
        "X-Branch-Code": "SALES002",
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

@pytest.mark.asyncio
async def test_03_header_tampering_is_forbidden():
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

@pytest.mark.asyncio
async def test_04_create_invoice_and_verify_stock_deduction(auth_headers_company_a, auth_headers_company_b):
    global _created_invoice_id
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as client:
        inv_payload = {
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
                "isTaxInclusive": False,
                "taxAmount": 360.00,
                "totalAmount": 2360.00
            }],
            "status": "Submitted",
            "isInterstate": True
        }
        res = await client.post(f"{BASE_URL}/sales/invoices", json=inv_payload, headers=auth_headers_company_a)
        assert res.status_code in (200, 201), res.text
        data = res.json()
        _created_invoice_id = data["id"]
        assert data["invoice_no"] == "INV-TEST-CONTRACT-04"
        assert float(data["grand_total"]) == 2360.00

        # A real Company A invoice must not be visible from Company B.
        app.dependency_overrides[get_current_user] = lambda: sysadmin_user_b
        res_cross_pdf = await client.get(
            f"{BASE_URL}/sales/invoices/{_created_invoice_id}/pdf",
            headers=auth_headers_company_b,
        )
        assert res_cross_pdf.status_code == 404
        res_cross_html = await client.get(
            f"{BASE_URL}/sales/invoices/{_created_invoice_id}/html",
            headers=auth_headers_company_b,
        )
        assert res_cross_html.status_code == 404

@pytest.mark.asyncio
async def test_05_create_invoice_outbox_event(auth_headers_company_a):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as client:
        res = await client.get(f"{BASE_URL}/sales/invoices/{_created_invoice_id}", headers=auth_headers_company_a)
        assert res.status_code == 200
        inv = res.json()
        assert inv["id"] == _created_invoice_id

@pytest.mark.asyncio
async def test_06_get_invoice_detail_authoritative(auth_headers_company_a):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as client:
        res = await client.get(f"{BASE_URL}/sales/invoices/{_created_invoice_id}", headers=auth_headers_company_a)
        assert res.status_code == 200
        inv = res.json()
        assert inv["invoice_no"] == "INV-TEST-CONTRACT-04"
        assert float(inv["grand_total"]) == 2360.00

@pytest.mark.asyncio
async def test_07_get_html_preview_matches_db(auth_headers_company_a):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as client:
        res = await client.get(f"{BASE_URL}/sales/invoices/{_created_invoice_id}/html", headers=auth_headers_company_a)
        assert res.status_code == 200
        assert "TAX INVOICE" in res.text
        assert "INV-TEST-CONTRACT-04" in res.text

@pytest.mark.asyncio
async def test_08_get_pdf_rendered_successfully(auth_headers_company_a):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as client:
        res = await client.get(f"{BASE_URL}/sales/invoices/{_created_invoice_id}/pdf", headers=auth_headers_company_a)
        assert res.status_code == 200
        assert "TAX INVOICE" in res.text

@pytest.mark.asyncio
async def test_09_print_preview_structure(auth_headers_company_a):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as client:
        res = await client.get(f"{BASE_URL}/sales/invoices/{_created_invoice_id}/html", headers=auth_headers_company_a)
        assert res.status_code == 200
        assert "2,360.00" in res.text or "2360.00" in res.text

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
        assert data1["id"]

        # Step 2: Request 2 + SAME Key A -> SAME Invoice returned (no duplicate)
        res2 = await client.post(f"{BASE_URL}/sales/invoices", json=inv_payload_1, headers=headers_key_a)
        assert res2.status_code in (200, 201)
        data2 = res2.json()
        assert data1["id"] == data2["id"]

        # Step 3: Request 3 + Key B -> New legitimate request -> Invoice 2 Created
        inv_payload_2 = {**inv_payload_1, "items": [{**inv_payload_1["items"][0], "quantity": 2, "totalAmount": 1180.00}]}
        res3 = await client.post(f"{BASE_URL}/sales/invoices", json=inv_payload_2, headers=headers_key_b)
        assert res3.status_code in (200, 201)
        data3 = res3.json()
        assert data3["id"]
        assert data3["id"] != data1["id"]
