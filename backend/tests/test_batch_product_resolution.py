"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.55.0
Created      : 2026-10-03
Modified     : 2026-10-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Automated Test Suite — SMRITI Global Batch Product Resolution Standard
"""

import pytest
import uuid
from decimal import Decimal
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.services.product_resolution_service import ProductResolutionService
from app.schemas.product_resolution import (
    BatchProductResolutionItem,
    TransactionLineItemInput,
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
async def test_01_batch_resolve_multiple_items(db_session: AsyncSession):
    """
    Test 1: Verify resolving multiple items by barcode, SKU, and product_id in a single batch.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_{suffix}"

    # Seed 2 distinct items
    item1 = Item(
        id=f"itm_{suffix}_1",
        company_id=comp_id,
        item_code=f"STYLE-A-{suffix}",
        item_name=f"Batch Item A {suffix}",
        item_type="FINISHED_GOOD",
        is_active=True,
    )
    db_session.add(item1)
    await db_session.flush()

    var1 = ItemVariant(
        id=f"var_{suffix}_1",
        company_id=comp_id,
        item_id=item1.id,
        variant_sku=f"SKU-A-{suffix}-RED",
        variant_name=f"Batch Item A Red {suffix}",
        selling_price=Decimal("499.00"),
        mrp=Decimal("799.00"),
        is_active=True,
    )
    db_session.add(var1)
    await db_session.flush()

    bc1 = ItemBarcode(
        id=f"bc_{suffix}_1",
        company_id=comp_id,
        item_id=item1.id,
        variant_id=var1.id,
        barcode=f"8901{suffix}1",
        barcode_normalized=f"8901{suffix}1",
        is_active=True,
    )
    db_session.add(bc1)

    item2 = Item(
        id=f"itm_{suffix}_2",
        company_id=comp_id,
        item_code=f"STYLE-B-{suffix}",
        item_name=f"Batch Item B {suffix}",
        item_type="FINISHED_GOOD",
        is_active=True,
    )
    db_session.add(item2)
    await db_session.flush()

    var2 = ItemVariant(
        id=f"var_{suffix}_2",
        company_id=comp_id,
        item_id=item2.id,
        variant_sku=f"SKU-B-{suffix}-BLU",
        variant_name=f"Batch Item B Blue {suffix}",
        selling_price=Decimal("1200.00"),
        mrp=Decimal("1500.00"),
        is_active=True,
    )
    db_session.add(var2)
    await db_session.flush()

    bc2 = ItemBarcode(
        id=f"bc_{suffix}_2",
        company_id=comp_id,
        item_id=item2.id,
        variant_id=var2.id,
        barcode=f"8901{suffix}2",
        barcode_normalized=f"8901{suffix}2",
        is_active=True,
    )
    db_session.add(bc2)
    await db_session.commit()

    # Query in batch
    items_to_resolve = [
        BatchProductResolutionItem(line_no=1, barcode=bc1.barcode, identifier_type="BARCODE"),
        BatchProductResolutionItem(line_no=2, sku=var2.variant_sku, identifier_type="SKU"),
    ]

    res = await ProductResolutionService.resolve_batch(
        db_session,
        items=items_to_resolve,
        company_id=comp_id,
        allow_inactive=False,
    )

    assert res.total_requested == 2
    assert res.total_resolved == 2
    assert res.total_failed == 0

    # Line 1 checks
    r1 = next(r for r in res.results if r.barcode == bc1.barcode)
    assert r1.success is True
    assert r1.barcode == bc1.barcode
    assert r1.name == var1.variant_name
    assert r1.selling_price == Decimal("499.00")

    # Line 2 checks
    r2 = next(r for r in res.results if r.sku == var2.variant_sku)
    assert r2.success is True
    assert r2.sku == var2.variant_sku
    assert r2.name == var2.variant_name
    assert r2.mrp == Decimal("1500.00")


@pytest.mark.asyncio
async def test_02_batch_resolve_mixed_found_and_not_found(db_session: AsyncSession):
    """
    Test 2: Verify mixed batch with valid products and non-existent barcodes.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_{suffix}"

    item = Item(
        id=f"itm_{suffix}",
        company_id=comp_id,
        item_code=f"STYLE-EXISTS-{suffix}",
        item_name=f"Existing Item {suffix}",
        item_type="FINISHED_GOOD",
        is_active=True,
    )
    db_session.add(item)
    await db_session.flush()

    var = ItemVariant(
        id=f"var_{suffix}",
        company_id=comp_id,
        item_id=item.id,
        variant_sku=f"SKU-EXISTS-{suffix}",
        variant_name=f"Existing Item Var {suffix}",
        is_active=True,
    )
    db_session.add(var)
    await db_session.flush()

    bc = ItemBarcode(
        id=f"bc_{suffix}",
        company_id=comp_id,
        item_id=item.id,
        variant_id=var.id,
        barcode=f"8902{suffix}",
        barcode_normalized=f"8902{suffix}",
        is_active=True,
    )
    db_session.add(bc)
    await db_session.commit()

    items = [
        BatchProductResolutionItem(line_no=1, barcode=bc.barcode),
        BatchProductResolutionItem(line_no=2, barcode="NON_EXISTENT_BARCODE_999"),
        BatchProductResolutionItem(line_no=3, sku="NON_EXISTENT_SKU_999"),
    ]

    res = await ProductResolutionService.resolve_batch(
        db_session,
        items=items,
        company_id=comp_id,
    )

    assert res.total_requested == 3
    assert res.total_resolved == 1
    assert res.total_failed == 2

    # Check non-existent barcode error
    r2 = next(r for r in res.results if r.error_detail and r.error_detail.line_no == 2)
    assert r2.success is False
    assert r2.code == "PRODUCT_NOT_FOUND"
    assert "not found" in r2.message.lower()


@pytest.mark.asyncio
async def test_03_batch_resolve_inactive_enforcement(db_session: AsyncSession):
    """
    Test 3: Verify inactive items are flagged as PRODUCT_INACTIVE when allow_inactive=False.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_{suffix}"

    item = Item(
        id=f"itm_{suffix}",
        company_id=comp_id,
        item_code=f"STYLE-INACT-{suffix}",
        item_name=f"Inactive Item {suffix}",
        item_type="FINISHED_GOOD",
        is_active=False,  # Inactive
    )
    db_session.add(item)
    await db_session.flush()

    var = ItemVariant(
        id=f"var_{suffix}",
        company_id=comp_id,
        item_id=item.id,
        variant_sku=f"SKU-INACT-{suffix}",
        variant_name=f"Inactive Item Var {suffix}",
        is_active=True,
    )
    db_session.add(var)
    await db_session.flush()

    bc = ItemBarcode(
        id=f"bc_{suffix}",
        company_id=comp_id,
        item_id=item.id,
        variant_id=var.id,
        barcode=f"8903{suffix}",
        barcode_normalized=f"8903{suffix}",
        is_active=True,
    )
    db_session.add(bc)
    await db_session.commit()

    items = [BatchProductResolutionItem(line_no=1, barcode=bc.barcode)]

    # Disallow inactive (transactional default)
    res_disallowed = await ProductResolutionService.resolve_batch(
        db_session,
        items=items,
        company_id=comp_id,
        allow_inactive=False,
    )
    r1 = res_disallowed.results[0]
    assert r1.success is False
    assert r1.code == "PRODUCT_INACTIVE"

    # Allow inactive (e.g. historical reports or master editing)
    res_allowed = await ProductResolutionService.resolve_batch(
        db_session,
        items=items,
        company_id=comp_id,
        allow_inactive=True,
    )
    assert res_allowed.results[0].success is True


@pytest.mark.asyncio
async def test_04_validate_transaction_lines_dedup_cache(db_session: AsyncSession):
    """
    Test 4: Verify validate_transaction_lines caches resolved identifiers across duplicate lines.
    """
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_{suffix}"

    item = Item(
        id=f"itm_{suffix}",
        company_id=comp_id,
        item_code=f"STYLE-CACHE-{suffix}",
        item_name=f"Cache Test Item {suffix}",
        item_type="FINISHED_GOOD",
        is_active=True,
    )
    db_session.add(item)
    await db_session.flush()

    var = ItemVariant(
        id=f"var_{suffix}",
        company_id=comp_id,
        item_id=item.id,
        variant_sku=f"SKU-CACHE-{suffix}",
        variant_name=f"Cache Test Item Var {suffix}",
        is_active=True,
    )
    db_session.add(var)
    await db_session.flush()

    bc = ItemBarcode(
        id=f"bc_{suffix}",
        company_id=comp_id,
        item_id=item.id,
        variant_id=var.id,
        barcode=f"8904{suffix}",
        barcode_normalized=f"8904{suffix}",
        is_active=True,
    )
    db_session.add(bc)
    await db_session.commit()

    # 4 lines pointing to the exact same barcode
    lines = [
        TransactionLineItemInput(line_no=1, barcode=bc.barcode, quantity=Decimal("1")),
        TransactionLineItemInput(line_no=2, barcode=bc.barcode, quantity=Decimal("2")),
        TransactionLineItemInput(line_no=3, barcode=bc.barcode, quantity=Decimal("3")),
        TransactionLineItemInput(line_no=4, barcode=bc.barcode, quantity=Decimal("4")),
    ]

    res = await ProductResolutionService.validate_transaction_lines(
        db_session,
        lines=lines,
        company_id=comp_id,
    )

    assert res.is_valid is True
    assert res.total_lines == 4
    assert res.valid_lines == 4
    assert res.invalid_lines == 0
    assert len(res.resolved_lines) == 4


@pytest.mark.asyncio
async def test_05_rest_api_batch_resolve():
    """
    Test 5: Verify POST /api/v1/products/batch-resolve HTTP API endpoint with authenticated user.
    """
    from app.api.deps import get_current_user, get_tenant_context, TenantContext, get_db, get_company_db
    from app.models.auth import User, UserRole

    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP_{suffix}"

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
            payload = {
                "items": [
                    {"line_no": 1, "barcode": "UNKNOWN_BARCODE_XYZ"},
                ],
                "allow_inactive": False,
            }
            response = await client.post(
                "/api/v1/products/batch-resolve",
                json=payload,
                headers=headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["total_requested"] == 1
            assert data["total_failed"] == 1
            assert data["results"][0]["code"] == "PRODUCT_NOT_FOUND"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_tenant_context, None)
        app.dependency_overrides.pop(get_company_db, None)
        app.dependency_overrides.pop(get_db, None)
        await engine.dispose()
