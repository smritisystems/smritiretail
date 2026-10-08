<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.121.2
  Created      : 2026-10-08
  Modified     : 2026-10-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Attendance Studio — Full System Audit & Contract Hardening (v1.0.1)

## 1. Objective
Execute a comprehensive forensic audit of Attendance Studio, reconcile boundary contract drift between the React 18 client and FastAPI Core backend, eliminate runtime object-vs-array unhandled exceptions, and establish complete regression test coverage.

## 2. Business Motivation
Accurate employee attendance, punctuality tracking, and commission calculations directly influence retail staff payroll, retention, and store operational readiness. Crashes in the Attendance Studio interface undermine trust and disrupt daily store manager workflows.

## 3. Scope
- Frontend modal component `EmployeeAttendanceModal.tsx` and host workspace `StaffMasterWs.tsx`.
- Backend endpoints `GET /api/v1/staff/attendance`, `GET /api/v1/staff/incentives`, `GET /api/v1/staff/personnel`.
- Calculation and simulation engine `employeeAttendanceEngine.ts`.
- Automated regression suite `employeeAttendanceStudio.test.ts`.
- PostgreSQL tables `attendance_records`, `leave_balances`, `leave_requests`.

## 4. Current State
- `EmployeeAttendanceModal.tsx` was wired in `StaffMasterWs.tsx` with button `#staff-attendance-modal-btn`.
- Backend returns paginated JSON `{ records: [...], total: ... }` for `/staff/attendance` and rule catalog `{ report_id: "STAFF-002", lines: [...] }` for `/staff/incentives`.
- Frontend previously assumed bare arrays, causing runtime crashes during `.filter()` and `.reduce()` operations.

## 5. Gap Analysis
- Gap 1: Incompatible response shapes (`{ records: [] }` vs `[]`).
- Gap 2: Incompatible incentive semantics (rule definitions vs computed payroll summaries).
- Gap 3: Field name discrepancies (`id` vs `record_id`, `attendance_date` vs `date`, `check_in_at` vs `clock_in`).

## 6. Architecture Impact
- Enforces boundary layer defensive parsing in `EmployeeAttendanceModal.tsx`.
- Leverages `EmployeeAttendanceEngine` pure calculation methods as a reliable fallback when live computed payroll summaries are absent.
- Preserves PostgreSQL and Alembic database schema integrity without requiring schema modifications.

## 7. Proposed Design
- Unpack `Array.isArray(att) ? att : att?.records || []`.
- Dual-map properties for backward and forward compatibility.
- Dynamically synthesize employee payroll projections via `EmployeeAttendanceEngine.computePayout` when rule catalogues are detected.

## 8. Files Created
- `src/tests/employeeAttendanceStudio.test.ts`
- `docs/walkthrough/hr/Attendance_Studio_Audit_And_Contract_Hardening_v1.0.1.md`
- `docs/implementation/hr/Attendance_Studio_Audit_And_Contract_Hardening_Plan_v1.0.1.md`

## 9. Files Modified
- `src/components/hr/EmployeeAttendanceModal.tsx`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- React 18 + Vite
- FastAPI Core backend
- PostgreSQL 15 `attendance_records` table
- Vitest test runner

## 11. Risks
- Risk: Divergence between synthesized client preview and backend batch payroll run.
- Mitigation: Synthesized calculation strictly adheres to the canonical marginal slab standard implemented in `EmployeeAttendanceEngine`.

## 12. Rollback Strategy
Revert frontend modifications via Git (`git checkout HEAD~1 -- src/components/hr/EmployeeAttendanceModal.tsx`).

## 13. Verification Plan
- Column-by-column database schema parity verification via `\d` psql inspection.
- Full Vitest suite execution across attendance and staff suites.
- Full Pytest execution against backend `t_staff_verify.py`.
- Full TypeScript compiler AST verification (`tsc --noEmit`).

## 14. Test Plan
- Unit test coverage for response unwrapping and property normalization.
- Unit test coverage for rule catalog handling and dynamic payout calculation.
- Regression tests for marginal tiered slabs and zero-division safety.

## 15. Documentation Impact
- Update `docs/walkthrough/hr/Attendance_Studio_Audit_And_Contract_Hardening_v1.0.1.md`.
- Update `docs/walkthrough/README.md`.
- Update `docs/implementation/README.md`.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
Commit and push to `origin/smritiNX`. No database migrations required.

## 17. Status
Completed.

## 18. Related ADRs
- `ADR-HR-001`: HR Domain Registration and Directory Consolidation.
- `ADR-001`: FastAPI + PostgreSQL Sole System of Record.

## 19. Related Walkthroughs
- [Attendance Studio Audit & Contract Hardening v1.0.1](../../walkthrough/hr/Attendance_Studio_Audit_And_Contract_Hardening_v1.0.1.md)
- [Employee Attendance & Commission Engine v1.0.0](../../walkthrough/hr/Employee_Attendance_Engine_v1.0.0.md)
