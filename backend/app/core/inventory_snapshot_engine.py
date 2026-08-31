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

SMRITI Reporting & BI Engine — 3-Tier Inventory State & Snapshot Engine.
Enforces Invariant 6: Bounded historical valuation without full ledger replay.
"""

import hashlib
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class InventoryStateMode(str, Enum):
    LIVE = "LIVE"
    EXACT_SNAPSHOT = "EXACT_SNAPSHOT"
    DERIVED_FROM_SNAPSHOT = "DERIVED_FROM_SNAPSHOT"
    GENESIS_REPLAY = "GENESIS_REPLAY"


class InventorySnapshotRecord(BaseModel):
    snapshot_id: str
    company_id: str
    branch_id: str
    item_code: str
    barcode: Optional[str] = None
    period_end_date: date
    closing_stock_qty: Decimal
    unit_landed_cost: Decimal
    valuation_amount: Decimal
    is_frozen: bool = True
    integrity_hash: str


class StockMovementDelta(BaseModel):
    movement_id: str
    date: date
    item_code: str
    inward_qty: Decimal = Decimal("0")
    outward_qty: Decimal = Decimal("0")
    adjustment_qty: Decimal = Decimal("0")


class AsOfInventoryState(BaseModel):
    item_code: str
    as_of_date: date
    calculated_stock_qty: Decimal
    unit_landed_cost: Decimal
    total_valuation_amt: Decimal
    base_snapshot_id: Optional[str] = None
    delta_movements_count: int = 0
    state_mode: InventoryStateMode


class InventorySnapshotEngine:
    """Computes point-in-time inventory without unbounded transaction replays."""

    @classmethod
    def generate_snapshot_hash(
        cls,
        company_id: str,
        branch_id: str,
        period_end_date: date,
        item_code: str,
        closing_qty: Decimal,
        valuation_amt: Decimal
    ) -> str:
        """Generates cryptographic integrity hash for frozen audit snapshot."""
        payload = f"{company_id}|{branch_id}|{period_end_date.isoformat()}|{item_code}|{closing_qty}|{valuation_amt}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:24].upper()

    @classmethod
    def compute_as_of_stock(
        cls,
        item_code: str,
        as_of_date: date,
        latest_prior_snapshot: Optional[InventorySnapshotRecord] = None,
        delta_movements: Optional[List[StockMovementDelta]] = None,
        default_cost: Decimal = Decimal("0.00")
    ) -> AsOfInventoryState:
        """
        Reconstructs inventory point-in-time:
        Stock(T) = Snapshot(S) + SUM(Inward) - SUM(Outward) +/- SUM(Adjustments)
        """
        deltas = delta_movements or []
        
        # Scenario 1: Exact snapshot date match
        if latest_prior_snapshot and latest_prior_snapshot.period_end_date == as_of_date:
            return AsOfInventoryState(
                item_code=item_code,
                as_of_date=as_of_date,
                calculated_stock_qty=latest_prior_snapshot.closing_stock_qty,
                unit_landed_cost=latest_prior_snapshot.unit_landed_cost,
                total_valuation_amt=latest_prior_snapshot.valuation_amount,
                base_snapshot_id=latest_prior_snapshot.snapshot_id,
                delta_movements_count=0,
                state_mode=InventoryStateMode.EXACT_SNAPSHOT,
            )

        # Base starting quantity
        if latest_prior_snapshot:
            base_qty = latest_prior_snapshot.closing_stock_qty
            unit_cost = latest_prior_snapshot.unit_landed_cost
            base_snapshot_id = latest_prior_snapshot.snapshot_id
            mode = InventoryStateMode.DERIVED_FROM_SNAPSHOT
        else:
            base_qty = Decimal("0")
            unit_cost = default_cost
            base_snapshot_id = None
            mode = InventoryStateMode.GENESIS_REPLAY

        # Accumulate delta movements between snapshot date and as_of_date
        total_inward = sum(m.inward_qty for m in deltas)
        total_outward = sum(m.outward_qty for m in deltas)
        total_adj = sum(m.adjustment_qty for m in deltas)

        final_qty = base_qty + total_inward - total_outward + total_adj
        valuation_amt = (final_qty * unit_cost).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        return AsOfInventoryState(
            item_code=item_code,
            as_of_date=as_of_date,
            calculated_stock_qty=final_qty,
            unit_landed_cost=unit_cost,
            total_valuation_amt=valuation_amt,
            base_snapshot_id=base_snapshot_id,
            delta_movements_count=len(deltas),
            state_mode=mode,
        )
