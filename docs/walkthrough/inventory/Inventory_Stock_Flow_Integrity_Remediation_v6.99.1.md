<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.1
  Created      : 2026-10-21
  Modified     : 2026-10-21
  Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Architecture & Stock-Flow Integrity Walkthrough
-->

# Walkthrough: Inventory Stock-Flow Integrity Remediation v6.99.1

## 1. Purpose
This walkthrough documents the comprehensive remediation of stock-flow integrity defects on branch `smritiNX` (v6.99.1), enforcing the fundamental SMRITI Ledger Principle:
> **The ledger (`stock_movements` + `product_batch_stocks`) is the sole transactional authority and source of truth; `products.stock` is strictly a synchronized read-cache.**

## 2. Scope
The scope encompasses seven identified integrity defects across sales returns, sales ledger postings, stock transfers, stock adjustments, API input validation, movement-type vocabulary, stock drift detection, and semantic version SSOT alignment:
- Item 1: Sales return two stock writers convergence.
- Item 2: UnifiedSalesLedgerService routing through SalesStockAuthority.
- Item 3: InventoryService stock transfer paired movements and warehouse availability validation.
- Item 4: Stock adjustment authoritative ledger delta and integer column fractional input guard.
- Item 5: POST `/inventory/movements` input validation, idempotency, and cache synchronization.
- Item 6: Unified movement-type vocabulary, company stock drift CLI detection job, and authority documentation correction.
- Item 7: Version drift alignment across `package.json`, `config.py`, `version.ts`, and `CHANGELOG.md` to `6.99.1`.

## 3. Files Created
1. `backend/app/services/stock_movement_types.py`: Canonical source of truth defining `INFLOW_MOVEMENT_TYPES`, `OUTFLOW_MOVEMENT_TYPES`, `SIGNED_MOVEMENT_TYPES`, and `ALL_MOVEMENT_TYPES`.
2. `scripts/check_stock_drift.py`: CLI and scheduled background job scanning active companies for stock drift using `StockSynchronizer.detect_stock_drift` without auto-repair by default.
3. `backend/app/tests/test_item1_sales_return_stock.py`: Integration test proving sales return creation does not mutate stock; restocking happens exclusively upon approval/PROCESS.
4. `backend/app/tests/test_item2_sales_ledger_authority.py`: Integration test verifying SalesStockAuthority routing, negative stock rejection, and unit cost != selling price.
5. `backend/app/tests/test_item3_transfer_stock.py`: Integration test verifying zero-sum paired transfer movements (`TRANSFER_OUT` / `TRANSFER_IN`) and warehouse stock checks.
6. `backend/app/tests/test_item4_adjust_stock.py`: Integration test verifying ledger-derived delta calculation and rejection of fractional adjustments on integer column.
7. `backend/app/tests/test_item5_post_movements_validation.py`: Integration test validating movement allow-lists, reference doc requirements, idempotency, and cache synchronization.
8. `backend/app/tests/test_item6_movement_types_classification.py`: AST scan test proving 100% of movement type literals in `backend/app` are classified in vocabulary sets, and unclassified types raise errors.

## 4. Files Modified
1. `backend/app/services/sales.py`: Removed premature `StockMovement` creation during `create_sales_return`.
2. `backend/app/services/lifecycle/handlers/sales_return.py`: Propagated `batch_no` and `unit_cost` to `SalesStockAuthority.record_return_inward` on `PROCESS`.
3. `backend/app/services/sales_stock_authority.py`: Restores `ProductBatchStock` upon inward returns, enforces cost resolution precedence, and updated class docstrings.
4. `backend/app/services/sales_ledger_svc.py`: Replaced direct stock/batch mutations with `SalesStockAuthority.record_outward_sale` and `record_sales_cancellation_reversal`.
5. `backend/app/services/inventory.py`: Rewrote `transfer_stock` to produce paired movements; rewrote `adjust_stock` with row-level locks, ledger-based delta computation, and fractional input rejection.
6. `backend/app/api/v1/inventory.py`: Enforced movement validation, idempotency, batch stock updates, and cache synchronization on `/movements`.
7. `backend/app/services/stock_synchronizer.py`: Replaced local type sets with `stock_movement_types.py` imports, raising errors on unclassified types.
8. `package.json`, `backend/app/core/config.py`, `src/config/version.ts`: Synchronized SSOT version to `6.99.1`.

## 5. Architecture Decisions
- **AD-01 (Single Return Writer):** Restocking of inventory on sales returns must occur exclusively upon lifecycle confirmation/approval (`PROCESS`), never during initial draft or creation.
- **AD-02 (Authority Supremacy):** All outward sales, dispatches, cancellations, and returns across both direct POS/Billing and background/offline sync engines must route through `SalesStockAuthority`. Direct manipulation of `Product.stock` or `StockMovement` table is prohibited.
- **AD-03 (Zero-Sum Transfers):** Warehouse stock transfers must record explicit paired movements: `TRANSFER_OUT` from source warehouse and `TRANSFER_IN` to destination warehouse. Net impact on enterprise-wide `Product.stock` is exactly 0.
- **AD-04 (Integer Stock Schema Invariant):** As `Product.stock` is defined as PostgreSQL `INTEGER`, fractional stock adjustments cannot be stored in the integer cache without truncation drift. Fractional adjustments are rejected with HTTP 422 until a formal decimal schema migration is applied.

## 6. Design Rationale
- Premature return writing created phantom stock that could be sold before the return was physically received or verified by store managers.
- In `UnifiedSalesLedgerService`, setting unit cost to selling price distorted gross margin accounting and inventory valuation. Delegating to `SalesStockAuthority` ensures the 3-tier valuation engine (snapshot -> batch cost -> catalog cost) is consistently applied.
- Computing adjustment deltas from the cached `Product.stock` allowed race conditions and stale cache corruption. Computing delta directly from the sum of ledger movements (`SELECT SUM... FROM stock_movements`) guarantees deterministic convergence.

## 7. Implementation Summary
The implementation was executed strictly one commit per item:
- Commit `4c0ada8d`: `fix(inventory): sales return stock writers convergence (Item 1)`
- Commit `24c442b5`: `fix(sales): route UnifiedSalesLedgerService via SalesStockAuthority (Item 2)`
- Commit `2dba240d`: `fix(inventory): stock transfer paired movements and availability check (Item 3)`
- Commit `44e9b1d5`: `fix(inventory): stock adjustment ledger delta and fractional validation (Item 4)`
- Commit `733193ad`: `fix(inventory): validate POST stock movements, idempotency and cache sync (Item 5)`
- Commit `8fdb2524`: `fix(inventory): unify movement type vocabulary, add drift check CLI and correct authority docstring (Item 6)`
- Commit `f09b3aa0`: `fix(governance): synchronize version SSOT across package.json, config.py, and version.ts to 6.99.1 (Item 7)`

## 8. Tests Executed
- `backend/app/tests/test_item1_sales_return_stock.py` (1/1 passed)
- `backend/app/tests/test_item2_sales_ledger_authority.py` (1/1 passed)
- `backend/app/tests/test_item3_transfer_stock.py` (1/1 passed)
- `backend/app/tests/test_item4_adjust_stock.py` (1/1 passed)
- `backend/app/tests/test_item5_post_movements_validation.py` (1/1 passed)
- `backend/app/tests/test_item6_movement_types_classification.py` (2/2 passed)
- `backend/app/tests/test_universal_sales_lifecycle.py` (10/10 passed)
- `backend/app/tests/test_inventory.py` (4/4 passed)
- `backend/tests/t_grn_stock.py` (1/1 passed)
- `scripts/validate_version_ssot.py` (Passed with 0 drift)

## 9. Verification Results
All 7 reproduction test files demonstrated failing pre-fix conditions and 100% green post-fix execution. Zero stock drift was introduced.

## 10. Known Limitations
- The `Product.stock` column in PostgreSQL remains `INTEGER`. Fractional tracking modes (such as kilograms, meters, or liters) require applying the proposed `ALTER TABLE products ALTER COLUMN stock TYPE NUMERIC(12, 4);` migration in a future planned release.
- Legacy test files in `backend/tests/` that hardcoded database name `smriti001` are blocked by the intentional test isolation safety guard in `session.py:171`.

## 11. Future Work
- Promote `products.stock` to `NUMERIC(12, 4)` via dedicated Alembic migration to officially support non-discrete fractional inventory items.
- Modernize legacy suites in `backend/tests/` to use dynamic `isolated_company_database` fixtures.

## 12. Related ADRs
- `ADR-0042`: Canonical Ledger Supremacy & Stock Synchronizer Architecture
- `ADR-0056`: Unified Sales Stock Authority & Idempotent Movement Registration

## 13. Related RFCs
- `RFC-INVENTORY-008`: Single-Writer Sales Return Restocking
- `RFC-GOVERNANCE-001`: Multi-Boundary Semantic Version Single Source of Truth
