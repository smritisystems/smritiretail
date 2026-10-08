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

# Implementation Plan: Interactive Punch Clocking & Biometric Device Webhook

**Plan ID:** IP-HR-003  
**Status:** Approved  
**Version:** 1.0.0  
**Domain:** HR & Workforce Operations  

---

## 1. Objective
Enable operational workforce punch management by implementing:
1. An idempotent, high-availability `/api/v1/staff/attendance/punch` endpoint in FastAPI supporting single-action Clock-In and Clock-Out transitions.
2. An enterprise IoT biometric device webhook receiver (`/api/v1/staff/attendance/device-push`) for ZKTeco, eSSL, and Matrix biometric fingerprint/face scanners.
3. An interactive Clock-In / Clock-Out action console inside the React `EmployeeAttendanceModal.tsx` Attendance Studio with real-time state awareness.

## 2. Business Motivation
In retail environments, manual post-facto attendance entry causes disputes, inaccurate overtime calculations, and delays in monthly payroll processing. Retail operators require:
- Immediate, frictionless clock-in/out directly from the POS and administrative consoles.
- Automated ingestion of hardware time clocks at staff entrances to eliminate manual record-keeping and buddy punching.

## 3. Scope
- **Backend (`backend/app/api/v1/staff.py`):**
  - Schema definitions: `AttendancePunchPayload`, `BiometricDevicePushPayload`, `BiometricPunchItem`.
  - Route: `POST /staff/attendance/punch` with auto-detection of punch state (IN vs OUT).
  - Route: `POST /staff/attendance/device-push` with batch resolution of employee codes to tenant users.
- **Frontend (`src/components/hr/EmployeeAttendanceModal.tsx`):**
  - Active punch status indicator (Current Day Status: Not Clocked In / Clocked In / Clocked Out).
  - One-click interactive Punch action button with optimistic state updates and error rollbacks.
  - Device integration status badge.
- **Verification & Testing:**
  - Pytest automated suite covering punch IN, punch OUT, idempotency, and device-push batch processing.
  - Vitest test suite validating Attendance Studio UI state transitions.

## 4. Current State
- `attendance_records` table exists in PostgreSQL with 25 columns including `check_in_at`, `check_out_at`, `device_source`, and `register_source`.
- `POST /staff/attendance` only creates new records, throwing HTTP 409 Conflict if a record already exists for the date, preventing second-half punch out.
- `EmployeeAttendanceModal.tsx` displays existing attendance lines as read-only rows without any action buttons to clock in or out.

## 5. Gap Analysis
| Capability | Current State | Target State |
|---|---|---|
| Clock-In / Clock-Out Action | None (Read-only modal) | Interactive Clock In / Clock Out button in Attendance Studio |
| Punch Update API | 409 Conflict on existing date | Idempotent `POST /staff/attendance/punch` (auto IN/OUT) |
| Biometric Device Ingestion | Missing | `POST /staff/attendance/device-push` with batch upsert |
| Employee Code Resolution | Manual user ID required | Automatic code-to-user resolution via `staff_profiles` |

## 6. Architecture Impact
- **Database:** Zero schema migration needed. All target fields (`check_in_at`, `check_out_at`, `device_source`, `register_source`, `status`) already exist on `attendance_records`.
- **Concurrency:** Uses row-level atomic upsert with `SELECT FOR UPDATE` on `attendance_records` to prevent race conditions during rapid double-punches.

## 7. Proposed Design
```text
[Biometric Scanner (eSSL/ZKTeco)] ──► POST /staff/attendance/device-push ──┐
                                                                           ▼
[Attendance Studio (React UI)]     ──► POST /staff/attendance/punch       ──► [attendance_records (Postgres)]
```

## 8. Files Created
- `docs/implementation/hr/Attendance_Punch_Clocking_And_Biometric_Webhook_Plan_v1.0.0.md`
- `docs/walkthrough/hr/Attendance_Punch_Clocking_And_Biometric_Webhook_v1.0.0.md`
- `backend/app/tests/t_staff_punch_verify.py`

## 9. Files Modified
- `backend/app/api/v1/staff.py`
- `src/components/hr/EmployeeAttendanceModal.tsx`
- `src/tests/employeeAttendanceStudio.test.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- FastAPI `AsyncSession`, `select`, `update`
- SQLAlchemy `attendance_records`, `staff_profiles`, `users`
- React `apiFetchV1` client

## 11. Risks
- Timezone discrepancies: Resolved by enforcing tenant company timezone or UTC ISO standard timestamps.
- Code collision: Employee code lookup uses indexed `staff_profiles.employee_code` and fallback `users.employee_code`.

## 12. Rollback Strategy
Git revert on `backend/app/api/v1/staff.py` and `EmployeeAttendanceModal.tsx`. No database rollback is required since no schema alterations are made.

## 13. Verification Plan
1. Backend: Execute pytest suite `t_staff_punch_verify.py` verifying punch in, punch out, and biometric push.
2. Frontend: Execute Vitest suite `employeeAttendanceStudio.test.ts` verifying UI component rendering and punch handling.
3. TypeScript compiler validation: `npx tsc --noEmit`.

## 14. Test Plan
- Test Punch In creates a new row with `check_in_at`.
- Test Punch Out updates the existing row with `check_out_at`.
- Test Device Push creates punches in bulk for multiple employee codes.

## 15. Documentation Impact
- Update `docs/implementation/README.md` master index.
- Update `docs/walkthrough/README.md` master index.
- Update `CHANGELOG.md` for version v6.70.33.

## 16. Deployment Plan
Sync changes to `D:\Smriti_Retail_OS` and deploy via Git pull to test environment.

## 17. Status
Approved — Ready for Implementation.

## 18. Related ADRs
- ADR-014: Unified Staff and Identity Architecture.
- ADR-028: Multi-Tenant Schema Isolation.

## 19. Related Walkthroughs
- `Attendance_Studio_Audit_And_Contract_Hardening_v1.0.1.md`
- `Attendance_Punch_Clocking_And_Biometric_Webhook_v1.0.0.md`
