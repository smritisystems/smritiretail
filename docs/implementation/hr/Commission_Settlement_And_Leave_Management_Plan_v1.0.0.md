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

# Implementation Plan: Commission Payout Settlement & Leave Management Integration (v1.0.0)

**Document ID:** IP-HR-006  
**Area:** HR & Workforce Management  
**Status:** In Progress  
**Target Version:** 6.70.36  

---

## 1. Objective
Deliver the authoritative commission payout settlement engine (`POST /api/v1/staff/commissions/settle`) and full leave balance & request lifecycle integration into the Attendance & Workforce Studio (`EmployeeAttendanceModal.tsx`), backed directly by PostgreSQL `commission_ledgers`, `leave_balances`, and `leave_requests`.

## 2. Business Motivation
In retail multi-store operations, sales commissions accrued during checkout must be periodically disbursed (monthly, fortnightly, or shift-end) without mutating historical audit trails. Concurrently, employee leave balances (CL, SL, EL) must be visible and manageable within the central employee console to ensure transparent payroll calculations and leave deduction tracking.

## 3. Scope
1. **Commission Settlement Endpoint (`POST /api/v1/staff/commissions/settle`)**:
   - Computes current unsettled commission balance from PostgreSQL `commission_ledgers`.
   - Records an immutable balancing `PAID` row with offsetting negative commission amount, payment mode, and reference ID.
   - Enforces RBAC permissions (`SYSADMIN`, `MANAGER`).
2. **Leave Balance Auto-Provisioning & Integration (`GET /api/v1/staff/leave/balances`)**:
   - Auto-provisions statutory default retail leave entitlements (12 CL, 12 SL, 15 EL) for the active year if uninitialized.
3. **Frontend Studio Modal Enhancements (`EmployeeAttendanceModal.tsx`)**:
   - Adds `LEAVE` tab with leave balance cards (entitled, used, pending), leave request history, and interactive `[+ Request Leave]` action.
   - Adds `[💸 Settle & Disburse Commission]` action in `COMMISSION` tab with payment mode selection and live balance clearing.
   - Wires live PostgreSQL attendance & commission metrics into the `PAYOUT` tab.
4. **Automated Verification**:
   - Pytest suite `t_staff_settlement_leave_verify.py` and Vitest suite `employeeAttendanceStudio.test.ts`.

## 4. Current State
- `POST /attendance/punch` and `POST /attendance/device-push` track shift attendance.
- `write_commission_accrual()` and `write_commission_reversal()` post `EARNED` and `REVERSED` rows to `commission_ledgers`.
- `GET /staff/commissions/summary` aggregates ledger balances and returns transaction audit rows.
- No settlement/disbursement endpoint exists to close out accrued commission balances.
- `leave_balances` and `leave_requests` tables exist in PostgreSQL but are unwired to the studio modal.

## 5. Gap Analysis
| Feature | Prior State | Target State |
|---|---|---|
| Commission Payout / Settlement | None — balances accumulate indefinitely | `POST /staff/commissions/settle` posts immutable `PAID` entries |
| Leave Balances in Modal | No leave view in Attendance Studio | Dedicated `LEAVE` tab displaying CL/SL/EL balances |
| Leave Balance Auto-Provisioning | Manual database insert required | Auto-seeds default statutory balances on first read |
| Payout Tab Data Binding | Static mock numbers | Driven by PostgreSQL attendance days and commission balances |

## 6. Architecture Impact
- Enforces SMRITI Statutory Immutability Doctrine: historical `EARNED` and `REVERSED` rows are never updated; disbursements are recorded via append-only `PAID` transactions.
- Zero database migrations needed; utilizes existing PostgreSQL tables `commission_ledgers`, `leave_balances`, and `leave_requests`.

## 7. Proposed Design
```text
[EmployeeAttendanceModal.tsx]
   │
   ├── [COMMISSION Tab] ──> POST /api/v1/staff/commissions/settle
   │                            │
   │                            ▼
   │                    [commission_ledgers]
   │                    (Append PAID row: amount = -balance, mode = CASH/BANK)
   │
   ├── [LEAVE Tab] ──────> GET /api/v1/staff/leave/balances
   │                            │ (Auto-provisions CL/SL/EL if empty)
   │                            ▼
   │                    [leave_balances]
   │
   └── [PAYOUT Tab] ─────> Computes Base Salary * (Present / Working) + Net Accrued Commission
```

## 8. Files Created
- `backend/app/tests/t_staff_settlement_leave_verify.py`
- `docs/implementation/hr/Commission_Settlement_And_Leave_Management_Plan_v1.0.0.md`
- `docs/walkthrough/hr/Commission_Settlement_And_Leave_Management_v1.0.0.md`

## 9. Files Modified
- `backend/app/api/v1/staff.py`
- `src/components/hr/EmployeeAttendanceModal.tsx`
- `src/tests/employeeAttendanceStudio.test.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- FastAPI, SQLAlchemy, PostgreSQL `commission_ledgers`, `leave_balances`, `leave_requests`.
- React 18, Lucide React icons, Tailwind CSS.

## 11. Risks
- Risk: Concurrent settlement requests could create duplicate `PAID` rows.  
  Mitigation: Re-calculate unsettled balance inside the transactional lock before appending the `PAID` ledger entry.

## 12. Rollback Strategy
Revert Git commit; no database schema alterations or migrations are performed.

## 13. Verification Plan
1. Backend Pytest: Verify `POST /staff/commissions/settle` inserts `PAID` row, reduces unsettled balance to 0, and rejects settling <= 0 balances.
2. Backend Pytest: Verify `GET /staff/leave/balances` auto-seeds default balances if empty.
3. Frontend Vitest: Verify settlement payload and leave balance contract rendering.
4. TypeScript: Run `npx tsc --noEmit` ensuring zero type errors.

## 14. Test Plan
- `backend/app/tests/t_staff_settlement_leave_verify.py`: 2 tests covering commission settlement and leave balance provisioning.
- `src/tests/employeeAttendanceStudio.test.ts`: Extended tests covering settlement and leave data contracts.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create `docs/walkthrough/hr/Commission_Settlement_And_Leave_Management_v1.0.0.md`.
- Update `docs/walkthrough/README.md`.
- Prepend `CHANGELOG.md` with version `[6.70.36]`.

## 16. Deployment Plan
Commit and push to `smritiNX` on GitHub.

## 17. Status
In Progress.

## 18. Related ADRs
- ADR-0023: Canonical System of Record Hierarchy (FastAPI + PostgreSQL).
- ADR-0038: Statutory Immutability Doctrine for Transactional Ledgers.

## 19. Related Walkthroughs
- `docs/walkthrough/hr/Realtime_Commission_And_Attendance_Summary_v1.0.0.md`
- `docs/walkthrough/hr/POS_Realtime_Commission_Accrual_And_Reversal_v1.0.0.md`
