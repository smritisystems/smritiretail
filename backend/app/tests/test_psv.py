"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Version      : 3.22.0
Created      : 2026-07-16
Modified     : 2026-07-18
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.psv import PSVParty, PSVPartySkuTracking
from app.core.security import create_access_token, hash_password
from app.api.deps import get_db
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db(db_session):
    await clear_db(db_session)

    async def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)


async def _create_user(db_session, role=UserRole.MANAGER):
    company = Company(
        id="comp-psv-1",
        name="PSV Test Company",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    branch = Branch(
        id="br-psv-1",
        company_id=company.id,
        name="PSV Branch",
        code="BR-PSV-1",
        is_active=True,
    )
    user = User(
        id="usr-psv-1",
        username="psv_user",
        email="psv@smriti.test",
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


@pytest.mark.asyncio
async def test_list_psv_parties_returns_partner_inventory(db_session):
    user = await _create_user(db_session)
    party = PSVParty(
        id="psv-party-1",
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
    assert len(payload) == 1
    partner = payload[0]
    assert partner["id"] == "psv-party-1"
    assert partner["name"] == "Southern Distributor"
    assert partner["stockCount"] == 84
    assert partner["sellThrough"] == 43.5
    assert partner["skuTracking"] == [
        {
            "productId": None,
            "sku": "SKU-PSV-001",
            "productName": None,
            "invoicedQty": 100,
            "confirmedSoldQty": 65,
            "returnedQty": 5,
        }
    ]
