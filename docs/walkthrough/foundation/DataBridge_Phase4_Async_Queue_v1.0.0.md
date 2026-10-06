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
  Classification: Architecture & Implementation Walkthrough — DataBridge Phase 4
-->

# SMRITI Transaction DataBridge Phase 4: High-Volume Asynchronous Import Engine & Chunked Task Queue Walkthrough

## 1. Purpose
This walkthrough documents the technical architecture, design rationale, implementation details, and verification evidence for **Phase 4** of the SMRITI Transaction DataBridge. Phase 4 provides a resilient, asynchronous background ingestion and task queue engine for high-volume enterprise data transfers (> 5,000 rows). It eliminates HTTP request timeout risks, enforces non-blocking concurrency via PostgreSQL transactional outbox staging (`SELECT FOR UPDATE SKIP LOCKED`), commits atomic sub-transactions per chunk slice, records tamper-evident WORM audit logs upon completion, and seamlessly integrates with the frontend DataBridge workspace via real-time progress polling.

---

## 2. Scope
The scope of Phase 4 encompasses:
1. **Asynchronous Contracts & State Machine**:
   - `DataBridgeAsyncJobStatus`: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`.
   - `DataBridgeAsyncSubmitRequest`: Submission contract specifying entity type, rows, chunk size (1 to 1,000; default 200), and optional idempotency key.
   - `DataBridgeAsyncJobResponse`: Immediate HTTP 202 response acknowledging job staging.
   - `DataBridgeJobStatusResponse`: Comprehensive progress query response detailing processed rows, committed records, error counts, progress percent, and chunk milestones.
2. **Transactional Outbox Engine (`DataBridgeAsyncEngine`)**:
   - `submit_job`: Validates payload, checks 24-hour idempotency, computes SHA-256 data digest, stages event in tenant `integration_outbox_events` with `target_channel="DATABRIDGE_ASYNC_JOB"`.
   - `get_job_status`: Inspects staged outbox record and returns real-time metrics.
   - `process_job_chunks`: Executes chunk slices through domain adapters, commits atomic transactions per chunk, updates metrics progressively, and writes a tamper-evident WORM log into `compliance_immutable_audit_logs` on completion.
   - `process_next_job`: Claims eligible pending or processing jobs using non-blocking `SELECT FOR UPDATE SKIP LOCKED` (with optional targeted `job_id`).
   - `cancel_job`: Gracefully aborts pending or processing tasks.
3. **FastAPI REST Endpoints**:
   - `POST /api/v1/databridge/async/submit` (HTTP 202 Accepted)
   - `GET /api/v1/databridge/async/status/{job_id}`
   - `POST /api/v1/databridge/async/process-next`
   - `POST /api/v1/databridge/async/cancel/{job_id}`
4. **Frontend Asynchronous Integration**:
   - Extended `src/components/databridge/databridgeTypes.ts` with async interfaces.
   - Added async API helpers to `src/components/databridge/databridgeService.ts`.
   - Enhanced `src/components/databridge/DataBridgeWorkspace.tsx` to automatically route datasets > 5,000 rows to the asynchronous ingestion pipeline with background polling.
5. **Architecture Preflight Governance**:
   - Issued architecture preflight certificates and registered `databridge.async_engine` capability in `scripts/register_databridge_phase4_architecture.py`.

---

## 3. Files Created
1. `backend/app/services/databridge/async_engine.py`: Canonical transactional outbox processing engine for asynchronous chunked imports.
2. `backend/tests/test_databridge_phase4_async.py`: Comprehensive 7-test automated verification suite for Phase 4.
3. `scripts/register_databridge_phase4_architecture.py`: Governance registration script for capability and preflight certificates.
4. `docs/implementation/foundation/DataBridge_Phase4_Async_Queue_Implementation_Plan_v1.0.0.md`: Formal 19-section IPGP implementation plan.
5. `docs/walkthrough/foundation/DataBridge_Phase4_Async_Queue_v1.0.0.md`: This 13-section WGP walkthrough document.

---

## 4. Files Modified
1. `backend/app/services/databridge/models.py`: Added async request/response models and job status enumeration.
2. `backend/app/services/databridge/__init__.py`: Exported `DataBridgeAsyncEngine` and async contracts.
3. `backend/app/api/v1/databridge.py`: Added REST endpoints `/async/submit`, `/async/status/{job_id}`, `/async/process-next`, `/async/cancel/{job_id}`.
4. `src/components/databridge/databridgeTypes.ts`: Added frontend async job interfaces.
5. `src/components/databridge/databridgeService.ts`: Added async client methods.
6. `src/components/databridge/DataBridgeWorkspace.tsx`: Added threshold-based async routing and polling orchestration.
7. `docs/implementation/README.md`: Synchronized Phase 4 status to `Completed`.
8. `docs/walkthrough/README.md`: Appended Phase 4 entry to master index table.

---

## 5. Architecture Decisions
- **Transactional Outbox Reuse (`integration_outbox_events`)**: Rather than deploying external message brokers (e.g. Celery, Redis, RabbitMQ) which violate zero-external-infrastructure constraints, Phase 4 leverages PostgreSQL tenant-level outbox tables. This guarantees ACID transactions between job staging and tenant state.
- **`SELECT FOR UPDATE SKIP LOCKED` Concurrency**: Worker pumps claim pending jobs using row-level non-blocking locking, preventing double-processing across concurrent API server workers.
- **Chunk-by-Chunk Atomic Commit Cycles**: High-volume imports are processed in discrete slices (default 200 rows). Each chunk executes in its own transaction commit cycle, preventing runaway rollback overhead and long-lived database locks.
- **WORM Audit Preservation**: On job completion, a SHA-256 fingerprint of the committed payload is computed and written to `compliance_immutable_audit_logs` with verified hash chain linkage.

---

## 6. Design Rationale
- **Zero Schema Migrations**: By reusing `IntegrationOutboxEvent` (`target_channel="DATABRIDGE_ASYNC_JOB"`), the entire asynchronous pipeline operates with 100% zero schema migrations and zero live tenant alterations.
- **Progressive Transparency**: High-volume imports report granular metrics (`processed_rows`, `committed_count`, `error_count`, `progress_percent`, `current_chunk`, `total_chunks`), providing full visibility in both the API and UI.
- **Idempotency Protection**: When an idempotency key is supplied, submissions within 24 hours return the existing staged or completed job, guaranteeing safe retries.

---

## 7. Implementation Summary
- **`DataBridgeAsyncEngine.submit_job`**: Validates row boundaries, computes `compliance_sha256`, slices rows into chunks, and writes an outbox record with `status="PENDING"`.
- **`DataBridgeAsyncEngine.process_job_chunks`**: Iterates through chunk slices, calls domain adapter execution methods (`item_adapter`, `customer_adapter`, `supplier_adapter`, `purchase_order_adapter`, `sales_invoice_adapter`, `stock_transfer_adapter`, etc.), commits each slice to PostgreSQL, and aggregates metrics.
- **`DataBridgeAsyncEngine.process_next_job`**: Atomically claims the next pending job via `SELECT FOR UPDATE SKIP LOCKED` or a specifically targeted `job_id`.
- **`DataBridgeWorkspace.tsx`**: Threshold `ASYNC_THRESHOLD_ROWS = 5000` switches execution from synchronous REST to `submitAsyncImport` + polling loop with progress indicators.

---

## 8. Tests Executed
The test suite `backend/tests/test_databridge_phase4_async.py` was executed with 7/7 tests passing:
1. `test_tc_async_001_submit_job_returns_202_accepted`: Verifies HTTP 202 acceptance and outbox record staging.
2. `test_tc_async_002_get_job_status`: Verifies querying initial pending job status and chunk counts.
3. `test_tc_async_003_process_chunks_to_completion`: Verifies progressive chunk processing, 100% completion, and PostgreSQL entity persistence.
4. `test_tc_async_004_worm_audit_log_on_completion`: Verifies tamper-evident WORM log creation in `compliance_immutable_audit_logs`.
5. `test_tc_async_005_idempotent_submission`: Verifies 24-hour duplicate replay safety.
6. `test_tc_async_006_cancel_job`: Verifies graceful job cancellation in payload and outbox record.
7. `test_tc_async_007_rest_endpoints_e2e_lifecycle`: Verifies complete end-to-end REST lifecycle (`/submit` -> `/status` -> `/process-next` -> `/status`).

Full regression test suite across all 7 DataBridge test suites (Phases 1, 2, 3A, 3B, 3C, 3D, and 4) was executed with **66/66 tests passing**.

---

## 9. Verification Results

### Backend Test Results
```
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 7 items

backend\tests\test_databridge_phase4_async.py::test_tc_async_001_submit_job_returns_202_accepted PASSED [ 14%]
backend\tests\test_databridge_phase4_async.py::test_tc_async_002_get_job_status PASSED [ 28%]
backend\tests\test_databridge_phase4_async.py::test_tc_async_003_process_chunks_to_completion PASSED [ 42%]
backend\tests\test_databridge_phase4_async.py::test_tc_async_004_worm_audit_log_on_completion PASSED [ 57%]
backend\tests\test_databridge_phase4_async.py::test_tc_async_005_idempotent_submission PASSED [ 71%]
backend\tests\test_databridge_phase4_async.py::test_tc_async_006_cancel_job PASSED [ 85%]
backend\tests\test_databridge_phase4_async.py::test_tc_async_007_rest_endpoints_e2e_lifecycle PASSED [100%]

================= 7 passed, 22 warnings in 138.55s (0:02:18) ==================
```

### Full DataBridge Regression Test Results (Phases 1 through 4)
```
backend/tests/test_databridge_phase1.py              9 passed [ 13%]
backend/tests/test_databridge_phase2_catalog.py     16 passed [ 37%]
backend/tests/test_databridge_phase3a_party.py      11 passed [ 54%]
backend/tests/test_databridge_phase3b_procurement.py 8 passed [ 66%]
backend/tests/test_databridge_phase3c_sales.py       8 passed [ 78%]
backend/tests/test_databridge_phase3d_inventory.py   7 passed [ 89%]
backend/tests/test_databridge_phase4_async.py        7 passed [100%]

================= 66 passed, 22 warnings in 178.71s (0:02:58) =================
```

### Frontend TypeScript Compiler Gate
```
> smriti-retail-os@6.70.7 lint
> tsc --noEmit

Exit code: 0 (Zero errors)
```

### Architecture Guard & Preflight Verification
```
> smriti-retail-os@6.70.7 architecture:check
> python scripts/architecture_duplication_gate.py

================================================================================
 SMRITI ARCHITECTURE GOVERNANCE — CI / PRE-COMMIT GATE (HARDENED)
================================================================================
 Checks Executed:    11
 P0/P1 Violations:   0
 Registered Debt:    0
--------------------------------------------------------------------------------
 CI GATE STATUS: PASSED — Zero unapproved canonical duplications detected.
================================================================================
```

---

## 10. Known Limitations
- The outbox worker pump is currently triggered via the `/async/process-next` endpoint or synchronous worker cycles. In multi-replica server environments, a standalone cron or background asyncio task scheduler is recommended for automated continuous queue draining.

---

## 11. Future Work
- **Phase 5**: Multi-Format File Streaming & Binary Encoders (Parquet, XLSX chunk streaming, compressed ZIP archives).
- **Phase 6**: Enterprise Bidirectional Synchronization & Scheduled Connectors (Tally, SAP, Marg, Busy ERP).
- **Phase 7**: Comprehensive Strangler-Fig Migration of legacy `exchange.py`.

---

## 12. Related ADRs
- `ADR-DATABRIDGE-01`: SMRITI DataBridge Enterprise Import/Export & Transfer Architecture
- `ADR-0042`: DataBridge Enterprise Architecture & Multi-Tenant Ingress Boundary
- `ADR-0044`: Transactional Outbox Pattern for Asynchronous Enterprise Data Ingestion

---

## 13. Related RFCs
- `RFC-2026-DATABRIDGE-ASYNC-01`: High-Volume Chunked Ingestion & Task Queue Architecture
