<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-06
  Modified     : 2026-10-06
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal — Implementation Plan (IPGP-v1.0)
-->

# SMRITI Transaction DataBridge Phase 4 — High-Volume Asynchronous Import Engine & Chunked Task Queue Implementation Plan

**Plan ID:** IP-DATABRIDGE-PHASE4-ASYNC-v1.0.0  
**Status:** In Progress  
**Area:** Foundation & Data Subsystems (`foundation`)  
**Target Capability:** `databridge.async_engine` (`DATABRIDGE`)  
**Governing Policies:** Universal Author Details & File Header Policy (UADHP), Implementation Plan Governance Policy (IPGP), Walkthrough Governance Policy (WGP), Human-Readable Error Policy (HREP), Multi-Tenant Ownership Contract (`ownership.py`).

---

## 1. Objective
Establish an enterprise-grade, high-volume asynchronous execution engine and chunked task queue for SMRITI DataBridge. Enable seamless ingestion, progressive validation, and atomic commit of datasets exceeding 5,000 rows (up to 50,000+ rows) without synchronous HTTP gateway timeouts, memory bloat, or UI freezes, backed by PostgreSQL's canonical Transactional Outbox table (`integration_outbox_events`).

---

## 2. Business Motivation
Enterprise retailers migrating to SMRITI Retail OS frequently import extensive historical catalogs, opening stock balances, full customer/supplier registries, and years of transactional records. Running synchronous HTTP requests for payloads $>5,000$ rows introduces:
1. HTTP 504 Gateway Timeout errors on proxies and load balancers.
2. Web browser connection drops resulting in indeterminate commit states.
3. High memory spikes on the FastAPI application server.
4. Total blindness for store operators with zero real-time progress visibility.

Phase 4 solves these operational bottlenecks by decoupling payload staging from execution, streaming chunked transactions in the background, and exposing deterministic polling and progress telemetry.

---

## 3. Scope
- **In-Scope**:
  - Asynchronous import submission endpoint (`POST /api/v1/databridge/async/submit`) returning `HTTP 202 Accepted` with a deterministic `job_id`.
  - Transactional staging in canonical tenant table `integration_outbox_events` with `target_channel="DATABRIDGE_ASYNC_JOB"`.
  - Non-blocking task claiming and chunked execution runner (`DataBridgeAsyncEngine`) processing payloads in configurable chunks (default 500-1,000 rows).
  - Progressive telemetry endpoint (`GET /api/v1/databridge/async/status/{job_id}`) providing real-time metrics (`progress_percent`, `processed_rows`, `committed_count`, `error_count`, `current_chunk`, `total_chunks`).
  - Worker pump endpoint (`POST /api/v1/databridge/async/process-next`) and cancellation endpoint (`POST /api/v1/databridge/async/cancel/{job_id}`).
  - Full adapter delegation to all Phase 2, 3A, 3B, 3C, and 3D domain adapters.
  - Final tamper-evident WORM audit logging in `compliance_immutable_audit_logs`.
  - Frontend TypeScript models and client services in `databridgeTypes.ts` and `databridgeService.ts`.
- **Out-of-Scope**:
  - Third-party message brokers (Celery, Redis, RabbitMQ); SMRITI strictly uses PostgreSQL transactional outbox.
  - Automatic external file crawler daemons (FTP/SFTP ingestion).

---

## 4. Current State
- Phases 1, 2, 3A, 3B, 3C, and 3D provide synchronous `/preview` and `/commit` endpoints capped at `MAX_SYNC_ROWS = 5000`.
- Datasets exceeding 5,000 rows raise `DataBridgePayloadTooLargeError` (`HTTP 413 Payload Too Large`).
- `integration_outbox_events` exists in tenant databases and is actively utilized by `PostgresEventOutbox` for domain event delivery, but lacks DataBridge chunked import task execution handling.

---

## 5. Gap Analysis
1. **No Async Ingress Endpoint**: Clients cannot submit files $> 5,000$ rows without triggering synchronous payload size rejections.
2. **Missing Chunked Execution Engine**: No mechanism exists to partition high-volume payloads into discrete database transactions and report incremental progress.
3. **Missing Polling & Status Contract**: The frontend cannot query the execution progress or retrieve granular error breakdowns for background jobs.
4. **No Job Lifecycle Management**: No capability to cancel a runaway or misconfigured import job in progress.

---

## 6. Architecture Impact
```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT / OPERATOR                                    │
│       DataBridge Workspace / API Client submits high-volume file (>5,000 rows)         │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ POST /api/v1/databridge/async/submit
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              FASTAPI CONTROLLER & INGRESS                              │
│       1. Authenticate & Verify Entitlement (DATABRIDGE)                                │
│       2. Digest SHA-256 Checksum & Validate Schema                                     │
│       3. Stage into integration_outbox_events (target_channel=DATABRIDGE_ASYNC_JOB)    │
│       4. Return HTTP 202 Accepted with job_id                                          │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                       DATABRIDGE ASYNC ENGINE (Outbox Worker)                          │
│       1. Claims Job via SELECT FOR UPDATE SKIP LOCKED                                  │
│       2. Slices rows into chunks of 500 - 1,000 rows                                   │
│       3. Dispatches each chunk to canonical DataBridge Adapter (Item, Sales, etc.)     │
│       4. Commits chunk transaction & increments processed_rows & progress_percent      │
│       5. Upon completion: Records WORM Audit Log & marks status = COMPLETED            │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          PROGRESS & STATUS TELEMETRY                                   │
│       GET /api/v1/databridge/async/status/{job_id} -> returns real-time progress %     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Proposed Design

### 7.1 Backend Models (`backend/app/services/databridge/models.py`)
- `DataBridgeAsyncJobStatus`: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`.
- `DataBridgeAsyncSubmitRequest`: `entity_type`, `rows`, `chunk_size` (default 500, min 50, max 2000), `file_format`, `filename`, `idempotency_key`, `preview_only`.
- `DataBridgeAsyncJobResponse`: `job_id`, `status`, `total_rows`, `chunk_size`, `entity_type`, `created_at`, `message`.
- `DataBridgeJobStatusResponse`: `job_id`, `status`, `entity_type`, `total_rows`, `processed_rows`, `committed_count`, `error_count`, `progress_percent`, `current_chunk`, `total_chunks`, `started_at`, `completed_at`, `compliance_sha256`, `error_message`, `summary`.

### 7.2 Async Engine Service (`backend/app/services/databridge/async_engine.py`)
- `DataBridgeAsyncEngine.submit_job(...)`: Validates request, checks 24-hour idempotency cache, creates and stages `IntegrationOutboxEvent`.
- `DataBridgeAsyncEngine.get_job_status(...)`: Fetches `IntegrationOutboxEvent` from tenant DB, maps payload fields to `DataBridgeJobStatusResponse`.
- `DataBridgeAsyncEngine.process_next_job(...)` and `process_job_chunks(...)`:
  - Uses `SELECT ... FOR UPDATE SKIP LOCKED`.
  - Loops over pending chunks.
  - Calls `adapter.commit(...)` per chunk within an isolated transaction.
  - Progressively flushes metrics into `payload_json`.
  - Upon final chunk, logs WORM audit to `ComplianceImmutableAuditLog`.
- `DataBridgeAsyncEngine.cancel_job(...)`: Sets status to `CANCELLED` if not already completed.

### 7.3 API Routes (`backend/app/api/v1/databridge.py`)
- `POST /api/v1/databridge/async/submit`
- `GET /api/v1/databridge/async/status/{job_id}`
- `POST /api/v1/databridge/async/process-next`
- `POST /api/v1/databridge/async/cancel/{job_id}`

### 7.4 Frontend Integration
- Types in `src/components/databridge/databridgeTypes.ts`.
- Methods in `src/components/databridge/databridgeService.ts`.
- Dynamic polling loop in `src/components/databridge/DataBridgeWorkspace.tsx`.

---

## 8. Files Created
1. `backend/app/services/databridge/async_engine.py`: Core asynchronous outbox engine and chunk worker.
2. `backend/tests/test_databridge_phase4_async.py`: Automated test suite for Phase 4.
3. `scripts/register_databridge_phase4_architecture.py`: Architecture preflight registration script.
4. `docs/walkthrough/foundation/DataBridge_Phase4_Async_Queue_v1.0.0.md`: Formal 13-section walkthrough.

---

## 9. Files Modified
1. `backend/app/services/databridge/models.py`: Added async job requests, responses, and enum contracts.
2. `backend/app/services/databridge/__init__.py`: Exported `DataBridgeAsyncEngine` and new models.
3. `backend/app/api/v1/databridge.py`: Added 4 async endpoints.
4. `src/components/databridge/databridgeTypes.ts`: Added frontend async job types.
5. `src/components/databridge/databridgeService.ts`: Added async submission and polling helper methods.
6. `src/components/databridge/DataBridgeWorkspace.tsx`: Added high-volume async polling handling.
7. `docs/implementation/README.md`: Appended Phase 4 entry.

---

## 10. Dependencies
- `IntegrationOutboxEvent` (`backend/app/models/outbox.py`).
- `ComplianceImmutableAuditLog` (`backend/app/models/audit.py`).
- Domain Adapters: `DataBridgeItemAdapter`, `DataBridgeCustomerAdapter`, `DataBridgeSupplierAdapter`, `DataBridgeSalesInvoiceAdapter`, `DataBridgePurchaseOrderAdapter`, `DataBridgeStockTransferAdapter`, `DataBridgeStockAuditAdapter`.

---

## 11. Risks
| Risk | Severity | Mitigation |
|---|---|---|
| Zombie job lock if worker process crashes mid-chunk | Medium | Outbox `claim_expires_at` lease timeout pattern automatically releases stale locks. |
| Incomplete import if later chunk fails | Medium | Each chunk is committed in an isolated database transaction, recording exact processed rows, committed count, and error summary. |
| Outbox table bloat | Low | Processed jobs have `status = 'COMPLETED'` and can be pruned by standard tenant maintenance tasks. |

---

## 12. Rollback Strategy
All changes are code-only in `backend/app/services/databridge/` and `src/components/databridge/`. No database migrations or schema alterations are executed. Reverting git commits restores prior synchronous behavior cleanly.

---

## 13. Verification Plan
- Verify zero database migrations.
- Verify `npm run lint` and `npm run architecture:check` pass with zero violations.
- Verify all 7 automated test cases pass in `backend/tests/test_databridge_phase4_async.py`.
- Verify full regression suite across Phase 1, 2, 3A, 3B, 3C, 3D, and 4 (66+ tests).

---

## 14. Test Plan
- `test_tc_async_001_submit_job_returns_202_accepted`: Verifies submission and staging of async job.
- `test_tc_async_002_get_job_status_pending`: Verifies initial pending state and total rows.
- `test_tc_async_003_process_chunks_to_completion`: Verifies chunk-by-chunk processing, metric increments, and completion.
- `test_tc_async_004_worm_audit_log_created_on_completion`: Verifies immutable audit entry created with valid hash.
- `test_tc_async_005_idempotent_submission`: Verifies duplicate submit returns existing job without re-processing.
- `test_tc_async_006_cancel_job`: Verifies clean job cancellation.
- `test_tc_async_007_tenant_isolation_boundary`: Verifies cross-tenant protection.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create `docs/walkthrough/foundation/DataBridge_Phase4_Async_Queue_v1.0.0.md`.
- Update `docs/walkthrough/README.md`.

---

## 16. Deployment Plan
- Zero schema migration requirement.
- Hot code rollout across FastAPI backend and React frontend.

---

## 17. Status
Completed

---

## 18. Related ADRs
- `ADR-0042`: DataBridge Enterprise Architecture & Multi-Tenant Ingress Boundary
- `ADR-0044`: Transactional Outbox Pattern for Asynchronous Enterprise Data Ingestion

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/DataBridge_Phase4_Async_Queue_v1.0.0.md`
