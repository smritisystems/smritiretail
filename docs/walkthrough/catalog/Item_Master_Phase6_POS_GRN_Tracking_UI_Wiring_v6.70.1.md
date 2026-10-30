<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.1
  Created      : 2026-10-05
  Modified     : 2026-10-05
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Item Master Phase 6 — Counter POS & GRN Inwarding UI Wiring for Batch, Serial & Warehouse Location Tracking v6.70.1

## 1. Purpose
This walkthrough documents the full-stack wiring of physical tracking primitives—`item_batches`, `item_serials`, and `item_warehouse_locations`—from user interfaces through billing and purchasing application services down into immutable `StockMovement` ledgers and transaction items.

## 2. Scope
- End-to-end POS checkout pipeline: `POSCheckoutRequest` -> `CanonicalPostingRequest` -> `HeadlessBillingCore` -> `SalesInvoiceItem` -> `StockMovement`.
- End-to-end GRN receiving pipeline: `PurchaseReceiptCreate` -> `PurchaseReceiptItem` -> `StockMovement` with auto-resolution fallback.
- Frontend typings and payload mappings in `ProPosBillingTerm.tsx` and `GrnReceiptTab.tsx`.
- Automated test coverage in `backend/app/tests/test_item_master_phase6_pos_grn_tracking_wiring.py`.

## 3. Files Created
1. `backend/app/tests/test_item_master_phase6_pos_grn_tracking_wiring.py`
2. `docs/implementation/catalog/Item_Master_Phase6_POS_GRN_Tracking_UI_Wiring_Plan_v6.70.1.md`
3. `docs/walkthrough/catalog/Item_Master_Phase6_POS_GRN_Tracking_UI_Wiring_v6.70.1.md`

## 4. Files Modified
1. `backend/app/schemas/pos.py`: Added `batch_id`, `serial_id`, `warehouse_location_id` to `POSCheckoutItem`.
2. `backend/app/schemas/canonical_posting.py`: Added `batch_id`, `serial_id`, `warehouse_location_id` to `CanonicalPostingLineItem` and `BillingCalculatedLine`.
3. `backend/app/schemas/purchase.py`: Added `batch_id`, `warehouse_location_id` to `PurchaseReceiptItemCreate` and `PurchaseReceiptItemResponse`.
4. `backend/app/services/pos.py`: Forwarded tracking fields from `POSCheckoutItem` into `CanonicalPostingLineItem`.
5. `backend/app/services/headless_billing.py`: Maintained tracking fields on `BillingCalculatedLine` and in `batch_deductions`.
6. `backend/app/services/inventory_wms.py`: Added `batch_id`, `serial_id`, `location_id` parameters to `atomic_mutate_batch_stock` and persisted them on `StockMovement`.
7. `backend/app/services/canonical_sales_writer.py`: Set tracking IDs on `SalesInvoiceItem` and forwarded them into `wms_svc.atomic_mutate_batch_stock`.
8. `backend/app/services/purchase.py`: In `create_purchase_receipt`, resolved or preserved tracking IDs on `PurchaseReceiptItem` and passed them into `wms_service.atomic_mutate_batch_stock`.
9. `backend/app/tests/conftest.py`: Added BaseEntity compatibility columns for `item_batches`, `item_serials`, and `item_warehouse_locations` in `_ensure_schema_compatibility_sync`.
10. `src/components/billing/propos/types.ts`: Added `batchId`, `serialId`, `warehouseLocationId` to `ProPosCartItem`.
11. `src/components/billing/propos/ProPosBillingTerm.tsx`: Included tracking fields in checkout payload.
12. `src/components/purchase/GrnReceiptTab.tsx`: Added tracking fields to `GrnLineRow` and included them in receipt payload.
13. `docs/implementation/README.md`: Registered Phase 6 plan.
14. `docs/walkthrough/README.md`: Registered Phase 6 walkthrough.
15. `CHANGELOG.md`: Added Phase 6 changelog entry.

## 5. Architecture Decisions
- **Unified WMS Mutation Signature**: `InventoryWmsService.atomic_mutate_batch_stock` serves as the single transactional gate for batch stock mutations across both inward (GRN) and outward (POS / Sales) operations. Adding `batch_id`, `serial_id`, and `location_id` directly to this function guarantees that every stock movement ledger row faithfully records physical tracking context.
- **Auto-Resolution Graceful Fallback**: In `PurchaseService.create_purchase_receipt`, if a caller specifies `batch_no` but omits `batch_id`, the service calls `ItemTrackingService.resolve_or_create_batch` to create or link the canonical `ItemBatch` record automatically.
- **Non-Destructive Nullability**: All tracking IDs remain optional (`Optional[str] = None`) across request schemas and ORM entities to prevent breaking existing API consumers or requiring forced historical data migration.

## 6. Design Rationale
- Counter POS requires low operator latency; cashiers scanning barcodes should not be forced into multi-step batch ID lookups when scanning a barcode that encodes or resolves to a batch.
- Warehouse locations (aisles, racks, shelves) are warehouse-scoped. Resolving `ItemWarehouseLocation` via `resolve_or_create_warehouse_location` ensures that incoming stock is registered to the specific godown target location.

## 7. Implementation Summary
The implementation establishes a clean two-way flow:
1. **Outward Path**: Cashier scans item -> POS terminal records `batchId` / `serialId` / `warehouseLocationId` -> POST `/pos/checkout` -> `POSService` creates canonical posting request -> `HeadlessBillingCore` computes taxes and discounts while preserving tracking IDs -> `CanonicalSalesPostingWriter` posts `SalesInvoiceItem` and invokes `wms_svc.atomic_mutate_batch_stock` -> `StockMovement` (OUTWARD_SALE) records `batch_id`, `serial_id`, `location_id`.
2. **Inward Path**: GRN intake -> Inward operator enters receipt -> POST `/purchase/receipts/` -> `PurchaseService` resolves canonical batch & location records via `ItemTrackingService` -> `PurchaseReceiptItem` persists `batch_id` and `warehouse_location_id` -> `wms_service.atomic_mutate_batch_stock` persists `StockMovement` (INWARD_GRN).

## 8. Tests Executed
```bash
# Phase 6 Dedicated Test Suite
.venv\Scripts\python.exe -m pytest backend/app/tests/test_item_master_phase6_pos_grn_tracking_wiring.py -v
# Output: 3 passed, 23 warnings in 66.12s

# Phase 5 Regression Test Suite
.venv\Scripts\python.exe -m pytest backend/app/tests/test_item_master_phase5_tracking_wiring.py -v
# Output: 8 passed, 23 warnings in 50.54s

# Core POS Checkout Regression Test Suite
.venv\Scripts\python.exe -m pytest backend/app/tests/test_pos.py -v -k "checkout"
# Output: 9 passed, 13 deselected in 53.54s

# Frontend TypeScript Typecheck
npx tsc --noEmit
# Output: Exit code 0 (0 errors)

# Version SSOT Validation
.venv\Scripts\python.exe scripts/validate_version_ssot.py
# Output: [PASS] Version SSOT consistent across all boundaries: 6.70.1
```

## 9. Verification Results
- `test_pos_checkout_with_batch_serial_location_wiring`: PASSED (SalesInvoiceItem & StockMovement verified).
- `test_grn_purchase_receipt_with_explicit_batch_and_location`: PASSED (PurchaseReceiptItem & StockMovement verified).
- `test_grn_purchase_receipt_auto_resolves_batch_and_location`: PASSED (Auto-resolution verified).
- POS checkout regression: 9/9 PASSED.
- Phase 5 tracking wiring regression: 8/8 PASSED.
- TypeScript compiler: 0 errors.

## 10. Known Limitations
- Warehouse location bin validation is advisory; stock movements do not currently block if an operator enters an unconfigured bin code for an existing warehouse.

## 11. Future Work
- FEFO automated batch allocation engine during POS checkout when no explicit batch is selected by the cashier.
- Direct barcode scanner integration for serial number capture during counter sales.

## 12. Related ADRs
- `docs/adr/ADR-0045_Universal_Item_Master_Architecture.md`
- `docs/adr/ADR-0046_FastAPI_Postgres_Sole_System_of_Record.md`

## 13. Related RFCs
- `docs/rfc/RFC-0012_Batch_Serial_Warehouse_Location_Tracking_Standard.md`
