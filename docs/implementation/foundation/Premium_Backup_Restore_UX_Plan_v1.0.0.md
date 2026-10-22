<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
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

# SMRITI Implementation Plan: Premium Backup & Restore UX & Engine

## 1. Objective
Implement a premium, non-technical Backup & Restore subsystem for SMRITI Retail OS, enabling retail business owners to create verified backups, monitor live multi-stage job progress, review and execute safe recoveries with explicit destructive warnings, and manage backup settings without needing database, command-line, or DevOps expertise.

## 2. Business Motivation
Retail shop owners need complete confidence that their commercial data (Products, Sales, Stock, Customers, Suppliers, Settings, Documents) is continuously protected and instantly recoverable. The previous architecture only provided a developer-centric SQL tool (`DatabaseManagerTab.tsx`), which posed severe risk of operational error and exposed technical complexity.

## 3. Scope
- Backend `BackupRestoreService` supporting logical entity archiving, SHA-256 tamper-evident checksumming, schema validation, persistent job states, and pre-restore recovery point safety.
- FastAPI REST endpoints under `/api/v1/backup` (`status`, `history`, `create`, `jobs/{id}`, `jobs/{id}/cancel`, `restore`, `settings`).
- Frontend `BackupRestoreWorkspace.tsx` implementing all 6 approved visual screens:
  1. Main Protection Dashboard.
  2. Backup in Progress (circular progress + 4-stage stepper).
  3. Backup Completed (manifest summary & verified badges).
  4. Restore Point Selection.
  5. Review & Confirm (destructive warning & confirmation checkbox).
  6. Backup Settings (schedule frequency & storage destination).
- Navigation wiring in `launchpadCatalog.ts`, `layout_store.tsx`, and `TabRenderer.tsx`.
- Automated backend and frontend test suites.

## 4. Current State
- No user-facing backup workspace existed in `TabRenderer.tsx` or `launchpadCatalog.ts`.
- No `/api/v1/backup` REST endpoints existed in FastAPI.
- Historical backups were ad-hoc script dumps during one-off migrations.

## 5. Gap Analysis
- Missing enterprise backup schema and tamper-evident manifest structure (`manifest.json` with SHA-256 hashes).
- Missing asynchronous job progress tracker for retail UI progress ring.
- Missing two-phase recovery safety mechanism (validating archive before applying).
- Missing retail-friendly UI configuration conforming to SMRITI design tokens.

## 6. Architecture Impact
- Reuses existing PostgreSQL connection factories (`get_company_sessionmaker` and `async_session`).
- Follows SMRITI backend system-of-record policy (FastAPI + PostgreSQL).
- Enforces multi-tenant isolation via `TenantContext` and RBAC (`MANAGER`, `SYSADMIN`).
- Immutably records backup lifecycle events in `compliance_immutable_audit_logs`.

## 7. Proposed Design
- Backup format: Encrypted/compressed JSON entity bundles (`smriti_backup_<company_id>_<timestamp>.json.gz`) with SHA-256 payload hashes, entity counts, schema version, and metadata.
- Pre-restore snapshot: When a restore operation is triggered, the engine automatically creates a temporary safety snapshot before modifying active tables.
- Storage targets:
  1. "This Device / Local Server" (default, fully operational under `backend/backups/`).
  2. "Google Drive" & "OneDrive" (cloud destination settings with connection indicator).

## 8. Files Created
- `docs/implementation/foundation/Premium_Backup_Restore_UX_Plan_v1.0.0.md`
- `backend/app/schemas/backup.py`
- `backend/app/services/backup_restore_service.py`
- `backend/app/api/v1/backup.py`
- `backend/app/tests/test_backup_restore_service.py`
- `src/components/backup/BackupRestoreWorkspace.tsx`
- `src/tests/backupRestoreWorkspace.test.tsx`
- `docs/walkthrough/foundation/Premium_Backup_Restore_UX_Walkthrough_v1.0.0.md`

## 9. Files Modified
- `backend/app/main.py`
- `src/components/shell/TabRenderer.tsx`
- `src/components/launchpad/launchpadCatalog.ts`
- `src/layout_engine/layout_store.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- FastAPI, SQLAlchemy 2.0, Pydantic v2, `asyncpg`, Python standard `hashlib`, `gzip`, `json`.
- React 18, Lucide React icons, Tailwind CSS / SMRITI theme variables.

## 11. Risks
- Restoring large datasets could timeout: Mitigated by chunked streaming and transactional savepoints.
- Accidental overwrite: Mitigated by mandatory confirmation checkbox, amber warning banner, and automatic pre-restore safety snapshot.

## 12. Rollback Strategy
- Any failed restore transaction automatically rolls back via database transaction management (`session.rollback()`).

## 13. Verification Plan
- Unit and integration tests covering backup creation, manifest verification, job polling, cancellation, and restore simulation.
- Frontend Vitest tests validating the 6 screens and interactive state transitions.
- TypeScript compilation check (`tsc --noEmit`).

## 14. Test Plan
- `backend/app/tests/test_backup_restore_service.py`: 5 tests verifying lifecycle, manifest hashing, restore verification, and tenant isolation.
- `src/tests/backupRestoreWorkspace.test.tsx`: 6 tests verifying UI rendering, primary action cards, progress stepper, and confirmation gates.

## 15. Documentation Impact
- Update WGP Walkthrough, Master Indexes, and `CHANGELOG.md`.

## 16. Deployment Plan
- Pure code deployment, no database migration required.

## 17. Status
Approved — In Progress.

## 18. Related ADRs
- `ADR-001` — SMRITI FastAPI Backend System of Record.
- `ADR-012` — SMRITI Multi-Tenant Database Architecture.

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Premium_Backup_Restore_UX_Walkthrough_v1.0.0.md`
