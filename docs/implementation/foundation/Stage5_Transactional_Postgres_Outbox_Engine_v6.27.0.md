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
  Classification: Platform Kernel Implementation Plan — Stage 5
-->

# Stage 5: Transactional Postgres Outbox Engine & OutboxWorker

**Plan ID:** IPGP-FND-044  
**Version:** v6.27.0  
**Date:** 2026-09-16  
**Status:** Completed  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  

---

## 1. Objective
Implement the concrete, production-ready `PostgresEventOutbox` and `PlatformOutboxWorker` daemon for SMRITI Retail OS, fulfilling the Stage 5 Platform Kernel roadmap. This bridges the Stage 4 contract-first `PlatformEventService` with PostgreSQL multi-tenant databases (`smritiXXX`) to guarantee at-least-once, crash-resilient asynchronous event delivery without dual-write hazards.

## 2. Business Motivation
In enterprise retail and ERP operations, business mutations (such as sales invoice issuance, inventory ledger postings, branch stock dispatches, and statutory tax filings) must be committed atomically with domain events (such as `billing.invoice.issued` and `inventory.stock.depleted`). Directly publishing to external brokers inside an active database transaction leads to catastrophic dual-write hazards:
1. If the database commits but the broker connection drops, downstream analytics and accounting consumers lose events forever.
2. If the broker accepts the event but the database transaction subsequently encounters an error or rolls back, downstream services act on phantom operations.
The Transactional Outbox pattern guarantees that event envelopes are staged within the exact same SQL transaction as domain operations, then asynchronously claimed and dispatched via `SELECT ... FOR UPDATE SKIP LOCKED`.

## 3. Scope
| Area | Component | Action | Details |
| :--- | :--- | :--- | :--- |
| **Outbox Engine** | `backend/app/platform/events/postgres_outbox.py` | Created | Concrete `PostgresEventOutbox(IEventOutbox)` managing `IntegrationOutboxEvent` ORM records |
| **Outbox Worker** | `backend/app/platform/events/outbox_worker.py` | Created | Resilient background polling daemon (`PlatformOutboxWorker`) executing two-phase non-blocking batch claim and dispatch |
| **Kernel Interface** | `backend/app/platform/events/outbox.py` | Modified | Enriched `IEventOutbox` with batch claiming and session methods |
| **Service Integration** | `backend/app/platform/events/service.py` | Modified | Added `stage_event` helper and validation before outbox insertion |
| **TypeScript Parity** | `src/kernel/events.ts` | Modified | Added `OutboxRecord`, `OutboxStatus`, `OutboxWorkerStats`, and updated `IEventOutbox` contract |
| **Verification Suite** | `backend/tests/test_postgres_outbox_worker.py` | Created | 7-criterion unit, concurrency, rollback, retry, and DLQ test suite (7/7 Green) |

## 4. Current State
- `IEventOutbox` previously existed only as an abstract interface stub without concrete database bindings.
- Legacy outbox dispatch code was embedded in domain analytics modules rather than the platform kernel.
- Events lacked a unified serialization bridge connecting `EventEnvelope[T]` to `integration_outbox_events.payload_json`.

## 5. Gap Analysis
1. **Missing Concrete Adapter:** No adapter existed connecting `IEventOutbox` to `IntegrationOutboxEvent` and `EventSerializer`.
2. **Missing Stage 5 Worker:** No worker daemon connected the database outbox rows directly to `PlatformEventService.publish(envelope)`.
3. **Missing Zombie Lease Recovery:** If an outbox worker crashed mid-batch, events risked stalling unless a zombie lease recovery mechanism (`claim_expires_at <= now`) reclaimed them.

## 6. Architecture Impact
- Enforces strict two-phase non-blocking dispatch:
  - **Phase 1 (Atomic Claim):** Row locks acquired via `SELECT ... FOR UPDATE SKIP LOCKED`, records transitioned to `status='PROCESSING'`, and claim lease committed.
  - **Phase 2 (Publish Outside Lock):** Calls `PlatformEventService.publish(envelope)` with zero database row locks held, preventing database lock contention.
  - **Phase 3 (Settle):** Fast update to `DISPATCHED` or `FAILED` / `DEAD_LETTER` with exponential backoff scheduling.
- Zero external broker lock-in: Operates natively with standard PostgreSQL DDL and integrates with any `IEventTransport`.

## 7. Proposed Design
- `PostgresEventOutbox`:
  - `stage()` converts typed `EventEnvelope[T]` to `IntegrationOutboxEvent` within caller's transaction.
  - `fetch_pending_and_claim()` filters by `target_channel="PLATFORM_EVENTS"` and executes non-blocking `SKIP LOCKED` query.
  - `mark_dispatched_with_session()` updates status to `DISPATCHED` and sets timestamp.
  - `mark_failed_with_session()` computes backoff delay: `delay = min(base_backoff_seconds ** retry_count, 3600)` and transitions to `DEAD_LETTER` once max retries are exceeded.
- `PlatformOutboxWorker`:
  - Background polling task with immediate `wake()` trigger capability.

## 8. Files Created
1. `backend/app/platform/events/postgres_outbox.py`: Concrete `PostgresEventOutbox`.
2. `backend/app/platform/events/outbox_worker.py`: Background daemon `PlatformOutboxWorker`.
3. `backend/tests/test_postgres_outbox_worker.py`: 7-test verification suite.
4. `docs/implementation/foundation/Stage5_Transactional_Postgres_Outbox_Engine_v6.27.0.md`: This IPGP plan.
5. `docs/walkthrough/architecture/Stage5_Transactional_Postgres_Outbox_Engine_And_Worker_Daemon_v6.27.0.md`: WGP Walkthrough.

## 9. Files Modified
1. `backend/app/platform/events/outbox.py`: Extended interface methods.
2. `backend/app/platform/events/service.py`: Added `stage_event` helper.
3. `backend/app/platform/events/registry.py`: Added `validate` schema helper.
4. `backend/app/platform/events/serializer.py`: Added `to_dict` and `from_dict`.
5. `backend/app/platform/events/__init__.py`: Package export updates.
6. `src/kernel/events.ts`: TypeScript parity contracts.
7. `docs/implementation/README.md`: Master index update.
8. `docs/walkthrough/README.md`: Master index update.
9. `CHANGELOG.md`: Registered Stage 5 milestone.

## 10. Dependencies
- SQLAlchemy 2.0+ `AsyncSession`
- Pydantic v2
- `asyncio` standard library
- PostgreSQL 9.5+ (`SKIP LOCKED`)

## 11. Risks & Mitigation
- **Risk:** Database connection exhaustion during high-frequency polling.
  - **Mitigation:** Worker runs single sequential queries with short-lived session contexts, sleeping between cycles if no records are found.
- **Risk:** Stalled events if worker crashes during dispatch.
  - **Mitigation:** Zombie recovery logic automatically reclaims events where `status='PROCESSING'` and `claim_expires_at <= now`.

## 12. Rollback Strategy
- Additive non-destructive implementation.
- If worker is stopped, events remain safely persisted as `PENDING` in `integration_outbox_events`.

## 13. Verification Plan
- Automated Pytest suites:
  - `python -m pytest backend/tests/test_postgres_outbox_worker.py -v` (7/7 Green)
  - `python -m pytest backend/tests/test_platform_event_service.py -v` (9/9 Green)
- Frontend Build verification:
  - `npm run build` (3,547 modules transformed, 0 errors)

## 14. Test Plan
1. **Atomicity & Rollback Test:** Verify that rolling back the domain transaction discards the staged outbox event.
2. **Concurrency & Skip Locked Test:** Simulate concurrent workers claiming overlapping sets; verify zero duplicate claims.
3. **End-to-End Worker Cycle:** Stage event, run worker cycle, assert `PlatformEventService` subscriber receives envelope, assert outbox row is `DISPATCHED`.
4. **Retry & DLQ Test:** Force publish failure, verify exponential backoff calculation and final `DEAD_LETTER` transition.
5. **Zombie Lease Recovery:** Verify expired `PROCESSING` claims are re-claimed and successfully dispatched.

## 15. Documentation Impact
- Updated `docs/implementation/README.md`
- Updated `docs/walkthrough/README.md`
- Updated `CHANGELOG.md`

## 16. Deployment Plan
1. Commit changes to `D:\Smriti_Retail_OS\apps\smriti_retail_os`
2. Sync to test environment `F:\Smriti9`
3. Execute automated regression test suites

## 17. Status
Completed.

## 18. Related ADRs
- `docs/adr/ADR-005-One-Way-Canonical-Master-To-Compatibility-Projection-Architecture.md`

## 19. Related Walkthroughs
- `docs/walkthrough/architecture/Stage4_Platform_Event_Service_And_Canonical_Convergence_v6.26.0.md`
- `docs/walkthrough/architecture/Stage5_Transactional_Postgres_Outbox_Engine_And_Worker_Daemon_v6.27.0.md`
