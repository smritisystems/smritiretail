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

# Walkthrough: Automated Scheduled Reports & Distribution Engine (v1.0.0-GA)

## 1. Purpose
Documents the implementation and verification of the SMRITI Automated Scheduled Reports & Multi-Channel Distribution Engine, enabling unattended scheduled report generation, format serialization, parallel delivery, and forensic audit sealing.

## 2. Scope
- Cron expression evaluation and deterministic scheduling.
- Multi-format serialization (`XLSX`, `PDF`, `CSV`, `JSON`).
- Multi-channel delivery connectors (`EmailDispatcher`, `WhatsAppDispatcher`, `StatutoryVaultDispatcher`).
- Tamper-evident forensic audit logging with SHA-256 seal.
- REST API endpoints under `/api/v1/reporting/schedules`.

## 3. Files Created
- `backend/app/schemas/scheduled_reports.py`
- `backend/app/services/reporting_distribution_svc.py`
- `backend/app/api/v1/scheduled_reports.py`
- `backend/tests/test_scheduled_reports_engine.py`
- `docs/implementation/foundation/Automated_Scheduled_Reports_Distribution_Engine_v1.0.0.md`
- `docs/walkthrough/foundation/Automated_Scheduled_Reports_Distribution_Engine_v1.0.0.md`

## 4. Files Modified
- `backend/app/models/report_schedule.py`
- `backend/app/models/__init__.py`
- `backend/app/api/v1/__init__.py`
- `backend/app/main.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Asynchronous Parallel Dispatch:** Use `asyncio.gather(..., return_exceptions=True)` to dispatch reports concurrently to Email, WhatsApp, and Statutory Vaults without cross-channel blocking.
2. **SHA-256 Forensic Integrity Token:** Compute `SHA256(payload + schedule_id + report_code + timestamp)` and record it in `report_dispatch_logs` to seal report authenticity.
3. **Deterministic Cron Parsing:** `CronEvaluator` parses 5-part cron expressions to compute strict `next_run_at` UTC timestamps.

## 6. Design Rationale
Decoupling the distribution engine into pluggable dispatchers (`EmailDispatcher`, `WhatsAppDispatcher`, `StatutoryVaultDispatcher`) ensures that adding new delivery mechanisms (e.g. S3, SFTP, Webhooks) requires no modifications to the core orchestrator or reporting registry.

## 7. Implementation Summary
- **Schedule Management:** Full CRUD REST endpoints for schedules under `/api/v1/reporting/schedules`.
- **Immediate Trigger:** Ad-hoc manual execution via `POST /api/v1/reporting/schedules/{id}/trigger`.
- **Forensic Logs:** Comprehensive audit history under `GET /api/v1/reporting/schedules/{id}/logs`.

## 8. Tests Executed
```bash
python -m pytest tests/test_scheduled_reports_engine.py tests/test_sgip_einvoice_ewaybill.py tests/test_reporting_certification_suite.py tests/test_reporting_api_endpoints.py tests/test_report_registry_governance.py tests/test_report_security_and_performance.py tests/test_inventory_snapshots_and_lineage.py -v
```

## 9. Verification Results
- **Engine Tests:** 6/6 tests passed (100% green).
- **Backend Full Suite:** 51/51 tests passed across 7 test files in 18.21s.
- **Frontend Test Suite:** 347/347 tests passed across 44 test files in 7.46s.

## 10. Known Limitations
- Background worker loop currently triggers on-demand or via manual API trigger; standing background cron loop can be hooked to Celery / temporal workers in cluster mode.

## 11. Future Work
- Integration with AWS S3 / Azure Blob Storage vault drivers for multi-cloud archiving.
- Push notification channel via Firebase Cloud Messaging (FCM).

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-024`: Governed Metric Dictionary & Canonical Report Registry.

## 13. Related RFCs
- `RFC-089`: SMRITI Automated Report Scheduling & Distribution Architecture.
