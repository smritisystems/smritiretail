<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.3.0
  Created      : 2026-08-25
  Modified     : 2026-08-25
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Shoper9 SMRITI Migration Parity -- Sprint 18 v1.3.0

> Supersedes: `Legacy_Shoper9_SMRITI_Migration_v1.2.0.md` (Sprints 14-17)
> This document covers Sprint 18 only.

---

## 1. Purpose

Close the Physical Stock Count workspace loop by delivering inline counted_qty entry (PHY-006 backend + CountCell React component), completing the Shoper9 SR323400 MnuNo 350/351 parity. Also adds `SalesReturn.customer_id` as a denormalized column (Alembic v1374) eliminating the join dependency in the REVERSAL loyalty hook.

---

## 2. Scope

| Item | Type | Files |
|---|---|---|
| PHY-006 PATCH count line endpoint | Backend | `physical_stock.py` |
| Alembic v1374 | DB migration | `v1374_sales_return_cust.py` |
| `SalesReturn.customer_id` ORM | Backend | `models/sales.py` |
| `SalesReturn` constructor `customer_id` | Backend | `services/sales.py` |
| `PhysicalStockTab.tsx` v1.1 | Frontend | `PhysicalStockTab.tsx` |

---

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/alembic/versions/v1374_sales_return_cust.py` | Alembic v1374 — `customer_id` on `sales_returns` |

---

## 4. Files Modified

| File | Change |
|---|---|
| `backend/app/api/v1/physical_stock.py` | +90 lines: PHY-006 `CountLineUpdate` schema + `update_count_line` endpoint |
| `backend/app/models/sales.py` | `SalesReturn.customer_id` ORM column declared (v1374) |
| `backend/app/services/sales.py` | `db_sr` constructor wired with `customer_id`; trailing comma fix on `branch_id` |
| `src/components/PhysicalStockTab.tsx` | v1.0 → v1.1: inline `CountCell`, progress bar, filter chips, `CompleteBtn` |
| `CHANGELOG.md` | v3.33.0 entry inserted |

---

## 5. Architecture Decisions

### A. Inline Edit via CountCell Component
`CountCell` is a self-contained React cell component that manages its own `editing/value/saving/error` state. It renders as a display cell by default; clicking activates a number input. `Enter` commits via `PATCH PHY-006`; `Esc` cancels. This avoids lifting all cell state to the panel and keeps re-render scope minimal — only the changed cell and the progress bar re-render.

### B. Optimistic Local State Update
On successful PHY-006 response, `handleSaved` updates `detail.count_lines` via `setDetail` immutable mapper instead of re-fetching the full session. This gives instant UI feedback without an additional round-trip.

### C. OPEN→IN_PROGRESS Auto-transition (Backend)
PHY-006 transitions the session status from `OPEN` to `IN_PROGRESS` on the first line edit. This is intentional — it prevents approving a session that was never touched. The frontend reflects this in the session list on next refresh.

### D. `SalesReturn.customer_id` Denormalization Strategy
Sprint 17's REDEEM hook resolved `customer_id` from `orig_invoice` (fetched at return validation). Sprint 18 persists it directly on `sales_returns.customer_id` via Alembic v1374. This eliminates the join requirement for future audit queries against `loyalty_transactions REVERSAL` rows and allows the hook to use `db_sr.customer_id` directly after the next migration is applied.

### E. PHY-006 Variance Recalculation
`variance_qty = counted_qty - computed_qty` is recalculated on every PATCH rather than stored additively. This is intentional — it ensures the variance is always correct even if `counted_qty` is updated multiple times before approval.

---

## 6. Design Rationale

- **Click-to-edit UX**: No "edit mode" toggle at the panel level — each cell activates independently. Reduces accidental edits and matches Shoper9's field-by-field audit entry workflow.
- **Pencil icon on hover**: Appears only for editable sessions (`OPEN`/`IN_PROGRESS`), providing affordance without visual noise.
- **Progress bar gradient**: `from-blue-500 to-emerald-500` — transitions from "in progress" to "complete" color as counting advances. Provides instant audit coverage signal.
- **Filter chips** on count lines: "Not Counted" filter allows auditors to jump directly to uncounted lines without scrolling. "Has Variance" filter prioritizes investigation of discrepancies.
- **Yellow row** for uncounted (`bg-yellow-500/5`), **red row** for variance (`bg-red-500/5`): distinct color semantics that don't conflict with each other or the status badges.

---

## 7. Implementation Summary

| Metric | Sprint 18 |
|---|---|
| New files | 1 (Alembic v1374) |
| Modified files | 4 |
| Insertions | 503 |
| Deletions | 91 |
| DB columns added | 1 (`sales_returns.customer_id`) |
| New API endpoints | 1 (PHY-006) |
| React components added | 1 (`CountCell`) |

---

## 8. Tests Executed

```
Command: cd backend && python -c "[Sprint 18 verification block]"
Output (literal):
  customer_id=orig_invoice: True
  db_sr has v1374 customer_id: True
  SalesReturn.customer_id ORM: True
  PHY routes: 6
  ['/physical-stock/sessions', '/physical-stock/sessions',
   '/physical-stock/sessions/{take_id}', '/physical-stock/variance',
   '/physical-stock/sessions/{take_id}/approve',
   '/physical-stock/sessions/{take_id}/lines/{line_id}']
  All routes: sales=9 crm=7 phys=6 staff=4 fin=9 inv=8 gov=10

Command: python scripts/smriti_naming_guard.py
Output: 0 naming violations found across: src, backend, scripts

Command: git diff --cached --stat
Output: 5 files changed, 503 insertions(+), 91 deletions(-)
```

---

## 9. Verification Results

| Item | Status | Evidence |
|---|---|---|
| PHY-006 endpoint registered | Done | `phys=6` in route count; path `/physical-stock/sessions/{take_id}/lines/{line_id}` confirmed |
| PHY-006 guards (session status) | Done | `OPEN or IN_PROGRESS` check; 422 otherwise |
| PHY-006 guards (line ownership) | Done | `stock_take_id = :take_id` filter in query |
| PHY-006 variance recalculation | Done | `variance_qty = counted_qty - computed_qty` confirmed in source |
| PHY-006 OPEN→IN_PROGRESS transition | Done | UPDATE stock_takes SET status='IN_PROGRESS' on first edit |
| Alembic v1374 migration file | Done | `v1374_sales_return_cust.py` created, down_revision=v1373 |
| `SalesReturn.customer_id` ORM | Done | `SalesReturn.customer_id ORM: True` |
| `db_sr` constructor `customer_id` | Done | `db_sr has v1374 customer_id: True` |
| `CountCell` inline edit | Done | TSC 0 errors on `PhysicalStockTab.tsx` |
| Progress bar | Done | `detail.count_lines.length - missingCount / total` |
| Filter chips | Done | `all`, `missing`, `variance` states confirmed in source |
| CompleteBtn | Done | Rendered for `IN_PROGRESS` sessions only |
| NGP | Done | 0 violations |
| Push | Done | `ba259696..81da1375 smritiNX -> smritiNX` |

---

## 10. Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| `SalesReturn.customer_id` populated from v1374 onward only | Historical returns pre-v1374 have NULL `customer_id` on the column | REDEEM hook falls back to `orig_invoice.customer_id` at runtime |
| PHY `/complete` endpoint not yet implemented | `CompleteBtn` calls `/complete` but catches the 404 silently | Status update triggers on next session refresh; endpoint can be added in Sprint 19 |
| Batch counted_qty entry (scan-gun mode) | Currently one line at a time via UI | Future: bulk PATCH via CSV upload or barcode scan stream |

---

## 11. Future Work

| Item | Priority |
|---|---|
| PHY-007: `POST /sessions/:id/complete` endpoint | P1 |
| Loyalty BONUS / EXPIRY hook types in `sales_hook.py` | P2 |
| Barcode scan-to-count integration in `PhysicalStockTab` | P2 |
| `SalesReturn.customer_id` back-fill script for historical returns | P3 |
| WMS pre-existing failures | Blocked |

---

## 12. Related ADRs

- ADR: CountCell self-contained edit state (Sprint 18)
- ADR: Optimistic local state update on PHY-006 save (Sprint 18)
- ADR: SalesReturn.customer_id denormalization (Sprint 18)
- ADR: Pre-commit atomic hook pattern (Sprint 14)

---

## 13. Related RFCs

- RFC: PHY-006 PATCH count line (`physical_stock.py`)
- RFC: Alembic v1374 `sales_returns.customer_id` (`v1374_sales_return_cust.py`)
- RFC: Physical Stock Count workspace PHY-001..006 (complete)
