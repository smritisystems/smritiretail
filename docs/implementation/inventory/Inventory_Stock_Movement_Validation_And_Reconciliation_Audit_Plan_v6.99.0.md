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
  Classification: Internal
-->

# SMRITI Retail OS — Stock Movement Validation & Reconciliation Audit Implementation Plan

## 1. Objective
Perform a comprehensive, fail-closed audit of inventory movements across every transaction lifecycle in SMRITI Retail OS (Purchase Orders, Goods Receipts / GRN, Sales Invoices, Sales Returns, Purchase Returns / Reversals, Warehouse Transfers, Stock Adjustments, Physical Count Audits, and POS Offline Synchronization). Establish immutable stock invariants, identify and rectify verified discrepancies and movement classification gaps, and build a high-performance read-only reconciliation reporting subsystem (API, CLI, and interactive UI) without corrupting existing historical stock data.

## 2. Business Motivation
In enterprise retail environments, discrepancy between physical stock, batch ledgers, immutable movement logs, and cached on-hand quantities leads to phantom stockouts, duplicate fulfillments, procurement over-ordering, and inaccurate financial valuations. SMRITI requires an authoritative, mathematical source of truth where the ledger (`stock_movements` and `product_batch_stocks`) governs all downstream read caches (`products.stock`), and any drift is immediately detectable, classifiable, and auditable.

## 3. Scope
- **Inspection & Analysis:** Complete review of database tables (`stock_movements`, `product_batch_stocks`, `products`, `warehouses`, `purchase_receipts`, `sales_invoices`, `sales_returns`, `stock_transfers`, `stock_audits`), schemas, and services.
- **Stock Invariant Definition:** Mathematical on-hand formulas and strict multi-tenant boundaries.
- **Defect Remediation:**
  - Movement classification harmonization in `StockSynchronizer` (`stock_synchronizer.py`) and `StockAccountingBoundaryService` (`stock_acct_svc.py`) to encompass `SALES_CANCEL`, `INWARD_INITIAL`, `OUTWARD_ECOM`, `ADJUSTMENT`, `TRANSFER`.
  - Column name correction in `UnifiedSalesLedgerService` (`sales_ledger_svc.py`) from legacy attributes (`batch_number`, `current_stock_qty`) to canonical (`batch_no`, `quantity`).
  - Automatic cache resynchronization and batch-stock awareness in Goods Receipt handler (`goods_receipt.py`).
  - Handling of initial catalog unledgered stock without double-deduction.
- **Read-Only Reconciliation Subsystem:**
  - Reconciliation audit service: `backend/app/services/stock_reconciliation_engine.py`.
  - Fast REST API endpoints in `backend/app/api/v1/inventory.py` (`/api/v1/inventory/reconciliation` and `/api/v1/inventory/reconciliation/correction-proposal`).
  - CLI subcommand: `smriti stock reconcile` via `backend/app/cli/commands/stock_cmd.py`.
  - Interactive UI modal: `src/components/inventory/StockReconciliationAuditModal.tsx` connected to `StockLedgerTab.tsx`.
- **Automated Test Suite:** Comprehensive pytest suite `backend/app/tests/test_stock_movement_reconciliation_audit.py` covering all 14 mandatory operational scenarios.

## 4. Current State
- The codebase relies on a dual-layer ledger: `product_batch_stocks` for batch-tracked items and `stock_movements` for general items, with `products.stock` as a materialized cache.
- In `StockSynchronizer`, `INFLOW_MOVEMENT_TYPES` omitted `SALES_CANCEL` (present 25 times in live DB), `INWARD_INITIAL`, and generic `ADJUSTMENT`/`TRANSFER`, causing cancelled sales to be excluded when computing balance from movements.
- In `sales_ledger_svc.py`, `ProductBatchStock` updates attempted to read `batch_number` and `current_stock_qty`, which do not exist on the SQLAlchemy model (`batch_no` and `quantity`).
- In `goods_receipt.py`, after recording `StockMovement` on GRN receipt and cancellation, cache resynchronization (`StockSynchronizer.sync_product_stock_cache`) was not called.
- In production, 139 non-batch products have non-zero cached stock without corresponding `OPENING_STOCK` movement logs.

## 5. Gap Analysis
| Component | Existing Behavior | Canonical Required Behavior |
|:---|:---|:---|
| `StockSynchronizer` | Ignores `SALES_CANCEL`, `INWARD_INITIAL`, `OUTWARD_ECOM`, generic `ADJUSTMENT` | Recognizes all canonical inflows and outflows, including signed adjustments |
| `goods_receipt.py` | Inserts `StockMovement` without calling `sync_product_stock_cache` | Calls cache synchronizer and updates batch stock |
| `sales_ledger_svc.py` | Queries non-existent `batch_number` & `current_stock_qty` | Uses canonical `batch_no` and `quantity` with positive movement quantities |
| Reconciliation Tooling | No multi-filter audit API or UI report | Full API, CLI, and UI reconciliation tool with 9-state discrepancy classification |
| Test Coverage | Fragmented tests across modules | Unified 14-scenario automated test suite proving all stock invariants |

## 6. Architecture Impact
- **No Schema Mutations:** Uses existing tables (`stock_movements`, `product_batch_stocks`, `products`, `warehouses`). No table drops or breaking DDL required.
- **Fail-Safe Read-Only Reporting:** The reconciliation report is strictly non-destructive.
- **Strict Tenant & Warehouse Isolation:** Queries are strictly bounded by `company_id` and optionally `warehouse_id`.

## 7. Proposed Design
1. **Canonical Movement Classifier (`StockSynchronizer`):**
   - Inflow: `IN`, `INWARD_PURCHASE`, `INWARD_GRN`, `GRN`, `PURCHASE`, `RETURN_INWARD`, `RETURN`, `ADJUSTMENT_IN`, `TRANSFER_IN`, `INWARD_SURPLUS`, `OPENING_STOCK`, `INWARD_INITIAL`, `SALES_CANCEL`, `INWARD`.
   - Outflow: `OUT`, `OUTWARD_SALE`, `SALE`, `POS_SALE`, `ADJUSTMENT_OUT`, `TRANSFER_OUT`, `RETURN_OUTWARD`, `OUTWARD_LOSS`, `OUTWARD_DISPATCH`, `DISPATCH`, `OUTWARD_ECOM`, `DAMAGE`, `WRITE_OFF`, `OUTWARD`.
   - Signed: `ADJUSTMENT` (+ for inflow, - for outflow).
2. **Reconciliation Engine (`StockReconciliationEngine`):**
   - Aggregates movements per item/warehouse.
   - Computes expected on-hand vs actual ledger stock vs materialized cached stock.
   - Detects and categorizes discrepancies into 9 discrete categories with severity and remediation suggestions.
   - Prepares non-destructive historical correction proposals.
3. **API & CLI Layer:**
   - Exposes `/api/v1/inventory/reconciliation` and `/api/v1/inventory/reconciliation/correction-proposal`.
   - Exposes `smriti stock reconcile` CLI command.
4. **Interactive UI Component:**
   - Exposes `StockReconciliationAuditModal` with KPI summary cards, filter bar, variance badges, and expandable audit trail.

## 8. Files Created
- `backend/app/services/stock_reconciliation_engine.py`: Core reconciliation auditing engine.
- `backend/app/cli/commands/stock_cmd.py`: CLI subcommand dispatcher for `smriti stock`.
- `backend/app/tests/test_stock_movement_reconciliation_audit.py`: 14-scenario automated test suite.
- `src/components/inventory/StockReconciliationAuditModal.tsx`: Interactive reconciliation UI report.
- `docs/implementation/inventory/Inventory_Stock_Movement_Validation_And_Reconciliation_Audit_Plan_v6.99.0.md`: This implementation plan.
- `docs/walkthrough/inventory/Inventory_Stock_Movement_Validation_And_Reconciliation_Audit_Walkthrough_v6.99.0.md`: Mandatory walkthrough.

## 9. Files Modified
- `backend/app/services/stock_synchronizer.py`: Movement classification expansion and opening balance safety.
- `backend/app/services/stock_acct_svc.py`: Movement classification alignment.
- `backend/app/services/sales_ledger_svc.py`: Fix batch stock column access and positive movement quantity.
- `backend/app/services/lifecycle/handlers/goods_receipt.py`: Add cache sync and batch stock mutation.
- `backend/app/api/v1/inventory.py`: Register reconciliation endpoints.
- `backend/app/cli/main.py`: Register `stock_cmd`.
- `src/components/StockLedgerTab.tsx`: Add "Reconciliation Audit" trigger button.
- `src/components/shell/TabRenderer.tsx`: Register `stock-reconciliation` route.
- `docs/implementation/README.md`: Update master index.
- `docs/implementation/CONSOLIDATED_PLANS.md`: Append plan ledger.
- `docs/walkthrough/README.md`: Update master index.
- `docs/walkthrough/CONSOLIDATED_WALKTHROUGHS.md`: Append walkthrough ledger.
- `CHANGELOG.md`: Record new version additions.

## 10. Dependencies
- FastAPI, SQLAlchemy AsyncSession, Pydantic v2.
- React 18, Vite, Lucide icons, Tailwind CSS / Vanilla tokens.
- PostgreSQL 15+.

## 11. Risks
- **Data corruption risk:** Solved by making reconciliation strictly read-only; no automatic adjustments to historical records without explicit administrative confirmation.
- **Lock contention:** Row-level locks (`SELECT FOR UPDATE`) are scoped to individual product IDs during live sync operations.

## 12. Rollback Strategy
If any defect occurs, changes are localized to Python service helpers and do not modify database schemas. Reverting modified files restores previous behavior without data loss.

## 13. Verification Plan
1. Run pytest suite `test_stock_movement_reconciliation_audit.py` covering all 14 scenarios.
2. Run pytest suite `test_sales_stock_authority.py` for regression verification.
3. Execute CLI command `python -m backend.app.cli stock reconcile` and verify literal terminal output.
4. Execute `npm run lint` / `tsc --noEmit` to verify frontend TypeScript compilation.

## 14. Test Plan
- Scenario 1: Purchase receipt increases stock once.
- Scenario 2: Completed inventory-affecting sale decreases stock once.
- Scenario 3: Purchase Order without a receipt does not increase physical stock.
- Scenario 4: Sales Order without dispatch does not decrease physical stock.
- Scenario 5: Sales return and purchase return have correct directional effects.
- Scenario 6: Cancelled transactions and reversals restore correct balance without double posting.
- Scenario 7: Warehouse transfers balance across source and destination locations.
- Scenario 8: Duplicate API requests, concurrent posting and offline-sync retries do not duplicate movements.
- Scenario 9: Article/color/size variants cannot affect the wrong item.
- Scenario 10: Cross-company and cross-warehouse isolation is enforced.
- Scenario 11: Opening stock and adjustments reconcile correctly.
- Scenario 12: Negative stock follows configured business policy.
- Scenario 13: Ledger, cached balance and stock reports reconcile.
- Scenario 14: Failed transactions roll back atomically without partial stock updates.

## 15. Documentation Impact
- `docs/implementation/inventory/Inventory_Stock_Movement_Validation_And_Reconciliation_Audit_Plan_v6.99.0.md` created.
- `docs/walkthrough/inventory/Inventory_Stock_Movement_Validation_And_Reconciliation_Audit_Walkthrough_v6.99.0.md` created.
- `docs/developer_guide/DEVELOPER_GUIDE.md` updated with stock movement classification and reconciliation API.
- `docs/troubleshooting/TROUBLESHOOTING.md` updated with resolution for unledgered opening balances and cancelled sales movements.
- `CHANGELOG.md` updated.

## 16. Deployment Plan
- Deploy backend service updates with zero downtime (no DB migrations needed).
- Frontend bundle rebuilt via `npm run build`.

## 17. Status
Approved

## 18. Related ADRs
- `ADR-0012`: Ledger Sole Source of Truth.
- `ADR-0021`: Item Variant SKU Resolution.

## 19. Related Walkthroughs
- `docs/walkthrough/inventory/Inventory_Stock_Movement_Validation_And_Reconciliation_Audit_Walkthrough_v6.99.0.md`
