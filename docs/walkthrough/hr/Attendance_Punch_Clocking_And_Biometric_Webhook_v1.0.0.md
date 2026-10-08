<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.33
  Created      : 2026-10-08
  Modified     : 2026-10-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Interactive Punch Clocking & Biometric Device Webhook

**Walkthrough ID:** W-HR-003  
**Version:** 1.0.0  
**Domain:** HR & Workforce Operations  
**Date:** 2026-10-08  

---

## 1. Purpose
Document the end-to-end design, implementation, and verification of interactive workforce attendance punch clocking (Clock-In / Clock-Out) and hardware biometric device push webhook ingestion in SMRITI Retail OS.

## 2. Scope
- FastAPI backend routes in `backend/app/api/v1/staff.py`:
  - `POST /staff/attendance/punch` (idempotent, auto IN/OUT state machine).
  - `POST /staff/attendance/device-push` (IoT biometric stream receiver for eSSL, ZKTeco, Matrix devices).
- React frontend console in `src/components/hr/EmployeeAttendanceModal.tsx`:
  - Shift status badge: Not Clocked In Today, Clocked In at {time}, Clocked Out at {time}.
  - Action button: Clock In Now / Clock Out Now / Update Clock-Out.
  - IoT Biometric hardware push status indicator.
- Regression test suites in Pytest (`t_staff_punch_verify.py`) and Vitest (`employeeAttendanceStudio.test.ts`).

## 3. Files Created
- `docs/implementation/hr/Attendance_Punch_Clocking_And_Biometric_Webhook_Plan_v1.0.0.md`
- `docs/walkthrough/hr/Attendance_Punch_Clocking_And_Biometric_Webhook_v1.0.0.md`
- `backend/app/tests/t_staff_punch_verify.py`

## 4. Files Modified
- `backend/app/api/v1/staff.py`
- `src/components/hr/EmployeeAttendanceModal.tsx`
- `src/tests/employeeAttendanceStudio.test.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Idempotent Single-Endpoint Punch API:**
   - Rather than requiring clients to maintain complex state or make distinct separate calls for morning vs evening, `POST /staff/attendance/punch` defaults to `punch_type="AUTO"`. It checks the active tenant company's date, automatically creating the record if missing (Clock IN) or updating the check-out timestamp if already clocked in (Clock OUT).
2. **Batch Ingestion & Code Resolution for Biometric Edge:**
   - Biometric readers transmit employee numeric or alphanumeric codes (`employee_code`, `employee_id`, or `username`). The `device-push` endpoint resolves these identifiers across `staff_profiles` and `users` in memory before upserting into `attendance_records` with audit tagging `IoT-{device_id}:{verify_type}`.

## 6. Design Rationale
- Retail associates and store cashiers need immediate feedback when clocking in or out from the POS register or attendance modal without complex multi-screen navigation.
- Hardware clocks (fingerprint and face scanners) can push logs in real time or in buffered bursts after internet reconnections. The webhook processes arrays of punches and updates timestamps accurately based on device timestamps.

## 7. Implementation Summary
- **Backend Schemas:** Added `AttendancePunchPayload`, `BiometricPunchItem`, and `BiometricDevicePushPayload` to `backend/app/api/v1/staff.py`.
- **Backend Endpoints:**
  - `POST /attendance/punch`: Validates permissions, fetches or inserts today's `AttendanceRecord`, updates `check_in_at` / `check_out_at`, returns status.
  - `POST /attendance/device-push`: Resolves employee codes, processes batch punches, tracks device source.
- **Frontend Console:** Embedded real-time shift status card in `EmployeeAttendanceModal.tsx` above the attendance list, complete with dynamic Clock In / Clock Out button and optimistic refresh.

## 8. Tests Executed
1. **Pytest (`backend/app/tests/t_staff_punch_verify.py`):**
   - `test_interactive_punch_in_and_out_lifecycle`: PASSED
   - `test_biometric_device_push_batch_ingestion`: PASSED
2. **Vitest (`src/tests/employeeAttendanceStudio.test.ts`):**
   - 6/6 tests PASSED.
3. **TypeScript Build:**
   - `npx tsc --noEmit`: 0 errors (exit code 0).

## 9. Verification Results
- All punch endpoints return HTTP 200 with structured JSON envelopes.
- Frontend modal updates shift status in real time upon user interaction.
- Vitest and Pytest test runners report 100% green status.

## 10. Known Limitations
- Biometric push assumes device clocks are synchronized via NTP; out-of-order logs from misconfigured devices will update check-in/out timestamps based on reported device time.

## 11. Future Work
- Shift template allocation (morning vs evening rosters) and automatic late-mark penalty calculation.
- Automated POS sales invoice line-item commission attribution into `commission_ledgers`.

## 12. Related ADRs
- ADR-014: Unified Staff and Identity Architecture.
- ADR-028: Multi-Tenant Schema Isolation.

## 13. Related RFCs
- RFC-HR-002: Biometric Device Protocol and Webhook Specification.
