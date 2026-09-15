<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.27.0
  Created      : 2026-09-16
  Modified     : 2026-09-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: System Architecture Walkthrough — Stage 5
-->

# Stage 5: Transactional Postgres Outbox Engine & Worker Daemon

**Walkthrough ID:** WLK-ARCH-008  
**Version:** v6.27.0  
**Date:** 2026-09-16  
**Sprint:** Platform Kernel Stage 5 & Outbox Worker Engine  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  

---

## 1. Purpose

Implement and verify the Stage 5 Transactional PostgreSQL Outbox Engine and Outbox Worker Daemon. This implementation bridges the Stage 4 contract-first `PlatformEventService` with PostgreSQL multi-tenant databases (`smritiXXX`) to guarantee at-least-once, crash-resilient asynchronous event delivery without dual-write hazards.

---

## 2. Scope

| Area | Component | Action | Verification |
| :--- | :--- | :--- | :--- |
| **Outbox Engine** | `app.platform.events.postgres_outbox` | Created | 7/7 Tests Green (`test_postgres_outbox_worker.py`) |
| **Outbox Worker** | `app.platform.events.outbox_worker` | Created | Two-phase non-blocking batch claim and dispatch verified |
| **Service Integration** | `app.platform.events.service` | Modified | Added `stage_event` helper with registry validation |
| **Serialization & Registry** | `serializer.py`, `registry.py` | Modified | Added `to_dict`, `from_dict`, and `validate` helpers |
| **TypeScript Parity** | `src/kernel/events.ts` | Modified | `npm run build` Passing Clean (3,547 modules) |
| **Test Suite** | `backend/tests/test_postgres_outbox_worker.py` | Created | 7/7 Pytest tests passing |

---

## 3. Files Created

| File | Purpose |
| :--- | :--- |
| `backend/app/platform/events/postgres_outbox.py` | Concrete `PostgresEventOutbox` implementing `IEventOutbox` with `SELECT FOR UPDATE SKIP LOCKED` |
| `backend/app/platform/events/outbox_worker.py` | Resilient asynchronous daemon `PlatformOutboxWorker` |
| `backend/tests/test_postgres_outbox_worker.py` | Comprehensive verification suite testing atomicity, rollback, claiming, retries, and DLQ |
| `docs/implementation/foundation/Stage5_Transactional_Postgres_Outbox_Engine_v6.27.0.md` | IPGP implementation plan |
| `docs/walkthrough/architecture/Stage5_Transactional_Postgres_Outbox_Engine_And_Worker_Daemon_v6.27.0.md` | This WGP walkthrough |

---

## 4. Files Modified

| File | Changes Made |
| :--- | :--- |
| `backend/app/platform/events/outbox.py` | Enriched `IEventOutbox` with batch claiming and session methods |
| `backend/app/platform/events/service.py` | Added `stage_event` helper with schema validation |
| `backend/app/platform/events/registry.py` | Added `validate` helper |
| `backend/app/platform/events/serializer.py` | Added `to_dict` and `from_dict` helpers |
| `backend/app/platform/events/__init__.py` | Exported `PostgresEventOutbox` and `PlatformOutboxWorker` |
| `src/kernel/events.ts` | Added `OutboxRecord`, `OutboxStatus`, `OutboxWorkerStats`, and updated `IEventOutbox` |
| `docs/implementation/README.md` | Registered Stage 5 implementation plan |
| `docs/walkthrough/README.md` | Registered this walkthrough in master index |
| `CHANGELOG.md` | Recorded Stage 5 milestone |

---

## 5. Architecture Decisions

### Decision 1: Two-Phase Non-Blocking Batch Dispatch
To prevent long-lived database row locks during network or broker operations, the outbox worker implements a strict two-phase dispatch pattern:
- **Phase 1 (Lock & Lease):** Query eligible records with `SELECT ... FOR UPDATE SKIP LOCKED`, set `status='PROCESSING'`, set lease expiry (`claim_expires_at = now + claim_timeout`), and commit immediately.
- **Phase 2 (Publish Outside Lock):** Iterate through claimed envelopes and publish via `PlatformEventService.publish(envelope)`. Zero database row locks are held during this phase.
- **Phase 3 (Settle):** In a quick subsequent transaction, mark successfully published records as `DISPATCHED` or schedule failed ones with exponential backoff (`status='FAILED'`).

### Decision 2: Zombie Lease Recovery
If a worker daemon terminates abruptly (e.g. host crash or SIGKILL) while processing a batch, records remain in `PROCESSING` state. The eligibility criteria explicitly checks `(status == 'PROCESSING' AND claim_expires_at <= now)`. When another worker cycle runs, it safely re-claims the zombie events and resumes delivery.

### Decision 3: Channel Isolation (`PLATFORM_EVENTS`)
To ensure complete isolation from legacy queue records (such as `PSV_QUEUE` or external webhooks), the Stage 5 outbox operates strictly with `target_channel="PLATFORM_EVENTS"` by default, preventing cross-subsystem interference.

---

## 6. Design Rationale

1. **Transactional Integrity:** By staging the event inside the active domain `AsyncSession`, the outbox record commits or aborts synchronously with the business ledger write (sales invoice, payment receipt, stock movement), eliminating dual-write hazards.
2. **Crash Resilience:** Events remain securely stored in PostgreSQL until the transport publisher confirms receipt.
3. **Dead Letter Queue (DLQ):** Repeated failures transition to `DEAD_LETTER` after `max_retries` (default 5), preventing toxic messages from permanently stalling the outbox queue.

---

## 7. Implementation Summary

- **Staging:** `PostgresEventOutbox.stage()` persists `IntegrationOutboxEvent` with serialized `payload_json`.
- **Claiming:** `PostgresEventOutbox.fetch_pending_and_claim()` claims pending and retryable events via `SKIP LOCKED`.
- **Settlement:** `mark_dispatched_with_session()` and `mark_failed_with_session()` handle lifecycle updates.
- **Worker Daemon:** `PlatformOutboxWorker` manages polling, immediate wake events, and cycle metrics.

---

## 8. Tests Executed

### Test Suite 1: Postgres Outbox Worker (`test_postgres_outbox_worker.py`)
```powershell
python -m pytest backend/tests/test_postgres_outbox_worker.py -v
```
Literal output:
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0 -- C:\Users\netma\AppData\Local\Programs\Python\Python313\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collecting ... collected 7 items

backend\tests\test_postgres_outbox_worker.py::test_outbox_stage_and_rollback PASSED [ 14%]
backend\tests\test_postgres_outbox_worker.py::test_outbox_stage_and_commit PASSED [ 28%]
backend\tests\test_postgres_outbox_worker.py::test_outbox_fetch_pending_and_claim_skip_locked PASSED [ 42%]
backend\tests\test_postgres_outbox_worker.py::test_outbox_zombie_claim_recovery PASSED [ 57%]
backend\tests\test_postgres_outbox_worker.py::test_platform_outbox_worker_end_to_end PASSED [ 71%]
backend\tests\test_postgres_outbox_worker.py::test_outbox_retry_and_dead_letter_routing PASSED [ 85%]
backend\tests\test_postgres_outbox_worker.py::test_platform_event_service_stage_event_facade PASSED [100%]

============================== 7 passed in 6.61s ==============================
```

### Test Suite 2: Stage 4 Platform Event Service Regression (`test_platform_event_service.py`)
```powershell
python -m pytest backend/tests/test_platform_event_service.py -v
```
Literal output:
```text
============================== 9 passed in 3.37s ==============================
```

### Test Suite 3: Frontend TypeScript Production Build
```powershell
npm run build
```
Literal output:
```text
✓ 3547 modules transformed.
✓ built in 32.30s
```

---

## 9. Verification Results

```text
Stage 5 Platform Outbox Engine — 7-Point Completion Verification

✓ Atomic Rollback (Discard on rollback): PASSED
✓ Atomic Commit (Persisted with PENDING): PASSED
✓ Concurrency & Non-blocking Claim (SELECT FOR UPDATE SKIP LOCKED): PASSED
✓ Zombie Lease Recovery (Expired PROCESSING claims renewed): PASSED
✓ End-to-End Worker Cycle (PlatformOutboxWorker -> PlatformEventService): PASSED
✓ Retry Backoff & Dead Letter Queue (Exponential backoff & DEAD_LETTER transition): PASSED
✓ PlatformEventService Staging Facade (Registry validation & delegation): PASSED

Evidence Level: Level A (Directly Observable PostgreSQL & Pytest Execution)
```

---

## 10. Known Limitations

1. **Multi-Tenant Polling Sequence:** In the single-worker setup, tenant databases are polled sequentially per cycle. A multi-process distributed supervisor can be added in future stages for high-throughput multi-tenant sharding.
2. **Channel Filtering:** Default channel is set to `PLATFORM_EVENTS`; callers wishing to route to legacy channels must specify `target_channel` in envelope metadata.

---

## 11. Future Work

1. **Distributed Outbox Supervisor:** Multi-threaded/multi-process worker supervisor managing tenant database pools concurrently.
2. **Outbox Clean-up / Archival Job:** Scheduled cron job to archive or purge `DISPATCHED` records older than 30 days.
3. **Stage 6 Notification Consumer:** Wire `NotificationService` to consume outbox-dispatched events for customer alerts.

---

## 12. Related ADRs

- `docs/adr/ADR-005-One-Way-Canonical-Master-To-Compatibility-Projection-Architecture.md`

---

## 13. Related RFCs

- `RFC-PLAT-004: Stage 4 Platform Event Service Architecture`
- `RFC-PLAT-005: Transactional Outbox Worker Daemon Architecture`
