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

# Walkthrough — WMS Phase 7: Outbound Shipping Dock Management, Dispatch Manifest & Carrier Vehicle Loading

**Version:** 3.132.0  
**Area:** Warehouse Management System (WMS) — Outbound Logistics & Carrier Dispatch  
**Status:** Completed  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## 1. Purpose
This document provides a comprehensive engineering walkthrough for **WMS Phase 7: Outbound Shipping Dock Management, Dispatch Manifest & Carrier Vehicle Loading** (v3.132.0). Phase 7 closes the loop on warehouse fulfillment operations by connecting packed shipping cartons from Phase 5 packing stations directly to physical outbound dock doors, assembling carrier vehicle dispatch manifests with statutory E-Way Bill details, enforcing real-time optical barcode gate verification at the truck tail, preventing departure until 100% loading verification or authorized supervisor sign-off, and posting atomic outbound ledger entries to `stock_movements` with official Gate Pass issuance.

---

## 2. Scope
The scope of Phase 7 encompasses:
- **Physical Outbound Dock Door / Bay Management**: Multi-door status monitoring (`DOCK-01` to `DOCK-04` by default or discovered `DOCK`/`STAGING` zones in `WarehouseLocation`), bay occupancy tracking, assigned vehicle display, and live staged carton counts.
- **Carton Dock Staging Pipeline**: Directing packed cartons from Phase 5 packing stations (`_PACKED_CARTONS`) to designated dock bay doors (`assign_cartons_to_dock`).
- **Carrier Dispatch Manifest Assembly**: Creation of multi-carton manifests capturing Transporter Name, Carrier Vehicle Number, Driver Contact, Destination Hub/Branch, LR/Docket Note, and statutory E-Way Bill Number.
- **Optical Barcode Truck Tail Loading Gate Verification**: Real-time laser scanning of carton barcodes at the truck tail, live progress percentage computation, and immediate rejection of unauthorized cartons (HTTP 400).
- **Departure Gate & Supervisor Override**: Hard stop blocking vehicle departure when cartons remain unscanned (`UNSCANNED_CARTONS_REMAINING`), accompanied by a supervisor override mechanism with mandatory justification notes to protect carrier SLAs.
- **Atomic Outbound Ledger Commit & Gate Pass Issuance**: Automatic posting of `StockMovement` entries (`movement_type="DISPATCH_OUT"`, `bin=dock_code`, `quantity=-count`, `reference_doc_type="WMS_DISPATCH"`) and issuance of official formatted Gate Passes (`GP-YYYYMMDD-XXXX`).
- **High-Density Frontend Workspace**: Interactive 8th subtab "Dock & Dispatch" in `WmsStudioTab.tsx` with dock door status cards, 2-column manifest manager, live truck loading station, carton itemized manifest table, and manifest creation wizard.

---

## 3. Files Created
1. `backend/tests/test_wms_dispatch_and_dock.py`:
   - Dedicated unit and integration test suite with 10 test functions covering dock door listing, carton dock staging, manifest generation, truck gate scanning, unauthorized carton rejection, gate verification state transitions, unscanned departure blocking, atomic outbound ledger commit, supervisor partial load override, and all 7 FastAPI endpoints.
2. `docs/implementation/wms/WMS_Phase7_Outbound_Shipping_Dock_And_Dispatch_Plan_v3.132.0.md`:
   - Formal 19-section IPGP implementation plan.
3. `docs/walkthrough/wms/WMS_Phase7_Outbound_Shipping_Dock_And_Dispatch_v3.132.0.md`:
   - This 13-section WGP walkthrough document.

---

## 4. Files Modified
1. `backend/app/schemas/wms.py`:
   - Added 10 Phase 7 Pydantic schemas: `DockDoorResponse`, `CartonDockStageRequest`, `CartonDockStageResponse`, `ManifestCartonItem`, `DispatchManifestCreate`, `DispatchManifestResponse`, `DispatchManifestListResponse`, `GateScanItemRequest`, `GateScanItemResponse`, `ManifestDispatchConfirmRequest`, and `ManifestDispatchConfirmResponse`.
2. `backend/app/services/inventory_wms.py`:
   - Added `import random` to module imports.
   - Initialized tenant-isolated stores `_DISPATCH_MANIFESTS` and `_DOCK_STAGED_CARTONS`.
   - Implemented 7 domain methods: `get_dock_doors`, `stage_cartons_at_dock`, `create_dispatch_manifest`, `get_dispatch_manifests`, `get_manifest_details`, `scan_carton_at_gate`, and `confirm_manifest_dispatch`.
3. `backend/app/api/v1/wms.py`:
   - Exposed 7 REST endpoints under `/warehouses/{warehouse_id}`:
     - `GET /docks`
     - `POST /docks/stage`
     - `POST /dispatch-manifests` (201 Created)
     - `GET /dispatch-manifests`
     - `GET /dispatch-manifests/{manifest_id}`
     - `POST /dispatch-manifests/{manifest_id}/gate-scan`
     - `POST /dispatch-manifests/{manifest_id}/dispatch`
4. `src/components/wms/WmsStudioTab.tsx`:
   - Added `DockDoor`, `ManifestCarton`, and `DispatchManifest` TypeScript interfaces.
   - Added `"dispatch"` to `activeSubTab` type union.
   - Added Phase 7 state hooks and API client handlers for dock management, manifest creation, optical barcode loading scanning, and final dispatch confirmation.
   - Added top navigation button "Dock & Dispatch" and rendered Subtab 8 with Dock Door Cards, 2-column Manifest Explorer, Interactive Truck Loading Gate Scanner with progress bar, Carton Itemized Table, and Manifest Creation Modal.
5. `docs/implementation/README.md`:
   - Registered Phase 7 plan in the master implementation index table.
6. `docs/walkthrough/README.md`:
   - Registered Phase 7 walkthrough in the master walkthrough index table.
7. `CHANGELOG.md`:
   - Documented v3.132.0 release additions and changes.
8. `RELEASE_NOTES.md`:
   - Added v3.132.0 release overview and key highlights.

---

## 5. Architecture Decisions
1. **Dock Door Dynamic Discovery with Resilient Fallback**:
   - Rather than hardcoding dock doors or mandating immediate schema migrations, `get_dock_doors` inspects `WarehouseLocation` for locations with `zone_type in ("DOCK", "STAGING", "OUTBOUND")` or zone code matching `DOCK%`. If no locations are found, it generates standard physical dock bays (`DOCK-01` through `DOCK-04`) dynamically.
2. **Phase 5 Carton Integration Continuity**:
   - `create_dispatch_manifest` automatically correlates carton barcodes with Phase 5's `_PACKED_CARTONS` memory store, extracting actual gross weights, item quantities, and source wave references. If cartons are staged ad-hoc, graceful defaults (e.g., 5.0 kg, 1 item) prevent process halts.
3. **Fail-Closed Optical Verification Gate**:
   - At the truck tail, human loading errors can send goods to the wrong hub or client. `scan_carton_at_gate` checks scanned barcodes against the manifest carton line items. Unauthorized barcodes are immediately rejected with HTTP 400 (`UNAUTHORIZED_CARTON`), halting the load sequence.
4. **Supervisor Override SLA Safety Valve**:
   - Freight carriers impose strict dwell-time penalties and delivery slot cutoffs. If a carton cannot be located during vehicle loading, an authorized supervisor can provide a written justification note to force dispatch (`allow_partial_override=True`). The system records the override in the audit trail and only posts ledger deductions for cartons actually verified.
5. **Atomic Outbound Ledger Commit**:
   - Final dispatch posts dual-polarity `StockMovement` entries (`movement_type="DISPATCH_OUT"`, `bin=dock_code`, `quantity=-carton_count`, `reference_doc_type="WMS_DISPATCH"`) directly into the PostgreSQL `stock_movements` ledger, ensuring physical dock inventory accurately reaches zero upon truck departure.

---

## 6. Design Rationale
- **Single-Page Dispatch Command Station**:
  Warehouse dispatch managers need simultaneous visibility over dock door occupancy, carrier vehicle status, and loading progress without page reloads. The 8th subtab integrates all four visual components into a unified, responsive dashboard.
- **Optical Laser Wedge Compatibility**:
  The gate loading scan input is wired with `onKeyDown` Enter listeners, enabling hands-free, high-speed barcode gun operation at the dock bay without requiring mouse clicks.
- **Statutory E-Way Bill Compliance**:
  Indian GST logistics regulations require an active E-Way Bill Number and LR/Docket note for commercial vehicular transport. The manifest captures and exposes these attributes on both the API and UI layers.

---

## 7. Implementation Summary

### Schema Definitions (`backend/app/schemas/wms.py`)
```python
class DockDoorResponse(BaseModel):
    dock_code: str
    dock_name: str
    status: str
    assigned_manifest_id: Optional[str]
    assigned_vehicle_no: Optional[str]
    transporter_name: Optional[str]
    staged_carton_count: int
    loaded_carton_count: int

class DispatchManifestCreate(BaseModel):
    dock_code: str
    transporter_name: str
    vehicle_number: str
    driver_name: Optional[str]
    driver_phone: Optional[str]
    destination_hub: str
    lr_number: Optional[str]
    eway_bill_no: Optional[str]
    carton_barcodes: List[str]
    notes: Optional[str]

class GateScanItemRequest(BaseModel):
    scanned_barcode: str
    scanned_by: Optional[str]

class ManifestDispatchConfirmRequest(BaseModel):
    dispatched_by: Optional[str]
    supervisor_override: bool = False
    override_reason: Optional[str]
```

### Core Service Methods (`backend/app/services/inventory_wms.py`)
- `get_dock_doors(db, warehouse_id)`: Enumerates dock bays and calculates live staged/loaded carton counts.
- `stage_cartons_at_dock(db, warehouse_id, req)`: Associates carton barcodes with a specific dock door.
- `create_dispatch_manifest(db, warehouse_id, req)`: Assembles carton lines with weights and seals manifest in `STAGED` status.
- `scan_carton_at_gate(db, warehouse_id, manifest_id, req)`: Validates scanned barcode, marks carton as `LOADED`, increments progress, and updates manifest status to `GATE_VERIFIED` when 100% scanned.
- `confirm_manifest_dispatch(db, warehouse_id, manifest_id, req)`: Verifies loading gate completion (or supervisor override), posts `StockMovement` entries (`movement_type="DISPATCH_OUT"`), marks manifest `DISPATCHED`, and generates official `GP-YYYYMMDD-XXXX` Gate Pass.

---

## 8. Tests Executed

Test Suite: `backend/tests/test_wms_dispatch_and_dock.py`
Command:
```bash
pytest backend/tests/test_wms_dispatch_and_dock.py -v
```

All 10 tests passed successfully:
1. `test_dock_doors_listing_default_and_custom`
2. `test_carton_staging_at_dock`
3. `test_create_dispatch_manifest`
4. `test_manifest_gate_scan_success`
5. `test_manifest_gate_scan_unauthorized_carton_rejected`
6. `test_manifest_gate_scan_completes_and_sets_gate_verified`
7. `test_dispatch_blocked_when_unscanned`
8. `test_dispatch_confirm_posts_stock_movements_and_gate_pass`
9. `test_dispatch_supervisor_override_partial_load`
10. `test_dispatch_api_router_endpoints`

---

## 9. Verification Results

```text
============================= test session starts =============================
platform win32 -- Python 3.12.1, pytest-9.0.2, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pytest.ini
plugins: anyio-4.12.1, asyncio-1.3.0
asyncio: mode=Mode.STRICT, asyncio_default_fixture_loop=scope:function
collected 10 items

backend\tests\test_wms_dispatch_and_dock.py::test_dock_doors_listing_default_and_custom PASSED [ 10%]
backend\tests\test_wms_dispatch_and_dock.py::test_carton_staging_at_dock PASSED [ 20%]
backend\tests\test_wms_dispatch_and_dock.py::test_create_dispatch_manifest PASSED [ 30%]
backend\tests\test_wms_dispatch_and_dock.py::test_manifest_gate_scan_success PASSED [ 40%]
backend\tests\test_wms_dispatch_and_dock.py::test_manifest_gate_scan_unauthorized_carton_rejected PASSED [ 50%]
backend\tests\test_wms_dispatch_and_dock.py::test_manifest_gate_scan_completes_and_sets_gate_verified PASSED [ 60%]
backend\tests\test_wms_dispatch_and_dock.py::test_dispatch_blocked_when_unscanned PASSED [ 70%]
backend\tests\test_wms_dispatch_and_dock.py::test_dispatch_confirm_posts_stock_movements_and_gate_pass PASSED [ 80%]
backend\tests\test_wms_dispatch_and_dock.py::test_dispatch_supervisor_override_partial_load PASSED [ 90%]
backend\tests\test_wms_dispatch_and_dock.py::test_dispatch_api_router_endpoints PASSED [100%]

============================= 10 passed in 61.16s =============================
```

Frontend Verification:
- `npx tsc --noEmit --project tsconfig.json`: Clean compile, 0 errors.

---

## 10. Known Limitations
- Manifest carton records reside in a tenant-isolated memory store (`_DISPATCH_MANIFESTS`). In a subsequent infrastructure release, a dedicated `wms_dispatch_manifests` and `wms_manifest_cartons` SQL table migration can be stamped to provide cross-restart durability.
- E-Way Bill integration validates format and values in metadata, but direct NIC/GSTN API e-way bill generation is decoupled and executed via the GST compliance gateway.

---

## 11. Future Work
- **Phase 8 (Carrier Tracking & Proof of Delivery)**: Mobile driver app for in-transit GPS tracking and digital customer signature capture on delivery.
- **Automated Weighbridge Integration**: Direct serial/TCP connection to dock door weighbridges to verify vehicle tare and gross weights against manifest carton totals before gate pass generation.

---

## 12. Related ADRs
- `ADR-0042`: WMS Outbound Shipping Dock Architecture and Gate Pass Issuance
- `ADR-0038`: StockMovement Dual-Polarity Transaction Ledger

---

## 13. Related RFCs
- `RFC-0089`: Logistics Carrier Manifests, E-Way Bill Integration & Optical Gate Scanning
