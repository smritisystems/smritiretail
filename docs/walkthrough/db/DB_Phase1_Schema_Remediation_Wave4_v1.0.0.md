<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-25
  Modified     : 2026-09-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# DB Phase 1 Schema Remediation Wave 4 Walkthrough

**Walkthrough ID:** WGP-DB-REM-WAVE4-v1.0.0  
**Area:** Database & Inventory Architecture  
**Status:** Completed & Verified  

---

## 1. Purpose
Document the architectural implementation and verification of Phase 1 Schema Remediation Wave 4: Stock Source-of-Truth Consolidation. This wave resolves Finding E-001 from the Phase 1 Schema Audit, which identified critical silent inventory drift caused by five disparate service-layer writers mutating `products.stock` directly and bypassing the authoritative inventory ledgers (`product_batch_stocks` and `stock_movements`). This remediation designates `product_batch_stocks` as the authoritative inventory ledger for batch-tracked items and `stock_movements` for standard items, encapsulates all stock calculations into a centralized canonical service `StockSynchronizer`, refactors all direct writers, and deploys drift detection and automated reconciliation capabilities.

## 2. Scope
1. **Canonical Stock Synchronization Engine (`backend/app/services/stock_synchronizer.py`):**
   - Single canonical authority for synchronizing `products.stock` from authoritative ledgers.
   - For batch-tracked products: Usable stock = `SUM(quantity - damaged_quantity)` from `product_batch_stocks`.
   - For non-batch products: Net stock = `SUM(inflows) - SUM(outflows)` from immutable `stock_movements`.
   - Row-level lock (`with_for_update()`) on `products` during recalculation to guarantee concurrency safety.
   - Comprehensive drift detection (`detect_stock_drift`) and automated repair (`reconcile_and_repair_drift`).
2. **Service Layer Writer Convergence:**
   - `backend/app/services/stock_acct_svc.py`: Replaced ad-hoc `product.stock = current_stock + delta` with `StockSynchronizer.sync_product_stock_cache`; upgraded `rebuild_materialized_balances_from_movements` with company-level scoping and batch-ledger awareness.
   - `backend/app/services/inventory_wms.py`: Centralized WMS stock synchronization in `atomic_mutate_batch_stock` through `StockSynchronizer.sync_product_stock_cache`.
   - `backend/app/services/stock_audit_service.py`: Refactored internal `_sync_product_stock_cache` to delegate directly to `StockSynchronizer`.
   - `backend/app/services/sales.py`: In sales return handling, replaced uncoordinated `product.stock` increment with immutable `RETURN_INWARD` movement recording followed by `StockSynchronizer.sync_product_stock_cache`.
3. **ORM Model Invariant Documentation:**
   - `backend/app/models/inventory.py`: Explicitly documented `Product.stock` as a read-only materialized cache governed by `StockSynchronizer`.
4. **Verification & Audit Battery:**
   - Multi-scenario automated test suite verifying batch sync, movement sync, silent drift detection (+924, -65), automated repair, boundary rebuild integration, and clean rollback.

## 3. Files Created
- `backend/app/services/stock_synchronizer.py`
- `docs/walkthrough/db/DB_Phase1_Schema_Remediation_Wave4_v1.0.0.md`

## 4. Files Modified
- `backend/app/models/inventory.py`
- `backend/app/services/stock_acct_svc.py`
- `backend/app/services/inventory_wms.py`
- `backend/app/services/stock_audit_service.py`
- `backend/app/services/sales.py`
- `docs/implementation/db/Phase1_Schema_Remediation_Plan_v1.0.0.md`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
- **ADR-DB-004: Dual-Tier Inventory Source of Truth**:
  1. *Authoritative Ledger Tier:* `product_batch_stocks` is the single source of truth for batch-tracked items; `stock_movements` is the immutable audit ledger for all transactional movements.
  2. *Materialized Cache Tier:* `products.stock` is strictly a read-only denormalized cache maintained for low-latency catalog lookups, search indexing, and POS display. Direct writes bypassing `StockSynchronizer` are architectural violations.
- **Concurrency Isolation via SELECT FOR UPDATE**: Whenever `products.stock` is re-synchronized, the target product row is locked within the transactional boundary, preventing race conditions during concurrent POS sales, inbound GRNs, and batch adjustments.

## 6. Design Rationale
Prior to Wave 4, services applied delta increments or decrements directly to `products.stock` using disparate formulas (`product.stock = current_stock + delta`, `int((product.stock or 0) + Decimal(str(qty)))`, `product.stock = Decimal(str(product.stock or 0)) - quantity`). In concurrent operations or partial transactions, `products.stock` silently drifted away from the underlying batch balances and ledger movements. For example, forensic inspection in tenant `smriti001` revealed products with cache values of `-10` while batch ledgers recorded `+990`. Centralizing recalculation through `StockSynchronizer` ensures that `products.stock` is always mathematically derived from authoritative ledgers.

## 7. Implementation Summary
1. Created `StockSynchronizer` in `backend/app/services/stock_synchronizer.py` with:
   - `sync_product_stock_cache(session, product_id, company_id)`
   - `detect_stock_drift(session, company_id)`
   - `reconcile_and_repair_drift(session, company_id, fix_drift=True)`
   - Consolidated canonical sets `INFLOW_MOVEMENT_TYPES` and `OUTFLOW_MOVEMENT_TYPES`.
2. Refactored `stock_acct_svc.py`:
   - Updated `record_stock_movement` to flush movement and synchronize cache via `StockSynchronizer`.
   - Updated `rebuild_materialized_balances_from_movements` to filter by `company_id` and evaluate batch ledgers.
   - Replaced duplicate movement sets with imports from `.stock_synchronizer`.
3. Refactored `inventory_wms.py`:
   - Replaced inline batch-sum SQL in `atomic_mutate_batch_stock` with `StockSynchronizer.sync_product_stock_cache`.
4. Refactored `stock_audit_service.py`:
   - Replaced duplicate query logic in `_sync_product_stock_cache` with `StockSynchronizer.sync_product_stock_cache`.
5. Refactored `sales.py`:
   - Sales returns now record `RETURN_INWARD` movement and trigger `StockSynchronizer.sync_product_stock_cache`.
6. Authored and executed automated verification test `verify_wave4_stock_synchronization.py`.

## 8. Tests Executed
1. **Batch-Tracked Product Stock Synchronization Test**:
   - Created test product with `tracking_mode = "Batch"`.
   - Populated two batches: Batch A (qty=50, damaged=5), Batch B (qty=30, damaged=0).
   - Executed `sync_product_stock_cache`.
   - Verified authoritative stock = 75.0000, `product.stock` = 75.
2. **Standard Non-Batch Movement Synchronization Test**:
   - Created test product with `tracking_mode = "Standard"`.
   - Recorded movements: +100 `INWARD_PURCHASE`, -30 `OUTWARD_SALE`, +5 `RETURN_INWARD`.
   - Executed `sync_product_stock_cache`.
   - Verified authoritative stock = 75.0000, `product.stock` = 75.
3. **Silent Drift Detection Test**:
   - Artificially corrupted cached stock (`prod_batch.stock = 999`, `prod_std.stock = 10`).
   - Executed `detect_stock_drift`.
   - Verified detection of 2/2 drifted products: Batch drift = +924 (OVERSTATED), Std drift = -65 (UNDERSTATED).
4. **Automated Drift Repair Test**:
   - Executed `reconcile_and_repair_drift(fix_drift=True)`.
   - Verified repaired count = 2.
   - Re-audited drift: 0 remaining drifts; both products restored to 75.
5. **Boundary Service Integration Test**:
   - Executed `StockAccountingBoundaryService.rebuild_materialized_balances_from_movements`.
   - Verified 2/2 products balanced, 0 drift count.
6. **Stock Reconciliation Unit Test Battery**:
   - Executed 7/7 tests in `test_stock_reconciliation.py` (deficit variance, surplus variance, zero-variance skip, completed audit block, canonical formula, non-negative impact, capped deduction).
7. **Static Code Analysis**:
   - `python -m ruff check backend/app/services/stock_synchronizer.py` -> 0 errors.

## 9. Verification Results
- **Status:** Done
- **Quantitative Metrics:**
  - Automated Scenarios: 6/6 passed (100%)
  - Unit Tests: 7/7 passed (100%)
  - Drift Detection Accuracy: 2/2 (100%)
  - Automated Cache Repair: 2/2 (100%)
  - Direct Writers Refactored: 4 services
  - Static Linter Errors: 0 on `stock_synchronizer.py`
- **Literal Test Run Output:**
  ```text
  ======================================================================
  WAVE 4 VERIFICATION — STOCK SOURCE-OF-TRUTH CONSOLIDATION
  ======================================================================

  [1] Testing Batch-Tracked Product Synchronization...
    [OK] Batch product synchronized accurately: authoritative=75.0000, cached=75

  [2] Testing Standard Non-Batch Movement Synchronization...
    [OK] Standard product synchronized accurately: authoritative=75.0000, cached=75

  [3] Testing Silent Drift Detection...
    [OK] Detected 2/2 drifted products accurately: Batch drift=+924, Std drift=-65

  [4] Testing Automated Drift Repair...
    [OK] Reconciled and repaired 2 products
    [OK] Post-repair drift count: 0 (Batch stock=75, Std stock=75)

  [5] Testing StockAccountingBoundaryService.rebuild_materialized_balances_from_movements...
    [OK] Boundary service report: 2/2 products balanced

  [6] Transaction rolled back cleanly: 0 test rows persisted in database.

  ======================================================================
  WAVE 4 VERIFICATION: ALL 100% PASSED
  ======================================================================
  ```

## 10. Known Limitations
- `products.stock` is currently typed as `INTEGER` in PostgreSQL. While sufficient for unit-based retail products (shoes, apparel), fractional goods (fabrics, bulk food) lose sub-unit decimals in the cache (though full precision is preserved in `product_batch_stocks.quantity NUMERIC(12,4)`). Type widening to `NUMERIC(12,4)` is scheduled for a subsequent database migration wave.

## 11. Future Work
- Wave 5: PSV tables `company_id` and strict FK to `products` (`v1493`).
- Database migration converting `products.stock` from `INTEGER` to `NUMERIC(12,4)`.
- Scheduled background daemon periodically running `reconcile_and_repair_drift` across tenant stores.

## 12. Related ADRs
- ADR-0012: Database Relational Integrity and Financial Immutability Policy
- ADR-DB-002: Storage-Level Invariant Enforcement
- ADR-DB-004: Dual-Tier Inventory Source of Truth

## 13. Related RFCs
- RFC-DB-001: SMRITI Multi-Tenant Schema Consolidation & Immutability Standard
