<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-22
  Modified     : 2026-08-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough — WMS Phase 4: Warehouse Physical Inventory Audit, Stock Discrepancy Reconciliation & Barcode Batch Counting

**Version:** `v6.16.0`  
**Area:** `wms` / `inventory_audit`  
**Status:** Implemented and runtime-tested across `smriti001` and `smriti002`; control plane boundary enforced and concurrency-locked  

---

## 1. Purpose
Provide distributors and warehouse operations with a complete physical stocktaking and inventory audit lifecycle. This system eliminates divergence between book balances and physical shelf stock by supporting snapshotted cycle counting, hands-free barcode scanner count increments, automatic variance calculation, statutory loss/surplus attribution, and pessimistic locked ledger discrepancy reconciliation.

---

## 2. Scope
1. **Multi-Company Architecture & Tenant Isolation (`stock_audits` & `stock_audit_items`)**:
   - Company-local tables deployed strictly to tenant databases (`smriti001`, `smriti002`, `smriti_test_fresh`).
   - Cleaned control plane `smritisys` to eliminate architecture violations.
   - Comprehensive CHECK constraints on status, audit type, non-negative quantities, and discrepancy reasons.
2. **Versioned Alembic Migration**:
   - Registered `v1341_add_stock_audit_tables.py` chaining from `v1340_add_grn_sales_batch_columns`.
3. **Pessimistic Row Locking (`SELECT ... FOR UPDATE`) & Intervening Movement Auditing**:
   - `StockAuditService.reconcile_and_post_discrepancies` locks `ProductBatchStock` and `Product` during reconciliation.
   - Audits and detects intervening sales/dispatches between audit snapshot time and reconciliation time, embedding operational notes in the immutable audit trail.
4. **Barcode Scanner Rapid Batch Counting Engine**:
   - Fast endpoint (`/wms/audits/{id}/scan`) resolving scanned primary barcode, SKU, code, or secondary barcodes array (`Product.secondary_barcodes`) to batch lines and auto-incrementing counted quantities.
   - Automatic discovery and categorization of unlisted items found during audits (`SURPLUS_FOUND`).
5. **Variance Tracking & Loss Attribution**:
   - Real-time computation of `variance_qty = counted_qty - system_qty` and `variance_value`.
   - Categorization by statutory write-off reason (`DAMAGED`, `EXPIRED`, `THEFT_LOSS`, `SURPLUS_FOUND`, `COUNTING_ERROR`).
6. **Ledger Discrepancy Reconciliation (`StockAuditService`)**:
   - Applies batch inventory mutations (+ for surplus, - for deficit).
   - Generates immutable audit trail movements (`OUTWARD_LOSS`, `INWARD_SURPLUS`) in `stock_movements`.
   - Resynchronizes cached aggregate product balances (`products.stock`).
7. **WMS Studio UI Workspace Integration**:
   - First-class "Stock Audit & Recon" sub-tab in `WmsStudioTab.tsx`.
   - Barcode scanning input, live color-coded variance grid, and one-click reconciliation modal.

---

## 3. Files Created
1. `backend/app/services/stock_audit_service.py`: Domain engine for audit snapshots, scanner increments, variance calculation, pessimistic row locking, and ledger reconciliation.
2. `backend/alembic/versions/v1341_add_stock_audit_tables.py`: Official versioned Alembic migration for company databases.
3. `backend/tests/test_wms_phase4_audit_reconciliation.py`: Complete isolated pytest suite (6 tests) covering snapshotting, secondary barcodes, deficit write-offs, surplus inwards, `smriti002` multi-company execution, and intervening transaction detection.
4. `scripts/smoke_test_wms_phase4.py`: End-to-end async HTTP smoke test executing all 7 physical audit operations with database cleanup.
5. `docs/walkthrough/wms/WMS_Phase4_Stock_Audit_Reconciliation_Barcode_v6.16.0.md`: This comprehensive walkthrough document.

---

## 4. Files Modified
1. `backend/app/models/inventory.py`: Added `StockAudit` and `StockAuditItem` SQLAlchemy database models.
2. `backend/app/schemas/wms.py`: Added Pydantic request/response schemas for audits, bulk counts, and barcode scanning.
3. `backend/app/api/v1/wms.py`: Added 6 REST endpoints for listing, creating, scanning, counting, and reconciling physical audits.
4. `backend/tests/test_wms_phase2_grn_sales.py`: Isolated test product creation in credit limit enforcement test to prevent stock check contention.
5. `src/components/wms/WmsStudioTab.tsx`: Added "Stock Audit & Recon" workstation sub-tab with scanner input and variance grid.

---

## 5. Architecture Decisions
1. **Strict Control Plane Separation**:
   - `stock_audits` and `stock_audit_items` are strictly company-local tables and do not reside in `smritisys`.
2. **Pessimistic Concurrency Guarding**:
   - Stock reconciliation locks batch rows with `with_for_update()` to prevent race conditions during concurrent POS/invoicing dispatches.
3. **Multi-Identifier & Secondary Barcode Resolution**:
   - Scanner input searches `barcode`, `sku`, `code`, and PostgreSQL `secondary_barcodes` array.
4. **Immutable Baseline Snapshot & Intervening Transaction Detection**:
   - Counts are evaluated against `system_qty` captured at audit creation time. Intervening movements post-snapshot are tracked and embedded in audit trail remarks.

---

## 6. Design Rationale
- **Hands-Free Barcode Scanning**: Handheld 2D/1D wireless barcode scanners capture input stream and trigger rapid single-item (+1) or multi-item increments without requiring mouse clicks.
- **Color-Coded Variance Recognition**: Immediate visual feedback (Green for Matched, Red for Deficit/Loss, Cyan for Surplus) allows warehouse managers to spot discrepancy trends instantly before committing adjustments to the financial ledger.

---

## 7. Implementation Summary
- **Database DDL**: Tables `stock_audits` and `stock_audit_items` created in `smriti001`, `smriti002`, and `smriti_test_fresh` with CHECK constraints.
- **FastAPI Endpoints**:
  - `GET /api/v1/wms/audits`
  - `POST /api/v1/wms/audits`
  - `GET /api/v1/wms/audits/{id}`
  - `POST /api/v1/wms/audits/{id}/count`
  - `POST /api/v1/wms/audits/{id}/scan`
  - `POST /api/v1/wms/audits/{id}/reconcile`
- **Frontend Workstation**: Live barcode input, variance KPI cards, inline count editing, and ledger reconciliation trigger.

---

## 8. Tests Executed
1. `backend/tests/test_wms_phase4_audit_reconciliation.py`:
   - `test_stock_audit_creation_and_baseline_snapshot` (Passed)
   - `test_stock_audit_barcode_scanning_and_secondary_barcodes` (Passed)
   - `test_stock_audit_reconciliation_deficit_write_off` (Passed)
   - `test_stock_audit_reconciliation_surplus_inward` (Passed)
   - `test_stock_audit_multi_company_isolation_smriti002` (Passed)
   - `test_stock_audit_intervening_movement_detection_and_locking` (Passed)
2. `scripts/smoke_test_wms_phase4.py`:
   - 7/7 live HTTP steps executed and verified with zero residual database rows.
3. Combined Multi-Module Regression:
   - 21/21 tests across Menu Governance, Security Access, WMS Phase 1, Phase 2, Phase 3, and Phase 4 passed in 9.88s.

---

## 9. Verification Results

```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
collected 21 items

backend\tests\test_menu_governance.py .                                  [  4%]
backend\tests\test_security_menu_access.py ..                            [ 14%]
backend\tests\test_wms_phase1.py ....                                    [ 33%]
backend\tests\test_wms_phase2_grn_sales.py ...                           [ 47%]
backend\tests\test_wms_phase3_eway_bill.py .....                         [ 71%]
backend\tests\test_wms_phase4_audit_reconciliation.py ......             [100%]

======================== 21 passed, 1 warning in 9.88s ========================
```

---

## 10. Known Limitations
- Physical scanning relies on keyboard emulation or USB HID wedge scanners. Bluetooth SPP / serial scanners require web serial bridge integration.

---

## 11. Future Work
- Scheduled cycle count cron schedules by warehouse zone/aisle.
- Mobile PWA offline stocktake mode with local IndexedDB queueing.

---

## 12. Related ADRs
- `docs/architecture/ADR_WMS_MultiWarehouse_Batch_Tracking.md`
- `docs/architecture/ADR_Physical_Inventory_Reconciliation_Ledger.md`

---

## 13. Related RFCs
- `RFC-WMS-004`: Physical Inventory Audit & Barcode Scanner Integration
