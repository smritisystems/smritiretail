# Performance and Scalability Assessment

## Measured evidence

No deployed app, database, container resource metrics, workload generator or production telemetry was available. API latency, SQL query plans, throughput, memory/CPU, concurrent transaction behavior and growth curves were **not measured**. No performance number is claimed.

## Source-level configuration

- `backend/app/db/session.py` configures up to 10 pooled Control Plane connections plus 20 overflow and up to 5 per-company plus 10 overflow outside tests. With multiple company engines and multiple Gunicorn workers, connection capacity can multiply; actual peak sizing was not modeled.
- `backend/app/middleware/rate_limiter.py` uses an in-process limiter keyed by company header or IP. This is per worker/process unless an external shared backend is configured; no shared rate-limit backend was evidenced.
- `backend/entrypoint.sh` defaults Gunicorn to two workers; compose exposes configurable worker count.
- Frontend contains IndexedDB/offline/sync and local cache layers, but offline queue volume, reconciliation throughput and memory use were not measured.
- Some endpoint code performs multiple reads to assemble domain views; no query plans or N+1 audit was run.

## Risks

1. Connection capacity may scale with both workers and number of cached tenant engines; define and test a global database connection budget.
2. Process-local rate limiting may not enforce a global per-tenant ceiling across replicas.
3. Dynamic engine cache lifecycle/eviction and cleanup under large tenant counts were not measured.
4. Report/dashboard query performance and large catalog behavior are unknown.
5. No load or concurrency evidence exists for invoice posting, stock reservation, cash close, reconciliation or scheduled jobs.

## Recommended measurement plan

In an isolated environment, seed representative anonymized catalog/transaction volumes, run concurrent API workflows, record P50/P95/P99 latency, throughput, pool wait, lock/deadlock counts, query plans and memory/CPU. Include tenant-count growth, multiple workers/replicas, rate-limit consistency and offline-sync catch-up. Define measurable SLOs before optimization.

**Performance: 3.5/10. Scalability: 4.0/10.** This reflects insufficient measurement evidence, not a claim that the system is currently slow.
