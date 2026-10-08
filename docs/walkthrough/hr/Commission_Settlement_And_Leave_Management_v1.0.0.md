<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-08
  Modified     : 2026-10-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Commission Payout Settlement & Leave Management Integration (v1.0.0)

**Document ID:** WT-HR-006  
**Area:** HR & Workforce Management  
**Release Target:** v6.70.36  
**Related Plan:** [Commission_Settlement_And_Leave_Management_Plan_v1.0.0.md](../../implementation/hr/Commission_Settlement_And_Leave_Management_Plan_v1.0.0.md)  

---

## 1. Purpose
This walkthrough documents the delivery of the authoritative Commission Payout Settlement Engine (`POST /api/v1/staff/commissions/settle`) and full Statutory Leave Balance & Request Lifecycle Integration into the Attendance & Workforce Studio modal (`EmployeeAttendanceModal.tsx`), backed directly by PostgreSQL tables `commission_ledgers`, `leave_balances`, and `leave_requests`.

---

## 2. Scope
- Implemented `POST /api/v1/staff/commissions/settle` supporting partial or full disbursement of accrued commissions across cash, bank transfer, UPI, and payroll channels.
- Enforced SMRITI Statutory Immutability Doctrine: preserves historical `EARNED` and `REVERSED` rows and appends offsetting, immutable balancing `PAID` transactions.
- Automated statutory retail leave entitlement provisioning (12 Casual Leaves `CL`, 12 Sick Leaves `SL`, 15 Earned Leaves `EL`) in `GET /api/v1/staff/leave/balances` when uninitialized for a staff member.
- Upgraded `EmployeeAttendanceModal.tsx` (v3.121.5):
  - Added dedicated `LEAVE` tab with statutory entitlement cards, live available days, application form drawer, and leave history.
  - Added interactive `[💸 Settle & Disburse Commission]` modal console in the `COMMISSION` tab.
  - Connected live PostgreSQL attendance and commission totals to dynamic monthly payout calculations in the `PAYOUT` tab.
- Automated verification via Pytest (`t_staff_settlement_leave_verify.py`), Vitest (`employeeAttendanceStudio.test.ts`), and TypeScript compiler (`tsc --noEmit`).

---

## 3. Files Created
1. `backend/app/tests/t_staff_settlement_leave_verify.py` — Automated Pytest verification for commission settlement math and leave balance provisioning.
2. `docs/implementation/hr/Commission_Settlement_And_Leave_Management_Plan_v1.0.0.md` — Formal 19-section implementation plan (IP-HR-006).
3. `docs/walkthrough/hr/Commission_Settlement_And_Leave_Management_v1.0.0.md` — Formal 13-section walkthrough document (WT-HR-006).

---

## 4. Files Modified
1. `backend/app/api/v1/staff.py` — Added `CommissionSettleRequest`, `POST /commissions/settle`, updated summary with `paid_commission` and `unsettled_commission`, and added leave balance auto-seeding. Bumped to v6.70.36.
2. `src/components/hr/EmployeeAttendanceModal.tsx` — Added `LEAVE` tab, commission payout drawer/modal, `PAID` transaction pill, and live payout calculations. Bumped to v3.121.5.
3. `src/tests/employeeAttendanceStudio.test.ts` — Added unit test coverage for commission settlement and leave balance contracts (10/10 tests green).
4. `docs/implementation/README.md` — Appended IP-HR-006 to master implementation index.
5. `docs/walkthrough/README.md` — Appended WT-HR-006 to master walkthrough index.
6. `CHANGELOG.md` — Added release notes for `[6.70.36]`.

---

## 5. Architecture Decisions
1. **Append-Only Double-Entry Balancing (`PAID` Type):**  
   Rather than updating or mutating historical `EARNED` or `REVERSED` transaction records when commissions are disbursed, the system appends a balancing `PAID` row with a negative amount (`-disburse_amount`). This ensures full audit parity and historical tamper-evidence.
2. **Deterministic Unsettled Balance Math:**  
   The current unsettled commission balance is derived as the exact algebraic sum of all active entries (`sum(commission_amount)`) for the participant in PostgreSQL.
3. **Statutory Leave Auto-Provisioning:**  
   First-read access to `/staff/leave/balances` for an active employee auto-provisions standard statutory leave categories (CL: 12, SL: 12, EL: 15) for the active year, preventing uninitialized profile errors in retail store operations.

---

## 6. Design Rationale
Cashiers and sales associates often request mid-month advances or shift payouts for incentive earnings. Providing an explicit disbursement workflow with reference number tracking (`PAYOUT-YYYYMMDD-XXXXXX`) and multi-channel categorization eliminates off-book cash discrepancies between store managers and floor personnel.

---

## 7. Implementation Summary
- **Backend Endpoint (`POST /api/v1/staff/commissions/settle`):**  
  Restricted to `MANAGER` and `SYSADMIN` roles. Resolves `participant_id`, queries `commission_ledgers` for net unsettled balance, validates that amount does not exceed accrued balance, and inserts an immutable `PAID` entry.
- **Frontend UI Integration (`EmployeeAttendanceModal.tsx`):**  
  Added a 4-tab console (`ATTENDANCE | COMMISSION | LEAVE | PAYOUT`). Displays unsettled vs net accrued balances, renders a payout confirmation popover, provides statutory leave balance breakdowns, and renders an interactive leave application form.

---

## 8. Tests Executed
1. **Pytest (`backend/app/tests/t_staff_settlement_leave_verify.py`):**
   - `test_commission_settlement_disbursement`: Verified partial disbursement, ledger reflection, full settlement, and 422 rejection on zero balance.
   - `test_leave_balances_auto_provision_and_request`: Verified automatic provisioning of 3 statutory leave categories and submitting a leave request.
   - Result: 2/2 passed in 47.33s.
2. **Vitest (`src/tests/employeeAttendanceStudio.test.ts`):**
   - 10 unit tests executed covering punch types, biometric push, ledger mapping, settlement contract, and leave balances.
   - Result: 10/10 passed in 463ms.
3. **TypeScript Compiler (`npx tsc --noEmit`):**
   - Result: Exited code 0 (0 errors).
4. **Python Syntax Validator (`python -m py_compile`):**
   - Result: Exited code 0 (0 errors).

---

## 9. Verification Results
- All unit, integration, and typecheck verification suites passed with zero regressions.
- Net commission ledgers balance to ₹0.00 following complete payout execution.

---

## 10. Known Limitations
- Partial shift deductions for late punches (>15 min) are calculated proportionally and do not yet automatically trigger formal disciplinary incident logs.

---

## 11. Future Work
- Integrate biometric face recognition and RFID card scanning protocols into the hardware push webhook.
- Add manager 1-click leave approval/rejection buttons directly inside the Studio modal table.

---

## 12. Related ADRs
- ADR-0023: Canonical System of Record Hierarchy (FastAPI + PostgreSQL).
- ADR-0038: Statutory Immutability Doctrine for Transactional Ledgers.

---

## 13. Related RFCs
- RFC-HR-004: Universal Retail Workforce Scheduling and Commission Accounting.
