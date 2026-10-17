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

# Walkthrough: Staff Attendance & Workforce Management UX, UI, and Database Wiring (W-HR-005)

## 1. Purpose
Document the end-to-end integration and verification of the Staff Attendance & Workforce Management user interface, UX interaction flows, and PostgreSQL system-of-record tables.

## 2. Scope
- `src/components/hr/EmployeeAttendanceModal.tsx`: Propagating `initialUserId`, multi-source roster union, status styling, and device source badges.
- `src/components/staff/StaffMasterWs.tsx`: Interactive Shift Punch console, live PostgreSQL KPI summaries, 6-column historical ledger, and modal invocation wiring.
- `src/components/hr/AttendanceWorkspaceTab.tsx`: Multi-source roster union in `loadPersonnel`.
- `backend/app/api/v1/staff.py`: Deduplication and varchar(100) boundary truncation for `device_source`.
- `src/tests/staffAttendance.integration.test.ts`: Vitest integration test suite (Suite 10).

## 3. Files Created
- `docs/implementation/hr/Staff_Attendance_UX_UI_And_Database_Wiring_Plan_v1.0.0.md`
- `docs/walkthrough/hr/Staff_Attendance_UX_UI_And_Database_Wiring_Walkthrough_v1.0.0.md`

## 4. Files Modified
- `backend/app/api/v1/staff.py`
- `src/components/hr/EmployeeAttendanceModal.tsx`
- `src/components/staff/StaffMasterWs.tsx`
- `src/components/hr/AttendanceWorkspaceTab.tsx`
- `src/tests/staffAttendance.integration.test.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
- **AD-HR-W01: Two-Tier Staff Roster Union:** Both `/staff/personnel` (sales commission profiles) and `/staff/directory` (central system users) are retrieved in parallel via `Promise.all` and consolidated in a `Map<string, PersonnelProfile>`, ensuring zero exclusions for non-commission operational staff (cashiers, store associates, supervisors).
- **AD-HR-W02: In-Context Shift Punch Console:** Added an interactive 1-click `[⏱ Clock In / Out Now]` console directly within `StaffMasterWs.tsx`'s Attendance tab that hits `POST /api/v1/staff/attendance/punch` with `device_source: "STAFF_360_WORKSPACE"`, eliminating the mandatory friction of launching modal dialogs for basic attendance checks.
- **AD-HR-W03: Database VARCHAR(100) Defensive Bounding:** Punches previously appended device source tags unconditionally, which caused PostgreSQL `StringDataRightTruncationError` on repeated test/runtime clockings. The backend now deduplicates existing tags and bounds strings to 100 characters.

## 6. Design Rationale
- Operators managing employees in Staff 360 expect clicking "Attendance Studio" to open the profile of the employee they are currently looking at (`selectedId`).
- Color-coded badges (`PRESENT` in emerald, `LATE` in amber, `HALF_DAY` in violet, `ABSENT` in rose) allow instant visual triage without deciphering raw status strings.
- Monospace ISO timestamps and duration numbers (`hours_worked`) match high-density enterprise accounting paradigms.

## 7. Implementation Summary
1. **Employee Attendance Modal:**
   - Added `initialUserId?: string` to `EmployeeAttendanceModalProps`.
   - Wired `selectedUserId` state initialization and `useEffect` synchronizer.
   - Merged `/staff/personnel` and `/staff/directory` into `staffMap`.
   - Added `LATE` status badge styling.
   - Added `register_source` / `device_source` hardware indicators in record rows.
2. **Staff 360 Workspace:**
   - Passed `initialUserId={selectedId}` to `<EmployeeAttendanceModal />`.
   - Added state for `attendanceSummary` and `todayPunching`.
   - Mounted live Today's Shift Status console with state-aware button (`Clock In`, `Clock Out`, `Update Punch`).
   - Added `handleQuickPunch` invoking `/staff/attendance/punch` and refreshing state.
   - Rendered 4 PostgreSQL KPI pills (`Present Shifts`, `Late Punches`, `Half Day Shifts`, `Hours Logged`).
   - Expanded attendance table to 6 columns with `Hours` and `Source / Terminal`.
3. **Attendance Workspace Tab:**
   - Updated `loadPersonnel` to union both `/staff/personnel` and `/staff/directory`.
4. **FastAPI Backend (`staff.py`):**
   - Added deduplication check and `[:100]` character slicing to `device_source` updates in both single punch and biometric push handlers.

## 8. Tests Executed
1. `npx vitest run src/tests/staffAttendance.integration.test.ts src/tests/staffShift.integration.test.ts`:
   - 69/69 tests passed in 606ms (40 in `staffAttendance`, 29 in `staffShift`).
2. `python -m unittest tests/test_headless_attendance_client.py`:
   - 8/8 tests passed in 0.434s against live Docker backend on port 1981 and PostgreSQL on port 2781.
3. `npx tsc --noEmit`:
   - Exited with code 0 (zero compiler errors).

## 9. Verification Results
- Status: **Done** (All changes verified with literal terminal outputs and test executions per Rules 1–12).
- Zero console or build errors.
- Schema parity verified on PostgreSQL `attendance_records` table.

## 10. Known Limitations
- Shift start grace threshold (`SMRITI.HR.SHIFT_START_TIME`) defaults to `09:00` UTC when no company system parameter is configured.

## 11. Future Work
- Real-time WebSocket push notifications to update Attendance Workspace live when physical biometric turnstiles ingest punches.

## 12. Related ADRs
- `ADR-HR-001`: Canonical Staff Master and HR User Governance.
- `ADR-038`: Pure FastAPI Backend System-of-Record Architecture.

## 13. Related RFCs
- `RFC-HR-002`: Multi-Modal Attendance Ledger & Device Ingestion Specification.
