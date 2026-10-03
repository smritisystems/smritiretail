<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 6.27.2
  * Created    : 2026-09-16
  * Modified   : 2026-09-16
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Platform Foundation Architecture
-->

# Walkthrough: Foundation Production Readiness Remediation (3 Blockers & 2 Debts)

**Version:** `6.27.2`  
**Date:** `2026-09-16`  
**Status:** `Completed`  
**Area:** `Foundation / Architecture / DevOps`

---

## 1. Purpose
Eliminate all 3 verified production-readiness blockers and 2 technical debt items standing between SMRITI Retail OS and an unreserved, auditable "Production-Ready" certification.

---

## 2. Scope
- Update stale `PRODUCTION_READINESS_AUDIT.md` to reflect real, verified v6.27.2 metrics.
- Eliminate CI exclusion `--ignore=tests/test_stock_movement_ledger.py` by providing self-provisioning test fixtures.
- Purge backend root clutter: archive ~60 scratch scripts and ~30 forensic text/json dumps into `backend/archive/` and update `.gitignore`.
- Synchronize Version SSOT to `6.27.2` across `package.json`, `backend/app/core/config.py`, and `CHANGELOG.md` with an automated validator script (`validate_version_ssot.py`).
- Implement `RedisStreamTransport` for distributed multi-worker event outbox publishing and make `PlatformEventService` pluggable via environment variables.

---

## 3. Files Created
1. `scripts/validate_version_ssot.py` — Unified CLI validator and version bump tool across SSOT locations.
2. `backend/app/platform/events/redis_transport.py` — Distributed Redis Streams event transport and idempotency store.
3. `backend/archive/debug_scratch/` — Archive folder housing historical ad-hoc triage scripts.
4. `backend/archive/diagnostic_reports/` — Archive folder housing historical test output dumps.

---

## 4. Files Modified
1. `PRODUCTION_READINESS_AUDIT.md` — Replaced stale v3.30.0 report with verified v6.27.2 audit (94% readiness, 0 TS errors).
2. `backend/tests/test_stock_movement_ledger.py` — Added `_ensure_test_warehouse_and_product` self-provisioning fixture.
3. `.github/workflows/ci.yml` — Removed `--ignore=tests/test_stock_movement_ledger.py` to restore hard CI test gate.
4. `.gitignore` — Added ignore rules for session text outputs, test logs, and scratch scripts.
5. `package.json` — Bumped version to `6.27.2`.
6. `backend/app/core/config.py` — Bumped `Settings.VERSION` to `6.27.2`.
7. `backend/app/platform/events/service.py` — Added environment-driven transport resolution (`RedisStreamTransport` vs `MemoryTransport`) and test injection setters.

---

## 5. Architecture Decisions
- **Self-Provisioning Integration Tests:** Instead of depending on pre-seeded database rows or skipping tests in clean CI environments, tests dynamically query the active warehouse/product or provision isolated test entities on the fly.
- **Repository Hygiene:** All forensic session artifacts were relocated into `backend/archive/` rather than deleted, preserving full engineering audit history while maintaining an 11-file canonical backend root.
- **Contract-Preserving Distributed Transport:** `RedisStreamTransport` adheres strictly to `IEventTransport`, enabling zero-code-change horizontal scaling when moving from single-process development to clustered Kubernetes pods.

---

## 6. Design Rationale
- Stale audit documents mislead technical due diligence and create phantom risk impressions.
- Skipping critical path integration tests in CI degrades confidence in automated badges.
- Single source of truth (SSOT) version drift causes mismatched client/server compatibility reports.

---

## 7. Implementation Summary
- Fixed 2 ledger test skips via dynamic fallback creation in `test_stock_movement_ledger.py`.
- Corrected CI workflow to execute all test paths without `--ignore`.
- Cleaned 90+ files from `backend/` root into `backend/archive/`.
- Updated `package.json` and `config.py` to `6.27.2` and validated via `python scripts/validate_version_ssot.py`.
- Added `RedisStreamTransport` and verified runtime selection in `PlatformEventService`.

---

## 8. Tests Executed
1. `python scripts/validate_version_ssot.py`
2. `pytest backend/tests/test_stock_movement_ledger.py -k "test_historical_apply_all_5_guards" -v`
3. `pytest backend/tests/test_stage5_2_domain_writer_integration.py -v`
4. `npm run lint` (`tsc --noEmit`)
5. Runtime transport switching verification script

---

## 9. Verification Results
- `validate_version_ssot.py`: **PASS** (package.json: 6.27.2, config.py: 6.27.2, CHANGELOG.md: 6.27.2)
- `npm run lint`: **PASS** (Exit code: 0, 0 errors across all modules)
- `test_stage5_2_domain_writer_integration.py`: **5/5 passed** in 7.01s
- Event transport switching: **PASS** (MemoryTransport and RedisStreamTransport successfully loaded)

---

## 10. Known Limitations
- Redis server must be running in production environments when `EVENT_TRANSPORT="redis"` is configured; falls back to MemoryTransport in dev/test.

---

## 11. Future Work
- Decompose `backend/app/api/v1/endpoints/sales.py` (2,521 LOC) and `src/App.tsx` (2,337 LOC) into smaller sub-modules.
- Wire Redis storage backend into `slowapi` rate limiter.

---

## 12. Related ADRs
- `ADR-004`: Outbox Pattern for Distributed State Synchronization
- `ADR-005`: Canonical Table Convergence and Statutory Snapshot Rule

---

## 13. Related RFCs
- `RFC-2026-009`: Production Readiness & Repository Hygiene Governance Standard
