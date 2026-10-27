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

# Implementation Plan: WMS Phase 2 — Physical Storage Bin Matrix, Aisle/Rack/Shelf Generation & Automated Putaway Rule Engine

**Document ID:** IPGP-WMS-v3.127.0  
**Status:** Completed  
**Version:** 3.127.0  
**Effective Date:** 2026-10-28  

---

## 1. Objective
Standardize warehouse spatial operations across SMRITI Retail OS by hardening physical bin matrix generation against schema drift, implementing an automated 4-tier Putaway Rule Engine, and exposing deterministic putaway recommendations (`POST /api/v1/wms/warehouses/{id}/putaway-recommendation`) for inwarding workflows (Purchase GRN, Stock Transfers, Cycle Count Rebalances).

## 2. Business Motivation
In high-velocity omnichannel and multi-godown retail deployments, inwarded goods must be allocated to storage locations swiftly and systematically. Manual bin assignment leads to misplacements, mixing damaged goods with pristine stock, and uneven warehouse density. The automated Putaway Rule Engine guarantees that damaged goods are quarantined immediately, dedicated items go to assigned fast-picking bins, same products are co-located for efficient picking, and new items fill nearest empty bins in sequential spatial order (Aisle -> Rack -> Shelf -> Bin).

## 3. Scope
- **Backend Schema & API:**
  - Introduce `_get_warehouse_resilient` in `backend/app/api/v1/wms.py` to protect `create_warehouse_location` and `generate_warehouse_locations_matrix` against unmigrated tenant schema drift (`is_default_for_branch`).
  - Introduce Putaway Pydantic schemas: `PutawayRecommendationRequest`, `PutawayCandidateLocation`, `PutawayRecommendationResponse` in `backend/app/schemas/wms.py`.
  - Expose `POST /api/v1/wms/warehouses/{warehouse_id}/putaway-recommendation` with role-based access control.
- **Service Layer Engine:**
  - Implement `recommend_putaway` inside `InventoryWmsService` (`backend/app/services/inventory_wms.py`).
  - Compute real-time location occupancy from `StockMovement` transactions.
  - Execute 4-tier decision hierarchy:
    1. `QUARANTINE_ISOLATION` (Damaged / Quarantined items)
    2. `DEDICATED_ITEM_BIN` (`ItemWarehouseLocation` bin affinity)
    3. `CO_LOCATED_STOCK` (Existing stock of product/batch in same bin)
    4. `EMPTY_BIN_ALLOCATION` & `ZONE_CAPACITY_FALLBACK` (Sequential spatial traversal)
- **Automated Test Suite:**
  - Dedicated test suite `backend/tests/test_wms_putaway_and_location_matrix.py` covering all priority tiers, capacity overflows, empty warehouses, and schema-drift resilience.

## 4. Current State
- `warehouses` table across unmigrated tenants lacks `is_default_for_branch`, triggering `UndefinedColumnError` on raw ORM queries during location creation or matrix generation.
- Location matrix generation existed in `backend/app/api/v1/wms.py`, but putaway decisions were unautomated, forcing manual string entries in inwarding forms.

## 5. Gap Analysis
| Functional Area | Previous State | Target State (v3.127.0) |
|---|---|---|
| Location Creation Resiliency | Raw `select(Warehouse)` failed on unmigrated tenants | `_get_warehouse_resilient` with rollback + `defer(Warehouse.is_default_for_branch)` |
| Putaway Logic | Manual bin assignment | 4-tier automated heuristic engine with capacity checks |
| Damaged Stock Handling | Relied on user memory to avoid mixing with sound stock | Automatic routing to `QUARANTINE` zone |
| Spatial Hierarchy Traversal | Random or uncoordinated | Deterministic sorting: `aisle ASC, rack ASC, shelf ASC, bin_code ASC` |
| Over-capacity Handling | Undetected | Explicit `OVER_CAPACITY` status with ranked alternative candidates |

## 6. Architecture Impact
- Enforces strict Domain-Driven Design in `InventoryWmsService`.
- Reuses existing `WarehouseLocation` (`warehouse_locations`) and `ItemWarehouseLocation` (`item_warehouse_locations`) data models without requiring intrusive schema migrations.
- Respects multi-tenant isolation via `company_id` filters on all spatial queries and ledger aggregations.

## 7. Proposed Design
1. **Resilient Warehouse Retrieval:**
   `_get_warehouse_resilient(db, warehouse_id, company_id)` encapsulates ORM execution within a rollback-safe exception handler, falling back to column deferment on schema drift.
2. **Putaway Engine Workflow:**
   ```text
   Inward Request (Item, Qty, is_damaged, preferred_zone)
        │
        ├── is_damaged == True ? ──► Priority 1: QUARANTINE zone bin
        │
        ├── Item has dedicated bin ? ──► Priority 2: DEDICATED_ITEM_BIN
        │
        ├── Product has existing stock ? ──► Priority 3: CO_LOCATED_STOCK bin
        │
        └── Default Fallback ──► Priority 4: Nearest EMPTY_BIN in STORAGE/PICKING zone
   ```

## 8. Files Created
- `backend/tests/test_wms_putaway_and_location_matrix.py`
- `docs/implementation/wms/WMS_Phase2_Physical_Bin_Matrix_And_Putaway_Rules_Plan_v3.127.0.md`
- `docs/walkthrough/wms/WMS_Phase2_Physical_Bin_Matrix_And_Putaway_Rules_v3.127.0.md`

## 9. Files Modified
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

## 10. Dependencies
- FastAPI 0.110+
- SQLAlchemy 2.0+ (asyncpg)
- Pydantic v2
- Pytest 8.2+

## 11. Risks
- **Over-capacity edge cases:** Handled via `OVER_CAPACITY` status code and alternative candidate rankings.
- **Unmigrated schema drift:** Mitigated by `_get_warehouse_resilient` with transaction rollback.

## 12. Rollback Strategy
All changes are purely additive. Reverting requires only removing the router endpoint and service method; no destructive database alterations or column drops are executed.

## 13. Verification Plan
1. Python syntax compilation via `py_compile`.
2. Pytest test suite covering all 4 rules, edge cases, and schema drift.
3. Full regression verification across existing WMS suites.
4. TypeScript compilation via `npx tsc --noEmit`.

## 14. Test Plan
- Unit tests: `backend/tests/test_wms_putaway_and_location_matrix.py` (8/8 passed).
- Integration tests: `backend/app/tests/test_warehouse_location_management.py` (4/4 passed).
- Regression tests: `backend/tests/test_warehouse_code_governance.py`, `backend/tests/test_inventory_warehouse_resolver.py`, `backend/tests/test_wms_integrity_deferred.py` (17/17 passed).

## 15. Documentation Impact
- Updated Implementation Plan Index (`docs/implementation/README.md`).
- Updated Walkthrough Index (`docs/walkthrough/README.md`).
- Updated `CHANGELOG.md` and `RELEASE_NOTES.md`.

## 16. Deployment Plan
Code change only. No migration scripts required. Zero downtime deployment.

## 17. Status
**Completed** (Verified with 29/29 automated tests green and 0 TypeScript errors).

## 18. Related ADRs
- `ADR-0021`: Warehouse Physical Location and Bin Structure
- `ADR-0045`: Multi-tier Inventory Resolution Architecture

## 19. Related Walkthroughs
- `docs/walkthrough/wms/WMS_Phase2_Physical_Bin_Matrix_And_Putaway_Rules_v3.127.0.md`
- `docs/walkthrough/wms/WMS_Warehouse_Governance_And_Location_Resolution_v3.126.0.md`
