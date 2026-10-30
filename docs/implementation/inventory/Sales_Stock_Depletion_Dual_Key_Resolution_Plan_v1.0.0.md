<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.2
  Created      : 2026-10-21
  Modified     : 2026-10-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Sales Stock Depletion & Dual-Key Product Resolution Plan

## 1. Objective
Establish complete, fail-safe inventory stock depletion for modern sales transactions billed via canonical item variants, barcodes, and SKUs. Eliminate the critical stock-flow disconnect where sales invoices failed to create `OUTWARD_SALE` stock movements and failed to deduct batch stock due to missing rows in `legacy_id_mappings`. Provide an authoritative, idempotent reconciliation engine (`scripts/reconcile_sales_stock_movements.py`) to audit and backfill unledgered historical sales invoices through the canonical `StockLedger` single door.

## 2. Business Motivation
In retail operations (such as Tattlythreads), modern item masters utilize canonical `ItemVariant` records (`item_id`, `variant_id`, `variant_sku`, `barcode`), whereas warehouse physical inventory and batch stock tracking (`ProductBatchStock`, `StockLedger`, `StockMovement`) are keyed to the authoritative `products.id`. When sales invoices were submitted through headless billing or omnichannel sales endpoints, line items referencing variants without explicit entries in `legacy_id_mappings` failed to resolve `legacy_product_id`. Consequently, `batch_deductions` were silently skipped, zero stock movements were posted, and the stock balance on modern dashboards reported 0 Outward movements despite dozens of completed sales. Resolving this discrepancy restores financial and operational inventory integrity.

## 3. Scope
1. **Canonical Transaction Writer Hardening (`backend/app/services/canonical_transaction_writer.py`)**:
   - Enhance `resolve_dual_key_for_line` queries across variant ID, SKU, and barcode lookup branches to execute `LEFT JOIN products p ON (p.item_variant_id = v.id OR p.sku = v.variant_sku OR p.code = v.variant_sku) AND p.company_id = :cid AND p.is_deleted = false`.
   - Return `COALESCE(lim.legacy_id, p.id) AS legacy_product_id`, guaranteeing legacy product key resolution even if `legacy_id_mappings` is unpopulated.
   - Add direct `products` table fallback in Step 4 when an explicit `product_id` is passed.
2. **Product Resolution Service Hardening (`backend/app/services/product_resolution_service.py`)**:
   - Update canonical SQL statements (`stmt_bc`, `stmt_id`, `stmt_sku`) to join `products p` and return `COALESCE(lim.legacy_id, p.id) AS legacy_product_id`.
3. **Headless Billing Pipeline Convergence (`backend/app/services/headless_billing.py`)**:
   - In line item validation: if `identity.is_valid` and `identity.legacy_product_id` is missing but `line_res.product_id` is resolved, assign `identity.legacy_product_id = line_res.product_id`.
   - In batch deduction collection: evaluate `effective_product_id = identity.legacy_product_id or line_res.product_id`, guaranteeing that `batch_deductions` is populated and passed to Step 11 for physical stock deduction.
4. **WMS Batch Stock Mutation Fallback (`backend/app/services/inventory_wms.py`)**:
   - Enhance `atomic_mutate_batch_stock` with automated fallback lookup to match `Product.item_variant_id == product_id OR Product.sku == product_id OR Product.code == product_id` when the caller passes a variant identifier or SKU.
5. **Authoritative Reconciliation Engine (`scripts/reconcile_sales_stock_movements.py`)**:
   - Build dual-mode CLI reconciliation tool supporting `--dry-run` and `--apply` to inspect submitted sales invoices, cross-reference against `stock_movements`, resolve line items to products and warehouses, and post missing `OUTWARD_SALE` movements through `StockLedger.post_many` with deterministic idempotency keys.
6. **Automated Verification & AST Guard**:
   - Build regression test suite `backend/app/tests/test_sales_stock_dual_key_depletion.py`.
   - Verify AST compliance with `scripts/ci_stock_single_door_guard.py` (0 violations across 764 files).

## 4. Current State
- In database `smritisys`, 905 products exist with `item_variant_id`, but only 170 rows exist in `legacy_id_mappings`.
- Modern sales invoices billed with variant IDs had `identity.legacy_product_id = None`.
- `headless_billing.py` skipped adding items to `batch_deductions` when `identity.legacy_product_id` was `None`.
- `canonical_sales_writer.py` Step 11 (`if warehouse_id and batch_deductions:`) was skipped entirely.
- Total Inward was reported as 23,065 units and Total Outward as 0 units across 20 submitted wholesale sales invoices (`TT2026-2027/72` to `TT2026-2027/97`).

## 5. Gap Analysis
| Component | Prior Behavior | Hardened Target Behavior |
|---|---|---|
| Dual-Key Resolution | Relied exclusively on `legacy_id_mappings` table | Joins `products` on `item_variant_id`, `sku`, or `code`; returns `COALESCE(lim.legacy_id, p.id)` |
| Product Resolution Svc | Returned `legacy_product_id = None` on unmapped variant | Returns resolved `Product.id` via joined fallback |
| Headless Billing Lines | Skipped `batch_deductions` when `legacy_product_id` was None | Evaluates `effective_product_id = identity.legacy_product_id or line_res.product_id` |
| WMS Batch Mutation | Failed to locate batch if variant ID was passed | Resolves product via `Product.item_variant_id`, `sku`, or `code` fallback |
| Historical Invoices | Remained unledgered with zero stock movements | Audited and backfilled via `scripts/reconcile_sales_stock_movements.py` through `StockLedger` |

## 6. Architecture Impact
- **Ledger Invariant Preserved**: All stock mutations continue to flow strictly through `StockLedger.post_many()` / `StockLedger.post()`. No direct table updates or AST bypasses.
- **Dual-Key Parity**: Unifies canonical item master (`items`, `item_variants`) with operational stock ledger (`products`, `product_batch_stocks`, `stock_movements`) without requiring manual synchronization of `legacy_id_mappings`.
- **Tenant Isolation**: All fallback joins and product lookups enforce strict `company_id = :cid` and `is_deleted = false` boundaries.

## 7. Proposed Design
1. When a transaction line is submitted with `variant_id`, `sku`, or `barcode`, `resolve_dual_key_for_line` queries `item_variants v` with `LEFT JOIN legacy_id_mappings lim` and `LEFT JOIN products p ON (p.item_variant_id = v.id OR p.sku = v.variant_sku OR p.code = v.variant_sku) AND p.company_id = :cid AND p.is_deleted = false`.
2. The resolved `identity.legacy_product_id` is set to `COALESCE(lim.legacy_id, p.id)`.
3. In `headless_billing.py`, `effective_product_id` is guaranteed to be non-empty for physical goods.
4. `batch_deductions` receives the deduction request with `warehouse_id`, `product_id`, and `quantity`.
5. `canonical_sales_writer.py` Step 11 executes physical stock mutation via `InventoryWmsService.atomic_mutate_batch_stock`, creating `OUTWARD_SALE` movements in `StockLedger` and updating `ProductBatchStock`.

## 8. Files Created
- `backend/app/tests/test_sales_stock_dual_key_depletion.py`
- `scripts/reconcile_sales_stock_movements.py`
- `docs/implementation/inventory/Sales_Stock_Depletion_Dual_Key_Resolution_Plan_v1.0.0.md`
- `docs/walkthrough/inventory/Sales_Stock_Depletion_Dual_Key_Resolution_Walkthrough_v1.0.0.md`

## 9. Files Modified
- `backend/app/services/canonical_transaction_writer.py`
- `backend/app/services/product_resolution_service.py`
- `backend/app/services/headless_billing.py`
- `backend/app/services/inventory_wms.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- PostgreSQL async session engine (`sqlalchemy.ext.asyncio`).
- `backend/app/services/stock_ledger.py` (`StockLedger.post_many`, `StockLedger.compute_idempotency_key`).
- Valid tenant warehouse setup (`warehouses` table with active warehouse and valid 6-digit PIN code for physical fulfillment).

## 11. Risks
- **Duplicate Movement Risk**: Mitigated by SHA-256 idempotency key deduplication in `StockLedger` and partial unique database index `uq_sm_company_idempotency_key`.
- **Negative Stock Risk**: If historical unledgered sales exceed existing stock, `allow_negative_stock=True` ensures physical sales invoices are recorded faithfully in the ledger without blocking reconciliation.
- **Tenant Contamination Risk**: Mitigated by strict `company_id` parameterized filters on all fallback joins and lock acquisitions.

## 12. Rollback Strategy
If any defect occurs:
1. Revert `canonical_transaction_writer.py`, `product_resolution_service.py`, `headless_billing.py`, and `inventory_wms.py` via git checkout.
2. The changes are purely additive query joins; no database schema alterations or destructive migrations were introduced.

## 13. Verification Plan
- [x] Run `pytest app/tests/test_sales_stock_dual_key_depletion.py -v` (2/2 passed).
- [x] Run `pytest app/tests/test_single_door_stock_ledger.py -v` (10/10 passed).
- [x] Run `pytest app/tests/test_single_door_ast_guard.py -v` (4/4 passed).
- [x] Run `python scripts/ci_stock_single_door_guard.py` (0 violations across 764 scanned files).
- [x] Run `scripts/reconcile_sales_stock_movements.py` in dry-run mode across `smritisys`, `smriti001`, `smriti_test_phase2c`, and `smriti004`.

## 14. Test Plan
- Unit test: verify dual-key resolution resolves `legacy_product_id` directly from `products` when `legacy_id_mappings` is empty.
- Integration test: verify posting a sales invoice with only variant references creates `OUTWARD_SALE` movement and depletes `ProductBatchStock`.
- AST test: verify static analysis detects any direct stock mutation or unhandled function sum.

## 15. Documentation Impact
- Update `docs/implementation/README.md` with new plan entry.
- Create `docs/walkthrough/inventory/Sales_Stock_Depletion_Dual_Key_Resolution_Walkthrough_v1.0.0.md` and append to `docs/walkthrough/README.md`.
- Document version 6.99.2 changes in `CHANGELOG.md`.

## 16. Deployment Plan
1. Commit and push changes on branch `smritiNX`.
2. Sync target environments via `git pull`.
3. Run `scripts/reconcile_sales_stock_movements.py --db-url <URL> --dry-run` to preview unledgered sales.
4. Execute `scripts/reconcile_sales_stock_movements.py --db-url <URL> --apply` to backfill missing stock movements for submitted invoices.

## 17. Status
Approved

## 18. Related ADRs
- `docs/architecture/ADR_SINGLE_DOOR_STOCK_LEDGER.md`
- `docs/architecture/ADR_CANONICAL_ITEM_MASTER_DUAL_KEY.md`

## 19. Related Walkthroughs
- `docs/walkthrough/inventory/Sales_Stock_Depletion_Dual_Key_Resolution_Walkthrough_v1.0.0.md`
- `docs/walkthrough/inventory/Single_Door_Stock_Ledger_Architecture_Walkthrough_v1.0.0.md`
