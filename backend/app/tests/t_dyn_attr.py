"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.29.0
Created      : 2026-08-21
Modified     : 2026-08-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import TenantContext, get_db, get_tenant_context, get_company_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.attributes import AttributeDefinition
from app.models.inventory import Product
from app.models.tenant import Branch, Company
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    """
    Wire the test DB session into the app and clean all tables
    before and after each test.
    """
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
    comp = Company(id=f"comp-attr-{suffix}", name=f"Attr Co {suffix}",
                   gst_number="27ABCDE1234F1Z5", is_active=True)
    br   = Branch(id=f"br-attr-{suffix}", company_id=comp.id,
                   name=f"Attr Br {suffix}", code=f"BRATTR-{suffix}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def _make_user(db_session, suffix, comp_id, br_id, role=UserRole.MANAGER):
    user = User(
        id=f"usr-attr-{suffix}", username=f"usr_attr_{suffix}",
        hashed_password=hash_password("Test@1234"),
        role=role, is_active=True, is_deleted=False,
        company_id=comp_id, branch_id=br_id,
    )
    db_session.add(user)
    await db_session.commit()
    return user


def _bearer(user: User, comp_id: str, br_id: str) -> dict:
    token = create_access_token({
        "sub": user.id, "username": user.username,
        "role": user.role.value, "company_id": comp_id, "branch_id": br_id,
        "jti": str(uuid.uuid4()), "type": "access",
    })
    return {"Authorization": f"Bearer {token}"}


def _set_tenant(db_session, comp_id, br_id):
    async def _gt():
        return TenantContext(company_id=comp_id, branch_id=br_id)
    app.dependency_overrides[get_tenant_context] = _gt


@pytest.mark.asyncio
async def test_dynamic_attribute_creation_and_product_persistence(db_session):
    """
    Test creating a new dynamic attribute definition (Fabric Type),
    persisting a product with custom attributes, and reading it back.
    """
    comp, br = await _make_tenant(db_session, "t1")
    manager = await _make_user(db_session, "mgr", comp.id, br.id, role=UserRole.SYSADMIN)
    headers = _bearer(manager, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Create Attribute Definition
        attr_payload = {
            "name": "fabric_type",
            "label": "Fabric Type",
            "dataType": "text",
            "isVariantDimension": True,
            "isMandatory": False,
            "validValues": ["100% Cotton", "Silk Blend", "Linen", "Denim"],
            "isEnabled": True
        }
        res_attr = await ac.post("/api/v1/attributes/definitions", json=attr_payload, headers=headers)
        assert res_attr.status_code == 201
        attr_data = res_attr.json()
        assert attr_data["name"] == "fabric_type"
        assert attr_data["label"] == "Fabric Type"

        # 2. List Definitions to ensure it appears in dynamic catalogue
        res_list = await ac.get("/api/v1/attributes/definitions", headers=headers)
        assert res_list.status_code == 200
        defs = res_list.json()
        names = [d["name"] for d in defs]
        assert "fabric_type" in names

        # 3. Create Product with Dynamic Attributes
        product_payload = {
            "code": "SKU-FABRIC-001",
            "name": "Egyptian Cotton Shirt",
            "price": 1899.0,
            "stock": 50,
            "category": "Apparel",
            "barcode": "8901234567899",
            "brand": "SMRITI",
            "color": "White",
            "size": "L",
            "style_code": "FAB-01",
            "cost_price": 950.0,
            "mrp": 2499.0,
            "gst_percentage": 18.0,
            "hsn_code": "62052000",
            "attributes": {
                "fabric_type": "100% Cotton",
                "Fabric Type": "100% Cotton",
                "care_instructions": "Machine Wash Cold"
            }
        }
        res_prod = await ac.post("/api/v1/products/", json=product_payload, headers=headers)
        assert res_prod.status_code == 201
        prod_data = res_prod.json()
        assert prod_data["code"] == "SKU-FABRIC-001"
        assert prod_data["attributes"] is not None
        assert prod_data["attributes"]["fabric_type"] == "100% Cotton"
        assert prod_data["attributes"]["care_instructions"] == "Machine Wash Cold"

        # 4. Verify search / retrieve product preserves attributes
        res_search = await ac.get("/api/v1/products/search?q=Egyptian", headers=headers)
        assert res_search.status_code == 200
        items = res_search.json()
        assert len(items) >= 1
        found = next(p for p in items if p["code"] == "SKU-FABRIC-001")
        assert found["attributes"]["fabric_type"] == "100% Cotton"
