<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.0
  Created      : 2026-10-05
  Modified     : 2026-10-05
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Item Master Phase 5 — Batch, Serial & Warehouse Location Transaction Wiring v6.70.0

## 1. Purpose
Document the complete database schema migration, ORM relationship wiring, service resolution engines, and enterprise test verification for wiring granular physical tracking entities—`item_batches`, `item_serials`, and `item_warehouse_locations`—into the active transaction lifecycle across inventory (`stock_movements`), procurement (`purchase_receipt_items`), and sales (`sales_invoice_items`, `sales_return_items`).

## 2. Scope
- Author and execute reversible Alembic migration `v1520_item_master_phase5_batch_serial_location_wiring.py` (revises `v1519`).
- Update SQLAlchemy ORM models in:
  - `backend/app/models/inventory.py` (`StockMovement` tracking FKs & relationships)
  - `backend/app/models/purchase.py` (`PurchaseReceiptItem` tracking FKs & relationships)
  - `backend/app/models/sales.py` (`SalesInvoiceItem` & `SalesReturnItem` tracking FKs & relationships)
- Enhance `ItemTrackingService` in `backend/app/services/item/item_tracking_svc.py` with transactional resolution engines:
  - `resolve_or_create_batch`
  - `resolve_or_create_serial`
  - `resolve_or_create_warehouse_location`
- Author and execute automated test suite `backend/app/tests/test_item_master_phase5_tracking_wiring.py` (8 test cases).
- Execute full 45-test regression suite across all 5 Item Master test modules.
- Execute TypeScript compilation check (`npx tsc --noEmit`).

## 3. Files Created
1. `backend/alembic/versions/v1520_item_master_phase5_batch_serial_location_wiring.py`: Reversible tenant migration introducing nullable tracking FKs and b-tree indexes.
2. `backend/app/tests/test_item_master_phase5_tracking_wiring.py`: 8-test verification suite validating schema column parity, resolution service methods, and transactional persistence.
3. `docs/implementation/catalog/Item_Master_Phase5_Tracking_Transaction_Wiring_Plan_v6.70.0.md`: 19-section implementation plan.
4. `docs/walkthrough/catalog/Item_Master_Phase5_Tracking_Transaction_Wiring_v6.70.0.md`: This 13-section walkthrough document.

## 4. Files Modified
1. `backend/app/models/inventory.py`: Added `batch_id`, `serial_id`, `location_id` and relationships `batch_rel`, `serial_rel`, `location_rel` to `StockMovement`.
2. `backend/app/models/purchase.py`: Added `batch_id`, `warehouse_location_id` and relationships `batch`, `warehouse_location` to `PurchaseReceiptItem`.
3. `backend/app/models/sales.py`: Added `batch_id`, `serial_id`, `warehouse_location_id` to `SalesInvoiceItem` and `batch_id`, `serial_id` to `SalesReturnItem`, with relationships.
4. `backend/app/services/item/item_tracking_svc.py`: Implemented `resolve_or_create_batch`, `resolve_or_create_serial`, and `resolve_or_create_warehouse_location`.
5. `docs/implementation/README.md`: Appended Phase 5 implementation plan to master index.
6. `docs/walkthrough/README.md`: Appended Phase 5 walkthrough to master index.

## 5. Architecture Decisions
1. **Strictly Nullable Foreign Keys with `ON DELETE SET NULL`**:
   - All added tracking foreign keys (`batch_id`, `serial_id`, `warehouse_location_id`, `location_id`) are nullable. Existing historical ledger records (9,093 stock movements, 16,357 sales items, 72 purchase receipt items in `smriti001`) remain valid without requiring artificial backfills.
   - Deletion or deprecation of master tracking records never cascades into ledger or financial documents.
2. **Immutable Double-Entry Ledger Protection**:
   - `stock_movements` retains its immutable ledger trigger `prevent_stock_movement_mutation()` (UTMIH). Tracking foreign keys are populated exclusively on initial `INSERT`.
3. **Idempotent Transactional Resolution in `ItemTrackingService`**:
   - `resolve_or_create_batch`, `resolve_or_create_serial`, and `resolve_or_create_warehouse_location` look up existing matching entities by unique natural key (`company_id`, `item_id`, and number/bin) before inserting, preventing duplicate rows during high-concurrency order or receipt intake.

## 6. Design Rationale
- **Decoupled Optical Identity**: Optical barcodes remain isolated in `item_barcodes` and are used purely for scanner resolution. Transactional tables link directly to `item_batches`, `item_serials`, and `item_warehouse_locations`, preserving canonical business relationships.
- **AsyncPG Event Loop Stability**: Removed extraneous selector policy overrides from individual test modules, preserving the Proactor event loop standard established in `backend/tests/conftest.py`.

## 7. Implementation Summary
### Alembic Migration `v1520`
Applied to tenant database `smriti001` via `alembic -x target=tenant -x db=smriti001 upgrade head`. Reversibility verified via dry-run downgrade to `v1519` and re-upgrade to `v1520`.
- `stock_movements`: Added `batch_id`, `serial_id`, `location_id` with foreign keys and b-tree indexes.
- `purchase_receipt_items`: Added `batch_id`, `warehouse_location_id` with foreign keys and b-tree indexes.
- `sales_invoice_items`: Added `batch_id`, `serial_id`, `warehouse_location_id` with foreign keys and b-tree indexes.
- `sales_return_items`: Added `batch_id`, `serial_id` with foreign keys and b-tree indexes.

### ORM Relationships
- `StockMovement.batch_rel` -> `ItemBatch`
- `StockMovement.serial_rel` -> `ItemSerial`
- `StockMovement.location_rel` -> `ItemWarehouseLocation`
- `PurchaseReceiptItem.batch` -> `ItemBatch`
- `PurchaseReceiptItem.warehouse_location` -> `ItemWarehouseLocation`
- `SalesInvoiceItem.batch` -> `ItemBatch`
- `SalesInvoiceItem.serial` -> `ItemSerial`
- `SalesInvoiceItem.warehouse_location` -> `ItemWarehouseLocation`
- `SalesReturnItem.batch` -> `ItemBatch`
- `SalesReturnItem.serial` -> `ItemSerial`

### Tracking Resolution Service
Implemented in `backend/app/services/item/item_tracking_svc.py`:
- `ItemTrackingService.resolve_or_create_batch(session, item_id, batch_number, ...)`
- `ItemTrackingService.resolve_or_create_serial(session, item_id, serial_number, ...)`
- `ItemTrackingService.resolve_or_create_warehouse_location(session, item_id, warehouse_id, ...)`

## 8. Tests Executed
```bash
# Phase 5 Test Suite (8 tests)
F:\SMRITRretailNX\.venv\Scripts\python.exe -m pytest backend/app/tests/test_item_master_phase5_tracking_wiring.py -v

# Full Regression Suite (45 tests across 5 modules)
F:\SMRITRretailNX\.venv\Scripts\python.exe -m pytest \
    backend/tests/t_item_master.py \
    backend/tests/t_univ_item.py \
    backend/app/tests/test_item_master_phase2.py \
    backend/app/tests/test_item_master_domain_refactor.py \
    backend/app/tests/test_item_master_phase5_tracking_wiring.py -v

# TypeScript Compiler Check
npx tsc --noEmit
```

## 9. Verification Results
```text
======================= 8 passed, 23 warnings in 57.44s =======================
backend\app\tests\test_item_master_phase5_tracking_wiring.py::test_schema_phase5_column_parity PASSED [ 12%]
backend\app\tests\test_item_master_phase5_tracking_wiring.py::test_item_tracking_service_resolve_or_create_batch PASSED [ 25%]
backend\app\tests\test_item_master_phase5_tracking_wiring.py::test_item_tracking_service_resolve_or_create_serial PASSED [ 37%]
backend\app\tests\test_item_master_phase5_tracking_wiring.py::test_item_tracking_service_resolve_or_create_warehouse_location PASSED [ 50%]
backend\app\tests\test_item_master_phase5_tracking_wiring.py::test_stock_movement_phase5_fk_wiring_and_relationships PASSED [ 62%]
backend\app\tests\test_item_master_phase5_tracking_wiring.py::test_purchase_receipt_item_phase5_fk_wiring PASSED [ 75%]
backend\app\tests\test_item_master_phase5_tracking_wiring.py::test_sales_invoice_item_phase5_fk_wiring PASSED [ 87%]
backend\app\tests\test_item_master_phase5_tracking_wiring.py::test_sales_return_item_phase5_fk_wiring PASSED [100%]

================= 45 passed, 23 warnings in 104.68s (0:01:44) =================
Total tests executed: 45
Total tests passed  : 45
Total failures      : 0

TypeScript Compiler Check:
Exit code: 0 (0 errors, 0 warnings)
```

## 10. Known Limitations
- Warehouse locations are currently identified by bin string (`location_bin`); multi-tier 3D warehouse geometry (aisle, rack, shelf) will be enriched in warehouse management phases.
- Historical transaction rows retain `NULL` for tracking foreign keys, representing pre-Phase 5 un-tracked transactions.

## 11. Future Work
- Phase 6: Barcode scanning UI integration in Counter POS with automatic serial prompt for serialized categories.
- Phase 7: GRN inwarding wizard with batch expiry and manufacturing date capture modals.
- Phase 8: FEFO batch picking engine in Dispatch/Fulfillment workflows.

## 12. Related ADRs
- `docs/adr/ADR-0082-Universal-Item-Master-Decomposition.md`
- `docs/adr/ADR-0044-Five-Bucket-Inventory-ATP-Ledger.md`

## 13. Related RFCs
- `docs/rfc/RFC-0031-Item-Master-Batch-Serial-Location-Wiring.md`
