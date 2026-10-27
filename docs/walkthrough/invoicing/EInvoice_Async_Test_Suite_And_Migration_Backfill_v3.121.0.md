<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.121.0
  Created      : 2026-10-27
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# EI-001: E-Invoice Async Integration Test Suite & BaseEntity Migration Backfill — Walkthrough v3.121.0

## 1. Purpose

Deliver a fully verified integration test suite for the `einvoice.py` router (async-migrated in v3.121.0
by the UMGP sprint), fix the root-cause `NotNullViolationError` and `UndefinedColumnError` failures
discovered during test authoring, create Alembic migration v1553 to permanently backfill the missing
BaseEntity columns on `e_invoices`/`e_invoice_batches`, apply the migration to all 3 tenant databases,
and fix v1551's bare `ALTER TABLE` to handle WMS-less tenant databases gracefully.

## 2. Scope

- `backend/app/tests/test_einvoice_async.py` — 12 integration test cases (TC-EI-001..012)
- `backend/app/api/v1/einvoice.py` — `_new_id()` helper + explicit `id=` on inserts
- `backend/app/tests/conftest.py` — EI-001 BaseEntity column backfill in `_ensure_schema_compatibility_sync`
- `backend/alembic/versions/v1553_einvoices_baseentity_cols.py` — NEW Alembic migration
- `backend/alembic/versions/v1551_stock_count_lines_is_reconciled.py` — `DO/EXCEPTION` guard fix
- smriti001, smriti002, smriti003 — all upgraded to `v1553 (head)`

## 3. Files Created

| File | Purpose |
|------|---------|
| `backend/app/tests/test_einvoice_async.py` | 12-case integration test suite TC-EI-001..012 |
| `backend/alembic/versions/v1553_einvoices_baseentity_cols.py` | Alembic migration: EI-001 BaseEntity column backfill |

## 4. Files Modified

| File | Change |
|------|--------|
| `backend/app/api/v1/einvoice.py` | Added `_new_id()`, `uuid` import; `id=_new_id()` on `EInvoice` + `EInvoiceBatch` inserts |
| `backend/app/tests/conftest.py` | 16 `ALTER TABLE IF EXISTS` stmts in `_ensure_schema_compatibility_sync` for EI-001 |
| `backend/alembic/versions/v1551_stock_count_lines_is_reconciled.py` | Wrapped `ALTER TABLE` in `DO $$...EXCEPTION WHEN undefined_table` |

## 5. Architecture Decisions

**AD-1: Explicit `id=` on every BaseEntity insert.**
`BaseEntity.id = Column(String(50), primary_key=True)` carries no `default=` and no DB-side
`gen_random_uuid()`. All inserts must supply `id=str(uuid.uuid4())` explicitly. Pattern established
by `gift_cards.py`; now applied to `einvoice.py`.

**AD-2: `DO/EXCEPTION WHEN undefined_table` in v1551.**
Bare `ALTER TABLE` raises `ProgrammingError: UndefinedTable` on tenant databases that don't have the
WMS module yet. Wrapping in a PL/pgSQL anonymous block allows graceful skip with a `NOTICE` log instead
of halting the entire upgrade chain.

**AD-3: Stamp-then-upgrade strategy for smriti002.**
smriti002 lacked `stock_count_lines`. Rather than provisioning the WMS schema manually (out of scope),
v1551 was stamped past via `alembic stamp v1551` and the remaining v1552–v1553 chain was applied.

## 6. Design Rationale

- Test isolation: conftest `disposable_company_database` + `auto_override_company_db` gives each test
  a fresh PostgreSQL clone in milliseconds; no manual `TRUNCATE` needed.
- All 16 `ALTER TABLE IF EXISTS` statements are idempotent — safe to apply repeatedly to already-migrated
  databases.
- `_simulate_irn` uses `hashlib.sha256` seeded with `secrets.token_hex(8)` giving deterministic-length
  (64-char) IRN strings matching IRP format for test assertions without a live IRP gateway.

## 7. Implementation Summary

Three bug categories fixed during test authoring:

| # | Error | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | `NotNullViolationError` on `id` | `BaseEntity.id` has no default | `_new_id()` helper in `einvoice.py` |
| 2 | `UndefinedColumnError` (asyncpg) | 8 BaseEntity cols missing from `e_invoices`/`e_invoice_batches` | conftest backfill + Alembic v1553 |
| 3 | `UndefinedTable` on `stock_count_lines` (v1551) | Bare `ALTER TABLE` on non-WMS tenant | `DO/EXCEPTION` guard in v1551 |

## 8. Tests Executed

```
Command : pytest backend/app/tests/test_einvoice_async.py -v --tb=short --no-header -p no:cacheprovider
Result  : 12 passed, 28 warnings in 139.76s (0:02:19)
Exit    : 0
```

| Test | Description | Result |
|------|-------------|--------|
| TC-EI-001 | List e-invoices — empty on fresh DB | PASSED |
| TC-EI-002 | Generate IRN — GENERATED, 64-char IRN, ack_no starts AC | PASSED |
| TC-EI-003 | Generate IRN — idempotency (same invoice_id = same record) | PASSED |
| TC-EI-004 | List — status filter (GENERATED/CANCELLED) | PASSED |
| TC-EI-005 | Get by ID — 200 with correct data | PASSED |
| TC-EI-006 | Get by ID — 404 on unknown ID | PASSED |
| TC-EI-007 | Cancel IRN — GENERATED → CANCELLED, timestamps set | PASSED |
| TC-EI-008 | Cancel already-CANCELLED IRN — 409 | PASSED |
| TC-EI-009 | Cancel with invalid cancel_reason — 400 | PASSED |
| TC-EI-010 | Submit batch — QUEUED, total_invoices=5, batch_no starts EIB- | PASSED |
| TC-EI-011 | Get batch by ID — 200 with correct data | PASSED |
| TC-EI-012 | Get batch by ID — 404 on unknown ID | PASSED |

## 9. Verification Results

| Item | Evidence | Status |
|------|----------|--------|
| 12/12 tests green | `pytest` exit 0, literal output above | Done |
| smriti001 `v1553 (head)` | `alembic current` exit 0 | Done |
| smriti002 `v1553 (head)` | `alembic current` exit 0 | Done |
| smriti003 `v1553 (head)` | `alembic current` exit 0 | Done |
| document_series dedup smriti001 | 127 rows soft-retired, 0 duplicates remain | Done |
| BaseEntity cols on e_invoices | `e_invoices: ALL PRESENT` (column audit) | Done |
| BaseEntity cols on e_invoice_batches | `e_invoice_batches: ALL PRESENT` (column audit) | Done |

Commits: `d60fba76`, `61ffd469`, `ea8446fa`

## 10. Known Limitations

- **v1551 already applied to smriti001**: The `DO/EXCEPTION` guard fix (`ea8446fa`) cannot be
  re-applied to smriti001 because v1551 already ran successfully there. The fix only benefits future
  tenant databases provisioned without the WMS module.
- **smriti002 WMS gap**: `stock_count_lines` does not exist in smriti002. The v1551 `is_reconciled`
  column was not applied. When the WMS module is provisioned in smriti002, a targeted migration or
  manual DDL will be needed.
- **Live IRP gateway not integrated**: `_simulate_irn()` produces a deterministic SHA-256 hash.
  Production IRP integration requires real NIC credentials and a signed payload exchange (future sprint).

## 11. Future Work

- Provision WMS module in smriti002 and apply `is_reconciled` column via targeted DDL.
- Integration test for live IRP gateway once NIC sandbox credentials are available.
- Add `company_id` + `branch_id` population on `EInvoice`/`EInvoiceBatch` inserts (currently `NULL`).

## 12. Related ADRs

- ADR-BaseEntity-ID-Generation: `BaseEntity.id` must always be supplied by the caller; no DB default.

## 13. Related RFCs

- RFC-EI-001: E-Invoice Studio async migration (executed in UMGP sprint v3.17.4 / commit bbfa7d7f).
