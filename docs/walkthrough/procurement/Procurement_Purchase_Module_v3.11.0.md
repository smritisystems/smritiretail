<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah — Founder & Chairperson
  * Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
  * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.11.0
  * Created    : 2026-07-11
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# Procurement — Purchase Module — Walkthrough v3.11.0

**Date:** 2026-07-11  
**Git Revision:** 2b35aa1  
**Status:** Done

---

## 1. Purpose

Introduce the full procurement cycle — supplier master, purchase orders, and goods receipt notes (GRN) — so that stock can flow into the system in a controlled, auditable, tenant-isolated manner.

---

## 2. Scope

| Included | Excluded |
|---|---|
| Supplier master (create/list/get) | Supplier update / deactivate |
| Purchase Order create/list/get | PO amendments or cancellations |
| GRN (receipt) create/list/get | GRN reversal / credit notes |
| Atomic stock increment on GRN post | Partial receipt / over-receipt alerts |
| Supplier outstanding increment on GRN | Payment recording / supplier settlement |
| PO ↔ GRN linkage (optional) | Purchase return |
| 10 automated tests | Barcode generation on receipt |

---

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/app/models/purchase.py` | `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`, `PurchaseReceipt`, `PurchaseReceiptItem` |
| `backend/app/schemas/purchase.py` | Pydantic input/output schemas for all purchase entities |
| `backend/app/services/purchase.py` | `PurchaseService` — full business logic and tenant validation |
| `backend/app/api/v1/purchase.py` | REST router — 9 endpoints |
| `backend/alembic/versions/59cbc26b919c_add_purchase_module_tables.py` | DDL migration for 5 purchase tables |
| `backend/app/tests/test_purchase.py` | 10 tests |

---

## 4. Files Modified

| File | Change |
|---|---|
| `backend/app/models/__init__.py` | Added purchase model imports; version → 3.11.0 |
| `backend/alembic/env.py` | Added purchase model imports; version → 3.11.0 |
| `backend/app/main.py` | Registered `purchase.router` at `/api/v1`; version → 3.11.0 |
| `backend/app/core/config.py` | `VERSION = "3.11.0"` |
| `CHANGELOG.md` | v3.11.0 entry |

---

## 5. Architecture Decisions

### A. Stock is updated only on GRN, not on PO creation
A purchase order is a commercial commitment, not a physical receipt. Stock levels reflect actual physical inventory. The PO creates a liability obligation; the GRN is when goods physically arrive and stock updates.

### B. `supplier.outstanding` as accounts-payable tracker
Every GRN increases `outstanding` by `grand_total`. This allows a simple AR/AP balance report without a full ledger. Outstanding is decremented when a payment is recorded (future work).

### C. PO linkage to GRN is optional
A GRN can exist without a prior PO (e.g., emergency spot purchases). When `order_id` is supplied, the PO must belong to the same tenant.

### D. All purchase models extend `BaseEntity`
This provides automatic `company_id`/`branch_id` stamping, soft-delete, and audit columns (`created_at`, `modified_at`, `created_by`, `version`) at zero extra code per model.

### E. Manual migration DDL was required
The `autogenerate` command produced an empty migration because `env.py` was updated *after* autogenerate scanned the metadata in the same invocation. Root cause: Python module caching. Fix applied: manually wrote all five `CREATE TABLE` statements in the migration, then used `alembic stamp` to reset the version pointer before re-applying. **Future practice:** always update `env.py` imports *before* running `autogenerate`, not after.

---

## 6. Design Rationale

- `PurchaseService` receives `TenantContext` at construction time, not per-method. This ensures every query in a request is scoped to the same tenant without passing context as a parameter repeatedly.
- Tax is computed per line item (`qty × cost × gst_rate / 100`) and accumulated into `tax_total`. This matches GST filing requirements where each line is separately taxed.
- `line_total = qty × cost + tax_amount` (tax-inclusive line total), matching the Indian GST invoice format.

---

## 7. Implementation Summary

### API Surface

```
POST   /api/v1/suppliers/                 → 201 SupplierResponse        [MANAGER|SYSADMIN]
GET    /api/v1/suppliers/                 → 200 List[SupplierResponse]   [any authenticated]
GET    /api/v1/suppliers/{id}             → 200 SupplierResponse         [any authenticated]

POST   /api/v1/purchase-orders/           → 201 PurchaseOrderResponse    [MANAGER|SYSADMIN]
GET    /api/v1/purchase-orders/           → 200 List[PurchaseOrderResponse] [any authenticated]
GET    /api/v1/purchase-orders/{id}       → 200 PurchaseOrderResponse    [any authenticated]

POST   /api/v1/purchase-receipts/         → 201 PurchaseReceiptResponse  [MANAGER|SYSADMIN]
GET    /api/v1/purchase-receipts/         → 200 List[PurchaseReceiptResponse] [any authenticated]
GET    /api/v1/purchase-receipts/{id}     → 200 PurchaseReceiptResponse  [any authenticated]
```

### GRN Stock-Update Flow

```
POST /purchase-receipts/
  → validate supplier ∈ tenant
  → (if order_id) validate PO ∈ tenant
  → for each item:
       validate product ∈ tenant
       qty_received > 0
       compute tax_amount, line_total
  → INSERT PurchaseReceipt + PurchaseReceiptItems
  → for each item: product.stock += int(qty_received)
  → supplier.outstanding += grand_total
  → COMMIT (single transaction)
```

---

## 8. Tests Executed

**Command:**
```
python -m pytest app/tests/ -v --tb=short
```

**Literal output (purchase tests):**
```
app/tests/test_purchase.py::test_create_supplier PASSED                  [ 38%]
app/tests/test_purchase.py::test_list_suppliers PASSED                   [ 40%]
app/tests/test_purchase.py::test_cashier_cannot_create_supplier PASSED   [ 41%]
app/tests/test_purchase.py::test_create_purchase_order PASSED            [ 43%]
app/tests/test_purchase.py::test_create_po_invalid_supplier_returns_404 PASSED [ 45%]
app/tests/test_purchase.py::test_create_po_empty_items_returns_400 PASSED [ 46%]
app/tests/test_purchase.py::test_grn_increments_product_stock PASSED     [ 48%]
app/tests/test_purchase.py::test_grn_updates_supplier_outstanding PASSED [ 50%]
app/tests/test_purchase.py::test_grn_zero_quantity_returns_400 PASSED    [ 51%]
app/tests/test_purchase.py::test_grn_links_to_po PASSED                  [ 53%]

====================== 62 passed, 296 warnings in 25.51s ======================
```

---

## 9. Verification Results

| Check | Status |
|---|---|
| 62/62 tests pass | Done — literal output above |
| 52 prior tests continue to pass (zero regressions) | Done |
| 5 purchase tables present in PostgreSQL DB | Done — `check_tables.py` output confirmed all 5 |
| GRN increments `product.stock` in DB | Done — `test_grn_increments_product_stock` reads DB directly (stock 10→35) |
| GRN increments `supplier.outstanding` in DB | Done — `test_grn_updates_supplier_outstanding` reads DB directly (100→600) |
| CASHIER gets 403 on supplier create | Done — `test_cashier_cannot_create_supplier` PASSED |
| Zero-quantity GRN returns 400 | Done — `test_grn_zero_quantity_returns_400` PASSED |
| PO totals correct (qty×cost+tax) | Done — `test_create_purchase_order` asserts subtotal=400, tax=72, grand=472 |
| Git commit `2b35aa1` | Done |
| Empty migration fixed manually + stamped | Done — `alembic stamp 8cf33df7b76a` + `upgrade head` successful |

---

## 10. Known Limitations

1. **No supplier update/deactivate endpoint** — supplier master is currently append-only via the API.
2. **No PO cancellation** — a CONFIRMED PO cannot be cancelled via the API.
3. **No partial receipt alerting** — if `quantity_received < quantity_ordered`, there is no warning or open-receipt tracking.
4. **No over-receipt guard** — receiving more than ordered is silently permitted.
5. **`supplier.outstanding` is never decremented** — payment recording is not yet implemented.
6. **GRN does not update PO status** — posting a GRN against a PO does not automatically set the PO status to `RECEIVED`.
7. **Autogenerate empty migration risk** — see §5E. Future migrations must import models before calling autogenerate.

---

## 11. Future Work

- Supplier update (`PATCH /suppliers/{id}`) and deactivation
- PO cancellation endpoint
- Partial receipt tracking and over-receipt guard
- Payment recording (`POST /supplier-payments/`) to decrement `outstanding`
- GRN auto-marks linked PO as RECEIVED
- Purchase return / credit note
- Barcode auto-assign on GRN

---

## 12. Related ADRs

None yet.

---

## 13. Related RFCs

None yet.
