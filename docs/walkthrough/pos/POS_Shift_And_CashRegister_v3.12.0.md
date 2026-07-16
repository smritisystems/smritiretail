<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah — Founder & Chairperson
  * Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.12.0
  * Created    : 2026-07-11
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# POS — Shift & Cash Register — Walkthrough v3.12.0

**Date:** 2026-07-11  
**Git Revision:** 4b9e2a5  
**Status:** Done

---

## 1. Purpose

Implement the daily POS operational cycle: a cashier opens a shift on a physical cash register, processes sales invoices against that shift, and closes the shift with a cash count. The system computes expected cash, variance, and per-payment-mode totals for end-of-day reconciliation.

---

## 2. Scope

| Included | Excluded |
|---|---|
| Cash register CRUD (create/list/get) | Register update/deactivation |
| Shift open with opening balance | Shift amendment after open |
| Shift close with full reconciliation | Mid-shift cash-in/cash-out events |
| Sales aggregation by payment mode (CASH/CARD/UPI) | Denomination breakdown |
| One-open-shift guard per register | Multi-register shift grouping |
| `shift_id` + `payment_mode` on SalesInvoice | Invoice creation changes |
| 10 automated tests | POS hardware integration |

---

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/app/models/pos.py` | `CashRegister`, `Shift` models |
| `backend/app/schemas/pos.py` | Pydantic I/O schemas |
| `backend/app/services/pos.py` | `POSService` — business logic |
| `backend/app/api/v1/pos.py` | 8 REST endpoints |
| `backend/alembic/versions/cc8a527deb42_add_pos_shift_tables.py` | Migration: `cash_registers`, `shifts`; alter `sales_invoices` |
| `backend/app/tests/test_pos.py` | 10 tests |

---

## 4. Files Modified

| File | Change |
|---|---|
| `backend/app/models/sales.py` | Added `shift_id` (FK → shifts), `payment_mode` columns |
| `backend/app/models/__init__.py` | Added POS model imports; version → 3.12.0 |
| `backend/alembic/env.py` | Added POS model imports; version → 3.12.0 |
| `backend/app/main.py` | Registered `pos.router`; version → 3.12.0 |
| `backend/app/core/config.py` | `VERSION = "3.12.0"` |
| `CHANGELOG.md` | v3.12.0 entry |

---

## 5. Architecture Decisions

### A. Shift is the unit of reconciliation, not the calendar day
A cashier may start a shift at 11 PM and close at 7 AM the next morning. The shift boundary, not the date, defines the reconciliation window. This also supports multi-shift operations (morning/afternoon/night).

### B. Only CASH sales count toward `expected_cash`
Card and UPI payments do not affect the physical cash drawer. `expected_cash = opening_balance + cash_sales_total`. `variance` measures only cash discrepancy.

### C. `shift_id` on SalesInvoice is nullable and optional
Existing invoices created before POS shift implementation are unaffected. The field allows attribution but is not mandatory.

### D. `payment_mode` enum on SalesInvoice (`CASH|CARD|UPI|CREDIT`)
Added directly to `SalesInvoice` rather than a separate `payment` table to keep the sales API simple. Full payment ledger (split payments, partial payments) is future work.

### E. Pre-existing `shifts` table with wrong schema
An earlier, different schema for `shifts` existed in the DB (`profile_id`, `sales_count`, `sales_value` — 11 columns total). The `CREATE TABLE IF NOT EXISTS` guard silently skipped creation. Detected via column inspection; repaired with `DROP TABLE CASCADE` + `CREATE TABLE` via a SQL repair script, then the FK from `sales_invoices` was re-established.

---

## 6. Design Rationale

- `POSService` receives `TenantContext` at construction to scope every query automatically.
- `get_active_shift` returns 404 (not an empty list) because the POS terminal needs a clear binary signal: either there is a shift to attach sales to, or there isn't.
- `close_shift` aggregates invoices in-memory (not SQL GROUP BY) to stay within the async ORM and keep the logic testable without raw SQL.

---

## 7. Implementation Summary

### API Surface

```
POST   /api/v1/registers/                → 201 CashRegisterResponse   [MANAGER|SYSADMIN]
GET    /api/v1/registers/                → 200 List[CashRegisterResponse] [any authenticated]
GET    /api/v1/registers/{id}            → 200 CashRegisterResponse   [any authenticated]

POST   /api/v1/shifts/open               → 201 ShiftResponse          [any authenticated]
POST   /api/v1/shifts/{id}/close         → 200 ShiftResponse          [any authenticated]
GET    /api/v1/shifts/                   → 200 List[ShiftResponse]    [any authenticated]
GET    /api/v1/shifts/active/{reg_id}    → 200 ShiftResponse | 404    [any authenticated]
GET    /api/v1/shifts/{id}               → 200 ShiftResponse          [any authenticated]
```

### Shift Close Reconciliation Flow

```
POST /shifts/{id}/close
  → validate shift exists + is OPEN in this tenant
  → SELECT all SalesInvoices WHERE shift_id = id AND is_deleted = False
  → for each invoice: accumulate cash/card/upi/total by payment_mode
  → expected_cash = opening_balance + cash_sales_total
  → variance = closing_balance − expected_cash
  → UPDATE shift: status=CLOSED, closed_at=now(), all totals, notes
  → COMMIT
```

---

## 8. Tests Executed

**Command:**
```
python -m pytest app/tests/ -v --tb=short
```

**Literal output (POS tests):**
```
app/tests/test_pos.py::test_create_register PASSED                       [ 33%]
app/tests/test_pos.py::test_cashier_cannot_create_register PASSED        [ 34%]
app/tests/test_pos.py::test_list_registers PASSED                        [ 36%]
app/tests/test_pos.py::test_open_shift PASSED                            [ 37%]
app/tests/test_pos.py::test_cannot_open_two_shifts_same_register PASSED  [ 38%]
app/tests/test_pos.py::test_open_shift_invalid_register_returns_404 PASSED [ 40%]
app/tests/test_pos.py::test_close_shift_no_sales PASSED                  [ 41%]
app/tests/test_pos.py::test_close_shift_with_sales_variance PASSED       [ 43%]
app/tests/test_pos.py::test_close_already_closed_shift_returns_400 PASSED [ 44%]
app/tests/test_pos.py::test_get_active_shift PASSED                      [ 45%]

====================== 72 passed, 381 warnings in 29.75s ======================
```

---

## 9. Verification Results

| Check | Status |
|---|---|
| 72/72 tests pass | Done — literal output above |
| 62 prior tests pass (zero regressions) | Done |
| `cash_registers` table has correct 16 columns | Done — DB inspection script confirmed |
| `shifts` table has correct 28 columns including `register_id` | Done — DB inspection confirmed after repair |
| Shift close with sales: variance = -20.00 on 680 declared vs 700 expected | Done — `test_close_shift_with_sales_variance` PASSED |
| Double-close returns 400 | Done — `test_close_already_closed_shift_returns_400` PASSED |
| One-open guard returns 400 | Done — `test_cannot_open_two_shifts_same_register` PASSED |
| Git commit `4b9e2a5` | Done |
| FK teardown in test_pos fixture prevents cross-module FK violations | Done — all 72 pass cleanly |

---

## 10. Known Limitations

1. No mid-shift cash-in/cash-out events.
2. Invoice creation does not yet require an active shift — `shift_id` is optional.
3. CARD/UPI totals are tracked but there is no card terminal reconciliation (expected vs actual).
4. No PO-to-GRN status auto-update.
5. Shift close does not update `SalesInvoice.status` to `Confirmed`.

---

## 11. Future Work

- Cash-in / cash-out transactions during a shift
- Make `shift_id` mandatory for invoice creation when a shift is open
- Card/UPI expected vs actual terminal reconciliation
- POS bill receipt generation (PDF)
- Day-end report aggregating all shifts for a branch

---

## 12. Related ADRs

None yet.

---

## 13. Related RFCs

None yet.
