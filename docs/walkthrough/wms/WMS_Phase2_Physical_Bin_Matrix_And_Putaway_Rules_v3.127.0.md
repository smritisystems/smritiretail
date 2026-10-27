<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.127.0
  Created      : 2026-10-28
  Modified     : 2026-10-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: WMS Phase 2 — Physical Storage Bin Matrix, Aisle/Rack/Shelf Generation & Putaway Rules

**Document ID:** WGP-WMS-v3.127.0  
**Version:** 3.127.0  
**Effective Date:** 2026-10-28  

---

## 1. Purpose
This walkthrough documents the design, hardening, and verification of **WMS Phase 2: Physical Storage Bin Matrix, Aisle/Rack/Shelf Generation & Automated Putaway Rule Engine** for SMRITI Retail OS. It validates schema-drift resilience across location creation endpoints and demonstrates the 4-tier putaway recommendation engine.

## 2. Scope
- Hardening of `create_warehouse_location` and `generate_warehouse_locations_matrix` against missing schema columns (`is_default_for_branch`).
- Introduction of Pydantic putaway schemas (`PutawayRecommendationRequest`, `PutawayCandidateLocation`, `PutawayRecommendationResponse`).
- Automated Putaway Rule Engine (`InventoryWmsService.recommend_putaway`).
- Router endpoint `POST /api/v1/wms/warehouses/{warehouse_id}/putaway-recommendation`.
- Dedicated automated test suite in `backend/tests/test_wms_putaway_and_location_matrix.py`.

## 3. Files Created
- `backend/tests/test_wms_putaway_and_location_matrix.py`
- `docs/implementation/wms/WMS_Phase2_Physical_Bin_Matrix_And_Putaway_Rules_Plan_v3.127.0.md`
- `docs/walkthrough/wms/WMS_Phase2_Physical_Bin_Matrix_And_Putaway_Rules_v3.127.0.md`

## 4. Files Modified
- `backend/app/api/v1/wms.py`
- `backend/app/schemas/wms.py`
- `backend/app/services/inventory_wms.py`
- `src/components/wms/WarehouseLocationManager.tsx`
- `src/components/wms/WmsStudioTab.tsx`
- `src/components/purchase/GrnReceiptTab.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`
- `RELEASE_NOTES.md`

## 5. Architecture Decisions
1. **Centralized Resilient Lookup Helper (`_get_warehouse_resilient`):**
   Encapsulates the two-phase query strategy (standard ORM query with fallback to deferred column loading upon SQL exceptions). This isolates unmigrated database quirks from business endpoints.
2. **Deterministic Putaway Priority Hierarchy:**
   Enforces a strict 4-tier decision cascade:
   - **Priority 1: Quarantine Isolation** — Damaged goods cannot enter general circulation.
   - **Priority 2: Dedicated Item Bin** — Fast-picking bins pre-configured per item take precedence for standard stock.
   - **Priority 3: Co-located Stock** — Consolidates stock of identical products/batches to optimize storage footprint.
   - **Priority 4: Nearest Empty Bin Allocation** — Traverses the physical grid sequentially (`aisle -> rack -> shelf -> bin`) to assign clean, empty bins.
3. **Live Occupancy Computation:**
   Aggregates net physical movements from `StockMovement` (by `bin` and `location_id`) to compute accurate real-time headroom without locking the entire table.

## 6. Design Rationale
- Prevents warehouse fragmentation and reduces picker travel time by grouping identical items or neatly filling contiguous empty bins.
- Prevents inadvertent mixing of defective goods by guaranteeing damaged items are routed exclusively to `QUARANTINE` zone bins.
- Avoids intrusive schema migrations while maintaining 100% backward compatibility with tenant databases at Alembic migration `v1556`.

## 7. Implementation Summary
1. **API Layer (`backend/app/api/v1/wms.py`):**
   - Added `_get_warehouse_resilient` helper function.
   - Fixed broken relative import (`from ..models.inventory import StockMovement` -> imported at module level).
   - Wired `_get_warehouse_resilient` into `create_warehouse_location` and `generate_warehouse_locations_matrix`.
   - Added `@router.post("/warehouses/{warehouse_id}/putaway-recommendation", response_model=PutawayRecommendationResponse)`.
2. **Schema Layer (`backend/app/schemas/wms.py`):**
   - Added `PutawayRecommendationRequest` with validation for item identifiers, quantity, and damaged flag.
   - Added `PutawayCandidateLocation` detailing spatial attributes, occupancy, capacity, and the specific rule applied.
   - Added `PutawayRecommendationResponse` containing primary recommendation, ranked alternatives, and status codes.
3. **Service Layer (`backend/app/services/inventory_wms.py`):**
   - Implemented `recommend_putaway` inside `InventoryWmsService`.
   - Incorporated live occupancy calculation per bin code.
   - Structured the 4-tier heuristic rules with explicit fallback handling for over-capacity and unconfigured warehouses.

## 8. Tests Executed
1. `backend/tests/test_wms_putaway_and_location_matrix.py`:
   - `test_resilient_warehouse_lookup_handles_schema_drift`: PASSED
   - `test_putaway_priority_1_quarantine_isolation`: PASSED
   - `test_putaway_priority_2_dedicated_item_bin`: PASSED
   - `test_putaway_priority_3_colocated_stock`: PASSED
   - `test_putaway_priority_4_empty_bin_allocation`: PASSED
   - `test_putaway_handles_over_capacity`: PASSED
   - `test_putaway_handles_no_locations_configured`: PASSED
   - `test_api_endpoint_get_putaway_recommendation`: PASSED
2. `backend/app/tests/test_warehouse_location_management.py`: 4/4 PASSED.
3. Comprehensive WMS regression suite (29/29 PASSED in 202.18s).
4. `npx tsc --noEmit --project tsconfig.json`: PASSED (0 errors).

## 9. Verification Results
```text
================= 29 passed, 29 warnings in 202.18s (0:03:22) =================
TypeScript Compiler: 0 errors (exited 0)
Python Syntax (py_compile): 0 errors (exited 0)
```

## 10. Known Limitations
- Warehouse volumetric calculations currently utilize integer/decimal unit counts rather than 3D cubic volume (width x height x depth).
- Putaway recommendations are advisory; operator overrides in the UI remain permissible if physical constraints dictate.

## 11. Future Work
- Dynamic bin replenishment triggers when picking bin stock drops below `min_reorder_level`.
- Barcode scanning validation during putaway confirmation via handheld terminal.
- Advanced velocity profiling (ABC turnover classification) for dynamic fast-picking slotting.

## 12. Related ADRs
- `ADR-0021`: Warehouse Physical Location and Bin Structure
- `ADR-0045`: Multi-tier Inventory Resolution Architecture

## 13. Related RFCs
- `RFC-WMS-002`: Automated Putaway & Wave Picking Standardization
