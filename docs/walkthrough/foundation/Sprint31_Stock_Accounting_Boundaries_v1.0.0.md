---
title: "Sprint 31: P1.3 Authoritative Stock and Accounting Boundaries (Data Plane Convergence)"
version: "1.0.0"
date: "2026-08-25"
author: "Jawahar Ramkripal Mallah"
designation: "Chief Systems Architect & Creator"
email: "support@smritibooks.com"
copyright: "© SMRITIBooks.com. All Rights Reserved."
license: "Proprietary Commercial Software"
classification: "Internal"
---

# Walkthrough: Sprint 31 — P1.3 Authoritative Stock and Accounting Boundaries (Data Plane Convergence)

## 1. Purpose
This sprint fulfills **Blueprint Section 6: P1 Transactional Data-Plane Convergence (P1.3 Authoritative Stock and Accounting Boundaries)**. It establishes strict transactional boundaries guaranteeing that every stock-changing operation writes an immutable `stock_movements` ledger entry, that materialized on-hand balances are dynamically rebuildable from movement history with zero drift, that financial vouchers enforce strict double-entry equality (`Total Debits == Total Credits`), and that automated reconciliation jobs audit stock, general ledger, payment, and tax accounts.

## 2. Scope
- **Authoritative Stock Movement Logging**: All stock-changing operations write an immutable `StockMovement` entry across 10 movement types (`IN`, `OUT`, `INWARD_GRN`, `OUTWARD_SALE`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `TRANSFER_IN`, `TRANSFER_OUT`, `RETURN_INWARD`, `RETURN_OUTWARD`) with atomic on-hand stock synchronization.
- **Dynamic Balance Rebuild & Drift Remediation Engine**: Rebuilds exact current on-hand stock from movement history and optionally fixes detected discrepancies (`fix_drift=True`).
- **Fail-Closed Double-Entry Invariant Enforcement**: `post_balanced_journal_voucher()` validates that total debits equal total credits within 0.001 tolerance, rejecting unbalanced vouchers with fail-closed errors.
- **Automated Stock Reconciliation Audit**: Scans tenant-wide stock ledgers vs current on-hand quantities, returning detailed drift analysis (`StockReconciliationReport`).
- **Automated GL Reconciliation Audit**: Verifies Trial Balance equality (Total Debits == Total Credits) and per-voucher balance invariants across the company (`GlReconciliationReport`).
- **Comprehensive Financial Reconciliation**: Combines stock, general ledger, and trial balance health audits into `FinancialReconciliationReport`.
- **REST Endpoints**: Mounted at `/api/v1/boundaries/*`.
- **Verification**: 6/6 tests passing in `backend/tests/t_stock_acct.py` (69/69 full platform regression tests green).

## 3. Files Created
- [`backend/app/schemas/stock_acct.py`](file:///F:/SMRITRretailNX/backend/app/schemas/stock_acct.py) — Pydantic schemas for stock movements, balance rebuilds, journal vouchers, and multi-ledger reconciliation reports.
- [`backend/app/services/stock_acct_svc.py`](file:///F:/SMRITRretailNX/backend/app/services/stock_acct_svc.py) — Stock and Accounting Boundary service engine.
- [`backend/app/api/v1/boundaries.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/boundaries.py) — REST API router for stock movements, rebuilds, GL postings, and reconciliation jobs.
- [`backend/tests/t_stock_acct.py`](file:///F:/SMRITRretailNX/backend/tests/t_stock_acct.py) — 6-part integration test suite.
- [`docs/walkthrough/foundation/Sprint31_Stock_Accounting_Boundaries_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/foundation/Sprint31_Stock_Accounting_Boundaries_v1.0.0.md) — This walkthrough.

## 4. Files Modified
- [`backend/app/main.py`](file:///F:/SMRITRretailNX/backend/app/main.py) — Mounted `/api/v1/boundaries` router.
- [`docs/architecture/BLUEPRINT_PENDING.md`](file:///F:/SMRITRretailNX/docs/architecture/BLUEPRINT_PENDING.md) — Updated Section 6.3 to `DONE / VERIFIED` per Rule 11.
- [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md) — Appended Sprint 31 master index entry.
- [`CHANGELOG.md`](file:///F:/SMRITRretailNX/CHANGELOG.md) — Registered `v3.47.0`.

## 5. Architecture Decisions
- **Immutable Movement Ledger**: On-hand stock in `products.stock` is treated as a materialized cache; the immutable truth resides solely in `stock_movements`.
- **Fail-Closed Double-Entry Postings**: Unbalanced financial transactions are rejected at the service layer before reaching database persistence, ensuring zero out-of-balance entries can enter `general_ledger_entries`.
- **Automated Drift Detection**: Nightly or on-demand reconciliation jobs audit movement deltas against materialized balances, detecting unauthorized manual database modifications.

## 6. Design Rationale
Enterprise retail and ERP compliance (e.g. statutory GST, Indian Accounting Standards Ind AS) requires strict financial auditability and zero unexplained stock shrinkage. Ensuring that all inventory and financial operations leave immutable, balanced journal entries ensures full audit readiness.

## 7. Implementation Summary
- **Record Movement**: `POST /api/v1/boundaries/stock-movements`
- **Rebuild Balances**: `POST /api/v1/boundaries/stock/rebuild?fix_drift={bool}`
- **Post Journal Voucher**: `POST /api/v1/boundaries/gl/post`
- **Stock Audit Job**: `GET /api/v1/boundaries/reconcile/stock`
- **GL Audit Job**: `GET /api/v1/boundaries/reconcile/gl`
- **Financial Audit Job**: `GET /api/v1/boundaries/reconcile/financial`

## 8. Tests Executed
```powershell
cd F:\SMRITRretailNX\backend
python -m pytest tests/t_stock_acct.py -v
```

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
collected 6 items

tests/t_stock_acct.py::test_record_authoritative_stock_movement PASSED   [ 16%]
tests/t_stock_acct.py::test_rebuild_materialized_balances_from_movements PASSED [ 33%]
tests/t_stock_acct.py::test_double_entry_equality_invariant_enforcement PASSED [ 50%]
tests/t_stock_acct.py::test_stock_reconciliation_detects_drift PASSED    [ 66%]
tests/t_stock_acct.py::test_gl_trial_balance_reconciliation PASSED       [ 83%]
tests/t_stock_acct.py::test_api_boundary_endpoints PASSED                [100%]

======================= 6 passed, 8 warnings in 20.36s ========================
```

## 10. Known Limitations
- Shared business engines (Pricing, Promotions, Payments, Documents) are addressed in Section 7.

## 11. Future Work
- Sprint 32: `Section 7 Pricing Engine Completion (Price lists, customer/channel/quantity pricing, effective dates, historical snapshots)`.

## 12. Related ADRs
- `ADR-001`: Sole FastAPI + Postgres Backend Architecture
- `ADR-007`: Authoritative Stock Movement & Balanced Double-Entry Accounting Ledger Boundaries

## 13. Related RFCs
- `RFC-FIN-001`: Multi-Ledger Reconciliation & Drift Remediation Engine
