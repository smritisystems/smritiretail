<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.132.0
  Created      : 2026-10-28
  Modified     : 2026-10-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: WMS Phase 7 — Outbound Shipping Dock Management, Dispatch Manifest & Carrier Vehicle Loading

## 1. Objective
Deliver an enterprise-grade outbound logistics, shipping dock management, carrier dispatch manifest, and vehicle loading verification engine for SMRITI Retail OS. Transition sealed shipping cartons from packing stations (Phase 5) into dedicated Outbound Dock Doors (`DOCK-01`, `DOCK-02`, etc.), assemble multi-carton Dispatch Manifests, track carrier logistics details (transporter, vehicle number, driver contact, LR/docket number, E-Way Bill), enforce optical barcode/RFID gate scan verification prior to vehicle departure, and commit atomic bin-attributed `StockMovement` ledger adjustments (`movement_type="DISPATCH_OUT"`).

## 2. Business Motivation
Omnichannel retail warehouses suffer high dispute rates when goods are loaded onto the wrong delivery vehicle or cartons are left behind at the loading bay. Traditional shipping relies on paper delivery challans that fail to prevent misloads in high-velocity dock environments. WMS Phase 7 provides:
1. **Physical Dock Visibility**: Real-time tracking of dock doors, staged cartons, and arriving carrier vehicles.
2. **Fail-Closed Gate Loading Verification**: Associates must optically scan every carton onto the assigned truck; extraneous or wrong-route cartons trigger loud optical and acoustic mismatch rejections.
3. **Statutory & Carrier Custody Transfer**: Linking vehicle numbers, driver IDs, LR/Docket numbers, and gross weights into an immutable Gate Pass with cryptographic verification.
4. **Ledger Integrity**: Automatically decrements dock/staging inventory via `StockMovement` upon authorized gate departure.

## 3. Scope
1. **Dock Door Management**: Query active dock doors (`zone="DOCK"` or `zone="STAGING"`), assigned vehicle capacity, and currently staged carton counts.
2. **Dispatch Manifest Assembly**: Group sealed cartons (from Phase 5 wave packing) into a structured manifest with destination, transporter, vehicle number, driver name, phone, and LR/docket note.
3. **Carton Staging at Dock**: Move packed cartons from packing station bays to designated dock doors (`assign_cartons_to_dock`).
4. **Optical Gate Scan Verification**: High-speed carton barcode scanning at the truck tail with real-time progress tracking (e.g., 12/12 cartons verified) and immediate mismatch alerting.
5. **Supervisor Gate Override**: Allows authorized supervisors to release partial vehicle loads with mandatory audit notes.
6. **Atomic Dispatch Execution**: Commits `StockMovement` records (`movement_type="DISPATCH_OUT"`, `bin=dock_door`, `reference_doc_type="WMS_DISPATCH"`) and stamps departure timestamp.
7. **Frontend Studio View**: Interactive Outbound Shipping & Dock Manager sub-view in `WmsStudioTab.tsx`.

## 4. Current State
- Phase 5 (`WMS Phase 5`) provides carton packing (`pack_wave_carton`) and seals cartons with gross weight and barcode (`BOX-...`).
- However, cartons currently remain at the packing station without a formal dock door assignment, carrier dispatch manifest, or vehicle loading verification.
- Dispatch relies on manual delivery challan creation without physical gate scan checks.

## 5. Gap Analysis
| Capability | Current State | WMS Phase 7 Target Architecture |
|---|---|---|
| Dock Door Tracking | Broad warehouse only | Dedicated physical Dock Doors (`DOCK-01` to `DOCK-08`) |
| Carrier Manifest | Manual paperwork | System-generated `DispatchManifest` with transporter, vehicle, and LR |
| Loading Verification | Visual check by guard | Optical barcode gate scan enforcing 100% carton match |
| Misload Prevention | Prone to human error | Instant scan rejection for unauthorized or wrong-consignment cartons |
| Ledger Symmetry | Inventory remains in staging | Atomic `DISPATCH_OUT` movements posted upon gate departure |

## 6. Architecture Impact
- **Schemas (`backend/app/schemas/wms.py`)**: Add `DockDoorResponse`, `DispatchManifestCreate`, `DispatchManifestResponse`, `DispatchManifestListResponse`, `CartonDockStageRequest`, `CartonDockStageResponse`, `GateScanItemRequest`, `GateScanItemResponse`, `ManifestDispatchConfirmRequest`, `ManifestDispatchConfirmResponse`.
- **Domain Service (`backend/app/services/inventory_wms.py`)**: Implement `get_dock_doors`, `create_dispatch_manifest`, `get_dispatch_manifests`, `get_manifest_details`, `stage_cartons_at_dock`, `scan_carton_at_gate`, and `confirm_manifest_dispatch`.
- **API Router (`backend/app/api/v1/wms.py`)**: Expose 7 REST endpoints under `/warehouses/{id}/docks` and `/warehouses/{id}/dispatch-manifests`.
- **Frontend (`src/components/wms/WmsStudioTab.tsx`)**: Mount Outbound Shipping & Dock Management controls with live truck loading scan interface.

## 7. Proposed Design
```text
Packed Cartons (Phase 5: BOX-...)
         ↓
Stage Cartons to Dock Door (e.g. DOCK-02)
         ↓
Create Dispatch Manifest (Transporter, Vehicle, Driver, LR)
         ↓
Truck Arrives at Dock Door -> Status: LOADING
         ↓
Gate Scan Verification (Scan each carton onto truck)
  ├─ If Matched: Progress +1 (e.g. 5/10)
  ├─ If Wrong Carton: BEEP! Unauthorized Carton Rejected
  └─ If Duplicate: Warning! Already Scanned
         ↓
100% Cartons Scanned -> Ready for Gate Departure
         ↓
Supervisor / Dispatch Confirm:
  - Generates StockMovement: DISPATCH_OUT (attributing dock bin)
  - Seals Manifest -> Status: DISPATCHED
  - Emits Gate Pass with QR verification
```

## 8. Files Created
1. `docs/implementation/wms/WMS_Phase7_Outbound_Shipping_Dock_And_Dispatch_Plan_v3.132.0.md`
2. `docs/walkthrough/wms/WMS_Phase7_Outbound_Shipping_Dock_And_Dispatch_v3.132.0.md`
3. `backend/tests/test_wms_dispatch_and_dock.py`

## 9. Files Modified
1. `backend/app/schemas/wms.py`
2. `backend/app/services/inventory_wms.py`
3. `backend/app/api/v1/wms.py`
4. `src/components/wms/WmsStudioTab.tsx`
5. `docs/implementation/README.md`
6. `docs/walkthrough/README.md`
7. `CHANGELOG.md`
8. `RELEASE_NOTES.md`

## 10. Dependencies
- FastAPI `Depends(get_company_db)`, `TenantContext`
- SQLAlchemy `select`, `AsyncSession`, `StockMovement`, `WarehouseLocation`
- Pydantic v2 `BaseModel`, `ConfigDict`

## 11. Risks
- *Risk*: Driver leaves before all cartons are scanned due to floor urgency.
  *Mitigation*: Provide supervisor gate override with mandatory audit notes, recording partial load status.
- *Risk*: Network drop at the outdoor loading dock.
  *Mitigation*: Client-side scan accumulation in `WmsStudioTab.tsx` with resilient background submission.

## 12. Rollback Strategy
Additive non-destructive changes. Existing wave picking and cycle counting continue uninterrupted. If dispatch endpoints fail, manual delivery challan creation remains accessible.

## 13. Verification Plan
- Unit tests for dock door listing and status calculation.
- Test for manifest creation with transporter and vehicle metadata.
- Test for carton staging at dock door.
- Test for optical gate scan rejecting unauthorized cartons.
- Test for gate departure blocking when incomplete.
- Test for atomic `StockMovement` creation with `movement_type="DISPATCH_OUT"`.

## 14. Test Plan
Execute `backend/tests/test_wms_dispatch_and_dock.py` (target 100% pass) and run full regression suite across all 10 WMS test suites. Validate frontend with `npx tsc --noEmit`.

## 15. Documentation Impact
Update implementation index, walkthrough index, `CHANGELOG.md`, and `RELEASE_NOTES.md`.

## 16. Deployment Plan
Pure backend logic and frontend UI updates. No database migrations required due to resilient memory-backed manifest store keyed by company ID.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-0042`: WMS Spatial Hierarchy & Multi-Tier Location Matrix Architecture
- `ADR-0058`: Strangler-Fig FastAPI Sovereign Backend & Dual-Leg Ledger Symmetry

## 19. Related Walkthroughs
- `docs/walkthrough/wms/WMS_Phase5_Wave_Picking_And_Packing_Station_v3.130.0.md`
- `docs/walkthrough/wms/WMS_Phase6_Cycle_Counting_Blind_Audits_And_Reconciliation_v3.131.0.md`
