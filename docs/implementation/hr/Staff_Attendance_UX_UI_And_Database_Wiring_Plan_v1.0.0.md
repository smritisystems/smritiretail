<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-12
  Modified     : 2026-10-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Staff Attendance & Workforce Management UX, UI, and Database Wiring (IP-HR-007)

## 1. Objective
Achieve seamless, bidirectional wiring between the frontend User Experience (UX), component User Interface (UI), and underlying PostgreSQL database tables (`attendance_records`, `staff_profiles`, `users`, `leave_balances`, `leave_requests`, `system_parameters`) across all operational workforce entry points (`StaffMasterWs.tsx`, `EmployeeAttendanceModal.tsx`, `AttendanceWorkspaceTab.tsx`, and `backend/app/api/v1/staff.py`).

## 2. Business Motivation
In retail operations, store managers, cashiers, and supervisors require unified access to clocking in/out, shift status monitoring, and historical attendance review. Prior to this implementation:
- Non-commission employees (e.g., cashiers, warehouse handlers, store operators) were missing from attendance modal sidebars because staff lists only pulled from commission participants.
- Opening Attendance Studio from Staff 360 did not propagate the actively selected employee, defaulting confusingly to the first roster row.
- Staff 360's inline attendance tab lacked interactive 1-click clocking, requiring operators to leave their current view.
- Successive shift punches on the same record concatenated unbounded device identifiers into PostgreSQL, risking database varchar column overflow.

## 3. Scope
- **Frontend Components:**
  - `src/components/hr/EmployeeAttendanceModal.tsx`: Support `initialUserId` prop, dynamic staff selection synchronization, union of `/staff/personnel` and `/staff/directory` rosters, status styling for `LATE`, and device/register source badges.
  - `src/components/staff/StaffMasterWs.tsx`: Propagate `selectedId` as `initialUserId` to `EmployeeAttendanceModal`, mount interactive Today's Shift Punch Console in the inline Attendance tab, render PostgreSQL authoritative KPI summary pills, and expand the table with device/source and hours worked columns.
  - `src/components/hr/AttendanceWorkspaceTab.tsx`: Unify staff roster loading from both commission participants and central user directory.
- **Backend & Database:**
  - `backend/app/api/v1/staff.py`: Deduplicate and bound `device_source` strings to 100 characters, preventing PostgreSQL `character varying(100)` truncation errors.
- **Automated Test Harness:**
  - `src/tests/staffAttendance.integration.test.ts`: Add integration test suite (Suite 10) covering Staff 360 punch payload, PostgreSQL KPI summaries, multi-source roster union, and device source bounding.

## 4. Current State
- The PostgreSQL tables (`attendance_records`, `users`, `staff_profiles`, `leave_balances`, `leave_requests`) and FastAPI endpoints (`/staff/attendance`, `/staff/attendance/summary`, `/staff/attendance/punch`, `/staff/attendance/bulk`, `/staff/attendance/device-push`) are operational.
- However, the UI layers had subtle disconnections between the directory users and the commission participants, and Staff 360 was read-only for attendance.

## 5. Gap Analysis
1. **Modal Selection Gap:** `EmployeeAttendanceModal` lacked `initialUserId?: string` and always initialized `selectedUserId` to `staffList[0].user_id`.
2. **Staff Roster Coverage Gap:** `/staff/personnel` returns only commission participants. Store cashiers and operational staff without commission programs were omitted.
3. **Staff 360 Actionability Gap:** Operators viewing an employee in Staff 360 could not record a shift punch directly without opening a separate modal.
4. **PostgreSQL Column Boundary Gap:** Successive punches appended `, <device_id>` repeatedly to `device_source`, exceeding the 100-character column width in PostgreSQL.

## 6. Architecture Impact
- Enforces single system-of-record integrity with PostgreSQL `attendance_records` as the sole authority.
- Retains backward compatibility for all existing props and REST APIs.
- Zero client-side synthetic mocks; all state updates derive from live FastAPI responses.

## 7. Proposed Design
```
StaffMasterWs (Staff 360) 
  ├── Selected Staff Member: usr-cashier
  ├── Inline Attendance Tab
  │     ├── Live Today's Shift Console [⏱ Clock In / Clock Out] -> POST /staff/attendance/punch
  │     ├── PostgreSQL KPI Summary Pills (Present, Late, Half-Day, Total Hours)
  │     └── Historical Ledger (Date, Status, Clock In/Out, Hours, Source)
  └── [Attendance Studio] Button -> Launches EmployeeAttendanceModal with initialUserId={selectedId}
        ├── Merged Roster: /staff/personnel ∪ /staff/directory
        ├── Live Shift Punch Console & IoT Indicator
        └── Real-time PostgreSQL Ledger & Payslip Generation
```

## 8. Files Created
None (modifications and test enhancements to existing architecture files).

## 9. Files Modified
1. `backend/app/api/v1/staff.py`
2. `src/components/hr/EmployeeAttendanceModal.tsx`
3. `src/components/staff/StaffMasterWs.tsx`
4. `src/components/hr/AttendanceWorkspaceTab.tsx`
5. `src/tests/staffAttendance.integration.test.ts`
6. `docs/implementation/README.md`
7. `docs/walkthrough/README.md`
8. `CHANGELOG.md`

## 10. Dependencies
- React 18, Vite 4, TypeScript 5.
- FastAPI, SQLAlchemy asyncpg, PostgreSQL 15+.
- Vitest 4.1, Python 3.11 unittest.

## 11. Risks
- **Risk:** Rapid double-clicking on punch buttons causing concurrent DB commits.
  - **Mitigation:** Button states are guarded by `todayPunching` / `punchLoading` flags disabling button triggers during in-flight network promises.
- **Risk:** Roster merging producing duplicate keys in React lists.
  - **Mitigation:** Merged via `Map<string, PersonnelProfile>` keyed by primary identity `user_id`.

## 12. Rollback Strategy
Git revert commits to branch `smritiNX` restoring previous component snapshots.

## 13. Verification Plan
1. Static analysis: `npx tsc --noEmit` must return 0 errors.
2. Vitest test runner: `npx vitest run src/tests/staffAttendance.integration.test.ts` must pass 100%.
3. Python headless client test suite: `python -m unittest tests/test_headless_attendance_client.py` must pass 8/8.
4. PostgreSQL direct inspection: verify `device_source` and column integrity on live database port 2781.

## 14. Test Plan
- Unit tests: Validate multi-source map union logic.
- Integration tests: Validate network request interceptor for `STAFF_360_WORKSPACE` device payload.
- Database tests: Validate varchar boundary compliance under repeated punches.

## 15. Documentation Impact
- Update `docs/implementation/README.md` with new plan entry.
- Create new Walkthrough in `docs/walkthrough/hr/Staff_Attendance_UX_UI_And_Database_Wiring_Walkthrough_v1.0.0.md`.
- Update `docs/walkthrough/README.md` with new walkthrough entry.
- Log release notes in `CHANGELOG.md`.

## 16. Deployment Plan
- Frontend hot-reload via Vite in `smriti-web` container (port 8101).
- Backend service running via uvicorn in `smriti-api` container (port 1981).
- Code committed to branch `smritiNX` and pushed to remote origin.

## 17. Status
Completed.

## 18. Related ADRs
- `ADR-HR-001`: Canonical Staff Master and HR User Governance.
- `ADR-038`: Pure FastAPI Backend System-of-Record Architecture.

## 19. Related Walkthroughs
- `docs/walkthrough/hr/Staff_Attendance_UX_UI_And_Database_Wiring_Walkthrough_v1.0.0.md`
- `docs/walkthrough/hr/Headless_Staff_Attendance_Punch_Client_Walkthrough_v1.0.0.md`
