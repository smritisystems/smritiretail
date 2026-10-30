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

# HR & Workforce: Leave Approval Workflow, Atomic Balance Deduction & Printable Salary Slip Plan (v1.0.0)

## 1. Objective
To complete Phase 5 of the SMRITI Retail OS Workforce Management Architecture by:
1. Automating atomic statutory leave balance deductions (`used_days` increment and `pending_days` decrement) upon manager approval via `PATCH /api/v1/staff/leave/requests/{request_id}/decision`.
2. Providing real-time 1-click leave decision actions (`[✓ Approve]` / `[✕ Reject]`) inside `EmployeeAttendanceModal.tsx` under the `LEAVE` tab.
3. Introducing an executive, audit-compliant Printable Salary Slip modal (`[🖨 Print Salary Slip]`) inside the `PAYOUT` tab with clean `@media print` CSS, itemized earnings, loss of pay (LOP) deductions, commission accruals, and organizational authentication seals.

## 2. Business Motivation
In retail chain operations, pending leave applications must directly impact available statutory leave quotas (Casual Leave CL, Sick Leave SL, Earned Leave EL) upon store manager or floor supervisor sign-off. When leave is rejected, reservation holds must be released immediately. Furthermore, retail branch staff require physical, authenticated salary vouchers / payslips for income verification, banking, and payroll audit purposes that reflect actual biometric attendance, LOP calculations, and performance commissions.

## 3. Scope
- **In-Scope**:
  - Backend `PATCH /api/v1/staff/leave/requests/{request_id}/decision` atomic deduction logic on `LeaveBalance` table.
  - Backend `POST /api/v1/staff/leave/requests` real-time `pending_days` reservation.
  - UI interactive decision buttons (`[✓ Approve]`, `[✕ Reject]`) in `EmployeeAttendanceModal.tsx` for pending requests.
  - UI Printable Salary Slip modal with `@media print` styling, company header, employee metadata, working days breakdown, earnings breakdown, and authorized signature blocks.
  - Pytest regression suite (`t_leave_decision_balance_verify.py`) and Vitest test suite (`employeeAttendanceStudio.test.ts`).
  - System version bump to `6.70.37` (backend) and `3.121.6` (UI modal).
- **Out-of-Scope**:
  - Direct integration with third-party automated bank payout APIs (covered under separate banking gateway roadmap).

## 4. Current State
- `LeaveRequest` records are created and can be updated to `APPROVED` / `REJECTED`, but the `LeaveBalance` rows (`used_days` and `pending_days`) were previously not updated automatically on decision.
- In `EmployeeAttendanceModal.tsx`, leave requests are listed in read-only format without direct manager action buttons.
- The `PAYOUT` tab computes earned salary and LOP dynamically, but lacks a physical print voucher / PDF format.

## 5. Gap Analysis
| Functional Area | Current Architecture | Target Architecture |
|---|---|---|
| **Leave Approval** | Decision marks `status = APPROVED` without altering `LeaveBalance` | Atomically updates `used_days += total_days` and decrements `pending_days` in PostgreSQL transaction |
| **Leave Rejection** | Rejection leaves `pending_days` unadjusted | Rejection atomically releases `pending_days` back to unreserved quota |
| **Manager Leave Action** | Requires manual external API call or database modification | 1-click inline `[✓ Approve]` / `[✕ Reject]` buttons in `LEAVE` tab |
| **Payslip Generation** | Screen-only KPI tiles in `PAYOUT` tab | Dedicated Printable Salary Slip modal with A4 print layout, dual signatures, and compliance seal |

## 6. Architecture Impact
- **Database Immutability**: All leave modifications adhere to PostgreSQL ACID transactions on `leave_balances` with unique constraint enforcement on `(company_id, user_id, leave_year, leave_type)`.
- **Statutory Parity**: Automatically ensures that statutory leave entitlements remain consistent with payroll calculations.

## 7. Proposed Design
1. **Backend Decision Logic**:
   - Query `LeaveBalance` for `(tenant.company_id, request.user_id, request.start_date.year, request.leave_type)`.
   - If missing, auto-provision default statutory entitlement.
   - On `APPROVED`: `used_days += request.total_days`, `pending_days = max(0, pending_days - request.total_days)`.
   - On `REJECTED`: `pending_days = max(0, pending_days - request.total_days)`.
2. **Frontend Decision Actions**:
   - Render contextual action buttons in `Leave Requests History` table for items with `status === "PENDING"`.
   - Re-fetch leave balances and requests after successful decision.
3. **Printable Salary Slip Component**:
   - Render dedicated modal with voucher frame, header details (Branch, Employee ID, Designation, Pay Period), attendance grid (Logged days, Present shifts, Late arrivals, LOP days), detailed earnings & deductions, net pay in bold INR, and dual signature blocks.
   - Inject `@media print` CSS so `window.print()` isolates the salary voucher.

## 8. Files Created
- `docs/implementation/hr/Leave_Approval_Workflow_And_Payslip_Print_Plan_v1.0.0.md` (This document)
- `backend/app/tests/t_leave_decision_balance_verify.py`
- `docs/walkthrough/hr/Leave_Approval_Workflow_And_Payslip_Print_v1.0.0.md`

## 9. Files Modified
- `backend/app/api/v1/staff.py`
- `src/components/hr/EmployeeAttendanceModal.tsx`
- `src/tests/employeeAttendanceStudio.test.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- FastAPI Core (`backend/app/`)
- PostgreSQL asyncpg session (`get_company_db`)
- React 18 / Lucide Icons / TailwindCSS / Vitest / Pytest

## 11. Risks
- **Concurrency on Leave Balances**: Concurrent leave approvals for the same employee could cause row contention.
  - *Mitigation*: SQLAlchemy transactional commit guarantees consistency; table has unique composite key constraint.

## 12. Rollback Strategy
- Changes are fully isolated in `staff.py` and `EmployeeAttendanceModal.tsx`. Can be reverted via Git checkout without affecting core POS checkout or financial ledger pipelines.

## 13. Verification Plan
- Verify Pytest `t_leave_decision_balance_verify.py` passes 100%.
- Verify Vitest `employeeAttendanceStudio.test.ts` passes 100%.
- Run TypeScript compiler `npx tsc --noEmit` with zero diagnostics.
- Compile Python bytecode `python -m py_compile`.

## 14. Test Plan
- Unit tests: Assert balance deduction upon approval, reservation release on rejection, and unauthorized user rejection.
- Integration tests: Complete lifecycle test from leave request submission -> manager approval -> balance update -> payslip calculation.

## 15. Documentation Impact
- Update `docs/implementation/README.md` master index.
- Create Walkthrough in `docs/walkthrough/hr/`.
- Record version release notes in `CHANGELOG.md`.

## 16. Deployment Plan
- Deploy as part of Sprint 10 / v6.70.37 release to `smritiNX` branch.

## 17. Status
Approved — Ready for Execution.

## 18. Related ADRs
- `ADR-008`: Canonical PostgreSQL System-of-Record Supremacy.
- `ADR-012`: Statutory Leave Provisioning & Double-Entry Ledger Doctrine.

## 19. Related Walkthroughs
- `WT-HR-006`: `Commission_Settlement_And_Leave_Management_v1.0.0.md`
- `WT-HR-007`: `Leave_Approval_Workflow_And_Payslip_Print_v1.0.0.md` (to be generated)
