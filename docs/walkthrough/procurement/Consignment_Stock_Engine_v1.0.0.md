<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.109.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Consignment Stock Engine (v1.0.0-GA)

## 1. Purpose
Documents the Consignment Engine — vendor-owned stock tracking with sale-or-return movement recording, 4-band aging computation, return schedule, and settlement.

## 2. Scope
- `ConsignmentEngine` covering `createPlan()`, `recordSales()`, `recordReturn()`, `getAgingReport()`, `getReturnSchedule()`, `settle()`.
- `DEFAULT_AGING_CONFIG`: FRESH ≤14d, NORMAL 15–30d, AGEING 31–60d, CRITICAL >60d.
- Aging `returnDue = daysOnFloor >= plan.termDays`.
- Movement ledger: RECEIVED on creation, SOLD/RETURNED on each call; `recalc()` recomputes `totalSold`, `totalBilledAmt`, `daysElapsed`, `daysRemaining` after every mutation.
- `ConsignmentStudioModal` with plan list, detail/aging/movement tabs, settle button, return-due alert.

## 3. Files Created
- `src/utils/consignmentEngine.ts`
- `src/components/procurement/ConsignmentStudioModal.tsx`
- `src/tests/consignmentEngine.test.ts`
- `docs/walkthrough/procurement/Consignment_Stock_Engine_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **`onHandQty` is derived, not stored separately**: `onHandQty = receivedQty + adjustedQty - soldQty - returnedQty` is maintained on every mutation — prevents drift between movement history and balance.
2. **Movement ledger is append-only**: Every `recordSales()` and `recordReturn()` call appends a new movement entry; no records are mutated. The settlement links to the final state, not individual movements.
3. **`recalc()` is called after every mutation**: A single private helper recomputes `totalSold`, `totalBilledAmt`, `daysElapsed`, `daysRemaining`, and `returnDueQty` — avoids duplicated aggregation logic across methods.
4. **`recordSales()` clamps qty to `onHandQty`**: `qty = Math.min(sale.qty, l.onHandQty)` — prevents overselling on a consignment line silently.
5. **Aging is a pure report, not stored state**: `getAgingReport()` always computes bands from `asOf - plan.startDate` — passing a different `asOf` date gives aging as of any historical or future point without schema changes.

## 6. Design Rationale
Consignment stock is frequently invisible in retail systems — it sits on shelves, sells, and is partially returned to vendors with no structured tracking. The aging bands create urgency: CRITICAL items past their term date are costing the retailer opportunity cost on shelf space while the vendor is owed stock or payment.

## 7. Implementation Summary
- `createPlan()`: Creates lines with `receivedQty = onHandQty`; appends one RECEIVED movement per line.
- `recordSales()`: Per-SKU qty clamped to `onHandQty`; appends SOLD movements; calls `recalc()`.
- `recordReturn()`: Per-SKU clamped; appends RETURNED movements; calls `recalc()`.
- `getAgingReport()`: Computes `daysOnFloor = asOf − startDate`; maps to band; computes `exposedValue = onHandQty × vendorCost`.
- `getReturnSchedule()`: Filters `getAgingReport()` to items where `returnDue = true`.
- `settle()`: Snapshots current totals into `ConsignmentSettlement`; sets status SETTLED.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/consignmentEngine.test.ts`**: 4/4 tests passed.
  - Test 1: Plan creation — 190 received, 3 RECEIVED movements, endDate=2026-08-30 ✓
  - Test 2: Sales — silk 30→billedAmt 18000, cotton 60→7200, totalBilledAmt 25200, daysElapsed=19 ✓
  - Test 3: Aging bands — day 10→FRESH, day 45→AGEING, day 61→CRITICAL + returnDue ✓
  - Test 4: Return schedule + settlement — settled with correct billedAmt, totalReturnQty>0 ✓
- **Total Frontend Suite**: 81/81 test files, 496/496 tests green in 15.37s, exit code 0.

## 10. Known Limitations
- `adjustedQty` field exists in the type but no `recordAdjustment()` method in this release — production uses a write-off / addition endpoint.
- Aging is per-plan (single `startDate`), not per-batch — production tracks individual batch receipt dates for multi-batch consignments.

## 11. Future Work
- FastAPI `POST /api/v1/consignments/`, `POST /api/v1/consignments/{id}/sales`, `POST /api/v1/consignments/{id}/settle`.
- Nightly aging cron with vendor-facing alerts for CRITICAL items.
- Multi-batch consignment lines with per-batch aging.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-043`: Consignment Movement Ledger, Aging Band Configuration, and Settlement Policy.

## 13. Related RFCs
- `RFC-112`: Consignment Stock Governance, Vendor Return Authorization, and Aging Threshold Calibration.
