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

# Frappe-Inspired Asynchronous Prepared Reports Engine & Universal Report Envelope Plan

## 1. Objective
Modernize the SMRITI Retail OS reporting architecture by adopting Frappe / ERPNext's proven core reporting principles:
1. **Asynchronous Prepared Reports Engine**: Offload heavy multi-month financial and statutory registers to background tasks with deterministic SHA-256 parameter caching, eliminating HTTP 504 reverse proxy timeouts and database worker starvation during peak POS billing hours.
2. **Universal 5-Tuple Standard Report Contract**: Standardize report responses into a uniform schema `(columns, rows, summary_cards, chart, message)` via `/api/v1/reports/universal/{report_id}`.
3. **Interactive Document Link Navigation**: Elevate static report tables into interactive operational command centers where document identifiers (`invoice_no`, `order_no`, `item_code`, `customer_id`) render as clickable navigation badges.
4. **Live Automated Distribution Daemon**: Wire `ReportDistributionEngine` to execute real `ReportsService` queries rather than sample mock datasets.

## 2. Business Motivation
In high-volume retail environments (e.g., supermarket chains, multi-store footwear networks), generating multi-month statutory registers (GSTR-1, GSTR-3B, Sales Register, Stock Movement Ledger) queries tens of thousands of rows. When executed synchronously within client HTTP request cycles:
- Web proxies (Nginx/Cloudflare) terminate connections with 504 Gateway Timeout.
- Heavy analytical aggregation queries saturate PostgreSQL connection pools, blocking real-time POS cash register checkout transactions.
- Lack of standardized output schemas forces frontend components to duplicate rendering, chart binding, and summary metric aggregation logic.
By implementing background prepared report queues and universal envelope contracts, reports execute reliably without blocking cashier terminals, results are cached deterministically by parameter hash, and documents can be drilled down into instantly.

## 3. Scope
- **Backend Models & Storage**:
  - `PreparedReport` model in `backend/app/models/reporting.py` tracking tenant, report code, deterministic SHA-256 parameter hash, execution status, forensic SHA-256 integrity digest, artifact storage path, row count, execution time, and expiration timestamp.
  - Statutory Vault filesystem storage for generated artifacts (`artifacts/statutory_vault/`).
- **Backend Services & API**:
  - `PreparedReportService` (`backend/app/services/prepared_report_service.py`) certified under `ADR-RPT-02`.
  - Universal 5-tuple envelope resolver `ReportsService.get_universal_report_envelope` supporting core business and statutory reports (`RPT-TAX-001`, `RPT-TAX-006`, `RPT-SO-008`, `RPT-SAL-001`, `RPT-INV-001`, etc.).
  - FastAPI endpoints in `backend/app/api/v1/reports.py`:
    - `GET /reports/universal/{report_id}`
    - `POST /reports/prepared/enqueue`
    - `GET /reports/prepared/{task_id}/status`
    - `GET /reports/prepared/{task_id}/download`
  - Integration of live `ReportsService` data into `reporting_distribution_svc.py`.
- **Frontend Architecture**:
  - Updated `SmritiReportEngine.tsx` with async "Prepared Export" trigger, live progress polling, and direct artifact download links.
  - Support for `link` column data types with dynamic navigation routing.

## 4. Current State
- Prior reporting relied on synchronous endpoints (`/reports/sales-summary`, `/reports/gstr1-summary`, etc.).
- Heavy queries risked HTTP timeouts if running over 30–60 seconds.
- Each report defined disparate JSON payload shapes, preventing uniform charting and summary card abstractions.
- Scheduled distribution daemon rendered mock datasets rather than live queries.

## 5. Gap Analysis
| Dimension | Frappe / ERPNext Standard | Prior SMRITI Implementation | Target Modernized SMRITI Architecture |
| :--- | :--- | :--- | :--- |
| **Execution Model** | Background Job via Redis/Celery queue | Synchronous HTTP request-response | Asynchronous Prepared Report Queue (`PreparedReportService`) with background execution |
| **Caching** | Hash-keyed cache of report outputs | None (re-queried every time) | SHA-256 parameter hash caching with TTL and automatic reuse |
| **API Contract** | Universal `(columns, result, message, chart, report_summary)` | Disparate ad-hoc JSON dictionaries | Universal 5-Tuple Envelope: `columns`, `rows`, `summary_cards`, `chart`, `message` |
| **Drill-down Navigation** | Document Link cell click navigation | Static text strings in table cells | Clickable interactive document badges routing to respective view modal / tab |
| **Statutory Sealing** | N/A | None | SHA-256 cryptographic forensic digest sealed in Statutory Vault |

## 6. Architecture Impact
- **Architecture Governance Gate**: Certified under `ADR-RPT-02` with canonical capability `report.prepared_service` and preflight certificate `PF-2026-0911-648C83`.
- **Database Schema**: Added table `prepared_reports` indexed by `(tenant_id, parameters_hash)` and `(tenant_id, status)`.
- **Zero Regression**: Existing dedicated reporting endpoints remain functional; universal envelope and prepared queue are strictly additive.

## 7. Proposed Design
1. **Deterministic Hash Engine**:
   `compute_parameters_hash(report_code, parameters, export_format)` serializes parameter keys in sorted order, generating an invariant SHA-256 digest.
2. **Task Enqueue & Cache Hit**:
   If a completed, unexpired prepared report exists with identical `(tenant_id, parameters_hash)`, status is immediately returned as `COMPLETED` with the cached artifact path.
3. **Background Worker & Sealing**:
   Executes query against PostgreSQL, serializes to CSV/JSON/XLSX, computes SHA-256 file digest, saves artifact to statutory vault, and updates row status to `COMPLETED`.
4. **Universal Contract Envelope**:
   Encapsulates columns with explicit `id`, `name`, `type` (`text`, `number`, `currency`, `date`, `link`), summary cards with visual indicators, and chart configuration.

## 8. Files Created
1. `backend/app/services/prepared_report_service.py` — Canonical prepared report queue, background runner, hash caching, and vault sealing service.
2. `backend/tests/test_prepared_reports.py` — 5-point automated test suite covering hashing determinism, universal envelope, queue caching, background execution, and artifact download streams.
3. `docs/implementation/reports/Frappe_Inspired_Prepared_Reports_And_Universal_Contract_Engine_Plan_v2.0.0.md` — This formal implementation plan.
4. `docs/walkthrough/reports/Prepared_Reports_And_Universal_Contract_Engine_v2.0.0.md` — Walkthrough and verification log.

## 9. Files Modified
1. `backend/app/models/reporting.py` — Added `PreparedReport` model.
2. `backend/app/schemas/reports.py` — Added `UniversalReportEnvelope`, `ReportColumnSchema`, `ReportSummaryCardSchema`, `ReportChartConfigSchema`, `PreparedReportEnqueueRequest`, `PreparedReportStatusResponse`.
3. `backend/app/services/reports.py` — Added `get_universal_report_envelope` method supporting core reports.
4. `backend/app/services/reporting_distribution_svc.py` — Wired live `ReportsService` execution for distribution tasks.
5. `backend/app/api/v1/reports.py` — Added endpoints for universal envelope, enqueue, status, and artifact download.
6. `src/components/export/types.ts` — Added `"link"` to `ColumnDataType`.
7. `src/components/reports/SmritiReportEngine.tsx` — Added prepared report asynchronous queue triggering, polling, download button, and document link cell navigation.

## 10. Dependencies
- Python: `fastapi`, `sqlalchemy`, `pydantic`, `hashlib`, `csv`, `json`.
- TypeScript: `react`, `lucide-react`, standard fetch.
- Infrastructure: PostgreSQL `smriti001`, Statutory Vault local storage.

## 11. Risks
- Large background exports consuming server disk space: Mitigated by 7-day TTL expiration timestamp on `PreparedReport` records and cleanup scheduling.
- Concurrent identical requests: Mitigated by atomic `select for update` or deduplication by `parameters_hash`.

## 12. Rollback Strategy
- Non-destructive database addition (`prepared_reports` table is new).
- Existing report endpoints remain untouched; frontend fallback directly renders standard tables if universal envelope is not invoked.

## 13. Verification Plan
1. Deterministic hashing unit tests validating key order invariance.
2. Universal contract envelope schema compliance tests.
3. Queue caching and background execution unit tests.
4. Architecture CI duplication gate verification (10/10 checks).
5. Frontend TypeScript compilation audit (`tsc --noEmit`).

## 14. Test Plan
- Run `pytest backend/tests/test_prepared_reports.py -v`.
- Run `pytest backend/tests/test_scheduled_reports_engine.py -v`.
- Run `npx tsc --noEmit`.
- Run `python scripts/architecture_duplication_gate.py`.

## 15. Documentation Impact
- Updated `docs/implementation/README.md`.
- Created walkthrough in `docs/walkthrough/reports/`.
- Updated `docs/walkthrough/README.md`.

## 16. Deployment Plan
- Deploy backend service with `artifacts/statutory_vault` directory initialized.
- Apply database migrations for `prepared_reports`.
- Build and bundle frontend with `npm run build`.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-RPT-01`: Scheduled Reports & Statutory Distribution Engine
- `ADR-RPT-02`: Asynchronous Prepared Reports Engine & Universal 5-Tuple Contract

## 19. Related Walkthroughs
- `docs/walkthrough/reports/Prepared_Reports_And_Universal_Contract_Engine_v2.0.0.md`
