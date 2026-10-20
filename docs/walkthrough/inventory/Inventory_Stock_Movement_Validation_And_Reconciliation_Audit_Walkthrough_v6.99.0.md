<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.0
  Created      : 2026-10-20
  Modified     : 2026-10-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture & Operational Verification Walkthrough
-->

# Walkthrough: SMRITI Retail OS — Stock Movement Validation & Reconciliation Audit

**Document ID:** `WGP-INV-6.99.0`  
**Area:** Inventory & Supply Chain  
**Topic:** Stock Movement Lifecycle Invariant Validation, 9-State Discrepancy Taxonomy, Non-Destructive Reconciliation Engine, and Historical Correction Proposal  
**Version:** `6.99.0`  
**Date:** 2026-10-20  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  

---

## 1. Purpose

The objective of this engineering initiative is to guarantee that every inventory-affecting business transaction across SMRITI Retail OS—including purchase receipts (GRN), goods dispatches, B2B sales invoices, point-of-sale receipts, sales returns, purchase returns (debit notes), inter-warehouse transfers, stock adjustments, order cancellations, and transaction reversals—produces strictly valid, immutable, and reconcilable inventory movements.

This audit establishes mathematical invariants across the authoritative ledger (`stock_movements`, `product_batch_stocks`) and materialized cache (`products.stock`), eliminates silent inventory drift, exposes read-only reconciliation reporting across CLI, REST API, and web UI, and formulates non-destructive historical correction proposals with mandatory administrator approval gates.

---

## 2. Scope

1. **Transactional Invariant Definition:**
   Implementation of the canonical inventory invariant formula:
   $$\text{Expected Closing On-Hand} = \text{Opening} + \text{Receipts} + \text{Sales Returns} + \text{Transfer In} + \text{Pos Adjustments} - \text{Dispatches} - \text{Purchase Returns} - \text{Transfer Out} - \text{Neg Adjustments} - \text{Damage}$$
2. **Defect Remediation:**
   - Surgical expansion of `INFLOW_MOVEMENT_TYPES` and `OUTFLOW_MOVEMENT_TYPES` in `stock_synchronizer.py` and `stock_acct_svc.py` to recognize `SALES_CANCEL`, `INWARD_INITIAL`, `OUTWARD_ECOM`, `ADJUSTMENT`, and `TRANSFER`.
   - Dynamic signed movement evaluation avoiding silent drop of signed adjustments or transfers.
   - Guarded opening stock synthesis preventing double-deduction of sales during legacy catalog balance sync.
   - Correction of `ProductBatchStock` attribute names (`batch_no` and `quantity`) and movement polarity in `UnifiedSalesLedgerService`.
   - Addition of batch stock mutation and `StockSynchronizer.sync_product_stock_cache` hooks in Goods Receipt Note (`goods_receipt.py`) receive and cancel lifecycles.
3. **Core Reconciliation Engine:**
   Creation of `StockReconciliationEngine` providing a 9-state discrepancy classification taxonomy:
   - `MISSING_MOVEMENT`
   - `DUPLICATE_MOVEMENT`
   - `INCORRECT_QUANTITY`
   - `WRONG_WAREHOUSE_OR_COMPANY`
   - `VARIANT_MISMATCH`
   - `FAILED_REVERSAL`
   - `NEGATIVE_STOCK`
   - `CACHE_MISMATCH`
   - `UNEXPLAINED_VARIANCE`
4. **Delivery Channels:**
   - **CLI:** `smriti stock reconcile` and `smriti stock proposal` in `app/cli/commands/stock_cmd.py`.
   - **REST API:** `GET /api/v1/inventory/reconciliation` and `GET /api/v1/inventory/reconciliation/correction-proposal` in `app/api/v1/inventory.py`.
   - **Web UI:** `StockReconciliationAuditModal.tsx` launched from `StockLedgerTab.tsx`.
5. **Automated Testing:**
   14-scenario operational test suite covering all mandatory transaction invariants and failure modes in `backend/app/tests/test_stock_movement_reconciliation_audit.py`.

---

## 3. Files Created

| File Path | Description |
|---|---|
| `backend/app/services/stock_reconciliation_engine.py` | Authoritative stock reconciliation and invariant audit engine with 9-state discrepancy taxonomy and proposal generator |
| `backend/app/cli/commands/stock_cmd.py` | Unified SMRITI CLI command for running stock reconciliation and historical correction proposals |
| `src/components/inventory/StockReconciliationAuditModal.tsx` | Interactive React diagnostic modal featuring KPI cards, invariant breakdown table, filter bar, and proposal viewer |
| `backend/app/tests/test_stock_movement_reconciliation_audit.py` | 14-scenario automated test suite validating all mandatory operational transaction invariants |
| `docs/walkthrough/inventory/Inventory_Stock_Movement_Validation_And_Reconciliation_Audit_Walkthrough_v6.99.0.md` | This comprehensive WGP walkthrough document |

---

## 4. Files Modified

| File Path | Changes Applied |
|---|---|
| `backend/app/services/stock_synchronizer.py` | Expanded movement sets; implemented signed adjustments/transfers; guarded opening stock synthesis; updated header to v6.99.0 |
| `backend/app/services/sales_ledger_svc.py` | Fixed `ProductBatchStock` columns (`batch_no`, `quantity`); standard positive quantity for `OUTWARD_SALE`; added `sync_product_stock_cache` hooks; updated header to v6.99.0 |
| `backend/app/services/lifecycle/handlers/goods_receipt.py` | Added `ProductBatchStock` mutation and `StockSynchronizer.sync_product_stock_cache` triggers on GRN receive and cancel; updated header to v6.99.0 |
| `backend/app/api/v1/inventory.py` | Exposed `GET /reconciliation` and `GET /reconciliation/correction-proposal` endpoints; updated header to v6.99.0 |
| `backend/app/cli/main.py` | Registered `stock_cmd` subparser in unified CLI dispatcher |
| `src/components/StockLedgerTab.tsx` | Added top action header bar and integrated `StockReconciliationAuditModal` button |
| `docs/walkthrough/README.md` | Appended walkthrough to the master index table |
| `docs/walkthrough/CONSOLIDATED_WALKTHROUGHS.md` | Appended walkthrough entry |
| `CHANGELOG.md` | Documented version 6.99.0 stock movement reconciliation release |

---

## 5. Architecture Decisions

### ADR-INV-20261020-01: Dual-Tier Source of Truth (SSOT)
- **Batch-Tracked Inventory:** When active `ProductBatchStock` records exist for a product, the authoritative physical on-hand quantity is $\sum (\text{quantity} - \text{damaged\_quantity})$ locked via `SELECT ... FOR UPDATE`.
- **Movement-Tracked Inventory:** For unbatched items, the authoritative ledger is `stock_movements`, where net stock is computed strictly by invariant summation.
- **Materialized Cache Protection:** The `products.stock` column is strictly a read-only materialized cache aggregate. Direct SQL mutations bypassing `StockSynchronizer` are blocked.

### ADR-INV-20261020-02: Non-Destructive Read-Only Reconciliation & Historical Safety
- Live reconciliation runs in strictly read-only mode without mutating the database.
- Discrepancies generate structured proposals with audit justification, source reference, and before/after values.
- Automated silent overwriting or fabrication of historical stock movements is strictly prohibited; all historical correction proposals require explicit human administrator approval.

---

## 6. Design Rationale

1. **Why expand movement types rather than creating a new ledger?**
   Creating an ad-hoc secondary ledger causes data fragmentation and split-brain states. Expanding `INFLOW_MOVEMENT_TYPES` and `OUTFLOW_MOVEMENT_TYPES` preserves historical integrity while properly categorizing live events (such as `SALES_CANCEL` and `INWARD_INITIAL`).
2. **Why preserve signed adjustment handling?**
   Legacy stock adjustment endpoints in `inventory.py` record adjustments using a single movement type (`ADJUSTMENT`) with positive or negative signs. By checking `qty_val` dynamically, both unified signed adjustments and explicit directional movement types (`ADJUSTMENT_IN`/`ADJUSTMENT_OUT`) reconcile flawlessly.
3. **Why guard opening stock synthesis?**
   If an unledgered product had an initial catalog stock of 50 and subsequently suffered a sale of 2, synthesizing opening stock as `product.stock` (48) would result in a computed ledger of $48 - 2 = 46$ (2 units of silent drift). Factoring in net outflows:
   $$\text{Initial Opening Qty} = \text{product.stock} + \sum \text{outflows} - \sum \text{inflows} = 48 + 2 - 0 = 50$$
   The resulting calculation $50 - 2 = 48$ maintains exact parity with catalog reality.

---

## 7. Implementation Summary

1. **Reconciliation Engine:**
   Iterates through candidate products within tenant isolation boundary (`company_id`), calculates the 10 components of the invariant formula, performs cross-checks against batch stock and cached values, flags tenant boundary breaches and duplicate idempotency violations, and categorizes any divergence into the 9-state taxonomy.
2. **Correction Proposal Formulation:**
   Computes required delta adjustments and proposed after-quantities, tags them with `manual_approval_required = True` and status `PROPOSED_READ_ONLY`, and outputs clean JSON or CLI text.
3. **CLI Integration:**
   `smriti stock reconcile` runs instant terminal audits; `smriti stock proposal` produces structured proposed remediation plans.
4. **Interactive UI:**
   `StockReconciliationAuditModal.tsx` provides store managers and warehouse controllers with a visual diagnostic workspace complete with drill-down and filter capabilities.

---

## 8. Tests Executed

The 14 mandatory operational test scenarios in `backend/app/tests/test_stock_movement_reconciliation_audit.py` were executed via pytest:

1. `test_01_purchase_receipt_increases_stock_once`: Verifies GRN receipt increments stock once and prevents duplicate inward movements.
2. `test_02_completed_sale_decreases_stock_once`: Verifies outward sale decrements stock once with `OUTWARD_SALE`.
3. `test_03_purchase_order_without_receipt_does_not_affect_stock`: Confirms confirmed PO creates zero movements.
4. `test_04_sales_order_without_dispatch_does_not_decrease_stock`: Confirms draft/pending order creates zero movements.
5. `test_05_sales_and_purchase_returns_correct_directions`: Verifies sales returns increase stock and purchase returns decrease stock.
6. `test_06_cancelled_transactions_and_reversals_restore_balance`: Verifies invoice cancellation posts `SALES_CANCEL` and restores stock without double reversal.
7. `test_07_warehouse_transfers_balance_across_locations`: Confirms transfer dispatch decrements source WH and transfer receipt increments destination WH with zero net company drift.
8. `test_08_duplicate_api_requests_do_not_duplicate_movements`: Validates idempotency token protection against duplicate movement creation.
9. `test_09_variants_cannot_affect_wrong_item`: Confirms variant movement updates only targeted `item_variant_id`.
10. `test_10_cross_company_and_warehouse_isolation`: Confirms tenant isolation prevents cross-tenant movement leakage.
11. `test_11_opening_stock_and_adjustments_reconciliation`: Confirms opening stock + positive adjustment - negative adjustment reconciles.
12. `test_12_negative_stock_policy_enforcement`: Confirms FEFO allocation blocks overselling with `HTTPException(400)`.
13. `test_13_ledger_cached_balance_and_report_reconcile`: Validates reconciliation report accuracy and discrepancy detection.
14. `test_14_failed_transactions_rollback_atomically`: Confirms failed database transactions roll back atomically without orphan stock movements.

---

## 9. Verification Results

All automated tests passed with zero failures:
- **Test Suite:** `backend/app/tests/test_stock_movement_reconciliation_audit.py`
- **Scenarios Checked:** 14/14 Green
- **Frontend Typecheck:** `npm run lint` (`tsc --noEmit`) returned exit code 0 across the entire workspace.
- **CLI Invariant Verification:** `smriti stock reconcile` and `smriti stock proposal` executed successfully with formatted output.

---

## 10. Known Limitations

- Real-time physical warehouse count reconciliation requires physical barcode scanning input; the current reconciliation engine detects ledger and cache drift, but physical shelf discrepancies must be initiated via Physical Stock Take / Wave Audit workflows.
- Serialized item tracking (individual IMEI/RFID numbers) is tracked in batch/serial mapping tables; serialized tracking validation requires the item to have `tracking_mode == 'Serial'`.

---

## 11. Future Work

- **Wave Audit Barcode Integration:** Hook `StockReconciliationAuditModal` into mobile RFID handheld scanners for continuous ambient shelf audits.
- **Automated Compensating Batch Creation:** Provide an administrator-authorized one-click action to execute approved proposals from `HistoricalCorrectionPlan`.

---

## 12. Related ADRs

- `ADR-004`: Unified PostgreSQL Datastore Migration
- `ADR-011`: Strangler-Fig Backend Consolidation
- `ADR-INV-20260925-01`: Canonical Dual-Key Product Resolution Policy
- `ADR-INV-20261020-01`: Dual-Tier Source of Truth (SSOT) Stock Invariants

---

## 13. Related RFCs

- `RFC-INV-001`: Immutable Stock Movement Ledger Architecture
- `RFC-WMS-004`: Inter-Branch and Inter-Warehouse Transfer Protocol
- `RFC-AUD-009`: Automated Inventory Invariant Reconciliation and Non-Destructive Remediation
