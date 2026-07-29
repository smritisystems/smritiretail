"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.8.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.inventory import Product
from app.models.purchase import (
    Supplier, PurchaseOrder, PurchaseOrderItem,
    PurchaseReceipt, PurchaseReceiptItem,
    ThreeWayMatch, ThreeWayMatchLine, LandedCostVoucher, ProcurementTolerancePolicy
)
from app.services.inventory import InventoryService
from app.services.purchase import PurchaseService
from app.procurement.engine.matching_engine import MatchingEngine
from app.procurement.engine.landed_cost_engine import LandedCostEngine
from app.procurement.engine.tolerance_engine import ToleranceEngine
from app.api.deps import TenantContext
from app.db.session import active_tenant_ctx
from app.schemas.inventory import ProductCreate
from app.schemas.purchase import PurchaseOrderCreate, PurchaseOrderItemCreate, PurchaseReceiptCreate


async def _setup_matching_tenant(db_session: AsyncSession) -> TenantContext:
    from app.models.tenant import Company, Branch
    company_id = f"cmp-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-{uuid.uuid4().hex[:8]}"

    comp = Company(id=company_id, uuid=str(uuid.uuid4()), name="Test Matching Company", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="Main Branch", code=f"BR-{uuid.uuid4().hex[:8]}", is_active=True)
    db_session.add_all([comp, branch])
    await db_session.commit()

    ctx = TenantContext(tenant_id="test-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(ctx)
    return ctx


async def _create_test_supplier(db_session: AsyncSession, tenant_ctx: TenantContext) -> Supplier:
    sup = Supplier(
        id=f"sup-{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        tenant_id=tenant_ctx.tenant_id,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        code=f"SUP-{uuid.uuid4().hex[:4]}",
        name="Matching Vendor Ltd",
        mobile=f"98{uuid.uuid4().int % 100000000:08d}",
        workflow_status="Approved",
    )
    db_session.add(sup)
    await db_session.commit()
    return sup


async def _create_test_product(db_session: AsyncSession, tenant_ctx: TenantContext, name: str, cost: Decimal) -> Product:
    inv_service = InventoryService(db_session, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-{uuid.uuid4().hex[:8]}",
        code=f"PRD-MATCH-{uuid.uuid4().hex[:4]}",
        name=name,
        category="Footwear",
        brand="Generic",
        color="Black",
        size="XL",
        barcode=f"BC-{uuid.uuid4().hex[:6]}",
        price=cost * Decimal("1.5")
    )
    return await inv_service.create_product(p_in)


@pytest.mark.asyncio
async def test_three_way_matching_clean_pass(db_session):
    tenant_ctx = await _setup_matching_tenant(db_session)
    p_service = PurchaseService(db_session, tenant_ctx)
    matching_engine = MatchingEngine(db_session, tenant_ctx)

    sup = await _create_test_supplier(db_session, tenant_ctx)
    prod = await _create_test_product(db_session, tenant_ctx, "Clean Match Product", Decimal("500.00"))

    # 1. Create PO (10 units @ 500.00)
    po_in = PurchaseOrderCreate(
        id=f"po-{uuid.uuid4().hex[:8]}",
        order_no=f"PO-CLEAN-{uuid.uuid4().hex[:4]}",
        supplier_id=sup.id,
        items=[
            PurchaseOrderItemCreate(
                product_id=prod.id, code=prod.code, name=prod.name,
                quantity=Decimal("10.00"), cost_price=Decimal("500.00"), gst_rate=Decimal("18.00")
            )
        ]
    )
    po = await p_service.create_purchase_order(po_in)

    # 2. Create GRN (10 received @ 500.00)
    grn_in = PurchaseReceiptCreate(
        id=f"grn-{uuid.uuid4().hex[:8]}",
        receipt_no=f"GRN-CLEAN-{uuid.uuid4().hex[:4]}",
        supplier_id=sup.id,
        order_id=po.id,
        items=[
            {
                "product_id": prod.id, "code": prod.code, "name": prod.name,
                "quantity_ordered": 10.0, "quantity_received": 10.0, "cost_price": 500.0, "gst_rate": 18.0
            }
        ]
    )
    grn = await p_service.create_purchase_receipt(grn_in)

    # 3. Run 3-Way Match (Bill: 10 units @ 500.00 -> Clean Pass)
    billed_items = [{"product_id": prod.id, "billed_qty": 10.0, "billed_unit_price": 500.0}]
    match_res = await matching_engine.execute_three_way_match(
        po_id=po.id, grn_id=grn.id, vendor_bill_no="BILL-CLEAN-001", billed_items=billed_items
    )

    assert match_res is not None
    assert match_res.match_status == "Matched"
    
    line_stmt = select(ThreeWayMatchLine).where(ThreeWayMatchLine.match_id == match_res.id)
    lines = (await db_session.execute(line_stmt)).scalars().all()
    assert len(lines) == 1
    assert lines[0].line_status == "Matched"
    assert "Step 4: 3-Way Verification Passed" in lines[0].resolution_trace[-1]


@pytest.mark.asyncio
async def test_landed_cost_allocation_by_value_weight_volume_qty_manual(db_session):
    tenant_ctx = await _setup_matching_tenant(db_session)
    p_service = PurchaseService(db_session, tenant_ctx)
    landed_engine = LandedCostEngine(db_session, tenant_ctx)

    sup = await _create_test_supplier(db_session, tenant_ctx)
    prod1 = await _create_test_product(db_session, tenant_ctx, "Landed Prod 1", Decimal("1000.00"))
    prod2 = await _create_test_product(db_session, tenant_ctx, "Landed Prod 2", Decimal("500.00"))

    # Create GRN with 2 line items (Prod 1: 10 units @ 1000 = 10,000; Prod 2: 10 units @ 500 = 5,000; Total Value = 15,000)
    grn_in = PurchaseReceiptCreate(
        id=f"grn-{uuid.uuid4().hex[:8]}",
        receipt_no=f"GRN-LANDED-{uuid.uuid4().hex[:4]}",
        supplier_id=sup.id,
        items=[
            {"product_id": prod1.id, "code": prod1.code, "name": prod1.name, "quantity_received": 10.0, "cost_price": 1000.0, "gst_rate": 18.0},
            {"product_id": prod2.id, "code": prod2.code, "name": prod2.name, "quantity_received": 10.0, "cost_price": 500.0, "gst_rate": 18.0}
        ]
    )
    grn = await p_service.create_purchase_receipt(grn_in)

    # Allocate Freight Charge ₹1,500 by VALUE (Prod 1 gets 2/3 = ₹1,000; Prod 2 gets 1/3 = ₹500)
    vouchers = [{"charge_type": "Freight", "charge_amount": 1500.0, "allocation_method": "VALUE"}]
    updated_items = await landed_engine.allocate_landed_costs(grn_id=grn.id, vouchers_in=vouchers)

    assert len(updated_items) == 2
    item1 = [it for it in updated_items if it.product_id == prod1.id][0]
    item2 = [it for it in updated_items if it.product_id == prod2.id][0]

    assert item1.allocated_landed_cost == 1000.0
    assert item1.true_landed_unit_cost == 1100.0  # 1000 base + 1000/10

    assert item2.allocated_landed_cost == 500.0
    assert item2.true_landed_unit_cost == 550.0   # 500 base + 500/10


@pytest.mark.asyncio
async def test_price_variance_exceeding_tolerance_blocks_bill(db_session):
    tenant_ctx = await _setup_matching_tenant(db_session)
    p_service = PurchaseService(db_session, tenant_ctx)
    matching_engine = MatchingEngine(db_session, tenant_ctx)

    sup = await _create_test_supplier(db_session, tenant_ctx)
    prod = await _create_test_product(db_session, tenant_ctx, "Variance Item", Decimal("100.00"))

    # Set strict COMPANY policy (0% price variance, auto_approve=False)
    policy = ProcurementTolerancePolicy(
        id=f"ptp-{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        company_id=tenant_ctx.company_id,
        level="COMPANY",
        allowed_price_variance_pct=Decimal("0.00"),
        allowed_qty_variance_pct=Decimal("0.00"),
        auto_approve_under_threshold=False
    )
    db_session.add(policy)
    await db_session.commit()

    po = await p_service.create_purchase_order(PurchaseOrderCreate(
        id=f"po-{uuid.uuid4().hex[:8]}", order_no=f"PO-VAR-{uuid.uuid4().hex[:4]}", supplier_id=sup.id,
        items=[PurchaseOrderItemCreate(product_id=prod.id, code=prod.code, name=prod.name, quantity=Decimal("10.00"), cost_price=Decimal("100.00"))]
    ))
    grn = await p_service.create_purchase_receipt(PurchaseReceiptCreate(
        id=f"grn-{uuid.uuid4().hex[:8]}",
        receipt_no=f"GRN-VAR-{uuid.uuid4().hex[:4]}", supplier_id=sup.id, order_id=po.id,
        items=[{"product_id": prod.id, "code": prod.code, "name": prod.name, "quantity_received": 10.0, "cost_price": 100.0}]
    ))

    # Billed price = 110.00 (10% price variance > 0.0% allowed)
    billed_items = [{"product_id": prod.id, "billed_qty": 10.0, "billed_unit_price": 110.0}]
    match_res = await matching_engine.execute_three_way_match(po_id=po.id, grn_id=grn.id, vendor_bill_no="BILL-VAR-001", billed_items=billed_items)

    assert match_res.match_status == "Blocked"
    line_stmt = select(ThreeWayMatchLine).where(ThreeWayMatchLine.match_id == match_res.id)
    lines = (await db_session.execute(line_stmt)).scalars().all()
    assert lines[0].line_status == "Blocked"
    assert "EXCEEDED tolerance" in lines[0].resolution_trace[-1]


@pytest.mark.asyncio
async def test_multi_level_tolerance_hierarchy_resolution(db_session):
    tenant_ctx = await _setup_matching_tenant(db_session)
    tolerance_engine = ToleranceEngine(db_session, tenant_ctx)
    sup = await _create_test_supplier(db_session, tenant_ctx)
    prod = await _create_test_product(db_session, tenant_ctx, "Product Specific Policy Item", Decimal("200.00"))

    # Add VENDOR level policy (allowed price var 5.0%)
    v_policy = ProcurementTolerancePolicy(
        id=f"ptp-v-{uuid.uuid4().hex[:8]}", uuid=str(uuid.uuid4()), company_id=tenant_ctx.company_id,
        level="VENDOR", target_id=sup.id, allowed_price_variance_pct=Decimal("5.00"), allowed_qty_variance_pct=Decimal("1.00"), auto_approve_under_threshold=True
    )
    # Add PRODUCT level policy (allowed price var 10.0%)
    p_policy = ProcurementTolerancePolicy(
        id=f"ptp-p-{uuid.uuid4().hex[:8]}", uuid=str(uuid.uuid4()), company_id=tenant_ctx.company_id,
        level="PRODUCT", target_id=prod.id, allowed_price_variance_pct=Decimal("10.00"), allowed_qty_variance_pct=Decimal("2.00"), auto_approve_under_threshold=True
    )
    db_session.add_all([v_policy, p_policy])
    await db_session.commit()

    # Product policy takes priority over Vendor policy
    res = await tolerance_engine.resolve_tolerance(product_id=prod.id, supplier_id=sup.id)
    assert res.level == "PRODUCT"
    assert res.allowed_price_pct == 10.0


@pytest.mark.asyncio
async def test_supervisor_variance_approval_override_workflow(db_session):
    tenant_ctx = await _setup_matching_tenant(db_session)
    p_service = PurchaseService(db_session, tenant_ctx)
    matching_engine = MatchingEngine(db_session, tenant_ctx)

    sup = await _create_test_supplier(db_session, tenant_ctx)
    prod = await _create_test_product(db_session, tenant_ctx, "Approval Item", Decimal("300.00"))

    # Create Blocked Match
    po = await p_service.create_purchase_order(PurchaseOrderCreate(
        id=f"po-{uuid.uuid4().hex[:8]}", order_no=f"PO-APPR-{uuid.uuid4().hex[:4]}", supplier_id=sup.id,
        items=[PurchaseOrderItemCreate(product_id=prod.id, code=prod.code, name=prod.name, quantity=Decimal("5.00"), cost_price=Decimal("300.00"))]
    ))
    grn = await p_service.create_purchase_receipt(PurchaseReceiptCreate(
        id=f"grn-{uuid.uuid4().hex[:8]}",
        receipt_no=f"GRN-APPR-{uuid.uuid4().hex[:4]}", supplier_id=sup.id, order_id=po.id,
        items=[{"product_id": prod.id, "code": prod.code, "name": prod.name, "quantity_received": 5.0, "cost_price": 300.0}]
    ))

    # Add 0% tolerance
    policy = ProcurementTolerancePolicy(
        id=f"ptp-{uuid.uuid4().hex[:8]}", uuid=str(uuid.uuid4()), company_id=tenant_ctx.company_id,
        level="COMPANY", allowed_price_variance_pct=Decimal("0.00"), auto_approve_under_threshold=False
    )
    db_session.add(policy)
    await db_session.commit()

    match_res = await matching_engine.execute_three_way_match(
        po_id=po.id, grn_id=grn.id, vendor_bill_no="BILL-BLK-001",
        billed_items=[{"product_id": prod.id, "billed_qty": 5.0, "billed_unit_price": 350.0}]
    )
    assert match_res.match_status == "Blocked"

    # Supervisor approves block
    approved_match = await matching_engine.approve_variance_block(
        match_id=match_res.id, approved_by="Finance Manager Jawahar", approval_notes="Approved freight price adjustment"
    )
    assert approved_match.match_status == "Approved Override"
    assert approved_match.approved_by == "Finance Manager Jawahar"


@pytest.mark.asyncio
async def test_multi_tenant_isolation_for_matching_records(db_session):
    tenant_a = await _setup_matching_tenant(db_session)
    p_service_a = PurchaseService(db_session, tenant_a)
    matching_engine_a = MatchingEngine(db_session, tenant_a)

    tenant_b = await _setup_matching_tenant(db_session)
    matching_engine_b = MatchingEngine(db_session, tenant_b)

    sup_a = await _create_test_supplier(db_session, tenant_a)
    prod_a = await _create_test_product(db_session, tenant_a, "Company A Product", Decimal("100.00"))

    po_a = await p_service_a.create_purchase_order(PurchaseOrderCreate(
        id=f"po-{uuid.uuid4().hex[:8]}", order_no=f"PO-TENA-{uuid.uuid4().hex[:4]}", supplier_id=sup_a.id,
        items=[PurchaseOrderItemCreate(product_id=prod_a.id, code=prod_a.code, name=prod_a.name, quantity=Decimal("10.00"), cost_price=Decimal("100.00"))]
    ))
    grn_a = await p_service_a.create_purchase_receipt(PurchaseReceiptCreate(
        id=f"grn-{uuid.uuid4().hex[:8]}",
        receipt_no=f"GRN-TENA-{uuid.uuid4().hex[:4]}", supplier_id=sup_a.id, order_id=po_a.id,
        items=[{"product_id": prod_a.id, "code": prod_a.code, "name": prod_a.name, "quantity_received": 10.0, "cost_price": 100.0}]
    ))

    match_a = await matching_engine_a.execute_three_way_match(
        po_id=po_a.id, grn_id=grn_a.id, vendor_bill_no="BILL-TENA-001",
        billed_items=[{"product_id": prod_a.id, "billed_qty": 10.0, "billed_unit_price": 100.0}]
    )

    # Tenant B tries to approve Tenant A's match -> Raises 404
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as excinfo:
        await matching_engine_b.approve_variance_block(match_id=match_a.id, approved_by="Unauthorized User", approval_notes="Malicious attempt")
    assert excinfo.value.status_code == 404
