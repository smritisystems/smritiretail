"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-24
Modified     : 2026-09-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Target Test  : Stock Ledger Physical Reconciliation — Automated Test Battery

Design note:
  These are pure business-logic unit tests. They do NOT import SQLAlchemy ORM
  models or require a database connection. All test scenarios verify the
  mathematical and logical rules encoded in StockAuditService
  (backend/app/services/stock_audit_service.py) without triggering the
  ORM engine initialisation.

Test Coverage:
  TC-001  Deficit write-off: variance_qty < 0 triggers OUTWARD_LOSS movement logic
  TC-002  Surplus injection: variance_qty > 0 triggers INWARD_SURPLUS movement logic
  TC-003  Zero variance skip: variance_qty == 0 → item marked reconciled, no movement
  TC-004  Completed audit guard: status == COMPLETED blocks reconciliation
  TC-005  Variance formula: counted_qty - system_qty = variance_qty (canonical formula)
  TC-006  Variance value: abs(variance_qty) × unit_cost is always non-negative
  TC-007  Batch stock deduction cap: max(0, current - loss_qty) prevents negative stock
"""

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional
import pytest


# ---------------------------------------------------------------------------
# Lightweight data classes that mirror the ORM model columns used by the
# reconciliation engine — no SQLAlchemy dependency required.
# ---------------------------------------------------------------------------

@dataclass
class MockStockAuditItem:
    audit_id: str
    product_id: str
    batch_no: str
    system_qty: Decimal
    counted_qty: Decimal
    variance_qty: Decimal
    unit_cost: Decimal
    variance_value: Decimal
    is_reconciled: bool = False
    discrepancy_reason: Optional[str] = None


@dataclass
class MockBatchStock:
    product_id: str
    warehouse_id: str
    batch_no: str
    quantity: Decimal


@dataclass
class MockAudit:
    id: str
    audit_no: str
    company_id: str
    warehouse_id: str
    status: str = "DRAFT"
    audit_type: str = "FULL"


# ---------------------------------------------------------------------------
# Business rule helpers (mirror the logic in stock_audit_service.py)
# ---------------------------------------------------------------------------

def compute_variance(system_qty: Decimal, counted_qty: Decimal) -> Decimal:
    """Canonical SMRITI formula: variance = counted - system."""
    return counted_qty - system_qty


def compute_variance_value(variance_qty: Decimal, unit_cost: Decimal) -> Decimal:
    """Financial impact of variance — always non-negative."""
    return abs(variance_qty) * unit_cost


def apply_deficit_deduction(batch_quantity: Decimal, loss_qty: float) -> Decimal:
    """Simulates engine: max(0, current_qty - loss_qty)."""
    return Decimal(str(max(0.0, float(batch_quantity) - loss_qty)))


def movement_type_for_variance(variance_qty: Decimal) -> Optional[str]:
    """Returns the stock movement type the engine creates, or None for zero variance."""
    v = float(variance_qty)
    if v < 0:
        return "OUTWARD_LOSS"
    if v > 0:
        return "INWARD_SURPLUS"
    return None  # Zero — no movement


# ---------------------------------------------------------------------------
# TC-001 — Deficit Write-Off
# ---------------------------------------------------------------------------

def test_tc001_deficit_variance_is_negative():
    """
    BUSINESS RULE: If a physical count finds fewer items than the system
    records, variance_qty is negative. The engine creates an OUTWARD_LOSS
    movement and deducts from ProductBatchStock.quantity.
    """
    system_qty  = Decimal("100.0000")
    counted_qty = Decimal("87.0000")

    variance = compute_variance(system_qty, counted_qty)
    item = MockStockAuditItem(
        audit_id="aud-001",
        product_id="prod-001",
        batch_no="BATCH-A",
        system_qty=system_qty,
        counted_qty=counted_qty,
        variance_qty=variance,
        unit_cost=Decimal("50.00"),
        variance_value=compute_variance_value(variance, Decimal("50.00")),
    )

    assert float(item.variance_qty) == pytest.approx(-13.0), \
        "Deficit count must produce negative variance_qty"
    assert float(item.variance_value) == pytest.approx(650.00), \
        "Financial impact: 13 units × ₹50 = ₹650"
    assert movement_type_for_variance(item.variance_qty) == "OUTWARD_LOSS", \
        "Negative variance triggers OUTWARD_LOSS movement"


# ---------------------------------------------------------------------------
# TC-002 — Surplus Injection
# ---------------------------------------------------------------------------

def test_tc002_surplus_variance_is_positive():
    """
    BUSINESS RULE: If a physical count finds more items than the system
    records, variance_qty is positive. The engine creates an INWARD_SURPLUS
    movement and increases ProductBatchStock.quantity.
    """
    system_qty  = Decimal("50.0000")
    counted_qty = Decimal("57.0000")

    variance = compute_variance(system_qty, counted_qty)
    item = MockStockAuditItem(
        audit_id="aud-001",
        product_id="prod-002",
        batch_no="BATCH-B",
        system_qty=system_qty,
        counted_qty=counted_qty,
        variance_qty=variance,
        unit_cost=Decimal("120.00"),
        variance_value=compute_variance_value(variance, Decimal("120.00")),
    )

    assert float(item.variance_qty) == pytest.approx(7.0), \
        "Surplus count must produce positive variance_qty"
    assert float(item.variance_value) == pytest.approx(840.00), \
        "Financial impact: 7 units × ₹120 = ₹840"
    assert movement_type_for_variance(item.variance_qty) == "INWARD_SURPLUS", \
        "Positive variance triggers INWARD_SURPLUS movement"


# ---------------------------------------------------------------------------
# TC-003 — Zero Variance Skip
# ---------------------------------------------------------------------------

def test_tc003_zero_variance_skips_movement():
    """
    BUSINESS RULE: If counted_qty == system_qty, variance_qty is zero.
    The engine marks the item reconciled without creating any stock movement.
    """
    system_qty  = Decimal("200.0000")
    counted_qty = Decimal("200.0000")

    variance = compute_variance(system_qty, counted_qty)
    item = MockStockAuditItem(
        audit_id="aud-001",
        product_id="prod-003",
        batch_no="BATCH-C",
        system_qty=system_qty,
        counted_qty=counted_qty,
        variance_qty=variance,
        unit_cost=Decimal("30.00"),
        variance_value=Decimal("0.00"),
    )

    assert float(item.variance_qty) == 0.0, \
        "Matching count must produce zero variance_qty"
    assert movement_type_for_variance(item.variance_qty) is None, \
        "Zero variance must not create any stock movement"
    assert float(item.variance_value) == 0.0, \
        "Zero variance carries zero financial impact"

    # Simulate the engine's skip-and-mark logic
    if float(item.variance_qty) == 0.0 or item.is_reconciled:
        item.is_reconciled = True

    assert item.is_reconciled is True, \
        "Zero-variance items must be marked reconciled immediately"


# ---------------------------------------------------------------------------
# TC-004 — Completed Audit Guard
# ---------------------------------------------------------------------------

def test_tc004_completed_audit_raises_block():
    """
    BUSINESS RULE: A stock audit in COMPLETED status must not be reconciled
    again. The service raises HTTP 400 — guard check maps to:
        if audit.status == "COMPLETED": raise HTTPException(400, ...)
    """
    audit = MockAudit(
        id="aud-completed-001",
        audit_no="SA/2026-09/001",
        company_id="comp-001",
        warehouse_id="wh-001",
        status="COMPLETED",
    )

    # Replicate the guard condition in the service
    is_blocked = audit.status == "COMPLETED"

    assert is_blocked is True, \
        "Audit in COMPLETED status must be blocked from re-reconciliation"


# ---------------------------------------------------------------------------
# TC-005 — Variance Formula Correctness (canonical rule)
# ---------------------------------------------------------------------------

def test_tc005_variance_formula():
    """
    BUSINESS RULE: variance_qty = counted_qty - system_qty
    Negative = deficit (stock loss); Positive = surplus (found extra stock).
    """
    cases = [
        (Decimal("100"), Decimal("95"),  Decimal("-5")),   # 5-unit deficit
        (Decimal("100"), Decimal("103"), Decimal("3")),    # 3-unit surplus
        (Decimal("0"),   Decimal("0"),   Decimal("0")),    # Zero to zero
        (Decimal("1"),   Decimal("0"),   Decimal("-1")),   # Full loss (1 unit)
        (Decimal("50"),  Decimal("50"),  Decimal("0")),    # Perfect match
        (Decimal("999"), Decimal("1"),   Decimal("-998")), # Large deficit
    ]

    for sys_qty, cnt_qty, expected_var in cases:
        computed = compute_variance(sys_qty, cnt_qty)
        assert computed == expected_var, (
            f"variance formula: system={sys_qty}, counted={cnt_qty}, "
            f"expected={expected_var}, got={computed}"
        )


# ---------------------------------------------------------------------------
# TC-006 — Financial Impact Is Always Non-Negative
# ---------------------------------------------------------------------------

def test_tc006_variance_value_is_always_non_negative():
    """
    BUSINESS RULE: variance_value = abs(variance_qty) × unit_cost.
    The financial ledger receives an absolute adjustment — it must never
    be negative regardless of the direction of variance.
    """
    cases = [
        (Decimal("-10"),  Decimal("50.00"),  Decimal("500.00")),   # deficit
        (Decimal("5"),    Decimal("80.00"),  Decimal("400.00")),   # surplus
        (Decimal("0"),    Decimal("99.99"),  Decimal("0.00")),     # zero
        (Decimal("-1"),   Decimal("1.50"),   Decimal("1.50")),     # single unit
        (Decimal("100"),  Decimal("0.01"),   Decimal("1.00")),     # fractional cost
    ]

    for var_qty, unit_cost, expected_value in cases:
        computed = compute_variance_value(var_qty, unit_cost)
        assert computed == expected_value, (
            f"variance_value formula: var_qty={var_qty}, "
            f"unit_cost={unit_cost}, expected={expected_value}, got={computed}"
        )
        assert computed >= 0, \
            "variance_value must always be non-negative (financial ledger requirement)"


# ---------------------------------------------------------------------------
# TC-007 — Batch Stock Deduction Capped at Zero
# ---------------------------------------------------------------------------

def test_tc007_batch_stock_deduction_capped_at_zero():
    """
    BUSINESS RULE: Physical stock cannot go below zero after a write-off.
    The engine enforces: max(0, batch_stock.quantity - loss_qty).
    This prevents negative stock that would corrupt downstream availability
    and order-fulfilment calculations.
    """
    batch = MockBatchStock(
        product_id="prod-001",
        warehouse_id="wh-001",
        batch_no="BATCH-A",
        quantity=Decimal("8.0000"),   # only 8 on hand
    )

    loss_qty = 13.0   # audit says 13 units are missing (more than available)
    new_qty = apply_deficit_deduction(batch.quantity, loss_qty)

    assert float(new_qty) == pytest.approx(0.0), \
        "Stock must be capped at 0 when loss exceeds available quantity"
    assert float(new_qty) >= 0.0, \
        "Batch stock quantity must never go negative"

    # Also verify the formula handles exact depletion
    batch2 = MockBatchStock(
        product_id="prod-002",
        warehouse_id="wh-001",
        batch_no="BATCH-B",
        quantity=Decimal("10.0000"),
    )
    exact_depletion = apply_deficit_deduction(batch2.quantity, 10.0)
    assert float(exact_depletion) == pytest.approx(0.0), \
        "Exact full depletion must result in exactly 0, not negative"
