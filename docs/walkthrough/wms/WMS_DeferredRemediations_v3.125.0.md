<!--
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.125.0
Created      : 2026-10-27
Modified     : 2026-10-27
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
-->

# WMS & Location Integrity: Deferred Remediations Phase (R-003, R-005, R-008)

**Version:** 3.125.0  
**Date:** 2026-10-27  
**Area:** Inventory & WMS  
**Status:** Completed  

---

## 1. Purpose

Implement the three previously deferred remediation items from the Warehouse, Outlet, Store & Location Management Audit:
- **R-003**: Enforce NOT NULL on `purchase_receipts.warehouse_id` with backward-compatible backfill migration and API resolution guard.
- **R-005**: Introduce multi-step stock transfer approval gate (`DRAFT` → `REQUESTED` → `APPROVED` → `DISPATCHED`) with configurable bypass flag to prevent disruption to existing operational deployments.
- **R-008**: Refactor `StoreDirectoryWs.tsx` to list all canonical branches and warehouses directly via `GET /branches` and `GET /wms/warehouses`, guaranteeing visibility of unstaffed locations and godowns.

---

## 2. Scope

- Migration `v1560_purchase_receipt_warehouse_not_null.py` backfilling NULL rows with company's oldest active warehouse before altering column to NOT NULL.
- Update `PurchaseReceipt` ORM model (`backend/app/models/purchase.py`) setting `nullable=False`.
- Update `create_purchase_receipt` (`backend/app/services/purchase.py`) with `InventoryWarehouseResolver` guard raising HTTP 422 on unresolvable or inactive warehouses.
- Update `TransferStatus` enum (`backend/app/models/inventory.py`) adding `REQUESTED`, `APPROVED`, and `REJECTED`.
- Add `request_stock_transfer`, `approve_stock_transfer`, and `reject_stock_transfer` to `InventoryWmsService` (`backend/app/services/inventory_wms.py`).
- Update `dispatch_stock_transfer` to enforce approval for `REQUESTED` transfers and support `bypass_approval` (default `True`).
- Expose `/transfers/{id}/request`, `/transfers/{id}/approve`, and `/transfers/{id}/reject` endpoints in `backend/app/api/v1/wms.py`.
- Expose `GET /branches` on WMS router in `backend/app/api/v1/wms.py` for direct branch lookup.
- Update `src/components/store/StoreDirectoryWs.tsx` to directly query `GET /branches` and `GET /wms/warehouses` with `WAREHOUSE` filter and KPI card.
- Comprehensive unit test suite in `backend/tests/test_wms_integrity_deferred.py`.

---

## 3. Files Created

1. `backend/alembic/versions/v1560_purchase_receipt_warehouse_not_null.py` — Alembic migration for R-003 backfill and NOT NULL constraint.
2. `backend/tests/test_wms_integrity_deferred.py` — Unit test suite for R-003, R-005, and R-008.
3. `docs/walkthrough/wms/WMS_DeferredRemediations_v3.125.0.md` — This walkthrough document.

---

## 4. Files Modified

1. `backend/app/models/purchase.py` — `PurchaseReceipt.warehouse_id` set to `nullable=False`.
2. `backend/app/services/purchase.py` — `create_purchase_receipt` wraps resolver with HTTP 422 error handling.
3. `backend/app/models/inventory.py` — Added `REQUESTED`, `APPROVED`, `REJECTED` to `TransferStatus` enum.
4. `backend/app/services/inventory_wms.py` — Implemented transfer approval workflow and configurable bypass flag.
5. `backend/app/api/v1/wms.py` — Added transfer request/approve/reject endpoints and direct `/branches` endpoint.
6. `src/components/store/StoreDirectoryWs.tsx` — Direct branch/warehouse fetching, unstaffed location visibility, warehouse KPI.
7. `docs/walkthrough/README.md` — Appended entry to master walkthrough index.

---

## 5. Architecture Decisions

- **ADR-WMS-003**: GRN Warehouse Attribution Mandatory. Goods receipts without a target godown corrupt stock accounting; warehouse assignment is strictly required.
- **ADR-WMS-005**: Multi-Tier Transfer Approval with Safe Default Bypass. Transfer orders can be routed through formal manager approval (`REQUESTED` → `APPROVED`) without breaking single-operator retail stores where immediate dispatch is needed.
- **ADR-WMS-008**: Dual-Master Direct Location Discovery. Location directory interfaces must query canonical entity endpoints (`/branches`, `/wms/warehouses`) rather than deriving facilities from staff attendance or placement rosters.

---

## 6. Design Rationale

- **Safe Two-Step Migration**: If historical GRN rows exist without a warehouse, plain `ALTER COLUMN SET NOT NULL` would fail. Migration `v1560` backfills NULLs using the company's oldest active warehouse first.
- **Configurable Approval Bypass**: Setting `bypass_approval=True` by default preserves full backward compatibility for existing POS and WMS automation while enabling strict approval whenever transfers are submitted via `/request`.
- **Enrichment Rather Than Exclusion**: `StoreDirectoryWs` fetches physical locations first as the authoritative base, then joins staff placements and attendance if present. Locations with 0 staff are cleanly rendered rather than dropped.

---

## 7. Implementation Summary

- **R-003**: Migration `v1560` authored. `PurchaseReceipt.warehouse_id` marked `nullable=False`. Service layer catches unconfigured/inactive warehouse resolution and raises friendly `SMRITI-WMS-001` error.
- **R-005**: `TransferStatus` updated with 3 states. `InventoryWmsService` gained 3 state transition methods. `dispatch_stock_transfer` rejects `REQUESTED` until `APPROVED`. REST endpoints added to `wms.py`.
- **R-008**: `StoreDirectoryWs.tsx` rewritten to call `apiFetchV1('/branches')` and `apiFetchV1('/wms/warehouses')`. Added warehouse counters, type filtering, and badges.

---

## 8. Tests Executed

1. Python syntax compilation:
   ```powershell
   python -m py_compile backend/alembic/versions/v1560_purchase_receipt_warehouse_not_null.py backend/app/models/purchase.py backend/app/models/inventory.py backend/app/services/purchase.py backend/app/services/inventory_wms.py backend/app/api/v1/wms.py
   ```
2. Frontend TypeScript compilation:
   ```powershell
   npx tsc --noEmit --project tsconfig.json
   ```
3. Pytest test suite:
   ```powershell
   pytest backend/tests/test_wms_integrity_deferred.py -v
   ```

---

## 9. Verification Results

- `python -m py_compile`: Exit code 0, 0 syntax errors.
- `npx tsc --noEmit`: Exit code 0, 0 compiler errors.
- `pytest backend/tests/test_wms_integrity_deferred.py`: 6 passed in 43.98s:
  - `test_r003_purchase_receipt_model_warehouse_not_null`: PASSED
  - `test_r005_transfer_status_enum_members`: PASSED
  - `test_r005_dispatch_blocks_requested_status`: PASSED
  - `test_r005_dispatch_blocks_draft_when_bypass_false`: PASSED
  - `test_r005_request_approve_reject_transitions`: PASSED
  - `test_r008_wms_router_exposes_branches`: PASSED

---

## 10. Known Limitations

- In production databases where companies have NULL warehouse GRNs AND zero active warehouses, migration v1560 intentionally raises an error to prompt warehouse setup before constraining.
- The approval bypass flag in `wms.py` is currently a parameter flag (`bypass_approval=True`). In future phases, this can be linked to a company-level governance policy setting in `system_parameters`.

---

## 11. Future Work

- Connect transfer approval threshold amounts to `approval_matrix.py` rules.
- Add physical godown bin / aisle allocation directly into `StoreDirectoryWs` detail drawer.

---

## 12. Related ADRs

- `ADR-0012`: Multi-Tenant Scoped Database Architecture.
- `ADR-0044`: Multi-Branch Inventory & Warehousing Governance.

---

## 13. Related RFCs

- `RFC-2026-WMS-LOCATION-AUDIT-01`: Enterprise Location and Warehouse Integrity Architecture.
