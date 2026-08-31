<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.2.0
  Created      : 2026-08-25
  Modified     : 2026-08-25
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Shoper9 SMRITI Migration Parity -- Sprints 14-17 v1.2.0

> Supersedes: `Legacy_Shoper9_SMRITI_Migration_v1.1.0.md` (Sprints 8-13)
> This document covers the continuation sprint sequence: 14, 15, 16, 17.

---

## 1. Purpose

Complete the backend hook layer and frontend UI for the SMRITI Retail OS Shoper9 parity migration. Sprints 14-17 close the transaction lifecycle gaps: sales line-item persistence, loyalty earn/reversal accounting, SalesInvoice ORM/schema/column extension, salesperson report SQL correction, and the Physical Stock Count React workspace (Shoper9 SR323400 MnuNo 350/351).

---

## 2. Scope

| Sprint | Focus | Files |
|---|---|---|
| 14 | Alembic v1373 + `sales_hook.py` (EARN) | 3 files |
| 15 | REVERSAL hook + schema addendum | 3 files |
| 16 | SalesInvoice ORM + salesperson SQL fix | 3 files |
| 17 | Physical Stock Count React UI + REDEEM fix | 3 files |

---

## 3. Files Created

| File | Sprint | Purpose |
|---|---|---|
| `backend/alembic/versions/v1373_sales_invoice_ext.py` | 14 | 8 new columns + 2 indexes on `sales_invoices` |
| `backend/app/services/sales_hook.py` | 14 | `write_invoice_lines`, `write_loyalty_earn`, `write_loyalty_redeem` |
| `src/components/PhysicalStockTab.tsx` | 17 | Physical Stock Count workspace (585 lines) |

---

## 4. Files Modified

| File | Sprint | Change Summary |
|---|---|---|
| `backend/app/services/sales.py` | 14/15/17 | Hook injections (pre-commit, atomic), orig_invoice capture, REDEEM fix |
| `backend/app/schemas/sales.py` | 15 | `SalesInvoiceBase` +8 Optional v1373 fields with camelCase aliases |
| `backend/app/models/sales.py` | 16 | `SalesInvoice` ORM +8 Column declarations, server_default |
| `backend/app/api/v1/sales_reports.py` | 16 | `_row()` rewrite + salesperson SQL column name fixes |
| `CHANGELOG.md` | 16 | v3.32.0 entry inserted |
| `src/App.tsx` | 17 | Import + 3 workspace case keys for `PhysicalStockTab` |

---

## 5. Architecture Decisions

### A. Pre-commit Atomic Hook Pattern
Both `write_invoice_lines` and `write_loyalty_earn`/`write_loyalty_redeem` execute inside the same `AsyncSession` transaction as the invoice/return commit. They share the ACID boundary — if the main commit rolls back, hook writes also roll back. The hooks are **never** allowed to raise — any exception is silently swallowed via `try/except Exception: pass` so a loyalty or line-item persistence failure never blocks a billing transaction.

### B. customer_id Resolution Strategy for REVERSAL
`SalesReturn` model has no `customer_id` column (by design — it references the original invoice). The REDEEM hook originally used `getattr(db_sr, "customer_id", None)` which always returns `None`. Sprint 17 fixed this by retaining the `orig_invoice` object (fetched at return validation) and passing `orig_invoice.customer_id` to `write_loyalty_redeem`.

### C. v1373 Schema Extension Strategy
8 new columns were added to `sales_invoices` via Alembic v1373 using `batch_alter_table` with `server_default="0"` on numeric columns. The corresponding SQLAlchemy ORM model (`models/sales.py`), Pydantic schema (`schemas/sales.py`), and service constructor (`SalesService.create_sales_invoice`) were updated in sequence across Sprints 14-16. `getattr(invoice_in, field, None)` guards in the constructor ensure zero breaking changes for existing callers.

### D. ORM-over-getattr Migration
`_row()` in `sales_reports.py` was originally written with `getattr(inv, "total_amount", None)` guards because the ORM columns didn't exist yet. Sprint 16 eliminated all fallbacks once the ORM mapping was confirmed 8/8.

### E. Physical Stock UI Architecture
`PhysicalStockTab.tsx` is a self-contained workspace component consuming 5 PHY endpoints exclusively via `apiFetchV1`. No Redux/global state. Three internal sub-views: session list, new session modal, session detail panel with approve CTA. Registered in App.tsx under workspace keys `physical-stock`, `stock-count`, `physical-inventory`.

---

## 6. Design Rationale

- **Graceful hook failures** prevent any billing regression from loyalty/line-item subsystems during the incremental migration phase.
- **`ON CONFLICT DO NOTHING`** in `write_invoice_lines` SQL makes it safe to call on retried requests (idempotency-key replay scenarios).
- **Zero-floor clamping** in `write_loyalty_redeem`: `points_reversed = min(points_reversed, cur_balance)` — a customer can never go below 0 points from a return.
- **Variance row highlight** (`bg-red-500/5`) in the Physical Stock table provides immediate visual audit signal without requiring separate filtering.
- **StatusBadge color coding**: OPEN=blue, IN_PROGRESS=yellow, COMPLETED=emerald, APPROVED=purple, CANCELLED=red — matches Shoper9 workflow states.

---

## 7. Implementation Summary

| Metric | Sprint 14 | Sprint 15 | Sprint 16 | Sprint 17 | Total |
|---|---|---|---|---|---|
| New files | 2 | 0 | 0 | 1 | 3 |
| Modified files | 1 | 3 | 3 | 2 | 9 |
| Insertions | 370 | 124 | 69 | 596 | 1,159 |
| DB columns added | 8 | 0 | 0 | 0 | 8 |
| DB indexes added | 2 | 0 | 0 | 0 | 2 |
| React components | 0 | 0 | 0 | 1 | 1 |

---

## 8. Tests Executed

```
Command: cd backend && python -c "[import + route count verification]"
Output (Sprint 17 final):
  orig_invoice.customer_id: True
  write_loyalty_redeem:      True
  raise HTTPException 404:   True
  routes: sales=9 crm=7 phys=5 staff=4 fin=9 inv=8 gov=10

Command: python scripts/smriti_naming_guard.py
Output: 0 naming violations found across: src, backend, scripts

Command: alembic current
Output: v1373_sales_invoice_ext (head)

Command: python -c "from app.models.sales import SalesInvoice; ..."
Output: ORM model: 8/8 v1373 columns mapped OK

Command: python -c "from app.schemas.sales import SalesInvoiceBase; ..."
Output: Schema: 8/8 OK

Command: python -c "from app.services.sales_hook import write_invoice_lines, write_loyalty_earn, write_loyalty_redeem"
Output: sales_hook: 3 helpers OK

Command: npx tsc --noEmit (PhysicalStockTab.tsx)
Output: 0 errors on PhysicalStockTab
```

---

## 9. Verification Results

| Item | Status | Evidence |
|---|---|---|
| Alembic v1373 applied | Done | `alembic current` = `v1373_sales_invoice_ext`, 8/8 columns in `information_schema` |
| `sales_hook.py` 3 helpers | Done | Import check passes |
| EARN hook injected (sales.py) | Done | `write_invoice_lines` at lines 295-310 (pre-commit) |
| EARN loyalty hook injected | Done | `write_loyalty_earn` at lines 304-315 |
| REVERSAL hook injected (sales.py) | Done | `write_loyalty_redeem` at lines 639-651 |
| `customer_id` fix | Done | `orig_invoice.customer_id` confirmed True |
| ORM 8/8 columns | Done | `SalesInvoice.__table__.columns` check |
| Schema 8/8 fields | Done | `SalesInvoiceBase.model_fields` check |
| `_row()` rewrite | Done | getattr fallbacks eliminated, wrong cols fixed |
| Salesperson SQL fix | Done | `total_amount` -> `grand_total`, `tax_amount` -> `tax_total` |
| `PhysicalStockTab.tsx` | Done | 585 lines, TSC 0 errors |
| App.tsx registration | Done | 3 workspace keys mapped |
| NGP 0 violations | Done | `smriti_naming_guard.py` all 4 sprints |
| Push confirmed | Done | `a99a19c5..66ba0b2f smritiNX -> smritiNX` |

---

## 10. Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| `SalesReturn` no `customer_id` column | REVERSAL hook fetches from `orig_invoice`; returns with no original invoice get no reversal | `orig_invoice` validated at return creation (404 if missing) |
| Physical count **data entry** (quantity input per line) | PHY-003 returns lines but UI doesn't allow editing counted_qty yet | Count lines are inserted via backend `POST /physical-stock/sessions` payload |
| `loyalty_transactions` EARN empty until `POST /sales` called | `loyalty-ledger` returns 0 rows on fresh install | Expected — hook populates on first sale |
| Salesperson fields still NULL for historical invoices | RPT-SAL-008/009 return "Unassigned" for pre-v1373 invoices | `server_default=0` for numeric, NULL for strings — expected |

---

## 11. Future Work

| Item | Priority |
|---|---|
| Physical stock count **line entry** (inline edit for `counted_qty`) | P1 |
| `SalesReturn.customer_id` column (Alembic v1374) | P2 |
| Loyalty BONUS / EXPIRY transaction types in hook | P2 |
| Launchpad tile for `physical-stock` workspace | P2 |
| Salesperson assignment UI (commission_participants lookup) | P3 |
| WMS pre-existing failures | Blocked |

---

## 12. Related ADRs

- ADR: Pre-commit atomic hook pattern (established Sprint 14)
- ADR: customer_id resolution from original invoice (Sprint 17)
- ADR: ORM-over-getattr migration (Sprint 16)
- ADR: FastAPI + Postgres sole backend (2026-07-12)

---

## 13. Related RFCs

- RFC: Alembic v1373 SalesInvoice extension (`v1373_sales_invoice_ext.py`)
- RFC: Physical Stock Count workspace (PHY-001..005 endpoints)
- RFC: Loyalty transaction accounting (`sales_hook.py`)
