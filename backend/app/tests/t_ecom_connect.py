"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.29.0
Created      : 2026-08-17
Modified     : 2026-08-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import pytest
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
from sqlalchemy.future import select

from app.main import app
from app.api.deps import get_db, get_company_db
from app.api.v1.ecom import get_ecom_company_session, get_ecom_webhook_session
from app.models.tenant import Company, Branch
from app.models.auth import User, UserRole
from app.models.inventory import Product
from app.models.outbox import IntegrationOutboxEvent
from app.core.security import create_access_token
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def clean_database_fixture(db_session):
    await clear_db(db_session)
    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_company_db] = _get_db
    app.dependency_overrides[get_ecom_company_session] = _get_db
    app.dependency_overrides[get_ecom_webhook_session] = _get_db
    try:
        yield
    finally:
        try:
            await clear_db(db_session)
        except Exception:
            pass
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_company_db, None)
        app.dependency_overrides.pop(get_ecom_company_session, None)
        app.dependency_overrides.pop(get_ecom_webhook_session, None)


async def _seed_company_and_product(db_session, suffix):
    comp = Company(id=f"comp-ec-{suffix}", name=f"Ecom Co {suffix}", gst_number="27ABCDE1234F1Z5", is_active=True)
    br = Branch(id=f"br-ec-{suffix}", company_id=comp.id, name=f"Ecom Br {suffix}", code=f"BREC-{suffix}", is_active=True)
    db_session.add(comp)
    db_session.add(br)
    await db_session.commit()

    prod = Product(
        id=f"prod-ec-{suffix}",
        code=f"SKU-EC-{suffix}",
        sku=f"SKU-EC-{suffix}",
        name=f"Ecom Product {suffix}",
        category="Footwear",
        barcode=f"890{suffix}001",
        price=Decimal("150.00"),
        mrp=Decimal("180.00"),
        gst_percentage=Decimal("18.00"),
        hsn_code="6403",
        stock=20,
        reserved_stock=Decimal("0.0000"),
        company_id=comp.id,
        branch_id=br.id,
        is_active=True,
    )
    db_session.add(prod)
    await db_session.commit()
    return comp, br, prod


@pytest.mark.asyncio
async def test_shopify_webhook_processing_and_idempotency(db_session):
    """Test Shopify webhook ingress, stock reservation, and duplicate idempotency."""
    suffix = uuid.uuid4().hex[:6]
    comp, br, prod = await _seed_company_and_product(db_session, suffix)

    from app.core.config import settings
    headers = {
        "X-Company-ID": comp.id,
        "X-Company-Code": "001",
        "X-Internal-Service-Key": settings.INTERNAL_SERVICE_KEY,
        "X-Shopify-Topic": "orders/create"
    }

    order_payload = {
        "id": f"1001{suffix}",
        "order_number": f"SHP-{suffix}",
        "line_items": [
            {
                "sku": prod.code,
                "quantity": 3,
                "price": "150.00"
            }
        ]
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # First delivery
        res1 = await client.post("/api/v1/ecom/webhooks/shopify", json=order_payload, headers=headers)
        assert res1.status_code == 200, res1.text
        data1 = res1.json()
        assert data1["status"] == "PROCESSED"
        assert len(data1["reserved_items"]) == 1

        # Duplicate delivery
        res2 = await client.post("/api/v1/ecom/webhooks/shopify", json=order_payload, headers=headers)
        assert res2.status_code == 200, res2.text
        data2 = res2.json()
        assert data2["status"] == "DUPLICATE_IGNORED"


@pytest.mark.asyncio
async def test_woocommerce_webhook_processing_and_idempotency(db_session):
    """Test WooCommerce webhook ingress and duplicate idempotency."""
    suffix = uuid.uuid4().hex[:6]
    comp, br, prod = await _seed_company_and_product(db_session, suffix)

    from app.core.config import settings
    headers = {
        "X-Company-ID": comp.id,
        "X-Company-Code": "001",
        "X-Internal-Service-Key": settings.INTERNAL_SERVICE_KEY,
        "X-WC-Webhook-Topic": "order.created"
    }

    woo_payload = {
        "id": f"2002{suffix}",
        "line_items": [
            {
                "sku": prod.code,
                "quantity": 2,
                "total": "200.00"
            }
        ]
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/ecom/webhooks/woocommerce", json=woo_payload, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["channel"] == "WOOCOMMERCE"
        assert data["status"] == "PROCESSED"

        # Duplicate delivery
        res_dup = await client.post("/api/v1/ecom/webhooks/woocommerce", json=woo_payload, headers=headers)
        assert res_dup.status_code == 200
        assert res_dup.json()["status"] == "DUPLICATE_IGNORED"


@pytest.mark.asyncio
async def test_customer_portal_orders_endpoint(db_session):
    """Test customer portal order history endpoint with authentication."""
    suffix = uuid.uuid4().hex[:6]
    comp, br, _ = await _seed_company_and_product(db_session, suffix)
    user = User(
        id=f"user-{suffix}",
        username=f"user_{suffix}",
        hashed_password="fakehash",
        role=UserRole.CASHIER,
        company_id=comp.id,
        branch_id=br.id,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value,
        "company_id": comp.id,
        "branch_id": br.id
    })
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": comp.id,
        "X-Branch-ID": br.id,
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Anonymous request -> 401
        res_anon = await client.get("/api/v1/ecom/portal/orders?customer_phone=9876543210")
        assert res_anon.status_code == 401, f"Expected 401 for anonymous portal request, got {res_anon.status_code}"

        # Authenticated request -> 200
        res = await client.get("/api/v1/ecom/portal/orders?customer_phone=9876543210", headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["success"] is True
        assert "orders" in data


@pytest.mark.asyncio
async def test_reserve_ecom_inventory_auth(db_session):
    """Test reserve_ecom_inventory rejects anonymous and allows authenticated."""
    suffix = uuid.uuid4().hex[:6]
    comp, br, prod = await _seed_company_and_product(db_session, suffix)
    user = User(
        id=f"user-resv-{suffix}",
        username=f"user_resv_{suffix}",
        hashed_password="fakehash",
        role=UserRole.CASHIER,
        company_id=comp.id,
        branch_id=br.id,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()

    reserve_payload = {
        "sku": prod.code,
        "quantity": 2,
        "ecom_order_id": f"ORD-RESV-{suffix}"
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Anonymous request -> 401
        res_anon = await client.post("/api/v1/ecom/orders/reserve", json=reserve_payload)
        assert res_anon.status_code == 401, f"Expected 401 for anonymous stock reservation, got {res_anon.status_code}"

        # Authenticated request -> 200
        token = create_access_token({
            "sub": user.id,
            "username": user.username,
            "role": user.role.value,
            "company_id": comp.id,
            "branch_id": br.id
        })
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Company-ID": comp.id,
            "X-Branch-ID": br.id,
        }
        res_auth = await client.post("/api/v1/ecom/orders/reserve", json=reserve_payload, headers=headers)
        assert res_auth.status_code == 200, res_auth.text
        data = res_auth.json()
        assert data["success"] is True
        assert data["sku"] == prod.code
