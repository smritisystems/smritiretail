<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Vertical Slice 15 — Frontend ProPOS Cashier Physical Denominations, Cash Movements & Shift Closeout UI

## 1. Objective
Deliver a resilient, high-speed cashier user interface in ProPOS for Indian Currency physical denomination breakdown counting, mid-shift cash drops (safe transfers), till petty expense disbursals, and day-end shift closeout reconciliation with automated dual-entry General Ledger balancing.

## 2. Business Motivation
In retail store environments, cashiers frequently need to transfer excess cash to the store safe during peak hours to mitigate loss risk, as well as disburse small cash sums for immediate petty expenses. Furthermore, end-of-shift cash drawer balancing requires accurate physical denomination counting and double-entry accounting audit trails.

## 3. Scope
- TypeScript types and interfaces in `src/components/billing/propos/types.ts`.
- Reusable denomination counter component `ProPosDenomination.tsx`.
- Cash Movements Modal `ProPosCashMovesDlg.tsx` for Cash Drops and Till Expenses.
- Shift Closeout Modal `ProPosShiftCloseDl.tsx` with physical count reconciliation and Z-Report slip preview.
- Upgraded `ProPosEodReportVie.tsx` with live backend API connectivity and denomination breakdown.
- Integration into `ProPosBillingTerm.tsx` and `ProPosWs.tsx`.
- Contract route alias `/pos/shifts/active/{register_id}` in `backend/app/api/v1/pos.py`.

## 4. Current State
- Backend (FastAPI + Postgres) implements `ShiftCashTransaction`, `cash_drops_total`, `till_expenses_total`, `denominations`, `record_cash_drop`, `record_till_expense`, `close_shift`, and `get_z_report`.
- Frontend has `ProPosBillingTerm.tsx` and `ProPosEodReportVie.tsx`.

## 5. Gap Analysis
- Missing physical denomination input widget for Indian Currency notes and coins.
- Missing drawer cash movement modal for safe drops and till payouts.
- Missing live backend reconciliation on shift closeout.

## 6. Architecture Impact
- Client-side UI components leveraging `apiFetchV1` (`/api/v1/pos/shifts/*`).
- Dual-entry GL balancing vouchers displayed directly upon posting.

## 7. Proposed Design
- Currency denomination matrix: ₹2000, ₹500, ₹200, ₹100, ₹50, ₹20, ₹10, ₹5, ₹2, ₹1, and coins with live subtotal calculation.
- Cash Movements Modal with tabbed modes (Safe Drop vs Petty Expense) with automatic GL postings.
- Shift Closeout Modal with physical count reconciliation, variance explanation, and Z-report printing.

## 8. Files Created
1. `src/components/billing/propos/ProPosDenomination.tsx`
2. `src/components/billing/propos/ProPosCashMovesDlg.tsx`
3. `src/components/billing/propos/ProPosShiftCloseDl.tsx`

## 9. Files Modified
1. `src/components/billing/propos/types.ts`
2. `src/components/billing/propos/ProPosBillingTerm.tsx`
3. `src/components/billing/propos/ProPosWs.tsx`
4. `src/components/billing/propos/ProPosEodReportVie.tsx`
5. `src/components/PosTerminalTab.tsx`
6. `backend/app/api/v1/pos.py`
7. `backend/app/models/pos.py`
8. `backend/app/schemas/pos.py`
9. `backend/app/services/pos.py`
10. `backend/app/services/unified_ledger.py`
11. `backend/alembic/versions/v1346_pos_cash_denominations.py`
12. `backend/tests/t_pos_drawer.py`
13. `backend/tests/conftest.py`

## 10. Dependencies
- React 18, Tailwind CSS, Lucide React, `apiFetchV1`, FastAPI, PostgreSQL, SQLAlchemy Async.

## 11. Risks
- Concurrent cash movements or double closeout: mitigated by PostgreSQL row-level locks (`SELECT FOR UPDATE`), database-level partial unique index `uq_shifts_active_per_register`, and unique idempotency constraint `uq_sct_idempotency`.

## 12. Rollback Strategy
- Revert the created/modified React components and Alembic migration down revision.

## 13. Verification Plan
- `npm run build` static compilation.
- `npm run lint` TypeScript type-checking.
- Pytest backend integration suites: 14 tests in `t_pos_drawer.py`.

## 14. Test Plan
- Run `npm run build` to verify frontend bundling.
- Run `npm run lint` for TypeScript validation.
- Run `pytest backend/tests/t_pos_drawer.py -v`.

## 15. Documentation Impact
- Walkthrough: `docs/walkthrough/foundation/Platform_ProPOS.md`.
- Implementation Plan: `docs/implementation/foundation/Platform_ProPOS.md`.
- Master indexes in `docs/walkthrough/README.md` and `docs/implementation/README.md`.

## 16. Deployment Plan
- Build and bundle with Vite. Deploy to company databases with Alembic migration.

## 17. Status
- Hardened and focused-tested; staging verification pending

## 18. Related ADRs
- ADR-0038: Dual-Entry General Ledger Engine & Posting Pipeline
- ADR-0044: POS Cash Drawer Denomination Audit & Shift Balance Reconciliation

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Platform_2.md`
- `docs/walkthrough/foundation/Platform_ProPOS.md`
