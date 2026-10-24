<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-21
  Modified     : 2026-10-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Architecture & Engineering Walkthrough (WGP Compliant)
-->

# Walkthrough: SMRITI Single-Door Stock Ledger Architecture & Transaction Convergence

**Policy Compliance:** SMRITI Walkthrough Governance Policy (WGP-v1.0)  
**Implementation Plan:** [`docs/implementation/inventory/Single_Door_Stock_Ledger_Architecture_Plan_v1.0.0.md`](../implementation/inventory/Single_Door_Stock_Ledger_Architecture_Plan_v1.0.0.md)  
**Version:** `1.0.0`  
**Date:** `2026-10-21`  
**Status:** `Completed`  

---

## 1. Purpose

This document provides the formal engineering walkthrough for the **Single-Door Stock Ledger Architecture & Transaction Convergence** in SMRITI Retail OS. Prior to this implementation, stock mutations occurred across multiple disparate services (`inventory.py`, `sales_stock_authority.py`, `goods_receipt.py`, `stock_acct_svc.py`, `ecom_engine.py`, `stock_audit_service.py`), creating potential drift between the materialized cache (`products.stock`) and transactional movements, duplicate insertion risks under concurrent retry conditions, and silent side effects in cache synchronizers.

This implementation establishes the **Single-Door Invariant**:
> **Every physical stock mutation in SMRITI Retail OS must pass through `StockLedger.post()` or `StockLedger.post_many()`**. Direct `StockMovement` creation and manual `Product.stock` assignments are permanently prohibited and enforced via AST static analysis CI gates.

---

## 2. Scope

1. **Phase 0 Contract Freeze & Multi-Tenant Audit:**
   - Multi-tenant distribution audit of `stock_movements` across all 5 live tenant databases (`smriti001`, `smriti002`, `smriti003`, `smriti004`, `smriti005`).
   - Characterization and formal baseline freezing of legacy cache synchronizer behaviors.
2. **Schema & Migration Hardening:**
   - Database migration `v1542_stock_ledger_idempotency_and_single_door.py` adding `idempotency_key` (VARCHAR 64), `payload_hash` (VARCHAR 64), `cost_source` (VARCHAR 64), and partial unique index `uq_sm_company_idempotency_key` (`WHERE idempotency_key IS NOT NULL`).
   - Synchronization of `StockMovement` ORM model in `backend/app/models/inventory.py`.
3. **Core Single-Door Engine (`StockLedger`):**
   - SHA-256 idempotency key derivation (`company_id`, `reference_doc_type`, `reference_doc_id`, `product_id`, `batch_no`, `movement_type`, `line_ref`).
   - SHA-256 payload hash verification (`product_id`, `batch_no`, `warehouse_id`, `quantity`, `movement_type`) detecting conflicting replays with HTTP 409.
   - Dual-mode replay handling: partial index lookup for new keys, and legacy backward-compatible lookup (`idempotency_key IS NULL`) on `(company_id, reference_doc_type, reference_doc_id, product_id, movement_type)`.
   - Canonical 3-tier lock ordering: `Product` row lock -> `ProductBatchStock` row lock -> `Warehouse` tenant validation, sorted by composite key `(product_id, batch_no, warehouse_id)` to guarantee deadlock freedom.
   - Atomic Savepoint posting via `session.begin_nested()` ensuring isolated rollback on concurrent unique collisions.
   - Decoupled, pure cache synchronization via `StockSynchronizer.sync_product_stock_cache()` without ledger side effects.
4. **Valuation Security & Pydantic Guard:**
   - Typed internal dataclass `InternalCost(unit_cost, cost_source)` accepted only from trusted backend callers.
   - Pydantic validator on `StockMovementCreate` rejecting client-supplied `unit_cost` with HTTP 422.
5. **Caller Migration & Convergence:**
   - Migrated all callers across `inventory.py`, `sales_stock_authority.py`, `goods_receipt.py`, `stock_acct_svc.py`, `ecom_engine.py`, and `stock_audit_service.py` to route exclusively through `StockLedger`.
6. **AST Static Analysis CI Guard:**
   - Implemented `scripts/ci_stock_single_door_guard.py` scanning AST trees to forbid direct `StockMovement` creation, direct `product.stock` assignments, and raw `func.sum(StockMovement.quantity)` queries.

---

## 3. Files Created

| Path | Purpose |
|---|---|
| [`backend/alembic/versions/v1542_stock_ledger_idempotency_and_single_door.py`](file:///f:/SMRITRretailNX/backend/alembic/versions/v1542_stock_ledger_idempotency_and_single_door.py) | Alembic migration introducing idempotency columns and partial index. |
| [`backend/app/services/stock_ledger.py`](file:///f:/SMRITRretailNX/backend/app/services/stock_ledger.py) | Authoritative Single-Door Stock Ledger service engine. |
| [`scripts/ci_stock_single_door_guard.py`](file:///f:/SMRITRretailNX/scripts/ci_stock_single_door_guard.py) | Static-analysis AST CI guard enforcing architectural rules across repo. |
| [`backend/app/tests/test_single_door_stock_ledger.py`](file:///f:/SMRITRretailNX/backend/app/tests/test_single_door_stock_ledger.py) | Comprehensive 10-case Pytest test suite for Single-Door ledger. |
| [`backend/app/tests/test_single_door_ast_guard.py`](file:///f:/SMRITRretailNX/backend/app/tests/test_single_door_ast_guard.py) | 4-case Pytest test suite validating AST static analysis guard behavior. |
| [`backend/app/tests/single_door_fixtures/forbidden_direct_insert.py`](file:///f:/SMRITRretailNX/backend/app/tests/single_door_fixtures/forbidden_direct_insert.py) | AST fixture verifying detection of direct `StockMovement(...)` instantiation. |
| [`backend/app/tests/single_door_fixtures/forbidden_stock_assign.py`](file:///f:/SMRITRretailNX/backend/app/tests/single_door_fixtures/forbidden_stock_assign.py) | AST fixture verifying detection of direct `product.stock = ...` mutation. |
| [`backend/app/tests/single_door_fixtures/forbidden_raw_sum.py`](file:///f:/SMRITRretailNX/backend/app/tests/single_door_fixtures/forbidden_raw_sum.py) | AST fixture verifying detection of raw `func.sum(StockMovement.quantity)`. |
| [`backend/app/tests/single_door_fixtures/allowed_single_door.py`](file:///f:/SMRITRretailNX/backend/app/tests/single_door_fixtures/allowed_single_door.py) | AST fixture verifying compliant `StockLedger.post()` code passes cleanly. |
| [`docs/implementation/inventory/Single_Door_Stock_Ledger_Architecture_Plan_v1.0.0.md`](file:///f:/SMRITRretailNX/docs/implementation/inventory/Single_Door_Stock_Ledger_Architecture_Plan_v1.0.0.md) | Formal 19-section implementation plan per IPGP policy. |
| [`docs/walkthrough/inventory/Single_Door_Stock_Ledger_Architecture_Walkthrough_v1.0.0.md`](file:///f:/SMRITRretailNX/docs/walkthrough/inventory/Single_Door_Stock_Ledger_Architecture_Walkthrough_v1.0.0.md) | Formal 13-section walkthrough document per WGP policy. |

---

## 4. Files Modified

| Path | Description of Changes |
|---|---|
| [`backend/app/models/inventory.py`](file:///f:/SMRITRretailNX/backend/app/models/inventory.py) | Added `idempotency_key`, `payload_hash`, `cost_source` fields and partial index to `StockMovement`. |
| [`backend/app/schemas/inventory.py`](file:///f:/SMRITRretailNX/backend/app/schemas/inventory.py) | Added field validator to `StockMovementCreate` rejecting client-supplied `unit_cost` with HTTP 422. |
| [`backend/app/services/stock_synchronizer.py`](file:///f:/SMRITRretailNX/backend/app/services/stock_synchronizer.py) | Decoupled synchronizer by eliminating `OPENING_STOCK` creation side-effect, replacing with `HEALTH_FINDING_UNLEDGERED_OPENING_STOCK` logging. |
| [`backend/app/api/v1/inventory.py`](file:///f:/SMRITRretailNX/backend/app/api/v1/inventory.py) | Migrated `POST /inventory/movements` to delegate directly to `StockLedger.post()`. |
| [`backend/app/services/inventory.py`](file:///f:/SMRITRretailNX/backend/app/services/inventory.py) | Migrated `_record_movement_internal`, `transfer_stock`, and `adjust_stock` to Single-Door delegations. |
| [`backend/app/services/lifecycle/handlers/goods_receipt.py`](file:///f:/SMRITRretailNX/backend/app/services/lifecycle/handlers/goods_receipt.py) | Migrated GRN receiving and cancellation reversal to `StockLedger.post_many()`. |
| [`backend/app/services/sales_stock_authority.py`](file:///f:/SMRITRretailNX/backend/app/services/sales_stock_authority.py) | Migrated `record_outward_sale`, `record_return_inward`, `record_sales_cancellation_reversal`, and `record_dispatch_outward` to `StockLedger.post_many()`. |
| [`backend/app/services/stock_acct_svc.py`](file:///f:/SMRITRretailNX/backend/app/services/stock_acct_svc.py) | Migrated `create_movement` to `StockLedger.post()`. |
| [`backend/app/services/ecom_engine.py`](file:///f:/SMRITRretailNX/backend/app/services/ecom_engine.py) | Migrated eCommerce order stock mutations to `StockLedger.post_many()`. |
| [`backend/app/services/stock_audit_service.py`](file:///f:/SMRITRretailNX/backend/app/services/stock_audit_service.py) | Migrated stock audit discrepancy write-offs and surplus adjustments to `StockLedger.post()`. |
| [`backend/app/tests/test_phase0_synchronizer_characterization.py`](file:///f:/SMRITRretailNX/backend/app/tests/test_phase0_synchronizer_characterization.py) | Updated characterization test assertions to verify Phase 1 decoupled synchronizer behavior. |
| [`docs/implementation/README.md`](file:///f:/SMRITRretailNX/docs/implementation/README.md) | Chronologically updated master index with plan entry. |
| [`docs/walkthrough/README.md`](file:///f:/SMRITRretailNX/docs/walkthrough/README.md) | Chronologically updated master index with walkthrough entry. |

---

## 5. Architecture Decisions

1. **Dual-Hash Idempotency Design:**
   - An `idempotency_key` is deterministically computed from the business document coordinates.
   - A distinct `payload_hash` is computed from the quantitative movement parameters (`product_id`, `batch_no`, `warehouse_id`, `quantity`, `movement_type`).
   - If an operation with the same `idempotency_key` is replayed with an identical `payload_hash`, the previous movement is returned with `replayed=True` without modifying stock.
   - If the `payload_hash` differs, the single door immediately raises HTTP 409 Conflict (`IDEMPOTENCY_CONFLICT`), preventing silent corruption or parameter drift on retries.
2. **Partial Unique Index Strategy:**
   - PostgreSQL partial index `uq_sm_company_idempotency_key` (`WHERE idempotency_key IS NOT NULL`) provides zero overhead and zero collision risk for legacy movements that have NULL keys.
   - Legacy NULL-key replays are resolved via fallback query on `(company_id, reference_doc_type, reference_doc_id, product_id, movement_type)`.
3. **Deadlock Freedom via Global Lock Hierarchy:**
   - Multi-item postings acquire row locks in deterministic global sorted order: `Product` row first, then `ProductBatchStock` row, then `Warehouse` isolation check.
   - Sorting by `(product_id, batch_no, warehouse_id)` ensures that two concurrent transactions updating the same products in reverse order will never deadlock in PostgreSQL.
4. **Nested Savepoint Isolation:**
   - `StockMovement` row insertions execute within an atomic sub-transaction (`session.begin_nested()`).
   - If a race condition triggers a database unique constraint violation, only the inner savepoint is rolled back, preserving the outer session transaction and allowing clean replay detection.
5. **Decoupled Pure Synchronizer:**
   - `StockSynchronizer` was decoupled from ledger mutations. It strictly reads authoritative ledger movements, recomputes the on-hand aggregate, and writes the cache.
   - It never synthesizes `OPENING_STOCK` movements. Unledgered opening stock is established explicitly via `StockLedger.post_admin_opening_stock()`.

---

## 6. Design Rationale

- **Why a Single Door?** In an enterprise retail OS, distributed stock mutations lead to diverging business rules, inconsistent sign handling (e.g., negative vs positive quantities), and lost updates. Funneling all mutations through a single engine guarantees that business invariants (negative stock checks, valuation resolution, idempotency, batch synchronization) are enforced uniformly across POS, B2B Sales, Purchases, Warehousing, and eCommerce.
- **Why Reject Client `unit_cost` with HTTP 422?** Allowing client requests to specify unit cost creates a serious financial and fraud vulnerability where external API consumers could manipulate inventory valuation or COGS. All valuation must originate internally from trusted backend cost engines or explicit internal valuation snapshots.

---

## 7. Implementation Summary

### Dual-Hash Computation
```python
raw_key = f"{company_id}|{reference_doc_type}|{reference_doc_id}|{product_id}|{batch_no}|{movement_type}|{line_ref}"
idempotency_key = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

raw_payload = f"{product_id}|{batch_no}|{warehouse_id}|{quantity.quantize(Decimal('0.01'))}|{movement_type}"
payload_hash = hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()
```

### Savepoint-Guarded Insertion
```python
try:
    async with session.begin_nested():
        session.add(movement)
        await session.flush()
except IntegrityError:
    # Savepoint automatically rolled back; verify replay
    existing = await session.execute(
        select(StockMovement).where(
            StockMovement.company_id == company_id,
            StockMovement.idempotency_key == idem_key,
        )
    )
    if existing.payload_hash == pay_hash:
        return PostResult(movement=existing, replayed=True, ...)
    raise HTTPException(status_code=409, detail="IDEMPOTENCY_CONFLICT")
```

---

## 8. Tests Executed

### Suite 1: Single-Door Stock Ledger Integration (`test_single_door_stock_ledger.py`)
- `test_single_door_idempotency_same_payload_replays_cleanly`: **PASSED**
- `test_single_door_idempotency_different_payload_raises_409`: **PASSED**
- `test_single_door_legacy_null_key_replay`: **PASSED**
- `test_single_door_post_many_cumulative_negative_stock`: **PASSED**
- `test_single_door_same_product_twice_in_one_call`: **PASSED**
- `test_single_door_admin_opening_stock_and_pure_synchronizer`: **PASSED**
- `test_single_door_internal_cost_and_cost_source`: **PASSED**
- `test_single_door_rollback_then_retry_succeeds`: **PASSED**
- `test_single_door_pydantic_rejects_client_unit_cost`: **PASSED**
- `test_single_door_concurrent_post_many_deadlock_free`: **PASSED**

### Suite 2: AST Static Analysis Guard (`test_single_door_ast_guard.py`)
- `test_ast_guard_detects_forbidden_direct_insert`: **PASSED**
- `test_ast_guard_detects_forbidden_stock_assign`: **PASSED**
- `test_ast_guard_detects_forbidden_raw_sum`: **PASSED**
- `test_ast_guard_allows_compliant_single_door`: **PASSED**

### Suite 3: Synchronizer Characterization Suite (`test_phase0_synchronizer_characterization.py`)
- `test_characterization_case_a_unledgered_stock_then_sale`: **PASSED**
- `test_characterization_case_b_hand_drift_copies_to_ledger`: **PASSED**

### Suite 4: Full Codebase AST Static Analysis CI Run
```text
python scripts/ci_stock_single_door_guard.py
Scanned files : 763
Violations    : 0
RESULT: PASSED -- 100% compliant with Single-Door Stock Ledger Architecture.
```

---

## 9. Verification Results

```text
====================== 16 passed, 24 warnings in 52.78s =======================
```
All 16 integration, concurrency, deadlock, idempotency, and characterization tests executed and passed green on a live PostgreSQL database instance.

---

## 10. Known Limitations

- PostgreSQL partial unique index `uq_sm_company_idempotency_key` only enforces database uniqueness for non-NULL `idempotency_key` records. Legacy movements created prior to this version continue to rely on the backward-compatible fallback lookup.
- Cross-company postings within a single `post_many` invocation are strictly prohibited to enforce multi-tenant isolation.

---

## 11. Future Work

- Implement automated background batch backfill script to compute and assign `idempotency_key` and `payload_hash` for historical movements where unambiguous document references exist.
- Add real-time Prometheus / OpenTelemetry metrics for replay frequency (`smriti_stock_ledger_replay_total`) and conflict frequency (`smriti_stock_ledger_conflict_total`).

---

## 12. Related ADRs

- **ADR-041**: Single-Door Stock Ledger Architecture & Transaction Convergence
- **ADR-028**: Pure Synchronizer Decoupling and Cash-Register Invariant

---

## 13. Related RFCs

- **RFC-2026-INV-001**: Idempotent Stock Posting and Deadlock-Free Lock Ordering
- **RFC-2026-VAL-002**: Internal Cost Dataclass and Valuation Boundary Defense
