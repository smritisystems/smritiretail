<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.0
  Created      : 2026-10-14
  Modified     : 2026-10-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Muster Roll, Employee Attendance & Wage Engine Walkthrough (v1.0.0)

## 1. Purpose
This document details the implementation and verification of the Indian Statutory Form II Muster Roll reporting, casual worker daily-wage calculation, and monthly salaried worker payroll reconciliation with Loss of Pay (LOP) deduction within SMRITI Retail OS.

## 2. Scope
- **Target User Personas**: Retail store employees, floor cashiers, stock handlers, warehouse staff, and casual/daily-wage workers.
- **In-Scope**:
  - Daily worker wage calculation based on worked days, half days, and overtime.
  - Monthly salaried worker calculation with deterministic Loss of Pay (LOP) deductions for unexcused/unpaid absences.
  - Form II horizontal 1..31 day attendance matrix generation with color-coded status badges and aggregated period metrics.
  - Statutory Form II CSV export endpoint formatted for labor compliance.
  - Two-state payroll lifecycle (Calculation preview -> Freezing / Finalizing into tenant `wage_statements`).
  - Frontend Unified Attendance Workspace with Form II Muster Roll and Payroll tabs.
  - Resolution of the P0 incentive calculation bug in `EmployeeAttendanceModal.tsx`.
- **Out of Scope (Deferred)**:
  - Mobile biometric hardware SDK push drivers and geofencing.
  - Automated Statutory PF/ESI deduction matrices (deferred to next phase).

## 3. Files Created
1. `backend/alembic/versions/v1533_attendance_weekly_off_and_wage_statements.py` — Migration creating tenant `wage_statements` table and expanding attendance status constraint with `WEEKLY_OFF`.
2. `backend/app/services/wage_calculation_service.py` — Deterministic payroll & wage calculation engine and Form II muster roll aggregation matrix.
3. `backend/app/tests/test_muster_roll_and_wage_engine.py` — 7-scenario comprehensive automated test suite.
4. `docs/implementation/hr/Muster_Roll_And_Wage_Engine_Plan_v1.0.0.md` — Implementation plan under IPGP.
5. `docs/walkthrough/hr/Muster_Roll_And_Wage_Engine_v1.0.0.md` — This walkthrough document.

## 4. Files Modified
1. `backend/app/db/ownership.py` — Registered `wage_statements` table under `TableOwner.TENANT`.
2. `backend/app/models/hr.py` — Severed cross-DB foreign key references to `users.id` on `AttendanceRecord`, `LeaveBalance`, and `LeaveRequest`; declared `WageStatement` SQLAlchemy model.
3. `backend/app/models/__init__.py` — Exported `WageStatement`.
4. `backend/app/schemas/user.py` — Added `wageType`, `dailyRate`, and `overtimeRatePerHour` to `SalaryStructure`.
5. `backend/app/api/v1/staff.py` — Added endpoints `/staff/attendance/muster-roll`, `/staff/attendance/muster-roll/export-csv`, `/staff/wages/calculate`, `/staff/wages/finalize`; updated `allowed_statuses` with `WEEKLY_OFF`.
6. `src/components/hr/EmployeeAttendanceModal.tsx` — Fixed P0 envelope unwrapping for commission and incentive calculations.
7. `src/components/hr/AttendanceWorkspaceTab.tsx` — Added Muster Roll (Form II) interactive grid and Payroll / Wage reconciliation tab.
8. `docs/walkthrough/README.md` — Appended walkthrough to chronological master table.
9. `docs/implementation/README.md` — Appended implementation plan to master table.
10. `CHANGELOG.md` — Logged release changes under Version 3.17.0.

## 5. Architecture Decisions
- **AD-HR-001: Table Ownership & Dual-Database Cleanliness**: `wage_statements` is strictly a tenant operational table (`TableOwner.TENANT`). In accordance with SMRITI architecture, cross-DB foreign keys between tenant tables and the `smritisys.users` table are prohibited; soft referencing via `user_id` string with composite unique constraint `(company_id, user_id, period)` is strictly adhered to.
- **AD-HR-002: Loss of Pay (LOP) Pro-Rata Formulation**: Salaried staff deduction is calculated as `(monthly_salary / calendar_days_in_period) * lop_days`, ensuring exact calendar alignment per statutory labor norms.
- **AD-HR-003: Immutable Wage Statements**: Once finalized, wage statements are stored in `wage_statements` with audit timestamps and an immutable record snapshot preventing retroactive modification by punch adjustments.

## 6. Design Rationale
- Retail stores employ both fixed-salaried cashiers and daily-wage loaders/helpers. Having a unified engine capable of handling both Daily and Monthly rate types prevents shadow Excel sheets and payroll discrepancies.
- Form II statutory attendance requirements in India demand a continuous 1..31 day horizontal layout with codes (`P`, `A`, `L`, `HD`, `LV`, `WO`, `H`) and total overtime hours, which this implementation directly satisfies.

## 7. Implementation Summary
- Extended `SalaryStructure` to recognize `wageType: Literal["MONTHLY", "DAILY"]`, `dailyRate: float`, and `overtimeRatePerHour: float`.
- Created `wage_calculation_service.py` with `calculate_employee_wage` and `build_muster_roll_matrix`.
- Exposed 4 new RESTful endpoints in `staff.py` with tenant scoping, permission guards (`MANAGER` or `SYSADMIN`), and transaction management.
- Extended `AttendanceWorkspaceTab.tsx` with high-performance CSS grid matrix, status pills, live summaries, CSV download, and printable layout.

## 8. Tests Executed
1. `backend/app/tests/test_muster_roll_and_wage_engine.py`:
   - `test_daily_casual_worker_wage_computation`: PASSED
   - `test_monthly_salaried_worker_with_lop_deduction`: PASSED
   - `test_salary_structure_schema_validation`: PASSED
   - `test_period_dates_parsing`: PASSED
   - `test_weekly_off_attendance_and_summary`: PASSED
   - `test_muster_roll_matrix_and_csv_export`: PASSED
   - `test_wage_calculation_and_finalization_lifecycle`: PASSED
2. `backend/app/tests/t_staff_punch_verify.py`:
   - `test_interactive_punch_in_and_out_lifecycle`: PASSED
   - `test_biometric_device_push_batch_ingestion`: PASSED
3. `src/tests/staffAttendance.integration.test.ts`:
   - 40/40 tests PASSED
4. TypeScript Verification (`npm run lint` / `tsc --noEmit`):
   - Exited with code 0.
5. UX Field Governance Guard (`scripts/ci_ux_field_governance_guard.py`):
   - 0 critical violations, PASS.

## 9. Verification Results
- All unit, integration, schema validation, and lifecycle tests passed without errors.
- Verification status: **Done** (backed by verifiable code diffs and literal test execution).

## 10. Known Limitations
- PF and ESI statutory percentages and employer contributions are not computed automatically in v1.0.0.
- Manual salary advance adjustments are captured as custom additions/deductions rather than dedicated advance ledgers.

## 11. Future Work
- Implementation of Form V (Equal Remuneration Act) reports.
- Biometric hardware gateway integration directly to POS terminal USB readers.
- Integration with general ledger for automated payroll journal voucher generation.

## 12. Related ADRs
- `ADR-0042`: Tenant Isolation and Cross-Database Integrity
- `ADR-0089`: HR and Attendance Domain Model Architecture

## 13. Related RFCs
- `RFC-2026-HR-003`: Statutory Form II Muster Roll and Casual Worker Daily Wage Engine
