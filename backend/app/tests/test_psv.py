"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Version      : 3.22.0
Created      : 2026-07-16
Modified     : 2026-07-16
"""

import uuid
import pytest
from decimal import Decimal
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.psv import PSVParty, PSVPartySkuTracking, PSVStockBalance
from app.models.inventory import Product
from app.models.crm import Customer, CustomerDeliveryLocation
from app.core.security import create_access_token, hash_password
from sqlalchemy import text
from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db(db_session):
    await clear_db(db_session)
    await db_session.execute(text("DELETE FROM psv_stock_balances;"))
    await db_session.execute(text("DELETE FROM psv_sku_tracking;"))
    await db_session.execute(text("DELETE FROM psv_parties;"))
    await db_session.commit()

    async def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_company_db] = _get_db
    try:
        yield
    finally:
        try:
            await clear_db(db_session)
            await db_session.execute(text("DELETE FROM psv_stock_balances;"))
            await db_session.execute(text("DELETE FROM psv_sku_tracking;"))
            await db_session.execute(text("DELETE FROM psv_parties;"))
            await db_session.commit()
        except Exception:
            pass
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_company_db, None)
        app.dependency_overrides.pop(get_tenant_context, None)


async def _create_user(db_session, role=UserRole.MANAGER):
    s = uuid.uuid4().hex[:6]
    company = Company(
        id=f"comp-psv-{s}",
        name=f"PSV Test Company {s}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    branch = Branch(
        id=f"br-psv-{s}",
        company_id=company.id,
        name=f"PSV Branch {s}",
        code=f"BR-PSV-{s}",
        is_active=True,
    )
    user = User(
        id=f"usr-psv-{s}",
        username=f"psv_user_{s}",
        email=f"psv_{s}@smriti.test",
        hashed_password=hash_password("P@ssword123"),
        role=role,
        is_active=True,
        is_deleted=False,
        company_id=company.id,
        branch_id=branch.id,
    )
    db_session.add_all([company, branch, user])
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


def _set_tenant(db_session, comp_id, br_id):
    async def _gt():
        return TenantContext(company_id=comp_id, branch_id=br_id)
    app.dependency_overrides[get_tenant_context] = _gt


@pytest.mark.asyncio
async def test_list_psv_parties_returns_partner_inventory(db_session):
    user = await _create_user(db_session)
    _set_tenant(db_session, user.company_id, user.branch_id)
    party_id = f"psv-party-{uuid.uuid4().hex[:6]}"
    customer_id = f"psv-customer-{uuid.uuid4().hex[:6]}"
    delivery_location_id = f"psv-location-{uuid.uuid4().hex[:6]}"
    customer = Customer(
        id=customer_id,
        company_id=user.company_id,
        name="PSV Test Retailer",
    )
    delivery_location = CustomerDeliveryLocation(
        id=delivery_location_id,
        company_id=user.company_id,
        customer_id=customer_id,
        store_code="REL001",
        location_name="Bangalore Store",
        city="Bengaluru",
        state="Karnataka",
    )
    party = PSVParty(
        id=party_id,
        company_id=user.company_id,
        host_customer_id=customer_id,
        delivery_location_id=delivery_location_id,
        name="Southern Distributor",
        store_code="REL001",
        store_name_snapshot="Bangalore Store",
        location="Bangalore",
        stock_count=84,
        sell_through=43.5,
        weeks_of_cover=5.2,
        capital_locked=129500.00,
        status="Healthy",
    )
    sku = PSVPartySkuTracking(
        party_id=party.id,
        product_id=None,
        sku="SKU-PSV-001",
        invoiced_qty=100,
        confirmed_sold_qty=65,
        returned_qty=5,
    )
    party.sku_tracking = [sku]

    db_session.add_all([customer, delivery_location, party])
    db_session.add(sku)
    await db_session.commit()

    headers = _auth_headers(user)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/psv/parties", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) >= 1
    partner = next(p for p in payload if p["id"] == party_id)
    assert partner["name"] == "Southern Distributor"
    assert partner["store_code"] == "REL001"
    assert partner["store_name_snapshot"] == "Bangalore Store"
    assert partner["city"] == "Bengaluru"
    assert partner["state"] == "Karnataka"
    assert (partner.get("stockCount") == 84 or partner.get("stock_count") == 84)
    assert (float(partner.get("sellThrough") or partner.get("sell_through") or 0)) == 43.5
    sku_list = partner.get("skuTracking") or partner.get("sku_tracking") or []
    assert len(sku_list) == 1
    assert sku_list[0]["sku"] == "SKU-PSV-001"
    assert (sku_list[0].get("invoicedQty") or sku_list[0].get("invoiced_qty")) == 100
    assert (sku_list[0].get("confirmedSoldQty") or sku_list[0].get("confirmed_sold_qty")) == 65
    assert (sku_list[0].get("returnedQty") or sku_list[0].get("returned_qty")) == 5


@pytest.mark.asyncio
async def test_list_psv_parties_builds_sku_inventory_from_stock_balances(db_session):
    user = await _create_user(db_session)
    _set_tenant(db_session, user.company_id, user.branch_id)
    party_id = f"psv-balance-party-{uuid.uuid4().hex[:6]}"
    product_id = f"psv-product-{uuid.uuid4().hex[:6]}"
    party = PSVParty(
        id=party_id,
        company_id=user.company_id,
        name="Store from Balance",
        store_code="REL-BAL-01",
        store_name_snapshot="Bengaluru Central",
        location="Bengaluru, Karnataka",
    )
    product = Product(
        id=product_id,
        company_id=user.company_id,
        branch_id=user.branch_id,
        code=f"SKU-{uuid.uuid4().hex[:8]}",
        name="Cotton Shirt",
        price=Decimal("799.00"),
        category="Apparel",
        barcode=f"BAR-{uuid.uuid4().hex[:8]}",
        style_code="SHIRT-01",
        color="Navy",
        size="M",
    )
    balance = PSVStockBalance(
        id=f"psv-bal-{uuid.uuid4().hex[:8]}",
        company_id=user.company_id,
        company_code=user.company_id,
        product_id=product_id,
        psv_party_id=party_id,
        store_code_snapshot="REL-BAL-01",
        sku=product.code,
        billed_qty=Decimal("60"),
        received_qty=Decimal("55"),
        sold_qty=Decimal("15"),
        returned_qty=Decimal("2"),
        transferred_qty=Decimal("1"),
        current_balance=Decimal("37"),
    )
    db_session.add_all([party, product, balance])
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/psv/parties", headers=_auth_headers(user))

    assert response.status_code == 200
    partner = next(row for row in response.json() if row["id"] == party_id)
    assert partner["stock_count"] == 37
    sku_list = partner["sku_tracking"]
    assert len(sku_list) == 1
    assert sku_list[0]["sku"] == product.code
    assert sku_list[0]["product_name"] == "Cotton Shirt"
    assert Decimal(str(sku_list[0]["current_balance"])) == Decimal("37")
    assert Decimal(str(sku_list[0]["billed_qty"])) == Decimal("60")
    assert Decimal(str(sku_list[0]["sold_qty"])) == Decimal("15")
    assert sku_list[0]["style_code"] == "SHIRT-01"
    assert sku_list[0]["color"] == "Navy"
    assert sku_list[0]["size"] == "M"
    assert sku_list[0]["category"] == "Apparel"
