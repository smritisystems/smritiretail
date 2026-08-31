<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.111.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Store Cash Drawer & Float Management Engine (v1.0.0-GA)

## 1. Purpose
Documents the Cash Drawer Engine — full POS cash drawer lifecycle with denomination-level float, cash movement recording, variance detection, and EOD reconciliation (BALANCED/SHORT/OVER).

## 2. Scope
- `CashDrawerEngine` covering `openDrawer()`, `countDenominations()`, `recordMovement()`, `reconcile()`, `expireBatch()`, `shiftSummary()`.
- Movement kinds: OPENING_FLOAT, CASH_IN, CASH_OUT, SALE, REFUND.
- `reconcile()` threshold: `|variance| ≤ varianceThreshold → BALANCED`.
- `shiftSummary()` aggregates across multiple terminals.
- `CashDrawerModal` with Overview / Float / Ledger / EOD tabs; live variance preview in denomination input grid.

## 3. Files Created
- `src/utils/cashDrawerEngine.ts`
- `src/components/pos/CashDrawerModal.tsx`
- `src/tests/cashDrawerEngine.test.ts`
- `docs/walkthrough/pos/Cash_Drawer_Float_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`, `docs/walkthrough/README.md`, `CHANGELOG.md`

## 5. Architecture Decisions
1. **`countDenominations()` is the single source of truth for float totals**: Used both at `openDrawer()` and in `reconcile()` physical count — no duplicate arithmetic.
2. **`expectedCash` is recomputed on every `recordMovement()` call**: `openingFloat + totalCashIn - totalCashOut + netSales - netRefunds` — prevents accumulated rounding errors from incremental updates.
3. **`currentBalance` and `expectedCash` are kept in sync**: For cash drawers, these should always be equal unless there is a variance — tracking both makes the variance visible immediately at any point in the shift.
4. **Variance threshold is configurable at call time**: `reconcile(drawer, by, denoms, threshold=5)` — different branches may have different tolerance policies (e.g., ₹1 in high-volume POS, ₹10 in low-volume counters).
5. **Audit trail is append-only and mirrors movements**: Every movement produces both a `DrawerMovement` (operational) and a `DrawerAuditEntry` (governance) — this is redundant by design for audit independence.

## 6. Design Rationale
Cash reconciliation discrepancies are a daily friction point in retail. By computing `expectedCash` explicitly and comparing it to a denomination count (not a manual entry), the engine eliminates the most common source of error — cashier math mistakes in the closing count.

## 7. Implementation Summary
- `openDrawer()`: Calls `countDenominations()` for float; creates OPENING_FLOAT movement + audit entry.
- `recordMovement()`: Adds movement; recomputes `totalCashIn/Out`, `netSales/Refunds`, `currentBalance`, `expectedCash`.
- `reconcile()`: Calls `countDenominations()` for physical count; computes `variance = actual - expected`; determines `BALANCED/SHORT/OVER`; appends `EOD_RECONCILE_${status}` audit entry.
- `shiftSummary()`: Reduces across drawer array; separates reconciled vs unreconciled; counts by reconciliation status.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/cashDrawerEngine.test.ts`**: 4/4 tests passed.
  - Test 1: Denomination sum ₹3500, OPENING_FLOAT movement, OPEN status ✓
  - Test 2: CASH_IN ₹500 → ₹4000; SALE ₹1200 → ₹5200; CASH_OUT ₹300 → ₹4900; 4 movements ✓
  - Test 3: BALANCED reconciliation (actual=expected=₹5300, variance=0) ✓
  - Test 4: SHORT reconciliation (variance=-100); shift summary (short=1, unreconciled=1, totalOpeningFloat=4500) ✓
- **Total Frontend Suite**: 84/84 test files, 508/508 tests green in 14.84s, exit code 0.

## 10. Known Limitations
- `drawerId` is client-side timestamp — production uses Postgres UUID.
- Shift multi-terminal summary is computed in-memory; production uses Postgres `GROUP BY terminalId`.

## 11. Future Work
- FastAPI `POST /api/v1/cash-drawers/open`, `POST /api/v1/cash-drawers/{id}/movements`, `POST /api/v1/cash-drawers/{id}/reconcile`.
- Live balance polling via WebSocket for supervisor dashboard.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record. `ADR-045`: Cash Drawer Reconciliation Policy and Variance Threshold Configuration.

## 13. Related RFCs
- `RFC-114`: Cash Float Governance, EOD Reconciliation Authority, and Variance Escalation Protocol.
