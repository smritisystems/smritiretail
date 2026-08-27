"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.35.0
Created      : 2026-08-28
Modified     : 2026-08-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITI Reporting & BI Engine — Phase 3 Inventory State & Audit Lineage Test Suite.
Verifies:
- Invariant 6: Bounded inventory state calculation without unbounded ledger replay.
- Invariant 7: Immutable document trace for every aggregate number.
"""

import pytest
from datetime import date
from decimal import Decimal

from app.core.inventory_snapshot_engine import (
    InventorySnapshotEngine,
    InventorySnapshotRecord,
    StockMovementDelta,
    InventoryStateMode,
)
from app.core.audit_lineage import (
    AuditLineageEngine,
    DrillDownLevel,
    AuditLineageTrace,
)


# ---------------------------------------------------------------------------
# Test 1: 3-Tier Inventory State & Snapshot Engine
# ---------------------------------------------------------------------------

def test_inventory_snapshot_exact_date_match():
    """Verify exact snapshot match returns frozen balance without delta aggregation."""
    snapshot = InventorySnapshotRecord(
        snapshot_id="SNAP-2026-07",
        company_id="COMP-001",
        branch_id="BR-MAIN",
        item_code="SKU-JEANS-01",
        period_end_date=date(2026, 7, 31),
        closing_stock_qty=Decimal("150.00"),
        unit_landed_cost=Decimal("800.00"),
        valuation_amount=Decimal("120000.00"),
        is_frozen=True,
        integrity_hash="HASH123456",
    )

    state = InventorySnapshotEngine.compute_as_of_stock(
        item_code="SKU-JEANS-01",
        as_of_date=date(2026, 7, 31),
        latest_prior_snapshot=snapshot,
        delta_movements=[]
    )

    assert state.state_mode == InventoryStateMode.EXACT_SNAPSHOT
    assert state.calculated_stock_qty == Decimal("150.00")
    assert state.total_valuation_amt == Decimal("120000.00")
    assert state.delta_movements_count == 0
    assert state.base_snapshot_id == "SNAP-2026-07"


def test_inventory_snapshot_derived_state():
    """Verify stock calculation from base snapshot + incremental delta movements."""
    snapshot = InventorySnapshotRecord(
        snapshot_id="SNAP-2026-07",
        company_id="COMP-001",
        branch_id="BR-MAIN",
        item_code="SKU-SHIRT-01",
        period_end_date=date(2026, 7, 31),
        closing_stock_qty=Decimal("100.00"),
        unit_landed_cost=Decimal("500.00"),
        valuation_amount=Decimal("50000.00"),
        is_frozen=True,
        integrity_hash="HASH7890",
    )

    deltas = [
        StockMovementDelta(
            movement_id="MOV-01",
            date=date(2026, 8, 5),
            item_code="SKU-SHIRT-01",
            inward_qty=Decimal("20.00")
        ),
        StockMovementDelta(
            movement_id="MOV-02",
            date=date(2026, 8, 12),
            item_code="SKU-SHIRT-01",
            outward_qty=Decimal("15.00")
        ),
        StockMovementDelta(
            movement_id="MOV-03",
            date=date(2026, 8, 20),
            item_code="SKU-SHIRT-01",
            adjustment_qty=Decimal("5.00")
        ),
    ]

    state = InventorySnapshotEngine.compute_as_of_stock(
        item_code="SKU-SHIRT-01",
        as_of_date=date(2026, 8, 28),
        latest_prior_snapshot=snapshot,
        delta_movements=deltas
    )

    # 100 base + 20 in - 15 out + 5 adj = 110 qty @ 500 = 55,000.00
    assert state.state_mode == InventoryStateMode.DERIVED_FROM_SNAPSHOT
    assert state.calculated_stock_qty == Decimal("110.00")
    assert state.total_valuation_amt == Decimal("55000.00")
    assert state.delta_movements_count == 3
    assert state.base_snapshot_id == "SNAP-2026-07"


def test_inventory_snapshot_integrity_hash():
    """Verify cryptographic snapshot integrity hash is deterministic."""
    hash1 = InventorySnapshotEngine.generate_snapshot_hash(
        company_id="COMP-001",
        branch_id="BR-MAIN",
        period_end_date=date(2026, 8, 28),
        item_code="SKU-01",
        closing_qty=Decimal("100.00"),
        valuation_amt=Decimal("50000.00")
    )
    hash2 = InventorySnapshotEngine.generate_snapshot_hash(
        company_id="COMP-001",
        branch_id="BR-MAIN",
        period_end_date=date(2026, 8, 28),
        item_code="SKU-01",
        closing_qty=Decimal("100.00"),
        valuation_amt=Decimal("50000.00")
    )
    assert len(hash1) == 24
    assert hash1 == hash2


# ---------------------------------------------------------------------------
# Test 2: Universal Drill-Down Pipeline & Audit Lineage
# ---------------------------------------------------------------------------

def test_drilldown_audit_lineage_trace_creation():
    """Verify drill-down trace retains context filters, source documents, and audit hash."""
    trace = AuditLineageEngine.create_drilldown_trace(
        source_report_id="RPT-SAL-001",
        current_level=DrillDownLevel.LEVEL_1_STUDIO_SUMMARY,
        target_level=DrillDownLevel.LEVEL_4_DOCUMENT_AUDIT,
        context_filters={"branch_id": "BR-01", "date": "2026-08-28"},
        source_document_ids=["INV-2026-001", "INV-2026-002"],
        parent_trace_id=None
    )

    assert trace.trace_id.startswith("TRC-")
    assert trace.source_report_id == "RPT-SAL-001"
    assert trace.current_level == DrillDownLevel.LEVEL_1_STUDIO_SUMMARY
    assert trace.target_level == DrillDownLevel.LEVEL_4_DOCUMENT_AUDIT
    assert trace.target_route == "/sales/invoice-detail"
    assert trace.source_document_ids == ["INV-2026-001", "INV-2026-002"]
    assert len(trace.audit_event_hash) == 24
