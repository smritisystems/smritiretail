<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-14
  Modified     : 2026-10-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Muster Roll & Authoritative Wage Engine (IP-HR-008)

## 1. Objective
Establish an authoritative, statutory-grade Muster Roll matrix register and compensation calculation engine inside SMRITI Retail OS. This integrates daily worker wages, monthly salary calculations with attendance-linked Loss of Pay (LOP) adjustments, weekly-off status tracking, wage statement finalization, and statutory Form II (Shop & Establishment / Payment of Wages Act) printable and Excel exports.

## 2. Business Motivation
In retail chain and warehouse operations, store managers oversee both permanent salaried employees (monthly payroll with LOP deductions) and casual daily-rated labor (paid per day/shift worked). Prior to this implementation:
- Attendance was viewed only as an event log table, preventing managers from seeing a consolidated monthly 1–31 day Muster Roll matrix.
- `EmployeeAttendanceModal.tsx` computed payouts through an ad-hoc, transient client-side formula that was broken by a response array-unwrapping defect.
- Database constraint `chk_attendance_status_valid` lacked `WEEKLY_OFF`, rejecting statutory rest-day tracking.
- There was no database-backed wage statement finalization; past compensation altered retroactively if past attendance was corrected.
- No statutory Form II or Excel export existed for labor compliance inspections.

## 3. Scope
- **Backend Architecture & Database:**
  - Create Alembic migration `v1533_attendance_weekly_off_and_wage_statements.py` expanding `chk_attendance_status_valid` to include `'WEEKLY_OFF'` and creating the tenant-scoped `wage_statements` table.
  - Register `"wage_statements": TableOwner.TENANT` in `backend/app/db/ownership.py`.
  - Sever cross-database ORM foreign keys in `backend/app/models/hr.py` (`AttendanceRecord` and `LeaveBalance`) to match the application-level contract of `StaffProfile`.
  - Define `WageStatement` model in `backend/app/models/hr.py`.
  - Extend `SalaryStructure` in `backend/app/schemas/user.py` with `wageType`, `dailyRate`, and `overtimeRatePerHour`.
  - Implement `WageCalculationService` in `backend/app/services/wage_calculation_service.py` with daily-wage and monthly salary LOP formulas.
  - Implement `GET /staff/attendance/muster-roll`, `GET /staff/attendance/muster-roll/export-excel`, `POST /staff/wages/calculate`, `POST /staff/wages/finalize`, and `GET /staff/wages/statements` in `backend/app/api/v1/staff.py`.
- **Frontend Workspaces:**
  - `src/components/hr/EmployeeAttendanceModal.tsx`: Fix line 304 unwrapping bug so the live Payout tab renders correctly.
  - `src/components/hr/AttendanceWorkspaceTab.tsx`: Add dedicated "Muster Roll" tab rendering a full 1..31 day interactive grid, headcount metrics, status badges, Print Form II button, and Excel export.
- **Automated Regression Test Suite:**
  - `backend/app/tests/test_muster_roll_and_wage_engine.py`: Unit and integration coverage for matrix aggregation, weekly-off insertion, daily wage math, salaried LOP deduction, and statement finalization immutability.

## 4. Current State
- `attendance_records`, `staff_profiles`, `leave_balances`, and `leave_requests` are operational.
- Punch clocking (`POST /staff/attendance/punch`), bulk mark (`POST /staff/attendance/bulk`), and corrections work reliably.
- `chk_attendance_status_valid` limits status to `('PRESENT','ABSENT','LATE','HALF_DAY','LEAVE','HOLIDAY')`.
- Wage calculation exists only as transient, client-side JavaScript inside `EmployeeAttendanceModal.tsx`.

## 5. Gap Analysis
1. **Statutory Status Gap:** Missing `WEEKLY_OFF` causes database rejection when marking rest days.
2. **Compensation Model Gap:** `SalaryStructure` only stores monthly salary; no field for daily wage rate exists.
3. **Muster Roll View Gap:** No monthly 1..31 day employee matrix exists in the workspace.
4. **Statement Immutability Gap:** No `wage_statements` table exists to lock approved monthly pay against retroactive changes.
5. **Defect in Modal:** Line 304 in `EmployeeAttendanceModal.tsx` evaluates `Array.isArray(inc)` to false on `{ lines: [...] }`, zeroing incentives.

## 6. Architecture Impact
- Maintains strict dual-database tenancy: `wage_statements` resides in tenant databases (`smritiXXX`).
- Zero changes to existing attendance record storage structure or punch APIs.
- Backward-compatible extension to `SalaryStructure` with default fallbacks.
- Server-authoritative computation guarantees audit compliance.

## 7. Proposed Design
```
┌────────────────────────────────────────────────────────┐
│              AttendanceWorkspaceTab (UI)               │
│  [Register]  [Muster Roll (1..31)]  [Corrections]     │
│       │               │                                │
│       ▼               ▼                                │
│  GET /attendance  GET /attendance/muster-roll          │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│             FastAPI Backend Service Layer              │
│  ├── WageCalculationService (Daily & Monthly Engine)   │
│  ├── SystemParameterService (Shift & Late Rules)       │
│  └── Excel/CSV Form II Stream Exporter                 │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│              PostgreSQL Tenant Database                │
│  ├── attendance_records (PRESENT, ABSENT, WEEKLY_OFF)  │
│  ├── staff_profiles (salary_json with dailyRate)       │
│  └── wage_statements (FINALIZED frozen monthly state)  │
└────────────────────────────────────────────────────────┘
```

## 8. Files Created
1. `backend/alembic/versions/v1533_attendance_weekly_off_and_wage_statements.py`
2. `backend/app/services/wage_calculation_service.py`
3. `backend/app/tests/test_muster_roll_and_wage_engine.py`
4. `docs/implementation/hr/Muster_Roll_And_Wage_Engine_Plan_v1.0.0.md`
5. `docs/walkthrough/hr/Muster_Roll_And_Wage_Engine_v1.0.0.md`

## 9. Files Modified
1. `backend/app/db/ownership.py`
2. `backend/app/models/hr.py`
3. `backend/app/schemas/user.py`
4. `backend/app/api/v1/staff.py`
5. `src/components/hr/EmployeeAttendanceModal.tsx`
6. `src/components/hr/AttendanceWorkspaceTab.tsx`
7. `docs/implementation/README.md`
8. `docs/walkthrough/README.md`
9. `CHANGELOG.md`

## 10. Dependencies
- Python 3.11, FastAPI, SQLAlchemy asyncpg, Alembic.
- React 18, TypeScript 5, Vite, Lucide-react.
- Vitest, pytest-asyncio.

## 11. Risks
- **Risk:** Database constraint update locking active tables.
  - **Mitigation:** Migration replaces check constraint safely using PostgreSQL transaction block.
- **Risk:** Retroactive change of compensation.
  - **Mitigation:** Finalized wage statements reject edits unless explicitly unlocked by a `SYSADMIN` or `MANAGER`.

## 12. Rollback Strategy
1. Revert Alembic revision `v1533` (`alembic downgrade v1532_cost_management_engine_foundations`).
2. Git restore modified frontend and backend files.

## 13. Verification Plan
1. Backend test suite: `pytest backend/app/tests/test_muster_roll_and_wage_engine.py`.
2. Existing regression suites: `pytest backend/app/tests/t_staff_*.py`.
3. Frontend integration suite: `npx vitest run src/tests/staffAttendance.integration.test.ts`.
4. TypeScript compilation: `npx tsc --noEmit`.

## 14. Test Plan
- Verify `WEEKLY_OFF` attendance insertion succeeds.
- Verify daily-wage calculation: $\text{Days} \times \text{Daily Rate}$.
- Verify salaried LOP calculation: $\text{Base} - (\text{LOP} \times \frac{\text{Base}}{\text{Working Days}})$.
- Verify Muster Roll matrix structure covers 1 to $N$ days of any selected month.
- Verify finalized statement cannot be overwritten by subsequent calculation.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create `docs/walkthrough/hr/Muster_Roll_And_Wage_Engine_v1.0.0.md` and append to `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
1. Run Alembic upgrade `alembic upgrade head`.
2. Restart FastAPI application daemon.
3. Reload frontend client workspace.

## 17. Status
Approved — Ready for Execution.

## 18. Related ADRs
- `ADR-0042`: Multi-Tenant Operational Data Partitioning.
- `ADR-0048`: Universal Author Details & File Header Policy (UADHP).

## 19. Related Walkthroughs
- `docs/walkthrough/hr/Staff_Attendance_UX_UI_And_Database_Wiring_Walkthrough_v1.0.0.md`
- `docs/walkthrough/hr/Muster_Roll_And_Wage_Engine_v1.0.0.md` (to be created upon completion)
