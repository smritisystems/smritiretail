"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.2.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

test_quality_inspection.py — Integration test suite for Phase 7 (v6.2.0)
Warehouse Goods Receipt (GRN) & Quality Control (QC) Inspection Engine.
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.future import select

from app.db.session import active_tenant_ctx
from app.api.deps import TenantContext
from app.models.purchase import (
    QualityInspection, QualityInspectionItem, SupplierDebitNote,
    PurchaseReceipt, PurchaseReceiptItem, Supplier
)
from app.models.inventory import Product
from app.services.inventory import InventoryService
from app.schemas.inventory import ProductCreate
from app.procurement.engine.qc_inspection_engine import QCInspectionEngine


# ─────────────────────────────────────────────────────────────────────────────
# Test Tenant & Helper Fixtures
# ─────────────────────────────────────────────────────────────────────────────

async def _setup_qc_tenant(db):
    """Set up an isolated tenant for Quality Inspection test suite."""
    from app.models.tenant import Company, Branch
    company_id = f"co-qc-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-qc-{uuid.uuid4().hex[:8]}"

    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="QC Test Co", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="QC HQ", code=f"QHQ{uuid.uuid4().hex[:4].upper()}", is_active=True)
    db.add_all([company, branch])
    await db.flush()

    tenant_ctx = TenantContext(tenant_id="test-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_id, tenant_ctx


async def _make_supplier(db, company_id, branch_id):
    sup_id = f"sup-qc-{uuid.uuid4().hex[:8]}"
    sup = Supplier(
        id=sup_id,
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=branch_id,
        name=f"QC Supplier {uuid.uuid4().hex[:4]}",
        code=f"SUP{uuid.uuid4().hex[:4].upper()}",
    )
    db.add(sup)
    await db.flush()
    return sup_id


async def _make_product(db, tenant_ctx, price=Decimal("200.00"), code_suffix=""):
    inv_service = InventoryService(db, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-qc-{uuid.uuid4().hex[:8]}",
        code=f"QCPROD{code_suffix}{uuid.uuid4().hex[:4].upper()}",
        name=f"QC Product {code_suffix}",
        category="Footwear",
        brand="Generic",
        color="Black",
        size="XL",
        barcode=f"BC-QC-{uuid.uuid4().hex[:6].upper()}",
        price=price,
        cost_price=price
    )
    product = await inv_service.create_product(p_in)
    return product


async def _make_grn(db, company_id, branch_id, sup_id, prod_id, qty=Decimal("100.00")):
    receipt_id = f"grn-qc-{uuid.uuid4().hex[:8]}"
    receipt_no = f"GRN-QC-{uuid.uuid4().hex[:6].upper()}"

    grn = PurchaseReceipt(
        id=receipt_id,
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        receipt_no=receipt_no,
        supplier_id=sup_id,
        status="RECEIVED",
        qc_status="PendingInspection",
        subtotal=qty * Decimal("200.00"),
        grand_total=qty * Decimal("236.00")
    )
    db.add(grn)

    grn_item = PurchaseReceiptItem(
        id=f"grni-qc-{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        receipt_id=receipt_id,
        product_id=prod_id,
        code="QCPROD-01",
        name="QC Test Item",
        quantity_received=qty,
        cost_price=Decimal("200.00"),
        gst_rate=Decimal("18.00"),
        tax_amount=qty * Decimal("36.00"),
        line_total=qty * Decimal("236.00")
    )
    db.add(grn_item)
    await db.flush()
    return grn


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Create Quality Inspection from GRN
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_inspection_from_receipt(db_session):
    """
    Assertion 1: QualityInspection is initialized from a GRN, creating item lines matching received quantities.
    """
    company_id, branch_id, tenant = await _setup_qc_tenant(db_session)
    sup_id = await _make_supplier(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant, code_suffix="A")
    grn = await _make_grn(db_session, company_id, branch_id, sup_id, product.id, Decimal("50.00"))

    engine = QCInspectionEngine(db_session, tenant)
    inspection = await engine.create_inspection_from_receipt(grn.id, inspector_id="user-qc-01")

    assert inspection is not None
    assert inspection.receipt_id == grn.id
    assert inspection.overall_status == "UnderInspection"
    assert inspection.total_received_qty == Decimal("50.00")

    l_stmt = select(QualityInspectionItem).where(QualityInspectionItem.inspection_id == inspection.id)
    items = list((await db_session.execute(l_stmt)).scalars().all())
    assert len(items) == 1
    assert items[0].product_id == product.id
    assert items[0].received_quantity == Decimal("50.00")

    print("\n[PASS] Assertion 1: QualityInspection created from GRN with initialized line items")


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: Evaluate inspection with 100% accepted items
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_evaluate_inspection_all_passed(db_session):
    """
    Assertion 2: Evaluating an inspection with 100% accepted items sets overall status to Passed
    and updates GRN qc_status="Passed".
    """
    company_id, branch_id, tenant = await _setup_qc_tenant(db_session)
    sup_id = await _make_supplier(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant, code_suffix="B")
    grn = await _make_grn(db_session, company_id, branch_id, sup_id, product.id, Decimal("100.00"))

    engine = QCInspectionEngine(db_session, tenant)
    inspection = await engine.create_inspection_from_receipt(grn.id)

    eval_input = [{
        "product_id": product.id,
        "accepted_quantity": Decimal("100.00"),
        "rejected_quantity": Decimal("0.00"),
        "quarantine_quantity": Decimal("0.00"),
        "defect_category": "NONE"
    }]

    evaluated = await engine.evaluate_inspection(inspection.id, eval_input, remarks="All items intact")

    assert evaluated.overall_status == "Passed"
    assert evaluated.total_accepted_qty == Decimal("100.00")
    assert evaluated.total_rejected_qty == Decimal("0.00")
    assert evaluated.debit_note_id is None, "No Debit Note should be generated when 0 items rejected"

    # Check updated GRN qc_status
    r_stmt = select(PurchaseReceipt).where(PurchaseReceipt.id == grn.id)
    updated_grn = (await db_session.execute(r_stmt)).scalars().first()
    assert updated_grn.qc_status == "Passed"

    print("\n[PASS] Assertion 2: 100% accepted inspection evaluated to Passed, updating GRN qc_status")


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: Partial rejection generates automated Supplier Debit Note
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_evaluate_inspection_partial_rejection_generates_debit_note(db_session):
    """
    Assertion 3: Evaluating an inspection with rejected items sets status to PassedWithExceptions
    and automatically generates a draft SupplierDebitNote.
    """
    company_id, branch_id, tenant = await _setup_qc_tenant(db_session)
    sup_id = await _make_supplier(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant, price=Decimal("200.00"), code_suffix="C")
    grn = await _make_grn(db_session, company_id, branch_id, sup_id, product.id, Decimal("100.00"))

    engine = QCInspectionEngine(db_session, tenant)
    inspection = await engine.create_inspection_from_receipt(grn.id)

    eval_input = [{
        "product_id": product.id,
        "accepted_quantity": Decimal("80.00"),
        "rejected_quantity": Decimal("20.00"),  # 20 defective units
        "quarantine_quantity": Decimal("0.00"),
        "defect_category": "MAJOR",
        "defect_reason": "Sole delamination on 20 units"
    }]

    evaluated = await engine.evaluate_inspection(inspection.id, eval_input, remarks="20 units rejected")

    assert evaluated.overall_status == "PassedWithExceptions"
    assert evaluated.total_accepted_qty == Decimal("80.00")
    assert evaluated.total_rejected_qty == Decimal("20.00")
    assert evaluated.debit_note_id is not None, "Debit Note ID must be populated on partial rejection"

    # Verify generated SupplierDebitNote
    dn_stmt = select(SupplierDebitNote).where(SupplierDebitNote.id == evaluated.debit_note_id)
    debit_note = (await db_session.execute(dn_stmt)).scalars().first()
    assert debit_note is not None
    assert debit_note.status == "DRAFT"
    # Claim: 20 * 200 = 4,000; Tax (18%): 720; Total: 4,720
    assert debit_note.claim_amount == Decimal("4000.00")
    assert debit_note.total_debit_amount == Decimal("4720.00")

    print("\n[PASS] Assertion 3: Partial rejection generated automated SupplierDebitNote draft")


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: 100% rejected inspection evaluates to Failed
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_evaluate_inspection_all_failed(db_session):
    """
    Assertion 4: An inspection where all items are rejected evaluates to Failed
    and updates GRN qc_status="Failed".
    """
    company_id, branch_id, tenant = await _setup_qc_tenant(db_session)
    sup_id = await _make_supplier(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant, code_suffix="D")
    grn = await _make_grn(db_session, company_id, branch_id, sup_id, product.id, Decimal("50.00"))

    engine = QCInspectionEngine(db_session, tenant)
    inspection = await engine.create_inspection_from_receipt(grn.id)

    eval_input = [{
        "product_id": product.id,
        "accepted_quantity": Decimal("0.00"),
        "rejected_quantity": Decimal("50.00"),
        "quarantine_quantity": Decimal("0.00"),
        "defect_category": "CRITICAL",
        "defect_reason": "Total shipment water damaged"
    }]

    evaluated = await engine.evaluate_inspection(inspection.id, eval_input, remarks="Entire shipment rejected")

    assert evaluated.overall_status == "Failed"
    assert evaluated.total_rejected_qty == Decimal("50.00")

    r_stmt = select(PurchaseReceipt).where(PurchaseReceipt.id == grn.id)
    updated_grn = (await db_session.execute(r_stmt)).scalars().first()
    assert updated_grn.qc_status == "Failed"

    print("\n[PASS] Assertion 4: 100% rejected shipment evaluated to Failed")


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: 3-Way Matching gate blocks un-inspected or Failed GRN
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_3way_matching_blocked_for_uninspected_receipt(db_session):
    """
    Assertion 5: Attempting 3-Way Matching QC validation on a PendingInspection or Failed GRN
    raises HTTP 400.
    """
    company_id, branch_id, tenant = await _setup_qc_tenant(db_session)
    sup_id = await _make_supplier(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant, code_suffix="E")
    grn = await _make_grn(db_session, company_id, branch_id, sup_id, product.id, Decimal("30.00"))

    engine = QCInspectionEngine(db_session, tenant)

    # GRN is currently PendingInspection
    with pytest.raises(HTTPException) as exc_info:
        await engine.validate_matching_qc_gate(grn.id)

    assert exc_info.value.status_code == 400
    assert "not passed quality control" in exc_info.value.detail.lower()

    print("\n[PASS] Assertion 5: 3-Way Matching gate correctly blocked un-inspected GRN with HTTP 400")


# ─────────────────────────────────────────────────────────────────────────────
# Test 6: Multi-tenant isolation for Quality Inspections
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_multi_tenant_isolation_for_qc(db_session):
    """
    Assertion 6: Accessing a Quality Inspection from another tenant context raises HTTP 404.
    """
    company_id, branch_id, tenant_a = await _setup_qc_tenant(db_session)
    sup_id = await _make_supplier(db_session, company_id, branch_id)
    product = await _make_product(db_session, tenant_a, code_suffix="F")
    grn = await _make_grn(db_session, company_id, branch_id, sup_id, product.id, Decimal("10.00"))

    engine_a = QCInspectionEngine(db_session, tenant_a)
    inspection = await engine_a.create_inspection_from_receipt(grn.id)

    # Switch to Tenant B
    tenant_b = TenantContext(tenant_id="tenant-b", company_id="co-other", branch_id="br-other")
    active_tenant_ctx.set(tenant_b)
    engine_b = QCInspectionEngine(db_session, tenant_b)

    with pytest.raises(HTTPException) as exc_info:
        await engine_b.evaluate_inspection(inspection.id, [])

    assert exc_info.value.status_code == 404

    print("\n[PASS] Assertion 6: Multi-tenant isolation verified for Quality Inspection records")
