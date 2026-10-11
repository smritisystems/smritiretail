<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.52
  Created      : 2026-10-12
  Modified     : 2026-10-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Headless Staff Attendance Punch & Automation Client

**Walkthrough ID:** W-HR-004  
**Version:** 1.0.0  
**Domain:** HR & Workforce Operations  
**Date:** 2026-10-12  

---

## 1. Purpose
Document the implementation, architecture, and empirical verification of the headless workforce attendance client (`scripts/headless_attendance_client.py`) and automated test harness (`tests/test_headless_attendance_client.py`) for SMRITI Retail OS, providing browser-free terminal operations for staff attendance entry, biometric device stream pushes, bulk attendance marking, ledger querying, and KPI summaries.

## 2. Scope
- Python CLI utility `scripts/headless_attendance_client.py`:
  - `biometric-push`: IoT hardware punch webhook push (`POST /api/v1/staff/attendance/device-push`).
  - `single-punch`: Self-service or supervisor punch (`POST /api/v1/staff/attendance/punch`).
  - `bulk-mark`: Bulk attendance roster marking (`POST /api/v1/staff/attendance/bulk`).
  - `query-ledger`: Tabular ASCII attendance record inspection (`GET /api/v1/staff/attendance`).
  - `query-summary`: Aggregated period KPI metrics (`GET /api/v1/staff/attendance/summary`).
  - `list-staff`: Directory roster lookup (`GET /api/v1/staff/`).
- Automated regression suite `tests/test_headless_attendance_client.py`.
- Adherence to Universal Author Details Policy (UADHP) and Verification Governance Rules (`AGENTS.md`).

## 3. Files Created
- `scripts/headless_attendance_client.py`
- `tests/test_headless_attendance_client.py`
- `docs/implementation/hr/Headless_Staff_Attendance_Punch_Client_Plan_v1.0.0.md`
- `docs/walkthrough/hr/Headless_Staff_Attendance_Punch_Client_Walkthrough_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Zero-Dependency Standard Library Architecture:**
   - The CLI client utilizes exclusively Python standard library modules (`urllib.request`, `json`, `argparse`, `datetime`), ensuring immediate execution across edge gateways, headless Linux servers, Raspberry Pis, and developer workstations without requiring external virtual environment package installations.
2. **Authoritative PostgreSQL Synchronization:**
   - Every punch recorded via the headless client is dispatched directly to the FastAPI Core backend (`smriti-api`) on port 1981, validating business parameters, shift hours, grace periods, and committing atomically to PostgreSQL (`attendance_records` table).
3. **Tabular Terminal ASCII Presentation:**
   - Rather than dumping raw unstructured JSON, ledger and directory queries render formatted ASCII tables in stdout for instant human readability in terminal environments.

## 6. Design Rationale
Operating attendance workflows headlessly eliminates brittle browser agent sessions, GUI render timeouts, and UI state dependencies, allowing edge synchronization daemons, CI pipelines, and store automation scripts to reliably manage attendance data.

## 7. Implementation Summary
- **Client Script (`scripts/headless_attendance_client.py`):**
  - Configurable parameters: `--base-url`, `--username`, `--password`, `--mode`, `--employee-code`, `--user-id`, `--device-id`, `--device-key`, `--punch-state`, `--verify-type`, `--attendance-date`, `--status`, `--period`.
  - Implements 6 operational modes covering all staff attendance interaction patterns.
- **Automated Test Suite (`tests/test_headless_attendance_client.py`):**
  - Covers 8 automated test methods executing sequentially against the live Dockerized SMRITI environment.

## 8. Tests Executed
Exact test command:
```powershell
python -m unittest tests/test_headless_attendance_client.py -v
```

Literal test output:
```text
test_01_authentication (tests.test_headless_attendance_client.TestHeadlessAttendanceClient.test_01_authentication)
Verify authentication endpoint and JWT token structure. ... ok
test_02_list_staff_directory (tests.test_headless_attendance_client.TestHeadlessAttendanceClient.test_02_list_staff_directory)
Verify querying active staff roster via headless client. ... ok
test_03_biometric_device_push_check_in (tests.test_headless_attendance_client.TestHeadlessAttendanceClient.test_03_biometric_device_push_check_in)
Verify IoT biometric punch ingestion for CHECK_IN state. ... ok
test_04_biometric_device_push_check_out (tests.test_headless_attendance_client.TestHeadlessAttendanceClient.test_04_biometric_device_push_check_out)
Verify IoT biometric punch ingestion for CHECK_OUT state. ... ok
test_05_single_staff_punch (tests.test_headless_attendance_client.TestHeadlessAttendanceClient.test_05_single_staff_punch)
Verify real-time single punch recording. ... ok
test_06_bulk_mark_attendance (tests.test_headless_attendance_client.TestHeadlessAttendanceClient.test_06_bulk_mark_attendance)
Verify bulk attendance marking across staff roster. ... ok
test_07_query_attendance_ledger (tests.test_headless_attendance_client.TestHeadlessAttendanceClient.test_07_query_attendance_ledger)
Verify attendance ledger query returns expected typed contract. ... ok
test_08_query_attendance_summary (tests.test_headless_attendance_client.TestHeadlessAttendanceClient.test_08_query_attendance_summary)
Verify period attendance KPI summary aggregation. ... ok

----------------------------------------------------------------------
Ran 8 tests in 0.349s

OK
```

## 9. Verification Results
- **Authentication**: JWT token retrieved successfully from `/api/v1/auth/login`.
- **Roster Discovery**: 18 active staff members fetched and listed from `/api/v1/staff/`.
- **IoT Biometric Push**: Successfully pushed `CHECK_IN` and `CHECK_OUT` punches for employee `EMP-1002`, processed by `BIO-TERMINAL-FRONT-01` with 0 errors.
- **Single Staff Punch**: Executed real-time punch for `usr-cashier` with automated late/half-day detection.
- **Bulk Marking**: Marked attendance status (`LEAVE`) for `usr_manager` on target date with 0 errors.
- **Ledger Verification**: Verified 3 active records stored in PostgreSQL with exact timestamps.
- **Summary KPI**: Verified real-time aggregation across present, half-day, and leave shifts.
- **Linter Output**: `python -m py_compile` exited with code 0 (clean).

## 10. Known Limitations
- Biometric push requires pre-configured `SMRITI.HR.DEVICE_PUSH_API_KEY` in System Parameters.
- Hardware devices pushing without UTC timestamps require local server time alignment.

## 11. Future Work
- Add automatic USB/Serial COM port listening daemon for direct ZKTeco USB reader hookups.
- Add cron scheduling daemon wrapper for continuous polling and sync.

## 12. Related ADRs
- `ADR-045`: PostgreSQL as Sole System of Record & Strangler-Fig Completion.
- `ADR-046`: Universal Author Details & Governance Verification Policy.

## 13. Related RFCs
- `RFC-HR-003`: Workforce Attendance Punch & Edge Biometric Synchronization.
