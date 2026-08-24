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

# Walkthrough: Vertical Slice 15 — Frontend ProPOS Cashier Physical Denominations, Cash Movements & Shift Closeout UI

## 1. Purpose
This walkthrough documents the frontend delivery for Vertical Slice 15 in SMRITI Retail OS. It provides an intuitive, high-speed cashier user interface for Indian Currency physical denomination breakdown counting, mid-shift cash drops (safe transfers), till petty expense disbursals, and day-end shift closeout reconciliation with automated dual-entry General Ledger balancing.

## 2. Scope
- Physical cash denomination counter component with live row multiplier calculations and live variance tracking against system expected cash.
- Mid-shift drawer action modal (`ProPosCashMovesDlg.tsx`) supporting Safe Transfers and Till Expense Disbursals with real-time double-entry GL voucher posting.
- Shift closeout modal (`ProPosShiftCloseDl.tsx`) with physical denomination reconciliation, non-cash tender settlements, and automated shortage/overage GL balancing.
- Upgraded EOD Z-Report view (`ProPosEodReportVie.tsx`) connecting directly to FastAPI + Postgres `/api/v1/pos/shifts/` endpoints.
- Integration into ProPOS billing terminal (`ProPosBillingTerm.tsx`) and workspace (`ProPosWs.tsx`) with hotkeys (`Alt+D`, `Alt+Z`, `Escape`).

## 3. Files Created
1. `src/components/billing/propos/ProPosDenomination.tsx`: Reusable physical denomination entry matrix for Indian currency notes (₹2000, ₹500, ₹200, ₹100, ₹50, ₹20, ₹10, ₹5, ₹2, ₹1) and coins with live subtotal and variance calculator.
2. `src/components/billing/propos/ProPosCashMovesDlg.tsx`: Drawer action modal for cashier safe cash drops and till petty expenses.
3. `src/components/billing/propos/ProPosShiftCloseDl.tsx`: Cashier shift closeout modal with live denomination reconciliation and balancing GL voucher generation.

## 4. Files Modified
1. `src/components/billing/propos/types.ts`: Added `CashDenominations`, `ShiftCashMovementRecord`, `ShiftCashDropPayload`, `ShiftTillExpensePayload`, and `POSZReportData` interfaces.
2. `src/components/billing/propos/ProPosBillingTerm.tsx`: Integrated drawer movements and shift closeout modals, added top toolbar buttons, and wired `Alt+D` / `Alt+Z` hotkeys.
3. `src/components/billing/propos/ProPosWs.tsx`: Updated header metadata and version badge to v6.16.
4. `src/components/billing/propos/ProPosEodReportVie.tsx`: Connected to backend `/pos/shifts/` APIs, integrated denomination input component, and rendered cash movements history table.
5. `src/components/PosTerminalTab.tsx`: Updated metadata to v6.16.0.
6. `backend/app/api/v1/pos.py`: Added contract route alias `/pos/shifts/active/{register_id}`.

## 5. Architecture Decisions
- **Real-Time Client-Side Denomination Computation**: Cash denomination counts are computed dynamically in `SmritiProPosDenominationInput` to provide sub-millisecond feedback while cashiers physically count cash bundles.
- **Contract URL Alignment**: API requests use canonical `/api/v1/pos/shifts/*` endpoints via `src/lib/apiFetchV1.ts`.
- **Stateless Balancing GL Voucher Confirmation**: When a cash drop, till expense, or shift variance is finalized, the returned General Ledger Journal Voucher ID is surfaced to the cashier.

## 6. Design Rationale
- **Color-Coded Currency Notes**: Each denomination row in `SmritiProPosDenominationInput` features recognizable Indian currency accent colors (e.g., magenta for ₹2000, olive for ₹500, orange for ₹200, purple for ₹100, cyan for ₹50, green for ₹20, brown for ₹10) allowing swift visual verification during rush hours.
- **Immediate Variance Detection**: Variance badges dynamically switch from green (`Balanced`) to amber (`Overage`) or red (`Shortage`), prompting cashier explanations.

## 7. Implementation Summary
- Connected ProPOS billing interface to backend endpoints:
  - `POST /api/v1/pos/shifts/{shift_id}/cash-in`
  - `POST /api/v1/pos/shifts/{shift_id}/cash-drop`
  - `POST /api/v1/pos/shifts/{shift_id}/till-expense`
  - `POST /api/v1/pos/shifts/close/{shift_id}`
  - `GET /api/v1/pos/shifts/{shift_id}/z-report`
- Cashier can press `Alt+D` anytime during a shift to inject float, transfer cash to safe, or disburse petty cash.
- Cashier can press `Alt+Z` or click "Shift Close" to count denominations and finalize register closeout.

## 8. Tests Executed
1. `npm run build`: Vite production bundle build transformed 3,482 modules in 32.56s with 0 errors.
2. `npm run lint`: `tsc --noEmit` passed with 0 errors.
3. `pytest backend/tests/t_pos_drawer.py -v`: 14/14 tests passed in 32.03s:
   - `test_physical_cash_denominations_calculation_and_closing` PASSED
   - `test_mid_shift_cash_drop_to_bank_safe` PASSED
   - `test_mid_shift_till_expense_payout` PASSED
   - `test_combined_cash_movements_and_closing_shortage_gl_balancing` PASSED
   - `test_api_pos_cash_drop_and_till_expense_endpoints` PASSED
   - `test_ephemeral_clean_database_cash_movements_verification` PASSED
   - `test_cash_in_movement_end_to_end_and_gl_posting` PASSED
   - `test_cash_drop_and_till_expense_insufficient_cash_rejection` PASSED
   - `test_cash_movement_and_close_idempotency_deduplication` PASSED
   - `test_invalid_source_and_expense_account_rejection` PASSED
   - `test_api_pos_company_db_and_permissions_enforcement` PASSED
   - `test_database_level_one_open_shift_unique_constraint_rejection` PASSED
   - `test_database_level_idempotency_unique_constraint_enforcement` PASSED
   - `test_pos_checkout_versus_closed_shift_concurrency_lock` PASSED

## 9. Verification Results
- All unit, integration, and ephemeral database test suites pass with zero failures.
- PostgreSQL partial unique index `uq_shifts_active_per_register` guarantees single OPEN shift per register.
- PostgreSQL unique index `uq_sct_idempotency` guarantees unique client idempotency deduplication.
- Multi-tenant company database session dependency `get_company_db` is fully enforced on all operational routes.
- Frontend build and TypeScript compiler check succeed cleanly.

## 10. Known Limitations
- Hardware cash drawer kickout pulse via ESC/POS raw printer sequences is handled by native/electron print spoolers; browser interface triggers software drawer tracking.

## 11. Future Work
- Offline IndexedDB caching queue for mid-shift cash movements during internet connectivity drops.

## 12. Related ADRs
- ADR-0038: Dual-Entry General Ledger Engine & Posting Pipeline
- ADR-0044: POS Cash Drawer Denomination Audit & Shift Balance Reconciliation

## 13. Related RFCs
- RFC-2026-07-001: Strangler-Fig Backend Consolidation to FastAPI & PostgreSQL

