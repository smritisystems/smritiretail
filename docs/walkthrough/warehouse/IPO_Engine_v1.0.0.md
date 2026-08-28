<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.105.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Inter-Store Purchase Order (IPO) Engine (v1.0.0-GA)

## 1. Purpose
Documents the IPO Engine — branch-to-branch stock requisition and fulfillment with per-line approval qty overrides, pick recording, dispatch, and auto-GRN generation with variance detection.

## 2. Scope
- `IPOEngine` covering full lifecycle: DRAFT → SUBMITTED → APPROVED → PICKING → DISPATCHED → AUTO_GRN → CLOSED / DISPUTED / CANCELLED.
- Per-line approval qty (fulfilling branch decides available qty, clamped to requestedQty).
- `dispatch()` records per-line picked qty → computes `lineValue`, `totalValue`, and `fulfillmentRate`.
- `generateAutoGRN()` produces a full `AutoGRN` document with `hasVariance` flag; variance detected when any line's `receivedQty < dispatchedQty`.
- `IPOStudioModal` with sidebar order list, detail panel (KPI strip, lines table, audit trail), one-click lifecycle buttons, Auto-GRN tab.

## 3. Files Created
- `src/utils/ipoEngine.ts`
- `src/components/warehouse/IPOStudioModal.tsx`
- `src/tests/ipoEngine.test.ts`
- `docs/walkthrough/warehouse/IPO_Engine_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **`approve()` clamps `approvedQty` to `requestedQty`**: Preventing overcommit at the fulfilling branch — `Math.min(approval.approvedQty, l.requestedQty)` enforces the cap without requiring validation at the call site.
2. **`dispatch()` sets `lineStatus` from picked qty**: FULFILLED if `pickedQty === requestedQty`, PARTIAL if less, CANCELLED if zero — purely functional, no separate status setter needed.
3. **`generateAutoGRN()` defaults to full receipt**: If `receivedQties` array has no entry for a line, `receivedQty = dispatchedQty` (assumed fully received) — callers only need to supply exceptions.
4. **`recalcTotals()` as a pure private helper**: Called after dispatch and GRN to keep `totalDispatchedQty`, `totalReceivedQty`, `totalValue`, and `fulfillmentRate` in sync without duplicating aggregation logic.
5. **GRN `hasVariance` flag drives status**: AUTO_GRN status is set by the engine on every GRN generation; dispute vs clean-close is then a caller decision after inspecting the flag.

## 6. Design Rationale
Inter-store transfers without a formal GRN result in phantom stock: the sending branch shows stock as dispatched while the receiving branch either has no record or records it manually. Auto-GRN eliminates the manual step and creates an immutable evidence trail of what was dispatched vs received, flagging short deliveries for dispute resolution.

## 7. Implementation Summary
- `createIPO()`: Initialises lines with PENDING status and zero actuals; computes `totalRequestedQty`.
- `approve()`: Maps approvals array → updates `approvedQty` per line with clamp.
- `startPicking()`: Bulk marks all lines to PICKING status.
- `dispatch()`: Per-line `pickedQty` → `dispatchedQty` → `lineValue` → `lineStatus`; calls `recalcTotals()`.
- `generateAutoGRN()`: Builds `AutoGRN` with per-line `shortQty` and `hasVariance`; calls `recalcTotals()`.
- `close()`: Terminal status transition.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/ipoEngine.test.ts`**: 4/4 tests passed.
  - Test 1: Creation — 3 lines, totalRequestedQty=180, all PENDING ✓
  - Test 2: Approval — partial qty, clamping 999→30 ✓
  - Test 3: Dispatch — lineValues (12000, 10000, 10500), fulfillmentRate=94.44%, PARTIAL line status ✓
  - Test 4: Auto-GRN full receipt → hasVariance=false → CLOSED ✓
- **Total Frontend Suite**: 78/78 test files, 484/484 tests green in 14.32s, exit code 0.

## 10. Known Limitations
- No inter-branch stock reservation: approving an IPO does not lock stock at the fulfilling branch — production uses a Postgres `SELECT FOR UPDATE` on the stock ledger row at pick time.
- `AUTO_GRN` does not auto-update stock ledger in this release — production posts a stock movement entry to the `stock_ledger` table on GRN generation.

## 11. Future Work
- FastAPI `POST /api/v1/inter-store-po/`, `PATCH /api/v1/inter-store-po/{id}/dispatch`, `POST /api/v1/inter-store-po/{id}/grn` backed by Postgres.
- Stock ledger auto-update on GRN with debit (sending branch) and credit (receiving branch) entries.
- Partially fulfilled IPO reorder for unfulfilled qty.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-039`: Inter-Store PO Lifecycle, Auto-GRN Generation, and Stock Ledger Integration Policy.

## 13. Related RFCs
- `RFC-108`: Inter-Store Transfer Authorization Matrix, GRN Variance Tolerance, and Stock Ledger Reconciliation Cadence.
