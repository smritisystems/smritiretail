"""
Product Identity Engine integration tests.
"""

import uuid
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.inventory import Product
from app.models.tenant import Branch, Company
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    await clear_db(db_session)

    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_company_db] = _get_db
    try:
        yield
    finally:
        try:
            await clear_db(db_session)
        except Exception:
            pass
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_company_db, None)
        app.dependency_overrides.pop(get_tenant_context, None)


async def _make_tenant(db_session, suffix):
    comp = Company(id=f"comp-pie-{suffix}", name=f"PIE Co {suffix}", gst_number="27ABCDE1234F1Z5", is_active=True)
    br = Branch(id=f"br-pie-{suffix}", company_id=comp.id, name=f"PIE Br {suffix}", code=f"BRPIE-{suffix}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def _make_user(db_session, suffix, comp_id, br_id, role=UserRole.MANAGER):
    user = User(
        id=f"usr-pie-{suffix}", username=f"usr_pie_{suffix}",
        hashed_password=hash_password("Test@1234"),
        role=role, is_active=True, is_deleted=False,
        company_id=comp_id, branch_id=br_id,
    )
    db_session.add(user)
    await db_session.commit()
    return user


def _bearer(user: User, comp_id: str, br_id: str) -> dict:
    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value,
        "company_id": comp_id,
        "branch_id": br_id,
        "jti": str(uuid.uuid4()),
        "type": "access",
    })
    return {"Authorization": f"Bearer {token}"}


def _set_tenant(comp_id: str, br_id: str):
    async def _gt():
        return TenantContext(company_id=comp_id, branch_id=br_id)
    app.dependency_overrides[get_tenant_context] = _gt


@pytest.mark.asyncio
async def test_create_barcode_provider_and_identity(db_session):
    s = uuid.uuid4().hex[:6]
    comp, br = await _make_tenant(db_session, s)
    manager = await _make_user(db_session, f"mgr_{s}", comp.id, br.id, role=UserRole.MANAGER)
    headers = _bearer(manager, comp.id, br.id)
    _set_tenant(comp.id, br.id)

    product = Product(
        id=f"prod-pie-{s}",
        code=f"PIE-{s}",
        name=f"PIE Product {s}",
        price=100.0,
        mrp=120.0,
        gst_percentage=18.0,
        hsn_code="6403",
        stock=10,
        category="Footwear",
        barcode=f"00011122{s}",
        company_id=comp.id,
        branch_id=br.id,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(product)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        provider_req = {
            "name": f"GS1-IN-{s}",
            "providerType": "GS1",
            "poolCode": f"EAN13-{s}",
            "priority": 10,
            "config": {"prefix": "890"},
            "description": "Test GS1 pool",
            "isActive": True,
        }
        res = await ac.post("/api/v1/product-identity/providers", json=provider_req, headers=headers)
        assert res.status_code == 201
        provider = res.json()
        assert provider["name"] == f"GS1-IN-{s}"
        assert provider["poolCode"] == f"EAN13-{s}"

        identity_req = {
            "productId": product.id,
            "businessKey": f"FOOT-{s}-RED-38",
            "fingerprint": f"fp-{s}",
            "barcode": f"8901234{s}",
            "barcodeProviderId": provider["id"],
            "state": "Assigned",
            "identityMetadata": {"color": "Red", "size": "38"},
            "ruleId": None,
        }
        res = await ac.post("/api/v1/product-identity/identities", json=identity_req, headers=headers)
        assert res.status_code == 201
        identity = res.json()
        assert identity["businessKey"] == f"FOOT-{s}-RED-38"
        assert identity["barcode"] == f"8901234{s}"
        assert identity["state"] == "Assigned"
