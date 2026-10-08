<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.35
  Created      : 2026-10-08
  Modified     : 2026-10-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Real-Time Sales Commission & Attendance Summary Engine (v1.0.0)

## 1. Purpose
This document details the engineering and verification of the Real-Time Sales Commission & Attendance Summary Engine for SMRITI Retail OS. It completes the operational feedback loop by exposing authoritative PostgreSQL ledger summaries (`GET /api/v1/staff/commissions/summary` and `GET /api/v1/staff/attendance/summary`) directly into the Attendance Studio (`EmployeeAttendanceModal.tsx`), replacing synthetic/mock estimates with live gross sales, return clawbacks, net commissions, and period shift hours.

## 2. Scope
- **Backend Aggregation API (`backend/app/api/v1/staff.py`)**:
  - `GET /api/v1/staff/commissions/summary`: Aggregates transactions from `commission_ledgers` (filtered by tenant, user/participant, and period), computing gross sales volume, returned sales volume, earned commissions, reversed clawbacks, net commission payable, and recent transaction ledger records.
  - `GET /api/v1/staff/attendance/summary`: Aggregates shift data from `attendance_records` over a period, providing exact counts of present shifts, late punches, half-days, absences, leaves, total hours worked, and average daily hours.
- **Frontend Studio Integration (`src/components/hr/EmployeeAttendanceModal.tsx`)**:
  - Wired live API data fetching for the selected staff member.
  - Commission Tab: Upgraded with live KPIs (Net Sales, Gross Sales, Clawbacks, Tx Count, Net Accrued) and a Live PostgreSQL Transaction Audit Ledger Table displaying invoice/return references, transaction types (`EARNED` / `REVERSED`), amounts, and narrations.
  - Attendance Tab: Added period summary KPI pills (Total Logged, Present Shifts, Late Punches, Total Worked Hours).
- **Automated Verification**:
  - Author Pytest suite `backend/app/tests/t_staff_summary_verify.py` validating both summary endpoints.
  - Extend Vitest suite `src/tests/employeeAttendanceStudio.test.ts` validating contracts and data structures.

## 3. Files Created
- `docs/implementation/hr/Realtime_Commission_And_Attendance_Summary_Plan_v1.0.0.md` (Implementation Plan IP-HR-005)
- `backend/app/tests/t_staff_summary_verify.py` (Pytest test suite)
- `docs/walkthrough/hr/Realtime_Commission_And_Attendance_Summary_v1.0.0.md` (This walkthrough document)

## 4. Files Modified
- `backend/app/api/v1/staff.py`: Added `/commissions/summary` and `/attendance/summary` endpoints; bumped version to 6.70.35.
- `src/components/hr/EmployeeAttendanceModal.tsx`: Integrated live summary fetching, audit ledger table, and attendance KPI pills; bumped version to 3.121.4.
- `src/tests/employeeAttendanceStudio.test.ts`: Added contract and normalization test cases.
- `docs/implementation/README.md`: Appended IP-HR-005 entry to Master Index.
- `docs/walkthrough/README.md`: Appended WGP entry to Master Index.
- `CHANGELOG.md`: Appended release notes for v6.70.35.

## 5. Architecture Decisions
1. **Direct Aggregation on Single System of Record**: Queries compute sums directly on `commission_ledgers` and `attendance_records` in PostgreSQL. No redundant cached tables or in-memory stores are used.
2. **Security & Role-Based Scoping**: Non-manager users can only inspect their own attendance and commission data (`user_id = current_user.id`); managers and system administrators can query any staff member or view company-wide aggregates.
3. **Graceful UI Fallback & Transparency**: If a staff member has not yet accrued commission on the POS, the studio displays a clear informative empty state rather than confusing zero-error prompts.

## 6. Design Rationale
In high-velocity retail stores, commission disputes and attendance ambiguities harm morale. By providing employees and managers with direct transparency into the exact invoice-level ledger entries backing their monthly commission calculations, trust is established, and operational payroll questions are resolved instantly.

## 7. Implementation Summary
- **Backend Commission Aggregation Flow**:
  1. Client sends `GET /api/v1/staff/commissions/summary?period=YYYY-MM&user_id={id}`.
  2. Resolves `participant_id` from `commission_participants`.
  3. Executes single-pass SQL query using `func.coalesce`, `func.sum`, and `case` expressions to compute positive sales vs negative returns and earned commissions vs reversed clawbacks.
  4. Returns computed totals alongside the top 50 chronological ledger line items.
- **Backend Attendance Aggregation Flow**:
  1. Client sends `GET /api/v1/staff/attendance/summary?period=YYYY-MM&user_id={id}`.
  2. Filters `attendance_records` by company, user, and date bounds.
  3. Computes distinct shift statuses and calculates total elapsed hours from `(check_out_at - check_in_at)`.
  4. Returns aggregated statistics and average shift hours per present day.
- **Frontend Studio UI Flow**:
  1. User selects employee in Attendance Studio.
  2. Component fetches both summary endpoints asynchronously.
  3. Real-time metrics replace hardcoded mock figures.
  4. Manager or cashier reviews individual invoice-level commission credits and return reversals in the ledger table.

## 8. Tests Executed
```bash
pytest backend/app/tests/t_staff_summary_verify.py -v
pytest backend/app/tests/t_sales_commission_hook_verify.py -v
pytest backend/app/tests/t_staff_punch_verify.py -v
npx vitest run src/tests/employeeAttendanceStudio.test.ts
npx tsc --noEmit
```

## 9. Verification Results
- `t_staff_summary_verify.py`: 2/2 passed.
- `t_sales_commission_hook_verify.py`: 3/3 passed.
- `t_staff_punch_verify.py`: 2/2 passed.
- Vitest suite `src/tests/employeeAttendanceStudio.test.ts`: 8/8 passed.
- TypeScript AST: `tsc --noEmit` exited code 0 with 0 errors.

## 10. Known Limitations
- Staff who book offline orders through legacy sync channels will see commissions once the sync worker commits the invoice to PostgreSQL.

## 11. Future Work
- Add CSV / Excel Export button on the Commission Ledger history table in `EmployeeAttendanceModal.tsx`.
- Add monthly commission payout approval & disbursement workflow (`POST /api/v1/staff/commissions/settle`).

## 12. Related ADRs
- `ADR-001`: FastAPI + PostgreSQL Sole Backend System of Record.
- `ADR-HR-001`: HR Domain Registration and Directory Consolidation.

## 13. Related RFCs
- `RFC-124`: HR Commission Programme, Target Setting Process, and Attendance Governance.
