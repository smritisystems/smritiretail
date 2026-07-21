"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.2.0
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

from app.api.deps import get_db, get_current_user, TenantContext
from app.core.security import create_access_token, hash_password
from app.core.validation import (
    CasingRule,
    FieldValidationConfig,
    ConditionalRuleConfig,
    PlatformValidationEngine,
    ValidationMode,
    ValidationPolicy,
    get_validation_engine,
)
from app.main import app
from app.models.auth import User, UserRole
from app.models.master_lookup import MasterType, MasterValue
from app.models.tenant import Branch, Company
from app.schemas.inventory import ProductCreate
from app.services.inventory import InventoryService
from app.tests.conftest import clear_db
from sqlalchemy.future import select


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
async def test_pve_default_strict_validation_success(db_session):
    comp1, br1, user1 = await _setup_tenant_and_user(db_session, "pve1")
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

    engine = PlatformValidationEngine()
    engine.invalidate_policy_cache()

    input_data = {"color": "red", "category": "General"}
    res = await engine.validate_entity(db_session, "product", input_data, tenant_id=comp1.id)
    assert res.valid is True
    assert res.normalized_data["color"] == "Red"  # Title case canonical match


@pytest.mark.asyncio
async def test_pve_strict_validation_failure_raises_smriti_val_010(db_session):
    comp1, br1, user1 = await _setup_tenant_and_user(db_session, "pve2")
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

    engine = PlatformValidationEngine()
    engine.invalidate_policy_cache()

    input_data = {"color": "Rede", "category": "General"}
    with pytest.raises(HTTPException) as exc_info:
        await engine.validate_entity(db_session, "product", input_data, tenant_id=comp1.id)

    err = exc_info.value.detail
    assert err["reference_id"] == "SMRITI-VAL-010"
    assert err["policy_id"] == "product.color.strict"
    assert "Rede" in err["explanation"]


@pytest.mark.asyncio
async def test_pve_warning_mode_allows_unrecognized_value(db_session):
    comp1, br1, user1 = await _setup_tenant_and_user(db_session, "pve3")
    mtype = await _seed_master_type(db_session, "product_color", "Product Color")

    engine = PlatformValidationEngine()
    engine.invalidate_policy_cache()

    # Custom policy setting color mode to WARNING
    custom_policy = ValidationPolicy(
        entity_type="product",
        tenant_id=comp1.id,
        fields={
            "color": FieldValidationConfig(
                mandatory=False,
                mode=ValidationMode.WARNING,
                master_type="product_color",
                casing=CasingRule.TITLE
            )
        }
    )
    engine.cache.set(f"product:{comp1.id}", custom_policy)

    input_data = {"color": "dusty rose metallic"}
    res = await engine.validate_entity(db_session, "product", input_data, tenant_id=comp1.id)
    assert res.valid is True
    assert res.normalized_data["color"] == "Dusty Rose Metallic"
    assert len(res.warnings) == 1
    assert res.warnings[0]["field"] == "color"


@pytest.mark.asyncio
async def test_pve_auto_create_mode_authorized(db_session):
    comp1, br1, user1 = await _setup_tenant_and_user(db_session, "pve4")
    mtype = await _seed_master_type(db_session, "product_color", "Product Color")

    engine = PlatformValidationEngine()
    engine.invalidate_policy_cache()

    custom_policy = ValidationPolicy(
        entity_type="product",
        tenant_id=comp1.id,
        fields={
            "color": FieldValidationConfig(
                mandatory=False,
                mode=ValidationMode.AUTO_CREATE,
                master_type="product_color",
                casing=CasingRule.TITLE,
                auto_create_allowed_roles=["MANAGER", "SYSADMIN"]
            )
        }
    )
    engine.cache.set(f"product:{comp1.id}", custom_policy)

    input_data = {"color": "dusty rose"}
    res = await engine.validate_entity(
        db_session, "product", input_data, tenant_id=comp1.id, user_role="MANAGER"
    )
    assert res.valid is True
    assert res.normalized_data["color"] == "Dusty Rose"
    assert len(res.auto_created_values) == 1
    assert res.auto_created_values[0]["created_value"] == "Dusty Rose"

    # Verify value was persisted to tenant master values in DB
    q = select(MasterValue).where(
        MasterValue.master_type_id == mtype.id,
        MasterValue.name == "Dusty Rose",
        MasterValue.tenant_id == comp1.id
    )
    db_res = await db_session.execute(q)
    new_mv = db_res.scalar_one_or_none()
    assert new_mv is not None
    assert new_mv.is_system is False


@pytest.mark.asyncio
async def test_pve_conditional_rule_priority_resolution(db_session):
    comp1, br1, user1 = await _setup_tenant_and_user(db_session, "pve5")

    engine = PlatformValidationEngine()
    engine.invalidate_policy_cache()

    custom_policy = ValidationPolicy(
        entity_type="product",
        tenant_id=comp1.id,
        fields={
            "color": FieldValidationConfig(mandatory=False, mode=ValidationMode.STRICT, master_type="product_color"),
            "size": FieldValidationConfig(mandatory=False, mode=ValidationMode.STRICT, master_type="product_size"),
            "stock": FieldValidationConfig(mandatory=False, mode=ValidationMode.NONE)
        },
        conditional_rules=[
            # Low Priority rule (100): Footwear requires size and color
            ConditionalRuleConfig(
                id="rule_low",
                priority=100,
                when={"category": "Footwear"},
                require=["size", "color"]
            ),
            # High Priority rule (200): Service item disables stock and overrides color to NONE
            ConditionalRuleConfig(
                id="rule_high",
                priority=200,
                when={"item_type": "Service"},
                disable=["stock"],
                set_mode={"color": ValidationMode.NONE}
            )
        ]
    )
    engine.cache.set(f"product:{comp1.id}", custom_policy)

    input_data = {
        "category": "Footwear",
        "item_type": "Service",
        "color": "custom purple metallic",
        "size": "9",
        "stock": 100
    }

    res = await engine.validate_entity(db_session, "product", input_data, tenant_id=comp1.id)
    assert res.valid is True
    assert res.normalized_data["stock"] is None  # Disabled by high priority rule
    assert res.normalized_data["color"] == "Custom Purple Metallic"  # NONE mode override by high priority rule
    assert "rule_high (priority=200)" in res.applied_rules


@pytest.mark.asyncio
async def test_validation_policy_api_endpoints(db_session):
    comp1, br1, user1 = await _setup_tenant_and_user(db_session, "api_pve")
    headers = _bearer(user1)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. GET policy
        res_get = await ac.get("/api/v1/validation-policies/product", headers=headers)
        assert res_get.status_code == 200
        policy_data = res_get.json()
        assert policy_data["entity_type"] == "product"
        assert "color" in policy_data["fields"]

        # 2. PUT policy
        policy_data["fields"]["color"]["mode"] = "WARNING"
        res_put = await ac.put("/api/v1/validation-policies/product", json=policy_data, headers=headers)
        assert res_put.status_code == 200
        assert res_put.json()["fields"]["color"]["mode"] == "WARNING"

        # 3. POST reset
        res_reset = await ac.post("/api/v1/validation-policies/product/reset", headers=headers)
        assert res_reset.status_code == 200
        assert res_reset.json()["fields"]["color"]["mode"] == "STRICT"


@pytest.mark.asyncio
async def test_pve_batch_validation(db_session):
    comp1, br1, user1 = await _setup_tenant_and_user(db_session, "batch_pve")
    mtype = await _seed_master_type(db_session, "product_color", "Product Color")
    c1 = MasterValue(id=uuid.uuid4(), master_type_id=mtype.id, code="NAVY", name="Navy Blue", is_system=True, active=True)
    stype = await _seed_master_type(db_session, "product_size", "Product Size")
    s1 = MasterValue(id=uuid.uuid4(), master_type_id=stype.id, code="SZ_L", name="L", is_system=True, active=True)
    s2 = MasterValue(id=uuid.uuid4(), master_type_id=stype.id, code="SZ_M", name="M", is_system=True, active=True)
    ctype = await _seed_master_type(db_session, "product_category", "Product Category")
    cat1 = MasterValue(id=uuid.uuid4(), master_type_id=ctype.id, code="APP", name="Apparel", is_system=True, active=True)
    db_session.add_all([c1, s1, s2, cat1])
    await db_session.commit()

    engine = PlatformValidationEngine()
    engine.invalidate_policy_cache()

    items = [
        {"color": "navy blue", "size": "l", "category": "apparel"},
        {"color": "navy blue", "size": "m", "category": "apparel"}
    ]
    results = await engine.validate_batch(db_session, "product", items, tenant_id=comp1.id)
    assert len(results) == 2
    assert results[0].valid is True
    assert results[0].normalized_data["color"] == "Navy Blue"
    assert results[0].normalized_data["size"] == "L"
    assert results[0].normalized_data["category"] == "Apparel"
    assert results[1].valid is True
    assert results[1].normalized_data["color"] == "Navy Blue"
    assert results[1].normalized_data["size"] == "M"
    assert results[1].normalized_data["category"] == "Apparel"
