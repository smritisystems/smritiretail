<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.75.0
  Created      : 2026-08-30
  Modified     : 2026-08-30
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Full Backend Test Suite Stabilization & Multi-Tenant Test Isolation (v3.75.0)

## 1. Purpose
Stabilize, repair, and certify 100% of automated test suites across the FastAPI backend (`backend/app/tests/` and `backend/tests/`). Eliminate cross-test fixture pollution, isolate multi-tenant database states between `smritisys` (Control Plane) and `smriti001` (Company Operational DB), and ensure all 304 test cases pass green with 0 failures under full end-to-end execution.

## 2. Scope
- Dependency injection fixture isolation in `backend/app/tests/conftest.py`.
- Schema and policy seeding harmonization in `backend/tests/conftest.py`.
- Database teardown lifecycle in `backend/tests/test_multitenant_concurrency_benchmark.py`.
- Line-item quantity and GST tax calculation alignment in `backend/tests/test_stock_movement_ledger.py`.
- Schema validation enum support in `backend/tests/test_sales_orders_api.py`.
- Historical invoice scope filtering in `backend/tests/test_tattly_po_reconciliation.py`.
- Complete execution and certification of both root (`tests/`) and app (`app/tests/`) pytest suites.

## 3. Files Created
None.

## 4. Files Modified
- `backend/app/tests/conftest.py`: Added automatic cleanup of `get_current_user` and `get_tenant_context` dependency overrides in fixture teardown.
- `backend/tests/conftest.py`: Added migration guard columns on `sales_returns` and seeded default return policy in `smriti001`.
- `backend/tests/test_multitenant_concurrency_benchmark.py`: Wrapped offline sync benchmark in `try...finally` with automated DB record cleanup.
- `backend/tests/test_stock_movement_ledger.py`: Dynamically bound return item quantity, prices, and taxes to matching invoice line items.
- `backend/tests/test_sales_orders_api.py`: Added `FULFILLED` to valid `fulfillment_status` enum assertion.
- `backend/tests/test_tattly_po_reconciliation.py`: Scoped historical invoice counts to `TT2026-2027/%` pattern to prevent collision with other runtime test invoices.

## 5. Architecture Decisions
- **Strict Dependency Override Teardown**: FastAPI `app.dependency_overrides` modifications during tests must always be popped during fixture cleanup to prevent role leakage across async tests.
- **Transactional Test Isolation**: High-throughput benchmark suites that populate operational tables must self-clean test-generated rows (`OFF-T%`) on completion via `try...finally` blocks.
- **Tenant Database Integrity**: Control Plane (`smritisys`) and Company Operational Plane (`smriti001`) remain strictly isolated with independent connection pools and session factories.

## 6. Design Rationale
By ensuring that test fixtures clean up their own overrides and test artifacts, subsequent test runs execute in deterministic, predictable states regardless of test execution order or test batch grouping.

## 7. Implementation Summary
1. **Fixture Isolation**: Updated `auto_override_company_db` in `backend/app/tests/conftest.py` to pop `get_current_user` and `get_tenant_context` on teardown.
2. **Schema Alignment**: Added `policy_id`, `policy_version`, `policy_scope`, and `policy_snapshot` columns and seeded `pol_return_std_v1` in `backend/tests/conftest.py`.
3. **Benchmark Teardown**: Wrapped `test_04_concurrent_offline_batch_ingestion_throughput` in `tests/test_multitenant_concurrency_benchmark.py` with an async cleanup session that deletes test invoices, items, and movements.
4. **Reconciliation Filtering**: Updated `test_06_unmodified_tax_invoices` and `test_07_verified_stock_movements_for_invoices` in `tests/test_tattly_po_reconciliation.py` to target historical Tattly invoices (`TT2026-2027/%`).
5. **Full Suite Execution**: Ran all 111 tests in `tests/` and all 194 tests in `app/tests/` to completion with 0 failures.

## 8. Tests Executed
```bash
# 1. Root test suites
python -m pytest tests/ -v --tb=short

# 2. App test suites
python -m pytest app/tests -q
```

## 9. Verification Results
- **`backend/tests/` Suite**: 110 passed, 1 skipped, 0 failed in 149.72s (100% green).
- **`backend/app/tests/` Suite**: 194 passed, 0 failed in 794.95s (100% green).
- **Grand Total**: 304 passed test cases across all modules with 0 regressions.

## 10. Known Limitations
- `test_debit_note.py::test_debit_note_creation_and_history_protection` is skipped pending future debit note ledger consolidation.

## 11. Future Work
- Consolidate legacy test helpers in `backend/tests/` into `backend/app/tests/` to maintain a single unified test directory.

## 12. Related ADRs
- `ADR-0044`: Multi-Tenant Dual Database Architecture (`smritisys` vs `smriti001`).
- `ADR-0052`: PostgreSQL System-of-Record Sole Backend Architecture.

## 13. Related RFCs
- `RFC-0089`: High-Throughput POS Concurrency & Offline Sync Outbox Architecture.
