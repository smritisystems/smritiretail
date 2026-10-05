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

# Implementation Plan: Item Master Phase 6 — Counter POS & GRN Inwarding UI Wiring for Batch, Serial & Warehouse Location Tracking v6.70.1

## 1. Objective
Connect and propagate the physical tracking primitives introduced in Phase 5 (`item_batches`, `item_serials`, `item_warehouse_locations`) through the active transactional checkout and inwarding APIs down to operator interfaces in Counter POS (`ProPosBillingTerm.tsx`) and Goods Receipt Note inwarding (`GrnReceiptTab.tsx`):
1. **Counter POS Checkout Pipeline**: Wire `batch_id`, `serial_id`, and `warehouse_location_id` end-to-end through `POSCheckoutItem` -> `CanonicalPostingLineItem` -> `BillingCalculatedLine` -> `SalesInvoiceItem` -> `StockMovement` (via `InventoryWmsService.atomic_mutate_batch_stock`).
2. **GRN Receiving & Inwarding Pipeline**: Wire `batch_id` and `warehouse_location_id` into `PurchaseReceiptItemCreate` -> `PurchaseReceiptItem` -> `StockMovement` (via `InventoryWmsService.atomic_mutate_batch_stock`), with automatic batch and location resolution via `ItemTrackingService`.
3. **Frontend UI Integration**: Extend `ProPosCartItem` and `GrnLineRow` types, forwarding tracking attributes in `/pos/checkout` and `/purchase/receipts/` requests.
4. **Automated Verification**: Deliver automated test suite `backend/app/tests/test_item_master_phase6_pos_grn_tracking_wiring.py` validating full-lifecycle tracking propagation.

## 2. Business Motivation
In modern retail operations, point-of-sale checkout and warehouse inwarding cannot operate on disconnected conceptual catalog items:
- **Counter POS Auditing**: When a cashier scans and sells a batch-tracked product (e.g. pharmaceuticals, packaged cosmetics, fresh perishables) or a serialized device (e.g. mobile phones, smart watches), the generated `SalesInvoiceItem` and outward `StockMovement` must lock to the exact batch and serial record sold.
- **Warehouse Inwarding Integrity**: When stock operators intake shipments from suppliers via GRN, inward landed costs and stock increases must associate directly with the assigned batch and godown rack/shelf location, ensuring FEFO dispatch and picker routing.
- **Zero Operator Burden**: Operators omitting explicit batch IDs should benefit from backend auto-resolution (`ItemTrackingService.resolve_or_create_batch` and `resolve_or_create_warehouse_location`), preventing checkout or inwarding failure while preserving data consistency.

## 3. Scope
- **Backend POS & Sales Pipeline**:
  - `backend/app/schemas/pos.py`: Add `batch_id`, `serial_id`, and `warehouse_location_id` to `POSCheckoutItem`.
  - `backend/app/schemas/canonical_posting.py`: Add `batch_id`, `serial_id`, and `warehouse_location_id` to `CanonicalPostingLineItem` and `BillingCalculatedLine`.
  - `backend/app/services/pos.py`: Forward tracking fields from `POSCheckoutItem` into `CanonicalPostingLineItem`.
  - `backend/app/services/headless_billing.py`: Carry tracking identifiers through `BillingCalculatedLine` and `batch_deductions`.
  - `backend/app/services/inventory_wms.py`: Accept `batch_id`, `serial_id`, and `location_id` in `atomic_mutate_batch_stock`, setting them directly on audit `StockMovement`.
  - `backend/app/services/canonical_sales_writer.py`: Set `batch_id`, `serial_id`, `warehouse_location_id` on `SalesInvoiceItem` and forward to `wms_svc.atomic_mutate_batch_stock`.
- **Backend Purchase & GRN Pipeline**:
  - `backend/app/schemas/purchase.py`: Add `batch_id` and `warehouse_location_id` to `PurchaseReceiptItemCreate` and `PurchaseReceiptItemResponse`.
  - `backend/app/services/purchase.py`: In `create_purchase_receipt`, resolve or preserve `batch_id` and `warehouse_location_id`, persist them on `PurchaseReceiptItem`, and pass them to `wms_service.atomic_mutate_batch_stock`.
- **Frontend UI & Typing**:
  - `src/components/billing/propos/types.ts`: Add `batchId`, `serialId`, and `warehouseLocationId` to `ProPosCartItem`.
  - `src/components/billing/propos/ProPosBillingTerm.tsx`: Pass tracking IDs in `/pos/checkout` items payload.
  - `src/components/purchase/GrnReceiptTab.tsx`: Add `batch_no`, `batch_id`, and `warehouse_location_id` to `GrnLineRow` and pass them in `/purchase/receipts/` payload.
- **Testing & Verification**:
  - Author and verify `backend/app/tests/test_item_master_phase6_pos_grn_tracking_wiring.py`.
  - Re-run Phase 5 regression tests (`test_item_master_phase5_tracking_wiring.py`).
  - Re-run POS checkout regression tests (`test_pos.py -k checkout`).
  - Execute TypeScript check (`npx tsc --noEmit`) and Version SSOT validation (`validate_version_ssot.py`).

## 4. Current State
- Phase 5 tracking schema (`v1520`) is applied to PostgreSQL `smriti001` with nullable foreign keys on `stock_movements`, `purchase_receipt_items`, `sales_invoice_items`, and `sales_return_items`.
- `ItemTrackingService` provides verified methods for idempotent batch, serial, and location resolution.
- Version SSOT is 6.70.1 across all project boundaries.

## 5. Gap Analysis
| Operational Surface | Pre-Phase 6 Behavior | Phase 6 Implemented State |
|---|---|---|
| POS Checkout API | `batch_id`, `serial_id`, `location_id` omitted in `POSCheckoutItem` | Fully mapped and validated through schemas and forwarded to `SalesInvoiceItem` and `StockMovement` |
| Headless Billing Core | Dropped tracking identifiers during calculation | Persists tracking IDs onto calculated lines and deduction mappings |
| WMS Stock Mutation | `atomic_mutate_batch_stock` accepted only string batch code | Accepts explicit `batch_id`, `serial_id`, `location_id` and writes them to `StockMovement` |
| Canonical Sales Writer | Left tracking foreign keys NULL on `SalesInvoiceItem` | Populates `batch_id`, `serial_id`, and `warehouse_location_id` on items and movements |
| GRN Receiving API | GRN item payload lacked tracking foreign keys | Accepts `batch_id` and `warehouse_location_id` and auto-resolves if omitted |
| Counter POS UI | `ProPosCartItem` had no tracking attributes | Added `batchId`, `serialId`, `warehouseLocationId` with payload forwarding |
| GRN Inwarding UI | `GrnLineRow` dropped tracking IDs | Captures and transmits `batch_no`, `batch_id`, and `warehouse_location_id` |

## 6. Architecture Impact
- **End-to-End Traceability**: Sales and purchase transactions now share an unbroken lineage from POS checkout / GRN inwarding down to immutable `StockMovement` audit logs.
- **Immutable Ledger Guarantees**: Stock movements and invoices retain the exact foreign key references to `item_batches`, `item_serials`, and `item_warehouse_locations`, enabling precise reconciliation.
- **Zero Breaking Changes**: All tracking fields remain optional; legacy clients omitting tracking keys continue to operate cleanly with graceful NULL persistence.

## 7. Proposed Design
```text
[Counter POS Client] (ProPosBillingTerm.tsx)
    │  batchId, serialId, warehouseLocationId
    ▼
POST /api/v1/pos/checkout
    │
    ▼
POSService.pos_checkout() ───► CanonicalPostingLineItem
                                     │
                                     ▼
                      HeadlessBillingCore.calculate_billing()
                                     │
                                     ▼
                      CanonicalSalesPostingWriter.post_sales_transaction()
                                     ├──► SalesInvoiceItem (batch_id, serial_id, warehouse_location_id)
                                     └──► InventoryWmsService.atomic_mutate_batch_stock()
                                                │
                                                ▼
                                          StockMovement (OUTWARD_SALE)
                                          (batch_id, serial_id, location_id)

[GRN Studio Client] (GrnReceiptTab.tsx)
    │  batch_no, batch_id, warehouse_location_id
    ▼
POST /api/v1/purchase/receipts/
    │
    ▼
PurchaseService.create_purchase_receipt()
    │
    ├──► ItemTrackingService.resolve_or_create_batch() (auto-resolution fallback)
    ├──► ItemTrackingService.resolve_or_create_warehouse_location()
    ├──► PurchaseReceiptItem (batch_id, warehouse_location_id)
    └──► InventoryWmsService.atomic_mutate_batch_stock()
               │
               ▼
         StockMovement (INWARD_GRN)
         (batch_id, location_id)
```

## 8. Files Created
1. `backend/app/tests/test_item_master_phase6_pos_grn_tracking_wiring.py`: Automated domain test suite for Phase 6.
2. `docs/implementation/catalog/Item_Master_Phase6_POS_GRN_Tracking_UI_Wiring_Plan_v6.70.1.md`: This 19-section implementation plan.
3. `docs/walkthrough/catalog/Item_Master_Phase6_POS_GRN_Tracking_UI_Wiring_v6.70.1.md`: 13-section walkthrough document.

## 9. Files Modified
1. `backend/app/schemas/pos.py`
2. `backend/app/schemas/canonical_posting.py`
3. `backend/app/schemas/purchase.py`
4. `backend/app/services/pos.py`
5. `backend/app/services/headless_billing.py`
6. `backend/app/services/inventory_wms.py`
7. `backend/app/services/canonical_sales_writer.py`
8. `backend/app/services/purchase.py`
9. `backend/app/tests/conftest.py`
10. `src/components/billing/propos/types.ts`
11. `src/components/billing/propos/ProPosBillingTerm.tsx`
12. `src/components/purchase/GrnReceiptTab.tsx`
13. `docs/implementation/README.md`
14. `docs/walkthrough/README.md`
15. `CHANGELOG.md`

## 10. Dependencies
- PostgreSQL 15 running in Docker container `smriti-db` on port 2781.
- Alembic migration `v1520` applied on `smriti001`.
- Python 3.11 with FastAPI, SQLAlchemy, and asyncpg.
- Node.js with TypeScript compiler `tsc`.

## 11. Risks
- **Over-constrained Client Requests**: Strict foreign key constraints could reject checkouts if invalid IDs are supplied. Mitigated by nullable fields and backend resolution fallbacks.
- **Race Conditions in Concurrent Batch Mutation**: Mitigated by existing `SELECT FOR UPDATE` row locks in `InventoryWmsService.atomic_mutate_batch_stock`.

## 12. Rollback Strategy
All code modifications are non-destructive:
- Tracking parameters on service functions default to `None`.
- Reverting frontend mappings leaves APIs functioning identically for non-tracking calls.
- In the event of an issue, service callers can omit tracking keys without schema regressions.

## 13. Verification Plan
- Verify POS checkout with tracking keys populates `SalesInvoiceItem` and `StockMovement`.
- Verify GRN receipt with explicit tracking keys populates `PurchaseReceiptItem` and `StockMovement`.
- Verify GRN receipt with omitted batch ID auto-resolves via `ItemTrackingService`.
- Verify TypeScript compiler clean build (`npx tsc --noEmit`).
- Verify Version SSOT validator (`scripts/validate_version_ssot.py`).

## 14. Test Plan
- Run `backend/app/tests/test_item_master_phase6_pos_grn_tracking_wiring.py`.
- Run `backend/app/tests/test_item_master_phase5_tracking_wiring.py`.
- Run `backend/app/tests/test_pos.py -k checkout`.

## 15. Documentation Impact
- Register Phase 6 implementation plan in `docs/implementation/README.md`.
- Register Phase 6 walkthrough in `docs/walkthrough/README.md`.
- Record Phase 6 release notes in `CHANGELOG.md`.

## 16. Deployment Plan
1. Ensure `v1520` migration is present.
2. Deploy backend service and schema updates.
3. Deploy frontend Vite bundle.
4. Verify smoke tests on test environment `F:\Smriti9` via git pull.

## 17. Status
Completed

## 18. Related ADRs
- `docs/adr/ADR-0045_Universal_Item_Master_Architecture.md`
- `docs/adr/ADR-0046_FastAPI_Postgres_Sole_System_of_Record.md`

## 19. Related Walkthroughs
- `docs/walkthrough/catalog/Item_Master_Phase5_Tracking_Transaction_Wiring_v6.70.0.md`
- `docs/walkthrough/catalog/Item_Master_Phase6_POS_GRN_Tracking_UI_Wiring_v6.70.1.md`
