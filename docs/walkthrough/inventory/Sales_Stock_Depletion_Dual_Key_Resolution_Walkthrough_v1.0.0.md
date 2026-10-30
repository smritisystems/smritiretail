<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.2
  Created      : 2026-10-21
  Modified     : 2026-10-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Architecture & Engineering Walkthrough (WGP Compliant)
-->

# Walkthrough: SMRITI Sales Stock Depletion & Dual-Key Product Resolution

**Policy Compliance:** SMRITI Walkthrough Governance Policy (WGP-v1.0)  
**Implementation Plan:** [`docs/implementation/inventory/Sales_Stock_Depletion_Dual_Key_Resolution_Plan_v1.0.0.md`](../implementation/inventory/Sales_Stock_Depletion_Dual_Key_Resolution_Plan_v1.0.0.md)  
**Version:** `6.99.2`  
**Date:** `2026-10-21`  
**Status:** `Completed`  

---

## 1. Purpose
This document provides the formal engineering walkthrough for diagnosing and resolving the sales stock balance disconnection where submitted sales invoices failed to deduct physical warehouse stock and failed to generate `OUTWARD_SALE` stock movement records.

On environments running modern canonical item masters (such as `https://tattlythreads.smritisys.com/`), the inventory ledger displayed:
- **Total Inward:** `23,065 Units`
- **Total Outward:** `0 Units`
despite having 20 completed wholesale sales invoices (`TT2026-2027/72` to `TT2026-2027/97`).

This implementation resolves the architectural root cause across the dual-key resolution pipeline and provides an authoritative reconciliation engine to audit and backfill unledgered sales invoices.

---

## 2. Scope
1. **Root-Cause Diagnosis**:
   - Trace end-to-end execution path from `headless_billing.py` to `canonical_sales_writer.py` and `inventory_wms.py`.
   - Identify missing lineage mappings in `legacy_id_mappings` (170 mappings vs 905 variants with `item_variant_id`).
2. **Dual-Key Query Hardening**:
   - Upgrade `canonical_transaction_writer.py:resolve_dual_key_for_line` to join `products` on `item_variant_id`, `sku`, or `code` and return `COALESCE(lim.legacy_id, p.id)`.
   - Upgrade `product_resolution_service.py:_query_canonical` queries for barcode, ID, and SKU.
3. **Billing Pipeline Convergence**:
   - In `headless_billing.py`, populate `identity.legacy_product_id` from `line_res.product_id` if missing.
   - Evaluate `effective_product_id = identity.legacy_product_id or line_res.product_id` to guarantee non-empty `batch_deductions`.
4. **WMS Batch Stock Lookup Fallback**:
   - In `inventory_wms.py:atomic_mutate_batch_stock`, fallback-resolve `Product` when passed variant IDs or SKUs.
5. **Reconciliation Engine**:
   - Engineer `scripts/reconcile_sales_stock_movements.py` supporting `--dry-run` and `--apply` via `StockLedger.post_many`.
6. **Verification & Testing**:
   - Test suite `backend/app/tests/test_sales_stock_dual_key_depletion.py` (2/2 passed).
   - Single-door AST guard validation across 764 files (0 violations).

---

## 3. Files Created
- `backend/app/tests/test_sales_stock_dual_key_depletion.py`: Dedicated integration test suite verifying fallback dual-key resolution and sales posting stock depletion.
- `scripts/reconcile_sales_stock_movements.py`: Authoritative dual-mode CLI reconciliation engine for auditing and backfilling missing `OUTWARD_SALE` movements.
- `docs/implementation/inventory/Sales_Stock_Depletion_Dual_Key_Resolution_Plan_v1.0.0.md`: Formal 19-section implementation plan.
- `docs/walkthrough/inventory/Sales_Stock_Depletion_Dual_Key_Resolution_Walkthrough_v1.0.0.md`: This 13-section walkthrough document.

---

## 4. Files Modified
- `backend/app/services/canonical_transaction_writer.py`: Joined `products` in variant/barcode resolution queries and added Step 4 fallback.
- `backend/app/services/product_resolution_service.py`: Joined `products` in `stmt_bc`, `stmt_id`, and `stmt_sku` queries.
- `backend/app/services/headless_billing.py`: Guaranteed `effective_product_id` and populated `batch_deductions`.
- `backend/app/services/inventory_wms.py`: Added fallback lookup for variant/sku to product mapping in `atomic_mutate_batch_stock`.
- `docs/implementation/README.md`: Appended plan entry to master index.
- `docs/walkthrough/README.md`: Appended walkthrough entry to master index.
- `CHANGELOG.md`: Documented version 6.99.2 release notes.

---

## 5. Architecture Decisions
- **AD-INV-001: Automatic Join Fallback over Eager Migration Table Sync**:
  Rather than requiring a continuous, brittle background synchronization job to populate `legacy_id_mappings`, dual-key resolution executes `LEFT JOIN products p ON (p.item_variant_id = v.id OR p.sku = v.variant_sku OR p.code = v.variant_sku)` and selects `COALESCE(lim.legacy_id, p.id)`. This provides immediate zero-latency resolution even if `legacy_id_mappings` contains zero rows for newly created variants.
- **AD-INV-002: Strict Single-Door Routing for Historical Reconciliation**:
  Backfilling unledgered historical sales invoices MUST NOT insert raw rows into `stock_movements`. The reconciliation engine routes all movements exclusively through `StockLedger.post_many()`, enforcing three-tier lock ordering, SHA-256 idempotency key deduplication, and cache recomputation.

---

## 6. Design Rationale
- The WMS stock ledger and `ProductBatchStock` tables use `products.id` as their foreign key anchor.
- Modern billing clients identify items by `ItemVariant.id`, barcode, or variant SKU.
- When `identity.legacy_product_id` evaluated to `None`, the billing pipeline omitted lines from `batch_deductions`, leading `canonical_sales_writer.py` to skip Step 11 (`Physical Stock Mutation via WMS`).
- By hardening resolution at both transaction entry and WMS boundary, physical stock deductions are guaranteed without altering frontend payloads.

---

## 7. Implementation Summary
1. In `canonical_transaction_writer.py:resolve_dual_key_for_line`:
   - Updated variant ID query (`line_variant_id`): added `LEFT JOIN products p` and `COALESCE(lim.legacy_id, p.id) as legacy_product_id`.
   - Updated SKU query (`line_code`): added `LEFT JOIN products p` and `COALESCE(lim.legacy_id, p.id) as legacy_product_id`.
   - Updated Step 4 fallback: if `legacy_id_mappings` has no row for `line_product_id`, directly query `products` by `id` or `item_variant_id`.
2. In `product_resolution_service.py`:
   - Updated `stmt_bc`, `stmt_id`, and `stmt_sku` with `LEFT JOIN products p` and `COALESCE(lim.legacy_id, p.id) AS legacy_product_id`.
3. In `headless_billing.py`:
   - Added auto-assignment: `if identity.is_valid and not identity.legacy_product_id and line_res.product_id: identity.legacy_product_id = line_res.product_id`.
   - Defined `effective_product_id = identity.legacy_product_id or line_res.product_id` and verified physical deduction criteria.
4. In `inventory_wms.py`:
   - In `atomic_mutate_batch_stock`, added fallback query to locate `Product` when the identifier matches `item_variant_id`, `sku`, or `code`.
5. In `reconcile_sales_stock_movements.py`:
   - Engineered dual-mode reconciliation CLI with dynamic column schema introspection supporting both legacy and v1542 idempotency tables.

---

## 8. Tests Executed
1. `backend/app/tests/test_sales_stock_dual_key_depletion.py`:
   - `test_dual_key_fallback_resolution_without_mappings`: PASSED
   - `test_sales_posting_deducts_stock_when_billed_by_variant_only`: PASSED
2. `backend/app/tests/test_single_door_ast_guard.py`:
   - 4/4 test cases PASSED
3. `backend/app/tests/test_single_door_stock_ledger.py`:
   - 10/10 test cases PASSED
4. `scripts/ci_stock_single_door_guard.py`:
   - Scanned 764 files in `backend/app/` -> 0 violations.
5. `scripts/reconcile_sales_stock_movements.py`:
   - Audited `smritisys` (324 invoices checked, 0 missing).
   - Audited `smriti001` (2,410 invoices checked, 0 missing).
   - Audited `smriti_test_phase2c` (2,657 invoices checked, 0 missing).
   - Audited `smriti004` (2 invoices checked, 0 missing).

---

## 9. Verification Results
- **Evidence Level**: A (Direct terminal execution logs, code diffs, zero AST violations)
- **Status**: Done

---

## 10. Known Limitations
- Warehouse fulfillment requires valid Indian PIN code (6 digits) on the dispatching warehouse entity per `SMRITI-LOC-004` validator rules. If a warehouse has an empty PIN code, physical goods fulfillment will reject posting with a validation error until updated.

---

## 11. Future Work
- Add a periodic background health check scanner alerting if `legacy_id_mappings` count deviates significantly from `item_variants` count.

---

## 12. Related ADRs
- `ADR_SINGLE_DOOR_STOCK_LEDGER.md`
- `ADR_CANONICAL_ITEM_MASTER_DUAL_KEY.md`

---

## 13. Related RFCs
- `RFC-INV-001: Canonical Item Master Dual-Key Architecture`
- `RFC-INV-002: Single-Door Authoritative Stock Ledger Protocol`
