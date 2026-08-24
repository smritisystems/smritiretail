<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-22
  Modified     : 2026-08-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI WMS Phase 2: Inward GRN Batch Capture, B2B Sales FEFO Allocation, and Retailer Credit Limits (v6.16.0)

## 1. Purpose
This walkthrough documents the full production implementation of SMRITI Distributor & Warehouse Management System (WMS) Phase 2. Phase 2 bridges multi-godown batch inventory with procurement goods receipts (Inward GRN), outward B2B sales invoicing (automated First-Expired, First-Out FEFO allocation and stock deduction), customer group credit limit policies (`SMRITI-CREDIT-001`), and sales invoice cancellation inventory reversals.

## 2. Scope
- **Inward GRN Batch Ingestion**: Extending `PurchaseReceipt` and `PurchaseReceiptItem` models, schemas, and `PurchaseService` to capture receiving godown (`warehouse_id`), batch numbers (`batch_no`), manufacturing/expiry dates (`mfg_date`, `expiry_date`), MRP (`mrp`), and damaged units (`quantity_damaged`), invoking `InventoryWmsService.atomic_mutate_batch_stock` with `movement_type='INWARD_GRN'`.
- **Outward B2B Sales FEFO Auto-Allocation**: Extending `SalesInvoice` and `SalesInvoiceItem` models, schemas, and `SalesService` to auto-allocate batch quantities via `allocate_stock_fefo` (`movement_type='SALES_OUTWARD'`) and deduct batch quantities atomically.
- **Retailer Credit Limit Enforcement**: Enforcing `CustomerGroup` credit limits and auto-block flags in `CrmService.check_credit_limit` during sales invoice creation (`Customer.outstanding + invoice.grand_total > CustomerGroup.credit_limit`).
- **Sales Invoice Cancellation Reversal**: Restoring deducted batch inventory (`movement_type='SALES_CANCEL'`) and adjusting retailer outstanding balance upon invoice cancellation.
- **Alembic Database Migration**: Reversible schema revision `v1340_add_grn_sales_batch_columns.py` registered as the Alembic head.
- **Multi-Tenant Transactional DDL**: `scripts/migr_wms_phase2.py` applying schema modifications and default godown backfills across all company databases.
- **Automated Integration & Live Smoke Tests**: End-to-end pytest suite `backend/tests/t_wms_phase2.py` and 10-endpoint live HTTP smoke test `scripts/smoke_test_wms_api.py`.

## 3. Files Created
1. `backend/alembic/versions/v1340_add_grn_sales_batch_columns.py`: Formal Alembic migration adding batch and warehouse columns.
2. `scripts/migr_wms_phase2.py`: Multi-tenant company database schema migrator.
3. `backend/tests/t_wms_phase2.py`: Integration test suite for Phase 2 GRN, Sales FEFO, credit limits, and cancellations.
4. `docs/walkthrough/wms/WMS_Phase2_Inward.md`: This Walkthrough document.

## 4. Files Modified
1. `backend/app/models/purchase.py`: Added `warehouse_id` on `PurchaseReceipt`; added `batch_no`, `mfg_date`, `expiry_date`, `mrp`, `quantity_damaged` on `PurchaseReceiptItem`.
2. `backend/app/models/sales.py`: Added `warehouse_id` on `SalesInvoice`; added `batch_no` on `SalesInvoiceItem`.
3. `backend/app/schemas/purchase.py`: Added batch, warehouse, and date fields to `PurchaseReceiptCreate`, `PurchaseReceiptResponse`, `PurchaseReceiptItemCreate`, `PurchaseReceiptItemResponse`.
4. `backend/app/schemas/sales.py`: Added `warehouse_id` to `SalesInvoiceBase` and `batch_no` to `SalesInvoiceItemBase`.
5. `backend/app/services/purchase.py`: Wired `create_purchase_receipt` to inward batch stock via `InventoryWmsService.atomic_mutate_batch_stock` and added company-scoped `_get_product` / `_get_supplier` resolution.
6. `backend/app/services/sales.py`: Wired `create_sales_invoice` to auto-allocate batches via FEFO and deduct batch inventory; updated `cancel_sales_invoice` to restore batch stock.
7. `backend/app/api/v1/purchase.py`: Added canonical contract aliases (`/receipts`, `/receipts/`) for purchase receipts.
8. `docker-compose.yml`: Added `./backend/app:/app/app` volume mount into `smriti-api` for live development synchronization.
9. `scripts/smoke_test_wms_api.py`: Extended to execute 10 live authenticated HTTP smoke tests including GRN and Sales FEFO.
10. `docs/walkthrough/README.md`: Appended master walkthrough index table with Phase 2 entry.

## 5. Architecture Decisions
- **Company Data Plane Isolation**: Operational batch inventories and transaction documents reside solely inside company databases (`smriti001`, `smriti002`, `smriti_test_fresh`), maintaining strict multitenant isolation.
- **Atomic Serialization with `with_for_update()`**: Batch selection and deductions lock rows explicitly to prevent concurrent double-allocation race conditions during high-volume distributor order processing.
- **Graceful Backward Compatibility**: If explicit `batch_no` is omitted on a sales invoice item, FEFO dynamically allocates the oldest available stock segments and updates the item with the primary allocated batch number.
- **Fail-Closed Credit Control**: When a retailer's group has `auto_block_sales=True`, any invoice exceeding `credit_limit` is rejected immediately with human-readable error `SMRITI-CREDIT-001`.

## 6. Design Rationale
In Indian distribution and wholesale operations, goods inward and sales outward must track physical lots with distinct expiry dates and MRPs. Automating FEFO at the backend eliminates manual batch selection errors and ensures compliance with drug/food expiry standards while preventing revenue loss from bad debts via automated credit limit gates.

## 7. Implementation Summary
- Extended PostgreSQL tables `purchase_receipts`, `purchase_receipt_items`, `sales_invoices`, `sales_invoice_items` across company databases with FKs and indexes.
- Updated SQLAlchemy declarative models and Pydantic validation schemas.
- Injected `InventoryWmsService` into `PurchaseService.create_purchase_receipt` and `SalesService.create_sales_invoice` / `cancel_sales_invoice`.
- Created comprehensive test harness validating the full procurement-to-sales inventory lifecycle.

## 8. Tests Executed
1. `python scripts/migr_wms_phase2.py`: Ran DDL migrations on all company databases.
2. `backend/tests/t_wms_phase2.py`: Executed 3 automated integration tests:
   - `test_grn_inward_batch_stock_creation`
   - `test_sales_invoice_fefo_auto_deduction_and_cancellation`
   - `test_retailer_credit_limit_enforcement`
3. `pytest backend/tests/`: Ran full suite (10/10 tests passed in 4.94s).
4. `scripts/smoke_test_wms_api.py`: Executed 10 authenticated live HTTP requests against FastAPI backend container (10/10 passed).
5. `npx vitest run src/tests/menuAccess.test.ts`: Frontend security tests (6/6 passed).

## 9. Verification Results
```text
============================= test session starts =============================
backend/tests/t_menu_gov.py .                                  [ 10%]
backend/tests/t_sec_menu.py ..                            [ 30%]
backend/tests/test_wms_phase1.py ....                                    [ 70%]
backend/tests/t_wms_phase2.py ...                           [100%]

======================== 10 passed, 1 warning in 4.94s ========================
```
```text
============================================================
ALL 10 AUTHENTICATED WMS PHASE 1 & 2 API SMOKE TESTS COMPLETED SUCCESSFULLY!
============================================================
```

## 10. Known Limitations
- Barcode scanning at GRN currently uses manual lot input; handheld scanner hardware integration is slated for Phase 3.
- Split-batch invoice line item visual representation in frontend table currently displays the primary batch.

## 11. Future Work
- **WMS Phase 3**: Direct barcode lot scanning, batch expiry alerting dashboard, bin location management within godowns, and distributor sales rep mobile order sync.

## 12. Related ADRs
- `ADR-0042`: FastAPI + PostgreSQL Sole Backend System of Record.
- `ADR-0089`: Multi-Godown Batch Inventory & FEFO Allocation Architecture.

## 13. Related RFCs
- `RFC-WMS-002`: Goods Receipt Batch Inward and Credit Limit Policy.
