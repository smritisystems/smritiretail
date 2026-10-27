<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.129.0
  Created      : 2026-10-28
  Modified     : 2026-10-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# WMS Phase 4 Implementation Plan: Barcode RF Gun Handheld Terminal Workflow & Fast Mobile Relocation

**Plan Version:** v3.129.0  
**Status:** In Progress  
**Area:** Warehouse Management System (WMS) / Mobile Floor Execution  
**Target Date:** 2026-10-28  

---

## 1. Objective
Deliver **WMS Phase 4: Barcode RF Gun Handheld Terminal Workflow, Directed Replenishment Confirmation & Mobile Bin Audit Scan**. This establishes a dedicated, high-speed, tactile mobile terminal interface optimized for physical warehouse operators carrying Android/Windows RF guns (Zebra, Honeywell, Chainway, Datalogic) and handheld barcode scanners. The system guarantees multi-scan verification (Source Bin → Item Barcode → Quantity → Destination Bin), zero-error replenishment transfers, live bin occupancy lookups, and fast ad-hoc stock relocations backed by atomic dual `StockMovement` ledger rows.

---

## 2. Business Motivation
In modern retail and distribution logistics, manual desktop-based replenishment and stock recording causes severe bottlenecks and human error:
1. **Misplaced Stock & Picking Errors**: Warehouse staff mistakenly pick or place goods into adjacent bins when not prompted by immediate optical barcode confirmation.
2. **Desktop Detachment**: Warehouse floor staff cannot carry desktop computers into narrow warehouse aisles and mezzanine racks; they need responsive, high-contrast, audio-tactile interfaces on rugged handheld terminals.
3. **Replenishment Verification Lag**: When Phase 3 generates replenishment tasks, physical execution must be confirmed instantaneously at the rack face so that inventory balances update in real-time, preventing out-of-stock orders in POS and e-commerce channels.
4. **Ad-Hoc Bin Drift**: Stock frequently gets physically moved during floor tidying without system logging. A mobile quick-relocate tool allows operators to scan and register moves in under 4 seconds.

---

## 3. Scope
### In Scope
1. **Pydantic Schemas (`backend/app/schemas/wms.py`)**:
   - `RfBarcodeVerifyRequest`, `RfLocationMatch`, `RfItemMatch`, `RfBarcodeVerifyResponse`.
   - `RfBinItemSummary`, `RfBinSummaryResponse`.
   - `RfQuickTransferRequest`, `RfQuickTransferResponse`.
   - `RfReplenishConfirmRequest`, `RfReplenishConfirmResponse`.
2. **Backend Engine (`backend/app/services/inventory_wms.py`)**:
   - `verify_rf_barcode`: Resolves unknown scanned barcode into either a `WarehouseLocation` or an `Item`/`Product`.
   - `get_rf_bin_summary`: Returns location metadata, active SKU occupants, total occupied units from `StockMovement`, and remaining headroom.
   - `execute_rf_quick_transfer`: Validates source stock, target capacity, and records atomic `TRANSFER_OUT` and `TRANSFER_IN` movements under `reference_doc_type="WMS_RF_TRANSFER"`.
   - `confirm_rf_replenishment`: Validates the 3-step scan sequence against active replenishment tasks and posts atomic stock transfer under `reference_doc_type="WMS_REPLENISHMENT"`.
3. **FastAPI Endpoints (`backend/app/api/v1/wms.py`)**:
   - `POST /warehouses/{warehouse_id}/rf/verify-barcode`
   - `GET /warehouses/{warehouse_id}/rf/bin-summary`
   - `POST /warehouses/{warehouse_id}/rf/quick-transfer`
   - `POST /warehouses/{warehouse_id}/rf/replenish-confirm`
4. **Frontend Mobile Terminal (`src/components/wms/WmsRfScanTerminal.tsx`)**:
   - High-contrast industrial mobile UI with big touch buttons and high readability.
   - Three operational modes:
     - **Mode 1: Directed Replenishment Scan**: 4-step guided walk (Source Bin → Item Barcode → Quantity → Destination Bin).
     - **Mode 2: Bin Barcode Audit & Live Inquiry**: Instant occupancy meter, stored SKUs, and capacity headroom.
     - **Mode 3: Quick Stock Relocate**: Fast ad-hoc bin transfer on the rack floor.
   - Hardware wedge keyboard listener (intercepts fast keystrokes ending in `Enter`).
   - Built-in Web Audio API synthesizer for instant audio feedback (dual-tone positive chime vs low error buzzer) without external MP3 assets.
   - Haptic vibration support (`navigator.vibrate`) for mobile Android scanners.
5. **Studio Integration (`src/components/wms/WmsStudioTab.tsx`)**:
   - New dedicated subtab pill: `RF Gun Terminal` with pulsating live indicator and direct warehouse switcher.
6. **Automated Regression Suite (`backend/tests/test_wms_rf_terminal.py`)**:
   - Unit and integration tests covering all 4 RF service methods and API endpoints.

### Out of Scope (Deferred to Phase 5)
- Spatial 3D traveling wave picking algorithms for sales batch orders (Phase 5).
- Packing station scale weight capture & box dimension cubing.

---

## 4. Current State
- **Phase 1 (v3.126.0)**: Resolved physical warehouse code resolution (`is_default_for_branch`, resilient godown lookups).
- **Phase 2 (v3.127.0)**: Physical Bin Matrix Generator & 4-tier Putaway Recommendation engine.
- **Phase 3 (v3.128.0)**: Dynamic Picking Bin Replenishment Engine & Min/Max Slotting rules with atomic dual `StockMovement` execution.
- **Limitation**: Currently replenishment execution requires opening a desktop modal and clicking "Execute Replenishment", lacking physical barcode scan validation on mobile handheld RF devices.

---

## 5. Gap Analysis
| Requirement | Existing System | WMS Phase 4 Solution |
|---|---|---|
| **Barcode Disambiguation** | Separate endpoints for items vs locations | Unified `verify-barcode` endpoint resolving either Location or Item |
| **Physical Scan Proof** | Virtual transfer execution without barcode scan | 4-step scan proof (Source Bin + SKU Barcode + Qty + Target Bin) |
| **Rack-Face Bin Audit** | Full desktop reports required to inspect bin stock | Instant single-scan bin occupancy & headroom lookup on handheld terminal |
| **Audio-Tactile Feedback** | Silent desktop web interface | Web Audio API synth chimes + Android haptic vibration feedback |
| **Ad-Hoc Relocation** | Formal multi-field Stock Transfer (STO) workflow | 3-scan Quick Relocate completing movements in under 4 seconds |

---

## 6. Architecture Impact
```text
           Rugged Android RF Scanner / Mobile Browser
                 │ (Hardware Barcode Wedge / Camera Scan)
                 ▼
     ┌──────────────────────────────────────────────┐
     │         WmsRfScanTerminal.tsx                │
     │  - Directed Replenishment Wizard (4-Step)    │
     │  - Live Bin Occupancy & Headroom Audit       │
     │  - Quick Stock Relocate                      │
     │  - Web Audio Synthesizer (Chime / Buzzer)    │
     │  - Haptic Vibration API Feedback             │
     └──────────────────────┬───────────────────────┘
                            │ /api/v1/wms/warehouses/{id}/rf/*
                            ▼
     ┌──────────────────────────────────────────────┐
     │             wms.py (FastAPI)                 │
     │  - /verify-barcode                           │
     │  - /bin-summary                              │
     │  - /quick-transfer                           │
     │  - /replenish-confirm                        │
     └──────────────────────┬───────────────────────┘
                            │
                            ▼
     ┌──────────────────────────────────────────────┐
     │           InventoryWmsService                │
     │  - verify_rf_barcode()                       │
     │  - get_rf_bin_summary()                      │
     │  - execute_rf_quick_transfer()               │
     │  - confirm_rf_replenishment()                │
     └──────────────────────┬───────────────────────┘
                            │
                            ▼
     ┌──────────────────────────────────────────────┐
     │           PostgreSQL Database                │
     │  - warehouse_locations (zone, capacity, lock)│
     │  - items / products (code, sku, barcode)     │
     │  - stock_movements (atomic TRANSFER pair)    │
     │  - item_warehouse_locations (slotting)       │
     └──────────────────────────────────────────────┘
```

---

## 7. Proposed Design
1. **Barcode Verification Flow**:
   - Query `WarehouseLocation` by `barcode == code` or `code == code`.
   - If not found, query `Item` / `Product` by `barcode`, `sku`, or `item_code`.
   - Return structured type discriminant (`LOCATION` or `ITEM`).
2. **Bin Summary Aggregation Flow**:
   - Fetch bin by `bin_code` or `barcode`.
   - Query `StockMovement` grouped by item/product where `bin == bin_code`, summing quantity. Filter out items where net balance <= 0.
   - Calculate `headroom = max(0, max_capacity_units - total_occupied)`.
3. **Directed Replenishment Confirmation**:
   - Check scanned source bin equals task's suggested bulk bin.
   - Check scanned item barcode matches task's item.
   - Check scanned target bin matches task's designated picking bin.
   - Execute atomic negative `TRANSFER_OUT` from source bin and positive `TRANSFER_IN` to picking bin under run ID.
4. **Quick Stock Relocation Flow**:
   - Verify sufficient stock in source bin.
   - Execute atomic negative `TRANSFER_OUT` and positive `TRANSFER_IN` under doc type `WMS_RF_TRANSFER`.

---

## 8. Files Created
1. `backend/tests/test_wms_rf_terminal.py`: Comprehensive test suite for RF endpoints and service methods.
2. `src/components/wms/WmsRfScanTerminal.tsx`: Mobile handheld RF gun scanning component.
3. `docs/implementation/wms/WMS_Phase4_RF_Gun_Handheld_Terminal_Plan_v3.129.0.md`: This implementation plan.
4. `docs/walkthrough/wms/WMS_Phase4_RF_Gun_Handheld_Terminal_v3.129.0.md`: Walkthrough document.

---

## 9. Files Modified
1. `backend/app/schemas/wms.py`: Pydantic models for RF verification, bin summary, quick transfer, and replenishment confirmation.
2. `backend/app/services/inventory_wms.py`: Business logic for RF verification, bin lookup, quick transfer, and replenishment confirmation.
3. `backend/app/api/v1/wms.py`: 4 new RF endpoints.
4. `src/components/wms/WmsStudioTab.tsx`: Subtab integration and launcher.
5. `docs/implementation/README.md`: Master index registration.
6. `docs/walkthrough/README.md`: Master index registration.
7. `CHANGELOG.md`: Version 3.129.0 release log.
8. `RELEASE_NOTES.md`: Version 3.129.0 release notes.

---

## 10. Dependencies
- FastAPI Core & SQLAlchemy async session.
- Pydantic v2 validation.
- React 18, Lucide React icons, Tailwind CSS design tokens.
- Web Audio API (standard browser API, zero external libraries).
- Vibration API (`navigator.vibrate`, standard browser API).

---

## 11. Risks
| Risk | Severity | Mitigation |
|---|---|---|
| Handheld Scanner Hardware Diversity | Medium | Support both hardware keyboard wedge emulation (keydown events with buffer) and standard on-screen text input with camera scan trigger |
| Double Scans & Bounce | Low | Debounce scan submission and enforce active step wizard progression |
| Network Drops in Deep Warehouse Aisles | Medium | Idempotent transfer run IDs and clear optimistic UI rollback on error |

---

## 12. Rollback Strategy
All code changes reside in the working tree without git commit. In case of regression:
- Revert added routes in `backend/app/api/v1/wms.py`.
- Revert methods in `backend/app/services/inventory_wms.py`.
- Revert schemas in `backend/app/schemas/wms.py`.
- Remove `WmsRfScanTerminal.tsx`.

---

## 13. Verification Plan
1. **Backend Tests**: Run `pytest backend/tests/test_wms_rf_terminal.py` and full regression suite.
2. **Frontend Build Check**: Run `npx tsc --noEmit --project tsconfig.json` to verify 0 TypeScript compiler errors.
3. **Diff Verification**: Literal `git diff` outputs per `AGENTS.md`.

---

## 14. Test Plan
- Test barcode verification for warehouse location.
- Test barcode verification for item master SKU.
- Test barcode verification for unrecognized barcode (returns UNKNOWN).
- Test bin summary retrieval with live stock aggregation and headroom calculation.
- Test quick transfer execution with dual `StockMovement` creation and audit doc type.
- Test replenishment confirmation with 3-scan validation and matching task execution.
- Test negative cases: insufficient source stock, locked location, invalid destination.

---

## 15. Documentation Impact
- Update `CHANGELOG.md` with v3.129.0.
- Update `RELEASE_NOTES.md` with v3.129.0.
- Update `docs/implementation/README.md`.
- Update `docs/walkthrough/README.md`.

---

## 16. Deployment Plan
Code deployed via standard pipeline into DEV environment. No new database tables required (utilizes existing `warehouse_locations`, `items`, `products`, and `stock_movements`).

---

## 17. Status
- **Current State:** In Progress
- **Target Version:** v3.129.0

---

## 18. Related ADRs
- `ADR-0021`: Resilient Warehouse Schema Drift Handling.
- `ADR-0045`: Unified StockMovement System of Record for Bin-Level Logistics.

---

## 19. Related Walkthroughs
- `docs/walkthrough/wms/WMS_Phase1_Warehouse_Location_Resolution_v3.126.0.md`
- `docs/walkthrough/wms/WMS_Phase2_Physical_Bin_Matrix_And_Putaway_Rules_v3.127.0.md`
- `docs/walkthrough/wms/WMS_Phase3_Dynamic_Picking_Bin_Replenishment_And_Slotting_v3.128.0.md`
- `docs/walkthrough/wms/WMS_Phase4_RF_Gun_Handheld_Terminal_v3.129.0.md`
