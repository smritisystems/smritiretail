"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.38.0
Created      : 2026-10-03
Modified     : 2026-10-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Automated Test Suite — SMRITI Global Product Resolution & Validation Standard
"""

import pytest
import uuid
from decimal import Decimal
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from fastapi import HTTPException

from app.main import app
from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.models.inventory import Product
from app.services.product_resolution_service import ProductResolutionService
from app.schemas.product_resolution import (
    TransactionLineItemInput,
    TransactionValidationResult,
    ProductResolutionResult,
)


TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:2781/smriti001"


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_01_resolve_valid_canonical_hierarchy(db_session: AsyncSession):
    """
    Test 1: Verify valid canonical resolution by Product ID, SKU, and Barcode.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_{suffix}"

    # 1. Create parent Item
    item = Item(
        id=f"itm_{suffix}",
        company_id=comp_id,
        item_code=f"STYLE-{suffix}",
        item_name=f"Premium Linen Shirt {suffix}",
        item_type="FINISHED_GOOD",
        category="Apparel",
        brand="SmritiHeritage",
        tax_rate=Decimal("12.00"),
        mrp=Decimal("1999.00"),
        selling_price=Decimal("1499.00"),
        hsn_code="620520",
        primary_uom="PCS",
    )
    db_session.add(item)
    await db_session.flush()

    # 2. Create ItemVariant
    sku_val = f"SKU-{suffix}-42"
    variant = ItemVariant(
        id=f"var_{suffix}",
        company_id=comp_id,
        item_id=item.id,
        variant_sku=sku_val,
        variant_name=f"Premium Linen Shirt {suffix} (Size 42)",
        attributes_json={"size": "42"},
        tax_rate=Decimal("12.00"),
        mrp=Decimal("1999.00"),
        selling_price=Decimal("1499.00"),
        is_active=True,
    )
    db_session.add(variant)
    await db_session.flush()

    # 3. Create Barcode
    bc_val = f"8909{suffix}1"
    barcode = ItemBarcode(
        id=f"bc_{suffix}",
        company_id=comp_id,
        item_id=item.id,
        variant_id=variant.id,
        barcode=bc_val,
        barcode_normalized=bc_val,
        barcode_type="EAN13",
        is_primary=True,
    )
    db_session.add(barcode)
    await db_session.commit()

    # Verify resolution by Barcode
    res_bc = await ProductResolutionService.resolve(
        session=db_session,
        company_id=comp_id,
        identifier=bc_val,
    )
    assert res_bc.success is True
    assert res_bc.variant_id == variant.id
    assert res_bc.sku == sku_val
    assert res_bc.barcode == bc_val
    assert res_bc.mrp == Decimal("1999.00")
    assert res_bc.selling_price == Decimal("1499.00")

    # Verify resolution by SKU
    res_sku = await ProductResolutionService.resolve(
        session=db_session,
        company_id=comp_id,
        identifier=sku_val,
    )
    assert res_sku.success is True
    assert res_sku.sku == sku_val

    # Verify resolution by Product ID (canonical item_id)
    res_id = await ProductResolutionService.resolve(
        session=db_session,
        company_id=comp_id,
        identifier=item.id,
    )
    assert res_id.success is True
    assert res_id.item_id == item.id


@pytest.mark.asyncio
async def test_02_resolve_legacy_fallback(db_session: AsyncSession):
    """
    Test 2: Verify fallback to legacy `products` table when not present in canonical tables.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"
    prod_id = f"LEG_PROD_{suffix}"
    sku_val = f"LEG_SKU_{suffix}"
    bc_val = f"LEG_BC_{suffix}"

    legacy_p = Product(
        id=prod_id,
        company_id=comp_id,
        code=sku_val,
        barcode=bc_val,
        name=f"Legacy Product {suffix}",
        category="General",
        price=Decimal("450.00"),
        mrp=Decimal("500.00"),
        gst_percentage=Decimal("18.00"),
        is_active=True,
    )
    db_session.add(legacy_p)
    await db_session.commit()

    res = await ProductResolutionService.resolve(
        session=db_session,
        company_id=comp_id,
        identifier=bc_val,
    )
    assert res.success is True
    assert res.product_id == prod_id
    assert res.sku == sku_val
    assert res.barcode == bc_val
    assert res.mrp == Decimal("500.00")
    assert res.selling_price == Decimal("450.00")


@pytest.mark.asyncio
async def test_03_unknown_product_rejection(db_session: AsyncSession):
    """
    Test 3: Verify unknown Barcode, unknown SKU, and unknown Product ID return PRODUCT_NOT_FOUND.
    """
    bogus = f"BOGUS_UNKNOWN_{uuid.uuid4().hex}"
    res = await ProductResolutionService.resolve(
        session=db_session,
        company_id="TEST_COMP",
        identifier=bogus,
    )
    assert res.success is False
    assert res.code == "PRODUCT_NOT_FOUND"
    assert "not registered" in res.message


@pytest.mark.asyncio
async def test_04_inactive_product_rejection(db_session: AsyncSession):
    """
    Test 4: Verify inactive product returns PRODUCT_INACTIVE and cannot be added.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_INACT_{suffix}"
    sku_val = f"INACT_SKU_{suffix}"

    item = Item(
        id=f"itm_inact_{suffix}",
        company_id=comp_id,
        item_code=f"INACT-{suffix}",
        item_name=f"Decommissioned Item {suffix}",
        is_active=False,
    )
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_inact_{suffix}",
        company_id=comp_id,
        item_id=item.id,
        variant_sku=sku_val,
        variant_name=f"Decommissioned Variant {suffix}",
        is_active=False,
    )
    db_session.add(variant)
    await db_session.commit()

    res = await ProductResolutionService.resolve(
        session=db_session,
        company_id=comp_id,
        identifier=sku_val,
    )
    assert res.success is False
    assert res.code == "PRODUCT_INACTIVE"
    assert "inactive" in res.message.lower()


@pytest.mark.asyncio
async def test_05_quarantined_product_rejection(db_session: AsyncSession):
    """
    Test 5: Verify product with status='REQUIRES_REVIEW' returns PRODUCT_QUARANTINED.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_QUAR_{suffix}"
    sku_val = f"QUAR_SKU_{suffix}"

    item = Item(
        id=f"itm_quar_{suffix}",
        company_id=comp_id,
        item_code=f"QUAR-{suffix}",
        item_name=f"Quarantined Item {suffix}",
        status="REQUIRES_REVIEW",
        is_active=True,
    )
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_quar_{suffix}",
        company_id=comp_id,
        item_id=item.id,
        variant_sku=sku_val,
        variant_name=f"Quarantined Variant {suffix}",
        is_active=True,
    )
    db_session.add(variant)
    await db_session.commit()

    res = await ProductResolutionService.resolve(
        session=db_session,
        company_id=comp_id,
        identifier=sku_val,
    )
    assert res.success is False
    assert res.code == "PRODUCT_QUARANTINED"
    assert "review" in res.message.lower() or "quarantine" in res.message.lower()


@pytest.mark.asyncio
async def test_06_tenant_isolation(db_session: AsyncSession):
    """
    Test 6: Verify strict tenant boundary enforcement:
    Tenant B cannot resolve Tenant A's private product.
    Tenant A cannot resolve Tenant B's private product.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_a = f"TENANT_A_{suffix}"
    comp_b = f"TENANT_B_{suffix}"
    sku_a = f"SKU_A_{suffix}"
    sku_b = f"SKU_B_{suffix}"

    # 1. Tenant A private product
    item_a = Item(id=f"itm_a_{suffix}", company_id=comp_a, item_code=f"CODE_A_{suffix}", item_name="Private Item A", is_active=True)
    db_session.add(item_a)
    await db_session.flush()
    var_a = ItemVariant(id=f"var_a_{suffix}", company_id=comp_a, item_id=item_a.id, variant_sku=sku_a, variant_name="Private Var A", is_active=True)
    db_session.add(var_a)

    # 2. Tenant B private product
    item_b = Item(id=f"itm_b_{suffix}", company_id=comp_b, item_code=f"CODE_B_{suffix}", item_name="Private Item B", is_active=True)
    db_session.add(item_b)
    await db_session.flush()
    var_b = ItemVariant(id=f"var_b_{suffix}", company_id=comp_b, item_id=item_b.id, variant_sku=sku_b, variant_name="Private Var B", is_active=True)
    db_session.add(var_b)

    await db_session.commit()

    # Tenant A resolves sku_a -> SUCCESS
    res_a = await ProductResolutionService.resolve(
        session=db_session,
        company_id=comp_a,
        identifier=sku_a,
    )
    assert res_a.success is True

    # Tenant B attempts to resolve sku_a -> PRODUCT_NOT_FOUND (Isolation guarantee)
    res_b_a = await ProductResolutionService.resolve(
        session=db_session,
        company_id=comp_b,
        identifier=sku_a,
    )
    assert res_b_a.success is False
    assert res_b_a.code == "PRODUCT_NOT_FOUND"

    # Tenant A attempts to resolve sku_b -> PRODUCT_NOT_FOUND (Isolation guarantee)
    res_a_b = await ProductResolutionService.resolve(
        session=db_session,
        company_id=comp_a,
        identifier=sku_b,
    )
    assert res_a_b.success is False
    assert res_a_b.code == "PRODUCT_NOT_FOUND"

    # Tenant B resolves sku_b -> SUCCESS
    res_b = await ProductResolutionService.resolve(
        session=db_session,
        company_id=comp_b,
        identifier=sku_b,
    )
    assert res_b.success is True


@pytest.mark.asyncio
async def test_07_transaction_lines_atomicity(db_session: AsyncSession):
    """
    Test 7: Verify atomic line validation:
    - 4 valid lines pass.
    - 4 valid lines + 1 invalid line results in is_valid=False and 100% rejection.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_TX_{suffix}"

    # Create 4 valid variants
    skus = []
    for i in range(1, 5):
        sku = f"TX_SKU_{suffix}_{i}"
        skus.append(sku)
        item = Item(id=f"itm_tx_{suffix}_{i}", company_id=comp_id, item_code=f"CODE_TX_{i}", item_name=f"Tx Item {i}", is_active=True)
        db_session.add(item)
        await db_session.flush()
        var = ItemVariant(id=f"var_tx_{suffix}_{i}", company_id=comp_id, item_id=item.id, variant_sku=sku, variant_name=f"Tx Var {i}", is_active=True)
        db_session.add(var)
    await db_session.commit()

    # All 4 valid lines
    all_valid_lines = [
        TransactionLineItemInput(line_no=idx, sku=s, quantity=Decimal("2.0000"))
        for idx, s in enumerate(skus, start=1)
    ]
    res_ok = await ProductResolutionService.validate_transaction_lines(
        session=db_session,
        company_id=comp_id,
        lines=all_valid_lines,
    )
    assert res_ok.is_valid is True
    assert res_ok.total_lines == 4
    assert res_ok.valid_lines == 4
    assert len(res_ok.errors) == 0

    # Mixed: 4 valid + 1 invalid line
    mixed_lines = list(all_valid_lines)
    mixed_lines.append(
        TransactionLineItemInput(line_no=5, barcode="UNKNOWN_BOGUS_BARCODE", quantity=Decimal("1.0000"))
    )

    res_fail = await ProductResolutionService.validate_transaction_lines(
        session=db_session,
        company_id=comp_id,
        lines=mixed_lines,
    )
    assert res_fail.is_valid is False
    assert res_fail.total_lines == 5
    assert res_fail.valid_lines == 4
    assert res_fail.invalid_lines == 1
    assert len(res_fail.errors) == 1
    assert res_fail.errors[0].line_no == 5
    assert res_fail.errors[0].code == "PRODUCT_NOT_FOUND"

    # Verify enforce_transaction_lines raises HTTPException(400) on mixed lines
    with pytest.raises(HTTPException) as exc_info:
        await ProductResolutionService.enforce_transaction_lines(
            session=db_session,
            company_id=comp_id,
            lines=mixed_lines,
        )
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "PRODUCT_NOT_FOUND"


@pytest.mark.asyncio
async def test_08_api_product_resolution_endpoints(db_session: AsyncSession):
    """
    Test 8: Verify REST API endpoints:
    - POST /api/v1/products/resolve
    - GET /api/v1/products/resolve?identifier=...
    - POST /api/v1/products/validate-lines
    - GET /api/v1/billing/scan/{barcode}
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = "COMP-001"
    sku_val = f"API_SKU_{suffix}"
    bc_val = f"890API{suffix}"

    item = Item(
        id=f"itm_api_{suffix}",
        company_id=comp_id,
        item_code=f"STYLE_API_{suffix}",
        item_name=f"API Test Item {suffix}",
        tax_rate=Decimal("18.00"),
        mrp=Decimal("899.00"),
        selling_price=Decimal("699.00"),
        is_active=True,
    )
    db_session.add(item)
    await db_session.flush()

    var = ItemVariant(
        id=f"var_api_{suffix}",
        company_id=comp_id,
        item_id=item.id,
        variant_sku=sku_val,
        variant_name=f"API Variant {suffix}",
        tax_rate=Decimal("18.00"),
        mrp=Decimal("899.00"),
        selling_price=Decimal("699.00"),
        is_active=True,
    )
    db_session.add(var)
    await db_session.flush()

    barcode = ItemBarcode(
        id=f"bc_api_{suffix}",
        company_id=comp_id,
        item_id=item.id,
        variant_id=var.id,
        barcode=bc_val,
        barcode_normalized=bc_val,
        is_primary=True,
    )
    db_session.add(barcode)
    await db_session.commit()

    from app.api.deps import get_current_user, get_tenant_context, TenantContext, get_db, get_company_db
    from app.models.auth import User, UserRole

    mock_user = User(
        id=f"usr_api_{suffix}",
        username=f"admin_{suffix}",
        role=UserRole.SYSADMIN,
        company_id=comp_id,
        branch_id="MAIN",
        is_active=True,
        is_deleted=False,
    )
    engine = create_async_engine(TEST_DB_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async def _test_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_tenant_context] = lambda: TenantContext(company_id=comp_id, branch_id="MAIN")
    app.dependency_overrides[get_company_db] = _test_get_db
    app.dependency_overrides[get_db] = _test_get_db

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            headers = {"Authorization": "Bearer test-token"}

            # 1. POST /api/v1/products/resolve
            resp_post = await client.post(
                "/api/v1/products/resolve",
                json={"identifier": bc_val},
                headers=headers,
            )
            assert resp_post.status_code == 200
            body_post = resp_post.json()
            assert body_post["success"] is True
            assert body_post["sku"] == sku_val
            assert body_post["barcode"] == bc_val

            # 2. GET /api/v1/products/resolve?identifier=...
            resp_get = await client.get(
                f"/api/v1/products/resolve?identifier={sku_val}",
                headers=headers,
            )
            assert resp_get.status_code == 200
            body_get = resp_get.json()
            assert body_get["success"] is True
            assert body_get["variant_id"] == var.id

            # 3. POST /api/v1/products/validate-lines
            resp_val = await client.post(
                "/api/v1/products/validate-lines",
                json={
                    "lines": [
                        {"line_no": 1, "sku": sku_val, "quantity": 1},
                        {"line_no": 2, "barcode": "UNKNOWN_BOGUS", "quantity": 1}
                    ]
                },
                headers=headers,
            )
            assert resp_val.status_code == 200
            val_data = resp_val.json()
            assert val_data["is_valid"] is False
            assert len(val_data["errors"]) == 1

            # 4. GET /api/v1/billing/scan/{barcode}
            resp_scan = await client.get(
                f"/api/v1/billing/scan/{bc_val}",
                headers=headers,
            )
            assert resp_scan.status_code == 200
            scan_data = resp_scan.json()
            assert scan_data["code"] == sku_val
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_tenant_context, None)
        app.dependency_overrides.pop(get_company_db, None)
        app.dependency_overrides.pop(get_db, None)
