# GC-001: Gift Cards & Vouchers Async Migration Walkthrough

<!--
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.3
Created      : 2026-10-27
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
-->

---

## 1. Purpose

Eliminate the last synchronous SQLAlchemy `Session` execution path in the
Gift Cards & Vouchers module. Before this sprint, all 12 gift card endpoints
in `backend/app/api/v1/gift_cards.py` used `sync Session / get_db`, which is
incompatible with the project's FastAPI + AsyncPostgres sole-backend
architecture policy. The migration aligns the module with every other
post-strangler-fig module in the codebase.

---

## 2. Scope

| Item | Detail |
|---|---|
| Sprint ID | GC-001 |
| Release | v3.17.3 |
| Commit | `759ad8d5` |
| Files changed | 4 (2 created, 2 modified) |
| Tests | 14 new integration tests |
| Migration | v1552 (additive, IF NOT EXISTS) |
| DB impact | `gift_cards`, `gift_vouchers`, `gift_card_transactions` — BaseEntity column backfill |

---

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/alembic/versions/v1552_gift_cards_baseentity_cols.py` | Adds `uuid VARCHAR(36)`, `version`, `is_active`, `deleted_at`, `deleted_by` to all 3 gift tables using `IF NOT EXISTS` DDL |
| `backend/app/tests/test_gift_cards_async.py` | 14-case async integration test suite (TC-GC001–TC-GC014) |

---

## 4. Files Modified

| File | Change |
|---|---|
| `backend/app/api/v1/gift_cards.py` | All 12 endpoints converted from `def` → `async def`, `Session` → `AsyncSession`, `get_db` → `get_company_db`, `db.query()` → `select()` style; helpers `_get_card` and `_get_voucher` made async; explicit `id=_new_id()` generation added to all new ORM objects |
| `backend/app/tests/conftest.py` | `_ensure_schema_compatibility_sync` extended with 36 `ALTER TABLE IF NOT EXISTS` statements covering all BaseEntity columns for `gift_cards`, `gift_vouchers`, `gift_card_transactions` |

---

## 5. Architecture Decisions

### AD-1: Use `get_company_db` (tenant session) not `get_db` (control session)
Gift cards are tenant-scoped data. The original sync router used the global
`get_db` (control session) which masked the schema gap. The async migration
correctly routes to `get_company_db` (per-tenant `AsyncSession`), which is
the canonical dependency per the Backend Architecture Policy.

### AD-2: BaseEntity column backfill via IF NOT EXISTS DDL, not table recreation
The `gift_cards`, `gift_vouchers`, and `gift_card_transactions` tables were
created before `uuid`, `version`, `is_active`, `deleted_at`, and `deleted_by`
were added to `BaseEntity`. Rather than recreating tables (data-loss risk),
migration v1552 adds only the missing columns idempotently. The `downgrade()`
is a deliberate no-op — column removal is a data-loss operation.

### AD-3: `VARCHAR(36)` for uuid, not native `UUID` type
The `BaseEntity.uuid` ORM column is declared as `String` (mapped to
`VARCHAR`). Using native PostgreSQL `UUID` type in the DDL causes a
`DatatypeMismatchError` at asyncpg prepare time because asyncpg binds the
value as `$N::VARCHAR`. `VARCHAR(36)` is consistent with every other
schema_fixes entry in `conftest.py`.

### AD-4: Conftest `_ensure_schema_compatibility_sync` as the authoritative backfill path
The test harness provisions a fresh template DB per pytest session using
`EphemeralTenantHarness` + `CREATE DATABASE ... TEMPLATE`. Alembic migrations
run on the template, but `_ensure_schema_compatibility_sync` runs
synchronously afterward to patch any known schema gaps before the template is
frozen and cloned per test. This is the established pattern (36 prior entries)
and the right place for gift card fixes.

---

## 6. Design Rationale

The sync router predated the strangler-fig migration policy. Once
`get_company_db` is used, asyncpg's strict statement-preparation surfaced five
compounded issues that were silently tolerated by the sync driver: wrong URL
prefix, missing uuid column, missing BaseEntity columns, uuid type mismatch,
and tz-aware/naive datetime mismatch. Each was diagnosed and fixed
incrementally across 5 test runs, with the final run producing 14/14 green.

---

## 7. Implementation Summary

### Router (`gift_cards.py`)
- `from sqlalchemy.orm import Session` → `from sqlalchemy.ext.asyncio import AsyncSession`
- `from ...db.session import get_db` → `from ...api.deps import get_company_db`
- All 12 route functions: `def` → `async def`
- All `db: Session = Depends(get_db)` → `db: AsyncSession = Depends(get_company_db)`
- `db.query(Model).filter(...)` → `await db.execute(select(Model).where(...))`
- `db.add()` unchanged; `db.flush()` → `await db.flush()`; `db.commit()` → `await db.commit()`; `db.refresh()` → `await db.refresh()`
- `_get_card` and `_get_voucher` helpers made `async`
- Added `_new_id()` helper returning `str(uuid.uuid4())` for explicit PK generation

### Migration (v1552)
- Chain: `v1551 → v1552`
- Adds 5 columns per table × 3 tables = 15 DDL statements, all `IF NOT EXISTS`
- `downgrade()` is a no-op (additive-only policy)

### Conftest
- 36 new entries in `schema_fixes` list
- Pattern: `ALTER TABLE IF EXISTS <table> ADD COLUMN IF NOT EXISTS <col> <type>;`
- Applied synchronously to the session-scoped template DB before it is frozen

---

## 8. Tests Executed

Command:
```
$env:SMRITI_TEST_DATABASE_NAME = "smriti_test_gc001f"
pytest backend/app/tests/test_gift_cards_async.py -v --tb=short --no-header
```

| TC | Name | Assertion |
|---|---|---|
| TC-GC001 | `test_gc001_issue_gift_card` | ACTIVE status, balance == face_value, ISSUE txn recorded |
| TC-GC002 | `test_gc002_duplicate_card_no_rejected` | 409 on duplicate card_no |
| TC-GC003 | `test_gc003_topup_increases_balance` | Balance increases, TOPUP txn recorded |
| TC-GC004 | `test_gc004_topup_blocked_card_rejected` | 400 on topup of BLOCKED card |
| TC-GC005 | `test_gc005_redeem_full_balance_transitions_to_redeemed` | REDEEMED status when balance hits 0 |
| TC-GC006 | `test_gc006_redeem_exceeds_balance_rejected` | 400 Insufficient balance |
| TC-GC007 | `test_gc007_block_active_card` | BLOCKED status, BLOCK txn recorded |
| TC-GC008 | `test_gc008_list_filtered_by_status` | List filter by status returns correct subset |
| TC-GC009 | `test_gc009_transaction_ledger_desc_order` | Txn ledger newest-first: REDEEM → TOPUP → ISSUE |
| TC-GC010 | `test_gc010_issue_gift_voucher` | ACTIVE voucher, auto-generated GV- code |
| TC-GC011 | `test_gc011_duplicate_voucher_no_rejected` | 409 on duplicate voucher_no |
| TC-GC012 | `test_gc012_redeem_active_voucher` | USED status, invoice_no and used_at recorded |
| TC-GC013 | `test_gc013_redeem_expired_voucher_rejected` | 400 expired for past valid_to |
| TC-GC014 | `test_gc014_cancel_active_voucher` | CANCELLED status; double-cancel → 400 |

---

## 9. Verification Results

**Evidence (literal terminal output):**
```
backend\app\tests\test_gift_cards_async.py::test_gc001_issue_gift_card PASSED [  7%]
backend\app\tests\test_gift_cards_async.py::test_gc002_duplicate_card_no_rejected PASSED [ 14%]
backend\app\tests\test_gift_cards_async.py::test_gc003_topup_increases_balance PASSED [ 21%]
backend\app\tests\test_gift_cards_async.py::test_gc004_topup_blocked_card_rejected PASSED [ 28%]
backend\app\tests\test_gift_cards_async.py::test_gc005_redeem_full_balance_transitions_to_redeemed PASSED [ 35%]
backend\app\tests\test_gift_cards_async.py::test_gc006_redeem_exceeds_balance_rejected PASSED [ 42%]
backend\app\tests\test_gift_cards_async.py::test_gc007_block_active_card PASSED [ 50%]
backend\app\tests\test_gift_cards_async.py::test_gc008_list_filtered_by_status PASSED [ 57%]
backend\app\tests\test_gift_cards_async.py::test_gc009_transaction_ledger_desc_order PASSED [ 64%]
backend\app\tests\test_gift_cards_async.py::test_gc010_issue_gift_voucher PASSED [ 71%]
backend\app\tests\test_gift_cards_async.py::test_gc011_duplicate_voucher_no_rejected PASSED [ 78%]
backend\app\tests\test_gift_cards_async.py::test_gc012_redeem_active_voucher PASSED [ 85%]
backend\app\tests\test_gift_cards_async.py::test_gc013_redeem_expired_voucher_rejected PASSED [ 92%]
backend\app\tests\test_gift_cards_async.py::test_gc014_cancel_active_voucher PASSED [100%]

================= 14 passed, 28 warnings in 145.87s (0:02:25) =================
```

Exit code: **0**

**Git diff --stat (commit `759ad8d5`):**
```
backend/alembic/versions/v1552_gift_cards_baseentity_cols.py |  58 +++
backend/app/api/v1/gift_cards.py                            | 291 ++++++---
backend/app/tests/conftest.py                               |  38 +++
backend/app/tests/test_gift_cards_async.py                  | 373 ++++++++++++
4 files changed, 676 insertions(+), 84 deletions(-)
```

**Status: Done** — 14/14 tests green, commit `759ad8d5`, isolated test DB `smriti_test_gc001f`.

---

## 10. Known Limitations

- `smriti001` dev DB is blocked at v1545→v1546 migration due to a pre-existing
  `CREATE UNIQUE INDEX` conflict on `document_series` (COMP-001 duplicate rows).
  This is unrelated to GC-001 and must be resolved separately via a data-cleanup
  migration on `smriti001`.
- `GiftCard.issued_by` field is not populated by the router (no payload field).
  The column exists but is always NULL on newly issued cards.

---

## 11. Future Work

- Add `issued_by` to `GiftCardCreate` schema and populate from auth context.
- Add `GET /gift-cards/by-card-no/{card_no}` lookup endpoint for POS integration.
- Add PIN verification to redeem endpoint (`pin_hash` column exists but unused).
- Add scheduled expiry job to transition `valid_to`-exceeded cards to `EXPIRED`.
- Resolve smriti001 v1546 migration conflict (separate sprint).

---

## 12. Related ADRs

- SMRITI Backend System-of-Record Policy (AGENTS.md Rule 1) — FastAPI + Postgres sole backend
- SMRITI Platform Architecture & Communication Layer (AGENTS.md) — `get_company_db` for tenant data

---

## 13. Related RFCs

- Strangler-Fig Migration v3.17 series (Express → FastAPI async)
- PHY-005 WMS Physical Stock Approval Movement Commitment walkthrough (same release)
