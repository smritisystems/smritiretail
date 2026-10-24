<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.20
  Created      : 2026-10-08
  Modified     : 2026-10-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Walkthrough: Canonical Transaction Supremacy (Phase 3 Read-Path Convergence)

**Document ID:** WT-INV-CTS-003  
**Version:** v1.0.0  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Date:** 2026-10-08  
**Area:** Inventory Reporting, Procurement Valuation, Stock Synchronization, Analytical Intelligence, Sales Intelligence  
**Architecture:** Option B — Phase 3: Canonical Transaction Supremacy (Read-Path Convergence)  
**Status:** Completed  

---

## 1. Purpose
This walkthrough documents the design, implementation, and verification of **Canonical Transaction Supremacy (Phase 3 Read-Path Convergence)** in SMRITI Retail OS under **Option B (Dual-Key Transitional Architecture)**. Following Phase 2's write-path convergence (which established the invariant "NO STOCK WITHOUT CANONICAL IDENTITY" and dual-key transaction writing), Phase 3 unifies all downstream consumers, report generators, order matchers, stock synchronizers, and analytics engines to prioritize canonical identities (`variant_id`, `item_id`) across all read operations while preserving transparent fallback for historical legacy transactions:
$$\text{Read Hierarchy: } \text{canonical\_variant\_id} \longrightarrow (\text{if NULL}) \text{resolve from } \text{product\_id} \longrightarrow \text{legacy product}$$

This ensures full semantic integrity and consistency without requiring database schema alterations, migrations, or historical record mutation.

---

## 2. Scope
- **Reporting Services (`backend/app/services/reports.py`)**:
  - `stock_valuation()`: Stamped canonical `item_id` and `variant_id` from Product master.
  - `item_wise_sales()`: Outerjoined `ItemVariant` and `Item`, grouped by `variant_id` first (fallback to `product_id`), surfaced canonical SKU, name, and barcode.
  - `bill_wise_items()`: Outerjoined `ItemVariant` and `Item`, prioritized canonical SKU, name, and barcode, populated dual keys.
  - `item_wise_returns()`: Outerjoined `ItemVariant`, `Item`, and `Product`, populated canonical SKU, name, and dual keys.
  - `article_color_size_matrix()`: Outerjoined `ItemVariant` and `Item`, extracted canonical color and size directly from variant dimensions without regex string parsing.
  - `product_wise_ordered_qty()`: Supported filtering by `variant_id` and `item_id`, populated dual keys on output lines.
- **Reporting API Schemas (`backend/app/schemas/reports.py`)**:
  - Extended `StockValuationLine`, `ItemWiseSalesLine`, `BillWiseItemsLine`, `ItemWiseReturnsLine`, and `ProductWiseOrderedQuantityLine` with optional `item_id: Optional[str] = None` and `variant_id: Optional[str] = None`.
- **Procurement Order Matching & Rates (`backend/app/services/purchase.py`)**:
  - `create_purchase_receipt()`: Matched target PO lines and prior received quantity by canonical `variant_id` first before falling back to `product_id`.
  - `get_supplier_default_rate()`: Prioritized querying last GRN and last PO rates by canonical `variant_id` before `product_id`.
- **Stock Synchronization & Drift Detection (`backend/app/services/stock_synchronizer.py`)**:
  - `sync_product_stock_cache()`: Included stock movements matching either `StockMovement.product_id == product_id` OR `(StockMovement.variant_id == product.item_variant_id)`.
  - Added classmethod `sync_variant_stock_cache(session, variant_id, company_id)`.
  - `detect_stock_drift()`: Incorporated canonical variant matching.
- **Analytical Intelligence (`backend/app/services/pdt_analytics.py`)**:
  - `calculate_sku_velocity_and_cover()`: Supported querying sales velocity, run-rate, and cover using canonical `variant_id` alongside legacy SKU.
- **Inventory & Sales Endpoints (`backend/app/api/v1/inventory_reports.py`, `backend/app/api/v1/sales_reports.py`)**:
  - Surfaced canonical dual keys (`item_id`, `variant_id`) and prioritized variant dimensions on API outputs.
- **Frontend Procurement Matcher (`src/components/purchase/grnPoEligibility.ts`)**:
  - Extended `PoItemLike` and `ReceiptItemLike` with `variant_id?: string;`.
  - Prioritized `variant_id` matching keys in `calculatePoPendingInward()`.
- **Automated Verification Harness (`backend/tests/test_phase3_canonical_read_supremacy.py`)**:
  - 10 targeted automated tests verifying end-to-end read-path convergence.

---

## 3. Files Created
1. `backend/tests/test_phase3_canonical_read_supremacy.py` — Comprehensive 10-test test suite for Phase 3 read supremacy.
2. `docs/walkthrough/inventory/Canonical_Transaction_Supremacy_Phase3_v1.0.0.md` — This 13-section WGP walkthrough document.
3. `docs/implementation/inventory/Canonical_Transaction_Supremacy_Phase3_Plan_v1.0.0.md` — 19-section IPGP implementation plan.

---

## 4. Files Modified
1. `backend/app/schemas/reports.py` — Added optional `item_id` and `variant_id` to report line models.
2. `backend/app/services/reports.py` — Converged valuation, sales, returns, bill items, article matrix, and ordered quantity reports.
3. `backend/app/services/purchase.py` — Prioritized canonical variant identity in PO receipt line matching and supplier default rate lookup.
4. `backend/app/services/stock_synchronizer.py` — Supported canonical variant movements in stock cache calculation and added `sync_variant_stock_cache`.
5. `backend/app/services/pdt_analytics.py` — Supported canonical variant querying for velocity and run-rate calculations.
6. `backend/app/api/v1/inventory_reports.py` — Surfaced dual keys on stock balance and movement endpoints.
7. `backend/app/api/v1/sales_reports.py` — Surfaced dual keys and variant dimensions on top selling items and size-wise sales.
8. `src/components/purchase/grnPoEligibility.ts` — Prioritized `variant_id` matching keys in PO inward pending calculator.
9. `src/config/version.ts` — Bumped single source of truth version to `6.70.20`.
10. `package.json` — Bumped version to `6.70.20`.
11. `backend/app/core/config.py` — Bumped version to `6.70.20`.
12. `CHANGELOG.md` — Added detailed entry for release `6.70.20`.
13. `docs/implementation/README.md` — Updated master implementation plan index table to Completed.
14. `docs/walkthrough/README.md` — Appended master walkthrough index table with Phase 3 entry.

---

## 5. Architecture Decisions
1. **ADR-0046 (Dual-Key Transitional Architecture — Option B)**:
   - Instead of breaking downstream consumers or forcing a destructive database migration, the transitional architecture maintains both legacy `product_id` and canonical `item_id`/`variant_id` keys.
2. **ADR-0047 (Canonical Read Supremacy)**:
   - Downstream read pathways MUST prioritize the canonical keys whenever present.
   - When canonical keys are `NULL` (historical transactions predating Phase 2), the system dynamically looks up the canonical identity via `ProductResolutionService` or gracefully falls back to the legacy `product_id` record.
3. **Zero Schema Migration & Zero Backfill Doctrine**:
   - Strictly no ALTER TABLE statements, migrations, or updates to historical transaction ledgers.
   - Read logic is fully resilient to both legacy single-key records and modern dual-key records.

---

## 6. Design Rationale
- **Preservation of Historical Audits**: In statutory and financial reporting, mutating historical transaction records invalidates audit trails and cryptographic hashes. Option B ensures historical records remain pristine.
- **Reporting Matrix Accuracy**: Apparel and footwear retailers require matrices of size, color, and article. Parsing string codes via regular expressions was error-prone and broke when users entered non-standard formats. By joining `ItemVariant`, the reports engine reads canonical `color` and `size` dimensions directly from structured database columns.
- **Over-Receipt Prevention**: When purchasing variants of a style, matching by legacy `product_id` alone caused discrepancies if multiple SKUs shared similar identifiers. Matching by canonical `variant_id` guarantees exact line attribution.

---

## 7. Implementation Summary
### 7.1 Pydantic Schema Non-Breaking Extensions
Added optional canonical keys to reporting schemas in `backend/app/schemas/reports.py`:
```python
class StockValuationLine(BaseModel):
    # ...
    item_id: Optional[str] = None
    variant_id: Optional[str] = None

class ItemWiseSalesLine(BaseModel):
    # ...
    item_id: Optional[str] = None
    variant_id: Optional[str] = None

class BillWiseItemsLine(BaseModel):
    # ...
    item_id: Optional[str] = None
    variant_id: Optional[str] = None

class ItemWiseReturnsLine(BaseModel):
    # ...
    item_id: Optional[str] = None
    variant_id: Optional[str] = None

class ProductWiseOrderedQuantityLine(BaseModel):
    # ...
    item_id: Optional[str] = None
    variant_id: Optional[str] = None
```

### 7.2 Reporting Services Convergence (`ReportsService`)
- In `stock_valuation()`, mapped `item_id = getattr(p, "item_id", None)` and `variant_id = getattr(p, "item_variant_id", None)`.
- In `item_wise_sales()`, outerjoined `ItemVariant` and `Item`, grouping by `variant_id` first and projecting canonical SKU (`variant_sku`), item name, and barcode.
- In `bill_wise_items()`, outerjoined `ItemVariant` and `Item`, populating canonical SKU and item name over product name.
- In `item_wise_returns()`, outerjoined `ItemVariant` and `Item`, projecting canonical metadata.
- In `article_color_size_matrix()`, populated color and size directly from `variant.color` and `variant.size` if present, falling back to name/code parsing.
- In `product_wise_ordered_qty()`, extended filter condition to `(SalesOrderItem.product_id == product_id) | (SalesOrderItem.variant_id == product_id) | (SalesOrderItem.item_id == product_id)`.

### 7.3 Procurement Fulfillment Convergence (`PurchaseService`)
- In `create_purchase_receipt()`, updated PO line lookup:
```python
target_po_item = next(
    (
        item for item in po_items
        if (getattr(item_in, "variant_id", None) and getattr(item, "variant_id", None) == item_in.variant_id)
        or (item.product_id == item_in.product_id)
        or (getattr(item_in, "code", None) and item.code == item_in.code)
    ),
    None,
)
```
- In `get_supplier_default_rate()`, queried last GRN item matching `PurchaseReceiptItem.variant_id == product.item_variant_id` first before falling back to `product_id`.

### 7.4 Stock Synchronization & Analytics
- In `StockSynchronizer.sync_product_stock_cache()`, movements are aggregated with:
```python
cond = (StockMovement.product_id == product_id)
if getattr(product, "item_variant_id", None):
    cond = cond | (StockMovement.variant_id == product.item_variant_id)
```
- Added `sync_variant_stock_cache(session, variant_id, company_id)`.
- In `PdtAnalyticsService.calculate_sku_velocity_and_cover()`, filters match `(StockMovement.sku == sku) | (StockMovement.variant_id == sku)`.

---

## 8. Tests Executed
The test suite `backend/tests/test_phase3_canonical_read_supremacy.py` was executed:
```bash
.venv\Scripts\pytest.exe backend/tests/test_phase3_canonical_read_supremacy.py -v
```

Full regression suites executed:
```bash
.venv\Scripts\pytest.exe backend/tests/test_phase2_transaction_dual_write.py -v
.venv\Scripts\pytest.exe backend/tests/test_global_product_resolution.py -v
npx tsc --noEmit
```

---

## 9. Verification Results

### 9.1 Phase 3 Test Suite Output
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 10 items

backend\tests\test_phase3_canonical_read_supremacy.py::test_01_stock_valuation_reports_canonical_keys PASSED [ 10%]
backend\tests\test_phase3_canonical_read_supremacy.py::test_02_item_wise_sales_groups_by_canonical_variant PASSED [ 20%]
backend\tests\test_phase3_canonical_read_supremacy.py::test_03_bill_wise_items_surfaces_canonical_metadata PASSED [ 30%]
backend\tests\test_phase3_canonical_read_supremacy.py::test_04_item_wise_returns_reports_canonical_supremacy PASSED [ 40%]
backend\tests\test_phase3_canonical_read_supremacy.py::test_05_article_color_size_matrix_extracts_variant_dimensions PASSED [ 50%]
backend\tests\test_phase3_canonical_read_supremacy.py::test_06_product_wise_ordered_qty_filters_by_canonical_variant PASSED [ 60%]
backend\tests\test_phase3_canonical_read_supremacy.py::test_07_purchase_receipt_matches_po_line_by_canonical_variant PASSED [ 70%]
backend\tests\test_phase3_canonical_read_supremacy.py::test_08_purchase_default_rate_prioritizes_canonical_variant PASSED [ 80%]
backend\tests\test_phase3_canonical_read_supremacy.py::test_09_stock_synchronizer_aggregates_canonical_variant_movements PASSED [ 90%]
backend\tests\test_phase3_canonical_read_supremacy.py::test_10_pdt_analytics_supports_canonical_variant_query PASSED [100%]

============================= 10 passed in 7.62s ==============================
```

### 9.2 Phase 2 Dual-Write Regression Suite Output
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 20 items

backend\tests\test_phase2_transaction_dual_write.py::test_01_valid_canonical_transaction_resolution PASSED [  5%]
backend\tests\test_phase2_transaction_dual_write.py::test_02_unknown_sku_rejection PASSED [ 10%]
backend\tests\test_phase2_transaction_dual_write.py::test_03_unknown_barcode_rejection PASSED [ 15%]
backend\tests\test_phase2_transaction_dual_write.py::test_04_cross_company_identifier_rejection PASSED [ 20%]
backend\tests\test_phase2_transaction_dual_write.py::test_05_unlinked_product_blocked_for_new_stock PASSED [ 25%]
backend\tests\test_phase2_transaction_dual_write.py::test_06_product_item_mismatch_rejection PASSED [ 30%]
backend\tests\test_phase2_transaction_dual_write.py::test_07_product_variant_mismatch_rejection PASSED [ 35%]
backend\tests\test_phase2_transaction_dual_write.py::test_08_valid_legacy_product_with_canonical_bridge PASSED [ 40%]
backend\tests\test_phase2_transaction_dual_write.py::test_09_historical_record_compatibility PASSED [ 45%]
backend\tests\test_phase2_transaction_dual_write.py::test_10_stock_movement_ledger_dual_key_population PASSED [ 50%]
backend\tests\test_phase2_transaction_dual_write.py::test_11_grn_receipt_creation_blocks_unknown_item PASSED [ 55%]
backend\tests\test_phase2_transaction_dual_write.py::test_12_sales_return_preserves_canonical_keys PASSED [ 60%]
backend\tests\test_phase2_transaction_dual_write.py::test_13_grn_valid_item_succeeds_and_populates_movement_keys PASSED [ 65%]
backend\tests\test_phase2_transaction_dual_write.py::test_14_grn_unknown_item_does_not_create_product_implicitly PASSED [ 70%]
backend\tests\test_phase2_transaction_dual_write.py::test_15_stock_adjustment_populates_dual_keys PASSED [ 75%]
backend\tests\test_phase2_transaction_dual_write.py::test_16_stock_transfer_populates_dual_keys PASSED [ 80%]
backend\tests\test_phase2_transaction_dual_write.py::test_17_stock_audit_discrepancy_reconciliation_dual_keys PASSED [ 85%]
backend\tests\test_phase2_transaction_dual_write.py::test_18_sales_stock_deduction_dual_keys PASSED [ 90%]
backend\tests\test_phase2_transaction_dual_write.py::test_19_sales_invoice_cancellation_restores_stock_with_dual_keys PASSED [ 95%]
backend\tests\test_phase2_transaction_dual_write.py::test_20_databridge_grn_adapter_blocks_unknown_sku PASSED [100%]

============================= 20 passed in 15.30s =============================
```

### 9.3 Global Product Resolution Regression Suite Output
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 8 items

backend\tests\test_global_product_resolution.py::test_01_resolve_valid_canonical_hierarchy PASSED [ 12%]
backend\tests\test_global_product_resolution.py::test_02_resolve_legacy_fallback PASSED [ 25%]
backend\tests\test_global_product_resolution.py::test_03_unknown_product_rejection PASSED [ 37%]
backend\tests\test_global_product_resolution.py::test_04_inactive_product_rejection PASSED [ 50%]
backend\tests\test_global_product_resolution.py::test_05_quarantined_product_rejection PASSED [ 62%]
backend\tests\test_global_product_resolution.py::test_06_tenant_isolation PASSED [ 75%]
backend\tests\test_global_product_resolution.py::test_07_transaction_lines_atomicity PASSED [ 87%]
backend\tests\test_global_product_resolution.py::test_08_api_product_resolution_endpoints PASSED [100%]

======================= 8 passed, 22 warnings in 18.82s =======================
```

### 9.4 TypeScript Compilation Output
```text
$ npx tsc --noEmit
Exit Code: 0 (Zero errors)
```

---

## 10. Known Limitations
1. **Historical Records Without Canonical Bridging**: For transactions created before Phase 2 where legacy products have not been linked to an `ItemVariant`, reports display legacy SKU and product descriptions. This is expected behavior under Option B.
2. **Third-Party External Sync**: External accounting sync tools (Tally, SAP B1) continue to receive legacy SKU codes mapped through DataBridge connectors until individual connector schemas are migrated to canonical variants.

---

## 11. Future Work
- **Phase 4**: Migration of all remaining external third-party connector payloads to canonical variant schemas.
- **Phase 5**: Deprecation and sunsetting of legacy `product_id` columns in favor of pure canonical keys (`ItemVariant.id`, `Item.id`).

---

## 12. Related ADRs
- `ADR-0045`: Universal Product Resolution Engine Consolidation.
- `ADR-0046`: Dual-Key Transitional Architecture (Option B).
- `ADR-0047`: Downstream Canonical Transaction Supremacy & Analytical Convergence.

---

## 13. Related RFCs
- `RFC-2026-004`: Transitional Dual-Key Architecture for Retail Transaction Supremacy.
- `RFC-2026-005`: Canonical Read-Path Convergence and Zero-Migration Invariants.
