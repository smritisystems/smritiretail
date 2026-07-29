"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.7.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.inventory import Product
from app.models.purchase import Supplier, VendorContractTier
from app.services.inventory import InventoryService
from app.services.purchase import PurchaseService
from app.api.deps import TenantContext
from app.db.session import active_tenant_ctx
from app.schemas.inventory import ProductCreate, ProductVendorCreate
from app.schemas.purchase import (
    VendorContractCreate,
    VendorContractTierCreate,
    VendorContractUpdate,
    PurchaseOrderCreate,
    PurchaseOrderItemCreate,
)


async def _setup_contract_tenant(db_session: AsyncSession) -> TenantContext:
    from app.models.tenant import Company, Branch
    company_id = f"cmp-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-{uuid.uuid4().hex[:8]}"

    comp = Company(id=company_id, uuid=str(uuid.uuid4()), name="Test Contract Company", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="Main Branch", code=f"BR-{uuid.uuid4().hex[:4]}", is_active=True)
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


async def _create_test_product(db_session: AsyncSession, tenant_ctx: TenantContext, code: str, name: str) -> Product:
    inv_service = InventoryService(db_session, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-{uuid.uuid4().hex[:8]}",
        code=f"{code}-{uuid.uuid4().hex[:4]}",
        name=name,
        category="Footwear",
        brand="Generic",
        color="Black",
        size="XL",
        barcode=f"BC-{uuid.uuid4().hex[:6]}",
        price=Decimal("1000.00")
    )
    return await inv_service.create_product(p_in)


@pytest.mark.asyncio
async def test_vendor_contract_creation_with_tiered_volume_slabs(db_session):
    tenant_ctx = await _setup_contract_tenant(db_session)
    p_service = PurchaseService(db_session, tenant_ctx)
    sup = await _create_test_supplier(db_session, tenant_ctx, "SUP-CONTRACT-1", "Nike Distributorship")
    prod = await _create_test_product(db_session, tenant_ctx, "PRD-CNT-1", "Contracted Running Shoes")

    now = datetime.now(timezone.utc)
    c_in = VendorContractCreate(
        supplier_id=sup.id,
        contract_code=f"VC-2026-NIKE-{uuid.uuid4().hex[:4]}",
        contract_title="Annual Nike Footwear Supply Agreement",
        valid_from=now - timedelta(days=5),
        valid_to=now + timedelta(days=365),
        tiers=[
            VendorContractTierCreate(
                product_id=prod.id,
                min_quantity=Decimal("1.00"),
                max_quantity=Decimal("100.00"),
                contract_unit_price=Decimal("800.00"),
                discount_percentage=Decimal("5.00")
            ),
            VendorContractTierCreate(
                product_id=prod.id,
                min_quantity=Decimal("101.00"),
                max_quantity=Decimal("500.00"),
                contract_unit_price=Decimal("750.00"),
                discount_percentage=Decimal("10.00")
            )
        ]
    )

    contract = await p_service.create_vendor_contract(c_in)
    assert contract is not None
    assert "VC-2026-NIKE" in contract.contract_code
    assert contract.version_number == 1
    
    tier_stmt = select(VendorContractTier).where(VendorContractTier.contract_id == contract.id)
    tiers = (await db_session.execute(tier_stmt)).scalars().all()
    assert len(tiers) == 2


@pytest.mark.asyncio
async def test_deterministic_resolution_under_contract_first_strategy(db_session):
    tenant_ctx = await _setup_contract_tenant(db_session)
    p_service = PurchaseService(db_session, tenant_ctx)
    sup = await _create_test_supplier(db_session, tenant_ctx, "SUP-CONTRACT-2", "Levi's Official")
    prod = await _create_test_product(db_session, tenant_ctx, "PRD-CNT-2", "Levi 501 Jeans")

    now = datetime.now(timezone.utc)
    c_in = VendorContractCreate(
        supplier_id=sup.id,
        contract_code=f"VC-2026-LEVIS-{uuid.uuid4().hex[:4]}",
        contract_title="Levi's Commercial Agreement",
        valid_from=now - timedelta(days=10),
        valid_to=now + timedelta(days=100),
        tiers=[
            VendorContractTierCreate(
                product_id=prod.id,
                min_quantity=Decimal("1.00"),
                max_quantity=Decimal("50.00"),
                contract_unit_price=Decimal("1500.00"),
                discount_percentage=Decimal("0.00")
            ),
            VendorContractTierCreate(
                product_id=prod.id,
                min_quantity=Decimal("51.00"),
                max_quantity=Decimal("1000.00"),
                contract_unit_price=Decimal("1200.00"),
                discount_percentage=Decimal("5.00")
            )
        ]
    )
    contract = await p_service.create_vendor_contract(c_in)
    await p_service.activate_vendor_contract(contract.id)

    # Resolution 1: order_qty = 20 -> Tier 1 (price 1500.00)
    res1 = await p_service.resolve_procurement_source(product_id=prod.id, order_qty=20.0, strategy="CONTRACT_FIRST")
    assert res1.contract_id == contract.id
    assert res1.applied_price == 1500.0
    assert len(res1.resolution_trace) >= 3

    # Resolution 2: order_qty = 100 -> Tier 2 (unit 1200, 5% disc -> net 1140.0)
    res2 = await p_service.resolve_procurement_source(product_id=prod.id, order_qty=100.0, strategy="CONTRACT_FIRST")
    assert res2.contract_id == contract.id
    assert res2.applied_price == 1140.0


@pytest.mark.asyncio
async def test_fallback_to_product_vendor_when_contract_expired(db_session):
    tenant_ctx = await _setup_contract_tenant(db_session)
    p_service = PurchaseService(db_session, tenant_ctx)
    inv_service = InventoryService(db_session, tenant_ctx)
    sup = await _create_test_supplier(db_session, tenant_ctx, "SUP-EXP", "Expired Supplier")
    prod = await _create_test_product(db_session, tenant_ctx, "PRD-EXP", "Expired Contract Shirt")

    # Add ProductVendor fallback cost
    await inv_service.add_product_vendor(prod.id, ProductVendorCreate(supplier_id=sup.id, cost_price=Decimal("900.00"), is_preferred=True))

    # Add Expired Contract (validity ended yesterday)
    now = datetime.now(timezone.utc)
    c_in = VendorContractCreate(
        supplier_id=sup.id,
        contract_code=f"VC-EXPIRED-{uuid.uuid4().hex[:4]}",
        contract_title="Old Expired Contract",
        valid_from=now - timedelta(days=30),
        valid_to=now - timedelta(days=1),
        tiers=[
            VendorContractTierCreate(
                product_id=prod.id,
                min_quantity=Decimal("1.00"),
                contract_unit_price=Decimal("500.00")
            )
        ]
    )
    contract = await p_service.create_vendor_contract(c_in)
    await p_service.activate_vendor_contract(contract.id)

    # Resolution under CONTRACT_FIRST -> Falls back to ProductVendor (900.00)
    res = await p_service.resolve_procurement_source(product_id=prod.id, order_qty=10.0, strategy="CONTRACT_FIRST")
    assert res.contract_id is None
    assert res.applied_price == 900.0


@pytest.mark.asyncio
async def test_purchase_order_item_contract_snapshotting(db_session):
    tenant_ctx = await _setup_contract_tenant(db_session)
    p_service = PurchaseService(db_session, tenant_ctx)
    sup = await _create_test_supplier(db_session, tenant_ctx, "SUP-PO-SNAP", "Snapshot Supplier")
    prod = await _create_test_product(db_session, tenant_ctx, "PRD-SNAP", "Snapshot Product")

    now = datetime.now(timezone.utc)
    c_in = VendorContractCreate(
        supplier_id=sup.id,
        contract_code=f"VC-SNAP-1-{uuid.uuid4().hex[:4]}",
        contract_title="Snapshot Agreement",
        valid_from=now - timedelta(days=1),
        valid_to=now + timedelta(days=30),
        tiers=[
            VendorContractTierCreate(
                product_id=prod.id,
                min_quantity=Decimal("1.00"),
                contract_unit_price=Decimal("650.00"),
                discount_percentage=Decimal("10.00")
            )
        ]
    )
    contract = await p_service.create_vendor_contract(c_in)
    await p_service.activate_vendor_contract(contract.id)

    # Create Purchase Order
    po_in = PurchaseOrderCreate(
        id=f"po-{uuid.uuid4().hex[:8]}",
        order_no=f"PO-SNAP-{uuid.uuid4().hex[:4]}",
        supplier_id=sup.id,
        items=[
            PurchaseOrderItemCreate(
                product_id=prod.id,
                code=prod.code,
                name=prod.name,
                quantity=Decimal("10.00"),
                cost_price=Decimal("585.00"),
                gst_rate=Decimal("18.00")
            )
        ]
    )
    po = await p_service.create_purchase_order(po_in)
    assert po is not None

    # Fetch PO line items and verify snapshot values
    order_obj, items = await p_service.get_purchase_order(po.id)
    assert len(items) == 1
    assert items[0].contract_id == contract.id
    assert items[0].contract_version == 1
    assert float(items[0].applied_unit_price) == 585.0


@pytest.mark.asyncio
async def test_contract_amendment_version_increment(db_session):
    tenant_ctx = await _setup_contract_tenant(db_session)
    p_service = PurchaseService(db_session, tenant_ctx)
    sup = await _create_test_supplier(db_session, tenant_ctx, "SUP-AMD", "Amendment Supplier")
    prod = await _create_test_product(db_session, tenant_ctx, "PRD-AMD", "Amendment Product")

    now = datetime.now(timezone.utc)
    c_in = VendorContractCreate(
        supplier_id=sup.id,
        contract_code=f"VC-AMEND-2026-{uuid.uuid4().hex[:4]}",
        contract_title="Original Contract v1",
        valid_from=now - timedelta(days=1),
        valid_to=now + timedelta(days=60),
        tiers=[
            VendorContractTierCreate(
                product_id=prod.id,
                contract_unit_price=Decimal("1000.00")
            )
        ]
    )
    v1_contract = await p_service.create_vendor_contract(c_in)
    await p_service.activate_vendor_contract(v1_contract.id)
    assert v1_contract.version_number == 1

    # Amend Contract -> Creates v2 & Archives v1
    amend_req = VendorContractUpdate(
        contract_title="Revised Contract v2 with Lower Unit Price"
    )
    v2_contract = await p_service.amend_vendor_contract(v1_contract.id, amend_req)

    assert v2_contract.version_number == 2
    assert v2_contract.parent_contract_id == v1_contract.id
    assert v2_contract.lifecycle_stage == "Active"

    # Verify Old v1 is Archived
    old_c = await p_service.get_vendor_contract(v1_contract.id)
    assert old_c.lifecycle_stage == "Archived"


@pytest.mark.asyncio
async def test_reorder_suggestions_auto_sourcing_integration(db_session):
    tenant_ctx = await _setup_contract_tenant(db_session)
    p_service = PurchaseService(db_session, tenant_ctx)
    sup = await _create_test_supplier(db_session, tenant_ctx, "SUP-REORDER", "Reorder Vendor")
    prod = await _create_test_product(db_session, tenant_ctx, "PRD-REORDER", "Low Stock Item")

    # Set low stock (stock=5 <= level=50)
    prod.stock = 5
    await db_session.commit()

    # Add Reorder Config
    from app.models.purchase import PurchaseReorderConfig
    cfg = PurchaseReorderConfig(
        id=f"cfg-{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        product_id=prod.id,
        reorder_level=Decimal("50.00"),
        reorder_quantity=Decimal("100.00"),
        preferred_supplier_id=sup.id,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id
    )
    db_session.add(cfg)
    await db_session.commit()

    # Get Reorder Suggestions
    suggestions = await p_service.list_reorder_suggestions(supplier_id=sup.id)
    assert len(suggestions) >= 1
    matched = [s for s in suggestions if s["productId"] == prod.id]
    assert len(matched) == 1
    assert matched[0]["suggestedQty"] == 95.0


@pytest.mark.asyncio
async def test_multi_tenant_isolation_for_vendor_contracts(db_session):
    tenant_a = await _setup_contract_tenant(db_session)
    p_service_a = PurchaseService(db_session, tenant_a)

    tenant_b = await _setup_contract_tenant(db_session)
    p_service_b = PurchaseService(db_session, tenant_b)

    sup_a = await _create_test_supplier(db_session, tenant_a, "SUP-TENA", "Company A Supplier")
    now = datetime.now(timezone.utc)

    c_a = await p_service_a.create_vendor_contract(VendorContractCreate(
        supplier_id=sup_a.id,
        contract_code=f"VC-COMP-A-{uuid.uuid4().hex[:4]}",
        contract_title="Company A Secret Contract",
        valid_from=now,
        valid_to=now + timedelta(days=30)
    ))

    # Tenant B tries to get Tenant A's contract -> Raises HTTP 404
    with pytest.raises(HTTPException) as excinfo:
        await p_service_b.get_vendor_contract(c_a.id)
    assert excinfo.value.status_code == 404
