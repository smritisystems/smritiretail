<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Version      : 3.121.0
  Created      : 2026-10-27
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# EI-001: E-Invoice Async Integration Test Suite & BaseEntity Migration Backfill — Implementation Plan v3.121.0

## 1. Objective
Deliver 12 integration tests for the async-migrated `einvoice.py` router, fix the two root-cause
failures discovered during test authoring, and permanently backfill the 8 missing BaseEntity columns
on `e_invoices`/`e_invoice_batches` via Alembic migration v1553 across all tenant databases.

## 2. Business Motivation
The UMGP sprint (v3.17.4) async-migrated `einvoice.py` but left a Known Limitation: no integration
test suite. Without tests, silent regressions in IRN generation, idempotency, and cancellation
guards are undetectable. The BaseEntity column gap causes `UndefinedColumnError` crashes on any
live endpoint call routed to asyncpg.

## 3. Scope
- Test authoring (TC-EI-001..012)
- `einvoice.py` bug fix (explicit `id=` generation)
- `conftest.py` schema compat backfill
- Alembic migration v1553
- v1551 WMS table-guard fix
- All-tenant upgrade (smriti001, smriti002, smriti003)

## 4. Current State (before this plan)
- `einvoice.py`: async-migrated, no test suite. `EInvoice` and `EInvoiceBatch` inserts missing `id=`.
- `e_invoices` / `e_invoice_batches`: missing 8 BaseEntity columns (uuid, company_id, branch_id,
  modified_at, is_active, deleted_at, deleted_by, version).
- smriti001: stamped at v1545. v1546 blocked by 127 `document_series` duplicates.
- smriti002: stamped at v1545. v1551 blocked by missing `stock_count_lines`.
- smriti003: stamped at v1552.

## 5. Gap Analysis
| Gap | Impact | Fix |
|-----|--------|-----|
| No test suite for einvoice router | Silent regressions undetectable | TC-EI-001..012 |
| `EInvoice.id` not set on insert | `NotNullViolationError` on every POST | `_new_id()` |
| 8 BaseEntity cols missing | `UndefinedColumnError` on every SELECT | conftest + v1553 |
| 127 duplicate document_series | v1546 index creation fails | Soft-dedup |
| `stock_count_lines` absent in smriti002 | v1551 halts upgrade chain | DO/EXCEPTION guard |

## 6. Architecture Impact
- No new endpoints or schemas.
- Migration chain extended: v1552 → v1553 (head).
- v1551 behaviour unchanged on WMS-enabled tenants; gracefully skipped on WMS-less tenants.

## 7. Proposed Design
See Walkthrough §5–6.

## 8. Files Created
- `backend/app/tests/test_einvoice_async.py`
- `backend/alembic/versions/v1553_einvoices_baseentity_cols.py`

## 9. Files Modified
- `backend/app/api/v1/einvoice.py`
- `backend/app/tests/conftest.py`
- `backend/alembic/versions/v1551_stock_count_lines_is_reconciled.py`

## 10. Dependencies
- PostgreSQL 15+ (asyncpg strict column resolution)
- pytest-asyncio, httpx, sqlalchemy[asyncpg]
- All three tenant databases reachable at `localhost:2781`

## 11. Risks
| Risk | Mitigation |
|------|------------|
| Dedup retires a production-active series | Kept newest by `created_at DESC`; soft-delete only |
| v1553 IF NOT EXISTS guard races | Idempotent DDL; safe to re-run |

## 12. Rollback Strategy
- v1553 `downgrade()` is a no-op (additive columns).
- Retired `document_series` rows can be re-activated by setting `is_deleted=false, is_active=true`.

## 13. Verification Plan
Run `pytest backend/app/tests/test_einvoice_async.py -v` → must show 12 passed.
Run `alembic current` on all tenants → must show `v1553 (head)`.

## 14. Test Plan
12 pytest integration tests; see Walkthrough §8.

## 15. Documentation Impact
- Walkthrough: `EInvoice_Async_Test_Suite_And_Migration_Backfill_v3.121.0.md`
- CHANGELOG: v3.121.0 entry
- Walkthrough README index: new row
- Implementation README index: new row

## 16. Deployment Plan
1. Apply conftest backfill (test isolation) — merged in `d60fba76`.
2. Run `alembic upgrade head` on each tenant — done.
3. No service restart required (DDL-only changes).

## 17. Status
**Completed** — 2026-10-27

## 18. Related ADRs
- ADR-BaseEntity-ID-Generation

## 19. Related Walkthroughs
- [EInvoice_Async_Test_Suite_And_Migration_Backfill_v3.121.0.md](../../walkthrough/invoicing/EInvoice_Async_Test_Suite_And_Migration_Backfill_v3.121.0.md)
