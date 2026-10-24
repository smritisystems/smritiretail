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

# Implementation Plan: Headless Staff Attendance Punch & Automation Client

**Plan ID:** IP-HR-006  
**Version:** 1.0.0  
**Domain:** HR & Workforce Operations  
**Date:** 2026-10-12  

---

## 1. Objective
Provide a robust, zero-dependency headless CLI client and automated test harness (`scripts/headless_attendance_client.py` and `tests/test_headless_attendance_client.py`) for operating, recording, and inspecting workforce attendance across SMRITI Retail OS without requiring browser interaction, GUI frontends, or interactive web sessions.

## 2. Business Motivation
Retail chains and automated distribution hubs frequently deploy IoT hardware biometric devices (fingerprint terminals, facial recognition gates, RFID turnstiles), background sync schedulers, and cron daemons that ingest, process, and query employee clock-in and clock-out logs headlessly. Relying on browser interactions for testing, verification, or edge sync introduces flakiness, overhead, and maintenance friction. A standalone, high-performance headless automation toolkit allows seamless terminal-level operations, continuous integration verification, and autonomous edge device synchronization.

## 3. Scope
- CLI utility `scripts/headless_attendance_client.py`:
  - `biometric-push`: IoT hardware punch stream ingestion (`POST /api/v1/staff/attendance/device-push`).
  - `single-punch`: Real-time staff self-service or supervisor punch (`POST /api/v1/staff/attendance/punch`).
  - `bulk-mark`: Headless batch roster marking for entire departments or shifts (`POST /api/v1/staff/attendance/bulk`).
  - `query-ledger`: Terminal tabular ASCII display of attendance records (`GET /api/v1/staff/attendance`).
  - `query-summary`: Period attendance KPI summary extraction (`GET /api/v1/staff/attendance/summary`).
  - `list-staff`: Directory lookup of active staff, codes, roles, and IDs (`GET /api/v1/staff/`).
- Automated test harness `tests/test_headless_attendance_client.py` leveraging Python standard `unittest`.
- Complete adherence to `AGENTS.md` verification governance rules, WGP, IPGP, and UADHP.

## 4. Current State
Attendance endpoints existed in the FastAPI backend (`backend/app/api/v1/staff.py`) and were consumed primarily by the React frontend (`EmployeeAttendanceModal.tsx`). Edge sync scripts were either ad-hoc or unbundled, and previous verification attempts relied on interactive browser agents which suffered from environment dependencies and timeouts.

## 5. Gap Analysis
- No unified CLI tool existed to execute, simulate, and verify all six staff attendance operational modes (biometric push, single punch, bulk mark, directory lookup, ledger query, summary query) purely from the terminal.
- Automated headless verification test suites running independently of browser drivers were absent from the repository test root.

## 6. Architecture Impact
Zero architectural modifications to the backend database schema or FastAPI routing contracts were required; the implementation exercises existing canonical REST APIs:
- `POST /api/v1/auth/login`
- `GET /api/v1/staff/`
- `POST /api/v1/staff/attendance/device-push`
- `POST /api/v1/staff/attendance/punch`
- `POST /api/v1/staff/attendance/bulk`
- `GET /api/v1/staff/attendance`
- `GET /api/v1/staff/attendance/summary`

## 7. Proposed Design
- Build `scripts/headless_attendance_client.py` with pure Python standard library modules (`urllib.request`, `argparse`, `json`, `datetime`) to ensure execution on any edge device or server without `pip install` prerequisites.
- Implement structured error handling translating HTTP status codes into human-readable terminal alerts per HREP.
- Provide ASCII table visualizers in terminal stdout for immediate operator inspection.
- Build `tests/test_headless_attendance_client.py` executing 8 sequential test cases with strict assertions against real PostgreSQL database persistence.

## 8. Files Created
- `scripts/headless_attendance_client.py`
- `tests/test_headless_attendance_client.py`
- `docs/implementation/hr/Headless_Staff_Attendance_Punch_Client_Plan_v1.0.0.md`
- `docs/walkthrough/hr/Headless_Staff_Attendance_Punch_Client_Walkthrough_v1.0.0.md`

## 9. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- Python 3.8+ (standard library only).
- Running SMRITI API backend (`smriti-api` on port 1981 / 8000).
- PostgreSQL database (`smriti-db` on port 2781 / 5432).

## 11. Risks
- **Device Key Mismatch**: Biometric push requires `SMRITI.HR.DEVICE_PUSH_API_KEY` configured in system parameters. Mitigation: Client includes `--device-key` argument with default matching active tenant configuration.
- **Clock Drift**: Terminal punches rely on ISO 8601 UTC timestamps; edge clock synchronization must be maintained via NTP.

## 12. Rollback Strategy
Both created files are non-intrusive client utilities and tests located outside application core binaries; rollback is as simple as removing the files via `git checkout` or deleting the script and test files.

## 13. Verification Plan
- Execute each CLI command mode via PowerShell/bash:
  - `python scripts/headless_attendance_client.py --mode list-staff`
  - `python scripts/headless_attendance_client.py --mode biometric-push --employee-code EMP-1002 --punch-state CHECK_IN`
  - `python scripts/headless_attendance_client.py --mode biometric-push --employee-code EMP-1002 --punch-state CHECK_OUT`
  - `python scripts/headless_attendance_client.py --mode single-punch --user-id usr-cashier --punch-state CHECK_IN`
  - `python scripts/headless_attendance_client.py --mode single-punch --user-id usr-cashier --punch-state CHECK_OUT`
  - `python scripts/headless_attendance_client.py --mode bulk-mark --user-id usr_manager --status LEAVE`
  - `python scripts/headless_attendance_client.py --mode query-ledger --user-id ALL`
  - `python scripts/headless_attendance_client.py --mode query-summary --user-id ALL`
- Direct SQL database inspection:
  - `docker exec smriti-db psql -U postgres -d smriti001 -c "SELECT id, user_id, attendance_date, status, check_in_at, check_out_at FROM attendance_records;"`
- Automated test run:
  - `python -m unittest tests/test_headless_attendance_client.py -v`

## 14. Test Plan
- Run 8/8 test cases in `test_headless_attendance_client.py` verifying authentication, roster retrieval, biometric push (clock-in & clock-out), single punch, bulk marking, ledger querying, and KPI summary aggregation.
- Run Python syntax linter (`python -m py_compile`).

## 15. Documentation Impact
- Addition of implementation plan to `docs/implementation/hr/`.
- Addition of walkthrough to `docs/walkthrough/hr/`.
- Master indexes updated in `docs/implementation/README.md` and `docs/walkthrough/README.md`.
- `CHANGELOG.md` entry.

## 16. Deployment Plan
- Script and test files committed to git branch `smritiNX`.
- Deployable to edge gateway controllers, IoT biometric push gateways, and local store servers.

## 17. Status
Completed.

## 18. Related ADRs
- `ADR-045`: PostgreSQL as Sole System of Record & Strangler-Fig Completion.
- `ADR-046`: Universal Author Details & Governance Verification Policy.

## 19. Related Walkthroughs
- `docs/walkthrough/hr/Attendance_Punch_Clocking_And_Biometric_Webhook_v1.0.0.md`
- `docs/walkthrough/hr/Headless_Staff_Attendance_Punch_Client_Walkthrough_v1.0.0.md`
