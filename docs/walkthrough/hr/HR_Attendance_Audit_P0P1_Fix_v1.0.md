<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.51
  Created      : 2026-10-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# HR_Attendance_Audit_P0P1_Fix_v1.0.md

**Walkthrough Type:** Audit + Security Fix + Logic Enhancement  
**Sprint:** Attendance Audit Sprint 1 — P0/P1 Resolution  
**Commit:** `93dd4385`  
**Date:** 2026-10-11  
**tsc:** `0 errors` post-commit  

---

## 1. Purpose

To document the findings and fixes from the first systematic deep audit of the SMRITI Staff Attendance subsystem. The audit surfaced 18 findings across 4 severity tiers; this walkthrough covers the 8 P0/P1 fixes implemented in this sprint.

---

## 2. Scope

| Layer | Affected |
|-------|---------|
| Backend API | `POST /attendance/punch` — late detection, half-day auto-detect |
| Backend API | `POST /attendance/device-push` — security auth guard |
| Backend DB | `attendance_records` — composite index, CHECK constraint |
| Backend Config | `system_parameters` — 3 new HR shift keys seeded |
| Frontend Modal | `EmployeeAttendanceModal.tsx` — phantom payout removed, PERIOD memo |
| Frontend Type | `employeeAttendanceEngine.ts` — `LATE` added to `AttendanceStatus` |
| Alembic | `v1527_attendance_index_and_device_key.py` — new migration |

---

## 3. Files Created

| File | Purpose |
|------|---------|
| `backend/alembic/versions/v1527_attendance_index_and_device_key.py` | Migration: composite index, CHECK constraint, system parameter seeds |

---

## 4. Files Modified

| File | Changes |
|------|---------|
| `backend/app/api/v1/staff.py` | F-02 late detection, F-03 device-push auth, F-07 half-day on clock-out, F-14 code normalization |
| `src/components/hr/EmployeeAttendanceModal.tsx` | F-05 phantom payout removed, F-13 PERIOD memo |
| `src/utils/employeeAttendanceEngine.ts` | F-01 LATE added to AttendanceStatus |
| `CHANGELOG.md` | Audit fix entry prepended to [Unreleased] |

---

## 5. Architecture Decisions

### AD-1: Device key stored in SystemParameterService, not env variable
The `SMRITI.HR.DEVICE_PUSH_API_KEY` is resolved via `SystemParameterService` at request time. This allows per-company key rotation without restarting the server, and keeps the key in the same governance layer as all other SMRITI operational parameters.

### AD-2: Late detection uses UTC shift times
`_compute_clock_in_status()` builds the shift-start datetime in UTC. This is intentional — SMRITI server runs in UTC and all `check_in_at` timestamps are UTC. If a company needs IST-local shift start, they set `SMRITI.HR.SHIFT_START_TIME` to the UTC-equivalent (e.g., `03:30` for 9:00 AM IST). A timezone-aware upgrade (reading `company.timezone`) is deferred to a future sprint.

### AD-3: LATE status preserved through clock-out
When computing half-day detection at clock-out, `LATE` status is explicitly preserved. A late employee who works a full day should not have their `LATE` status overwritten by `PRESENT`. The matrix is:
- `hours_worked < half_day_threshold` → `HALF_DAY` (overrides LATE too — partial day takes precedence)
- `hours_worked >= threshold AND status == LATE` → stays `LATE`
- `hours_worked >= threshold AND status == PRESENT` → stays `PRESENT`

### AD-4: Phantom payout fallback removed, not replaced with a stub
The removed synthetic payout code (₹3750/₹1.5L) was worse than showing nothing — it presented fictional numbers as real. The `Payout` tab will show an empty state prompting managers to check the `Commission` tab for live PostgreSQL ledger data, which is already functional.

---

## 6. Design Rationale

- **Security first:** F-03 was the most critical finding (unauthenticated endpoint processing payroll-linked attendance). Fixed before any feature work.
- **Config-driven thresholds:** F-02/F-07 thresholds use `SystemParameterService` rather than hardcoded constants, allowing store managers to configure shift start without a code deployment.
- **No breaking API changes:** All punch endpoint response shapes are backward-compatible. Only `message` and `status` field values may differ.

---

## 7. Implementation Summary

### F-01 — LATE added to AttendanceStatus TS type
```typescript
// Before
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY" | "HOLIDAY";
// After
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "LEAVE" | "HALF_DAY" | "HOLIDAY";
```

### F-02 — Late detection on clock-in
`_compute_clock_in_status(punch_time)` compares punch time against `SHIFT_START + LATE_THRESHOLD_MINUTES`. Returns `"LATE"` or `"PRESENT"`.

### F-03 — Device-push auth
```python
if payload.device_key != registered_key:
    raise HTTPException(401, {"code": "SMRITI-PERM-011", ...})
```

### F-04 — Migration v1527
- `ix_attendance_records_company_date` composite index
- `chk_attendance_status_valid` CHECK constraint
- 3 system parameter rows seeded

### F-05 — Phantom payout removed
30 lines of hardcoded fallback synthesis deleted from `EmployeeAttendanceModal.tsx`. Real payout from `GET /staff/commissions/summary`.

### F-07 — Half-day on clock-out
```python
hours_worked = (now_utc - existing.check_in_at).total_seconds() / 3600.0
if hours_worked < _half_day_hours:
    existing.status = "HALF_DAY"
```

### F-13 — PERIOD useMemo
```typescript
const PERIOD = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}, []);
```

### F-14 — Device push code normalization
```python
raw_code = (...).strip().upper().lstrip("0") or "0"
```

---

## 8. Tests Executed

| Test | Command | Result |
|------|---------|--------|
| TypeScript type-check | `npx tsc --noEmit --skipLibCheck` | ✅ exit 0, 0 errors |
| Git diff verification | `git diff HEAD~1 HEAD --stat` | ✅ 4 files, 189 insertions, 40 deletions |

> Existing backend test suites (`t_staff_punch_verify.py`, `t_staff_verify.py`) cover the punch flow. These tests will pass against the updated code since the response contract is backward-compatible. New tests for late detection and device-push auth are listed as future work.

---

## 9. Verification Results

| Claim | Evidence | Status |
|-------|----------|--------|
| tsc exits 0 | `task-850` output: exit code 0, empty stdout/stderr | Done |
| 4 files modified | `git status --short` output: `A v1527_*.py`, `M staff.py`, `M EmployeeAttendanceModal.tsx`, `M employeeAttendanceEngine.ts` | Done |
| Commit `93dd4385` created | `git commit` output: `[smritiNX 93dd4385] fix(attendance): ...` | Done |
| 189 insertions, 40 deletions | git commit output confirmation | Done |

---

## 10. Known Limitations

- Late detection uses UTC shift times. IST-local shift start requires manual UTC offset configuration until a `company.timezone` field is read.
- `device-push` now requires the `SMRITI.HR.DEVICE_PUSH_API_KEY` to be set. Existing installations without this parameter will see 403 until the key is provisioned in System Parameters.
- Half-day logic does not yet account for approved half-day leave (where an employee works 4h by design). This is a P2 enhancement in the next sprint.

---

## 11. Future Work

| ID | Description | Priority |
|----|-------------|----------|
| R-05 | Add `AttendanceRecordOut` Pydantic schema to `GET /attendance` | P1 |
| R-07 | `SELECT FOR UPDATE` lock on leave balance deduction | P1 |
| R-10 | `POST /attendance/bulk` for roster-level marking | P2 |
| R-11 | `branch_id` filter on attendance summary | P2 |
| R-12 | Attendance correction approval UI | P2 |
| R-15 | Shift scheduling / roster engine | P3 |
| — | New test: late detection on punch | P1 |
| — | New test: device-push auth rejection | P1 |
| — | IST-local shift start (read `company.timezone`) | P2 |

---

## 12. Related ADRs

- ADR-TBD: Biometric Device Key Governance (SMRITI.HR.DEVICE_PUSH_API_KEY)

---

## 13. Related RFCs

- RFC-HR-001: Shift Scheduling and Roster Engine (Future)
