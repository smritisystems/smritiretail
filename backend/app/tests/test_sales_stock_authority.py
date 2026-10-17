"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.47.4
Created      : 2026-10-01
Modified     : 2026-10-01
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Sales Stock Authority Automated Safety & Concurrency Test Suite (Phase S2)
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone
import pytest
from sqlalchemy import select
from fastapi import HTTPException

from app.api.deps import TenantContext
from app.models.tenant import Company, Branch
from app.models.inventory import Product, StockMovement
from app.models.fulfillment import Dispatch, PackingSlip
from app.services.sales_stock_authority import SalesStockAuthority


async def _make_tenant(db_session, suffix: str):
    comp = Company(
        id=f"COMP-STK-{suffix}",
        name=f"Stock Tenant {suffix}",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=f"BR-STK-{suffix}",
        code=f"BR-{suffix}",
        name=f"Branch {suffix}",
        company_id=comp.id,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(comp)
    db_session.add(branch)
    await db_session.commit()
    return comp, branch


async def _make_product(db_session, suffix: str, comp_id: str, br_id: str, stock: int = 100):
    prod = Product(
        id=f"PROD-STK-{suffix}",
        code=f"SKU-{suffix}",
        name=f"Stock Authority Product {suffix}",
        price=Decimal("150.00"),
        mrp=Decimal("150.00"),
        gst_percentage=Decimal("18.00"),
        category="General",
        barcode=f"BAR-{suffix}",
        stock=stock,
        company_id=comp_id,
        branch_id=br_id,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(prod)
    await db_session.commit()
    return prod


@pytest.mark.asyncio
async def test_normal_sale_deducts_stock(db_session):
    """Normal sale creates OUTWARD_SALE movement and updates stock cache from ledger."""
    s = uuid.uuid4().hex[:8]
    comp, br = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=50)
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    movs = await SalesStockAuthority.record_outward_sale(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=f"inv-{s}",
        invoice_no=f"INV-{s}",
        items=[{"product_id": prod.id, "quantity": Decimal("10.00")}],
    )
    await db_session.commit()

    assert len(movs) == 1
    assert movs[0].movement_type == "OUTWARD_SALE"
    assert Decimal(str(movs[0].quantity)) == Decimal("10.00")

    await db_session.refresh(prod)
    # Initial 50 - 10 = 40
    assert prod.stock == 40


@pytest.mark.asyncio
async def test_repeated_posting_idempotent_no_double_deduction(db_session):
    """Repeated call with same invoice_id returns existing movement without double deduction."""
    s = uuid.uuid4().hex[:8]
    comp, br = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=50)
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    # First posting
    movs1 = await SalesStockAuthority.record_outward_sale(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=f"inv-{s}",
        invoice_no=f"INV-{s}",
        items=[{"product_id": prod.id, "quantity": Decimal("10.00")}],
    )
    await db_session.commit()

    # Second posting (re-try / re-play)
    movs2 = await SalesStockAuthority.record_outward_sale(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=f"inv-{s}",
        invoice_no=f"INV-{s}",
        items=[{"product_id": prod.id, "quantity": Decimal("10.00")}],
    )
    await db_session.commit()

    assert movs1[0].id == movs2[0].id

    await db_session.refresh(prod)
    # Stock must remain 40, not 30!
    assert prod.stock == 40


@pytest.mark.asyncio
async def test_sales_cancellation_reversal(db_session):
    """Cancelling a sales invoice creates compensating RETURN_INWARD movement."""
    s = uuid.uuid4().hex[:8]
    comp, br = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=50)
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    # Post sale
    await SalesStockAuthority.record_outward_sale(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=f"inv-{s}",
        invoice_no=f"INV-{s}",
        items=[{"product_id": prod.id, "quantity": Decimal("15.00")}],
    )
    await db_session.commit()
    await db_session.refresh(prod)
    assert prod.stock == 35

    # Reverse via cancellation
    revs = await SalesStockAuthority.record_sales_cancellation_reversal(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=f"inv-{s}",
        invoice_no=f"INV-{s}",
        reason="Customer returned before dispatch",
    )
    await db_session.commit()

    assert len(revs) == 1
    assert revs[0].movement_type == "RETURN_INWARD"
    assert revs[0].reference_doc_type == "SALES_INVOICE_CANCEL"

    await db_session.refresh(prod)
    # Stock restored back to 50
    assert prod.stock == 50


@pytest.mark.asyncio
async def test_sales_return_increments_stock(db_session):
    """Sales return creates RETURN_INWARD movement and increments stock."""
    s = uuid.uuid4().hex[:8]
    comp, br = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=50)
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    movs = await SalesStockAuthority.record_return_inward(
        session=db_session,
        tenant_ctx=tenant_ctx,
        return_id=f"ret-{s}",
        return_no=f"RET-{s}",
        items=[{"product_id": prod.id, "quantity": Decimal("5.00")}],
    )
    await db_session.commit()

    assert len(movs) == 1
    assert movs[0].movement_type == "RETURN_INWARD"

    await db_session.refresh(prod)
    # Stock 50 + 5 = 55
    assert prod.stock == 55


@pytest.mark.asyncio
async def test_dispatch_after_invoice_prevents_double_deduction(db_session):
    """Dispatch linked to an invoice that already deducted stock does NOT double-deduct."""
    s = uuid.uuid4().hex[:8]
    comp, br = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=50)
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)
    inv_id = f"inv-{s}"

    # 1. Invoice posted and deducted 10 units
    await SalesStockAuthority.record_outward_sale(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=inv_id,
        invoice_no=f"INV-{s}",
        items=[{"product_id": prod.id, "quantity": Decimal("10.00")}],
    )
    await db_session.commit()
    await db_session.refresh(prod)
    assert prod.stock == 40

    # 2. Dispatch created referencing same invoice
    dsp_movs = await SalesStockAuthority.record_dispatch_outward(
        session=db_session,
        tenant_ctx=tenant_ctx,
        dispatch_id=f"dsp-{s}",
        dispatch_no=f"DSP-{s}",
        packing_slip_id=f"ps-{s}",
        items=[{"product_id": prod.id, "quantity": Decimal("10.00"), "sku": prod.sku}],
        invoice_id=inv_id,
    )
    await db_session.commit()

    # Stock must remain 40, NOT 30! Zero double deduction!
    await db_session.refresh(prod)
    assert prod.stock == 40


@pytest.mark.asyncio
async def test_cross_company_rejection(db_session):
    """Cannot record stock movement for product belonging to another company."""
    s1 = uuid.uuid4().hex[:8]
    s2 = uuid.uuid4().hex[:8]
    comp1, br1 = await _make_tenant(db_session, s1)
    comp2, br2 = await _make_tenant(db_session, s2)
    prod2 = await _make_product(db_session, s2, comp2.id, br2.id, stock=50)

    # Attempt to deduct prod2 using comp1 tenant context
    tenant_ctx1 = TenantContext(company_id=comp1.id, branch_id=br1.id)

    with pytest.raises(HTTPException) as exc_info:
        await SalesStockAuthority.record_outward_sale(
            session=db_session,
            tenant_ctx=tenant_ctx1,
            invoice_id=f"inv-{s1}",
            invoice_no=f"INV-{s1}",
            items=[{"product_id": prod2.id, "quantity": Decimal("5.00")}],
        )

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_repeated_dispatch_idempotent(db_session):
    """Repeated dispatch with same dispatch_id returns existing movement without double deduction."""
    s = uuid.uuid4().hex[:8]
    comp, br = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=50)
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)
    dsp_id = f"dsp-{s}"

    # First dispatch (no prior invoice)
    movs1 = await SalesStockAuthority.record_dispatch_outward(
        session=db_session,
        tenant_ctx=tenant_ctx,
        dispatch_id=dsp_id,
        dispatch_no=f"DSP-{s}",
        packing_slip_id=f"ps-{s}",
        items=[{"product_id": prod.id, "quantity": Decimal("10.00"), "sku": prod.sku}],
    )
    await db_session.commit()
    assert len(movs1) == 1
    assert movs1[0].movement_type == "OUTWARD_DISPATCH"

    await db_session.refresh(prod)
    assert prod.stock == 40

    # Second dispatch (replay/retry)
    movs2 = await SalesStockAuthority.record_dispatch_outward(
        session=db_session,
        tenant_ctx=tenant_ctx,
        dispatch_id=dsp_id,
        dispatch_no=f"DSP-{s}",
        packing_slip_id=f"ps-{s}",
        items=[{"product_id": prod.id, "quantity": Decimal("10.00"), "sku": prod.sku}],
    )
    await db_session.commit()
    assert len(movs2) == 1
    assert movs1[0].id == movs2[0].id

    await db_session.refresh(prod)
    # Stock must remain 40, zero second deduction
    assert prod.stock == 40

    # Verify only 1 movement in DB
    all_movs_res = await db_session.execute(
        select(StockMovement).where(
            StockMovement.company_id == comp.id,
            StockMovement.reference_doc_id == dsp_id,
            StockMovement.is_deleted.is_(False),
        )
    )
    assert len(all_movs_res.scalars().all()) == 1


@pytest.mark.asyncio
async def test_repeated_sales_return_idempotent(db_session):
    """Repeated return approval returns existing movement without second stock increment."""
    s = uuid.uuid4().hex[:8]
    comp, br = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=50)
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)
    ret_id = f"ret-{s}"

    # First return
    movs1 = await SalesStockAuthority.record_return_inward(
        session=db_session,
        tenant_ctx=tenant_ctx,
        return_id=ret_id,
        return_no=f"RET-{s}",
        items=[{"product_id": prod.id, "quantity": Decimal("5.00")}],
    )
    await db_session.commit()
    assert len(movs1) == 1
    assert movs1[0].movement_type == "RETURN_INWARD"

    await db_session.refresh(prod)
    assert prod.stock == 55

    # Second return (retry)
    movs2 = await SalesStockAuthority.record_return_inward(
        session=db_session,
        tenant_ctx=tenant_ctx,
        return_id=ret_id,
        return_no=f"RET-{s}",
        items=[{"product_id": prod.id, "quantity": Decimal("5.00")}],
    )
    await db_session.commit()
    assert len(movs2) == 1
    assert movs1[0].id == movs2[0].id

    await db_session.refresh(prod)
    # Stock must remain 55, not 60
    assert prod.stock == 55

    all_movs_res = await db_session.execute(
        select(StockMovement).where(
            StockMovement.company_id == comp.id,
            StockMovement.reference_doc_id == ret_id,
            StockMovement.is_deleted.is_(False),
        )
    )
    assert len(all_movs_res.scalars().all()) == 1


@pytest.mark.asyncio
async def test_repeated_cancellation_reversal_idempotent(db_session):
    """Repeated cancellation of invoice produces single reversal movement."""
    s = uuid.uuid4().hex[:8]
    comp, br = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=50)
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)
    inv_id = f"inv-{s}"

    # Post sale
    await SalesStockAuthority.record_outward_sale(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=inv_id,
        invoice_no=f"INV-{s}",
        items=[{"product_id": prod.id, "quantity": Decimal("10.00")}],
    )
    await db_session.commit()
    await db_session.refresh(prod)
    assert prod.stock == 40

    # First cancellation
    rev1 = await SalesStockAuthority.record_sales_cancellation_reversal(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=inv_id,
        invoice_no=f"INV-{s}",
    )
    await db_session.commit()
    assert len(rev1) == 1
    await db_session.refresh(prod)
    assert prod.stock == 50

    # Second cancellation call (retry)
    rev2 = await SalesStockAuthority.record_sales_cancellation_reversal(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=inv_id,
        invoice_no=f"INV-{s}",
    )
    await db_session.commit()
    assert len(rev2) == 1
    assert rev1[0].id == rev2[0].id

    await db_session.refresh(prod)
    # Stock must remain 50, not 60
    assert prod.stock == 50


@pytest.mark.asyncio
async def test_distribution_dispatch_synchronizes_stock(db_session):
    """Distribution dispatch records OUTWARD_SALE with DISTRIBUTION_ORDER ref and synchronizes stock."""
    s = uuid.uuid4().hex[:8]
    comp, br = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=100)
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)
    order_no = f"DIST-{s}"

    movs = await SalesStockAuthority.record_outward_sale(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=order_no,
        invoice_no=order_no,
        items=[{"product_id": prod.id, "quantity": Decimal("25.00"), "unit_cost": Decimal("120.00")}],
        reference_doc_type="DISTRIBUTION_ORDER",
    )
    await db_session.commit()

    assert len(movs) == 1
    assert movs[0].movement_type == "OUTWARD_SALE"
    assert movs[0].reference_doc_type == "DISTRIBUTION_ORDER"
    assert movs[0].reference_doc_id == order_no
    assert movs[0].source_module == "Distribution"

    await db_session.refresh(prod)
    # 100 - 25 = 75
    assert prod.stock == 75

    # Replay test
    movs_repeat = await SalesStockAuthority.record_outward_sale(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=order_no,
        invoice_no=order_no,
        items=[{"product_id": prod.id, "quantity": Decimal("25.00"), "unit_cost": Decimal("120.00")}],
        reference_doc_type="DISTRIBUTION_ORDER",
    )
    await db_session.commit()
    assert movs[0].id == movs_repeat[0].id
    await db_session.refresh(prod)
    assert prod.stock == 75


@pytest.mark.asyncio
async def test_concurrent_stock_deduction_fails_when_insufficient(db_session):
    """Consecutive/competing attempts cannot both deduct beyond available physical stock."""
    s = uuid.uuid4().hex[:8]
    comp, br = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=10)
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    # First deduction of 10 succeeds
    movs1 = await SalesStockAuthority.record_outward_sale(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=f"inv-1-{s}",
        invoice_no=f"INV-1-{s}",
        items=[{"product_id": prod.id, "quantity": Decimal("10.00")}],
        allow_negative_stock=False,
    )
    await db_session.commit()
    assert len(movs1) == 1
    await db_session.refresh(prod)
    assert prod.stock == 0

    # Second competing deduction of 10 MUST fail with 400 Insufficient physical stock
    with pytest.raises(HTTPException) as exc_info:
        await SalesStockAuthority.record_outward_sale(
            session=db_session,
            tenant_ctx=tenant_ctx,
            invoice_id=f"inv-2-{s}",
            invoice_no=f"INV-2-{s}",
            items=[{"product_id": prod.id, "quantity": Decimal("10.00")}],
            allow_negative_stock=False,
        )

    assert exc_info.value.status_code == 400
    assert "Insufficient physical stock" in exc_info.value.detail

    await db_session.refresh(prod)
    assert prod.stock == 0


@pytest.mark.asyncio
async def test_dispatch_before_invoice_bidirectional_protection(db_session):
    """When dispatch occurs first, subsequent invoice posting skips physical double deduction."""
    s = uuid.uuid4().hex[:8]
    comp, br = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=50)
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)
    inv_id = f"inv-{s}"
    ps_id = f"ps-{s}"
    dsp_id = f"dsp-{s}"

    # 1. Create Packing Slip and Dispatch first
    ps = PackingSlip(
        id=ps_id,
        company_id=comp.id,
        sales_invoice_id=inv_id,
        packing_slip_number=f"PS-{s}",
        status="PACKED",
        created_by="TEST",
        is_active=True,
        is_deleted=False,
    )
    dsp = Dispatch(
        id=dsp_id,
        company_id=comp.id,
        dispatch_number=f"DSP-{s}",
        packing_slip_id=ps_id,
        status="DISPATCHED",
        created_by="TEST",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(ps)
    await db_session.flush()
    db_session.add(dsp)
    await db_session.commit()

    # 2. Dispatch deducts physical stock (50 - 15 = 35)
    dsp_movs = await SalesStockAuthority.record_dispatch_outward(
        session=db_session,
        tenant_ctx=tenant_ctx,
        dispatch_id=dsp_id,
        dispatch_no=f"DSP-{s}",
        packing_slip_id=ps_id,
        items=[{"product_id": prod.id, "quantity": Decimal("15.00"), "sku": prod.sku}],
        invoice_id=inv_id, # not yet posted in ledger
    )
    await db_session.commit()
    assert len(dsp_movs) == 1
    assert dsp_movs[0].movement_type == "OUTWARD_DISPATCH"

    await db_session.refresh(prod)
    assert prod.stock == 35

    # 3. Now Invoice is posted for the same goods
    inv_movs = await SalesStockAuthority.record_outward_sale(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=inv_id,
        invoice_no=f"INV-{s}",
        items=[{"product_id": prod.id, "quantity": Decimal("15.00")}],
    )
    await db_session.commit()

    # Must NOT double-deduct physical stock: stock remains 35, NOT 20!
    await db_session.refresh(prod)
    assert prod.stock == 35


@pytest.mark.asyncio
async def test_multi_event_ledger_product_stock_consistency(db_session):
    """Full lifecycle: Sale -> Cancel -> Re-Invoice -> Return maintains exact ledger balance."""
    s = uuid.uuid4().hex[:8]
    comp, br = await _make_tenant(db_session, s)
    prod = await _make_product(db_session, s, comp.id, br.id, stock=100)
    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)

    # 1. Invoice 1 for 20 units -> stock 80
    await SalesStockAuthority.record_outward_sale(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=f"inv-1-{s}",
        invoice_no=f"INV-1-{s}",
        items=[{"product_id": prod.id, "quantity": Decimal("20.00")}],
    )
    await db_session.commit()
    await db_session.refresh(prod)
    assert prod.stock == 80

    # 2. Cancel Invoice 1 -> stock restored to 100
    await SalesStockAuthority.record_sales_cancellation_reversal(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=f"inv-1-{s}",
        invoice_no=f"INV-1-{s}",
    )
    await db_session.commit()
    await db_session.refresh(prod)
    assert prod.stock == 100

    # 3. Invoice 2 for 30 units -> stock 70
    await SalesStockAuthority.record_outward_sale(
        session=db_session,
        tenant_ctx=tenant_ctx,
        invoice_id=f"inv-2-{s}",
        invoice_no=f"INV-2-{s}",
        items=[{"product_id": prod.id, "quantity": Decimal("30.00")}],
    )
    await db_session.commit()
    await db_session.refresh(prod)
    assert prod.stock == 70

    # 4. Return for 10 units -> stock 80
    await SalesStockAuthority.record_return_inward(
        session=db_session,
        tenant_ctx=tenant_ctx,
        return_id=f"ret-1-{s}",
        return_no=f"RET-1-{s}",
        items=[{"product_id": prod.id, "quantity": Decimal("10.00")}],
    )
    await db_session.commit()
    await db_session.refresh(prod)
    assert prod.stock == 80
