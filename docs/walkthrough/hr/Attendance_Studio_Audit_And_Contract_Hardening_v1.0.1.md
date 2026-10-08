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

# Walkthrough: Attendance Studio — Full System Audit & Contract Hardening (v1.0.1)

## 1. Purpose
Documents the full system audit, contract reconciliation, defensive response unwrapping, and regression verification for the Attendance Studio (`EmployeeAttendanceModal.tsx` mounted via `#staff-attendance-modal-btn` in `StaffMasterWs.tsx`).

## 2. Scope
- Full audit of the Attendance Studio frontend UI modal (`EmployeeAttendanceModal.tsx`) and host studio (`StaffMasterWs.tsx`).
- Contract reconciliation between FastAPI backend endpoints (`/api/v1/staff/attendance`, `/api/v1/staff/incentives`, `/api/v1/staff/personnel`) and frontend payload expectations.
- Defensive handling for object vs array responses (`data.records`, `data.lines`).
- Field normalization between backend ORM attributes (`id`, `attendance_date`, `check_in_at`, `check_out_at`) and modal UI properties (`record_id`, `date`, `clock_in`, `clock_out`).
- Regression verification using Vitest (8/8 tests passed), Pytest (9/9 backend tests passed), and TypeScript AST compiler verification (`tsc --noEmit`).

## 3. Files Created
- `src/tests/employeeAttendanceStudio.test.ts`
- `docs/walkthrough/hr/Attendance_Studio_Audit_And_Contract_Hardening_v1.0.1.md`

## 4. Files Modified
- `src/components/hr/EmployeeAttendanceModal.tsx`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
1. **Defensive Response Normalization**: Rather than assuming `/staff/attendance` returns a naked array, the UI normalizes `Array.isArray(att) ? att : att?.records || []`. This prevents `TypeError: attendance.filter is not a function` when connecting to FastAPI.
2. **Incentive Catalogue Decoupling**: `/staff/incentives` provides rule catalogues (`STAFF-002: lines[]`), not pre-computed monthly payroll summaries. When rule catalogues are returned, the UI synthesizes calculated payout previews using `EmployeeAttendanceEngine` calculations without crashing.
3. **Canonical Field Dual-Mapping**: Supports both modern backend attributes (`id`, `attendance_date`, `check_in_at`, `check_out_at`) and UI properties (`record_id`, `date`, `clock_in`, `clock_out`).

## 6. Design Rationale
A crash in the Attendance Studio due to shape drift between the backend API and frontend component disrupts store management and daily HR operations. Normalizing payloads on the boundary layer ensures backward compatibility and complete crash immunity.

## 7. Implementation Summary
- Replaced naive array destructuring with defensive unwrapping for `GET /staff/attendance` and `GET /staff/incentives`.
- Added field mapping translating `id -> record_id`, `attendance_date -> date`, `check_in_at -> clock_in`, `check_out_at -> clock_out`.
- Implemented computed payout synthesis fallback utilizing `EmployeeAttendanceEngine` logic when rule catalogues are detected.
- Created `src/tests/employeeAttendanceStudio.test.ts` covering normalization, rule catalog handling, marginal slab calculations, and period report safety.

## 8. Tests Executed
```bash
npx vitest run src/tests/employeeAttendanceEngine.test.ts src/tests/employeeAttendanceStudio.test.ts
npx vitest run staff
npx tsc --noEmit
pytest backend/app/tests/t_staff_verify.py
```

## 9. Verification Results
- **Vitest Attendance Suites**: 8/8 passed across 2 test files (0 failures).
- **Vitest Staff Workspace Suite**: 16/16 passed across 4 test files.
- **TypeScript AST Validation**: `tsc --noEmit` exited with code 0 (0 errors).
- **Backend Pytest Suite**: 9/9 passed in `backend/app/tests/t_staff_verify.py`.

## 10. Known Limitations
- Real-time biometric IoT hardware sync requires a hardware agent bridge (QZ Tray / WebUSB) to be configured in local store environments.
- Backend `/staff/incentives` currently serves rule definition catalogues; batch payroll calculation is handled on the client or during month-end payroll runs.

## 11. Future Work
- Expose dedicated backend endpoint `GET /api/v1/staff/attendance/summary` providing aggregated employee period summaries directly from PostgreSQL.
- Add biometric biometric device sync wizard in `StaffMasterWs.tsx`.

## 12. Related ADRs
- `ADR-HR-001`: HR Domain Registration and Directory Consolidation.
- `ADR-001`: FastAPI + PostgreSQL Sole System of Record.

## 13. Related RFCs
- `RFC-124`: HR Commission Programme, Target Setting Process, and Attendance Governance.
