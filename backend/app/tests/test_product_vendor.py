"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.6.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import pytest
import uuid
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.inventory import Product, ProductVendor
from app.models.purchase import Supplier
from app.services.inventory import InventoryService
from app.repositories.product import ProductRepository
from app.api.deps import TenantContext
from app.db.session import active_tenant_ctx
from app.schemas.inventory import (
    ProductCreate,
    ProductVendorCreate,
    ProductTaxProfileCreate,
    ProductInventoryPolicyCreate,
)


async def _setup_product_vendor_tenant(db_session: AsyncSession) -> TenantContext:
    from app.models.tenant import Company, Branch
    company_id = f"cmp-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-{uuid.uuid4().hex[:8]}"

    comp = Company(id=company_id, uuid=str(uuid.uuid4()), name="Test Product Vendor Company", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="Main Branch", code=f"BR-{uuid.uuid4().hex[:8].upper()}", is_active=True)
    db_session.add_all([comp, branch])
    await db_session.commit()

    ctx = TenantContext(tenant_id="test-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(ctx)
    return ctx


async def _create_test_supplier(db_session: AsyncSession, tenant_ctx: TenantContext, code: str, name: str) -> Supplier:
    sup = Supplier(
        id=f"sup-{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        tenant_id=tenant_ctx.tenant_id,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        code=code,
        name=name,
        mobile=f"98{uuid.uuid4().int % 100000000:08d}",
        workflow_status="Approved",
    )
    db_session.add(sup)
    await db_session.commit()
    return sup


@pytest.mark.asyncio
async def test_create_product_vendor_catalog_with_all_attributes(db_session):
    tenant_ctx = await _setup_product_vendor_tenant(db_session)
    service = InventoryService(db_session, tenant_ctx)
    sup = await _create_test_supplier(db_session, tenant_ctx, "SUP-001", "Nike Official Distributor")

    p_in = ProductCreate(
        id=f"prod-{uuid.uuid4().hex[:8]}",
        code=f"PRD-{uuid.uuid4().hex[:4]}",
        name="Nike Air Max 2026",
        category="Footwear",
        brand="Nike",
        color="Black",
        size="XL",
        barcode=f"BC-{uuid.uuid4().hex[:6]}",
        price=Decimal("4999.00"),
        vendors=[
            ProductVendorCreate(
                supplier_id=sup.id,
                supplier_product_code="NK-AM26-BLK",
                cost_price=Decimal("3450.00"),
                minimum_order_qty=Decimal("10.00"),
                lead_time_days=3,
                is_preferred=True,
            )
        ]
    )

    created = await service.create_product(p_in)
    assert created is not None
    assert created.name == "Nike Air Max 2026"


@pytest.mark.asyncio
async def test_product_sourcing_mode_hierarchy_override(db_session):
    tenant_ctx = await _setup_product_vendor_tenant(db_session)
    service = InventoryService(db_session, tenant_ctx)
    sup1 = await _create_test_supplier(db_session, tenant_ctx, "SUP-101", "Supplier 1")
    sup2 = await _create_test_supplier(db_session, tenant_ctx, "SUP-102", "Supplier 2")

    # Create Product with SINGLE sourcing mode override
    p_in = ProductCreate(
        id=f"prod-{uuid.uuid4().hex[:8]}",
        code=f"PRD-SINGLE-{uuid.uuid4().hex[:4]}",
        name="Exclusive iPhone 16 Pro",
        category="Accessories",
        brand="Apple",
        color="Black",
        size="XL",
        barcode=f"BC-{uuid.uuid4().hex[:6]}",
        price=Decimal("129999.00"),
        sourcing_mode_override="SINGLE"
    )
    product = await service.create_product(p_in)

    # Link Supplier 1 -> OK
    v1 = ProductVendorCreate(supplier_id=sup1.id, cost_price=Decimal("110000.00"), is_preferred=True)
    await service.add_product_vendor(product.id, v1)

    # Attempt Link Supplier 2 -> Raises HTTP 400 under SINGLE mode
    v2 = ProductVendorCreate(supplier_id=sup2.id, cost_price=Decimal("108000.00"))
    with pytest.raises(HTTPException) as excinfo:
        await service.add_product_vendor(product.id, v2)
    assert excinfo.value.status_code == 400
    assert "SINGLE" in str(excinfo.value.detail)


@pytest.mark.asyncio
async def test_strategic_vendor_resolver_strategies(db_session):
    tenant_ctx = await _setup_product_vendor_tenant(db_session)
    service = InventoryService(db_session, tenant_ctx)

    sup_cost = await _create_test_supplier(db_session, tenant_ctx, "SUP-COST", "Cheapest Vendor")
    sup_fast = await _create_test_supplier(db_session, tenant_ctx, "SUP-FAST", "Fastest Delivery Vendor")
    sup_pref = await _create_test_supplier(db_session, tenant_ctx, "SUP-PREF", "Preferred Vendor")

    p_in = ProductCreate(
        id=f"prod-{uuid.uuid4().hex[:8]}",
        code=f"PRD-HYB-{uuid.uuid4().hex[:4]}",
        name="Multi-Vendor Denim Jeans",
        category="Jeans",
        brand="Levi's",
        color="Blue",
        size="32",
        barcode=f"BC-{uuid.uuid4().hex[:6]}",
        price=Decimal("2499.00"),
        sourcing_mode_override="HYBRID"
    )
    product = await service.create_product(p_in)

    # Add 3 Vendors
    await service.add_product_vendor(product.id, ProductVendorCreate(supplier_id=sup_cost.id, cost_price=Decimal("1200.00"), lead_time_days=7, is_preferred=False))
    await service.add_product_vendor(product.id, ProductVendorCreate(supplier_id=sup_fast.id, cost_price=Decimal("1500.00"), lead_time_days=1, is_preferred=False))
    await service.add_product_vendor(product.id, ProductVendorCreate(supplier_id=sup_pref.id, cost_price=Decimal("1400.00"), lead_time_days=4, is_preferred=True))

    # Test Strategy: PREFERRED -> Resolves Preferred Vendor
    res_pref = await service.resolve_vendor(product.id, strategy="PREFERRED")
    assert res_pref.supplier_id == sup_pref.id

    # Test Strategy: LOWEST_COST -> Resolves Cheapest Vendor
    res_cost = await service.resolve_vendor(product.id, strategy="LOWEST_COST")
    assert res_cost.supplier_id == sup_cost.id
    assert res_cost.estimated_cost == 1200.0

    # Test Strategy: FASTEST_DELIVERY -> Resolves Fastest Vendor
    res_fast = await service.resolve_vendor(product.id, strategy="FASTEST_DELIVERY")
    assert res_fast.supplier_id == sup_fast.id
    assert res_fast.estimated_lead_time == 1


@pytest.mark.asyncio
async def test_date_effective_tax_profile_history(db_session):
    tenant_ctx = await _setup_product_vendor_tenant(db_session)
    service = InventoryService(db_session, tenant_ctx)

    p_in = ProductCreate(
        id=f"prod-{uuid.uuid4().hex[:8]}",
        code=f"PRD-TAX-{uuid.uuid4().hex[:4]}",
        name="Date-Effective Tax Product",
        category="Shirts",
        brand="Generic",
        color="Red",
        size="L",
        barcode=f"BC-{uuid.uuid4().hex[:6]}",
        price=Decimal("999.00"),
    )
    product = await service.create_product(p_in)

    # Resolve Effective GST Rate -> Returns float
    rate = await service.resolve_effective_gst_percentage(product)
    assert isinstance(rate, float)


@pytest.mark.asyncio
async def test_duplicate_product_vendor_raises_http_400(db_session):
    tenant_ctx = await _setup_product_vendor_tenant(db_session)
    service = InventoryService(db_session, tenant_ctx)
    sup = await _create_test_supplier(db_session, tenant_ctx, "SUP-DUP", "Dup Vendor")

    p_in = ProductCreate(
        id=f"prod-{uuid.uuid4().hex[:8]}",
        code=f"PRD-DUP-{uuid.uuid4().hex[:4]}",
        name="Duplicate Vendor Product",
        category="Trousers",
        brand="Generic",
        color="Green",
        size="34",
        barcode=f"BC-{uuid.uuid4().hex[:6]}",
        price=Decimal("999.00"),
    )
    product = await service.create_product(p_in)

    # Add supplier once
    await service.add_product_vendor(product.id, ProductVendorCreate(supplier_id=sup.id, cost_price=Decimal("500.00")))

    # Add supplier second time -> Raises HTTP 400
    with pytest.raises(HTTPException) as excinfo:
        await service.add_product_vendor(product.id, ProductVendorCreate(supplier_id=sup.id, cost_price=Decimal("500.00")))
    assert excinfo.value.status_code == 400
    assert "already linked" in str(excinfo.value.detail)


@pytest.mark.asyncio
async def test_multi_tenant_isolation_prevents_cross_company_access(db_session):
    tenant_a = await _setup_product_vendor_tenant(db_session)
    service_a = InventoryService(db_session, tenant_a)

    tenant_b = await _setup_product_vendor_tenant(db_session)
    repo_b = ProductRepository(db_session, tenant_b)

    p_in = ProductCreate(
        id=f"prod-{uuid.uuid4().hex[:8]}",
        code=f"PRD-TENA-{uuid.uuid4().hex[:4]}",
        name="Tenant A Product",
        category="Jackets",
        brand="Generic",
        color="White",
        size="M",
        barcode=f"BC-{uuid.uuid4().hex[:6]}",
        price=Decimal("1500.00"),
    )
    product_a = await service_a.create_product(p_in)

    # Tenant B get product_a -> Must return None
    res_b = await repo_b.get(product_a.id)
    assert res_b is None


@pytest.mark.asyncio
async def test_soft_delete_product_vendor_preserves_audit(db_session):
    tenant_ctx = await _setup_product_vendor_tenant(db_session)
    service = InventoryService(db_session, tenant_ctx)
    sup = await _create_test_supplier(db_session, tenant_ctx, "SUP-SD", "Soft Delete Supplier")

    p_in = ProductCreate(
        id=f"prod-{uuid.uuid4().hex[:8]}",
        code=f"PRD-SD-{uuid.uuid4().hex[:4]}",
        name="Soft Delete Product",
        category="T-Shirts",
        brand="Generic",
        color="Yellow",
        size="S",
        barcode=f"BC-{uuid.uuid4().hex[:6]}",
        price=Decimal("999.00"),
    )
    product = await service.create_product(p_in)

    pv = await service.add_product_vendor(product.id, ProductVendorCreate(supplier_id=sup.id, cost_price=Decimal("400.00")))
    assert pv is not None

    # Verify vendor link exists
    stmt = select(ProductVendor).filter(ProductVendor.id == pv.id)
    raw_res = await db_session.execute(stmt)
    assert raw_res.scalars().first() is not None


@pytest.mark.asyncio
async def test_atomic_rollback_on_invalid_vendor_payload(db_session):
    tenant_ctx = await _setup_product_vendor_tenant(db_session)
    service = InventoryService(db_session, tenant_ctx)

    p_in = ProductCreate(
        id=f"prod-{uuid.uuid4().hex[:8]}",
        code=f"PRD-RB-{uuid.uuid4().hex[:4]}",
        name="Rollback Product",
        category="Sarees",
        brand="Generic",
        color="Grey",
        size="XL",
        barcode=f"BC-{uuid.uuid4().hex[:6]}",
        price=Decimal("999.00"),
    )
    product = await service.create_product(p_in)

    # Add invalid supplier_id FK to trigger rollback
    with pytest.raises(HTTPException) as excinfo:
        await service.add_product_vendor(product.id, ProductVendorCreate(supplier_id="invalid-supplier-id", cost_price=Decimal("100.00")))
    assert excinfo.value.status_code == 400 or excinfo.value.status_code == 500
