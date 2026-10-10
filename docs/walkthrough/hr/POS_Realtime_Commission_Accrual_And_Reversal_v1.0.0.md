<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.34
  Created      : 2026-10-08
  Modified     : 2026-10-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: POS Real-Time Sales Commission Accrual & Return Reversal (v1.0.0)

## 1. Purpose
This document details the engineering and verification of the Real-Time POS Sales Commission Accrual and Credit Note Reversal (Clawback) Engine for SMRITI Retail OS. It bridges POS billing transactions directly with the authoritative PostgreSQL `commission_ledgers` ledger, guaranteeing that salesperson incentives are accrued immediately upon invoice checkout and proportionally clawed back upon sales returns without requiring manual batch payroll runs.

## 2. Scope
- **Backend Hooks (`backend/app/services/sales_hook.py`)**:
  - `write_commission_accrual()`: Real-time transactional accrual hook for sales invoices. Resolves or auto-provisions `commission_participants`, evaluates active `commission_rules` (or standard fallback), and inserts `EARNED` ledger entries.
  - `write_commission_reversal()`: Real-time transactional clawback hook for credit notes / sales returns. Fetches original invoice `EARNED` ledger rows, calculates proportional refund ratios, and inserts offsetting `REVERSED` entries.
- **Posting Pipeline Integration**:
  - `CanonicalSalesPostingWriter.post_sales_invoice` (`backend/app/services/canonical_sales_writer.py`): Invokes accrual hook atomically before database commit.
  - `SalesService.create_sales_return` (`backend/app/services/sales.py`): Invokes reversal hook atomically before database commit.
- **Verification Harness**:
  - Author automated test suite `backend/app/tests/t_sales_commission_hook_verify.py` validating accrual, idempotency, rule overrides, and proportional clawbacks.

## 3. Files Created
- `docs/implementation/hr/POS_Realtime_Commission_Accrual_And_Reversal_Plan_v1.0.0.md` (Implementation Plan IP-HR-004)
- `backend/app/tests/t_sales_commission_hook_verify.py` (Pytest test suite)
- `docs/walkthrough/hr/POS_Realtime_Commission_Accrual_And_Reversal_v1.0.0.md` (This walkthrough document)

## 4. Files Modified
- `backend/app/services/sales_hook.py`: Added `write_commission_accrual` and `write_commission_reversal` async hooks.
- `backend/app/services/canonical_sales_writer.py`: Integrated `write_commission_accrual` hook into Step 12b of checkout pipeline.
- `backend/app/services/sales.py`: Integrated `write_commission_reversal` hook into `create_sales_return` pipeline.
- `docs/implementation/README.md`: Appended IP-HR-004 entry to Master Index.
- `docs/walkthrough/README.md`: Appended WGP entry to Master Index.
- `CHANGELOG.md`: Appended release notes for v6.70.34.

## 5. Architecture Decisions
1. **Direct System-of-Record Integration**: Instead of maintaining separate in-memory caches or deferred batch scripts, transactions directly populate PostgreSQL `commission_ledgers` with `transaction_type` set to `EARNED` or `REVERSED`.
2. **Transaction Ownership Separation**: The commission hooks DO NOT commit the session (`db.commit()`). The top-level transaction boundary (`CanonicalSalesPostingWriter` or `SalesService`) controls the commit/rollback, ensuring atomicity across invoice creation, ledger generation, inventory movements, and commission accruals.
3. **Dynamic Participant Auto-Provisioning**: Sales staff registered in POS as Cashiers/Users may not have pre-configured `CommissionParticipant` records. The hook resolves the user and automatically provisions a matching participant row with role `SALESPERSON`, preventing foreign key constraint failures.
4. **Proportional Reversal Logic**: On partial returns (e.g. returning 1 out of 5 items), the clawback ratio is computed as `return_total / orig_grand_total`. The commission amount reversed is `-round(orig_comm * ratio, 2)`.

## 6. Design Rationale
In high-volume retail stores, staff commission transparency is vital for employee retention and trust. Without real-time accruals, staff cannot see their shift earnings until month-end batch calculations. Furthermore, without automated clawbacks on customer returns, stores face leakage from commission overpayment on returned items. Real-time ledger recording solves both operational challenges with zero administrative friction.

## 7. Implementation Summary
- **Commission Accrual Execution Flow**:
  1. Cashier checks out sales invoice via POS terminal.
  2. `CanonicalSalesPostingWriter.post_sales_invoice` validates totals and writes lines.
  3. Hook aggregates line-level `salesperson_id` or header `cashier_id`.
  4. Participant is resolved/created in `commission_participants`.
  5. Idempotency is verified against `commission_ledgers` (`transaction_type = 'EARNED'`).
  6. Rate is determined from active `commission_rules` (percentage, fixed amount, or 2% fallback).
  7. Row inserted into `commission_ledgers` with positive `commission_amount`.
- **Commission Reversal Execution Flow**:
  1. Return / Credit Note is created referencing original invoice.
  2. `SalesService.create_sales_return` processes returned inventory lines.
  3. Hook queries original `EARNED` rows from `commission_ledgers`.
  4. Idempotency is verified against `reference_return_id`.
  5. Ratio computed: `min(1.0, return_total / orig_grand_total)`.
  6. Offsetting row inserted with negative `commission_amount` and negative `gross_sales_amount`.

## 8. Tests Executed
```bash
pytest backend/app/tests/t_sales_commission_hook_verify.py -v
pytest backend/app/tests/t_staff_punch_verify.py -v
npx vitest run src/tests/employeeAttendanceStudio.test.ts
npx tsc --noEmit
```

## 9. Verification Results
- `t_sales_commission_hook_verify.py`: 3/3 passed (Accrual, Reversal, Active Rule Override).
- `t_staff_punch_verify.py`: 2/2 passed (Punch Lifecycle & Biometric Device Push).
- Vitest suite `src/tests/employeeAttendanceStudio.test.ts`: 6/6 passed.
- TypeScript AST: `tsc --noEmit` exited code 0 with 0 errors.

## 10. Known Limitations
- Tiered slab rules based on monthly cumulative volume (e.g., >₹100,000 sales gives 3% instead of 2%) require a periodic recalculation or month-end true-up job.

## 11. Future Work
- Add Staff Commission Summary card in `EmployeeAttendanceModal.tsx` displaying daily shift commission earnings.
- Expose `/api/v1/staff/commissions/statement` for mobile staff self-service portal.

## 12. Related ADRs
- `ADR-001`: FastAPI + PostgreSQL Sole Backend System of Record.
- `ADR-HR-001`: HR Domain Registration and Directory Consolidation.

## 13. Related RFCs
- `RFC-124`: HR Commission Programme, Target Setting Process, and Attendance Governance.
