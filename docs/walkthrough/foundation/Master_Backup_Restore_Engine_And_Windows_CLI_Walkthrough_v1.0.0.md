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

# SMRITI Retail OS — Master Backup & Restore Engine, Windows CLI & Verification Walkthrough

**Document ID:** WGP-FND-BACKUP-ENGINE-v1.0.0  
**Version:** 1.0.0  
**Status:** Completed & Verified  
**Area:** Foundation, Disaster Recovery & Windows Systems  
**Release:** v6.99.8  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## 1. Purpose
Establish an enterprise-grade disaster recovery system connecting the SMRITI browser interface to the real Windows/Docker host execution engine. The engine eliminates all simulated progress indicators, mock payloads, and unverified success statuses, providing guaranteed cryptographic integrity, atomic archiving, secret redaction, and Windows PowerShell CLI monitoring tools.

---

## 2. Scope
- **Host & Engine Architecture:**
  - `MasterBackupEngine` background process controller with persistent JSON state (`backend/backups/jobs/{id}.json`) and persistent raw log streams (`backend/backups/logs/{id}.log`).
  - Startup crash reconciliation (`reconcile_interrupted_jobs`): automatically reconciles in-flight jobs on host reboot/restart into `INTERRUPTED` (never marks them `SUCCESS`).
  - Strict preflight evaluations: checks `shutil.disk_usage` for a 2x safety margin and ensures concurrent job mutual exclusion.
  - Secret redaction filter: automatically masks passwords, database credentials, and security tokens from both in-memory and disk logs.
  - Atomic archive packaging: `.tmp` archive compression followed by Gzip verification before atomic finalization to `.json.gz`.
- **Automated Scheduler Daemon:**
  - `BackupSchedulerDaemon` running in FastAPI lifespan executing periodic off-hours snapshots (Daily, Weekly, Monthly) and safe retention pruning.
- **Windows CLI Suite:**
  - `scripts/backup.ps1`: Interactive/Non-interactive PowerShell backup runner with preflight validation, progress bar, and log tailing.
  - `scripts/status.ps1`: PowerShell system protection inspector displaying last backup, active jobs, and scheduler status.
  - `scripts/logs.ps1`: Live colored structured log tailer for any job ID.
  - `scripts/restore.ps1`: Guarded PowerShell recovery tool requiring explicit typed confirmation and creating safety snapshots.
- **Browser UX:**
  - "Create System Backup?" modal with destination scope and storage checks.
  - Live 8-stage progress monitor (`preflight` -> `database_backup` -> `app_config` -> `persistent_files` -> `archive_creation` -> `integrity_verification` -> `manifest_finalization` -> `retention_cleanup`).
  - Resilient browser refresh reconnection querying `/api/v1/backup/active-job`.
  - Expandable real-time sanitized log terminal.

---

## 3. Files Created
1. `backend/app/core/backup_engine.py` — Master backup execution engine, crash reconciliation, secret redaction, and atomic archiving.
2. `backend/app/core/backup_scheduler.py` — Background scheduler daemon for automated periodic backups and retention pruning.
3. `backend/app/tests/test_master_backup_engine.py` — Automated backend test suite for preflight, secret redaction, crash recovery, and retention invariants.
4. `scripts/backup.ps1` — Windows PowerShell backup execution script with console progress and live logs.
5. `scripts/status.ps1` — Windows PowerShell backup health and protection status inspector.
6. `scripts/logs.ps1` — Windows PowerShell live structured log follower.
7. `scripts/restore.ps1` — Windows PowerShell guarded data restore script with pre-restore safety snapshot.
8. `docs/implementation/foundation/Backup_Scheduler_And_Retention_Pruning_Plan_v1.0.0.md` — Formal IPGP plan for scheduler and retention.
9. `docs/walkthrough/foundation/Master_Backup_Restore_Engine_And_Windows_CLI_Walkthrough_v1.0.0.md` — This WGP walkthrough document.

---

## 4. Files Modified
1. `backend/app/schemas/backup.py` — Added `PreflightCheckResponse`, `BackupLogEntry`, and `BackupLogsResponse`.
2. `backend/app/core/config.py` — Added `BACKUP_SCHEDULER_ENABLED` and `BACKUP_SCHEDULER_POLL_SECONDS`.
3. `backend/app/services/backup_restore_service.py` — Integrated with `MasterBackupEngine`, made session management isolated, and implemented `prune_expired_backups()`.
4. `backend/app/api/v1/backup.py` — Added endpoints `/preflight`, `/active-job`, `/jobs/{job_id}/logs`, `/jobs/{job_id}/retry`, and `/prune`.
5. `backend/app/main.py` — Wired `MasterBackupEngine.reconcile_interrupted_jobs()` and `BackupSchedulerDaemon` into FastAPI lifespan.
6. `backend/app/tests/test_backup_restore_service.py` — Updated assertions for real job states (`RUNNING`, `SUCCESS`) and isolated session lifecycle.
7. `src/components/backup/BackupRestoreWorkspace.tsx` — Added confirmation dialog, 8-stage progress tracker, collapsible live log terminal, failure recovery, and browser refresh reconnection.
8. `src/tests/backupRestoreWorkspace.test.tsx` — Updated test assertions to cover the 8 real stages, logs toggle, and control buttons.
9. `docs/implementation/README.md` — Registered new IPGP plan in master index.

---

## 5. Architecture Decisions
1. **Isolated Session Per Background Task:**
   - Background tasks must never share an `AsyncSession` with foreground HTTP requests or pytest fixtures, as foreground sessions terminate immediately on request completion. The background worker instantiates its own isolated session and ensures strict `finally: await sess.close()`.
2. **Crash Reconciliation on Startup:**
   - Server reboots or process crashes during a backup job could leave orphaned job states. On FastAPI lifespan startup, `MasterBackupEngine.reconcile_interrupted_jobs()` scans all job files in `backend/backups/jobs/` and converts any `RUNNING`, `QUEUED`, or `VERIFYING` job to `INTERRUPTED`. It is architecturally forbidden to mark interrupted jobs as `SUCCESS`.
3. **Retention Invariant:**
   - Even when retention policy (e.g. `30_days`) would nominally expire all existing backups due to an extended period of business inactivity, `prune_expired_backups()` unconditionally protects `history[0]` (the newest verified backup), guaranteeing that zero-backup scenarios are prevented.
4. **Browser Refresh Reconnection:**
   - In single-page applications, navigating away or pressing F5 wipes React memory. On component mount, `BackupRestoreWorkspace` queries `GET /api/v1/backup/active-job` to immediately reattach to any running background backup.

---

## 6. Design Rationale
- **No Simulated Progress:**
  - Progress percentages are tied directly to actual stage milestones (Preflight: 15%, Database: 30%, App Config: 50%, Persistent Files: 65%, Compression: 80%, Verification: 90%, Manifest: 95%, Retention: 98%, Complete: 100%).
- **Native PowerShell CLI Suite:**
  - System administrators and Windows Task Scheduler require native PowerShell tools that emit standard exit codes (0 = Success, 1 = Failure) and support headless flags (`-NonInteractive`) for non-attended operations.
- **Live Logs Streaming:**
  - Real-time logging with secret sanitization provides transparency without exposing database passwords or authentication tokens in plain text.

---

## 7. Implementation Summary
```
┌─────────────────────────────────────────────────────────────┐
│                   BROWSER CLIENT LAYER                      │
│   BackupRestoreWorkspace.tsx                                │
│   - "Create System Backup?" Confirmation Dialog             │
│   - 8-Stage Real Progress Monitor & Status Badges           │
│   - Live Structured Log Viewer (Sanitized Terminal)         │
│   - Active Job Reconnection on Page Reload                  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP /api/v1/backup/*
┌──────────────────────────────▼──────────────────────────────┐
│                    FASTAPI BACKEND LAYER                    │
│   Endpoints: /preflight, /create, /active-job, /jobs/logs   │
│   Lifespan: Startup Crash Reconciliation & Scheduler Daemon │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
┌──────────────▼─────────────┐ ┌──────────────▼───────────────┐
│     MASTER BACKUP ENGINE   │ │    BACKUP SCHEDULER DAEMON   │
│   - Preflight & Storage    │ │   - Evaluates Interval       │
│   - 8-Stage Real Worker    │ │   - Triggers Off-Hours Runs  │
│   - Atomic Gzip Packaging  │ │   - Retention Horizon Purge  │
│   - SHA-256 Verification   │ └─────────────────────────────┘
│   - Secret Redaction       │
└──────────────┬─────────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│                  WINDOWS FILESYSTEM & CLI                   │
│   Storage: backend/backups/{packages, jobs, logs}           │
│   CLI Tools: backup.ps1, status.ps1, logs.ps1, restore.ps1  │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Tests Executed
1. **Frontend Unit Tests (Vitest):**
   - Command: `npx vitest run src/tests/backupRestoreWorkspace.test.tsx`
   - Outcome: **8/8 tests passed** in 598ms.
2. **Backend Engine Tests (Pytest):**
   - Command: `.\.venv\Scripts\pytest.exe backend/app/tests/test_master_backup_engine.py -v`
   - Outcome: **5/5 tests passed** (Preflight, Secret Redaction, Persistent Logging, Crash Reconciliation, Retention Invariant).
3. **Backend Service Tests (Pytest):**
   - Command: `.\.venv\Scripts\pytest.exe backend/app/tests/test_backup_restore_service.py -v`
   - Outcome: **4/4 tests passed** (Settings Lifecycle, 8-Stage Backup & Manifest Verification, Restore Guard, Format Helpers).
4. **TypeScript Linter:**
   - Command: `npm run lint` (`tsc --noEmit`)
   - Outcome: **0 errors**, clean compile.

---

## 9. Verification Results
All tests and verifications exited with status code 0.

| Test Suite / Tool | Test File / Target | Tests Executed | Passed | Failed | Terminal Status |
|---|---|---|---|---|---|
| Vitest | `src/tests/backupRestoreWorkspace.test.tsx` | 8 | 8 | 0 | PASSED (exit code 0) |
| Pytest | `backend/app/tests/test_master_backup_engine.py` | 5 | 5 | 0 | PASSED (exit code 0) |
| Pytest | `backend/app/tests/test_backup_restore_service.py` | 4 | 4 | 0 | PASSED (exit code 0) |
| TypeScript Compiler | `tsc --noEmit` (`npm run lint`) | Full repo | All clean | 0 | PASSED (exit code 0) |

---

## 10. Known Limitations
- Network shared drives and cloud providers (Google Drive, OneDrive) write to local staging packages before uploading; cloud OAuth2 token refresh requires manual connection configuration.
- Database export dumps logical tables (products, customers, suppliers, sales invoices, items, stock ledger, companies, users); binary raw PostgreSQL cluster dumps (`pg_dumpall`) require elevated host Postgres privileges outside Docker container constraints.

---

## 11. Future Work
- Integration with external cloud storage endpoints (AWS S3, Azure Blob Storage).
- Native push notifications via Windows Toast Notifications (`BurntToast` PowerShell module).
- Automated weekly isolated database restore verification in a sandbox test container.

---

## 12. Related ADRs
- `ARCHITECTURE_DECISIONS.md` — FastAPI + PostgreSQL sole transactional System of Record.
- Universal Author Details Header Policy (UADHP-v1.0).

---

## 13. Related RFCs
- RFC-FND-008: Disaster Recovery and Atomic Backup Verification.
- RFC-SEC-012: Secret Sanitization and Log Redaction Policy.
