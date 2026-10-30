<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.128.0
  Created      : 2026-10-28
  Modified     : 2026-10-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: WMS Phase 3 — Dynamic Picking Bin Replenishment Engine & Min/Max Inventory Slotting Tasks

**Document ID:** WGP-WMS-v3.128.0  
**Status:** Completed  
**Version:** 3.128.0  
**Effective Date:** 2026-10-28  

---

## 1. Purpose
This walkthrough details the design, implementation, and verification of **WMS Phase 3: Dynamic Picking Bin Replenishment Engine & Min/Max Inventory Slotting Tasks** across SMRITI Retail OS. Phase 3 automates warehouse replenishment cycles by detecting fast-picking bin depletions, identifying available reserve stock in bulk racks, and executing atomic ledger transfers.

## 2. Scope
1. **Pydantic Schemas:** `ReplenishmentTaskItem`, `ReplenishmentTasksResponse`, `ReplenishmentExecuteItem`, `ReplenishmentExecuteRequest`, `ReplenishmentExecuteResponse`, `ItemSlottingConfigItem`, and `ItemSlottingSaveRequest`.
2. **Service Methods:** `get_replenishment_tasks`, `execute_replenishment_tasks`, `get_warehouse_slotting`, `save_item_slotting` in `InventoryWmsService`.
3. **REST API Endpoints:**
   - `GET /api/v1/wms/warehouses/{warehouse_id}/replenishment-tasks`
   - `POST /api/v1/wms/warehouses/{warehouse_id}/replenishment/execute`
   - `GET /api/v1/wms/warehouses/{warehouse_id}/slotting`
   - `POST /api/v1/wms/warehouses/{warehouse_id}/slotting`
4. **Frontend UI Components:**
   - Interactive Replenishment Engine toolbar button with pulsing critical indicator in `WarehouseLocationManager.tsx`.
   - Comprehensive Replenishment modal with urgency filtering, visual stock headroom bars, quantity overrides, and batch execution.
   - Dedicated Min/Max Slotting Master Tab with inline rule configuration.
   - Enhanced subtab navigation in `WmsStudioTab.tsx`.
5. **Automated Verification:**
   - New dedicated Pytest test suite (`test_wms_replenishment_and_slotting.py`).
   - Zero TypeScript compilation errors (`tsc --noEmit`).

## 3. Files Created
- `backend/tests/test_wms_replenishment_and_slotting.py`
- `docs/implementation/wms/WMS_Phase3_Dynamic_Picking_Bin_Replenishment_And_Slotting_Plan_v3.128.0.md`
- `docs/walkthrough/wms/WMS_Phase3_Dynamic_Picking_Bin_Replenishment_And_Slotting_v3.128.0.md`

## 4. Files Modified
- `backend/app/schemas/wms.py`
- `backend/app/services/inventory_wms.py`
- `backend/app/api/v1/wms.py`
- `src/components/wms/WarehouseLocationManager.tsx`
- `src/components/wms/WmsStudioTab.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`
- `RELEASE_NOTES.md`

## 5. Architecture Decisions
- **Decision 1: Dual Ledger Leg Atomicity:** Each replenishment transfer creates a linked pair of `StockMovement` records (`TRANSFER_OUT` with negative quantity from the source bulk bin, and `TRANSFER_IN` with positive quantity into the destination picking bin) within the same transactional session flush, tagged with `reference_doc_type="WMS_REPLENISHMENT"`.
- **Decision 2: Live Stock Headroom Calculation:** The replenishment engine queries live bin occupancy directly from `StockMovement` aggregations, ensuring instant reaction to order picks without relying on delayed asynchronous caches.
- **Decision 3: Tiered Urgency Classification:**
  - `CRITICAL`: Current picking stock is 0 units (immediate stockout risk).
  - `HIGH`: Current stock is below 50% of the minimum reorder level.
  - `NORMAL`: Current stock has breached the minimum reorder level.
  - `BULK_STOCKOUT`: Depleted picking bin has no available stock across bulk racks, alerting procurement to raise an external PO.

## 6. Design Rationale
- **Separation of Picking and Reserve Stock:** High-density warehouses store majority stock in upper racks (`BULK` or `STORAGE`) and maintain small fast-picking allocations at floor level (`PICKING`). Automated replenishment guarantees floor associates never arrive at an empty bin during picking runs.
- **Operator Override Support:** While suggested transfer quantities default to standard batch sizes or remaining headroom, warehouse managers can manually tweak the quantity before triggering execution.

## 7. Implementation Summary
1. **Schema Definition (`backend/app/schemas/wms.py`):**
   Added robust request/response models supporting task inspection, batch execution, and slotting persistence.
2. **Service Layer (`backend/app/services/inventory_wms.py`):**
   Implemented `get_replenishment_tasks` to correlate `ItemWarehouseLocation` configurations with `StockMovement` balances across all warehouse bins, identify candidate source bulk bins, and compute transfer quantities.
   Implemented `execute_replenishment_tasks` to atomically record internal stock movements and return audit run IDs.
   Implemented `get_warehouse_slotting` and `save_item_slotting` for slotting governance.
3. **API Routing (`backend/app/api/v1/wms.py`):**
   Exposed four protected endpoints wired to `InventoryWmsService` with tenant and role-based permissions.
4. **Frontend Architecture (`WarehouseLocationManager.tsx`):**
   Added action buttons, live status badges, a rich multi-tab modal for replenishment execution and slotting rules, and visual headroom indicators.

## 8. Tests Executed
1. `backend/tests/test_wms_replenishment_and_slotting.py`:
   - `test_replenishment_critical_depleted_picking_bin`: PASSED
   - `test_replenishment_bulk_stockout_handling`: PASSED
   - `test_replenishment_transfer_execution`: PASSED
   - `test_slotting_save_and_retrieve`: PASSED
   - `test_replenishment_api_endpoints`: PASSED
2. Full WMS regression suite (6 files):
   - `test_wms_putaway_and_location_matrix.py`
   - `test_wms_replenishment_and_slotting.py`
   - `test_warehouse_location_management.py`
   - `test_warehouse_code_governance.py`
   - `test_inventory_warehouse_resolver.py`
   - `test_wms_integrity_deferred.py`
   - **Result:** 34 passed, 29 warnings in 224.94s.
3. TypeScript compiler check:
   - `npx tsc --noEmit --project tsconfig.json`: **0 errors (exited 0)**.

## 9. Verification Results
```text
Implementation Status

✓ Code Complete
✓ Tests Passed (34/34 green)
✓ TypeScript Clean (0 errors)
✓ Documentation Updated
✓ CHANGELOG Updated
✓ Release Notes Updated
✓ Architecture Verified

Evidence Level: A (Full literal diff and test outputs provided)
```

## 10. Known Limitations
- Replenishment execution currently routes stock within the same physical warehouse. Multi-warehouse replenishment (inter-godown STO) is governed separately by the Stock Transfer Orders module.

## 11. Future Work
- **Phase 4:** Barcode RF gun handheld scanning workflow for pickers executing replenishment on the warehouse floor.
- **Phase 5:** Predictive seasonal slotting adjustments driven by sales velocity analytics.

## 12. Related ADRs
- `ADR-0021`: Warehouse Physical Location and Bin Structure
- `ADR-0045`: Multi-tier Inventory Resolution Architecture

## 13. Related RFCs
- `RFC-WMS-014`: Physical Bin Replenishment and Min/Max Slotting Architecture
