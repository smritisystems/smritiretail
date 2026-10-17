<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.72.9
  Created      : 2026-10-13
  Modified     : 2026-10-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Warehouse Location Management Standardization Implementation Plan (v6.72.9)

## 1. Objective
Establish a standardized, intuitive, and zero-confusion Location Management capability within SMRITI Retail OS. Non-technical operators (store managers, retail shop clerks, pickers, and inwarding personnel) can effortlessly define, browse, print labels for, and audit physical storage locations (zones, aisles, racks, shelves, and bins) across all company godowns and branch premises.

## 2. Business Motivation
Physical stock tracking in retail fails when staff cannot locate items or find it too tedious to configure storage bins. Prior to this enhancement:
1. Users had **no graphical interface** to view, add, or configure warehouse locations.
2. Inward GRN receipting and POS picking displayed raw IDs or unstructured text rather than step-by-step spatial directions.
3. Defining dozens or hundreds of storage bins required direct database access or manual spreadsheets.
By introducing GS1-aligned hierarchical spatial addressing (`[ZONE]-[AISLE]-[RACK]-[SHELF]-[BIN]`), a 1-click Matrix Generator, and visual occupancy cards, any shop floor clerk can operate the system without technical assistance.

## 3. Scope
- **Backend Schema Enhancement:** Extend `warehouse_locations` table with `zone`, `barcode`, `max_capacity_units`, and `is_locked` fields via reversible Alembic migration `v1529`.
- **Backend WMS API Expansion:** Implement full CRUD (`PUT /wms/locations/{id}`, `DELETE /wms/locations/{id}`), bulk matrix generation (`POST /wms/warehouses/{id}/locations/generate`), and bin inventory lookup (`GET /wms/locations/{id}/stock`).
- **Frontend Studio UI:** Add a dedicated **"Locations & Bins"** tab to `WmsStudioTab.tsx` featuring warehouse filtering, zone color-coding, card/grid explorer, 1-click Matrix Generator modal, and direct label printing.
- **Label Studio Alignment:** Fix property mismatches in `LabelPrintModal.tsx` (`code` vs `location_code`, `bin_code` vs `bin`) and support instant scannable barcode label generation.
- **Verification & Governance:** 100% test coverage with automated unit/integration suites and zero TypeScript compilation errors.

## 4. Current State
- `warehouses` table exists representing physical buildings/godowns.
- `warehouse_locations` exists in `models/inventory.py` and Alembic `v1433`, but only has basic fields (`aisle`, `rack`, `shelf`, `bin_code`).
- `wms.py` only exposes `GET /locations`, `GET /warehouses/{id}/locations`, and `POST /warehouses/{id}/locations`.
- Zero user interface exists in the frontend for managing these records.
- `LabelPrintModal.tsx` relies on outdated field keys (`location_code`, `zone`) which throw runtime errors or show blank lists against the live backend.

## 5. Gap Analysis
| Component | Existing State | Required Standard State |
| :--- | :--- | :--- |
| **Zone Classification** | Missing | `STORAGE`, `PICKING`, `BULK`, `RECEIVING`, `QUARANTINE` |
| **Location Barcode** | Loose string or absent | Canonical scannable code: `LOC-[WH]-[CODE]` |
| **Location Editing/Deletion** | None | Governed `PUT` and soft-delete `DELETE` with in-use safeguards |
| **Bulk Provisioning** | Manual entry only | 1-Click Matrix Generator (Aisle × Rack × Shelf × Bin) |
| **Operator UI** | Missing completely | Intuitive Visual Studio with Breadcrumbs & Occupancy |
| **Label Printing** | Broken field bindings | Fully bound to canonical `/wms/locations` schema |

## 6. Architecture Impact
- **Database:** Non-breaking additive columns to `warehouse_locations` table (`zone`, `barcode`, `max_capacity_units`, `is_locked`).
- **API Boundary:** New endpoints added under `/api/v1/wms/` protected by tenant context and permission guards (`inventory_workspace`).
- **UI Architecture:** New `WarehouseLocationManager` component embedded cleanly within `WmsStudioTab.tsx` using standard SMRITI design tokens.

## 7. Proposed Design
1. **Hierarchical Spatial Addressing:**
   Canonical Code Formula:
   $$\mathbf{[ZONE]-[AISLE]-[RACK]-[SHELF]-[BIN]}$$
   Human-Readable Plain-Language Label:
   *`"Main Storage ➔ Aisle 01 ➔ Rack 02 ➔ Shelf 03 ➔ Bin 01"`*
2. **1-Click Matrix Generator Wizard:**
   Allows the user to specify start/end ranges for Aisles, Racks, Shelves, and Bins with immediate count preview before batch database insertion.
3. **Color-Coded Functional Zones:**
   - 🟢 Fast Picking / Counter (`PICKING`)
   - 🔵 Standard Storage (`STORAGE`)
   - 🟡 Reserve / Bulk Overstock (`BULK`)
   - 🟣 Inward Receiving Dock (`RECEIVING`)
   - 🔴 Damaged / Return Quarantine (`QUARANTINE`)

## 8. Files Created
1. `backend/alembic/versions/v1529_warehouse_location_zone_and_matrix_enhancements.py`
2. `backend/app/tests/test_warehouse_location_management.py`
3. `src/components/wms/WarehouseLocationManager.tsx`
4. `docs/implementation/inventory/Warehouse_Location_Management_Standardization_Plan_v6.72.9.md`
5. `docs/walkthrough/inventory/Warehouse_Location_Management_Standardization_v6.72.9.md`

## 9. Files Modified
1. `backend/app/models/inventory.py`: Added `zone`, `barcode`, `max_capacity_units`, `is_locked` to `WarehouseLocation`.
2. `backend/app/schemas/wms.py`: Added matrix generator request/response schemas and update schema.
3. `backend/app/api/v1/wms.py`: Added PUT, DELETE, matrix generation, and live stock endpoints.
4. `backend/app/db/bootstrap_engine.py`: Added safe column backfills for `warehouse_locations`.
5. `src/components/wms/WmsStudioTab.tsx`: Added `"locations"` sub-tab and wired `WarehouseLocationManager`.
6. `src/components/warehouse/LabelPrintModal.tsx`: Fixed property bindings and search filtering.
7. `docs/implementation/README.md`: Appended plan entry.
8. `docs/walkthrough/README.md`: Appended walkthrough entry.
9. `CHANGELOG.md`: Documented v6.72.9 release notes.

## 10. Dependencies
- FastAPI, SQLAlchemy async engine, Alembic.
- React 18, Lucide React icons, Tailwind CSS / SMRITI token theme.

## 11. Risks
- **Duplicate Location Codes:** Handled via scoped `(warehouse_id, code)` unique constraint.
- **Accidental Deletion of Bins with Stock:** Soft-delete guard checks active stock allocations and warns or blocks deletion.

## 12. Rollback Strategy
- Database: Alembic downgrade to `v1528_canonical_role_permissions_remediation`.
- Code: Git revert of WMS studio tab and location manager files.

## 13. Verification Plan
- Run automated backend test suite `backend/app/tests/test_warehouse_location_management.py`.
- Run frontend type check `npx tsc --noEmit`.
- Verify label printing dialog with mock and real location data.

## 14. Test Plan
- Test single location creation and validation.
- Test matrix bulk generator (ranges, counts, duplicate handling).
- Test location update and soft delete.
- Test warehouse scoped listing and filtering.

## 15. Documentation Impact
- User Manual updated with visual godown setup guide.
- Walkthrough document created under `docs/walkthrough/inventory/`.

## 16. Deployment Plan
- Run Alembic migration `v1529`.
- Deploy backend and frontend builds.

## 17. Status
Approved — In Progress

## 18. Related ADRs
- ADR-0042: Multi-Tenant Inventory and Warehouse Architecture.
- ADR-0089: GS1-Aligned Barcoding and Physical Location Encoding.

## 19. Related Walkthroughs
- `docs/walkthrough/inventory/Warehouse_Location_Management_Standardization_v6.72.9.md`
