<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-22
  Modified     : 2026-10-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Backup Scheduler Daemon & Automated Retention Pruning Plan

**Document ID:** IPGP-FND-BACKUP-SCHED-v1.0.0  
**Version:** 1.0.0  
**Status:** Completed  
**Area:** Foundation & Disaster Recovery  
**Target Release:** v6.99.8  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## 1. Objective
Design and implement an autonomous, zero-dependency `BackupSchedulerDaemon` and automated `RetentionPruningEngine` for SMRITI Retail OS. The engine continuously monitors backup configuration, executes off-hours scheduled database and artifact snapshots based on store configuration (Daily, Weekly, Monthly), and safely purges historical archives beyond the retention horizon while guaranteeing that at least one verified recovery point is always preserved.

---

## 2. Business Motivation
Retail business owners require reliable protection against hardware failures, accidental data corruption, ransomware, and administrative mistakes without having to manually log in and click "Back Up Now" every night. An automated background worker ensures continuous business continuity, off-hours execution to eliminate peak-hour transactional locking, and intelligent disk storage management to prevent server storage exhaustion.

---

## 3. Scope
- **In Scope:**
  - `BackupSchedulerDaemon` pure `asyncio` background task embedded in FastAPI lifespan.
  - Automated scheduling frequency calculation (`daily` 24h cycle at off-hours, `weekly` 7-day cycle, `monthly` 30-day cycle).
  - Retention horizon evaluation and pruning (`1_month` / 30 days, `3_months` / 90 days, `6_months` / 180 days, `1_year` / 365 days, `keep_all`).
  - Minimum verified safety guarantee: retention pruning is strictly prohibited from deleting the only available verified recovery point.
  - Scoped database session isolation: uses dedicated sessions per tick to prevent connection starvation.
  - Scheduler diagnostic API endpoint at `/api/v1/backup/scheduler/status`.
  - Feature flag controls (`BACKUP_SCHEDULER_ENABLED`, `BACKUP_SCHEDULER_POLL_SECONDS`).
  - Unit and integration tests for scheduler and retention pruning.
- **Out of Scope:**
  - External cron daemon or Celery/Redis cluster infrastructure.
  - Third-party cloud API rate-limiting tokens (covered in cloud OAuth2 phase).

---

## 4. Current State
In v6.99.7:
- The `BackupRestoreService` supports manual asynchronous job creation via `POST /api/v1/backup/create` with multi-stage progress tracking.
- The `smriti_backup_settings.json` file records `automatic_backup_enabled`, `backup_frequency`, `storage_location`, and `retention_period`.
- However, there is no automated background daemon evaluating these settings or triggering off-hours runs.
- Backup packages accumulate indefinitely in `backend/backups/packages/` without automatic retention enforcement.

---

## 5. Gap Analysis
| Capability | Current State (v6.99.7) | Target State (v6.99.8) |
|---|---|---|
| Automatic Backup Execution | Manual trigger only via UI / API | Automated background daemon triggered when due |
| Retention Pruning | None; manual file deletion | Automated cryptographic and manifest-aware purge |
| Last Recovery Point Protection | N/A | Strictly enforces preservation of latest verified point |
| Scheduler Lifespan Integration | Disabled | Clean asyncio lifecycle in FastAPI startup/shutdown |
| Scheduler Diagnostics | None | Real-time status reporting next run & execution counts |

---

## 6. Architecture Impact
```text
FastAPI Lifespan (backend/app/main.py)
   │
   ├──> ReportSchedulerDaemon (backend/app/core/scheduler.py)
   │
   └──> BackupSchedulerDaemon (backend/app/core/backup_scheduler.py)
           │
           ├── Tick Poll (Every 60s)
           │     │
           │     ├── Check smriti_backup_settings.json
           │     │     └─ If automatic_backup_enabled == False -> Skip
           │     │
           │     ├── Check Last Backup Timestamp vs Frequency (Daily/Weekly/Monthly)
           │     │     └─ If Due:
           │     │           ├─ Execute BackupRestoreService.execute_automated_backup()
           │     │           └─ Execute BackupRestoreService.prune_expired_backups()
           │     │
           │     └── Scoped DB Session (closed immediately after tick)
           │
           └── Clean Cancellation on FastAPI Shutdown (asyncio.CancelledError)
```

---

## 7. Proposed Design

### 7.1 BackupSchedulerDaemon Class
- Implemented in `backend/app/core/backup_scheduler.py`.
- Runs as an independent `asyncio.Task` started inside `app/main.py` lifespan.
- Attributes: `poll_interval_seconds: int`, `_running: bool`, `_last_run_at: Optional[datetime]`, `_last_prune_at: Optional[datetime]`, `_total_automated_backups: int`, `_total_pruned_packages: int`.
- Functions: `start_backup_scheduler()`, `stop_backup_scheduler()`, `get_backup_scheduler_status()`.

### 7.2 Retention Pruning Logic
- `BackupRestoreService.prune_expired_backups(retention_override: Optional[str] = None)`:
  1. Retrieve all packages from `BACKUP_DIR`.
  2. Parse `retention_period` from settings (`1_month` -> 30d, `3_months` -> 90d, `6_months` -> 180d, `1_year` -> 365d, `keep_all` -> return 0).
  3. Sort backups by `created_at` descending.
  4. Designate `items[0]` (newest) as unconditionally preserved.
  5. For items where `now - created_at > retention_days`:
     - Delete `<filename>.tar.gz`.
     - Delete `<filename>.manifest.json`.
     - Increment `pruned_count` and accumulate `freed_bytes`.
  6. Return `PruneResult(pruned_count, freed_bytes_pretty, pruned_backup_ids)`.

### 7.3 Scheduler API Endpoint
- Add `GET /api/v1/backup/scheduler/status` returning scheduler running state, last automated run, next scheduled run, total automated backups, and last pruning stats.
- Add `POST /api/v1/backup/prune` for manual on-demand retention pruning by administrators.

---

## 8. Files Created
1. `backend/app/core/backup_scheduler.py` — Background asyncio scheduler daemon.
2. `backend/app/tests/test_backup_scheduler.py` — Pytest integration tests for scheduler and retention pruning.
3. `docs/implementation/foundation/Backup_Scheduler_And_Retention_Pruning_Plan_v1.0.0.md` — This formal IPGP plan.
4. `docs/walkthrough/foundation/Backup_Scheduler_And_Retention_Pruning_Walkthrough_v1.0.0.md` — WGP walkthrough.

---

## 9. Files Modified
1. `backend/app/core/config.py` — Added `BACKUP_SCHEDULER_ENABLED` and `BACKUP_SCHEDULER_POLL_SECONDS`.
2. `backend/app/services/backup_restore_service.py` — Added `prune_expired_backups()` and automated execution hooks.
3. `backend/app/api/v1/backup.py` — Added `/scheduler/status` and `/prune` endpoints.
4. `backend/app/main.py` — Wired `start_backup_scheduler()` and `stop_backup_scheduler()` in lifespan.
5. `docs/implementation/README.md` — Updated master implementation table.
6. `docs/walkthrough/README.md` — Updated master walkthrough table.
7. `CHANGELOG.md` — Logged release changes under `[6.99.8]`.

---

## 10. Dependencies
- Pure Python 3.11 Standard Library (`asyncio`, `datetime`, `os`, `json`, `hashlib`, `gzip`).
- SQLAlchemy 2.0 Async Session (`sqlalchemy.ext.asyncio`).
- FastAPI and Pydantic v2.

---

## 11. Risks & Mitigations
| Risk | Severity | Mitigation |
|---|---|---|
| Retention pruning deletes all backups | Critical | Mandatory invariant: `items[0]` (newest verified backup) is permanently excluded from pruning, even if past expiration. |
| Background backup blocks transaction plane | High | Dedicated scoped session per tick; logical table exports use read-only queries with streaming iterations. |
| Process crash on malformed archive | Low | Isolated try/except block around manifest deserialization and unlinking. |

---

## 12. Rollback Strategy
Set `BACKUP_SCHEDULER_ENABLED=False` in environment or settings. The scheduler task terminates cleanly without affecting API serving.

---

## 13. Verification Plan
1. Run pytest suite testing retention pruning with synthetic archives of varying ages.
2. Verify newest backup preservation invariant.
3. Verify scheduler frequency determination for daily, weekly, and monthly profiles.
4. Run full TypeScript check (`tsc --noEmit`).

---

## 14. Test Plan
- `test_retention_pruning_policy_preserves_latest()`
- `test_retention_pruning_deletes_expired_archives()`
- `test_backup_scheduler_status_and_due_check()`
- `test_backup_scheduler_lifecycle()`

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`
- Create `docs/walkthrough/foundation/Backup_Scheduler_And_Retention_Pruning_Walkthrough_v1.0.0.md`
- Update `CHANGELOG.md`

---

## 16. Deployment Plan
1. Code committed to `F:\SMRITRretailNX` (development).
2. Pushed to `origin smritiNX`.
3. Pulled to `F:\Smriti9` (testing).

---

## 17. Status
Approved for implementation.

---

## 18. Related ADRs
- `ARCHITECTURE_DECISIONS.md` — Core System-of-Record in FastAPI + PostgreSQL.

---

## 19. Related Walkthroughs
- [`docs/walkthrough/foundation/Premium_Backup_Restore_UX_Walkthrough_v1.0.0.md`](../walkthrough/foundation/Premium_Backup_Restore_UX_Walkthrough_v1.0.0.md)
