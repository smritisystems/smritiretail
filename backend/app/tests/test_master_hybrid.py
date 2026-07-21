"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.1.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from fastapi import HTTPException

from app.api.deps import get_db, get_tenant_context, get_current_user, TenantContext
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.master_lookup import MasterType, MasterValue
from app.models.tenant import Branch, Company
from app.services.inventory import InventoryService
from app.schemas.inventory import ProductCreate
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db(db_session):
    await clear_db(db_session)

    async def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    try:
        yield
    finally:
        try:
            await clear_db(db_session)
        except Exception:
            pass
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


async def _setup_tenant_and_user(db_session, suffix: str, company_id: str = None):
    comp_id = company_id or f"comp-{suffix}"
    comp = Company(id=comp_id, name=f"Company {suffix}", gst_number="27ABCDE1234F1Z5", is_active=True)
    br = Branch(id=f"br-{suffix}", company_id=comp.id, name=f"Branch {suffix}", code=f"BR-{suffix}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()

    user = User(
        id=f"usr-{suffix}",
        username=f"user_{suffix}",
        hashed_password=hash_password("Test@1234"),
        role=UserRole.MANAGER,
        is_active=True,
        is_deleted=False,
        is_platform_admin=True,
        company_id=comp.id,
        branch_id=br.id,
        tenant_id=comp.id
    )
    db_session.add(user)
    await db_session.commit()
    return comp, br, user


def _bearer(user: User) -> dict:
    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value if isinstance(user.role, UserRole) else str(user.role),
        "company_id": user.company_id,
        "branch_id": user.branch_id,
        "tenant_id": user.tenant_id,
        "jti": str(uuid.uuid4()),
        "type": "access",
    })
    return {"Authorization": f"Bearer {token}"}


async def _seed_master_type(db_session, code: str, label: str):
    mtype = MasterType(
        id=uuid.uuid4(),
        code=code,
        label=label,
        category_type="REFERENCE",
        is_system=True,
        field_schema={}
    )
    db_session.add(mtype)
    await db_session.commit()
    return mtype


@pytest.mark.asyncio
async def test_1_list_colors_returns_system_and_tenant_values(db_session):
    comp1, br1, user1 = await _setup_tenant_and_user(db_session, "t1")
    mtype = await _seed_master_type(db_session, "product_color", "Product Color")

    sys_color = MasterValue(
        id=uuid.uuid4(),
        master_type_id=mtype.id,
        code="CLR-RED",
        name="Red",
        is_system=True,
        tenant_id=None,
        active=True
    )
    tenant_color = MasterValue(
        id=uuid.uuid4(),
        master_type_id=mtype.id,
        code="DUSTY_ROSE",
        name="Dusty Rose",
        is_system=False,
        tenant_id=user1.tenant_id,
        active=True
    )
    db_session.add_all([sys_color, tenant_color])
    await db_session.commit()

    headers = _bearer(user1)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/masters/master-lookups/values/product_color", headers=headers)
        assert res.status_code == 200
        data = res.json()
        names = [item["name"] for item in data]
        assert "Red" in names
        assert "Dusty Rose" in names


@pytest.mark.asyncio
async def test_2_create_custom_color_dusty_rose(db_session):
    comp1, br1, user1 = await _setup_tenant_and_user(db_session, "t2")
    mtype = await _seed_master_type(db_session, "product_color", "Product Color")

    headers = _bearer(user1)
    payload = {
        "code": "DUSTY_ROSE",
        "name": "Dusty Rose",
        "active": True
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v1/masters/master-lookups/values/product_color", json=payload, headers=headers)
        assert res.status_code == 201
        data = res.json()
        assert data["code"] == "DUSTY_ROSE"
        assert data["name"] == "Dusty Rose"
        assert data["is_system"] is False
        assert data["tenant_id"] == user1.tenant_id


@pytest.mark.asyncio
async def test_3_delete_system_value_returns_403_smriti_val_020(db_session):
    comp1, br1, user1 = await _setup_tenant_and_user(db_session, "t3")
    mtype = await _seed_master_type(db_session, "product_color", "Product Color")

    red = MasterValue(
        id=uuid.uuid4(),
        master_type_id=mtype.id,
        code="CLR-RED",
        name="Red",
        is_system=True,
        tenant_id=None,
        active=True
    )
    db_session.add(red)
    await db_session.commit()

    headers = _bearer(user1)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.delete(f"/api/v1/masters/master-lookups/values/{red.id}", headers=headers)
        assert res.status_code == 403
        data = res.json()
        assert data["reference_id"] == "SMRITI-VAL-020"
        assert "Red" in data["message"]


@pytest.mark.asyncio
async def test_4_update_system_value_name_returns_403_smriti_val_021(db_session):
    comp1, br1, user1 = await _setup_tenant_and_user(db_session, "t4")
    mtype = await _seed_master_type(db_session, "product_color", "Product Color")

    red = MasterValue(
        id=uuid.uuid4(),
        master_type_id=mtype.id,
        code="CLR-RED",
        name="Red",
        is_system=True,
        tenant_id=None,
        active=True
    )
    db_session.add(red)
    await db_session.commit()

    headers = _bearer(user1)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.patch(f"/api/v1/masters/master-lookups/values/{red.id}", json={"name": "Crimson"}, headers=headers)
        assert res.status_code == 403
        data = res.json()
        assert data["reference_id"] == "SMRITI-VAL-021"
        assert "Red" in data["message"]


@pytest.mark.asyncio
async def test_5_toggle_active_on_beige_flips_active(db_session):
    comp1, br1, user1 = await _setup_tenant_and_user(db_session, "t5")
    mtype = await _seed_master_type(db_session, "product_color", "Product Color")

    beige = MasterValue(
        id=uuid.uuid4(),
        master_type_id=mtype.id,
        code="CLR-BEIGE",
        name="Beige",
        is_system=True,
        tenant_id=None,
        active=True
    )
    db_session.add(beige)
    await db_session.commit()

    headers = _bearer(user1)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.patch(f"/api/v1/masters/lookup/product_color/values/{beige.id}/toggle-active", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == str(beige.id)
        assert data["active"] is False

        # Toggle back to True
        res2 = await ac.patch(f"/api/v1/masters/lookup/product_color/values/{beige.id}/toggle-active", headers=headers)
        assert res2.status_code == 200
        assert res2.json()["active"] is True


@pytest.mark.asyncio
async def test_6_post_product_with_lowercase_color_normalized_to_title_case(db_session):
    comp1, br1, user1 = await _setup_tenant_and_user(db_session, "t6")
    mtype = await _seed_master_type(db_session, "product_color", "Product Color")

    red = MasterValue(
        id=uuid.uuid4(),
        master_type_id=mtype.id,
        code="CLR-RED",
        name="Red",
        is_system=True,
        tenant_id=None,
        active=True
    )
    db_session.add(red)
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=comp1.id, branch_id=br1.id)
    inv_svc = InventoryService(db_session, tenant_ctx)

    p_in = ProductCreate(
        id=f"prod-{uuid.uuid4()}",
        code="PROD-CLR-1",
        name="Test Red Shirt",
        price=500.0,
        stock=10,
        category="General",
        color="red",  # lowercase input
        barcode="890000000101"
    )
    product = await inv_svc.create_product(p_in)
    assert product.color == "Red"  # normalized to canonical Title Case


@pytest.mark.asyncio
async def test_7_post_product_with_invalid_color_returns_422_smriti_val_010(db_session):
    comp1, br1, user1 = await _setup_tenant_and_user(db_session, "t7")
    mtype = await _seed_master_type(db_session, "product_color", "Product Color")

    red = MasterValue(
        id=uuid.uuid4(),
        master_type_id=mtype.id,
        code="CLR-RED",
        name="Red",
        is_system=True,
        tenant_id=None,
        active=True
    )
    db_session.add(red)
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=comp1.id, branch_id=br1.id)
    inv_svc = InventoryService(db_session, tenant_ctx)

    p_in = ProductCreate(
        id=f"prod-{uuid.uuid4()}",
        code="PROD-CLR-ERR",
        name="Test Invalid Color Shirt",
        price=500.0,
        stock=10,
        category="General",
        color="Rede",  # invalid color
        barcode="890000000102"
    )
    with pytest.raises(HTTPException) as exc_info:
        await inv_svc.create_product(p_in)

    err = exc_info.value.detail
    assert err["reference_id"] == "SMRITI-VAL-010"
    assert "Rede" in err["explanation"]


@pytest.mark.asyncio
async def test_8_post_product_with_lowercase_size_normalized_to_upper_case(db_session):
    comp1, br1, user1 = await _setup_tenant_and_user(db_session, "t8")
    mtype = await _seed_master_type(db_session, "product_size", "Product Size")

    xxl = MasterValue(
        id=uuid.uuid4(),
        master_type_id=mtype.id,
        code="SZ-XXL",
        name="XXL",
        is_system=True,
        tenant_id=None,
        active=True
    )
    db_session.add(xxl)
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=comp1.id, branch_id=br1.id)
    inv_svc = InventoryService(db_session, tenant_ctx)

    p_in = ProductCreate(
        id=f"prod-{uuid.uuid4()}",
        code="PROD-SZ-1",
        name="Test XXL Shirt",
        price=600.0,
        stock=5,
        category="General",
        size="xxl",  # lowercase input
        barcode="890000000103"
    )
    product = await inv_svc.create_product(p_in)
    assert product.size == "XXL"  # normalized to canonical UPPER case


@pytest.mark.asyncio
async def test_9_post_product_with_invalid_category_returns_422_smriti_val_010(db_session):
    comp1, br1, user1 = await _setup_tenant_and_user(db_session, "t9")
    mtype = await _seed_master_type(db_session, "product_category", "Product Category")

    shirts = MasterValue(
        id=uuid.uuid4(),
        master_type_id=mtype.id,
        code="CAT-SHIRTS",
        name="Shirts",
        is_system=True,
        tenant_id=None,
        active=True
    )
    db_session.add(shirts)
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=comp1.id, branch_id=br1.id)
    inv_svc = InventoryService(db_session, tenant_ctx)

    p_in = ProductCreate(
        id=f"prod-{uuid.uuid4()}",
        code="PROD-CAT-ERR",
        name="Test Typo Category Shirt",
        price=700.0,
        stock=8,
        category="Shrit",  # typo input
        barcode="890000000104"
    )
    with pytest.raises(HTTPException) as exc_info:
        await inv_svc.create_product(p_in)

    err = exc_info.value.detail
    assert err["reference_id"] == "SMRITI-VAL-010"
    assert "Shrit" in err["explanation"]


@pytest.mark.asyncio
async def test_10_tenant_a_cannot_see_tenant_b_custom_colors(db_session):
    compA, brA, userA = await _setup_tenant_and_user(db_session, "tenantA")
    compB, brB, userB = await _setup_tenant_and_user(db_session, "tenantB")
    mtype = await _seed_master_type(db_session, "product_color", "Product Color")

    color_b = MasterValue(
        id=uuid.uuid4(),
        master_type_id=mtype.id,
        code="TEAL_B",
        name="Teal Tenant B Special",
        is_system=False,
        tenant_id=userB.tenant_id,
        active=True
    )
    db_session.add(color_b)
    await db_session.commit()

    headersA = _bearer(userA)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resA = await ac.get("/api/v1/masters/master-lookups/values/product_color", headers=headersA)
        assert resA.status_code == 200
        namesA = [item["name"] for item in resA.json()]
        assert "Teal Tenant B Special" not in namesA

    headersB = _bearer(userB)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resB = await ac.get("/api/v1/masters/master-lookups/values/product_color", headers=headersB)
        assert resB.status_code == 200
        namesB = [item["name"] for item in resB.json()]
        assert "Teal Tenant B Special" in namesB
