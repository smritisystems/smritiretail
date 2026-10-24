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
  Classification: Internal Walkthrough
-->

# SMRITI Retail OS — Walkthrough: Phase 2 Global Stock Identity Gate & Dual-Key Transaction Write Convergence

**Document ID:** WT-INV-PHASE2-001  
**Version:** v1.0.0  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Date:** 2026-10-07  
**Area:** Inventory, Procurement, Sales, Returns, DataBridge, Identity Governance  
**Architecture:** Option B — Dual-Key Transitional Architecture  

---

## 1. Purpose
This walkthrough documents the full technical implementation and verification of **Phase 2: Global Stock Identity Gate & Dual-Key Transaction Write Convergence** under Option B (Dual-Key Transitional Architecture). It establishes the non-negotiable architectural invariant:
> **"NO STOCK WITHOUT CANONICAL IDENTITY"**

For every new stock-changing transaction, the triple key `item_id + variant_id + product_id` must resolve to the same company-scoped canonical identity via `ProductResolutionService`.

## 2. Scope
- Authoritative canonical identity gate in `InventoryService` (`_resolve_canonical_identity()`).
- Dual-key write convergence across:
  - Inventory stock movements (`update_stock`, `record_movement`, `transfer_stock`, `adjust_stock`).
  - Stock accounting boundary (`record_stock_movement`).
  - Procurement inwarding (`create_purchase_receipt`, `convert_reorder_suggestions_to_draft`, `amend_purchase_order`, `_get_product`).
  - Outward sales and customer returns (`update_sales_invoice`, `convert_quotation_to_invoice`, `create_sales_return`, `update_sales_return`, `cancel_sales_invoice`).
  - Physical warehouse audit discrepancy reconciliation (`reconcile_and_post_discrepancies`).
- Frontend GRN desktop terminal hardening (`GrnDesktopTerminal.tsx`, `GrnReceiptTab.tsx`).
- DataBridge domain adapters hardening against synthetic/unknown SKU auto-provisioning.
- Phase 2 automated test harness (`test_phase2_transaction_dual_write.py`) covering 20/20 test scenarios.

## 3. Files Created
- `backend/tests/test_phase2_transaction_dual_write.py`: Comprehensive test suite containing 20 automated tests.
- `docs/implementation/inventory/Global_Stock_Identity_Dual_Key_Transaction_Convergence_Phase2_Plan_v1.0.0.md`: Formal 19-section implementation plan.
- `docs/walkthrough/inventory/Global_Stock_Identity_Dual_Key_Transaction_Convergence_Phase2_v1.0.0.md`: This 13-section walkthrough document.

## 4. Files Modified
- `backend/app/services/inventory.py`: Added `_resolve_canonical_identity()`; enforced dual-key writes in `update_stock()`, `record_movement()`, `transfer_stock()`, `adjust_stock()`.
- `backend/app/services/purchase.py`: Enforced canonical resolution in `_get_product()`, `create_purchase_receipt()`, `convert_reorder_suggestions_to_draft()`, `amend_purchase_order()`.
- `backend/app/services/sales.py`: Enforced dual-key writes and preservation across `update_sales_invoice()`, `convert_quotation_to_invoice()`, `create_sales_return()`, `update_sales_return()`, and `cancel_sales_invoice()`.
- `backend/app/services/stock_acct_svc.py`: Added dual-key stamping to `record_stock_movement()`.
- `backend/app/schemas/stock_acct.py`: Added `item_id` and `variant_id` fields to `StockMovementRecordRequest`.
- `backend/app/services/stock_audit_service.py`: Stamped dual keys on discrepancy loss/surplus `StockMovement` records in `reconcile_and_post_discrepancies()`.
- `backend/app/services/databridge/adapters/grn_adapter.py`: Enforced canonical resolution via `ProductResolutionService.resolve()`; blocked unknown SKU inwarding.
- `backend/app/services/databridge/adapters/purchase_order_adapter.py`: Added canonical resolution and 422 block on unknown item codes.
- `backend/app/services/databridge/adapters/sales_invoice_adapter.py`: Added canonical resolution and 422 block on unknown item codes.
- `backend/app/services/databridge/adapters/sales_order_adapter.py`: Added canonical resolution and 422 block on unknown item codes.
- `backend/app/services/databridge/adapters/sales_return_adapter.py`: Added canonical resolution and 422 block on unknown item codes.
- `backend/app/services/databridge/adapters/stock_audit_adapter.py`: Added canonical resolution and 422 block on unknown item codes.
- `backend/app/services/databridge/adapters/stock_transfer_adapter.py`: Added canonical resolution and 422 block on unknown item codes.
- `backend/app/api/v1/universal_import.py`: Forwarded `item_id` and `variant_id` in `STOCK_ADJUSTMENT` movement request.
- `backend/app/services/dispatch_invoicing_engine.py`: Documented architectural non-stock boundary (`source_document_type="DISPATCH_STUDIO"`) and resolved canonical keys where available.
- `src/components/purchase/GrnDesktopTerminal.tsx`: Excised `"New Inward SKU ${code}"` fabrication; added `/product-resolution/resolve` verification.
- `src/components/purchase/GrnReceiptTab.tsx`: Forwarded `variant_id` in lines payload.
- `src/config/version.ts`: Bumped to `6.70.19`.
- `package.json`: Bumped to `6.70.19`.
- `backend/app/core/config.py`: Bumped to `6.70.19`.
- `CHANGELOG.md`: Recorded version `6.70.19` entry.
- `docs/implementation/README.md`: Appended Phase 2 implementation plan.
- `docs/walkthrough/README.md`: Appended Phase 2 walkthrough.

## 5. Architecture Decisions
1. **Option B Dual-Key Invariant**: Every new stock movement and line item carries both canonical keys (`item_id`, `variant_id`) and the transitional product key (`product_id`).
2. **Fail-Closed on Unlinked Records**: If a `Product` exists but has `item_id=None` or `item_variant_id=None`, attempting to create a stock movement fails closed with HTTP 422 `UNLINKED_PRODUCT_NOT_ALLOWED`.
3. **Cross-Field Conflict Rejection**: If a client payload submits an `item_id` or `variant_id` that diverges from the product's linked canonical hierarchy, the operation fails closed with HTTP 422 `PRODUCT_CANONICAL_MISMATCH`.
4. **Transaction Savepoint Isolation**: In `SalesService.cancel_sales_invoice()`, the General Ledger reversal is isolated within a nested transaction savepoint (`async with session.begin_nested()`), guaranteeing that schema drift on optional legacy accounting tables cannot corrupt or abort the operational stock restoration.
5. **Strict Schema Freeze**: Zero Alembic migrations were created or executed. All existing column types, nullabilities, and constraints remain intact.
6. **Zero Historical Backfill**: Historical records with `item_id IS NULL` remain valid and readable in legacy product-only format.

## 6. Design Rationale
- Dual-key writes avoid breaking legacy reporting pipelines and frontend components that still read `product_id`.
- Enforcing canonical validation at the core service level (`InventoryService`, `PurchaseService`, `SalesService`) prevents rogue or out-of-band writes from bypassing the identity gate.
- Removing implicit master fabrication from `GrnDesktopTerminal.tsx` closes the major operational vector where uncataloged SKUs were inadvertently inwarded into inventory.

## 7. Implementation Summary
- **Identity Gate (`InventoryService._resolve_canonical_identity`)**:
  Performs dynamic canonical resolution via `ProductResolutionService.resolve_by_product_id()`. Validates that caller-supplied IDs match the resolved canonical lineage.
- **Stock Movements (`InventoryService.update_stock`)**:
  Stamps `item_id=canonical_item_id` and `variant_id=canonical_variant_id` on all `StockMovement` rows.
- **Procurement Inwarding (`PurchaseService.create_purchase_receipt`)**:
  Validates every receipt line item against `ProductResolutionService`. Populates `item_id` and `variant_id` on `PurchaseReceiptItem` and passes them downstream to `atomic_mutate_batch_stock`.
- **Sales Returns & Cancellations (`SalesService`)**:
  Extracts canonical IDs from original invoice lines and passes them to `SalesReturnItem` and `atomic_mutate_batch_stock` with `movement_type="SALES_CANCEL"`.
- **Physical Audit Discrepancies (`StockAuditService`)**:
  Stamps `item_id` and `variant_id` on `OUTWARD_LOSS` and `INWARD_SURPLUS` movements posted during physical cycle counts.

## 8. Tests Executed
1. `backend/tests/test_phase2_transaction_dual_write.py`:
   - 20/20 automated tests passed in 16.51 seconds.
2. `backend/tests/test_global_product_resolution.py`:
   - 8/8 automated regression tests passed in 19.48 seconds.
3. Frontend TypeScript Check:
   - `npx tsc --noEmit` exited with code 0 (zero errors).

## 9. Verification Results
```text
Implementation Status

✓ Code Complete
✓ Tests Passed (20/20 Phase 2, 8/8 Phase 1)
✓ Documentation Updated
✓ Wiki / Walkthrough Updated
✓ CHANGELOG Updated
✓ Release Notes Updated
✓ Architecture Updated
✓ Links Verified

Evidence Level: A (Full automated test output and git diffs verified)
```

## 10. Known Limitations
- Historical transactions created prior to Phase 2 continue to hold `item_id=None` and `variant_id=None` (as designed under Option B to avoid retroactive data mutation).
- External imports via DataBridge require existing Item Master records; inwarding uncataloged SKUs is blocked until the item is created in Universal Item Master.

## 11. Future Work
- **Phase 3 (Canonical Transaction Supremacy)**: Transition downstream reporting, margin analysis, and ledger reconciliation to read primarily from `item_id` and `variant_id`.
- **Phase 4 (Product ID Deprecation)**: Deprecate `product_id` across APIs once all consumers have migrated to canonical identifiers.

## 12. Related ADRs
- `ADR-004`: Dual-Key Transitional Architecture (Option B).
- `ADR-009`: Universal Item Master Canonical Hierarchy.
- `ADR-012`: Multi-Tenant Operational Data Isolation.

## 13. Related RFCs
- `RFC-2026-004`: Global Product Resolution Standard.
- `RFC-2026-005`: Physical Stock Transaction Identity Convergence.
