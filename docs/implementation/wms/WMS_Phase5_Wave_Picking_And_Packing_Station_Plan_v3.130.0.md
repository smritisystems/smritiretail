<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.130.0
  Created      : 2026-10-28
  Modified     : 2026-10-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# WMS Phase 5 Implementation Plan: Automated Wave Picking, Batch Picking Optimization & Packing Station Integration

**Plan Version:** v3.130.0  
**Area:** Warehouse Management System (WMS) / Fulfillment & Packing Operations  
**Date:** 2026-10-28  
**Status:** Approved  

---

## 1. Objective
Deliver **WMS Phase 5: Automated Wave Picking, Batch Picking Optimization & Packing Station Integration** across SMRITI Retail OS. Phase 5 bridges order fulfillment demands (Sales Orders, B2B consignments, and Store replenishment requests) into optimized batch pick waves. It routes floor pickers along a serpentine single-pass path (`zone -> aisle -> rack -> shelf -> bin`), supports live RFID/barcode optical verification, and atomically commits picked goods into staging bays and packing stations via the `StockMovement` ledger (`reference_doc_type="WMS_WAVE_PICK"`), with downstream carton packing.

---

## 2. Business Motivation
In high-volume apparel, footwear, and retail distribution centers:
1. Single-order discrete picking requires associates to traverse the entire godown repeatedly, resulting in excessive floor travel time and order fulfillment bottlenecks.
2. Grouping open orders into wave pick lists cuts travel distance by up to 60% through serpentine routing.
3. Direct integration with physical staging bays and packing stations guarantees seamless handoff from pickers to packers, ensuring that 100% of packed cartons are verified against pick lists before transport dispatch.

---

## 3. Scope
- **Backend Services (`backend/app/services/inventory_wms.py`)**:
  - `create_pick_wave`: Aggregates open demands, resolves optimal physical bins with available stock, computes serpentine travel sequences, and distributes tasks across available pickers.
  - `get_waves` & `get_wave_details`: Retrieves active/completed waves with live completion metrics and progress percentages.
  - `record_wave_pick`: Records optical barcode/RFID verification per line item with shortage/skip reason codes.
  - `complete_wave_and_dispatch`: Atomically generates dual `StockMovement` ledger records (`TRANSFER_OUT` from picking bins + `TRANSFER_IN` to staging bay) with audit reference `WMS_WAVE_PICK`.
  - `get_packing_station_manifest` & `pack_wave_carton`: Queries staging bay inventory and packs items into shipping cartons.
- **FastAPI Endpoints (`backend/app/api/v1/wms.py`)**:
  - `POST /api/v1/wms/warehouses/{warehouse_id}/waves`
  - `GET /api/v1/wms/warehouses/{warehouse_id}/waves`
  - `GET /api/v1/wms/warehouses/{warehouse_id}/waves/{wave_id}`
  - `POST /api/v1/wms/warehouses/{warehouse_id}/waves/{wave_id}/pick`
  - `POST /api/v1/wms/warehouses/{warehouse_id}/waves/{wave_id}/complete`
  - `GET /api/v1/wms/warehouses/{warehouse_id}/packing-station`
  - `POST /api/v1/wms/warehouses/{warehouse_id}/packing-station/pack`
- **Pydantic Schemas (`backend/app/schemas/wms.py`)**:
  - Full request/response schemas for Wave Creation, Task Execution, Completion, and Packing.
- **Frontend Upgrades**:
  - `src/components/inventory/WarehouseWavePickingModal.tsx`: Connects live REST API, real RFID/barcode verification, and staging bay commit.
  - `src/components/wms/WmsStudioTab.tsx`: Enables seamless launch of live wave picking and packing workflows.
- **Automated Verification**:
  - Dedicated unit/integration suite in `backend/tests/test_wms_wave_picking.py`.

---

## 4. Current State
- `WavePickingOptimiser` in `src/utils/wavePickingOptimiser.ts` had local algorithmic serpentine sorting functions, but lacked live backend API endpoints.
- `WarehouseWavePickingModal.tsx` operated on mock static data (`WP-01`, `WP-02`) with no database connectivity to `StockMovement` or warehouse inventory.
- Phase 1 (Locations), Phase 2 (Putaway Rules), Phase 3 (Replenishment Engine), and Phase 4 (RF Gun Terminal) are fully operational and verified.

---

## 5. Gap Analysis
| Feature | Current State | Target State (Phase 5) |
|---|---|---|
| **Wave Planning API** | None (client-only mock) | Live `POST /warehouses/{id}/waves` with serpentine routing |
| **Pick Verification** | Mock local state | Optical scan & RFID verification via backend API |
| **Ledger Movement** | None | Atomic dual `StockMovement` to staging bays (`WMS_WAVE_PICK`) |
| **Packing Station** | None | Manifest query & carton packing with carton IDs |
| **Modal Connectivity** | Static sample items | Live API binding with real warehouse stock |

---

## 6. Architecture Impact
- **Ledger Invariance**: All picked items moving from pick bins to staging bays write negative and positive `StockMovement` rows, preserving zero-sum balance and audit traceability.
- **Serpentine Path Calculation**: Odd aisles sort ascending, even aisles sort descending, generating optimal floor pick paths.
- **Tenant Isolation**: All waves and tasks are strictly scoped to `company_id` and `warehouse_id`.

---

## 7. Proposed Design
```text
Open Sales Orders / Demands
          ↓
[InventoryWmsService.create_pick_wave]
  - Stock Location Lookup (StockMovement / ItemWarehouseLocation)
  - Serpentine Sort: Zone × 100,000 + Aisle × 1,000 + Bay × 10 + Level
  - Picker Workload Balancing
          ↓
[Wave Pick Manifest]
  - Task 1: Loc BIN-A01-R01 (RFID: RFID-A01-01) - 10 pcs
  - Task 2: Loc BIN-A01-R03 (RFID: RFID-A01-03) - 15 pcs
          ↓
[Warehouse Floor RF Gun / RFID Verification]
  - Scan Barcode / RFID Tag → POST /waves/{id}/pick
          ↓
[Complete Wave & Dispatch to Staging]
  - Dual StockMovements:
      TRANSFER_OUT: Bin → -Qty (WMS_WAVE_PICK)
      TRANSFER_IN : Staging Bay 04 → +Qty (WMS_WAVE_PICK)
          ↓
[Packing Station Verification & Carton Sealing]
  - GET /packing-station?bay=BAY-04
  - POST /packing-station/pack → Carton Label Generated
```

---

## 8. Files Created
1. `backend/tests/test_wms_wave_picking.py`: Dedicated unit & integration test suite.
2. `docs/implementation/wms/WMS_Phase5_Wave_Picking_And_Packing_Station_Plan_v3.130.0.md`: This implementation plan.
3. `docs/walkthrough/wms/WMS_Phase5_Wave_Picking_And_Packing_Station_v3.130.0.md`: Comprehensive walkthrough document.

---

## 9. Files Modified
1. `backend/app/schemas/wms.py`: Added wave picking and packing schemas.
2. `backend/app/services/inventory_wms.py`: Implemented wave planning, execution, and packing methods.
3. `backend/app/api/v1/wms.py`: Added 7 REST endpoints for wave picking and packing.
4. `src/components/inventory/WarehouseWavePickingModal.tsx`: Updated to fetch real wave data, execute real scans, and post completion.
5. `src/components/wms/WmsStudioTab.tsx`: Integrated wave creation and management actions.
6. `docs/implementation/README.md` & `docs/walkthrough/README.md`: Master index updates.
7. `CHANGELOG.md` & `RELEASE_NOTES.md`: Release documentation.

---

## 10. Dependencies
- `StockMovement` table in tenant database (`smritiXXX`).
- `WarehouseLocation` table and `ItemWarehouseLocation` slotting configs.
- FastAPI dependency injection (`get_company_db`, `get_tenant_context`).

---

## 11. Risks
- *Risk 1: Demands with zero on-hand stock*: Handled by calculating unallocatable items as shortages during wave generation.
- *Risk 2: Multi-picker concurrent picks on same bin*: Handled by reserving stock and validating live bin availability.

---

## 12. Rollback Strategy
All changes are additive and backward-compatible. If necessary, wave picking endpoints can be bypassed without impacting basic inventory or POS workflows.

---

## 13. Verification Plan
- Run automated unit test suite `backend/tests/test_wms_wave_picking.py`.
- Run full regression across all WMS test suites.
- Verify TypeScript compilation using `npx tsc --noEmit`.

---

## 14. Test Plan
- `test_wave_create_serpentine_ordering`: Verifies serpentine key calculation and sorting.
- `test_wave_picker_assignment`: Verifies round-robin task assignment.
- `test_wave_record_pick_scan`: Verifies RFID and barcode scan verification.
- `test_wave_shortage_handling`: Verifies short quantity recording.
- `test_wave_complete_creates_dual_stock_movements`: Verifies atomic dual movement ledger entries.
- `test_packing_station_manifest_and_pack`: Verifies staging bay query and carton sealing.
- `test_wave_api_router_endpoints`: Verifies all FastAPI endpoints.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md` and `RELEASE_NOTES.md`.

---

## 16. Deployment Plan
- Code lives in working tree without git commit per policy.
- Verified in local testing environment (`F:\SMRITRretailNX`).

---

## 17. Status
Approved — Ready for Execution.

---

## 18. Related ADRs
- `ADR-0045`: Unified StockMovement Ledger System of Record.
- `ADR-0049`: Wave Picking Optimization & Serpentine Routing Protocol.

---

## 19. Related Walkthroughs
- `docs/walkthrough/wms/WMS_Phase5_Wave_Picking_And_Packing_Station_v3.130.0.md`
