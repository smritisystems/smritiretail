<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.80.0
  Created      : 2026-09-11
  Modified     : 2026-09-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Asynchronous Prepared Reports Engine & Universal 5-Tuple Standard Report Contract

## 1. Purpose
This walkthrough documents the architectural modernization of the SMRITI Retail OS reporting system inspired by Frappe / ERPNext:
1. **Asynchronous Prepared Reports Engine**: Offloading large queries and heavy export serialization to background tasks with deterministic SHA-256 parameter hashing to eliminate HTTP 504 reverse proxy timeouts and prevent database worker starvation during peak retail billing hours.
2. **Universal 5-Tuple Standard Report Contract**: Standardizing reporting payloads into a uniform contract `(columns, rows, summary_cards, chart, message)` accessible via `/api/v1/reports/universal/{report_id}`.
3. **Interactive Document Link Navigation**: Enabling interactive document badges in `SmritiReportEngine.tsx` for immediate drill-down navigation.
4. **Live Automated Distribution**: Connecting scheduled reports distribution directly to live database queries.

## 2. Scope
- Backend Database: `PreparedReport` model in `backend/app/models/reporting.py`.
- Backend Schemas: Universal envelope and prepared report DTOs in `backend/app/schemas/reports.py`.
- Backend Services:
  - `backend/app/services/prepared_report_service.py` (certified under `ADR-RPT-02`, preflight certificate `PF-2026-0911-648C83`).
  - `backend/app/services/reports.py` (universal envelope resolver).
  - `backend/app/services/reporting_distribution_svc.py` (live execution wiring).
- Backend API: REST endpoints in `backend/app/api/v1/reports.py`.
- Frontend Components: `src/components/reports/SmritiReportEngine.tsx` and `src/components/export/types.ts`.
- Automated Test Suites: `backend/tests/test_prepared_reports.py` and `backend/tests/test_scheduled_reports_engine.py`.

## 3. Files Created
1. `backend/app/services/prepared_report_service.py` — Canonical prepared report queue, cache, and statutory vault sealing service.
2. `backend/tests/test_prepared_reports.py` — 5-point automated verification test suite.
3. `docs/implementation/reports/Frappe_Inspired_Prepared_Reports_And_Universal_Contract_Engine_Plan_v2.0.0.md` — Formal implementation plan.
4. `docs/walkthrough/reports/Prepared_Reports_And_Universal_Contract_Engine_v2.0.0.md` — This walkthrough document.

## 4. Files Modified
1. `backend/app/models/reporting.py` — Added `PreparedReport` model with status, parameters hash, and forensic hash.
2. `backend/app/schemas/reports.py` — Added `UniversalReportEnvelope`, `ReportColumnSchema`, `ReportSummaryCardSchema`, `ReportChartConfigSchema`, `PreparedReportEnqueueRequest`, `PreparedReportStatusResponse`.
3. `backend/app/services/reports.py` — Implemented `get_universal_report_envelope` method supporting core business reports.
4. `backend/app/services/reporting_distribution_svc.py` — Integrated live report query execution.
5. `backend/app/api/v1/reports.py` — Added endpoints for universal envelope, enqueue, status polling, and artifact streaming.
6. `src/components/export/types.ts` — Added `"link"` to `ColumnDataType`.
7. `src/components/reports/SmritiReportEngine.tsx` — Enhanced with async prepared export button, live task polling, artifact download link, and document link cells.

## 5. Architecture Decisions
- **ADR-RPT-02**: Certified canonical capability `report.prepared_service` owned by `PreparedReportService`.
- **Statutory Vault Sealing**: Background artifacts are saved to `artifacts/statutory_vault/` and sealed with a SHA-256 digest recorded in the database.
- **Deterministic Parameter Caching**: Parameters are normalized and serialized with sorted keys to create an invariant SHA-256 hash `parameters_hash`, enabling instant cache reuse for identical queries within the expiration TTL.

## 6. Design Rationale
In high-throughput retail environments, analytical queries running against active transactional databases risk resource contention with POS billing operations. Synchronous HTTP responses on large datasets are vulnerable to proxy timeouts (e.g. 504 Gateway Timeout). By decoupling report generation into asynchronous prepared tasks, the frontend can query status progressively, and cached artifacts can be served immediately without redundant query execution.

## 7. Implementation Summary
- **Cache Deduplication**: `PreparedReportService.compute_parameters_hash` calculates the deterministic SHA-256 hash. When a task is enqueued, existing completed and unexpired runs are returned instantly.
- **Background Worker**: `execute_task_background` executes the underlying report, generates the export artifact (CSV/JSON/XLSX), writes it to the statutory vault, and updates status with row counts and execution timing.
- **Universal Envelope**: Standardized contract with 5 components:
  1. `columns`: Column definitions with data types including `link`.
  2. `rows`: Tabular data rows.
  3. `summary_cards`: High-level aggregated KPI metrics.
  4. `chart`: Visualization metadata with labels and datasets.
  5. `message`: Contextual or statutory notes.
- **Frontend Integration**: `SmritiReportEngine.tsx` provides an interactive "Prepared Export" action with status progress bar and download trigger, alongside clickable document links.

## 8. Tests Executed
1. **Prepared Reports Test Suite (`backend/tests/test_prepared_reports.py`)**:
   - `test_parameter_hash_determinism_and_key_ordering` — PASSED
   - `test_universal_report_envelope_schema_contract` — PASSED
   - `test_prepared_report_enqueue_and_cache_reuse` — PASSED
   - `test_prepared_report_background_execution_and_sealing` — PASSED
   - `test_prepared_report_artifact_stream` — PASSED
2. **Scheduled Reports Engine Suite (`backend/tests/test_scheduled_reports_engine.py`)**:
   - `test_01_cron_evaluator_deterministic_next_run` — PASSED
   - `test_02_schedule_crud_lifecycle` — PASSED
   - `test_03_multi_format_payload_rendering` — PASSED
   - `test_04_multi_channel_dispatchers` — PASSED
   - `test_05_schedule_execution_and_forensic_sealing` — PASSED
   - `test_06_fastapi_scheduled_reports_endpoints` — PASSED
3. **Frontend TypeScript Compilation (`npx tsc --noEmit`)**:
   - 0 errors, clean exit.
4. **Architecture Duplication Gate (`scripts/architecture_duplication_gate.py`)**:
   - 10 checks executed, 0 P0/P1 violations.

## 9. Verification Results
- All unit, integration, and contract tests passed with 100% green status.
- Zero TypeScript syntax or type errors.
- Preflight certificate `PF-2026-0911-648C83` successfully issued and validated.

## 10. Known Limitations
- Current background worker runs as an asynchronous coroutine inside the FastAPI event loop; for distributed multi-node deployments, Celery or an external queue broker (e.g. Redis/RabbitMQ) will be integrated in Phase 3.
- Chart rendering on the frontend supports bar and line types; radar and treemap visualizations are reserved for future phases.

## 11. Future Work
- Integration with external Redis worker pool for multi-server scalability.
- User-customizable column ordering and filter presets stored per user profile.
- Direct statutory e-filing export integration from prepared report vault.

## 12. Related ADRs
- `ADR-RPT-01`: Scheduled Reports & Statutory Distribution Engine
- `ADR-RPT-02`: Asynchronous Prepared Reports Engine & Universal 5-Tuple Contract

## 13. Related RFCs
- `RFC-RPT-2026-01`: Standardized Reporting API and Universal Envelopes
