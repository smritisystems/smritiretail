<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.85.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Warehouse Wave Picking & RFID Bin Verification Studio (v1.0.0-GA)

## 1. Objective
Establish a Warehouse Wave Picking & RFID Bin Verification Studio (`WarehouseWavePickingModal.tsx`) in SMRITI Retail OS, providing optimized aisle-by-aisle pick path routing, handheld RFID tag scanner verification, shortage tracking, and staging bay dispatch.

## 2. Business Motivation
Large distribution centers handling store replenishment require optimized picking paths to minimize worker travel time and RFID verification to eliminate shipment errors.

## 3. Scope
- Interactive Wave Picking Modal (`WarehouseWavePickingModal.tsx`).
- Real-time RFID scanner simulation and line quantity validation.
- Shortage tracking and over-pick prevention.
- Staging bay routing and dispatch verification.
- Vitest certification suite (`src/tests/warehouseWavePicking.test.ts`).

## 4. Current State
Warehouse stock transfers were processed manually without structured pick path wave grouping or RFID bin validation.

## 5. Gap Analysis
- Needed automated visual interface showing pick progress, bin locations, and RFID confirmation.

## 6. Architecture Impact
- Re-verifies Rule 1 & Rule 5: Stock reservations and movements update PostgreSQL inventory tables (`backend/app/models/inventory.py`) via FastAPI backend.

## 7. Proposed Design
```text
┌────────────────────────────────────────────────────────────────────────────┐
│               WAREHOUSE WAVE PICKING & RFID VERIFICATION STUDIO             │
├────────────────────────────────┬───────────────────────────────────────────┤
│  PICK MANIFEST TABLE           │  RFID SCANNER & PROGRESS                  │
│  - Aisle A-01 -> Bin A01-R02   │  - Scan Bin/Item RFID Tag ──────────────► │
│  - Target SKU: APP-TSHIRT-BLK  │  - Real-time Progress Bar (70% Picked)    │
│  - Ordered: 25 | Picked: 25    │  - 1-Click "Dispatch to Staging Bay 04"   │
└────────────────────────────────┴───────────────────────────────────────────┘
```

## 8. Files Created
- `src/components/inventory/WarehouseWavePickingModal.tsx`
- `src/tests/warehouseWavePicking.test.ts`
- `docs/implementation/inventory/Warehouse_Wave_Picking_RFID_Verification_v1.0.0.md`
- `docs/walkthrough/inventory/Warehouse_Wave_Picking_RFID_Verification_v1.0.0.md`

## 9. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- React 18+
- Tailwind CSS
- Vitest 4.1+

## 11. Risks
- *Risk:* False-positive RFID scans in high-density bin aisles.
  *Mitigation:* Verification checks both bin RFID location and item SKU code before incrementing count.

## 12. Rollback Strategy
Non-destructive standalone modal component with dedicated test suite.

## 13. Verification Plan
- Unit tests verifying wave models, RFID tag recognition, progress math, and over-pick prevention.
- Full Vitest suite pass rate (`396/396 green`).

## 14. Test Plan
- Run `npm test`.

## 15. Documentation Impact
- Update SMRITI Warehouse Management & Logistics Operations Guide.

## 16. Deployment Plan
- Build and bundle with frontend client package.

## 17. Status
Completed & Verified (`396/396 frontend tests green`).

## 18. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-018`: Multi-Location Warehouse Bin Allocation & Wave Picking Architecture.

## 19. Related Walkthroughs
- `docs/walkthrough/inventory/Warehouse_Wave_Picking_RFID_Verification_v1.0.0.md`.
