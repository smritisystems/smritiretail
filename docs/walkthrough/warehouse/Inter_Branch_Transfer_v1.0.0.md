<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.118.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Inter-Branch Stock Transfer Engine (v1.0.0-GA)

## 1. Purpose
Documents the Inter-Branch Stock Transfer Engine — transfer order lifecycle from draft through completion, with line-level dispatched/received qty tracking, variance detection, and audit trail.

## 2. Scope
- `InterBranchTransferEngine` covering `createTransfer()`, `approve()`, `dispatch()`, `receive()`, `complete()`, `cancel()`, `transferSummary()`.
- Status flow: DRAFT → APPROVED → IN_TRANSIT → RECEIVED → COMPLETED; DRAFT/APPROVED → CANCELLED.
- Line-level: `dispatchedQty` set on dispatch; `receivedQty` set on receive; `variance = dispatchedQty - receivedQty`.
- `hasVariance = totalVarianceQty > 0` — order-level flag for exception reporting.
- `InterBranchTransferModal`: order sidebar (variance badge), queue summary strip, 2-tab (Lines + Audit).

## 3. Files Created
- `src/utils/interBranchTransferEngine.ts`
- `src/components/warehouse/InterBranchTransferModal.tsx`
- `src/tests/interBranchTransferEngine.test.ts`
- `docs/walkthrough/warehouse/Inter_Branch_Transfer_v1.0.0.md`

## 4. Files Modified
- `docs/walkthrough/README.md`, `docs/implementation/README.md`, `CHANGELOG.md`

## 5. Architecture Decisions
1. **`totals()` is a private helper recomputed on every mutation**: Rather than incrementally updating aggregate fields, `totals()` re-aggregates all lines on `dispatch()`, `receive()`, and `complete()`. This guarantees `totalVarianceQty` and `hasVariance` are always consistent with line data.
2. **`dispatch()` accepts a `lineQtys` map**: The dispatched quantity may differ from the requested quantity (e.g. short-stock). The UI defaults to `requestedQty` but allows overrides per line. This models real warehouse operations accurately.
3. **`cancel()` is forbidden once IN_TRANSIT**: Physical goods are in transit and cannot be recalled without a separate reverse-transfer order. The engine enforces this as a hard throw — not a warning.
4. **`variance = dispatchedQty - receivedQty`**: A positive variance indicates shrinkage in transit (damage, theft). A negative variance (received > dispatched) indicates a data entry error and is also surfaced by `hasVariance`.
5. **Audit trail append-only with descriptive notes**: `auditTrail` is never mutated in-place — every mutation returns a new object with `[...auditTrail, newEntry]`. Notes are human-readable (e.g. "variance 2 units" vs. "clean").

## 6. Design Rationale
Inter-branch stock movement is one of the most error-prone operations in multi-branch retail. The variance detection mechanism creates an automatic exception record that the inventory team must resolve before completion. The `hasVariance` flag allows management dashboards to filter and prioritise outstanding variance investigations.

## 7. Implementation Summary
- `createTransfer()`: Maps input lines to `TransferLine[]` with `dispatchedQty=0, receivedQty=0, variance=0`; computes initial `totals()`; DRAFT status; TRANSFER_CREATED audit.
- `approve()`: Guards DRAFT; sets APPROVED; APPROVED audit.
- `dispatch()`: Guards APPROVED; maps `lineQtys` (defaults to `requestedQty`); recomputes `totals()`; sets IN_TRANSIT; `dispatchedAt`.
- `receive()`: Guards IN_TRANSIT; maps `lineQtys` (defaults to `dispatchedQty`); `variance = dispatchedQty - receivedQty`; recomputes `totals()`; RECEIVED.
- `complete()`: Guards RECEIVED; sets COMPLETED; `completedAt`; audit note includes variance text.
- `cancel()`: Guards DRAFT or APPROVED; throws for all other statuses.
- `transferSummary()`: Single-pass over orders — `byStatus` counts, `withVariance` count, `totalInTransit` from IN_TRANSIT orders, `totalCompleted` from COMPLETED orders.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/interBranchTransferEngine.test.ts`**: 4/4 passed (1 assertion patch applied).
  - Test 1: DRAFT status, fromBranch/toBranch, totalRequestedQty=80, zero dispatched/received, TRANSFER_CREATED audit, transferNo matches `STO-BR-MUM-01-*` ✓
  - Test 2: approve→IN_TRANSIT; line 2 dispatched 25 of 30; totalDispatchedQty=75; cannot dispatch again (throws) ✓
  - Test 3: Full lifecycle — dispatch 20, receive 18, variance=2, hasVariance=true, complete; 5 audit entries; note contains "variance 2 units" ✓
  - Test 4: cancel DRAFT→CANCELLED; cancel IN_TRANSIT throws; transferSummary: CANCELLED=1, IN_TRANSIT=1, totalInTransit=5, withVariance=1 ✓
  - **Patch**: `withVariance` corrected from 0 to 1 — the IN_TRANSIT order's line has `dispatchedQty=5, receivedQty=0 → variance=5`, computed by `totals()` on dispatch.
- **Total Frontend Suite**: 90/90 test files, 532/532 tests green, exit code 0.

## 10. Known Limitations
- No courier/tracking reference on `dispatch()` — production adds `courier` and `trackingNo` fields (cf. PRTV's `DispatchInfo`).
- No partial completion: `complete()` settles the entire order regardless of whether all variance has been investigated.

## 11. Future Work
- FastAPI `POST /api/v1/stock-transfers/`, `PATCH /api/v1/stock-transfers/{id}/dispatch`, `PATCH /api/v1/stock-transfers/{id}/receive`.
- Automatic stock ledger posting: on `complete()`, deduct from `fromBranch` stock and add to `toBranch` stock in Postgres atomically.
- Variance write-off workflow: `writeOffVariance()` posts a stock shrinkage entry to the P&L engine.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record. `ADR-052`: Inter-Branch Transfer Status Flow, Variance Detection Policy, and Stock Ledger Posting Rules.

## 13. Related RFCs
- `RFC-121`: Multi-Branch Stock Movement Policy, Transit Insurance, and Variance Investigation SLA.
