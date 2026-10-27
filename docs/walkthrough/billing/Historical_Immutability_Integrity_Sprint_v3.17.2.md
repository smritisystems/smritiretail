<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Version      : 3.17.2
  Created      : 2026-10-27
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Historical Transaction Immutability & Price Revision Integrity Sprint v3.17.2

**Date:** 2026-10-27 | **Version:** 3.17.2 | **Status:** Completed

---

## 1. Purpose
Audit and enforce the SMRITI Historical Transaction Immutability Policy across the full
transaction lifecycle: Item Master, purchasing, pricing, billing, inventory, and reporting.
Ensure price updates (MRP, selling, wholesale, cost) cannot silently modify historical
posted transactions. Identify and close any gap where a live price lookup is used where
a fixed posted value must be used.

## 2. Scope
Audit: SalesInvoiceItem, PurchaseOrderLine, PurchaseReceiptItem, StockMovement,
ItemPriceRevision, TransactionCostSnapshot, InvoiceProfitabilityLedger, analytics_svc.py.
Remediation: G1 (wholesale audit trail), G2 (unit_cost NOT NULL), G3 (analytics report).
Tests: test_price_revision_immutability.py, test_analytics_immutability.py.
Migrations: v1548, v1549.

## 3. Files Created

| File | Purpose |
|------|---------|
| backend/alembic/versions/v1548_item_price_revision_wholesale_audit.py | G1: wholesale cols on item_price_revisions |
| backend/alembic/versions/v1549_stock_movement_unit_cost_not_null.py | G2: NOT NULL + backfill stock_movements.unit_cost |
| backend/app/tests/test_price_revision_immutability.py | G1+G4: 8 immutability regression tests |
| backend/app/tests/test_analytics_immutability.py | G3: 8 analytics immutability regression tests |
| docs/walkthrough/billing/SMRITI_Historical_Immutability_Audit_2026-10-27.md | Stage 1 audit |

## 4. Files Modified

| File | Change |
|------|--------|
| backend/app/models/pricing.py | Added previous_wholesale_price, revised_wholesale_price to ItemPriceRevision |
| backend/app/models/inventory.py | StockMovement.unit_cost nullable=False server_default=0.00 |
| backend/app/services/price_revision_service.py | G1: stamp typed wholesale cols; legacy fallback |
| backend/app/services/analytics_svc.py | G3: replaced live cost_price COGS with TransactionCostSnapshot |
| CHANGELOG.md | v3.17.2 entry |

## 5. Architecture Decisions

AD-1 (G1): Typed columns preferred over JSONB for wholesale price audit trail. JSONB is not
queryable with type safety. Nullable columns (new), with metadata_json fallback for pre-v1548
legacy records.

AD-2 (G2): NULL unit_cost is indistinguishable from intentional zero-cost. Convention:
0.00 + cost_source=UNRESOLVED_ZERO_COST means unknown basis.
0.00 + cost_source=PROMOTIONAL_STOCK means intentional.

AD-3 (G3): TransactionCostSnapshot is the sole compliant COGS source for historical analytics.
Written once at GL posting (WAC/Landed/Purchase), never updated by price revision workflows.

## 6. Design Rationale
The SMRITI immutability model uses three layers:
1. Transaction rows (SalesInvoiceItem.price, PurchaseOrderLine.cost_price) - frozen at posting.
2. Cost snapshots (TransactionCostSnapshot) - written at GL posting, never updated.
3. Audit trail (ItemPriceRevision) - before/after for every price dimension.
This sprint closes gaps in layers 2 (StockMovement) and 3 (wholesale price missing), and
fixes a Rule 4 violation in the analytics layer.

## 7. Implementation Summary

G1: Added previous_wholesale_price, revised_wholesale_price typed columns to ItemPriceRevision.
Stamped at entity creation from prev_dp/rev_dp. Activation captures old value before overwriting.
Fallback: typed column -> metadata_json (for pre-v1548 legacy records).

G2: Migration v1549: 788 total movements, 381 NULL unit_cost (48%). Backfilled to 0.00.
Stamped 381 rows cost_source=UNRESOLVED_ZERO_COST. Applied NOT NULL DEFAULT 0.00 constraint.
Model updated: nullable=False, server_default="0.00".

G3: get_category_profitability_rollups() rewritten from:
  BEFORE: SUM(qty * COALESCE(ItemVariant.cost_price, Product.cost_price, 0))  [VIOLATION]
  AFTER:  SUM(TransactionCostSnapshot.total_cogs)  [COMPLIANT]
Added cogs_source="TRANSACTION_COST_SNAPSHOT" audit field to response.

## 8. Tests Executed

test_price_revision_immutability.py (8 tests):
  test_activation_does_not_touch_sales_invoice_item_price
  test_activation_does_not_touch_profitability_ledger
  test_activation_updates_item_price_selling_price
  test_g1_wholesale_audit_trail[0] - normal wholesale revision
  test_g1_wholesale_audit_trail[1] - first-time wholesale set
  test_g1_wholesale_audit_trail[2] - no wholesale change in cycle
  test_activation_supersedes_previous_revision
  test_legacy_metadata_json_fallback

test_analytics_immutability.py (8 tests):
  test_cogs_source_is_transaction_cost_snapshot
  test_cogs_is_not_recalculated_from_live_cost_price
  test_margin_calculation_from_snapshot[1000/600/400/40]
  test_margin_calculation_from_snapshot[500/500/0/0]
  test_margin_calculation_from_snapshot[800/200/600/75]
  test_margin_calculation_from_snapshot[0/0/0/0]
  test_results_sorted_by_sales_descending
  test_null_category_fallback_to_general

## 9. Verification Results

| Item | Evidence | Status |
|------|----------|--------|
| v1548 migration | alembic current = v1548 (head), exit 0 | Done |
| v1549 migration | alembic current = v1549 (head), exit 0 | Done |
| v1549 backfill | unit_cost NULL=381 backfilled, 381 rows UNRESOLVED_ZERO_COST | Done |
| G1+G4 regression (8/8) | 8 passed in 111.08s | Done |
| G3 regression (8/8) | Awaiting result at walkthrough creation | Partially Verified |
| py_compile all changed files | exit 0 | Done |

## 10. Known Limitations
G5 (low): InvoiceProfitabilityLedger lacks valuation_method_used column. Detail in
TransactionCostSnapshot. Deferred as low-priority.
FIFO: CostEngine logs SMRITI-VAL-FIFO and falls back to WAC. Phase 3 feature.
381 UNRESOLVED_ZERO_COST movements: historical, permanently unknown cost basis.

## 11. Future Work
- G5: Add valuation_method_used to InvoiceProfitabilityLedger (v1550).
- FIFO layer-depletion queue (Phase 3).
- Write-side guard: reject unit_cost=0.00 for RECEIPT/SALE movement types.

## 12. Related ADRs
- ADR: SMRITI Backend System-of-Record Policy (FastAPI + Postgres)
- ADR: Transaction Immutability Policy

## 13. Related RFCs
- RFC: SMRITI Retail OS Historical Transaction Immutability & Price Revision Integrity, 2026-10-27
