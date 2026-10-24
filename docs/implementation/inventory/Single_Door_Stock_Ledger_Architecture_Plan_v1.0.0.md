<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.1
  Created      : 2026-10-21
  Modified     : 2026-10-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Single-Door Stock Ledger Architecture & Transaction Convergence Plan

## 1. Objective
Establish a single authoritative entry door for all stock movement writes across SMRITI Retail OS via `StockLedger` (`backend/app/services/stock_ledger.py`). Eliminate all direct `StockMovement` inserts, updates, deletes, and uncoordinated row locking across legacy adapters. Enforce dual-hash idempotency (`idempotency_key` and `payload_hash`), canonical three-tier locking order (`Product` -> `ProductBatchStock` -> warehouse stock), pure cache synchronization without ledger write side-effects, typed internal cost valuation, and AST-level static analysis guards.

## 2. Business Motivation
Inventory mutations originating from disparate modules (Sales Invoices, Point of Sale, Goods Receipts, Returns, Transfers, Stock Adjustments, and Reconciliations) historically bypassed centralized validation, used inconsistent sign conventions (positive vs. negative sales), acquired locks in arbitrary orders (causing deadlocks), and permitted silent ledger row synthesis inside cache synchronizers. Establishing an immutable Single-Door architecture guarantees ledger integrity, deterministic replay safety, zero deadlock concurrency, and strict statutory compliance.

## 3. Scope
1. **Database Schema & Migration:**
   - Alembic migration adding `idempotency_key` (VARCHAR(64), nullable), `payload_hash` (VARCHAR(64), nullable), and `cost_source` (VARCHAR(50), nullable) to `stock_movements`.
   - Partial unique index on `(company_id, idempotency_key)` WHERE `idempotency_key IS NOT NULL`.
2. **Canonical Single-Door Service (`StockLedger`):**
   - Single posting methods: `StockLedger.post` and `StockLedger.post_many`.
   - Canonical idempotency key computation: SHA-256 of `(company_id, canonical_reference_doc_type, reference_doc_id, product_id, batch_no or "~", movement_type, line_ref or "~")`.
   - Payload hash computation: SHA-256 of `(product_id, batch_no, warehouse_id, quantity, movement_type)`.
   - Savepoint-guarded insertion with 409 `IDEMPOTENCY_CONFLICT` on mismatched payloads.
   - Pre-existing legacy NULL-key replay lookup matching `SalesStockAuthority` behavior.
   - Strict lock ordering: `Product` row first, then `ProductBatchStock` row, then warehouse stock row.
   - Return `product_balance_after` and `batch_balance_after`.
   - Tenant isolation validation: verify product, batch, and warehouse belong to tenant.
3. **Pure Cache Synchronizer & Opening Stock Decoupling:**
   - Refactor `StockSynchronizer.sync_product_stock_cache` to be a pure recompute-and-write-cache routine without `StockMovement` row synthesis.
   - Replace auto-created `OPENING_STOCK` with health findings and explicit admin posting operation.
4. **Typed Internal Cost Valuation:**
   - Frozen dataclass `InternalCost` in `stock_ledger.py`.
   - Prevention of client-facing payload `unit_cost` manipulation.
   - Integration with `CostManagementEngine`.
5. **Static Analysis & Guard Hardening:**
   - AST script detecting direct `StockMovement` instantiation, ORM inserts/updates/deletes, raw SQL, direct assignments to `ProductBatchStock.quantity` or `Product.stock`, and unhandled `func.sum`.
   - Single-door test fixtures and allowlist governance.

## 4. Current State
- `stock_movements` lacks `idempotency_key` and `payload_hash` columns.
- Multiple legacy adapters perform ad-hoc `session.add(StockMovement(...))` and invoke `with_for_update()` in conflicting orders.
- In `smriti001`, `OUTWARD_SALE` has 7,284 positive rows and 1,118 negative rows.
- `StockSynchronizer.sync_product_stock_cache` silently synthesizes `OPENING_STOCK` rows whenever `products.stock > 0` and no inward movement exists.
- 18 non-test call sites invoke `sync_product_stock_cache` directly rather than through a unified transaction door.

## 5. Gap Analysis
| Aspect | Current State | Target Single-Door State |
|---|---|---|
| Mutation Gate | Multiple entry points (`SalesStockAuthority`, `InventoryService`, `goods_receipt.py`, API endpoints) | Strict Single Door (`StockLedger.post` / `post_many`) |
| Idempotency | Document-level or line-level ad-hoc checks; no hash verification | SHA-256 canonical key + payload hash; 409 conflict detection; DB partial unique index |
| Locking Order | Unsynchronized (some lock Batch first, some lock Product first) | Sorted canonical order: Product -> Batch -> Warehouse |
| Synchronizer Side-Effect | Auto-creates `OPENING_STOCK` on cache sync | Pure recompute routine; zero ledger row creation |
| Cost Handling | Boolean `trusted=True` flags; selling price fallbacks | Typed `InternalCost` dataclass; immutable `cost_source` |
| AST Enforcement | Manual code review | Automated AST guard suite in CI and pytest |

## 6. Architecture Impact
- **Sole System of Record:** `StockLedger` becomes the exclusive writer for all inventory mutations.
- **Concurrency & Deadlock Immunity:** Global sorting of lock acquisition tuples prevents circular lock dependency across multi-item transactions.
- **Fail-Closed Statutory Invariant:** Prevents phantom stock, negative-stock double negatives, and untracked opening balances.

## 7. Proposed Design
```text
Client / API Layer / Business Adapters
  (Sales, Procurement, WMS, POS, Adjustments)
                  │
                  ▼
          StockLedger.post_many()
                  │
                  ├── 1. Validate Tenant Ownership (Product, Batch, Warehouse)
                  ├── 2. Compute Canonical Idempotency Key & Payload Hash
                  ├── 3. Check Existing Key (Same Key + Same Hash = Replay; Mismatch = 409)
                  ├── 4. Sort & Acquire Locks (Product -> Batch -> Warehouse)
                  ├── 5. Cumulative Negative-Stock & Quantity Validation
                  ├── 6. Resolve Unit Cost via InternalCost or CostEngine
                  ├── 7. SAVEPOINT -> Insert StockMovement -> Catch Concurrent Duplicate
                  ├── 8. Update ProductBatchStock & Warehouse Balances
                  ├── 9. Synchronize Product Cache (Pure Recompute)
                  └── 10. Return Movements + product_balance_after + batch_balance_after
```

## 8. Files Created
1. `backend/app/services/stock_ledger.py`: Canonical Single-Door Stock Ledger engine.
2. `backend/alembic/versions/v1542_stock_ledger_idempotency_and_single_door.py`: Migration for idempotency key, payload hash, cost source, and partial unique index.
3. `backend/app/schemas/stock_ledger.py`: Internal request/response models and dataclasses.
4. `scripts/ci_stock_single_door_guard.py`: AST static analysis rule enforcement guard.
5. `backend/app/tests/single_door_fixtures/`: Forbidden and permitted pattern test fixtures.
6. `backend/app/tests/test_single_door_stock_ledger.py`: Comprehensive test suite for idempotency, concurrent locking, savepoint rollback, and cost handling.

## 9. Files Modified
1. `backend/app/models/inventory.py`: Add `idempotency_key`, `payload_hash`, and `cost_source` columns and partial unique index.
2. `backend/app/services/stock_synchronizer.py`: Remove `OPENING_STOCK` synthesis side effect; make pure cache recompute.
3. `backend/app/services/sales_stock_authority.py`: Adapt to delegate ledger mutations through `StockLedger.post_many`.
4. `backend/app/services/inventory.py`: Delegate `adjust_stock` and `transfer_stock` through `StockLedger`.
5. `backend/app/api/v1/inventory.py`: Migrate direct movement endpoint to `StockLedger`.
6. `backend/app/services/lifecycle/handlers/goods_receipt.py`: Delegate receipt and cancellation movements through `StockLedger`.

## 10. Dependencies
- PostgreSQL 14+ supporting partial unique indexes.
- SQLAlchemy 2.0 async engine with Savepoints (`session.begin_nested()`).
- Alembic migration framework.

## 11. Risks
- **Risk:** Existing in-flight transactions during deployment might clash on unindexed legacy rows.
  - **Mitigation:** Legacy NULL-key lookup fallback ensures existing posted documents are recognized as replays.
- **Risk:** Removing auto-created `OPENING_STOCK` breaks unledgered legacy products during first sale.
  - **Mitigation:** Unledgered products are flagged with health findings and explicit admin opening balance workflow.

## 12. Rollback Strategy
- Database migration provides reversible `downgrade()` removing columns and indexes.
- Adapters retain transaction isolation; rollback triggers clean database rollback via standard session rollback.

## 13. Verification Plan
1. Schema verification: Column types, partial unique index, nullability.
2. Idempotency tests: Identical concurrent posts, 409 on quantity mismatch, replay of legacy NULL-key rows, rollback retry.
3. Concurrency tests: Reverse-ordered overlapping `post_many` execution without deadlock.
4. Synchronizer verification: Pure cache recompute without ledger row creation.
5. AST Guard verification: Detection of all forbidden patterns across test fixtures and repository.

## 14. Test Plan
- Unit & integration tests in `backend/app/tests/test_single_door_stock_ledger.py`.
- Characterization regression tests in `backend/app/tests/test_phase0_synchronizer_characterization.py`.
- Static analysis tests in `scripts/ci_stock_single_door_guard.py`.

## 15. Documentation Impact
- Update `docs/architecture/SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md`.
- Master Implementation Index `docs/implementation/README.md`.
- Walkthrough in `docs/walkthrough/inventory/Single_Door_Stock_Ledger_Architecture_Walkthrough_v1.0.0.md`.

## 16. Deployment Plan
1. Execute Alembic migration `v1542` across all tenant databases.
2. Deploy backend service with `StockLedger` active.
3. Verify telemetry and zero new stock drift.

## 17. Status
Approved

## 18. Related ADRs
- `ADR-0042`: Single Authoritative Door for Inventory Mutations.
- `ADR-0043`: Dual-Hash Idempotency and Savepoint Replay Policy.

## 19. Related Walkthroughs
- `docs/walkthrough/inventory/Inventory_Stock_Movement_Validation_And_Reconciliation_Audit_Walkthrough_v6.99.0.md`
- `docs/walkthrough/inventory/Single_Door_Stock_Ledger_Architecture_Walkthrough_v1.0.0.md`
