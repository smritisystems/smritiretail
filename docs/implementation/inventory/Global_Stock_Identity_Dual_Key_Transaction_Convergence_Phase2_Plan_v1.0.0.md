<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.19
  Created      : 2026-10-07
  Modified     : 2026-10-07
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Implementation Plan
-->

# SMRITI Retail OS — Implementation Plan: Phase 2 Global Stock Identity Gate & Dual-Key Transaction Write Convergence

**Plan ID:** IP-CAT-INV-002  
**Version:** v1.0.0  
**Status:** Completed  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Date:** 2026-10-07  
**Area:** Inventory, Procurement, Sales, Returns, DataBridge, Identity Governance  
**Architecture:** Option B — Dual-Key Transitional Architecture  

---

## 1. Objective
Establish the non-negotiable architectural invariant **"NO STOCK WITHOUT CANONICAL IDENTITY"** across all stock-changing transaction writers in SMRITI Retail OS. For every new stock movement, purchase receipt, sales invoice, sales return, stock adjustment, stock transfer, or inventory audit, ensure that `item_id`, `variant_id`, and `product_id` resolve to the same company-scoped canonical identity via `ProductResolutionService`. Strictly reject unlinked products, cross-field identity mismatches, unknown SKUs/barcodes, cross-company identifiers, and implicit master/shadow record fabrications, while preserving 100% backward compatibility with legacy historical records and executing zero database schema alterations.

## 2. Business Motivation
In hybrid retail enterprises operating both modern Universal Item Master hierarchies and legacy product registers, transactional inconsistency arises if stock is inwarded or outwarded without validated canonical lineage. Unlinked products corrupt perpetual inventory ledgers, distort multi-echelon stock valuations, and cause financial divergence between retail POS terminals and General Ledger accounts. By gating all transaction writers with canonical resolution and stamping both canonical keys (`item_id`, `variant_id`) and transitional legacy keys (`product_id`), the system guarantees ledger integrity during the phased migration toward full canonical supremacy without requiring abrupt historical database overhauls.

## 3. Scope
- **In Scope**:
  - Global stock identity gate in `InventoryService` (`_resolve_canonical_identity()`).
  - Dual-key population in `InventoryService` (`update_stock()`, `record_movement()`, `transfer_stock()`, `adjust_stock()`).
  - Dual-key population in `StockAccountingBoundaryService` (`record_stock_movement()`) and request schema (`StockMovementRecordRequest`).
  - Canonical identity resolution and dual-key writing in `PurchaseService` (`create_purchase_receipt()`, `convert_reorder_suggestions_to_draft()`, `amend_purchase_order()`, and `_get_product()`).
  - Dual-key preservation and writing in `SalesService` (`update_sales_invoice()`, `convert_quotation_to_invoice()`, `create_sales_return()`, `update_sales_return()`, `cancel_sales_invoice()`).
  - Discrepancy reconciliation dual-key population in `StockAuditService` (`reconcile_and_post_discrepancies()`).
  - Direct-entry security remediation in `GrnDesktopTerminal.tsx` (eliminating `"New Inward SKU ${code}"` auto-creation; enforcing `/product-resolution/resolve` lookups).
  - Forwarding `variant_id` in `GrnReceiptTab.tsx`.
  - DataBridge domain adapters hardening (`grn_adapter.py`, `purchase_order_adapter.py`, `sales_invoice_adapter.py`, `sales_order_adapter.py`, `sales_return_adapter.py`, `stock_audit_adapter.py`, `stock_transfer_adapter.py`) to block unknown SKU auto-provisioning.
  - Comprehensive automated test suite `backend/tests/test_phase2_transaction_dual_write.py` with 20/20 test scenarios.
- **Out of Scope**:
  - Database schema migrations (Alembic) — schema strictly frozen.
  - Historical data backfill (legacy product-only rows preserved as-is).
  - Frozen components (`ProductResolutionService`, `CanonicalSalesWriter`, `HeadlessBillingCore`, `SalesStockAuthority`).
  - Non-stock auxiliary modules (e.g. `dispatch_invoicing_engine.py` non-stock boundary).

## 4. Current State
- Phase 1 Resolver Consolidation successfully unified all lookup entry points under `ProductResolutionService`.
- Transaction tables (`stock_movements`, `sales_invoice_items`, `sales_return_items`, `purchase_receipt_items`, `purchase_order_items`) already have nullable `item_id` and `variant_id` columns from previous baseline schemas.
- However, transaction writers previously populated only `product_id`, leaving `item_id` and `variant_id` NULL for new transactions.
- GRN direct-entry UI (`GrnDesktopTerminal.tsx`) fabricated synthetic product codes (`"New Inward SKU ${code}"` / `"prod-${entryStockNo}"`) when scanned barcodes were unlinked.
- DataBridge adapters auto-provisioned placeholder records without validating canonical item existence.

## 5. Gap Analysis
| Transaction Pathway | Prior Behavior | Target Phase 2 Behavior | Status |
| :--- | :--- | :--- | :--- |
| `InventoryService` (all stock movements) | Only wrote `product_id` | Enforces `_resolve_canonical_identity()`, writes `item_id` + `variant_id` | Converged |
| `PurchaseService` (GRN, PO, Reorder) | Legacy `Product` lookup only | Resolves via `ProductResolutionService`, writes dual keys, 404s unknown | Converged |
| `SalesService` (Invoice update, Returns, Cancel) | Only wrote `product_id` | Preserves and writes canonical IDs to items and restoration movements | Converged |
| `StockAuditService` (Audit reconciliation) | Wrote `product_id` on loss/surplus movements | Resolves canonical identity, writes dual keys to `StockMovement` | Converged |
| `GrnDesktopTerminal.tsx` | Fabricated `"New Inward SKU"` | Calls `/product-resolution/resolve`; blocks unlinked/unknown items | Converged |
| DataBridge Adapters | Auto-provisioned arbitrary Products | Resolves via `ProductResolutionService`; raises 422 `ITEM_NOT_FOUND` | Converged |

## 6. Architecture Impact
- **Option B — Dual-Key Transitional Architecture**: Every new stock-changing transaction line carries `item_id`, `variant_id`, and `product_id`.
- **System of Record**: FastAPI + PostgreSQL (`backend/app/`) remains the sole transactional system of record.
- **Savepoint Isolation**: Sales invoice cancellation utilizes nested transaction savepoints (`async with session.begin_nested()`) to insulate stock reversal from legacy table schema deviations.
- **Zero Schema Mutation**: Column names, data types, and foreign keys remain 100% frozen.

## 7. Proposed Design
1. **Canonical Identity Resolver Gate**:
   - `InventoryService._resolve_canonical_identity(product, provided_item_id, provided_variant_id)`:
     - If product has neither `item_id` nor `item_variant_id`, queries `ProductResolutionService.resolve_by_product_id()`.
     - If still unlinked, raises `HTTPException(422, "UNLINKED_PRODUCT_NOT_ALLOWED")`.
     - If caller provided `item_id` or `variant_id` that conflicts with canonical resolution, raises `HTTPException(422, "PRODUCT_CANONICAL_MISMATCH")`.
2. **Dual-Key Ledger Writers**:
   - `InventoryService`: Passes `item_id` and `variant_id` to `StockMovement` in `update_stock()`, `record_movement()`, `transfer_stock()`, and `adjust_stock()`.
   - `StockAccountingBoundaryService`: Stamps `req.item_id` and `req.variant_id` on `StockMovement`.
3. **Procurement Writers**:
   - `PurchaseService._get_product()`: Resolves identifier via `ProductResolutionService.resolve()`. Returns 404 if not found.
   - `create_purchase_receipt()`: Resolves canonical keys and writes to `PurchaseReceiptItem` and `atomic_mutate_batch_stock`.
4. **Sales & Returns Writers**:
   - Copies `item_id` and `variant_id` from original invoice items onto `SalesReturnItem` and stock reversal records.
5. **UI Direct-Entry Gate**:
   - `GrnDesktopTerminal.tsx`: Strips synthetic SKU creation. Queries `/product-resolution/resolve` on stock number lookup and blocks submission if unlinked.

## 8. Files Created
- `backend/tests/test_phase2_transaction_dual_write.py`: Automated test harness containing 20 comprehensive end-to-end test cases.
- `docs/implementation/inventory/Global_Stock_Identity_Dual_Key_Transaction_Convergence_Phase2_Plan_v1.0.0.md`: This formal implementation plan.
- `docs/walkthrough/inventory/Global_Stock_Identity_Dual_Key_Transaction_Convergence_Phase2_v1.0.0.md`: Accompanying walkthrough.

## 9. Files Modified
- `backend/app/services/inventory.py`
- `backend/app/services/purchase.py`
- `backend/app/services/sales.py`
- `backend/app/services/stock_acct_svc.py`
- `backend/app/schemas/stock_acct.py`
- `backend/app/services/stock_audit_service.py`
- `backend/app/services/databridge/adapters/grn_adapter.py`
- `backend/app/services/databridge/adapters/purchase_order_adapter.py`
- `backend/app/services/databridge/adapters/sales_invoice_adapter.py`
- `backend/app/services/databridge/adapters/sales_order_adapter.py`
- `backend/app/services/databridge/adapters/sales_return_adapter.py`
- `backend/app/services/databridge/adapters/stock_audit_adapter.py`
- `backend/app/services/databridge/adapters/stock_transfer_adapter.py`
- `backend/app/api/v1/universal_import.py`
- `backend/app/services/dispatch_invoicing_engine.py`
- `src/components/purchase/GrnDesktopTerminal.tsx`
- `src/components/purchase/GrnReceiptTab.tsx`
- `src/config/version.ts`
- `package.json`
- `backend/app/core/config.py`
- `CHANGELOG.md`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 10. Dependencies
- Python 3.11+, FastAPI, SQLAlchemy 2.0 Async, PostgreSQL (Port 2781 `smriti001`).
- React 18, TypeScript 5+, Vite.
- Authoritative `ProductResolutionService`.

## 11. Risks
| Risk | Probability | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| Unlinked legacy product blocked during physical warehouse receiving | Medium | High | Return clear business error instructing user to link product or generate canonical master in Item Master. |
| Inadvertent database mutation or migration attempt | Low | Critical | Schema freeze enforced; zero migrations created; verified by `git status`. |
| Legacy GL fallback failures aborting sales invoice cancellation | Medium | Medium | Encapsulate GL reversal in `session.begin_nested()` savepoints to isolate transaction health. |

## 12. Rollback Strategy
All changes are purely software-level logic updates adhering to Option B dual-key writes without schema changes. If a critical regression is discovered, changes can be rolled back via standard git commit revert (`git revert`) with zero database schema rollback required.

## 13. Verification Plan
1. Run Phase 2 automated test harness `backend/tests/test_phase2_transaction_dual_write.py` verifying all 20 test cases pass.
2. Run Phase 1 regression suite `backend/tests/test_global_product_resolution.py` verifying 8/8 tests pass.
3. Run TypeScript compiler `npx tsc --noEmit` verifying zero typing regressions across frontend components.
4. Verify version single source of truth (`6.70.19`) across `src/config/version.ts`, `package.json`, `backend/app/core/config.py`, and `CHANGELOG.md`.

## 14. Test Plan
- `test_01`: Valid canonical transaction resolution.
- `test_02`: Unknown SKU rejection.
- `test_03`: Unknown barcode rejection.
- `test_04`: Cross-company identifier rejection.
- `test_05`: Unlinked product blocked for new stock.
- `test_06`: Product-Item mismatch rejection.
- `test_07`: Product-Variant mismatch rejection.
- `test_08`: Valid legacy product with canonical bridge.
- `test_09`: Historical record compatibility (zero backfill).
- `test_10`: Stock movement ledger dual-key population.
- `test_11`: GRN receipt creation blocks unknown item.
- `test_12`: Sales return preserves canonical keys.
- `test_13`: Valid GRN creates StockMovement with all 3 keys.
- `test_14`: GRN unknown item does not create product implicitly.
- `test_15`: Stock adjustment populates dual keys.
- `test_16`: Stock transfer populates dual keys.
- `test_17`: Stock audit discrepancy reconciliation populates dual keys.
- `test_18`: Physical sales stock deduction populates dual keys.
- `test_19`: Sales invoice cancellation restores stock with dual keys.
- `test_20`: DataBridge GRN adapter blocks unknown SKU auto-provisioning.

## 15. Documentation Impact
- `docs/implementation/README.md`: Append Phase 2 plan.
- `docs/walkthrough/README.md`: Append Phase 2 walkthrough.
- `CHANGELOG.md`: Record version `6.70.19` entry.
- SMRITI Walkthrough: `docs/walkthrough/inventory/Global_Stock_Identity_Dual_Key_Transaction_Convergence_Phase2_v1.0.0.md`.

## 16. Deployment Plan
1. Code written in development workspace (`f:\SMRITRretailNX`).
2. Run full test suite and TypeScript validation.
3. Commit and push from development.
4. Pull into test environment (`F:\Smriti9`).

## 17. Status
**Completed** — 20/20 Phase 2 tests green; 8/8 Phase 1 regression tests green; 0 TypeScript errors.

## 18. Related ADRs
- `ADR-004`: Dual-Key Transitional Architecture (Option B).
- `ADR-009`: Universal Item Master Canonical Hierarchy.
- `ADR-012`: Multi-Tenant Operational Data Isolation.

## 19. Related Walkthroughs
- `docs/walkthrough/catalog/Product_Resolution_Consolidation_Phase1_v1.0.0.md`
- `docs/walkthrough/inventory/Global_Stock_Identity_Dual_Key_Transaction_Convergence_Phase2_v1.0.0.md`
