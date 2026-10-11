<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.52
  Created      : 2026-10-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# HR_Attendance_Sprint2_Sprint3_v1.0.md

**Walkthrough Type:** Feature + Test Coverage + API Hardening  
**Commits:** `9f6c2585` (Sprint 2) · `f9835ae5` (Sprint 3)  
**Date:** 2026-10-11  
**tsc:** `0 errors` (both commits)

---

## 1. Purpose

Document the Sprint 2 P1/P2 completions (Pydantic schema, leave lock, branch filter) and Sprint 3 (bulk endpoint, new test coverage, device-push test regression fix) for the Staff Attendance subsystem.

---

## 2. Scope

| Layer | Affected |
|-------|---------|
| Backend API | `GET /attendance` — typed schema; `GET /attendance/summary` — branch filter |
| Backend API | `PATCH /leave/requests/{id}/decision` — SELECT FOR UPDATE |
| Backend API | `POST /attendance/bulk` — new roster marking endpoint |
| Backend Tests | 8 new tests (late detection, half-day, device-push auth) |
| Backend Tests | `t_staff_punch_verify.py` — device-push test regression fix |

---

## 3. Files Created

| File | Purpose |
|------|---------|
| `backend/app/tests/t_staff_late_halfday_devpush_verify.py` | 8 new tests for Sprint 1–3 features |

---

## 4. Files Modified

| File | Changes |
|------|---------|
| `backend/app/api/v1/staff.py` | R-05 schema, R-07 lock, R-10 bulk, R-11 branch filter |
| `backend/app/tests/t_staff_punch_verify.py` | F-03 device-push test regression fix (seed key) |
| `CHANGELOG.md` | Sprint 2 + Sprint 3 entries |

---

## 5. Architecture Decisions

### AD-5: `POST /attendance/bulk` is idempotent per (user_id, attendance_date)
Duplicates are silently skipped (returned in `skipped_records`) rather than raising 409. This allows managers to safely re-submit a roster CSV without error-handling overhead.

### AD-6: `AttendanceRecordOut` uses `from_attributes = True` (Pydantic v2 style)
The schema is intentionally minimal — only fields relevant to the attendance grid are exposed. Internal fields (`correction_status`, `approved_at`) are included for transparency in the manager view but internal audit fields are excluded.

### AD-7: `with_for_update()` on `LeaveBalance` only during approval
The FOR UPDATE lock is scoped to the approval transaction only. The read paths (`list_leave_balances`) remain lock-free to avoid contention under concurrent reads.

### AD-8: `employeeAttendanceEngine.ts` — NOT retired yet (P3)
Two active test files (`employeeAttendanceEngine.test.ts`, `employeeAttendanceStudio.test.ts`) still import the engine directly. Retirement requires migrating these tests to the live API contract. Downgraded to P3 sprint.

---

## 6. Design Rationale

- **Bulk endpoint cap at 500 records** prevents accidental full-database overwrites from client pagination bugs.
- **`register_source = "MANAGER_BULK"`** provides audit trail distinguishing bulk marks from individual punches and biometric pushes.
- **Branch filter on summary** was the most-requested multi-branch enhancement — the `?branch_id=` pattern is consistent with all other SMRITI list endpoints.

---

## 7. Implementation Summary

### R-05 — AttendanceRecordOut schema
```python
class AttendanceRecordOut(BaseModel):
    id: str
    user_id: str
    attendance_date: date
    status: str
    check_in_at: Optional[datetime] = None
    check_out_at: Optional[datetime] = None
    # ... 6 more typed fields
    class Config:
        from_attributes = True
```

### R-07 — Leave balance SELECT FOR UPDATE
```python
select(LeaveBalance).where(...).with_for_update()
```

### R-10 — Bulk endpoint
`POST /attendance/bulk` — accepts `List[AttendanceCreate]`, max 500, manager-only, returns `{created, skipped, errors}`.

### R-11 — Branch filter
`?branch_id=<id>` on both `GET /attendance` and `GET /attendance/summary`.

### 8 New Tests (Sprint 3)
| ID | Description |
|----|-------------|
| T-LATE-01 | Late clock-in → `LATE` (shift 00:01 UTC, 0 min grace) |
| T-LATE-02 | On-time clock-in → `PRESENT` (shift 23:59 UTC) |
| T-HALF-01 | 2h worked → `HALF_DAY` (threshold 4h) |
| T-HALF-02 | 5h worked → `PRESENT` (threshold 4h) |
| T-HALF-03 | LATE + 5h worked → stays `LATE` |
| T-DEV-01 | No key in system_parameters → `403 SMRITI-PERM-010` |
| T-DEV-02 | Wrong device_key → `401 SMRITI-PERM-011` |
| T-DEV-03 | Correct device_key → `200`, 1 punch processed |

---

## 8. Tests Executed

| Suite | Status |
|-------|--------|
| `tsc --noEmit --skipLibCheck` | ✅ exit 0 (both commits) |
| `t_staff_late_halfday_devpush_verify.py` (8 tests) | Running (task-978) |
| `t_staff_punch_verify.py` (2 tests) | Running (task-978) |

---

## 9. Verification Results

| Claim | Evidence | Status |
|-------|----------|--------|
| Commit `9f6c2585` created | git log output | Done |
| Commit `f9835ae5` created | git log output | Done |
| tsc Sprint 2 exit 0 | task-911 output | Done |
| tsc Sprint 3 exit 0 | task-967 output | Done |
| 10 tests passing | task-978 (pending) | Partially Verified |

---

## 10. Known Limitations

- `employeeAttendanceEngine.ts` still active (not retired) — P3.
- `POST /attendance/bulk` does not (yet) fire leave-balance deductions for `LEAVE` status rows — that requires approval workflow integration.
- Late detection uses UTC shift times (IST offset is a manual UTC conversion — P2).

---

## 11. Future Work

| ID | Description | Priority |
|----|-------------|----------|
| R-12 | Attendance correction approval UI (frontend) | P2 |
| R-14 | Retire `employeeAttendanceEngine.ts` + migrate tests | P3 |
| — | `POST /attendance/bulk` — auto-deduct leave balance for LEAVE rows | P2 |
| — | IST timezone support in late detection | P2 |
| — | Bulk attendance test coverage | P2 |

---

## 12. Related ADRs

- ADR-TBD: Biometric Device Key Governance (SMRITI.HR.DEVICE_PUSH_API_KEY)

---

## 13. Related RFCs

- RFC-HR-001: Shift Scheduling and Roster Engine (Future)
