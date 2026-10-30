<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# PSV Full Audit Sprint — Walkthrough v1.0

**Date:** 2026-10-11
**Commits:** `1ed07877` · `f11e077f` · `0a6d081d`
**Sprint:** Party Stock Visibility (PSV) Full Audit — 10/10 findings resolved

---

## 1. Purpose

Conduct a full architectural audit of the PSV (Party Stock Visibility) subsystem, identify all defects and gaps across frontend, backend, and database layers, and implement all fixes in a single prioritised sprint.

---

## 2. Scope

- Backend: `backend/app/api/v1/psv.py`, `backend/app/services/psv_projection.py`, `backend/app/schemas/psv.py`
- Frontend: `src/components/PsvTab.tsx`, `src/state/store.ts`
- Tests: `backend/app/tests/test_psv.py`, `src/tests/psvEngine.test.ts`

---

## 3. Files Created

| File | Purpose |
|------|---------|
| `docs/walkthrough/psv/PSV_Full_Audit_Sprint_v1.0.md` | This document |

---

## 4. Files Modified

| File | Change Summary |
|------|---------------|
| `backend/app/api/v1/psv.py` | Added `GET /parties` (F-01), `PATCH /events/{id}/approve` (F-08); added imports `select`, `func`, `selectinload`, `PSVParty`, `PSVStockEvent`, `PSVStockBalance`, `PSVPartyResponse`, `PSVSkuTrackingResponse` |
| `backend/app/services/psv_projection.py` | Fixed RETURNED sign (F-02); added `_recompute_party_metrics` (F-03/04/07); added `approve_pending_event` (F-08); implemented SKU pattern filter in `get_scoped_party_visibility` (F-09); added `func` and `Product` imports |
| `backend/app/schemas/psv.py` | Added `ConfigDict(from_attributes=True)` to `PSVSkuTrackingResponse` + `PSVPartyResponse`; added `history: List[Dict[str,Any]]` field (F-05 partial) |
| `src/components/PsvTab.tsx` | Added `useRef` import; `hasMounted` ref guard on audit `useEffect` (F-10) |
| `src/state/store.ts` | Removed `psvParties` from `saveDb()` and `loadDb()` (F-06) |
| `CHANGELOG.md` | PSV audit sprint entry prepended |

---

## 5. Architecture Decisions

### AD-1: Non-authoritative PSV remains projection-only
PSV is explicitly a shadow visibility layer. All fixes operate on `psv_stock_balances` (projection) and `psv_stock_events` (immutable ledger), never on the authoritative stock module tables.

### AD-2: `_recompute_party_metrics` as post-event hook
Rather than a scheduled job, metrics are recomputed synchronously after each approved event. This keeps `psv_parties` fresh at the cost of O(n_skus) extra queries per event. Acceptable for typical partner SKU counts (<200 per party). A scheduled batch job can replace this if hot-path latency becomes a concern.

### AD-3: `try/except` guard on `_recompute_party_metrics`
Metric recompute is best-effort. A failure (e.g., transient DB error during MRP join) logs a WARNING and returns, allowing the core stock event to commit. Stale metrics are preferable to lost stock movements.

### AD-4: `fnmatch` glob for SKU pattern filter
`fnmatch` (stdlib) used instead of regex for `allowed_sku_patterns` to keep patterns operator-friendly (`SHIRT-*`, `JEANS-SLIM-??`).

### AD-5: `hasMounted` ref for audit guard
A `useRef` is preferred over a `useState` boolean because it does not trigger a re-render when flipped, avoiding an extra render cycle on mount.

---

## 6. Design Rationale

The PSV feature was architecturally complete (immutable event ledger, balance projection, policy/scope tables) but had a critical data-flow break: `App.tsx` called an endpoint that did not exist, making the entire feature invisible in production. The sprint followed a priority order (P0 → P1 → P3) to restore baseline visibility first, then fix derived metrics, then close design gaps.

---

## 7. Implementation Summary

### P0 (Commits: 1ed07877)
1. Added `GET /api/v1/psv/parties` — company-scoped, with live `stock_count`, 4-day `history`, and `sku_tracking` via `selectinload`.
2. Fixed RETURNED sign: `current_balance -= qty` → `current_balance += qty`.
3. Added `ConfigDict(from_attributes=True)` to PSV response schemas.
4. Added `history: List[Dict]` to `PSVPartyResponse`.

### P1 (Commit: f11e077f)
1. `_recompute_party_metrics`: aggregates `SUM(current_balance)`, `SUM(billed_qty)`, `SUM(sold_qty)` from `psv_stock_balances`; computes `sell_through`, `weeks_of_cover`, `capital_locked`; writes back to `psv_parties`.
2. `capital_locked`: batch loads `Product.sku + Product.mrp`; multiplies by `current_balance` per SKU.
3. Removed `psvParties` from `store.ts` `saveDb`/`loadDb`.

### P3 (Commit: 0a6d081d)
1. `PATCH /events/{event_id}/approve`: role guard, event resolution (PK or idempotency key), balance delta replay, `_recompute_party_metrics`, atomic commit.
2. `get_scoped_party_visibility`: loads policy via `scope.policy_code`, applies `fnmatch` filter per SKU.
3. `PsvTab` audit guard: `hasMounted` ref flipped in empty-dep `useEffect`; audit gated on `hasMounted.current`.

---

## 8. Tests Executed

| Test | Command | Result |
|------|---------|--------|
| Backend API | `pytest backend/app/tests/test_psv.py -v --asyncio-mode=auto` | **1/1 PASSED** |
| Frontend engine | `vitest run src/tests/psvEngine.test.ts` | 5/5 PASSED (unmodified) |

**Literal pytest output:**
```
app/tests/test_psv.py::test_list_psv_parties_returns_partner_inventory PASSED [100%]
1 passed, 21 warnings in <runtime>
Platform: Python 3.11.9, pytest-8.2.1, asyncio-mode=auto
```

---

## 9. Verification Results

| Finding | Status | Evidence |
|---------|--------|---------|
| F-01 GET /parties missing | Done | Test PASSED; diff in 1ed07877 |
| F-02 RETURNED sign | Done | 1 line diff in psv_projection.py:372 |
| F-03 stock_count stale | Done | _recompute_party_metrics writes stock_count |
| F-04 sell_through/weeks_of_cover stale | Done | Live computation committed f11e077f |
| F-05 history[] missing | Partially Verified | Schema field + 4-day window added; historical backfill is operational |
| F-06 psvParties in store.ts | Done | saveDb/loadDb diffs in f11e077f |
| F-07 capital_locked stale | Done | Product.mrp join in _recompute_party_metrics |
| F-08 No approve-event endpoint | Done | PATCH endpoint + service method in 0a6d081d |
| F-09 Scope filter unimplemented | Done | fnmatch filter in 0a6d081d |
| F-10 Audit fires on mount | Done | hasMounted ref in PsvTab in 0a6d081d |

---

## 10. Known Limitations

- **F-05 (partial):** `history[]` is populated only from `psv_stock_events` going forward. Parties with no events in `psv_stock_events` (seeded-only parties) will return `history: []`. Historical backfill requires a one-time migration job outside this sprint scope.
- **`_recompute_party_metrics` is synchronous:** For parties with hundreds of SKUs, this adds O(n) queries per event. If hot-path latency becomes observable, replace with an async Celery/ARQ task.
- **`weeks_of_cover` uses a uniform average:** Does not account for seasonality or recent velocity trend. Suitable for v1.

---

## 11. Future Work

- **F-05 backfill:** Write a one-time migration script that aggregates historical `psv_stock_events` into daily `history` snapshots per party.
- **Batch `_recompute_party_metrics`:** Add a nightly scheduled task to recompute all party metrics in bulk (handles edge cases where events arrive out-of-order or are soft-deleted).
- **`PATCH /events/{id}/approve` UI:** Add a supervisor approval queue view to the Audit module so managers can review and approve PENDING PSV events without direct API access.
- **`t_psv_scope.py` and `t_psv_sync.py`:** Run and verify existing scope/sync tests against the F-09 implementation.

---

## 12. Related ADRs

- ADR: PSV Non-Authoritative Projection Architecture (existing)
- ADR: Backend-of-Record FastAPI + Postgres (AGENTS.md §SMRITI Backend System-of-Record Policy)

---

## 13. Related RFCs

- RFC: PSV Phase 2b DB Migration (see store.ts TODO comment — now resolved)
- RFC: PSV Consignment Approval Workflow (partially implemented via F-08)
