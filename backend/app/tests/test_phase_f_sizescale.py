"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.6.0
Created      : 2026-08-08
Classification: Internal Architecture Standard — Phase F SizeScale Verification
"""

import pytest
from decimal import Decimal
from uuid import uuid4
from fastapi import HTTPException
from sqlalchemy.future import select

from app.models.inventory import Product
from app.models.size_master import SizeScale, SizeValue, SizeConversion
from app.schemas.size_master import SizeScaleCreate, SizeValueCreate, SizeConversionCreate
from app.schemas.inventory import ProductCreate
from app.services.size_master import SizeMasterService
from app.services.inventory import InventoryService
from app.services.identity_service import ProductIdentityService
from app.models.tenant import Company, Branch
from app.api.deps import TenantContext
from app.core.validation import get_validation_engine


async def _make_tenant_ctx(db_session, company_code: str = "COMP_F") -> TenantContext:
    uid = uuid4().hex[:6]
    comp = Company(id=f"c_{company_code}_{uid}", name=f"Company {company_code} {uid}", is_active=True)
    br = Branch(id=f"b_{company_code}_{uid}", company_id=comp.id, name=f"Branch {company_code} {uid}", code=f"BR-{company_code}-{uid}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()
    return TenantContext(
        company_id=comp.id,
        branch_id=br.id,
        tenant_id=f"t_{company_code}_{uid}"
    )


@pytest.mark.asyncio
async def test_sizescale_aggregate_creation(db_session):
    """Verify SizeScale + SizeValue + SizeConversion aggregate creation."""
    tenant_ctx = await _make_tenant_ctx(db_session, "S1")
    service = SizeMasterService(db_session, tenant_ctx)

    scale_in = SizeScaleCreate(
        name="India Footwear Standard",
        code=f"SCALE-IND-{uuid4().hex[:6]}",
        base_region_id="UK",
        size_values=[
            SizeValueCreate(
                display_size="7",
                sort_order=1,
                conversions=[
                    SizeConversionCreate(region_code="US", converted_size_label="8"),
                    SizeConversionCreate(region_code="EU", converted_size_label="41"),
                ]
            ),
            SizeValueCreate(
                display_size="8",
                sort_order=2,
                conversions=[
                    SizeConversionCreate(region_code="US", converted_size_label="9"),
                    SizeConversionCreate(region_code="EU", converted_size_label="42"),
                ]
            ),
        ]
    )

    created_scale = await service.create_size_scale(scale_in)
    assert created_scale.id is not None
    assert created_scale.name == "India Footwear Standard"
    assert len(created_scale.size_values) == 2

    # Verify conversions
    sv7 = [sv for sv in created_scale.size_values if sv.display_size == "7"][0]
    assert len(sv7.conversions) == 2
    convs = {c.region_code: c.converted_size_label for c in sv7.conversions}
    assert convs["US"] == "8"
    assert convs["EU"] == "41"


@pytest.mark.asyncio
async def test_pve_valid_and_invalid_size_scale_validation(db_session):
    """Verify PVE size validation for valid and invalid size combinations."""
    tenant_ctx = await _make_tenant_ctx(db_session, "PVE_F")
    service = SizeMasterService(db_session, tenant_ctx)

    scale_in = SizeScaleCreate(
        name="Denim Jeans Scale",
        code=f"SCALE-JEANS-{uuid4().hex[:6]}",
        base_region_id="IN",
        size_values=[
            SizeValueCreate(display_size="30", sort_order=1),
            SizeValueCreate(display_size="32", sort_order=2),
            SizeValueCreate(display_size="34", sort_order=3),
        ]
    )
    scale = await service.create_size_scale(scale_in)

    pve = get_validation_engine()

    # 1. Valid size under scale -> PASS
    valid_payload = {
        "code": f"JEAN-32-{uuid4().hex[:4]}",
        "name": "Men Slim Denim",
        "category": "Apparel",
        "barcode": f"BC-J32-{uuid4().hex[:4]}",
        "price": 1999.00,
        "size": "32",
        "size_scale_id": scale.id
    }
    val_res = await pve.validate_entity(db_session, "product", valid_payload, tenant_id=tenant_ctx.company_id)
    assert val_res.valid is True
    assert val_res.normalized_data["size"] == "32"
    assert val_res.normalized_data["size_scale_id"] == scale.id

    # 2. Invalid size under scale -> HTTP 422 with SMRITI-VAL-SIZE-001
    invalid_payload = {
        "code": f"JEAN-99-{uuid4().hex[:4]}",
        "name": "Men Slim Denim Invalid",
        "category": "Apparel",
        "barcode": f"BC-J99-{uuid4().hex[:4]}",
        "price": 1999.00,
        "size": "99",  # Invalid size for this scale
        "size_scale_id": scale.id
    }
    with pytest.raises(HTTPException) as exc_info:
        await pve.validate_entity(db_session, "product", invalid_payload, tenant_id=tenant_ctx.company_id)
    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["reference_id"] == "SMRITI-VAL-SIZE-001"

    # 3. Invalid size_scale_id -> HTTP 422
    invalid_scale_payload = {
        "code": f"JEAN-INV-{uuid4().hex[:4]}",
        "name": "Men Slim Denim Bad Scale",
        "category": "Apparel",
        "barcode": f"BC-JINV-{uuid4().hex[:4]}",
        "price": 1999.00,
        "size": "32",
        "size_scale_id": "sc-nonexistent-scale-id"
    }
    with pytest.raises(HTTPException) as exc_info2:
        await pve.validate_entity(db_session, "product", invalid_scale_payload, tenant_id=tenant_ctx.company_id)
    assert exc_info2.value.status_code == 422
    assert exc_info2.value.detail["reference_id"] == "SMRITI-VAL-SIZE-001"


@pytest.mark.asyncio
async def test_null_size_scale_id_remains_valid(db_session):
    """Verify products created without size_scale_id (NULL) pass validation normally."""
    tenant_ctx = await _make_tenant_ctx(db_session, "NULL_SCALE")
    pve = get_validation_engine()

    payload = {
        "code": f"SHIRT-FREE-{uuid4().hex[:4]}",
        "name": "Free Size Casual Shirt",
        "category": "Apparel",
        "barcode": f"BC-FREE-{uuid4().hex[:4]}",
        "price": 999.00,
        "size": "XL",
        "size_scale_id": None
    }
    val_res = await pve.validate_entity(db_session, "product", payload, tenant_id=tenant_ctx.company_id)
    assert val_res.valid is True
    assert val_res.normalized_data["size_scale_id"] is None


@pytest.mark.asyncio
async def test_multi_region_size_conversion_resolver(db_session):
    """Verify resolve_conversions retrieves correct regional mappings without fabricating missing regions."""
    tenant_ctx = await _make_tenant_ctx(db_session, "RESOLV")
    service = SizeMasterService(db_session, tenant_ctx)

    scale = await service.create_size_scale(
        SizeScaleCreate(
            name="Sneakers Scale",
            code=f"SCALE-SNK-{uuid4().hex[:6]}",
            base_region_id="UK",
            size_values=[
                SizeValueCreate(
                    display_size="9",
                    conversions=[
                        SizeConversionCreate(region_code="US", converted_size_label="10"),
                        SizeConversionCreate(region_code="EU", converted_size_label="43"),
                        SizeConversionCreate(region_code="JP", converted_size_label="27.5"),
                    ]
                )
            ]
        )
    )

    # Resolve conversions for UK 9
    conv_map = await service.resolve_conversions(scale.id, "9")
    assert conv_map["UK"] == "9"
    assert conv_map["US"] == "10"
    assert conv_map["EU"] == "43"
    assert conv_map["JP"] == "27.5"
    assert "CM" not in conv_map  # Missing region is NOT fabricated

    # Resolve non-existent display_size -> returns base region or empty
    empty_map = await service.resolve_conversions(scale.id, "999")
    assert empty_map.get("US") is None


@pytest.mark.asyncio
async def test_tenant_isolation_guard_on_size_scale(db_session):
    """Verify Company A cannot reference a SizeScale belonging to Company B."""
    tenant_ctx_a = await _make_tenant_ctx(db_session, "COMP_TENANT_A")
    tenant_ctx_b = await _make_tenant_ctx(db_session, "COMP_TENANT_B")

    service_a = SizeMasterService(db_session, tenant_ctx_a)
    scale_a = await service_a.create_size_scale(
        SizeScaleCreate(
            name="Scale Company A Only",
            code=f"SCALE-A-{uuid4().hex[:6]}",
            size_values=[SizeValueCreate(display_size="M")]
        )
    )

    pve = get_validation_engine()
    payload_b = {
        "code": f"PROD-B-{uuid4().hex[:4]}",
        "name": "Product Company B Attempting Scale A",
        "category": "Apparel",
        "barcode": f"BC-B-{uuid4().hex[:4]}",
        "price": 499.00,
        "size": "M",
        "size_scale_id": scale_a.id  # Belongs to Company A
    }

    # Validating for Company B tenant should reject scale_a.id
    with pytest.raises(HTTPException) as exc_info:
        await pve.validate_entity(db_session, "product", payload_b, tenant_id=tenant_ctx_b.company_id)
    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["reference_id"] == "SMRITI-VAL-SIZE-001"


@pytest.mark.asyncio
async def test_on_delete_set_null_foreign_key_behavior(db_session):
    """Verify deleting a SizeScale sets Product.size_scale_id = NULL without deleting the product."""
    tenant_ctx = await _make_tenant_ctx(db_session, "FK_DEL")
    size_service = SizeMasterService(db_session, tenant_ctx)
    inv_service = InventoryService(db_session, tenant_ctx)

    scale = await size_service.create_size_scale(
        SizeScaleCreate(
            name="Temporary Size Scale",
            code=f"SCALE-DEL-{uuid4().hex[:6]}",
            size_values=[SizeValueCreate(display_size="L")]
        )
    )

    prod = await inv_service.create_product(
        ProductCreate(
            id=f"prod-del-{uuid4().hex[:6]}",
            code=f"PROD-DEL-{uuid4().hex[:4]}",
            name="Product With Temp Scale",
            category="Apparel",
            barcode=f"BC-DEL-{uuid4().hex[:4]}",
            price=Decimal("1299.00"),
            size="L",
            size_scale_id=scale.id
        )
    )

    prod_id = prod.id
    scale_id = scale.id
    assert prod.size_scale_id == scale_id

    # Clear ORM session state so DB FK constraints execute cleanly
    db_session.expunge_all()

    # Delete SizeScale directly using raw SQL DELETE to trigger PostgreSQL ON DELETE SET NULL
    from sqlalchemy import text
    await db_session.execute(text("DELETE FROM size_values WHERE size_scale_id = :id"), {"id": scale_id})
    await db_session.execute(text("DELETE FROM size_scales WHERE id = :id"), {"id": scale_id})
    await db_session.flush()

    # Query raw database size_scale_id value
    res = await db_session.execute(text("SELECT size_scale_id, size FROM products WHERE id = :id"), {"id": prod_id})
    row = res.mappings().one_or_none()
    assert row is not None
    assert row["size"] == "L"  # Product.size preserved!
    assert row["size_scale_id"] is None  # PostgreSQL ON DELETE SET NULL worked!


@pytest.mark.asyncio
async def test_identity_algorithms_remain_unmodified():
    """Verify SKU and fingerprint key generation remain 100% identical and unaffected by Phase F."""
    svc = ProductIdentityService()
    sku_key = await svc.generate_sku_business_key("Shirts", "Nike", 1)
    assert sku_key == "SKU-SHI-NIK-00001"

    fp_hash = ProductIdentityService.generate_fingerprint_hash("Cotton T-Shirt", "Shirts", "Nike")
    assert len(fp_hash) == 64  # SHA-256 hash string
