<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.72.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Automated Scheduled Reports & Distribution Engine (v1.0.0-GA)

## 1. Objective
Establish an enterprise-grade, unattended asynchronous automated reporting and multi-channel distribution engine for SMRITI Retail OS. Enable automated execution of canonical registers, financial summaries, and statutory workbooks across Email, WhatsApp Business Cloud, and Statutory Cloud Vault channels with cryptographic SHA-256 integrity sealing.

## 2. Business Motivation
Retail chains and enterprises require automated daily closing sales registers, periodic inventory valuation audits, and quarterly tax invoice reports delivered directly to executive stakeholders (CFO, Head of Retail, Auditors) without manual report downloads. Automated distribution guarantees timely visibility and compliance archiving.

## 3. Scope
- Cron expression evaluation and deterministic `next_run_at` scheduling.
- Multi-format serialization: `XLSX`, `PDF`, `CSV`, `JSON`.
- Multi-channel delivery connectors:
  - `EmailDispatcher` (Multipart MIME with attachments).
  - `WhatsAppDispatcher` (Executive summary and statutory metadata).
  - `StatutoryVaultDispatcher` (Sealed filesystem/cloud vault artifact with SHA-256 seal).
- Audit trail logging via `report_dispatch_logs` with latency metrics and delivery metadata.
- FastAPI REST endpoints under `/api/v1/reporting/schedules`.

## 4. Current State
Report execution was interactive via the SMRITI Reporting Hub and REST endpoints. Automation required manual trigger or external scripts.

## 5. Gap Analysis
- Missing background schedule master model (`ReportSchedule`).
- Missing tamper-evident delivery dispatch log model (`ReportDispatchLog`).
- Missing cron evaluation and multi-channel dispatch orchestrator.
- Missing REST endpoints to create, manage, trigger, and inspect report schedules.

## 6. Architecture Impact
- Enforces Rule 1 & Rule 5: Housed strictly inside FastAPI + PostgreSQL (`backend/app/`).
- Integrates with `ReportRegistryService` and `PerformanceRouter`.
- Extends the core database schema with `report_schedules` and `report_dispatch_logs`.

## 7. Proposed Design
```text
┌─────────────────────────────────────────────────────────────┐
│             SMRITI REPORT DISTRIBUTION ENGINE               │
├─────────────────────────────────────────────────────────────┤
│  1. Cron Evaluator -> (next_run_at calculation)             │
│  2. Report Serialization -> (XLSX / PDF / CSV / JSON)       │
│  3. SHA-256 Forensic Sealing Token Generation               │
│  4. Parallel Dispatch -> asyncio.gather(Email, WA, Vault)   │
│  5. Tamper-evident Audit Logging -> report_dispatch_logs    │
└─────────────────────────────────────────────────────────────┘
```

## 8. Files Created
- `backend/app/schemas/scheduled_reports.py`: Pydantic v2 schemas.
- `backend/app/services/reporting_distribution_svc.py`: Orchestrator and channel dispatchers.
- `backend/app/api/v1/scheduled_reports.py`: REST API endpoints.
- `backend/tests/test_scheduled_reports_engine.py`: Master test suite.
- `docs/implementation/foundation/Automated_Scheduled_Reports_Distribution_Engine_v1.0.0.md`: This plan.
- `docs/walkthrough/foundation/Automated_Scheduled_Reports_Distribution_Engine_v1.0.0.md`: Walkthrough document.

## 9. Files Modified
- `backend/app/models/report_schedule.py`: Enhanced `ReportSchedule` and added `ReportDispatchLog`.
- `backend/app/models/__init__.py`: Exported `ReportDispatchLog`.
- `backend/app/api/v1/__init__.py`: Exported `scheduled_reports`.
- `backend/app/main.py`: Mounted `/api/v1/reporting/schedules`.
- `docs/implementation/README.md`: Updated master index.
- `docs/walkthrough/README.md`: Updated master index.
- `CHANGELOG.md`: Added release notes for v3.72.0.

## 10. Dependencies
- FastAPI 0.115+
- SQLAlchemy 2.0+ Async
- Pydantic v2.10+
- Pytest 9.1+

## 11. Risks
- *Risk:* External channel timeouts (SMTP/WhatsApp network stalls).
  *Mitigation:* Asynchronous concurrency via `asyncio.gather(..., return_exceptions=True)` with per-channel error capture and isolated logging.

## 12. Rollback Strategy
All changes are modular and additive. Revert git commit to return to previous state without impacting interactive report execution.

## 13. Verification Plan
- Unit and integration tests covering cron parsing, serialization, dispatchers, and REST endpoints.
- Verification of 51/51 green tests across all backend test suites.

## 14. Test Plan
- Run `pytest tests/test_scheduled_reports_engine.py -v`.
- Run full backend regression suite `pytest tests/ -v`.

## 15. Documentation Impact
- Update Developer Guide and Architecture documentation.
- Maintain WGP walkthrough records.

## 16. Deployment Plan
- Push to DEV repository.
- Deploy to test environment via `git pull`.
- Rebuild Docker container images.

## 17. Status
Completed & Verified (`51/51 tests green`).

## 18. Related ADRs
- `ADR-001`: FastAPI Sole System-of-Record Architecture.
- `ADR-024`: Governed Metric Dictionary and Canonical Report Registry.

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Automated_Scheduled_Reports_Distribution_Engine_v1.0.0.md`.
