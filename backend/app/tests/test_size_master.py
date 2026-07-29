"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.5.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import pytest
import uuid
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.size_master import SizeScale
from app.services.size_master import SizeMasterService
from app.repositories.size_master import SizeMasterRepository
from app.api.deps import TenantContext
from app.db.session import active_tenant_ctx
from app.schemas.size_master import (
    SizeScaleCreate,
    SizeValueCreate,
    SizeConversionCreate,
)


async def _setup_size_tenant(db_session: AsyncSession) -> TenantContext:
    from app.models.tenant import Company, Branch
    company_id = f"cmp-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-{uuid.uuid4().hex[:8]}"

    comp = Company(id=company_id, uuid=str(uuid.uuid4()), name="Test Size Company", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="Main Branch", code=f"BR-{uuid.uuid4().hex[:4]}", is_active=True)
    db_session.add_all([comp, branch])
    await db_session.commit()

    ctx = TenantContext(tenant_id="test-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(ctx)
    return ctx


@pytest.mark.asyncio
async def test_create_size_scale_aggregate_root(db_session):
    tenant_ctx = await _setup_size_tenant(db_session)
    service = SizeMasterService(db_session, tenant_ctx)

    scale_in = SizeScaleCreate(
        name="UK/IN Men Footwear Standard",
        scale_type_id="Footwear",
        gender_id="Male",
        base_region_id="UK",
        size_values=[
            SizeValueCreate(
                display_size="7",
                sort_order=1,
                conversions=[
                    SizeConversionCreate(region_code="EU", converted_size_label="41"),
                    SizeConversionCreate(region_code="US", converted_size_label="8"),
                    SizeConversionCreate(region_code="CM", converted_size_label="26.0"),
                ]
            ),
            SizeValueCreate(
                display_size="8",
                sort_order=2,
                conversions=[
                    SizeConversionCreate(region_code="EU", converted_size_label="42"),
                    SizeConversionCreate(region_code="US", converted_size_label="9"),
                    SizeConversionCreate(region_code="CM", converted_size_label="27.0"),
                ]
            )
        ]
    )

    created = await service.create_size_scale(scale_in)

    assert created is not None
    assert created.code == "SCALE-100001"
    assert created.name == "UK/IN Men Footwear Standard"
    assert created.scale_type_id == "Footwear"
    assert created.gender_id == "Male"
    assert len(created.size_values) == 2
    assert created.size_values[0].display_size == "7"
    assert len(created.size_values[0].conversions) == 3
    assert created.size_values[1].display_size == "8"


@pytest.mark.asyncio
async def test_normalized_regional_size_conversion_resolver(db_session):
    tenant_ctx = await _setup_size_tenant(db_session)
    service = SizeMasterService(db_session, tenant_ctx)

    scale_in = SizeScaleCreate(
        name="Apparel General Sizes",
        scale_type_id="Apparel",
        gender_id="Unisex",
        size_values=[
            SizeValueCreate(
                display_size="M",
                sort_order=1,
                conversions=[
                    SizeConversionCreate(region_code="EU", converted_size_label="38-40"),
                    SizeConversionCreate(region_code="US", converted_size_label="Medium"),
                    SizeConversionCreate(region_code="CHEST_INCHES", converted_size_label="38-40"),
                ]
            )
        ]
    )
    created = await service.create_size_scale(scale_in)

    # Resolve conversion for EU
    eu_res = await service.resolve_size_conversion(created.id, "M", "EU")
    assert eu_res == "38-40"

    # Resolve conversion for CHEST_INCHES
    chest_res = await service.resolve_size_conversion(created.id, "M", "CHEST_INCHES")
    assert chest_res == "38-40"


@pytest.mark.asyncio
async def test_lookup_size_scales_by_category_and_gender(db_session):
    tenant_ctx = await _setup_size_tenant(db_session)
    service = SizeMasterService(db_session, tenant_ctx)
    repo = SizeMasterRepository(db_session, tenant_ctx)

    s1 = SizeScaleCreate(name="Men Denim Scale", scale_type_id="Jeans", gender_id="Male")
    await service.create_size_scale(s1)

    s2 = SizeScaleCreate(name="Women Footwear Scale", scale_type_id="Footwear", gender_id="Female")
    await service.create_size_scale(s2)

    # Search by Jeans scale_type_id
    jeans_res = await repo.search(q="Denim", scale_type_id="Jeans")
    assert len(jeans_res) == 1
    assert jeans_res[0].name == "Men Denim Scale"

    # Search by Female gender_id
    female_res = await repo.search(q="Footwear", gender_id="Female")
    assert len(female_res) == 1
    assert female_res[0].name == "Women Footwear Scale"


@pytest.mark.asyncio
async def test_duplicate_scale_code_raises_http_400(db_session):
    tenant_ctx = await _setup_size_tenant(db_session)
    service = SizeMasterService(db_session, tenant_ctx)

    s1 = SizeScaleCreate(code="SCALE-FIXED", name="Fixed Scale 1")
    await service.create_size_scale(s1)

    s2 = SizeScaleCreate(code="SCALE-FIXED", name="Fixed Scale 2")
    with pytest.raises(HTTPException) as excinfo:
        await service.create_size_scale(s2)
    assert excinfo.value.status_code == 400
    assert "already exists" in str(excinfo.value.detail)


@pytest.mark.asyncio
async def test_duplicate_size_value_within_scale_raises_http_400(db_session):
    tenant_ctx = await _setup_size_tenant(db_session)
    service = SupplierService = SizeMasterService(db_session, tenant_ctx)

    s_dup = SizeScaleCreate(
        name="Duplicate Size Scale",
        size_values=[
            SizeValueCreate(display_size="XL", sort_order=1),
            SizeValueCreate(display_size="XL", sort_order=2),  # Duplicate size label
        ]
    )
    with pytest.raises(HTTPException) as excinfo:
        await service.create_size_scale(s_dup)
    assert excinfo.value.status_code == 400
    assert "Duplicate size value" in str(excinfo.value.detail)


@pytest.mark.asyncio
async def test_multi_tenant_isolation_prevents_cross_company_access(db_session):
    tenant_a = await _setup_size_tenant(db_session)
    service_a = SizeMasterService(db_session, tenant_a)

    tenant_b = await _setup_size_tenant(db_session)
    repo_b = SizeMasterRepository(db_session, tenant_b)

    # Create Scale under Tenant A
    s_a = SizeScaleCreate(name="Tenant A Scale", code="SCALE-TENANT-A")
    await service_a.create_size_scale(s_a)

    # Tenant B search -> Must return empty list
    res_b = await repo_b.search(q="SCALE-TENANT-A")
    assert len(res_b) == 0


@pytest.mark.asyncio
async def test_soft_delete_size_scale_hides_from_queries_and_preserves_audit(db_session):
    tenant_ctx = await _setup_size_tenant(db_session)
    service = SizeMasterService(db_session, tenant_ctx)
    repo = SizeMasterRepository(db_session, tenant_ctx)

    s_in = SizeScaleCreate(name="Soft Delete Scale")
    created = await service.create_size_scale(s_in)

    # Soft delete scale
    deleted = await service.delete_size_scale(created.id)
    assert deleted is True

    # Active search must not return soft-deleted scale
    search_res = await repo.search(q="Soft Delete Scale")
    assert len(search_res) == 0

    # Direct database query confirms record exists with is_deleted=True for audit trail
    stmt = select(SizeScale).filter(SizeScale.id == created.id)
    raw_res = await db_session.execute(stmt)
    raw_scale = raw_res.scalars().first()
    assert raw_scale is not None
    assert raw_scale.is_deleted is True


@pytest.mark.asyncio
async def test_atomic_rollback_on_invalid_payload(db_session):
    tenant_ctx = await _setup_size_tenant(db_session)
    service = SizeMasterService(db_session, tenant_ctx)

    # Attempt to create duplicate size value to force rollback
    s_in = SizeScaleCreate(
        code="SCALE-ROLLBACK",
        name="Rollback Scale",
        size_values=[
            SizeValueCreate(display_size="L"),
            SizeValueCreate(display_size="L")
        ]
    )
    with pytest.raises(HTTPException) as excinfo:
        await service.create_size_scale(s_in)
    assert excinfo.value.status_code == 400

    # Direct database query confirms scale was NOT persisted
    stmt = select(SizeScale).filter(SizeScale.code == "SCALE-ROLLBACK")
    raw_res = await db_session.execute(stmt)
    assert raw_res.scalars().first() is None
