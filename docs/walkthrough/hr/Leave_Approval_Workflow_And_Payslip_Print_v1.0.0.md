<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.37
  Created      : 2026-10-08
  Modified     : 2026-10-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# HR & Workforce: Leave Approval Workflow, Atomic Balance Deduction & Printable Salary Slip Walkthrough (v1.0.0)

## 1. Purpose
This walkthrough documents the design, implementation, and automated test certification for Phase 5 of the SMRITI Retail OS Workforce Management Architecture:
1. Atomic statutory leave balance deductions (`used_days` increment and `pending_days` decrement) executed automatically upon manager approval via `PATCH /api/v1/staff/leave/requests/{request_id}/decision`.
2. Interactive 1-click decision actions (`[✓ Approve]` / `[✕ Reject]`) for pending leave applications directly inside `EmployeeAttendanceModal.tsx` under the `LEAVE` tab.
3. Executive Printable Salary Slip modal (`[🖨 Print Salary Slip]`) with print-optimized CSS (`@media print`), attendance metrics, sales commissions, loss of pay (LOP) deductions, net remuneration callout, and authorized verification seals.

## 2. Scope
- **Backend API**:
  - `backend/app/api/v1/staff.py` (v6.70.37):
    - Real-time `pending_days` reservation in `create_leave_request`.
    - Atomic statutory balance deduction (`used_days += total_days`, `pending_days -= total_days`) in `decide_leave_request` upon approval.
    - Quota hold release on rejection.
- **Frontend Studio**:
  - `src/components/hr/EmployeeAttendanceModal.tsx` (v3.121.6):
    - Inline Approve & Reject buttons in Leave History table.
    - Full-screen printable Salary Voucher modal with isolated `@media print` styling.
- **Test Automation**:
  - Pytest: `backend/app/tests/t_leave_decision_balance_verify.py` (2 test cases).
  - Vitest: `src/tests/employeeAttendanceStudio.test.ts` (12 test cases).

## 3. Files Created
- `docs/implementation/hr/Leave_Approval_Workflow_And_Payslip_Print_Plan_v1.0.0.md`
- `backend/app/tests/t_leave_decision_balance_verify.py`
- `docs/walkthrough/hr/Leave_Approval_Workflow_And_Payslip_Print_v1.0.0.md`

## 4. Files Modified
- `backend/app/api/v1/staff.py`
- `src/components/hr/EmployeeAttendanceModal.tsx`
- `src/tests/employeeAttendanceStudio.test.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
- **ACID Balance Updates in Leave Approval**: Rather than re-aggregating historical leave requests every time an inquiry occurs, the statutory ledger row `LeaveBalance` is maintained in real-time as an authoritative state cache protected by unique constraints `(company_id, user_id, leave_year, leave_type)`.
- **Zero Dark-Mode Artifacts on Printing**: The salary voucher modal employs scoped `@media print` rules where `body * { visibility: hidden !important; }` and `#printable-salary-slip { visibility: visible !important; position: fixed; width: 100%; height: 100%; }`. This ensures clean A4 thermal or laser printing without requiring third-party PDF server rendering libraries.

## 6. Design Rationale
- Floor managers need rapid, 1-click approvals right from the attendance console without navigating through separate administrative sub-menus.
- Retail employees frequently request physical salary vouchers for bank loan verifications and income proof; standardizing the payslip layout inside the attendance modal satisfies compliance and operational demands.

## 7. Implementation Summary
- **Backend (`staff.py`)**:
  - `create_leave_request`: Increments `lb.pending_days` or provisions default statutory quota with `pending_days = total_days`.
  - `decide_leave_request`: Validates manager role; updates `LeaveRequest.status = APPROVED`; increments `lb.used_days += request.total_days`; reduces `lb.pending_days`. On rejection, decrements `lb.pending_days`.
- **Frontend (`EmployeeAttendanceModal.tsx`)**:
  - Added `decisionLoading` state preventing duplicate submissions.
  - Added `[✓ Approve]` and `[✕ Reject]` action buttons for pending records.
  - Added `showPayslipModal` toggle and printable modal layout featuring:
    - SMRITI Retail OS organizational header and GSTIN.
    - Employee identification and compensation structure.
    - Shift breakdown (Working days, Present shifts, Late arrivals, LOP days, Hours worked).
    - Side-by-side Earnings and Deductions table.
    - Bold Net Pay banner.
    - Employee and Authorized Signatory lines.

## 8. Tests Executed
1. **Pytest (`t_leave_decision_balance_verify.py`)**:
   - `test_leave_approval_atomic_balance_deduction`: Full lifecycle from submission -> pending reservation -> manager approval -> balance deduction -> second submission -> manager rejection -> hold release.
   - `test_non_manager_cannot_decide_leave`: Asserts HTTP 403 Forbidden when a cashier role attempts to approve leave.
2. **Vitest (`employeeAttendanceStudio.test.ts`)**:
   - 12 comprehensive unit tests covering payload normalization, incentive calculation, shift state transitions, punch actions, commission ledger mappings, leave balances, leave decision state transitions, and printable payslip voucher math.

## 9. Verification Results
- Pytest: `2 passed, 19 warnings in 46.82s`.
- Vitest: `12 passed in 486ms`.
- TypeScript Compiler: `npx tsc --noEmit` exited code 0 (0 errors).
- Python Compiler: `python -m py_compile` clean.

## 10. Known Limitations
- Direct bank batch NEFT/RTGS generation for the net salary is handled via the separate compliance gateway roadmap and is not part of this studio modal.

## 11. Future Work
- Integration with SMS/WhatsApp push notifications to alert employees when leave is approved or when monthly payslips are issued.

## 12. Related ADRs
- `ADR-008`: Canonical PostgreSQL System-of-Record Supremacy.
- `ADR-012`: Statutory Leave Provisioning & Double-Entry Ledger Doctrine.

## 13. Related RFCs
- `RFC-2026-HR05`: Real-Time Retail Workforce Leave Lifecycle & Payslip Specification.
