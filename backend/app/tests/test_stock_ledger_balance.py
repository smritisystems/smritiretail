"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-10
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Stock Ledger Authoritative Running Balance Test Suite
=====================================================
Phase 0 Decision: Option A — inventory_ledger_entries is canonical.

Tests verify:
  1.  Purchase / inbound
  2.  Sale / outbound
  3.  POS_SALE (canonical ILE path — trigger gap is a stock_movements issue, not ILE)
  4.  Sale return
  5.  Purchase return
  6.  Adjustment (positive variance)
  7.  Adjustment (negative variance)
  8.  Transfer (WH-A → WH-B) — no double-count, correct per-location balance
  9.  Multiple movements — full running balance sequence
  10. Same-timestamp determinism — entry_no is secondary sort key
  11. Tenant / company isolation
  12. Location isolation
  13. Enterprise customer / DC / store hierarchy (generic CHAIN-A scenario)
  14. Customer isolation (CHAIN-A vs CHAIN-B same SKU)
  15. Ownership separation (COMPANY vs CONSIGNMENT)
  16. Empty ledger
  17. Reversal entry
  18. Commercial sale is NOT customer sell-through
"""

import uuid
import pytest
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import select, func, text

from app.api.deps import TenantContext
from app.db.session import active_tenant_ctx
from app.models.tenant import Company, Branch
from app.models.inventory import Product
from app.models.inventory_kernel import (
    InventoryLedgerEntry,
    InventoryLocationNode,
)
from app.services.inventory.facades import InventoryCommandFacade, InventoryQueryFacade
from app.services.inventory.ilg_engine import InventoryLedgerEngine


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _make_tenant(db, suffix: str):
    """Create an isolated company + branch for test isolation."""
    uid = uuid.uuid4().hex[:6]
    cid = f"co-slt-{suffix}-{uid}"
    bid = f"br-slt-{suffix}-{uid}"
    bcode = f"SLT-{suffix.upper()[:4]}-{uid.upper()}"
    comp = Company(id=cid, uuid=str(uuid.uuid4()), name=f"SLT Co {suffix} {uid}", is_active=True)
    br = Branch(
        id=bid, uuid=str(uuid.uuid4()), company_id=cid,
        name=f"SLT Branch {suffix} {uid}", code=bcode, is_active=True
    )
    db.add_all([comp, br])
    await db.flush()
    ctx = TenantContext(company_id=cid, branch_id=bid)
    active_tenant_ctx.set(ctx)
    return ctx


async def _make_product(db, ctx: TenantContext, code_suffix: str = "", stock: int = 0) -> Product:
    """Create a minimal product with no opening stock."""
    rnd = uuid.uuid4().hex[:6]
    suffix = f"{code_suffix}-{rnd}" if code_suffix else rnd
    pid = f"prod-slt-{suffix}"
    sku = f"SKU-SLT-{suffix.upper()}"
    p = Product(
        id=pid,
        uuid=str(uuid.uuid4()),
        code=sku,
        sku=sku,
        barcode=f"BC-SLT-{suffix.upper()}",
        category="General",
        name=f"SLT Product {suffix}",
        stock=Decimal(str(stock)),
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
    )
    db.add(p)
    await db.flush()
    return p


async def _balance_at(db, ctx: TenantContext, product_id: str, location_id: str | None = None) -> float:
    """Derive balance from ILE using ILG engine — the authoritative source."""
    ilg = InventoryLedgerEngine(db, ctx)
    bal = await ilg.calculate_location_balance(product_id, location_id)
    return float(bal)


async def _ile_rows(db, ctx: TenantContext, product_id: str) -> list:
    """Fetch all ILE rows for a product ordered by posting_timestamp, entry_no."""
    stmt = (
        select(InventoryLedgerEntry)
        .where(
            InventoryLedgerEntry.product_id == product_id,
            InventoryLedgerEntry.company_id == ctx.company_id,
        )
        .order_by(InventoryLedgerEntry.posting_timestamp.asc(), InventoryLedgerEntry.entry_no.asc())
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


# ─────────────────────────────────────────────────────────────────────────────
# Test 1 — Purchase / inbound
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_slt_01_purchase_inbound(db_session):
    """
    Purchase GRN of 10 units → ILE entry posted → balance = 10.
    to_location_id = WH → inbound → +10.
    from_location_id = NULL → no outbound.
    """
    ctx = await _make_tenant(db_session, "t01")
    product = await _make_product(db_session, ctx)
    cmd = InventoryCommandFacade(db_session, ctx)

    entries = await cmd.receive_purchase(
        grn_id="GRN-T01",
        grn_no="GRN-SLT-001",
        items=[{"product_id": product.id, "quantity": 10}],
        warehouse="WH-SLT-T01",
    )
    await db_session.commit()

    assert len(entries) == 1
    ile = entries[0]
    assert ile.to_location_id == "WH-SLT-T01"
    assert ile.from_location_id is None
    assert float(ile.quantity) == 10.0

    balance = await _balance_at(db_session, ctx, product.id, "WH-SLT-T01")
    assert balance == 10.0, f"Expected 10, got {balance}"


# ─────────────────────────────────────────────────────────────────────────────
# Test 2 — Sale / outbound
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_slt_02_sale_outbound(db_session):
    """
    Opening 10 → SALE 3 → balance = 7.
    """
    ctx = await _make_tenant(db_session, "t02")
    product = await _make_product(db_session, ctx)
    cmd = InventoryCommandFacade(db_session, ctx)

    await cmd.receive_purchase(
        grn_id="GRN-T02",
        grn_no="GRN-SLT-002",
        items=[{"product_id": product.id, "quantity": 10}],
        warehouse="WH-SLT-T02",
    )
    await cmd.issue_sale(
        invoice_id="INV-T02",
        invoice_no="INV-SLT-002",
        items=[{"product_id": product.id, "quantity": 3}],
        warehouse="WH-SLT-T02",
    )
    await db_session.commit()

    rows = await _ile_rows(db_session, ctx, product.id)
    assert len(rows) == 2

    # Row 0 = inbound (PURCHASE): to_location set, from_location NULL
    assert rows[0].to_location_id == "WH-SLT-T02"
    assert rows[0].from_location_id is None
    assert float(rows[0].quantity) == 10.0

    # Row 1 = outbound (SALE): from_location set, to_location NULL
    assert rows[1].from_location_id == "WH-SLT-T02"
    assert rows[1].to_location_id is None
    assert float(rows[1].quantity) == 3.0

    network_balance = await _balance_at(db_session, ctx, product.id)
    assert network_balance == 7.0, f"Expected 7, got {network_balance}"

    wh_balance = await _balance_at(db_session, ctx, product.id, "WH-SLT-T02")
    assert wh_balance == 7.0


# ─────────────────────────────────────────────────────────────────────────────
# Test 3 — POS_SALE through canonical ILE
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_slt_03_pos_sale_canonical_ile(db_session):
    """
    Phase 9 requirement: POS_SALE must be correctly represented in ILE.

    Opening: 10
    POS_SALE: 3
    Expected balance (ILE): 7

    ILE semantics: POS_SALE → from_location_id = store, to_location_id = NULL (exit).
    Balance = SUM(to) - SUM(from) = 10 - 3 = 7. Correct.

    NOTE: stock_movements trigger does NOT handle POS_SALE (Phase 0 finding).
    This test verifies the canonical ILE path is correct.
    """
    ctx = await _make_tenant(db_session, "t03")
    product = await _make_product(db_session, ctx)
    cmd = InventoryCommandFacade(db_session, ctx)

    await cmd.receive_purchase(
        grn_id="GRN-T03",
        grn_no="GRN-SLT-003",
        items=[{"product_id": product.id, "quantity": 10}],
        warehouse="STORE-SLT-T03",
    )
    pos_entries = await cmd.issue_pos_sale(
        receipt_id="POS-T03",
        receipt_no="POS-SLT-003",
        items=[{"product_id": product.id, "quantity": 3}],
        warehouse="STORE-SLT-T03",
    )
    await db_session.commit()

    assert len(pos_entries) == 1
    pos_ile = pos_entries[0]
    assert pos_ile.movement_type == "POS_SALE"
    assert pos_ile.from_location_id == "STORE-SLT-T03"
    assert pos_ile.to_location_id is None      # exit — consumer purchase
    assert float(pos_ile.quantity) == 3.0

    # ILE balance must be 7 (canonical path is correct even though trigger has gap)
    balance = await _balance_at(db_session, ctx, product.id, "STORE-SLT-T03")
    assert balance == 7.0, f"POS_SALE ILE balance expected 7, got {balance}"


# ─────────────────────────────────────────────────────────────────────────────
# Test 4 — Sale return
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_slt_04_sale_return(db_session):
    """
    Opening 10 → SALE 3 → balance 7 → SALE_RETURN 2 → balance 9.
    SALE_RETURN: to_location set (restore stock), from_location NULL.
    """
    ctx = await _make_tenant(db_session, "t04")
    product = await _make_product(db_session, ctx)
    cmd = InventoryCommandFacade(db_session, ctx)

    await cmd.receive_purchase(
        grn_id="GRN-T04", grn_no="GRN-SLT-004",
        items=[{"product_id": product.id, "quantity": 10}], warehouse="WH-T04",
    )
    await cmd.issue_sale(
        invoice_id="INV-T04", invoice_no="INV-SLT-004",
        items=[{"product_id": product.id, "quantity": 3}], warehouse="WH-T04",
    )
    await cmd.return_sale(
        return_id="RET-T04", return_no="RET-SLT-004",
        items=[{"product_id": product.id, "quantity": 2}], warehouse="WH-T04",
    )
    await db_session.commit()

    balance = await _balance_at(db_session, ctx, product.id, "WH-T04")
    assert balance == 9.0, f"Expected 9, got {balance}"


# ─────────────────────────────────────────────────────────────────────────────
# Test 5 — Purchase return
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_slt_05_purchase_return(db_session):
    """
    Opening 10 → PURCHASE_RETURN 2 → balance 8.
    PURCHASE_RETURN: from_location set (exit to supplier), to_location NULL.
    """
    ctx = await _make_tenant(db_session, "t05")
    product = await _make_product(db_session, ctx)
    cmd = InventoryCommandFacade(db_session, ctx)

    await cmd.receive_purchase(
        grn_id="GRN-T05", grn_no="GRN-SLT-005",
        items=[{"product_id": product.id, "quantity": 10}], warehouse="WH-T05",
    )
    await cmd.return_purchase(
        return_id="PRET-T05", return_no="PRET-SLT-005",
        items=[{"product_id": product.id, "quantity": 2}], warehouse="WH-T05",
    )
    await db_session.commit()

    balance = await _balance_at(db_session, ctx, product.id, "WH-T05")
    assert balance == 8.0, f"Expected 8, got {balance}"


# ─────────────────────────────────────────────────────────────────────────────
# Test 6 — Adjustment (positive variance)
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_slt_06_adjustment_positive(db_session):
    """
    Opening 10 → ADJUSTMENT +5 → balance 15.
    Positive variance: to_location set, from_location NULL.
    """
    ctx = await _make_tenant(db_session, "t06")
    product = await _make_product(db_session, ctx)
    cmd = InventoryCommandFacade(db_session, ctx)

    await cmd.receive_purchase(
        grn_id="GRN-T06", grn_no="GRN-SLT-006",
        items=[{"product_id": product.id, "quantity": 10}], warehouse="WH-T06",
    )
    await cmd.adjust_stock(
        audit_id="ADJ-T06", audit_no="ADJ-SLT-006",
        items=[{"product_id": product.id, "variance_quantity": 5}],
        warehouse="WH-T06",
    )
    await db_session.commit()

    balance = await _balance_at(db_session, ctx, product.id, "WH-T06")
    assert balance == 15.0, f"Expected 15, got {balance}"


# ─────────────────────────────────────────────────────────────────────────────
# Test 7 — Adjustment (negative variance)
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_slt_07_adjustment_negative(db_session):
    """
    Opening 10 → ADJUSTMENT -3 → balance 7.
    Negative variance: from_location set, to_location NULL.
    """
    ctx = await _make_tenant(db_session, "t07")
    product = await _make_product(db_session, ctx)
    cmd = InventoryCommandFacade(db_session, ctx)

    await cmd.receive_purchase(
        grn_id="GRN-T07", grn_no="GRN-SLT-007",
        items=[{"product_id": product.id, "quantity": 10}], warehouse="WH-T07",
    )
    await cmd.adjust_stock(
        audit_id="ADJ-T07N", audit_no="ADJ-SLT-007N",
        items=[{"product_id": product.id, "variance_quantity": -3}],
        warehouse="WH-T07",
    )
    await db_session.commit()

    balance = await _balance_at(db_session, ctx, product.id, "WH-T07")
    assert balance == 7.0, f"Expected 7, got {balance}"


# ─────────────────────────────────────────────────────────────────────────────
# Test 8 — Transfer (WH-A → WH-B) — location isolation, no double-count
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_slt_08_transfer_location_isolation(db_session):
    """
    WH-A: Purchase 10
    Transfer 4 from WH-A to WH-B

    Expected:
      WH-A balance = 6
      WH-B balance = 4
      Network balance = 10 (transfer is net zero at company level)

    ILE location semantics:
      TRANSFER_OUT: from=WH-A, to=WH-B, qty=4 → WH-A: -4, WH-B: +4
    """
    ctx = await _make_tenant(db_session, "t08")
    product = await _make_product(db_session, ctx)
    cmd = InventoryCommandFacade(db_session, ctx)

    await cmd.receive_purchase(
        grn_id="GRN-T08", grn_no="GRN-SLT-008",
        items=[{"product_id": product.id, "quantity": 10}], warehouse="WH-SLT-T08-A",
    )
    # Transfer from A to B: TRANSFER_OUT posts from=A, to=B in ILE
    await cmd.transfer_out(
        transfer_id="TR-T08", transfer_no="TR-SLT-008",
        items=[{"product_id": product.id, "quantity": 4}],
        source_warehouse="WH-SLT-T08-A",
        target_warehouse="WH-SLT-T08-B",
    )
    await db_session.commit()

    wha_balance = await _balance_at(db_session, ctx, product.id, "WH-SLT-T08-A")
    whb_balance = await _balance_at(db_session, ctx, product.id, "WH-SLT-T08-B")
    network_balance = await _balance_at(db_session, ctx, product.id)

    assert wha_balance == 6.0, f"WH-A expected 6, got {wha_balance}"
    assert whb_balance == 4.0, f"WH-B expected 4, got {whb_balance}"
    assert network_balance == 10.0, f"Network expected 10, got {network_balance}"


# ─────────────────────────────────────────────────────────────────────────────
# Test 9 — Multiple movements — full running balance sequence
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_slt_09_full_running_balance_sequence(db_session):
    """
    Sequence:
      PURCHASE  +10  → balance 10
      SALE       -3  → balance  7
      PURCHASE  +20  → balance 27
      SALE_RETURN +2 → balance 29
      SALE      -10  → balance 19
      ADJUSTMENT -4  → balance 15

    Verify ILG cumulative balance equals 15 after all movements.
    """
    ctx = await _make_tenant(db_session, "t09")
    product = await _make_product(db_session, ctx)
    cmd = InventoryCommandFacade(db_session, ctx)
    wh = "WH-SLT-T09"

    await cmd.receive_purchase(
        grn_id="GRN-T09-1", grn_no="GRN-S09-1",
        items=[{"product_id": product.id, "quantity": 10}], warehouse=wh,
    )
    await cmd.issue_sale(
        invoice_id="INV-T09-1", invoice_no="INV-S09-1",
        items=[{"product_id": product.id, "quantity": 3}], warehouse=wh,
    )
    await cmd.receive_purchase(
        grn_id="GRN-T09-2", grn_no="GRN-S09-2",
        items=[{"product_id": product.id, "quantity": 20}], warehouse=wh,
    )
    await cmd.return_sale(
        return_id="RET-T09", return_no="RET-S09",
        items=[{"product_id": product.id, "quantity": 2}], warehouse=wh,
    )
    await cmd.issue_sale(
        invoice_id="INV-T09-2", invoice_no="INV-S09-2",
        items=[{"product_id": product.id, "quantity": 10}], warehouse=wh,
    )
    await cmd.adjust_stock(
        audit_id="ADJ-T09", audit_no="ADJ-S09",
        items=[{"product_id": product.id, "variance_quantity": -4}], warehouse=wh,
    )
    await db_session.commit()

    final_balance = await _balance_at(db_session, ctx, product.id, wh)
    assert final_balance == 15.0, f"Expected 15, got {final_balance}"


# ─────────────────────────────────────────────────────────────────────────────
# Test 10 — Same-timestamp determinism via entry_no
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_slt_10_same_timestamp_determinism(db_session):
    """
    Insert 3 ILE entries directly with identical posting_timestamp.
    Verify ordering by entry_no is stable (ILG-{timestamp}-{uuid}).
    Final balance must equal sum of all net_qty values consistently.
    """
    ctx = await _make_tenant(db_session, "t10")
    product = await _make_product(db_session, ctx)
    ilg = InventoryLedgerEngine(db_session, ctx)

    # Ensure location nodes exist
    wh = f"WH-SLT-T10-{uuid.uuid4().hex[:6]}"
    shared_ts = datetime(2026, 8, 10, 12, 0, 0, tzinfo=timezone.utc)

    # Ensure WH location node exists BEFORE adding ILE entries referencing it
    node_res = await db_session.execute(
        select(InventoryLocationNode.id).where(InventoryLocationNode.id == wh)
    )
    if not node_res.scalar():
        db_session.add(InventoryLocationNode(
            id=wh, uuid=str(uuid.uuid4()), code=wh[:50], name=wh[:200],
            location_type="WAREHOUSE",
            company_id=ctx.company_id, branch_id=ctx.branch_id,
        ))
        await db_session.flush()

    run_id = uuid.uuid4().hex[:6]
    for i, qty in enumerate([10, 5, 3], start=1):
        entry = InventoryLedgerEntry(
            id=f"ILE-DT10-{run_id}-{i}",
            uuid=str(uuid.uuid4()),
            entry_no=f"ILG-TEST10-{run_id}-{i:04d}",
            transaction_id=f"TX-T10-{run_id}-{i}",
            product_id=product.id,
            sku=product.sku,
            quantity=Decimal(str(qty)),
            movement_type="PURCHASE",
            to_location_id=wh,
            from_location_id=None,
            posting_timestamp=shared_ts,
            company_id=ctx.company_id,
            branch_id=ctx.branch_id,
        )
        db_session.add(entry)

    await db_session.commit()

    # Balance = 10 + 5 + 3 = 18 regardless of ordering (all inbound)
    balance = await _balance_at(db_session, ctx, product.id, wh)
    assert balance == 18.0, f"Expected 18, got {balance}"

    # Verify order is stable: entry_no ILG-TEST10-{run_id}-0001 < 0002 < 0003
    rows = await _ile_rows(db_session, ctx, product.id)
    entry_nos = [r.entry_no for r in rows if r.entry_no.startswith(f"ILG-TEST10-{run_id}-")]
    assert entry_nos == sorted(entry_nos), f"entry_no ordering not deterministic: {entry_nos}"


# ─────────────────────────────────────────────────────────────────────────────
# Test 11 — Tenant / company isolation
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_slt_11_tenant_isolation(db_session):
    """
    Tenant A: Purchase 50 units of product PA.
    Tenant B: Purchase 30 units of product PB.
    Tenant A balance must be 50, unaffected by Tenant B.
    Tenant B balance must be 30, unaffected by Tenant A.
    """
    ctx_a = await _make_tenant(db_session, "t11a")
    ctx_b = await _make_tenant(db_session, "t11b")

    pa = await _make_product(db_session, ctx_a, code_suffix="t11a")
    db_session.add(pa)

    active_tenant_ctx.set(ctx_b)
    pb = await _make_product(db_session, ctx_b, code_suffix="t11b")
    db_session.add(pb)
    await db_session.flush()

    active_tenant_ctx.set(ctx_a)
    cmd_a = InventoryCommandFacade(db_session, ctx_a)
    await cmd_a.receive_purchase(
        grn_id="GRN-A11", grn_no="GRN-A11",
        items=[{"product_id": pa.id, "quantity": 50}], warehouse="WH-A11",
    )

    active_tenant_ctx.set(ctx_b)
    cmd_b = InventoryCommandFacade(db_session, ctx_b)
    await cmd_b.receive_purchase(
        grn_id="GRN-B11", grn_no="GRN-B11",
        items=[{"product_id": pb.id, "quantity": 30}], warehouse="WH-B11",
    )
    await db_session.commit()

    bal_a = await _balance_at(db_session, ctx_a, pa.id)
    bal_b = await _balance_at(db_session, ctx_b, pb.id)

    assert bal_a == 50.0, f"Tenant A expected 50, got {bal_a}"
    assert bal_b == 30.0, f"Tenant B expected 30, got {bal_b}"

    # Cross-tenant leak check: no ILE rows for pa in ctx_b
    cross_stmt = select(func.count(InventoryLedgerEntry.id)).where(
        InventoryLedgerEntry.product_id == pa.id,
        InventoryLedgerEntry.company_id == ctx_b.company_id,
    )
    cross_res = await db_session.execute(cross_stmt)
    assert cross_res.scalar() == 0, "Tenant A ILE rows leaked into Tenant B!"


# ─────────────────────────────────────────────────────────────────────────────
# Test 12 — Location isolation
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_slt_12_location_isolation(db_session):
    """
    Same product, two locations.
    WH-STORE-A: Purchase 20
    WH-STORE-B: Purchase 15

    Verify:
      balance at STORE-A = 20
      balance at STORE-B = 15
      network balance = 35
    """
    ctx = await _make_tenant(db_session, "t12")
    product = await _make_product(db_session, ctx)
    cmd = InventoryCommandFacade(db_session, ctx)

    await cmd.receive_purchase(
        grn_id="GRN-T12-A", grn_no="GRN-SLT-012-A",
        items=[{"product_id": product.id, "quantity": 20}], warehouse="WH-STORE-A-T12",
    )
    await cmd.receive_purchase(
        grn_id="GRN-T12-B", grn_no="GRN-SLT-012-B",
        items=[{"product_id": product.id, "quantity": 15}], warehouse="WH-STORE-B-T12",
    )
    await db_session.commit()

    bal_a = await _balance_at(db_session, ctx, product.id, "WH-STORE-A-T12")
    bal_b = await _balance_at(db_session, ctx, product.id, "WH-STORE-B-T12")
    network = await _balance_at(db_session, ctx, product.id)

    assert bal_a == 20.0, f"STORE-A expected 20, got {bal_a}"
    assert bal_b == 15.0, f"STORE-B expected 15, got {bal_b}"
    assert network == 35.0, f"Network expected 35, got {network}"


# ─────────────────────────────────────────────────────────────────────────────
# Test 13 — Enterprise customer / DC / store hierarchy
#            (Generic CHAIN-A scenario — no hardcoding)
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_slt_13_enterprise_chain_a_scenario(db_session):
    """
    Enterprise customer scenario using generic location nodes.

    Locations:
      CHAIN-A-DC       Distribution Centre
      CHAIN-A-STORE-01 Store 1
      CHAIN-A-STORE-02 Store 2

    Movements:
      SMRITI WH → CHAIN-A-DC     100 units (commercial dispatch / TRANSFER_OUT)
      CHAIN-A-DC → CHAIN-A-STORE-01  40 units (TRANSFER_OUT from DC to Store 1)
      CHAIN-A-DC → CHAIN-A-STORE-02  30 units (TRANSFER_OUT from DC to Store 2)

    Expected:
      CHAIN-A-DC      = 100 - 40 - 30 = 30
      CHAIN-A-STORE-01 = 40
      CHAIN-A-STORE-02 = 30

    Customer sell-through is NOT tracked here — no sell-through source exists.
    Commercial sale (SMRITI invoice) ≠ customer sell-through.
    """
    ctx = await _make_tenant(db_session, "t13")
    product = await _make_product(db_session, ctx)
    cmd = InventoryCommandFacade(db_session, ctx)

    WH = "SMRITI-WH-T13"
    DC = "CHAIN-A-DC-T13"
    S01 = "CHAIN-A-STORE-01-T13"
    S02 = "CHAIN-A-STORE-02-T13"

    # SMRITI receives goods into its own warehouse
    await cmd.receive_purchase(
        grn_id="GRN-T13", grn_no="GRN-SLT-013",
        items=[{"product_id": product.id, "quantity": 100}], warehouse=WH,
    )

    # SMRITI dispatches to CHAIN-A DC (commercial transfer / delivery)
    await cmd.transfer_out(
        transfer_id="TR-T13-DC", transfer_no="TR-SLT-013-DC",
        items=[{"product_id": product.id, "quantity": 100}],
        source_warehouse=WH,
        target_warehouse=DC,
    )

    # CHAIN-A DC → STORE-01 (customer-side movement tracked in same ledger)
    await cmd.transfer_out(
        transfer_id="TR-T13-S01", transfer_no="TR-SLT-013-S01",
        items=[{"product_id": product.id, "quantity": 40}],
        source_warehouse=DC,
        target_warehouse=S01,
    )

    # CHAIN-A DC → STORE-02
    await cmd.transfer_out(
        transfer_id="TR-T13-S02", transfer_no="TR-SLT-013-S02",
        items=[{"product_id": product.id, "quantity": 30}],
        source_warehouse=DC,
        target_warehouse=S02,
    )
    await db_session.commit()

    smriti_wh_balance = await _balance_at(db_session, ctx, product.id, WH)
    dc_balance = await _balance_at(db_session, ctx, product.id, DC)
    s01_balance = await _balance_at(db_session, ctx, product.id, S01)
    s02_balance = await _balance_at(db_session, ctx, product.id, S02)

    # SMRITI WH: received 100, transferred all 100 out → 0
    assert smriti_wh_balance == 0.0, f"SMRITI WH expected 0, got {smriti_wh_balance}"
    # DC: received 100, dispatched 40+30=70 → 30
    assert dc_balance == 30.0, f"CHAIN-A DC expected 30, got {dc_balance}"
    assert s01_balance == 40.0, f"CHAIN-A STORE-01 expected 40, got {s01_balance}"
    assert s02_balance == 30.0, f"CHAIN-A STORE-02 expected 30, got {s02_balance}"

    # Customer sell-through is NOT available — verify no fabrication
    # (No additional ILE entries beyond the transfers we created)
    total_ile_count = await db_session.execute(
        select(func.count(InventoryLedgerEntry.id)).where(
            InventoryLedgerEntry.product_id == product.id,
            InventoryLedgerEntry.company_id == ctx.company_id,
        )
    )
    ile_count = total_ile_count.scalar()
    # 1 PURCHASE + 3 TRANSFER_OUT = 4 entries. No fabricated sell-through.
    assert ile_count == 4, (
        f"Expected exactly 4 ILE entries (1 purchase + 3 transfers), got {ile_count}. "
        "No sell-through data must be fabricated."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Test 14 — Customer isolation (CHAIN-A vs CHAIN-B)
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_slt_14_customer_chain_isolation(db_session):
    """
    CHAIN-A and CHAIN-B both receive the same SKU.
    Movements to CHAIN-A locations must not affect CHAIN-B balances.
    Uses location node naming to isolate (each chain has its own DC/store IDs).
    """
    ctx = await _make_tenant(db_session, "t14")
    product = await _make_product(db_session, ctx)
    cmd = InventoryCommandFacade(db_session, ctx)

    # Receive into SMRITI WH
    await cmd.receive_purchase(
        grn_id="GRN-T14", grn_no="GRN-SLT-014",
        items=[{"product_id": product.id, "quantity": 200}], warehouse="SMRITI-WH-T14",
    )

    # Dispatch to CHAIN-A
    await cmd.transfer_out(
        transfer_id="TR-T14-A", transfer_no="TR-SLT-014-A",
        items=[{"product_id": product.id, "quantity": 80}],
        source_warehouse="SMRITI-WH-T14",
        target_warehouse="CHAIN-A-DC-T14",
    )

    # Dispatch to CHAIN-B
    await cmd.transfer_out(
        transfer_id="TR-T14-B", transfer_no="TR-SLT-014-B",
        items=[{"product_id": product.id, "quantity": 60}],
        source_warehouse="SMRITI-WH-T14",
        target_warehouse="CHAIN-B-DC-T14",
    )
    await db_session.commit()

    chain_a_balance = await _balance_at(db_session, ctx, product.id, "CHAIN-A-DC-T14")
    chain_b_balance = await _balance_at(db_session, ctx, product.id, "CHAIN-B-DC-T14")

    assert chain_a_balance == 80.0, f"CHAIN-A expected 80, got {chain_a_balance}"
    assert chain_b_balance == 60.0, f"CHAIN-B expected 60, got {chain_b_balance}"


# ─────────────────────────────────────────────────────────────────────────────
# Test 15 — Ownership separation (COMPANY vs CONSIGNMENT)
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_slt_15_ownership_separation(db_session):
    """
    ILE supports ownership_type (COMPANY / CONSIGNMENT).
    Verify two ILE entries for same product/location differ by ownership_type.
    Physical location ≠ ownership — they are tracked independently.
    """
    ctx = await _make_tenant(db_session, "t15")
    product = await _make_product(db_session, ctx)
    ilg = InventoryLedgerEngine(db_session, ctx)

    wh = "WH-T15"
    # Ensure location node
    node_res = await db_session.execute(
        select(InventoryLocationNode.id).where(InventoryLocationNode.id == wh)
    )
    if not node_res.scalar():
        db_session.add(InventoryLocationNode(
            id=wh, uuid=str(uuid.uuid4()), code=wh, name=wh,
            location_type="WAREHOUSE",
            company_id=ctx.company_id, branch_id=ctx.branch_id,
        ))
        await db_session.flush()

    # COMPANY-owned goods received
    await ilg.post_ledger_entry(
        transaction_id="TX-T15-CO",
        from_location_id=None,
        to_location_id=wh,
        product_id=product.id,
        sku=product.sku,
        quantity=Decimal("50"),
        movement_type="PURCHASE",
        ownership_type="COMPANY",
    )

    # CONSIGNMENT goods received (same location, different owner)
    await ilg.post_ledger_entry(
        transaction_id="TX-T15-CN",
        from_location_id=None,
        to_location_id=wh,
        product_id=product.id,
        sku=product.sku,
        quantity=Decimal("20"),
        movement_type="PURCHASE",
        ownership_type="CONSIGNMENT",
    )
    await db_session.commit()

    # Total at location = 70 (ILG doesn't filter by ownership by default)
    total = await _balance_at(db_session, ctx, product.id, wh)
    assert total == 70.0, f"Total expected 70, got {total}"

    # Verify distinct ownership_type records exist
    co_stmt = select(func.count(InventoryLedgerEntry.id)).where(
        InventoryLedgerEntry.product_id == product.id,
        InventoryLedgerEntry.company_id == ctx.company_id,
        InventoryLedgerEntry.ownership_type == "COMPANY",
    )
    cn_stmt = select(func.count(InventoryLedgerEntry.id)).where(
        InventoryLedgerEntry.product_id == product.id,
        InventoryLedgerEntry.company_id == ctx.company_id,
        InventoryLedgerEntry.ownership_type == "CONSIGNMENT",
    )
    co_count = (await db_session.execute(co_stmt)).scalar()
    cn_count = (await db_session.execute(cn_stmt)).scalar()
    assert co_count == 1
    assert cn_count == 1


# ─────────────────────────────────────────────────────────────────────────────
# Test 16 — Empty ledger
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_slt_16_empty_ledger(db_session):
    """
    No movements → balance = 0. No fabricated rows.
    """
    ctx = await _make_tenant(db_session, "t16")
    product = await _make_product(db_session, ctx)
    await db_session.commit()

    balance = await _balance_at(db_session, ctx, product.id)
    assert balance == 0.0, f"Empty ledger balance expected 0, got {balance}"

    row_count = (await db_session.execute(
        select(func.count(InventoryLedgerEntry.id)).where(
            InventoryLedgerEntry.product_id == product.id,
        )
    )).scalar()
    assert row_count == 0


# ─────────────────────────────────────────────────────────────────────────────
# Test 17 — Reversal entry (LIM-006 compensating reversal)
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_slt_17_reversal_entry(db_session):
    """
    PURCHASE 10 → balance 10.
    Post reversal of PURCHASE (compensating entry swaps from/to).
    → balance 0.

    ILG post_reversal_entry swaps from_location ↔ to_location.
    Reversal ILE: from_location = WH, to_location = NULL → outbound → -10.
    Net = 10 - 10 = 0.
    """
    ctx = await _make_tenant(db_session, "t17")
    product = await _make_product(db_session, ctx)
    cmd = InventoryCommandFacade(db_session, ctx)
    ilg = InventoryLedgerEngine(db_session, ctx)

    entries = await cmd.receive_purchase(
        grn_id="GRN-T17", grn_no="GRN-SLT-017",
        items=[{"product_id": product.id, "quantity": 10}], warehouse="WH-T17",
    )
    await db_session.flush()
    original_entry_id = entries[0].id

    await ilg.post_reversal_entry(
        original_entry_id=original_entry_id,
        remarks="Test reversal — correcting erroneous GRN",
    )
    await db_session.commit()

    balance = await _balance_at(db_session, ctx, product.id, "WH-T17")
    assert balance == 0.0, f"Post-reversal balance expected 0, got {balance}"

    # Verify both entries exist (immutable ledger — no delete)
    row_count = (await db_session.execute(
        select(func.count(InventoryLedgerEntry.id)).where(
            InventoryLedgerEntry.product_id == product.id,
            InventoryLedgerEntry.company_id == ctx.company_id,
        )
    )).scalar()
    assert row_count == 2  # original + reversal


# ─────────────────────────────────────────────────────────────────────────────
# Test 18 — Commercial sale ≠ customer sell-through
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_slt_18_commercial_sale_not_sell_through(db_session):
    """
    Phase 5 requirement: commercial invoice does NOT imply customer sell-through.

    SMRITI → CHAIN-A: Tax Invoice 100 units (SALE movement in ILE).
    This records a commercial transaction.

    It does NOT imply:
      CHAIN-A → Consumer: 100 units sold.

    Verify: no sell-through ILE entries are fabricated from the commercial sale.
    Verify: CHAIN-A customer-site inventory (at CHAIN-A-DC) is tracked via transfers,
            NOT inferred from the invoice quantity.

    The commercial SALE exits stock from SMRITI WH.
    Customer receipt at CHAIN-A-DC must be an explicit ILE entry (e.g., via transfer).
    """
    ctx = await _make_tenant(db_session, "t18")
    product = await _make_product(db_session, ctx)
    cmd = InventoryCommandFacade(db_session, ctx)

    # SMRITI receives 100 units
    await cmd.receive_purchase(
        grn_id="GRN-T18", grn_no="GRN-SLT-018",
        items=[{"product_id": product.id, "quantity": 100}], warehouse="SMRITI-WH-T18",
    )

    # SMRITI raises Tax Invoice to CHAIN-A → SALE exits stock from SMRITI WH
    await cmd.issue_sale(
        invoice_id="INV-T18", invoice_no="INV-SLT-018",
        items=[{"product_id": product.id, "quantity": 100}],
        warehouse="SMRITI-WH-T18",
    )
    await db_session.commit()

    # SMRITI WH balance = 0 (stock left the warehouse via commercial sale)
    smriti_balance = await _balance_at(db_session, ctx, product.id, "SMRITI-WH-T18")
    assert smriti_balance == 0.0

    # CHAIN-A DC balance = 0 — NO stock was credited to the customer location.
    # The commercial sale only exits SMRITI's stock. Customer receipt
    # requires an explicit TRANSFER or receipt ILE entry.
    chain_a_balance = await _balance_at(db_session, ctx, product.id, "CHAIN-A-DC-T18")
    assert chain_a_balance == 0.0, (
        "CRITICAL: Commercial sale must NOT auto-credit customer location. "
        f"CHAIN-A DC balance should be 0, got {chain_a_balance}."
    )

    # Exactly 2 ILE entries: 1 PURCHASE + 1 SALE. No fabricated customer stock.
    ile_count = (await db_session.execute(
        select(func.count(InventoryLedgerEntry.id)).where(
            InventoryLedgerEntry.product_id == product.id,
            InventoryLedgerEntry.company_id == ctx.company_id,
        )
    )).scalar()
    assert ile_count == 2, (
        f"Expected exactly 2 ILE entries (1 purchase + 1 sale), got {ile_count}. "
        "No customer inventory must be fabricated from commercial invoice."
    )
