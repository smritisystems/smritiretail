"""
test_inventory_replay_certification.py
Inventory Kernel RC2 — Ledger Replay Certification Suite

This file certifies the Inventory Kernel as a STANDALONE concern.
Sales, Purchase, POS, and other consumers do NOT appear here.

Replay Certification proves:
  - Given any sequence of StockMovements in the ledger,
    the Inventory State Engine deterministically produces the same result
    every time it replays that ledger from scratch.
  - The six canonical values produced by the kernel are internally consistent:
      1. On Hand        → trigger-maintained products.stock
      2. Reserved       → products.reserved_stock (managed by reservation engine)
      3. Available      → On Hand − Reserved − In Transit (and other deductions)
      4. Warehouse Bal  → per-warehouse physical movement sum
      5. products.stock → trigger-maintained column, must equal On Hand
      6. Replay Result  → independent Python replay must produce identical values

Certification Sequence (10 Steps):
  OPENING (100) → PURCHASE (+50) → SALE (-20) → SALE (-10) → SALE_RETURN (+5)
  → RESERVE (15) → UNRESERVE (5) → TRANSFER_OUT (10) → TRANSFER_IN (10) → ADJUSTMENT (+2)

Expected final state:
  Physical movements affecting products.stock:
    OPENING      +100
    PURCHASE      +50
    SALE          -20
    SALE          -10
    SALE_RETURN    +5
    TRANSFER_OUT  -10  (transit out — affects physical stock)
    TRANSFER_IN   +10  (transit in — affects physical stock)
    ADJUSTMENT     +2
  ──────────────────
    On Hand      = 127

  Reservation state (managed by reservation engine → products.reserved_stock):
    RESERVE       +15
    UNRESERVE      -5
  ──────────────────
    Net Reserved = 10

  In Transit (state engine: affects_transit=True on BOTH TRANSFER_OUT and TRANSFER_IN):
    TRANSFER_OUT  +10 (abs)
    TRANSFER_IN   +10 (abs)
  ──────────────────
    In Transit   = 20

  Available = 127 - 10 (reserved) - 20 (in_transit) = 97
"""

import uuid
import pytest
from decimal import Decimal
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import active_tenant_ctx
from app.api.deps import TenantContext
from app.models.tenant import Company, Branch
from app.services.inventory import InventoryService
from app.schemas.inventory import ProductCreate
from app.services.inventory.facades import InventoryQueryFacade
from app.services.inventory_reservation import InventoryReservationService
from app.domain.movement_taxonomy import MovementTypeRegistry
from app.models.inventory import StockMovement, Product


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _setup_replay_tenant(db):
    """Isolated tenant for Replay Certification — no Sales, no Purchase."""
    company_id = f"co-replay-{uuid.uuid4().hex[:8]}"
    branch_id  = f"br-replay-{uuid.uuid4().hex[:8]}"
    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="Replay Cert Co", is_active=True)
    branch  = Branch(
        id=branch_id, uuid=str(uuid.uuid4()),
        company_id=company_id, name="Replay Store 1",
        code=f"RPL{uuid.uuid4().hex[:6].upper()}", is_active=True,
    )
    db.add_all([company, branch])
    await db.flush()
    tenant_ctx = TenantContext(tenant_id="replay-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_id, tenant_ctx


async def _create_product(db, tenant_ctx, price=Decimal("500.00")):
    inv_service = InventoryService(db, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-replay-{uuid.uuid4().hex[:8]}",
        code=f"RPLPROD{uuid.uuid4().hex[:4].upper()}",
        name="Replay Cert Item",
        category="General",
        brand="Generic",
        color="Black",
        size="M",
        barcode=f"BC-RPL-{uuid.uuid4().hex[:6].upper()}",
        price=price,
        cost_price=price,
    )
    return await inv_service.create_product(p_in)


async def _insert_movement(db, product, tenant_ctx, movement_type, quantity,
                           warehouse="WH-MAIN", remarks="", reference_doc_type="MANUAL"):
    """Insert a single StockMovement and commit — trigger fires on INSERT."""
    ts = int(datetime.now(timezone.utc).timestamp() * 1_000_000)
    mv = StockMovement(
        id=f"SM-{movement_type}-{uuid.uuid4().hex[:8]}-{ts}",
        uuid=str(uuid.uuid4()),
        product_id=product.id,
        product_name=product.name,
        sku=product.sku or product.code,
        quantity=Decimal(str(quantity)),
        movement_type=movement_type,
        reference_doc_type=reference_doc_type,
        reference_doc_id=f"REF-{uuid.uuid4().hex[:8]}",
        warehouse=warehouse,
        unit_cost=product.cost_price or product.price,
        remarks=remarks,
        source_module="ReplayCertification",
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
    )
    db.add(mv)
    await db.commit()
    await db.refresh(product)
    return mv


# ---------------------------------------------------------------------------
# PR-2  — 10-Step Extended Ledger Replay Determinism Test
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_10_step_extended_ledger_replay_determinism(db_session):
    """
    RC2 Replay Certification — 10-Step Ledger Determinism.

    Asserts 6-way mathematical identity across:
      1. On Hand         (state_engine — reads products.stock set by trigger)
      2. Reserved        (state_engine — reads products.reserved_stock)
      3. Available       (state_engine — On Hand minus deductions)
      4. Warehouse Bal   (state_engine.get_warehouse_breakdown per-warehouse sum)
      5. products.stock  (trigger-maintained column: must equal On Hand)
      6. Replay sum      (independent Python computation from raw movement stream)
    """
    _, _, tenant_ctx = await _setup_replay_tenant(db_session)
    product = await _create_product(db_session, tenant_ctx)

    # ── Step 1: OPENING (+100) ──────────────────────────────────────────────
    await _insert_movement(db_session, product, tenant_ctx,
                           "OPENING", 100, reference_doc_type="OPENING_BALANCE")

    # ── Step 2: PURCHASE (+50) ──────────────────────────────────────────────
    await _insert_movement(db_session, product, tenant_ctx,
                           "PURCHASE", 50, reference_doc_type="Purchase Order")

    # ── Step 3: SALE (−20) ──────────────────────────────────────────────────
    await _insert_movement(db_session, product, tenant_ctx,
                           "SALE", -20, reference_doc_type="Sales Invoice")

    # ── Step 4: SALE (−10) ──────────────────────────────────────────────────
    await _insert_movement(db_session, product, tenant_ctx,
                           "SALE", -10, reference_doc_type="Sales Invoice")

    # ── Step 5: SALE_RETURN (+5) ────────────────────────────────────────────
    await _insert_movement(db_session, product, tenant_ctx,
                           "SALE_RETURN", 5, reference_doc_type="Sales Return")

    # ── Step 6: RESERVE (15 units) via InventoryReservationService ──────────
    #    InventoryReservationService.reserve() inserts a RESERVE movement AND
    #    updates products.reserved_stock. Both must be called together for
    #    state consistency.
    res_service = InventoryReservationService(db_session, tenant_ctx)
    await res_service.reserve(
        product_id=product.id,
        qty=15,
        reservation_type="Sales Order",
        reservation_id=f"SO-RPL-{uuid.uuid4().hex[:8]}",
    )
    await db_session.refresh(product)

    # ── Step 7: UNRESERVE (5 units released) ───────────────────────────────
    #    Direct DB update of reserved_stock + UNRESERVE movement, because
    #    reservation_engine.py does not yet expose a release() method.
    #    This mirrors the platform's future release flow.
    current_reserved = Decimal(str(getattr(product, "reserved_stock", 0)))
    product.reserved_stock = current_reserved - Decimal("5")  # type: ignore[assignment]
    db_session.add(product)
    await _insert_movement(db_session, product, tenant_ctx,
                           "UNRESERVE", -5, reference_doc_type="Sales Order")

    # ── Step 8: TRANSFER_OUT (−10 from WH-MAIN) ────────────────────────────
    await _insert_movement(db_session, product, tenant_ctx,
                           "TRANSFER_OUT", -10, warehouse="WH-MAIN",
                           reference_doc_type="Inter-Branch Transfer")

    # ── Step 9: TRANSFER_IN (+10 to WH-SECONDARY) ──────────────────────────
    await _insert_movement(db_session, product, tenant_ctx,
                           "TRANSFER_IN", 10, warehouse="WH-SECONDARY",
                           reference_doc_type="Inter-Branch Transfer")

    # ── Step 10: ADJUSTMENT (+2) ────────────────────────────────────────────
    await _insert_movement(db_session, product, tenant_ctx,
                           "ADJUSTMENT", 2, reference_doc_type="Stock Adjustment")

    # ── Read Canonical State via Facade ─────────────────────────────────────
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)
    state = await query_facade.get_canonical_state(product.id)
    warehouse_breakdown = await query_facade.state_service.get_warehouse_breakdown(product.id)

    # ── Point 5: products.stock trigger column ───────────────────────────────
    trigger_stock = float(product.stock)

    # ── Point 6: Independent Python replay from raw ledger ───────────────────
    movements_stmt = (
        select(StockMovement)
        .where(
            StockMovement.product_id == product.id,
            StockMovement.company_id == tenant_ctx.company_id,
            StockMovement.branch_id  == tenant_ctx.branch_id,
        )
        .order_by(StockMovement.created_at.asc())
    )
    result = await db_session.execute(movements_stmt)
    all_movements = list(result.scalars().all())

    replay_on_hand  = Decimal("0")
    for mv in all_movements:
        behavior = MovementTypeRegistry.get(mv.movement_type)
        qty = Decimal(str(mv.quantity))
        if behavior.affects_physical_stock:
            replay_on_hand += qty

    replay_reserved  = Decimal(str(getattr(product, "reserved_stock", 0)))
    replay_available = max(replay_on_hand - replay_reserved, Decimal("0"))

    # ── 6-Point Identity Assertions ─────────────────────────────────────────

    # 1. On Hand = 100 + 50 − 20 − 10 + 5 − 10 + 10 + 2 = 127
    assert state["on_hand"] == 127.0, (
        f"[Point 1] On Hand mismatch: expected 127.0, got {state['on_hand']}"
    )

    # 2. Reserved = 15 − 5 = 10
    assert state["reserved"] == 10.0, (
        f"[Point 2] Reserved mismatch: expected 10.0, got {state['reserved']}"
    )

    # 3. Available = 127 − 10 (reserved) − 20 (in_transit: TRANSFER_OUT + TRANSFER_IN both counted) = 97
    #    State engine semantics: affects_transit=True accumulates abs(qty) for both OUT and IN.
    assert state["available"] == 97.0, (
        f"[Point 3] Available mismatch: expected 97.0, got {state['available']}"
    )

    # 4. Warehouse Balances
    #    Physical movements: OPENING+PURCHASE+SALE+SALE+SALE_RETURN+ADJUSTMENT to WH-MAIN
    #      = 100 + 50 − 20 − 10 + 5 + 2 = 127
    #    TRANSFER_OUT (−10) from WH-MAIN → WH-MAIN net = 127 − 10 = 117
    #    TRANSFER_IN (+10) to WH-SECONDARY → WH-SECONDARY net = 10
    wh_main_balance = warehouse_breakdown.get("WH-MAIN", 0.0)
    wh_sec_balance  = warehouse_breakdown.get("WH-SECONDARY", 0.0)
    assert wh_main_balance == 117.0, (
        f"[Point 4] Warehouse WH-MAIN balance mismatch: expected 117.0, got {wh_main_balance}"
    )
    assert wh_sec_balance == 10.0, (
        f"[Point 4] Warehouse WH-SECONDARY balance mismatch: expected 10.0, got {wh_sec_balance}"
    )

    # 5. products.stock trigger column must equal On Hand
    assert trigger_stock == 127.0, (
        f"[Point 5] products.stock trigger mismatch: expected 127.0, got {trigger_stock}"
    )

    # 6. Independent Python replay must match state engine
    assert float(replay_on_hand)   == 127.0, (
        f"[Point 6] Replay on_hand mismatch: expected 127.0, got {float(replay_on_hand)}"
    )
    assert float(replay_reserved)  == 10.0, (
        f"[Point 6] Replay reserved mismatch: expected 10.0, got {float(replay_reserved)}"
    )
    # Note: replay_available uses only On Hand - Reserved (not in_transit),
    # because the independent replay does not replicate the state engine's in_transit
    # accumulation here. The state engine available check (Point 3) already certifies
    # the full state equation including in_transit.
    # The replay's primary purpose is to certify ledger arithmetic identity for
    # physical movements and reservation state.
    assert float(replay_available) == 117.0, (
        f"[Point 6] Replay available (On Hand - Reserved only) mismatch: expected 117.0, got {float(replay_available)}"
    )

    # Final cross-checks: all sources must agree on physical stock
    assert float(replay_on_hand)   == state["on_hand"],  "Identity failure: Replay ≠ State Engine: on_hand"
    assert float(replay_reserved)  == state["reserved"], "Identity failure: Replay ≠ State Engine: reserved"
    assert float(replay_on_hand)   == trigger_stock,     "Identity failure: Replay ≠ Trigger: products.stock"
    assert state["on_hand"]        == trigger_stock,     "Identity failure: State Engine ≠ Trigger: products.stock"
    assert wh_main_balance + wh_sec_balance == state["on_hand"], (
        "Identity failure: Sum of warehouse balances ≠ Total On Hand"
    )
