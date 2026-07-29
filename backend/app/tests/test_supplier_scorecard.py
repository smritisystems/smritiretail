"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.3.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

test_supplier_scorecard.py — Integration test suite for Phase 8 (v6.3.0)
Automated Supplier Performance Rating & Scorecard Analytics Engine.
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
    Supplier, SupplierScorecard, SupplierScorecardMetric,
    PurchaseOrder, QualityInspection, QualityInspectionItem, PurchaseReceipt
)
from app.models.inventory import Product
from app.services.inventory import InventoryService
from app.schemas.inventory import ProductCreate
from app.procurement.engine.supplier_performance_engine import SupplierPerformanceEngine
from app.procurement.engine.qc_inspection_engine import QCInspectionEngine


# ─────────────────────────────────────────────────────────────────────────────
# Test Tenant & Helper Fixtures
# ─────────────────────────────────────────────────────────────────────────────

async def _setup_sc_tenant(db):
    """Set up an isolated tenant for Scorecard test suite."""
    from app.models.tenant import Company, Branch
    company_id = f"co-sc-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-sc-{uuid.uuid4().hex[:8]}"

    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="SC Test Co", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="SC HQ", code=f"SHQ{uuid.uuid4().hex[:4].upper()}", is_active=True)
    db.add_all([company, branch])
    await db.flush()

    tenant_ctx = TenantContext(tenant_id="test-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_id, tenant_ctx


async def _make_supplier(db, company_id, branch_id, code_suffix=""):
    sup_id = f"sup-sc-{uuid.uuid4().hex[:8]}"
    sup = Supplier(
        id=sup_id,
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=branch_id,
        name=f"Scorecard Supplier {code_suffix}",
        code=f"SUP{code_suffix}{uuid.uuid4().hex[:4].upper()}",
    )
    db.add(sup)
    await db.flush()
    return sup_id


async def _make_product(db, tenant_ctx, price=Decimal("150.00"), code_suffix=""):
    inv_service = InventoryService(db, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-sc-{uuid.uuid4().hex[:8]}",
        code=f"SCPROD{code_suffix}{uuid.uuid4().hex[:4].upper()}",
        name=f"SC Product {code_suffix}",
        category="Footwear",
        brand="Generic",
        color="Black",
        size="M",
        barcode=f"BC-SC-{uuid.uuid4().hex[:6].upper()}",
        price=price,
        cost_price=price
    )
    product = await inv_service.create_product(p_in)
    return product


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Perfect performance calculation (Grade A / PREFERRED)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_scorecard_perfect_performance(db_session):
    """
    Assertion 1: Calculating scorecard for a supplier with 100% OTIF and Quality yields Grade A (PREFERRED).
    """
    company_id, branch_id, tenant = await _setup_sc_tenant(db_session)
    sup_id = await _make_supplier(db_session, company_id, branch_id, "A")

    engine = SupplierPerformanceEngine(db_session, tenant)
    scorecard = await engine.calculate_scorecard(sup_id, days_window=90)

    assert scorecard is not None
    assert scorecard.composite_score == Decimal("100.00")
    assert scorecard.grade == "A"
    assert scorecard.tier_classification == "PREFERRED"

    # Check updated supplier model
    s_stmt = select(Supplier).where(Supplier.id == sup_id)
    supplier = (await db_session.execute(s_stmt)).scalars().first()
    assert supplier.performance_rating == Decimal("100.00")
    assert supplier.tier_classification == "PREFERRED"

    print("\n[PASS] Assertion 1: Perfect performance calculated as Grade A / PREFERRED")


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: Quality Control rejections reduce Quality score and composite grade
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_scorecard_qc_rejection_reduces_quality_score(db_session):
    """
    Assertion 2: Defective QC rejections (from Phase 7 QC engine) correctly reduce Quality score.
    """
    company_id, branch_id, tenant = await _setup_sc_tenant(db_session)
    sup_id = await _make_supplier(db_session, company_id, branch_id, "B")
    product = await _make_product(db_session, tenant, code_suffix="B")

    # Create GRN and Quality Inspection with 50% rejections
    grn_id = f"grn-sc-{uuid.uuid4().hex[:8]}"
    grn = PurchaseReceipt(
        id=grn_id,
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        receipt_no=f"GRN-SC-{uuid.uuid4().hex[:6].upper()}",
        supplier_id=sup_id,
        status="RECEIVED",
        qc_status="UnderInspection"
    )
    db_session.add(grn)

    insp_id = f"qci-sc-{uuid.uuid4().hex[:8]}"
    inspection = QualityInspection(
        id=insp_id,
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        inspection_no=f"QC-SC-{uuid.uuid4().hex[:6].upper()}",
        receipt_id=grn_id,
        supplier_id=sup_id,
        overall_status="PassedWithExceptions",
        total_received_qty=Decimal("100.00"),
        total_accepted_qty=Decimal("50.00"),
        total_rejected_qty=Decimal("50.00"),  # 50% rejected
        total_quarantine_qty=Decimal("0.00")
    )
    db_session.add(inspection)
    await db_session.flush()

    engine = SupplierPerformanceEngine(db_session, tenant)
    scorecard = await engine.calculate_scorecard(sup_id, days_window=90)

    assert scorecard.quality_score == Decimal("50.00"), f"Expected Quality score 50.00, got {scorecard.quality_score}"
    assert scorecard.composite_score < Decimal("100.00"), "Composite score should decrease due to QC rejections"

    print("\n[PASS] Assertion 2: Quality rejections reduced Quality score to 50.00")


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: OTIF delivery tracking
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_scorecard_otif_delivery_tracking(db_session):
    """
    Assertion 3: Evaluates OTIF score based on PO completion status.
    """
    company_id, branch_id, tenant = await _setup_sc_tenant(db_session)
    sup_id = await _make_supplier(db_session, company_id, branch_id, "C")

    # Create 2 POs: 1 CONFIRMED, 1 DRAFT (pending)
    po1 = PurchaseOrder(
        id=f"po-sc1-{uuid.uuid4().hex[:6]}",
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        order_no=f"PO-SC-1-{uuid.uuid4().hex[:4].upper()}",
        supplier_id=sup_id,
        status="CONFIRMED"
    )
    po2 = PurchaseOrder(
        id=f"po-sc2-{uuid.uuid4().hex[:6]}",
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        order_no=f"PO-SC-2-{uuid.uuid4().hex[:4].upper()}",
        supplier_id=sup_id,
        status="DRAFT"
    )
    db_session.add_all([po1, po2])
    await db_session.flush()

    engine = SupplierPerformanceEngine(db_session, tenant)
    scorecard = await engine.calculate_scorecard(sup_id, days_window=90)

    assert scorecard.otif_score == Decimal("50.00"), f"Expected OTIF score 50.00 (1/2 confirmed), got {scorecard.otif_score}"

    print("\n[PASS] Assertion 3: OTIF delivery score correctly evaluated at 50.00")


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: Low score auto-downgrades tier to SUSPENDED
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_scorecard_automatic_tier_downgrade_to_suspended(db_session):
    """
    Assertion 4: Low composite score (< 60.00) automatically updates Supplier.tier_classification to SUSPENDED.
    """
    company_id, branch_id, tenant = await _setup_sc_tenant(db_session)
    sup_id = await _make_supplier(db_session, company_id, branch_id, "D")

    # Heavy rejections: 0% accepted
    grn_id = f"grn-sc-fail-{uuid.uuid4().hex[:8]}"
    grn = PurchaseReceipt(
        id=grn_id,
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        receipt_no=f"GRN-SC-FAIL-{uuid.uuid4().hex[:4].upper()}",
        supplier_id=sup_id,
        status="RECEIVED",
        qc_status="Failed"
    )
    db_session.add(grn)

    inspection = QualityInspection(
        id=f"qci-fail-{uuid.uuid4().hex[:8]}",
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        inspection_no=f"QC-FAIL-{uuid.uuid4().hex[:4].upper()}",
        receipt_id=grn_id,
        supplier_id=sup_id,
        overall_status="Failed",
        total_received_qty=Decimal("100.00"),
        total_accepted_qty=Decimal("0.00"),
        total_rejected_qty=Decimal("100.00"),
        total_quarantine_qty=Decimal("0.00")
    )
    db_session.add(inspection)

    # 1 DRAFT PO out of 1
    po = PurchaseOrder(
        id=f"po-fail-{uuid.uuid4().hex[:6]}",
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        order_no=f"PO-FAIL-{uuid.uuid4().hex[:4].upper()}",
        supplier_id=sup_id,
        status="DRAFT"
    )
    db_session.add(po)
    await db_session.flush()

    engine = SupplierPerformanceEngine(db_session, tenant)
    scorecard = await engine.calculate_scorecard(sup_id, days_window=90)

    # OTIF = 0, Quality = 0, Price = 100, RFQ = 100 -> Composite = 0 + 0 + 15 + 15 = 30.00 (<60)
    assert scorecard.composite_score < Decimal("60.00")
    assert scorecard.grade == "F"
    assert scorecard.tier_classification == "SUSPENDED"

    s_stmt = select(Supplier).where(Supplier.id == sup_id)
    supplier = (await db_session.execute(s_stmt)).scalars().first()
    assert supplier.tier_classification == "SUSPENDED"

    print("\n[PASS] Assertion 4: Low score (<60.00) automatically downgraded supplier tier to SUSPENDED")


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: Batch recalculation across all tenant suppliers
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_batch_scorecard_recalculation(db_session):
    """
    Assertion 5: recalculate_all_scorecards() recalculates ratings for all active suppliers in tenant.
    """
    company_id, branch_id, tenant = await _setup_sc_tenant(db_session)
    await _make_supplier(db_session, company_id, branch_id, "E1")
    await _make_supplier(db_session, company_id, branch_id, "E2")

    engine = SupplierPerformanceEngine(db_session, tenant)
    scorecards = await engine.recalculate_all_scorecards(days_window=90)

    assert len(scorecards) >= 2

    print("\n[PASS] Assertion 5: Batch scorecard recalculation completed for all tenant suppliers")


# ─────────────────────────────────────────────────────────────────────────────
# Test 6: Multi-tenant isolation for Scorecards
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_multi_tenant_isolation_for_scorecards(db_session):
    """
    Assertion 6: Accessing a scorecard for a supplier from another tenant raises HTTP 404.
    """
    company_id, branch_id, tenant_a = await _setup_sc_tenant(db_session)
    sup_a = await _make_supplier(db_session, company_id, branch_id, "F")

    engine_a = SupplierPerformanceEngine(db_session, tenant_a)
    await engine_a.calculate_scorecard(sup_a, days_window=90)

    # Switch to Tenant B
    tenant_b = TenantContext(tenant_id="tenant-b", company_id="co-other", branch_id="br-other")
    active_tenant_ctx.set(tenant_b)
    engine_b = SupplierPerformanceEngine(db_session, tenant_b)

    with pytest.raises(HTTPException) as exc_info:
        await engine_b.calculate_scorecard(sup_a)

    assert exc_info.value.status_code == 404

    print("\n[PASS] Assertion 6: Multi-tenant isolation verified for Supplier Scorecards")
