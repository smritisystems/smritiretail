<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.2
  Created      : 2026-10-11
  Modified     : 2026-10-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal — Walkthrough Document (WGP-compliant)
-->

# Billing P0.4 — Unregistered Seller Support, Item Master Failure Suite & Zero-Mutation Atomicity
**Walkthrough Version:** 3.16.2  
**Date:** 2026-10-11  
**Commit:** `66ce2d7e` · Branch: `smritiNX`  
**Author:** Jawahar Ramkripal Mallah  

---

## 1. Purpose

Deliver and verify the P0.4 staging gate for the SMRITI canonical billing engine, covering:

1. Unregistered seller (GSTIN-less) billing pathway: correct `RETAIL_RECEIPT` document type, no jurisdiction error.
2. Extended item master failure test suite: 8 scenarios proving the system cannot produce a partial transaction (invoice, stock movement, or GL entry) from any unresolvable or invalid item identifier.
3. Zero-mutation atomicity: batch assertions confirming all 5 deterministic error modes collectively produce no database side effects.

---

## 2. Scope

| Layer | Files |
|-------|-------|
| Backend service | `backend/app/services/canonical_sales_writer.py` |
| Test suite (billing compatibility) | `backend/app/tests/test_p04_billing_compatibility.py` |
| Test suite (item master failures) | `backend/app/tests/test_p04_item_master_failures.py` (new) |

Out of scope: frontend UI, migration files, legacy resolver, headless billing calculator.

---

## 3. Files Created

| File | Description |
|------|-------------|
| `backend/app/tests/test_p04_item_master_failures.py` | New 8-test suite covering T1–T8 item master failure scenarios |

---

## 4. Files Modified

| File | Change Summary |
|------|----------------|
| `backend/app/services/canonical_sales_writer.py` | 5 targeted fixes (see §7) |
| `backend/app/tests/test_p04_billing_compatibility.py` | `unreg_wh` fixture — added `branch_id`, `address`, `city`, `state`, `pincode` to satisfy `SMRITI-LOC-004` |

---

## 5. Architecture Decisions

### AD-1: GSTIN-presence as document-type discriminator
`seller_gstin` (resolved from `branch.gst_number` → `company.gst_number`) is the sole discriminator for `TAX_INVOICE` vs `RETAIL_RECEIPT`. This matches GST Act Section 31 and CGST Rules 46/49.

### AD-2: Jurisdiction bypass only for zero-tax retail receipts
`SMRITI-JURISDICTION-001` (inter/intra-state determination failure) is bypassed **only** when `not seller_gstin AND not has_positive_tax`. Any attempt to charge GST without a GSTIN still raises the error.

### AD-3: UNASSIGNED barcode modelled without legacy product
The `ck_item_barcodes_assignment_target` DB constraint enforces `(status='UNASSIGNED' AND item_id IS NULL)`. The corresponding legacy `Product` row intentionally carries a different `barcode` value so the legacy resolver also fails to match — correctly simulating a scanner reading a barcode that has never been linked to any sellable item.

### AD-4: Batch atomicity via isolated session per test
Each test function owns its own `AsyncSession` from `NullPool`-backed `create_async_engine`. Committed state from T1 does not bleed into T2. T8 runs all 5 error modes sequentially within one session and asserts aggregate zero mutations.

---

## 6. Design Rationale

The item master suite complements P0.3 (which used the generic `products` table) by exercising the canonical `item_barcodes → item_variants → items` resolution chain exclusively. The goal is to prove that the canonical resolution path is also guarded — not just the legacy path.

The RETIRED barcode test (T2) uses `is_deleted=True` because the canonical query filters `ib.is_deleted = false`. Setting only `is_active=False` would not be sufficient since the canonical barcode query has no `is_active` filter.

---

## 7. Implementation Summary

### Fix 1 — `wh` variable scope (`canonical_sales_writer.py` L179)
```python
# Before: wh defined inside try-block, causing NameError on early exit
wh = None  # Now always in scope
```

### Fix 2 — Company/seller identity validation (L91–140)
Added `0A` validation block resolving `Company` and `Branch` from DB before any billing logic. Extracts `seller_gstin` and `has_positive_tax` flag.

### Fix 3 — Jurisdiction bypass for unregistered zero-tax sellers (L584–592)
```python
if not branch_state_code:
    is_unregistered_zero_tax = not seller_gstin and not has_positive_tax
    if not is_unregistered_zero_tax:
        raise HTTPException(400, "SMRITI-JURISDICTION-001: ...")
    # else: bypass — retail receipt, no tax, no jurisdiction needed
```

### Fix 4 — `document_type` stamped in `rule_snapshots` (L820)
```python
"document_type": ("TAX_INVOICE" if seller_gstin else "RETAIL_RECEIPT"),
```

### Fix 5 — Auto-tender and zero-amount tender guards (L980, L989–992)
Auto-tender only fires when `net_rounded > Decimal("0.00")`. Zero-amount tender items are filtered before payment dispatch.

### New test file — `test_p04_item_master_failures.py`

Coverage matrix:

| Test | Scenario | Expected Outcome |
|------|----------|-----------------|
| T1 | UNASSIGNED barcode (`status=UNASSIGNED`, `item_id=NULL`) | `HTTP 400`, 0 mutations |
| T2 | RETIRED barcode mapping (`is_deleted=True`, legacy product has different barcode) | `HTTP 400`, 0 mutations |
| T3 | Item exists, no `ProductBatchStock` | `HTTP 400/422` (`SMRITI-STOCK-001`), 0 mutations |
| T4 | Unknown variant SKU (size/colour not registered) | `HTTP 400`, 0 mutations |
| T5 | Cross-tenant `product_id` | `HTTP 400/403`, 0 mutations |
| T6 | Inactive product (`is_active=False`) | `HTTP 400` (`PRODUCT_INACTIVE`), 0 mutations |
| T7 | `ProductResolutionService.validate_line` raises `RuntimeError` | Exception propagates, 0 mutations |
| T8 | All 5 deterministic modes in sequence (1 session) | 0 invoices, 0 stock movements, 0 GL entries |

---

## 8. Tests Executed

**Command:**
```
$env:POSTGRES_PORT="2781"
.venv\Scripts\python.exe -m pytest
  backend/app/tests/test_p04_billing_compatibility.py
  backend/app/tests/test_p03_missing_items_and_integrity.py
  backend/app/tests/test_p04_item_master_failures.py
  --tb=short -q
```

---

## 9. Verification Results

**Literal terminal output:**
```
..............................                                           [100%]
30 passed, 24 warnings in 93.86s (0:01:33)
```

**Exit code: 0**

| Suite | Tests | Result |
|-------|-------|--------|
| P0.4 Billing Compatibility | 7/7 | PASSED |
| P0.3 Item Master & Integrity | 15/15 | PASSED |
| P0.4 Item Master Failures (new) | 8/8 | PASSED |
| **Grand Total** | **30/30** | **PASSED** |

**Commit:** `66ce2d7e` pushed to `smritiNX` on `github.com/smritisystems/smritiretail`.

---

## 10. Known Limitations

- T3 asserts `status_code in (400, 422)` — exact code depends on WMS deduction ordering vs invoice header posting; to be tightened in a future sprint.
- Pydantic v2 deprecation warnings (`min_items`, class-based `config`) are non-blocking; addressed in tech-debt sprint.

---

## 11. Future Work

- Replace Pydantic v1 patterns with v2 equivalents across all schemas.
- Add missing GST classification test (item with `hsn_code=None` and `tax_rate=None`).
- Add missing selling price test (item with `selling_price=0.00` and `mrp=0.00`).
- Confirm `SMRITI-STOCK-001` vs `HTTP 422` exact contract for zero-stock items.

---

## 12. Related ADRs

- ADR-045: Express cutover flags tombstoned.
- ADR-046 (implicit): Canonical barcode lifecycle states enforced at DB level via `ck_item_barcodes_assignment_target`.

---

## 13. Related RFCs

- RFC: SMRITI-JURISDICTION-001 bypass policy for unregistered zero-tax retail sellers.
- RFC: P0.4 Item Master Failure Test Matrix (this document).
