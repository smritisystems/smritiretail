"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Version      : 3.22.0
Created      : 2026-07-16
Modified     : 2026-07-16
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.psv import PSVParty, PSVPartySkuTracking
from app.core.security import create_access_token, hash_password
from sqlalchemy import text
from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db(db_session):
    await clear_db(db_session)
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
    party = PSVParty(
        id=party_id,
        name="Southern Distributor",
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

    db_session.add(party)
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
    assert (partner.get("stockCount") == 84 or partner.get("stock_count") == 84)
    assert (float(partner.get("sellThrough") or partner.get("sell_through") or 0)) == 43.5
    sku_list = partner.get("skuTracking") or partner.get("sku_tracking") or []
    assert len(sku_list) == 1
    assert sku_list[0]["sku"] == "SKU-PSV-001"
    assert (sku_list[0].get("invoicedQty") or sku_list[0].get("invoiced_qty")) == 100
    assert (sku_list[0].get("confirmedSoldQty") or sku_list[0].get("confirmed_sold_qty")) == 65
    assert (sku_list[0].get("returnedQty") or sku_list[0].get("returned_qty")) == 5
