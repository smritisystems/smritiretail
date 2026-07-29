"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

test_blanket_agreement.py — Integration test suite for Phase 5 (v6.0.0)
Blanket Purchase Agreement (BPA) & Scheduled Delivery Releases.
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timedelta, timezone

from sqlalchemy.future import select

from app.db.session import active_tenant_ctx
from app.api.deps import TenantContext
from app.models.purchase import (
    BlanketPurchaseAgreement, BlanketPurchaseAgreementLine, PurchaseOrder, Supplier
)
from app.models.inventory import Product
from app.services.inventory import InventoryService
from app.schemas.inventory import ProductCreate
from app.procurement.engine.blanket_release_engine import BlanketReleaseEngine


# ─────────────────────────────────────────────────────────────────────────────
# Test Tenant Fixture
# ─────────────────────────────────────────────────────────────────────────────

async def _setup_bpa_tenant(db):
    """Set up an isolated tenant for BPA test suite."""
    from app.models.tenant import Company, Branch
    company_id = f"co-bpa-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-bpa-{uuid.uuid4().hex[:8]}"

    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="BPA Test Co", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="BPA HQ", code=f"BHQ{uuid.uuid4().hex[:4].upper()}", is_active=True)
    db.add_all([company, branch])
    await db.flush()

    tenant_ctx = TenantContext(tenant_id="test-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_id, tenant_ctx


async def _make_supplier(db, company_id, branch_id):
    sup_id = f"sup-bpa-{uuid.uuid4().hex[:8]}"
    sup = Supplier(
        id=sup_id,
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=branch_id,
        name=f"BPA Supplier {uuid.uuid4().hex[:4]}",
        code=f"SUP{uuid.uuid4().hex[:4].upper()}",
    )
    db.add(sup)
    await db.flush()
    return sup_id


async def _make_product(db, tenant_ctx, code_suffix=""):
    inv_service = InventoryService(db, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-bpa-{uuid.uuid4().hex[:8]}",
        code=f"BPAPROD{code_suffix}{uuid.uuid4().hex[:4].upper()}",
        name=f"BPA Product {code_suffix}",
        category="Footwear",
        brand="Generic",
        color="Black",
        size="M",
        barcode=f"BC-BPA-{uuid.uuid4().hex[:6].upper()}",
        price=Decimal("250.00")
    )
    product = await inv_service.create_product(p_in)
    return product.id


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Create Active BPA with committed product lines
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_bpa_with_committed_lines(db_session):
    """
    Assertion 1: A new BPA is created with status=Active and committed product lines,
    with remaining_quantity equal to committed_quantity and remaining_value equal to
    max_commitment_value.
    """
    company_id, branch_id, tenant = await _setup_bpa_tenant(db_session)
    sup_id = await _make_supplier(db_session, company_id, branch_id)
    prod_id = await _make_product(db_session, tenant, "A1")

    bpa_id = f"bpa-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    max_val = Decimal("500000.00")

    bpa = BlanketPurchaseAgreement(
        id=bpa_id,
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        bpa_code="BPA-TEST-001",
        title="Annual Stationery Agreement",
        supplier_id=sup_id,
        valid_from=now,
        valid_to=now + timedelta(days=365),
        max_commitment_value=max_val,
        released_value=Decimal("0.00"),
        remaining_value=max_val,
        status="Active"
    )
    db_session.add(bpa)

    line = BlanketPurchaseAgreementLine(
        id=f"bpal-{uuid.uuid4().hex[:12]}",
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        bpa_id=bpa_id,
        product_id=prod_id,
        agreed_unit_price=Decimal("250.00"),
        committed_quantity=Decimal("1000.00"),
        released_quantity=Decimal("0.00"),
        remaining_quantity=Decimal("1000.00"),
    )
    db_session.add(line)
    await db_session.flush()

    stmt = select(BlanketPurchaseAgreement).where(BlanketPurchaseAgreement.id == bpa_id)
    fetched_bpa = (await db_session.execute(stmt)).scalars().first()

    assert fetched_bpa is not None, "BPA should be persisted"
    assert fetched_bpa.status == "Active", f"Expected status 'Active', got '{fetched_bpa.status}'"
    assert fetched_bpa.remaining_value == max_val, "remaining_value should equal max_commitment_value on creation"
    assert fetched_bpa.released_value == Decimal("0.00"), "released_value should start at zero"

    l_stmt = select(BlanketPurchaseAgreementLine).where(BlanketPurchaseAgreementLine.bpa_id == bpa_id)
    fetched_lines = list((await db_session.execute(l_stmt)).scalars().all())
    assert len(fetched_lines) == 1, f"Expected 1 committed line, got {len(fetched_lines)}"
    assert fetched_lines[0].remaining_quantity == Decimal("1000.00"), "remaining_quantity should equal committed_quantity initially"

    print("\n[PASS] Assertion 1: BPA created with Active status and correct commitment ceilings")


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: BlanketReleaseEngine issues a scheduled release PO
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_bpa_release_creates_purchase_order(db_session):
    """
    Assertion 2: Issuing a partial release against an Active BPA generates a CONFIRMED PO
    linked to the BPA, with correct subtotal and bpa_release_no=1.
    """
    company_id, branch_id, tenant = await _setup_bpa_tenant(db_session)
    sup_id = await _make_supplier(db_session, company_id, branch_id)
    prod_id = await _make_product(db_session, tenant, "B1")

    bpa_id = f"bpa-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    bpa = BlanketPurchaseAgreement(
        id=bpa_id,
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        bpa_code="BPA-REL-001",
        title="Fabric Release Agreement",
        supplier_id=sup_id,
        valid_from=now,
        valid_to=now + timedelta(days=365),
        max_commitment_value=Decimal("200000.00"),
        released_value=Decimal("0.00"),
        remaining_value=Decimal("200000.00"),
        status="Active"
    )
    db_session.add(bpa)
    db_session.add(BlanketPurchaseAgreementLine(
        id=f"bpal-{uuid.uuid4().hex[:12]}",
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        bpa_id=bpa_id,
        product_id=prod_id,
        agreed_unit_price=Decimal("200.00"),
        committed_quantity=Decimal("500.00"),
        released_quantity=Decimal("0.00"),
        remaining_quantity=Decimal("500.00"),
    ))
    await db_session.flush()

    engine = BlanketReleaseEngine(db_session, tenant)
    release_items = [{"product_id": prod_id, "release_quantity": Decimal("100.00")}]
    po = await engine.issue_bpa_release(bpa_id=bpa_id, release_items=release_items)

    assert po is not None, "Release should produce a PO"
    assert po.status == "CONFIRMED", f"Release PO should be CONFIRMED, got '{po.status}'"
    assert po.bpa_id == bpa_id, "PO must be linked to the BPA"
    assert po.bpa_release_no == 1, f"First release should be release #1, got {po.bpa_release_no}"
    expected_subtotal = Decimal("100.00") * Decimal("200.00")  # 20,000
    assert po.subtotal == expected_subtotal, f"Expected subtotal ₹{expected_subtotal}, got ₹{po.subtotal}"

    print("\n[PASS] Assertion 2: Scheduled delivery release PO created with correct bpa_release_no and subtotal")


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: BPA remaining quantities and values decrease after release
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_bpa_remaining_quantities_decrease_after_release(db_session):
    """
    Assertion 3: After a release, BPA.remaining_value decreases and BPALine.remaining_quantity
    decreases by the released amounts.
    """
    company_id, branch_id, tenant = await _setup_bpa_tenant(db_session)
    sup_id = await _make_supplier(db_session, company_id, branch_id)
    prod_id = await _make_product(db_session, tenant, "C1")

    bpa_id = f"bpa-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    bpa = BlanketPurchaseAgreement(
        id=bpa_id,
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        bpa_code="BPA-REM-001",
        title="Carton Supplies Agreement",
        supplier_id=sup_id,
        valid_from=now,
        valid_to=now + timedelta(days=365),
        max_commitment_value=Decimal("100000.00"),
        released_value=Decimal("0.00"),
        remaining_value=Decimal("100000.00"),
        status="Active"
    )
    db_session.add(bpa)
    db_session.add(BlanketPurchaseAgreementLine(
        id=f"bpal-{uuid.uuid4().hex[:12]}",
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        bpa_id=bpa_id,
        product_id=prod_id,
        agreed_unit_price=Decimal("100.00"),
        committed_quantity=Decimal("400.00"),
        released_quantity=Decimal("0.00"),
        remaining_quantity=Decimal("400.00"),
    ))
    await db_session.flush()

    engine = BlanketReleaseEngine(db_session, tenant)
    await engine.issue_bpa_release(bpa_id=bpa_id, release_items=[
        {"product_id": prod_id, "release_quantity": Decimal("150.00")}
    ])

    bpa_stmt = select(BlanketPurchaseAgreement).where(BlanketPurchaseAgreement.id == bpa_id)
    updated_bpa = (await db_session.execute(bpa_stmt)).scalars().first()
    assert updated_bpa.released_value == Decimal("15000.00"), f"Expected released_value=15000, got {updated_bpa.released_value}"
    assert updated_bpa.remaining_value == Decimal("85000.00"), f"Expected remaining_value=85000, got {updated_bpa.remaining_value}"

    line_stmt = select(BlanketPurchaseAgreementLine).where(BlanketPurchaseAgreementLine.bpa_id == bpa_id)
    updated_line = (await db_session.execute(line_stmt)).scalars().first()
    assert updated_line.released_quantity == Decimal("150.00"), f"Line released_quantity mismatch"
    assert updated_line.remaining_quantity == Decimal("250.00"), f"Line remaining_quantity mismatch"

    print("\n[PASS] Assertion 3: BPA remaining_value and line remaining_quantity correctly decremented after release")


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: Commitment ceiling violation is rejected
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_bpa_release_exceeding_line_ceiling_is_rejected(db_session):
    """
    Assertion 4: A release request where the quantity exceeds the BPA line's
    remaining_quantity must be rejected with HTTP 400.
    """
    from fastapi import HTTPException

    company_id, branch_id, tenant = await _setup_bpa_tenant(db_session)
    sup_id = await _make_supplier(db_session, company_id, branch_id)
    prod_id = await _make_product(db_session, tenant, "D1")

    bpa_id = f"bpa-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    bpa = BlanketPurchaseAgreement(
        id=bpa_id,
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        bpa_code="BPA-CEL-001",
        title="Ceiling Guard Test Agreement",
        supplier_id=sup_id,
        valid_from=now,
        valid_to=now + timedelta(days=365),
        max_commitment_value=Decimal("50000.00"),
        released_value=Decimal("0.00"),
        remaining_value=Decimal("50000.00"),
        status="Active"
    )
    db_session.add(bpa)
    db_session.add(BlanketPurchaseAgreementLine(
        id=f"bpal-{uuid.uuid4().hex[:12]}",
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        bpa_id=bpa_id,
        product_id=prod_id,
        agreed_unit_price=Decimal("100.00"),
        committed_quantity=Decimal("200.00"),
        released_quantity=Decimal("0.00"),
        remaining_quantity=Decimal("200.00"),
    ))
    await db_session.flush()

    engine = BlanketReleaseEngine(db_session, tenant)

    with pytest.raises(HTTPException) as exc_info:
        await engine.issue_bpa_release(bpa_id=bpa_id, release_items=[
            {"product_id": prod_id, "release_quantity": Decimal("999.00")}  # Exceeds 200 ceiling
        ])

    assert exc_info.value.status_code == 400
    assert "remaining commitment limit" in exc_info.value.detail.lower() or "remaining commitment limit" in str(exc_info.value.detail)

    print("\n[PASS] Assertion 4: Over-commitment release correctly rejected with HTTP 400")


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: Sequential releases increment bpa_release_no
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sequential_releases_increment_release_number(db_session):
    """
    Assertion 5: Three sequential release POs against the same BPA must carry
    bpa_release_no values of 1, 2, and 3 respectively.
    """
    company_id, branch_id, tenant = await _setup_bpa_tenant(db_session)
    sup_id = await _make_supplier(db_session, company_id, branch_id)
    prod_id = await _make_product(db_session, tenant, "E1")

    bpa_id = f"bpa-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    bpa = BlanketPurchaseAgreement(
        id=bpa_id,
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        bpa_code="BPA-SEQ-001",
        title="Sequential Release Agreement",
        supplier_id=sup_id,
        valid_from=now,
        valid_to=now + timedelta(days=365),
        max_commitment_value=Decimal("1000000.00"),
        released_value=Decimal("0.00"),
        remaining_value=Decimal("1000000.00"),
        status="Active"
    )
    db_session.add(bpa)
    db_session.add(BlanketPurchaseAgreementLine(
        id=f"bpal-{uuid.uuid4().hex[:12]}",
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        bpa_id=bpa_id,
        product_id=prod_id,
        agreed_unit_price=Decimal("100.00"),
        committed_quantity=Decimal("3000.00"),
        released_quantity=Decimal("0.00"),
        remaining_quantity=Decimal("3000.00"),
    ))
    await db_session.flush()

    engine = BlanketReleaseEngine(db_session, tenant)
    po1 = await engine.issue_bpa_release(bpa_id=bpa_id, release_items=[{"product_id": prod_id, "release_quantity": Decimal("100.00")}])
    po2 = await engine.issue_bpa_release(bpa_id=bpa_id, release_items=[{"product_id": prod_id, "release_quantity": Decimal("200.00")}])
    po3 = await engine.issue_bpa_release(bpa_id=bpa_id, release_items=[{"product_id": prod_id, "release_quantity": Decimal("300.00")}])

    assert po1.bpa_release_no == 1, f"Expected release_no=1, got {po1.bpa_release_no}"
    assert po2.bpa_release_no == 2, f"Expected release_no=2, got {po2.bpa_release_no}"
    assert po3.bpa_release_no == 3, f"Expected release_no=3, got {po3.bpa_release_no}"

    print("\n[PASS] Assertion 5: Sequential release numbers 1, 2, 3 correctly assigned")


# ─────────────────────────────────────────────────────────────────────────────
# Test 6: BPA auto-exhausts when all lines are fully released
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_bpa_auto_exhausts_when_fully_released(db_session):
    """
    Assertion 6: When a release consumes all remaining quantities on all BPA lines,
    the BPA status transitions automatically to 'Exhausted'.
    """
    company_id, branch_id, tenant = await _setup_bpa_tenant(db_session)
    sup_id = await _make_supplier(db_session, company_id, branch_id)
    prod_id = await _make_product(db_session, tenant, "F1")

    bpa_id = f"bpa-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    committed_qty = Decimal("50.00")
    unit_price = Decimal("1000.00")
    max_val = committed_qty * unit_price  # exactly 50,000

    bpa = BlanketPurchaseAgreement(
        id=bpa_id,
        uuid=str(uuid.uuid4()),
        tenant_id=company_id,
        company_id=company_id,
        branch_id=branch_id,
        bpa_code="BPA-EXH-001",
        title="Full Exhaustion Agreement",
        supplier_id=sup_id,
        valid_from=now,
        valid_to=now + timedelta(days=365),
        max_commitment_value=max_val,
        released_value=Decimal("0.00"),
        remaining_value=max_val,
        status="Active"
    )
    db_session.add(bpa)
    db_session.add(BlanketPurchaseAgreementLine(
        id=f"bpal-{uuid.uuid4().hex[:12]}",
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        bpa_id=bpa_id,
        product_id=prod_id,
        agreed_unit_price=unit_price,
        committed_quantity=committed_qty,
        released_quantity=Decimal("0.00"),
        remaining_quantity=committed_qty,
    ))
    await db_session.flush()

    engine = BlanketReleaseEngine(db_session, tenant)
    # Release exactly all committed quantity
    await engine.issue_bpa_release(bpa_id=bpa_id, release_items=[
        {"product_id": prod_id, "release_quantity": committed_qty}
    ])

    bpa_stmt = select(BlanketPurchaseAgreement).where(BlanketPurchaseAgreement.id == bpa_id)
    exhausted_bpa = (await db_session.execute(bpa_stmt)).scalars().first()
    assert exhausted_bpa.status == "Exhausted", f"BPA should auto-exhaust when fully released, got '{exhausted_bpa.status}'"
    assert exhausted_bpa.remaining_value == Decimal("0.00"), "remaining_value should be zero on exhaustion"

    print("\n[PASS] Assertion 6: BPA auto-transitions to 'Exhausted' when all lines fully consumed")
