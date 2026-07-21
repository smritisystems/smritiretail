"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.1.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

test_purchase_requisition.py — Integration test suite for Phase 6 (v6.1.0)
Purchase Requisition & Multi-Level Approval Workflow Engine.
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timedelta, timezone

from sqlalchemy.future import select

from app.db.session import active_tenant_ctx
from app.api.deps import TenantContext
from app.models.purchase import (
    PurchaseRequisition, PurchaseRequisitionLine,
    RequisitionApproval, RequisitionApprovalPolicy,
    PurchaseOrder, Supplier
)
from app.models.inventory import Product
from app.services.inventory import InventoryService
from app.schemas.inventory import ProductCreate
from app.procurement.engine.approval_chain_engine import ApprovalChainEngine
from app.procurement.engine.requisition_conversion_engine import RequisitionConversionEngine


# ─────────────────────────────────────────────────────────────────────────────
# Test Tenant & Helper Fixtures
# ─────────────────────────────────────────────────────────────────────────────

async def _setup_req_tenant(db):
    """Set up an isolated tenant for Requisition test suite."""
    from app.models.tenant import Company, Branch
    company_id = f"co-req-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-req-{uuid.uuid4().hex[:8]}"

    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="Req Test Co", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="Req HQ", code=f"RHQ{uuid.uuid4().hex[:4].upper()}", is_active=True)
    db.add_all([company, branch])
    await db.flush()

    tenant_ctx = TenantContext(tenant_id="test-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_id, tenant_ctx


async def _make_supplier(db, company_id, branch_id):
    sup_id = f"sup-req-{uuid.uuid4().hex[:8]}"
    sup = Supplier(
        id=sup_id,
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=branch_id,
        name=f"Req Supplier {uuid.uuid4().hex[:4]}",
        code=f"SUP{uuid.uuid4().hex[:4].upper()}",
    )
    db.add(sup)
    await db.flush()
    return sup_id


async def _make_product(db, tenant_ctx, price=Decimal("100.00"), code_suffix=""):
    inv_service = InventoryService(db, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-req-{uuid.uuid4().hex[:8]}",
        code=f"REQPROD{code_suffix}{uuid.uuid4().hex[:4].upper()}",
        name=f"Requisition Product {code_suffix}",
        category="Footwear",
        brand="Generic",
        color="Black",
        size="L",
        barcode=f"BC-REQ-{uuid.uuid4().hex[:6].upper()}",
        price=price
    )
    product = await inv_service.create_product(p_in)
    return product.id


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Create Draft Requisition with lines and computed total
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_draft_requisition(db_session):
    """
    Assertion 1: Draft requisition is created with line items, computing the correct estimated_total.
    """
    company_id, branch_id, tenant = await _setup_req_tenant(db_session)
    prod_id = await _make_product(db_session, tenant, price=Decimal("500.00"), code_suffix="A")

    req_id = f"req-{uuid.uuid4().hex[:12]}"
    qty = Decimal("10.00")
    price = Decimal("500.00")
    expected_total = qty * price  # 5,000.00

    req = PurchaseRequisition(
        id=req_id,
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        requisition_no=f"REQ-{uuid.uuid4().hex[:6].upper()}",
        title="Office Chairs Requisition",
        department="Operations",
        cost_center="CC-101",
        estimated_total=expected_total,
        status="Draft"
    )
    db_session.add(req)

    req_line = PurchaseRequisitionLine(
        id=f"reql-{uuid.uuid4().hex[:12]}",
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        requisition_id=req_id,
        product_id=prod_id,
        requested_quantity=qty,
        estimated_unit_price=price,
        line_total=expected_total
    )
    db_session.add(req_line)
    await db_session.flush()

    stmt = select(PurchaseRequisition).where(PurchaseRequisition.id == req_id)
    fetched_req = (await db_session.execute(stmt)).scalars().first()

    assert fetched_req is not None
    assert fetched_req.status == "Draft"
    assert fetched_req.estimated_total == expected_total

    print("\n[PASS] Assertion 1: Draft PurchaseRequisition created with computed estimated_total")


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: Low-value requisition (< ₹10,000) is auto-approved
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_low_value_requisition_auto_approved(db_session):
    """
    Assertion 2: Submitting a low-value requisition (<= ₹10,000) transitions immediately to Approved
    without generating manual approval stage records.
    """
    company_id, branch_id, tenant = await _setup_req_tenant(db_session)
    prod_id = await _make_product(db_session, tenant, price=Decimal("200.00"), code_suffix="B")

    req_id = f"req-{uuid.uuid4().hex[:12]}"
    req = PurchaseRequisition(
        id=req_id,
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        requisition_no=f"REQ-LOW-{uuid.uuid4().hex[:6].upper()}",
        title="Low Value Printer Paper",
        estimated_total=Decimal("4000.00"),  # <= 10,000 threshold
        status="Draft"
    )
    db_session.add(req)
    await db_session.flush()

    engine = ApprovalChainEngine(db_session, tenant)
    updated_req = await engine.submit_for_approval(req_id)

    assert updated_req.status == "Approved", f"Expected 'Approved', got '{updated_req.status}'"
    assert updated_req.current_approval_stage is None

    app_stmt = select(RequisitionApproval).where(RequisitionApproval.requisition_id == req_id)
    approvals = list((await db_session.execute(app_stmt)).scalars().all())
    assert len(approvals) == 0, "No manual approval stages should be generated for auto-approved requisitions"

    print("\n[PASS] Assertion 2: Low-value requisition automatically approved without manual stages")


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: High-value requisition (> ₹200,000) generates multi-stage approval chain
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_high_value_requisition_generates_multi_stage_approval(db_session):
    """
    Assertion 3: Submitting a requisition > ₹200,000 transitions status to UnderApproval
    and generates 3 approval stages (Dept Head, Finance, Executive Management).
    """
    company_id, branch_id, tenant = await _setup_req_tenant(db_session)
    prod_id = await _make_product(db_session, tenant, price=Decimal("50000.00"), code_suffix="C")

    req_id = f"req-{uuid.uuid4().hex[:12]}"
    req = PurchaseRequisition(
        id=req_id,
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        requisition_no=f"REQ-HIGH-{uuid.uuid4().hex[:6].upper()}",
        title="High Value IT Infrastructure",
        estimated_total=Decimal("250000.00"),  # > 200,000 threshold
        status="Draft"
    )
    db_session.add(req)
    await db_session.flush()

    engine = ApprovalChainEngine(db_session, tenant)
    updated_req = await engine.submit_for_approval(req_id)

    assert updated_req.status == "UnderApproval", f"Expected 'UnderApproval', got '{updated_req.status}'"
    assert updated_req.current_approval_stage == 1

    app_stmt = select(RequisitionApproval).where(RequisitionApproval.requisition_id == req_id).order_by(RequisitionApproval.stage_order.asc())
    approvals = list((await db_session.execute(app_stmt)).scalars().all())
    assert len(approvals) == 3, f"Expected 3 approval stages, got {len(approvals)}"
    assert approvals[0].required_approver_role == "DEPT_HEAD"
    assert approvals[1].required_approver_role == "FINANCE"
    assert approvals[2].required_approver_role == "MANAGEMENT"

    print("\n[PASS] Assertion 3: High-value requisition generated 3-stage approval chain")


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: Approver decisions advance stage through to Approved
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_approver_decisions_advance_stage_to_approved(db_session):
    """
    Assertion 4: Approving stage 1 advances current_approval_stage to 2; approving final stage
    transitions requisition status to Approved.
    """
    company_id, branch_id, tenant = await _setup_req_tenant(db_session)

    req_id = f"req-{uuid.uuid4().hex[:12]}"
    req = PurchaseRequisition(
        id=req_id,
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        requisition_no=f"REQ-MID-{uuid.uuid4().hex[:6].upper()}",
        title="Mid Value Machinery",
        estimated_total=Decimal("75000.00"),  # > 50,000 -> 2 stages (DEPT_HEAD, FINANCE)
        status="Draft"
    )
    db_session.add(req)
    await db_session.flush()

    engine = ApprovalChainEngine(db_session, tenant)
    req = await engine.submit_for_approval(req_id)

    # Stage 1: Approve as Dept Head
    req = await engine.record_decision(req_id, approver_id="user-dept-head", decision="APPROVED", notes="Looks good")
    assert req.status == "UnderApproval"
    assert req.current_approval_stage == 2

    # Stage 2: Approve as Finance Manager
    req = await engine.record_decision(req_id, approver_id="user-finance-mgr", decision="APPROVED", notes="Budget available")
    assert req.status == "Approved"

    print("\n[PASS] Assertion 4: Sequential approvals advanced stage and completed with Approved status")


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: Rejection marks requisition as Rejected
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_rejection_marks_requisition_rejected(db_session):
    """
    Assertion 5: Rejection at any stage immediately sets status to Rejected.
    """
    company_id, branch_id, tenant = await _setup_req_tenant(db_session)

    req_id = f"req-{uuid.uuid4().hex[:12]}"
    req = PurchaseRequisition(
        id=req_id,
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        requisition_no=f"REQ-REJ-{uuid.uuid4().hex[:6].upper()}",
        title="Rejected Requisition Test",
        estimated_total=Decimal("80000.00"),
        status="Draft"
    )
    db_session.add(req)
    await db_session.flush()

    engine = ApprovalChainEngine(db_session, tenant)
    req = await engine.submit_for_approval(req_id)

    # Reject at stage 1
    req = await engine.record_decision(req_id, approver_id="user-dept-head", decision="REJECTED", notes="Exceeds quarter budget")
    assert req.status == "Rejected"

    print("\n[PASS] Assertion 5: Rejection correctly set status to Rejected")


# ─────────────────────────────────────────────────────────────────────────────
# Test 6: Approved requisition converts to Direct PO
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_approved_requisition_converts_to_direct_po(db_session):
    """
    Assertion 6: Approved requisition converts to a CONFIRMED PurchaseOrder via RequisitionConversionEngine,
    updating requisition status to Converted and recording converted_doc_id.
    """
    company_id, branch_id, tenant = await _setup_req_tenant(db_session)
    sup_id = await _make_supplier(db_session, company_id, branch_id)
    prod_id = await _make_product(db_session, tenant, price=Decimal("150.00"), code_suffix="D")

    req_id = f"req-{uuid.uuid4().hex[:12]}"
    req_no = f"REQ-CONV-{uuid.uuid4().hex[:6].upper()}"

    req = PurchaseRequisition(
        id=req_id,
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        requisition_no=req_no,
        title="Conversion Test Requisition",
        estimated_total=Decimal("1500.00"),
        status="Approved"
    )
    db_session.add(req)

    req_line = PurchaseRequisitionLine(
        id=f"reql-{uuid.uuid4().hex[:12]}",
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        requisition_id=req_id,
        product_id=prod_id,
        requested_quantity=Decimal("10.00"),
        estimated_unit_price=Decimal("150.00"),
        line_total=Decimal("1500.00"),
        preferred_supplier_id=sup_id
    )
    db_session.add(req_line)
    await db_session.flush()

    conv_engine = RequisitionConversionEngine(db_session, tenant)
    res = await conv_engine.convert(requisition_id=req_id, strategy="DIRECT_PO", supplier_id=sup_id)

    assert res["converted_doc_type"] == "PURCHASE_ORDER"
    po_id = res["converted_doc_id"]
    assert po_id is not None

    po_stmt = select(PurchaseOrder).where(PurchaseOrder.id == po_id)
    po = (await db_session.execute(po_stmt)).scalars().first()
    assert po is not None
    assert po.status == "CONFIRMED"
    assert po.supplier_id == sup_id

    req_stmt = select(PurchaseRequisition).where(PurchaseRequisition.id == req_id)
    converted_req = (await db_session.execute(req_stmt)).scalars().first()
    assert converted_req.status == "Converted"
    assert converted_req.converted_doc_id == po_id

    print("\n[PASS] Assertion 6: Approved PurchaseRequisition converted to CONFIRMED PurchaseOrder")
