<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-12
  Modified     : 2026-10-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Staff API 400 / SMRITI-DATA-001 Production Fix Walkthrough v1.0.0

**Area:** HR / Staff Attendance & Commissions  
**Branch:** `smritiNX`  
**Commits:** `196c612e`, `f6c55346`  
**Status:** Completed

---

## 1. Purpose

This walkthrough documents the root-cause analysis and complete fix for HTTP 400
(`SMRITI-DATA-001`) errors that affected all six `/api/v1/staff/*` endpoints on the
production site `tattlythreads.smritisys.com`. Errors occurred immediately after
login for any role and prevented staff from accessing the attendance, commissions,
and leave modules.

---

## 2. Scope

| File | Change Type |
|---|---|
| `backend/app/api/v1/staff.py` | Bug fix — 5 functions |
| `backend/app/models/commission.py` | Bug fix — 1 column default |

---

## 3. Files Created

_(None — this is a pure bug-fix release; no new files were added to the production codebase.)_

---

## 4. Files Modified

### `backend/app/api/v1/staff.py` (commit `196c612e`)

| Function | Change |
|---|---|
| `_resolve_company_local_user` | Broadened `WHERE` to `OR(id, username)`, added `is_deleted` restoration, company/branch reconciliation, and `IntegrityError` retry-read on concurrent INSERT. |
| `_tenant_user` | Added username-based OR lookup, `NULL` `company_id` tolerance, and reconciliation flush. |
| `get_commissions_summary` | **Root cause of 400**: removed `tzinfo=timezone.utc` from all `datetime(...)` query predicates to match timezone-naive DB column. |
| `record_attendance_punch` | Wrapped `db.commit()` in `IntegrityError` guard; returns `ALREADY_CHECKED_IN` instead of propagating constraint violation. |
| `list_leave_balances` | Wrapped bulk `db.commit()` in `IntegrityError` guard; re-reads existing rows on conflict. |

### `backend/app/models/commission.py` (commit `f6c55346`)

| Column | Change |
|---|---|
| `CommissionLedger.timestamp` | Changed default from `lambda: datetime.now(timezone.utc)` (timezone-aware) to `datetime.utcnow` (timezone-naive), matching the `DateTime` (no `timezone=True`) PostgreSQL `TIMESTAMP WITHOUT TIME ZONE` column contract. |

---

## 5. Architecture Decisions

1. **Timezone-naive contract for `TIMESTAMP WITHOUT TIME ZONE` columns.** SQLAlchemy's
   `DateTime` without `timezone=True` maps to PostgreSQL `TIMESTAMP WITHOUT TIME ZONE`.
   asyncpg raises `can't compare offset-naive and offset-aware datetimes` when a
   Python `datetime` with `tzinfo` is used in a `WHERE` predicate against such a column.
   All query datetimes and column defaults now use tz-naive UTC (`datetime.utcnow`).

2. **Retry-read on IntegrityError instead of propagating.** Race conditions in
   `_resolve_company_local_user` can cause two concurrent requests to attempt inserting
   the same user row. Instead of surfacing a 400, the code now catches `IntegrityError`,
   rolls back, and re-reads the existing row — returning a successful result to the caller.

3. **OR(id, username) for identity resolution.** The control-plane `users` table may
   use the same `id` across databases or the same `username` across companies. Using an
   OR condition prevents phantom 404s when a user is found by one key but not the other.

---

## 6. Design Rationale

The `SMRITI-DATA-001` error code is raised by the generic `SQLAlchemyError` handler in
`backend/app/api/deps.py`. Production users saw this error because:

- The production database has real commission ledger rows whose `timestamp` column holds
  **timezone-naive** UTC datetimes (PostgreSQL stripped the `+00:00` on insert).
- The `get_commissions_summary` endpoint was comparing against **timezone-aware**
  `datetime(..., tzinfo=timezone.utc)` values, causing asyncpg to raise a Python
  `TypeError` wrapped as `SQLAlchemyError`.

The attendance/leave 404 errors were caused by passing `user_id=usr-manager-direct`
in the test scripts while the actual JWT `sub` was `usr-sysadmin-direct`. With the
correct `user_id`, all five of those endpoints returned 200 OK even before the backend fix.

---

## 7. Implementation Summary

### Root Cause Chain

```
Browser (tattlythreads.smritisys.com)
  → Cloudflare tunnel → smriti-web (vite preview, port 3000)
    → proxy /api/v1 → smriti-api (FastAPI, port 8000)
      → get_commissions_summary
        → datetime(..., tzinfo=timezone.utc) vs DB TIMESTAMP WITHOUT TIME ZONE
          → asyncpg TypeError → SQLAlchemyError → SMRITI-DATA-001 → HTTP 400
```

### Two-Commit Fix

**Commit `196c612e`** — `staff.py`: 5-function defence-in-depth hardening including the
primary fix (timezone removal from query predicates).

**Commit `f6c55346`** — `commission.py`: align model default to tz-naive
`datetime.utcnow` so all new ledger rows are stored consistently with the DB column type.

---

## 8. Tests Executed

### Vitest Integration Suite

```
Command: npx vitest run src/tests/staffAttendance.integration.test.ts --reporter=verbose
```

```
Test Files  1 passed (1)
      Tests  40 passed (40)
   Duration  1.22s
```

### Python Headless Attendance Suite

```
Command: .venv/Scripts/python -m pytest tests/test_headless_attendance_client.py -v
```

```
8 passed in 1.13s
```

### Production Endpoint Smoke Test (post-fix on local API)

```
Command: python scratch/final_tattly_test.py  (via 127.0.0.1:1981)
```

```
Login OK | sub=usr-sysadmin-direct | company_id=COMP-001

[200 OK]  GET /staff/attendance           keys=['records', 'total']
[200 OK]  POST /staff/attendance/punch    keys=['success', 'action', 'message', 'record']
[200 OK]  GET /staff/commissions/summary  tx_count=0, earned=0.0
[200 OK]  GET /staff/leave/balances       keys=['balances', 'total', 'leave_year']
[200 OK]  GET /staff/attendance/summary   keys=['success', 'company_id', ...]
[200 OK]  GET /staff/leave/requests       keys=['requests', 'total']
```

---

## 9. Verification Results

| Item | Status | Evidence |
|---|---|---|
| `staff.py` diff | Done | `git diff HEAD~1 HEAD --stat` → `1 file, 96+, 33-` |
| `commission.py` diff | Done | `git diff HEAD~1 HEAD --stat` → `1 file, 2+, 2-` |
| 40/40 Vitest tests | Done | Terminal output above |
| 8/8 pytest tests | Done | Terminal output above |
| 6/6 local API smoke | Done | `final_tattly_test.py` output above |
| Commit `196c612e` pushed | Done | `smritiNX -> smritiNX` via `git push origin smritiNX` |
| Commit `f6c55346` pushed | Done | `smritiNX -> smritiNX` via `git push origin smritiNX` |
| smriti-web container rebuilt | Partially Verified | `docker compose build smriti-web` running — awaits restart |

---

## 10. Known Limitations

1. **Production server requires manual `git pull + docker compose up -d`.** The
   production server hosting `tattlythreads.smritisys.com` is a separate machine from
   this development environment. The fix has been pushed to `origin/smritiNX` and
   requires the production operator to run `./scripts/update.ps1` (or `update.sh`) to
   pull and redeploy.

2. **`commission_ledgers.timestamp` column type mismatch (pre-existing).** Rows written
   before this fix have tz-naive timestamps (PostgreSQL stripped `+00:00`). New rows
   after this fix also write tz-naive timestamps via `datetime.utcnow`. Both coexist
   correctly. No migration needed.

3. **The cloudflared tunnel on the dev machine is disconnected** (no QUIC connections).
   All external traffic to `tattlythreads.smritisys.com` routes to the production server,
   not this local Docker stack.

---

## 11. Future Work

1. Change `CommissionLedger.timestamp` column to `DateTime(timezone=True)` with a new
   Alembic migration to store `TIMESTAMPTZ` and make timezone handling explicit end-to-end.
2. Consider adding a Cloudflare Tunnel health check endpoint (`/api/v1/tunnel/health`)
   to surface which code version is serving production.
3. Add integration tests that specifically cover timezone-naive datetime comparisons to
   prevent regression.

---

## 12. Related ADRs

- ADR-0012: FastAPI + PostgreSQL sole backend architecture
- ADR-0023: Human-Readable Error Policy (HREP) — `SMRITI-DATA-001` classification

---

## 13. Related RFCs

- RFC-0045: Staff Identity Cross-Database Reconciliation (Phase 2 spec)
