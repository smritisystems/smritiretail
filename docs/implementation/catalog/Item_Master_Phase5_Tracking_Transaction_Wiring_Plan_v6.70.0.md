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

# Implementation Plan: Item Master Phase 5 — Batch, Serial & Warehouse Location Transaction Wiring Plan v6.70.0

## 1. Objective
Wire granular physical tracking primitives—`item_batches`, `item_serials`, and `item_warehouse_locations`—directly into core transactional execution tables across inventory, procurement, and sales:
1. `stock_movements`: Add `batch_id`, `serial_id`, and `location_id` foreign keys.
2. `purchase_receipt_items`: Add `batch_id` and `warehouse_location_id` foreign keys.
3. `sales_invoice_items`: Add `batch_id`, `serial_id`, and `warehouse_location_id` foreign keys.
4. `sales_return_items`: Add `batch_id` and `serial_id` foreign keys.
Ensure all tracking foreign keys are nullable with `ON DELETE SET NULL`, maintain complete reversibility via Alembic migration `v1520`, update SQLAlchemy ORM models and relationships, and provide transactional resolution engines in `ItemTrackingService`.

## 2. Business Motivation
In high-volume retail, wholesale, footwear, and consumer goods distribution:
- **Traceability**: Inward goods, warehouse stock movements, point-of-sale customer invoices, and returns must record exact batch numbers, manufacturing/expiry dates, serial numbers, and bin/rack locations.
- **Statutory & Audit Compliance**: Expiring goods (food, pharmaceuticals, cosmetics) require strict FEFO (First-Expired, First-Out) batch auditing. High-value electronics and luxury goods require serial-level audit trails.
- **Fulfillment Precision**: Warehouse pickers and stock controllers must navigate precisely to aisle/rack/shelf/bin locations (`item_warehouse_locations`) when dispatching sales orders or receiving purchase consignments.
- **Zero Disruption to Historical Ledgers**: All new tracking foreign keys must be strictly nullable with `ON DELETE SET NULL` so existing transactions (9,093 historical stock movements, 16,357 historical sales items, 72 historical purchase receipt items in `smriti001`) remain intact and functional without forced backfills.

## 3. Scope
- **Schema & Database Layer**:
  - Author and apply reversible Alembic migration `v1520_item_master_phase5_batch_serial_location_wiring.py` (revises `v1519`).
  - Add nullable foreign keys and single-column b-tree indexes on `stock_movements`, `purchase_receipt_items`, `sales_invoice_items`, and `sales_return_items`.
  - Enforce `ON DELETE SET NULL` referential action to prevent cascade deletion of financial and ledger records.
- **ORM Model Extensions**:
  - `backend/app/models/inventory.py`: Add `batch_id`, `serial_id`, `location_id` and relationships `batch_rel`, `serial_rel`, `location_rel` to `StockMovement`.
  - `backend/app/models/purchase.py`: Add `batch_id`, `warehouse_location_id` and relationships `batch`, `warehouse_location` to `PurchaseReceiptItem`.
  - `backend/app/models/sales.py`: Add `batch_id`, `serial_id`, `warehouse_location_id` to `SalesInvoiceItem` and `batch_id`, `serial_id` to `SalesReturnItem`, with relationships.
- **Service Layer Enhancements**:
  - `backend/app/services/item/item_tracking_svc.py`: Implement transactional resolution and idempotent creation methods:
    - `resolve_or_create_batch`
    - `resolve_or_create_serial`
    - `resolve_or_create_warehouse_location`
- **Testing & Verification**:
  - Author dedicated Phase 5 test suite `backend/app/tests/test_item_master_phase5_tracking_wiring.py` covering schema column parity, resolution service methods, and transactional persistence across all 4 tables.
  - Execute full 45-test regression suite across `t_item_master.py`, `t_univ_item.py`, `test_item_master_phase2.py`, `test_item_master_domain_refactor.py`, and `test_item_master_phase5_tracking_wiring.py`.
  - Run TypeScript compilation check (`npx tsc --noEmit`) to verify 0 frontend regressions.

## 4. Current State
- Item Master Phase 1 (Core Identity, Barcode Decoupling, MRP Separation), Phase 2 (UOM, Pricing, Tax, Purchasing, Sales, Inventory Readiness Policies), and Phase 4 (Service Decomposition into 5 sub-services) are complete and verified.
- Tenant database `smriti001` runs on PostgreSQL port 2781 with `v1519` applied.
- All 37 existing regression tests are green.

## 5. Gap Analysis
| Transactional Table | Pre-Phase 5 State | Post-Phase 5 State |
|---|---|---|
| `stock_movements` | Untracked stock movements (only `item_id`, `variant_id`, `qty`, `from/to_warehouse_id`) | Added `batch_id`, `serial_id`, `location_id` FKs linking to `item_batches`, `item_serials`, `item_warehouse_locations` |
| `purchase_receipt_items` | Only item & variant codes; no batch or bin tracking | Added `batch_id` and `warehouse_location_id` FKs for GRN batch/bin inwarding |
| `sales_invoice_items` | Only item & variant codes; untracked POS lines | Added `batch_id`, `serial_id`, `warehouse_location_id` FKs for outward dispatch |
| `sales_return_items` | Only item & variant codes | Added `batch_id` and `serial_id` FKs to verify returned serials/batches against orig invoice |
| `ItemTrackingService` | Only 5-bucket ATP formula calculation | Added transactional resolution engines (`resolve_or_create_batch`, `resolve_or_create_serial`, `resolve_or_create_warehouse_location`) |

## 6. Architecture Impact
1. **Referential Integrity without Cascading Deletion**:
   - Tracking entities are master/operational records. If an item batch or serial is soft-deleted or cleaned up, `ON DELETE SET NULL` ensures the financial audit trail (`sales_invoices`, `stock_movements`) is preserved without violating foreign key constraints.
2. **Double-Entry Stock Ledger Harmony**:
   - Stock movements retain their immutable ledger integrity (`prevent_stock_movement_mutation()` trigger). The new tracking foreign keys enrich movement rows at creation time with zero trigger interference.
3. **Multi-Tenant Isolation**:
   - Batch, serial, and location lookups are strictly isolated by `company_id`.

## 7. Proposed Design
### Migration `v1520_item_master_phase5_batch_serial_location_wiring.py`
```sql
-- stock_movements
ALTER TABLE stock_movements ADD COLUMN batch_id VARCHAR(50) REFERENCES item_batches(id) ON DELETE SET NULL;
ALTER TABLE stock_movements ADD COLUMN serial_id VARCHAR(50) REFERENCES item_serials(id) ON DELETE SET NULL;
ALTER TABLE stock_movements ADD COLUMN location_id VARCHAR(50) REFERENCES item_warehouse_locations(id) ON DELETE SET NULL;
CREATE INDEX ix_stock_movements_batch_id ON stock_movements (batch_id);
CREATE INDEX ix_stock_movements_serial_id ON stock_movements (serial_id);
CREATE INDEX ix_stock_movements_location_id ON stock_movements (location_id);

-- purchase_receipt_items
ALTER TABLE purchase_receipt_items ADD COLUMN batch_id VARCHAR(50) REFERENCES item_batches(id) ON DELETE SET NULL;
ALTER TABLE purchase_receipt_items ADD COLUMN warehouse_location_id VARCHAR(50) REFERENCES item_warehouse_locations(id) ON DELETE SET NULL;
CREATE INDEX ix_purchase_receipt_items_batch_id ON purchase_receipt_items (batch_id);
CREATE INDEX ix_purchase_receipt_items_location_id ON purchase_receipt_items (warehouse_location_id);

-- sales_invoice_items
ALTER TABLE sales_invoice_items ADD COLUMN batch_id VARCHAR(50) REFERENCES item_batches(id) ON DELETE SET NULL;
ALTER TABLE sales_invoice_items ADD COLUMN serial_id VARCHAR(50) REFERENCES item_serials(id) ON DELETE SET NULL;
ALTER TABLE sales_invoice_items ADD COLUMN warehouse_location_id VARCHAR(50) REFERENCES item_warehouse_locations(id) ON DELETE SET NULL;
CREATE INDEX ix_sales_invoice_items_batch_id ON sales_invoice_items (batch_id);
CREATE INDEX ix_sales_invoice_items_serial_id ON sales_invoice_items (serial_id);
CREATE INDEX ix_sales_invoice_items_location_id ON sales_invoice_items (warehouse_location_id);

-- sales_return_items
ALTER TABLE sales_return_items ADD COLUMN batch_id VARCHAR(50) REFERENCES item_batches(id) ON DELETE SET NULL;
ALTER TABLE sales_return_items ADD COLUMN serial_id VARCHAR(50) REFERENCES item_serials(id) ON DELETE SET NULL;
CREATE INDEX ix_sales_return_items_batch_id ON sales_return_items (batch_id);
CREATE INDEX ix_sales_return_items_serial_id ON sales_return_items (serial_id);
```

## 8. Files Created
1. `backend/alembic/versions/v1520_item_master_phase5_batch_serial_location_wiring.py`: Reversible migration for tracking foreign keys and indexes.
2. `backend/app/tests/test_item_master_phase5_tracking_wiring.py`: Dedicated verification test suite with 8 comprehensive test cases.
3. `docs/implementation/catalog/Item_Master_Phase5_Tracking_Transaction_Wiring_Plan_v6.70.0.md`: This 19-section implementation plan.
4. `docs/walkthrough/catalog/Item_Master_Phase5_Tracking_Transaction_Wiring_v6.70.0.md`: Accompanying 13-section walkthrough document.

## 9. Files Modified
1. `backend/app/models/inventory.py`: Added `batch_id`, `serial_id`, `location_id` and relationships to `StockMovement`.
2. `backend/app/models/purchase.py`: Added `batch_id`, `warehouse_location_id` and relationships to `PurchaseReceiptItem`.
3. `backend/app/models/sales.py`: Added `batch_id`, `serial_id`, `warehouse_location_id` to `SalesInvoiceItem` and `batch_id`, `serial_id` to `SalesReturnItem`.
4. `backend/app/services/item/item_tracking_svc.py`: Added `resolve_or_create_batch`, `resolve_or_create_serial`, and `resolve_or_create_warehouse_location`.
5. `docs/implementation/README.md`: Registered Phase 5 in master index.
6. `docs/walkthrough/README.md`: Registered Phase 5 in master index.

## 10. Dependencies
- Alembic migration revision chain: `v1519_item_master_phase2_uom_pricing_tax_policies` -> `v1520_item_master_phase5_batch_serial_location_wiring`.
- PostgreSQL 15 running on port 2781 (`smriti-db` container).
- SQLAlchemy 2.0 AsyncSession and asyncpg driver.

## 11. Risks
| Risk | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| Migration locking large transaction tables | Low | Medium | Columns added as `NULLABLE` without default values; PostgreSQL executes this instantaneously with metadata-only locks. |
| Breaking existing invoice/receipt inserts | Low | High | Foreign keys are strictly nullable; all existing payload schemas and test fixtures function without modification. |
| Dangling pointers on master record deletion | Low | Medium | Strict `ON DELETE SET NULL` ensures child transactions retain integrity if tracking records are removed. |

## 12. Rollback Strategy
Migration `v1520` is fully reversible:
```bash
alembic -x target=tenant -x db=smriti001 downgrade v1519
```
The downgrade routine drops all created indexes, drops foreign key constraints, and removes the added columns across all 4 tables in reverse order. Reversibility verified via dry-run downgrade and re-upgrade during Phase 5 execution.

## 13. Verification Plan
1. Apply migration `v1520` to `smriti001` and verify current revision.
2. Query `information_schema.columns` to verify presence, datatype, and nullability across all 10 added columns.
3. Test dry-run downgrade to `v1519` and re-upgrade to `v1520`.
4. Execute `backend/app/tests/test_item_master_phase5_tracking_wiring.py` (8/8 passed).
5. Execute full regression suite of 45 tests across 5 modules (45/45 passed).
6. Execute `npx tsc --noEmit` (0 errors).

## 14. Test Plan
- `test_schema_phase5_column_parity`: Column-by-column schema parity check across all 4 tables.
- `test_item_tracking_service_resolve_or_create_batch`: Batch resolution, idempotent creation, attribute persistence.
- `test_item_tracking_service_resolve_or_create_serial`: Serial resolution and warranty date validation.
- `test_item_tracking_service_resolve_or_create_warehouse_location`: Location bin/aisle/shelf resolution.
- `test_stock_movement_phase5_fk_wiring_and_relationships`: Stock movement persistence and ORM relationship navigation.
- `test_purchase_receipt_item_phase5_fk_wiring`: Purchase receipt line item batch and location linking.
- `test_sales_invoice_item_phase5_fk_wiring`: Sales invoice line item batch, serial, and location linking.
- `test_sales_return_item_phase5_fk_wiring`: Sales return line item batch and serial linking.

## 15. Documentation Impact
- Update `docs/implementation/README.md` with Phase 5 entry.
- Update `docs/walkthrough/README.md` with Phase 5 entry.
- Publish `docs/walkthrough/catalog/Item_Master_Phase5_Tracking_Transaction_Wiring_v6.70.0.md`.

## 16. Deployment Plan
1. Zero downtime deployment.
2. Run database migration `v1520` against target tenant databases.
3. Restart backend API workers.
4. Verify `/health` and transactional endpoint functionality.

## 17. Status
**Completed** — Implemented, migrated, and verified with 45/45 tests passing and 0 TypeScript compilation errors.

## 18. Related ADRs
- `docs/adr/ADR-0082-Universal-Item-Master-Decomposition.md`
- `docs/adr/ADR-0044-Five-Bucket-Inventory-ATP-Ledger.md`

## 19. Related Walkthroughs
- `docs/walkthrough/catalog/Item_Master_Phase4_Service_Decomposition_v6.70.0.md`
- `docs/walkthrough/catalog/Item_Master_Phase5_Tracking_Transaction_Wiring_v6.70.0.md`
