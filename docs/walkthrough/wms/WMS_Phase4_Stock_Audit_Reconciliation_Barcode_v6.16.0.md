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
**Status:** Implemented, runtime-tested, and certified  

---

## 1. Purpose
Provide distributors and warehouse operations with a complete physical stocktaking and inventory audit lifecycle. This system eliminates divergence between book balances and physical shelf stock by supporting snapshotted cycle counting, hands-free barcode scanner count increments, automatic variance calculation, statutory loss/surplus attribution, and ledger discrepancy reconciliation.

---

## 2. Scope
1. **Snapshotted Stocktaking Cycles (`StockAudit` & `StockAuditItem`)**:
   - Baseline snapshots of all active batch stocks (`system_qty`) in a target godown.
   - Non-blocking audit cycles allowing normal warehouse operations during counting.
2. **Barcode Scanner Rapid Batch Counting Engine**:
   - Fast endpoint (`/wms/audits/{id}/scan`) resolving scanned barcode/SKU to batch lines and auto-incrementing counted quantities.
   - Automatic discovery and categorization of unlisted items found during audits (`SURPLUS_FOUND`).
3. **Variance Tracking & Loss Attribution**:
   - Real-time computation of `variance_qty = counted_qty - system_qty` and `variance_value`.
   - Categorization by statutory write-off reason (`DAMAGED`, `EXPIRED`, `THEFT_LOSS`, `SURPLUS_FOUND`, `COUNTING_ERROR`).
4. **Ledger Discrepancy Reconciliation (`StockAuditService`)**:
   - Applies batch inventory mutations (+ for surplus, - for deficit).
   - Generates immutable audit trail movements (`OUTWARD_LOSS`, `INWARD_SURPLUS`) in `stock_movements`.
   - Resynchronizes cached aggregate product balances (`products.stock`).
5. **WMS Studio UI Workspace Integration**:
   - First-class "Stock Audit & Recon" sub-tab in `WmsStudioTab.tsx`.
   - Barcode scanning input, live color-coded variance grid, and one-click reconciliation modal.

---

## 3. Files Created
1. `backend/app/services/stock_audit_service.py`: Domain engine for audit snapshots, scanner increments, variance calculation, and ledger reconciliation.
2. `backend/tests/test_wms_phase4_audit_reconciliation.py`: Complete isolated pytest suite testing snapshotting, barcode scanning, deficit write-off, and surplus inwarding.
3. `scripts/smoke_test_wms_phase4.py`: End-to-end async HTTP smoke test executing all 7 physical audit operations with database cleanup.
4. `docs/walkthrough/wms/WMS_Phase4_Stock_Audit_Reconciliation_Barcode_v6.16.0.md`: This comprehensive walkthrough document.

---

## 4. Files Modified
1. `backend/app/models/inventory.py`: Added `StockAudit` and `StockAuditItem` SQLAlchemy database models.
2. `backend/app/schemas/wms.py`: Added Pydantic request/response schemas for audits, bulk counts, and barcode scanning.
3. `backend/app/api/v1/wms.py`: Added 6 REST endpoints for listing, creating, scanning, counting, and reconciling physical audits.
4. `backend/tests/test_wms_phase2_grn_sales.py`: Isolated test product creation in credit limit enforcement test to prevent stock check contention.
5. `src/components/wms/WmsStudioTab.tsx`: Added "Stock Audit & Recon" workstation sub-tab with scanner input and variance grid.

---

## 5. Architecture Decisions
1. **Immutable Baseline Snapshot**:
   - Physical counts are evaluated against `system_qty` captured at audit creation time (`StockAuditItem.system_qty`), ensuring that audit variance calculations remain mathematically stable.
2. **Atomic Batch & Ledger Reconciliation**:
   - Stock reconciliation occurs inside a single database transaction. Batch stocks (`ProductBatchStock`), ledger audit rows (`StockMovement`), and product cache (`products.stock`) are updated atomically.
3. **Role & Action Level Permission Guarding**:
   - All audit read endpoints require `stock_ledger:VIEW`, while audit creation, scanning, manual counting, and ledger reconciliation require `stock_ledger:EDIT` / `ADMIN`.

---

## 6. Design Rationale
- **Hands-Free Barcode Scanning**: Handheld 2D/1D wireless barcode scanners typically send keystrokes followed by `Enter`. The WMS Studio scanner workstation captures this input stream and triggers rapid single-item (+1) or multi-item increments without requiring mouse clicks.
- **Color-Coded Variance Recognition**: Immediate visual feedback (Green for Matched, Red for Deficit/Loss, Cyan for Surplus) allows warehouse managers to spot discrepancy trends instantly before committing adjustments to the financial ledger.

---

## 7. Implementation Summary
- **Database DDL**: Tables `stock_audits` and `stock_audit_items` created in `smriti001` and `smritisys` with scoped unique indexes.
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
   - `test_stock_audit_barcode_scanning_and_surplus_handling` (Passed)
   - `test_stock_audit_reconciliation_deficit_write_off` (Passed)
   - `test_stock_audit_reconciliation_surplus_inward` (Passed)
2. `scripts/smoke_test_wms_phase4.py`:
   - 7/7 live HTTP steps executed and verified with zero residual database rows.
3. Combined Regression:
   - 19/19 tests across Phase 1, Phase 2, Phase 3, and Phase 4 passed in 9.14s.

---

## 9. Verification Results

```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
collected 19 items

backend\tests\test_menu_governance.py .                                  [  5%]
backend\tests\test_security_menu_access.py ..                            [ 15%]
backend\tests\test_wms_phase1.py ....                                    [ 36%]
backend\tests\test_wms_phase2_grn_sales.py ...                           [ 52%]
backend\tests\test_wms_phase3_eway_bill.py .....                         [ 78%]
backend\tests\test_wms_phase4_audit_reconciliation.py ....               [100%]

======================== 19 passed, 1 warning in 9.14s ========================
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
