<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-18
  Modified     : 2026-09-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Purchase Test Infrastructure — Conftest Savepoint Isolation & IdentityEngine ID Alignment

**Walkthrough Version:** v1.0  
**Date:** 2026-09-18  
**Commit:** `0d4532b9`  
**Branch:** `smritiNX`  
**Author:** Jawahar Ramkripal Mallah

---

## 1. Purpose

Resolve persistent and intermittent test failures in the purchase module caused by:

1. **Dirty database state across tests** — `TRUNCATE` operations on `purchase_orders` were being blocked by FK constraints from `purchase_receipts`, causing entire test transactions to abort and leaving residual `identity_code` values that produced `UniqueViolationError` on subsequent tests.
2. **Client-supplied ID mismatch** — Tests were passing client-supplied `id` values (`po-{suffix}`, `gr-{suffix}`) in POST payloads and then asserting against those same IDs. Since `IdentityEngine` allocates server-side UUIDs and `normalize_po_create` strips the client `id`, the GRN lookup and link assertions were failing against stale/incorrect IDs.

---

## 2. Scope

| Layer | Affected |
|---|---|
| Test Infrastructure | `conftest.py` — `clear_db` fixture |
| Purchase Tests | `test_purchase.py` — `test_grn_links_to_po`, `test_grn_increments_product_stock` |
| Integration Tests | `test_phase1_2_transactional_integration.py` — `test_reject_client_supplied_persistent_id` |
| Schema | `schemas/purchase.py` — `PurchaseOrderCreate` (confirmed `normalize_po_create` strips client id) |
| API | `api/v1/purchase.py` — headless audit supplier validation |
| Frontend | `PoGenerateTab.tsx` — API path corrections, payload alignment, error surfacing |
| Scripts | `scripts/audit_purchase_studio_headless.py` — new headless audit script |

---

## 3. Files Created

| File | Purpose |
|---|---|
| `scripts/audit_purchase_studio_headless.py` | Headless audit script for purchase studio supplier validation |
| `docs/walkthrough/purchase/Purchase_TestInfra_Conftest_IdentityAlignment_v1.0.md` | This walkthrough |

---

## 4. Files Modified

| File | Change Summary |
|---|---|
| `backend/app/tests/conftest.py` | Reorder purchase tables; add identity registry tables; wrap TRUNCATEs in `begin_nested()` |
| `backend/app/tests/test_purchase.py` | Use server-generated IDs from API responses; add debug assertion to `test_grn_links_to_po` |
| `backend/app/tests/test_phase1_2_transactional_integration.py` | Add `PurchaseOrderCreate` assertion to `test_reject_client_supplied_persistent_id` |
| `backend/app/schemas/purchase.py` | Confirmed `normalize_po_create` validator strips client-supplied `id` |
| `backend/app/api/v1/purchase.py` | Headless audit supplier validation improvements |
| `src/components/purchase/PoGenerateTab.tsx` | Fix trailing slash on API paths; align `order_no`/`items[]` payload; surface backend errors |

---

## 5. Architecture Decisions

### AD-1: Savepoint Isolation for TRUNCATE in clear_db

**Problem:** A single `TRUNCATE TABLE purchase_orders RESTART IDENTITY CASCADE` inside a shared async transaction would abort the entire transaction if the table had FK-dependent rows from a prior incomplete teardown — or if the table was already empty and RESTART IDENTITY raised.

**Decision:** Wrap every `TRUNCATE` in `async with db_session.begin_nested()` (a PostgreSQL savepoint). If the TRUNCATE fails, only the savepoint is rolled back; the outer transaction remains intact and the cleanup loop continues.

**Alternative considered:** `TRUNCATE ... CASCADE` without savepoints — rejected because a single failure aborts all subsequent cleanup.

### AD-2: FK-Safe Teardown Order (receipts before orders)

**Problem:** `purchase_order_items` and `purchase_orders` appeared before `purchase_receipt_items` and `purchase_receipts` in the teardown list. Since receipts FK-reference orders, truncating orders first with CASCADE would cascade-delete receipts — but when receipts were processed after, their table would be empty yet the RESTART IDENTITY would still raise.

**Decision:** Move `purchase_receipt_items` → `purchase_receipts` before `purchase_order_items` → `purchase_orders` in the `delete_order` list.

### AD-3: Identity Registry Tables in Teardown

**Problem:** `smriti_identity_allocation_log`, `smriti_identity_alias`, and `smriti_numbering_registry` were not being truncated between tests. This caused `IdentityEngine` to find existing registry entries from previous tests and either reuse or skip sequence increments, producing duplicate `identity_code` values.

**Decision:** Add all three identity tables to `clear_db`'s `delete_order` list, positioned after `company_database_registry` (which identity tables reference) and before theme/workspace tables.

### AD-4: Tests Must Use Server-Generated IDs

**Problem:** Tests were constructing payload with `"id": f"po-{suffix}"` and asserting `grn_res.json()["order_id"] == f"po-{suffix}"`. Since `normalize_po_create` strips the client `id` and `IdentityEngine` allocates a real UUID, the link assertion was comparing against a now-invalid string.

**Decision:** Remove `id` from POST payloads; capture `server_po_id = po_res.json()["id"]` and `grn_server_id = data["id"]` from API responses for all downstream assertions.

---

## 6. Design Rationale

The core principle is that **SMRITI's IdentityEngine is the sole authority for persistent IDs**. Any test that passes a client-supplied `id` and then asserts against that same `id` is testing the wrong contract. The correct contract is: POST → capture server response `id` → use that `id` for all downstream operations and assertions.

The `conftest.py` savepoint pattern is a standard PostgreSQL practice for resilient batch cleanup. It mirrors how the application itself uses savepoints for partial rollback in complex transactions.

---

## 7. Implementation Summary

### conftest.py changes

```python
# BEFORE (fragile — one failure aborts all cleanup)
await db_session.execute(text(f"TRUNCATE TABLE {tbl} RESTART IDENTITY CASCADE;"))

# AFTER (savepoint-isolated — one failure rolls back only that savepoint)
async with db_session.begin_nested():
    await db_session.execute(text(f"TRUNCATE TABLE {tbl} RESTART IDENTITY CASCADE;"))
```

Teardown order fix:
```python
# BEFORE (FK violation: orders before receipts)
"purchase_order_items",
"purchase_orders",
"purchase_receipt_items",
"purchase_receipts",

# AFTER (correct: receipts first, then orders)
"purchase_receipt_items",
"purchase_receipts",
"purchase_order_items",
"purchase_orders",
```

Identity tables added:
```python
"smriti_identity_allocation_log",
"smriti_identity_alias",
"smriti_numbering_registry",
```

### test_purchase.py changes

```python
# BEFORE (wrong — client id stripped by server)
"id": f"po-{suffix}"
assert grn_res.json()["order_id"] == f"po-{suffix}"

# AFTER (correct — use server response id)
server_po_id = po_res.json()["id"]
assert grn_res.json()["order_id"] == server_po_id
```

### PoGenerateTab.tsx changes

- Fixed API paths: `/purchase/suppliers` → `/purchase/suppliers/`, `/purchase/orders` → `/purchase/orders/`
- Aligned payload field: `order_number` → `order_no`
- Added `items: [...]` array aligned with FastAPI `PurchaseOrderCreate` schema
- Replaced silent local fallback with proper error notification on `catch`

---

## 8. Tests Executed

**Command:**
```
pytest app/tests/test_purchase.py app/tests/test_phase1_2_transactional_integration.py -v --tb=short
```

**Platform:** win32, Python 3.13.11, pytest-9.1.1  
**Location:** `F:\SMRITRretailNX\backend`

---

## 9. Verification Results

**Literal terminal output (exit code 0):**

```
collected 34 items

test_purchase.py::test_create_supplier                             PASSED [  2%]
test_purchase.py::test_list_suppliers                              PASSED [  5%]
test_purchase.py::test_cashier_cannot_create_supplier              PASSED [  8%]
test_purchase.py::test_create_purchase_order                       PASSED [ 11%]
test_purchase.py::test_create_po_invalid_supplier_returns_404      PASSED [ 14%]
test_purchase.py::test_create_po_empty_items_returns_400           PASSED [ 17%]
test_purchase.py::test_grn_increments_product_stock                PASSED [ 20%]
test_purchase.py::test_grn_updates_supplier_outstanding            PASSED [ 23%]
test_purchase.py::test_grn_zero_quantity_returns_400               PASSED [ 26%]
test_purchase.py::test_grn_links_to_po                             PASSED [ 29%]
test_purchase.py::test_cancel_purchase_order                       PASSED [ 32%]
test_purchase.py::test_cancel_nonexistent_po_returns_404           PASSED [ 35%]
test_purchase.py::test_cancel_already_cancelled_po_returns_400     PASSED [ 38%]
test_purchase.py::test_amend_purchase_order                        PASSED [ 41%]
test_purchase.py::test_amend_non_confirmed_po_returns_400          PASSED [ 44%]
test_purchase.py::test_update_supplier                             PASSED [ 47%]
test_purchase.py::test_delete_supplier_soft_deletes                PASSED [ 50%]
test_purchase.py::test_delete_nonexistent_supplier_returns_404     PASSED [ 52%]
test_purchase.py::test_list_orders_contract_url                    PASSED [ 55%]
test_purchase.py::test_list_suppliers_contract_url                 PASSED [ 58%]
test_purchase.py::test_health_flags_endpoint                       PASSED [ 61%]
test_purchase.py::test_submit_purchase_order                       PASSED [ 64%]
test_purchase.py::test_get_outstanding_report                      PASSED [ 67%]
test_purchase.py::test_get_pending_delivery_report                 PASSED [ 70%]
test_purchase.py::test_purchase_settings_returns_state             PASSED [ 73%]
test_purchase.py::test_workflow_submit_purchase_order              PASSED [ 76%]
test_purchase.py::test_workflow_cancel_purchase_order              PASSED [ 79%]
test_purchase.py::test_workflow_unknown_doctype_returns_400        PASSED [ 82%]
test_phase1_2::test_transactional_identity_codes_format_and_sequence           PASSED [ 85%]
test_phase1_2::test_ledger_boundary_stock_movements_uses_uuidv7_without_sequential_code PASSED [ 88%]
test_phase1_2::test_tier_1_transactional_identity_resolution                   PASSED [ 91%]
test_phase1_2::test_tier_2_historical_document_alias_resolution                PASSED [ 94%]
test_phase1_2::test_reject_client_supplied_persistent_id                       PASSED [ 97%]
test_phase1_2::test_transactional_creation_lifecycle_allocates_governed_identity PASSED [100%]

================ 34 passed, 11 warnings in 1618.98s (0:26:58) =================
```

**Status: Done** — 34/34 tests passed. Exit code 0.

---

## 10. Known Limitations

- 11 Pydantic v2 deprecation warnings from third-party `pydantic` and `passlib` libraries — not actionable by SMRITI source code.
- The full suite takes ~27 minutes due to sequential async DB teardown per test. Parallel execution with `pytest-xdist` is not yet configured (FK-safe isolation requires careful worker segregation).
- `backend/app/services/purchase.py` had no uncommitted changes in this session — it was modified and reverted during diagnosis.

---

## 11. Future Work

- [ ] Configure `pytest-xdist` with worker-isolated test databases to reduce suite runtime from ~27 minutes
- [ ] Add a `conftest.py` health check that verifies all identity registry tables are empty at test start (guard against incomplete teardown)
- [ ] Add Dependabot security alert triage (43 vulnerabilities flagged on push: 1 critical, 24 high, 17 moderate, 1 low)
- [ ] Run headless audit script (`scripts/audit_purchase_studio_headless.py`) against staging after `git pull` into `F:\Smriti9`

---

## 12. Related ADRs

- ADR: IdentityEngine — Server-Side UUID Allocation (prevents client-supplied ID injection)
- ADR: PostgreSQL Savepoint Strategy for Batch Cleanup

---

## 13. Related RFCs

- RFC: Purchase Module Headless Audit — Supplier Validation
