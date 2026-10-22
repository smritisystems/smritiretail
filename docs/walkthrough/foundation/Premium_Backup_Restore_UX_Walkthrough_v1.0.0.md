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

# SMRITI Walkthrough: Premium Backup & Restore UX Implementation

## 1. Purpose
This walkthrough documents the end-to-end design, implementation, and verification of the **Premium Backup & Restore UX & Engine** in SMRITI Retail OS (`BackupRestoreWorkspace.tsx`). It empowers retail store owners to back up business data, monitor live multi-stage job progress, inspect verified recovery points, execute safe restorations with explicit destructive overwrite warnings, and manage backup settings without needing technical, server, database, or command-line knowledge.

## 2. Scope
- **Backend Service Layer (`BackupRestoreService`)**:
  - Implemented in `backend/app/services/backup_restore_service.py`.
  - Extracts retail business entities (Products, Customers, Suppliers, Sales Invoices, Purchase Orders, Company Profile).
  - Generates tamper-evident SHA-256 checksums, JSON entity manifests, and compressed archives (`.json.gz`).
  - Supports asynchronous multi-stage job tracking: `preparing` (25%) → `creating` (55%) → `verifying` (80%) → `finalizing` (95%) → `completed` (100%).
  - Safe restore engine requiring explicit confirmation and creating automatic pre-restore safety snapshots.
- **REST API Endpoints (`/api/v1/backup`)**:
  - Implemented in `backend/app/api/v1/backup.py` and mounted in `backend/app/main.py`.
  - `GET /status`, `GET /history`, `POST /create`, `GET /jobs/{id}`, `POST /jobs/{id}/cancel`, `POST /restore/review`, `POST /restore/execute`, `GET /settings`, `PUT /settings`.
- **Frontend Workspace (`BackupRestoreWorkspace.tsx`)**:
  - Implemented in `src/components/backup/BackupRestoreWorkspace.tsx` conforming to SMRITI UI tokens and the approved 6-screen mockup.
  - Screen 1: Protection Dashboard (Status card, auto-backup toggle, 3 primary action cards: Back Up Now, Restore My Data, Backup Settings).
  - Screen 2: Back Up Now (circular progress ring, 4-step live indicator, safe cancellation).
  - Screen 3: Backup Completed (large verified badge, summary metadata card, View Backup History).
  - Screen 4: Restore My Data (recovery point selector, radio cards with Verified badges).
  - Screen 5: Review & Confirm (destructive overwrite warning banner, mandatory confirmation checkbox).
  - Screen 6: Backup Settings (frequency selector, storage destinations, retention dropdown).
- **Navigation & Catalog Integration**:
  - Added Launchpad tile in `src/components/launchpad/launchpadCatalog.ts` under "System & Operations".
  - Registered workspace in `src/layout_engine/layout_store.tsx` (`id: "backup-restore"`).
  - Routed in `src/components/shell/TabRenderer.tsx`.

## 3. Files Created
- `backend/app/schemas/backup.py`
- `backend/app/services/backup_restore_service.py`
- `backend/app/api/v1/backup.py`
- `backend/app/tests/test_backup_restore_service.py`
- `src/components/backup/BackupRestoreWorkspace.tsx`
- `src/tests/backupRestoreWorkspace.test.tsx`
- `docs/implementation/foundation/Premium_Backup_Restore_UX_Plan_v1.0.0.md`
- `docs/walkthrough/foundation/Premium_Backup_Restore_UX_Walkthrough_v1.0.0.md`

## 4. Files Modified
- `backend/app/api/v1/__init__.py`
- `backend/app/main.py`
- `src/components/shell/TabRenderer.tsx`
- `src/components/launchpad/launchpadCatalog.ts`
- `src/layout_engine/layout_store.tsx`
- `src/tests/fioriLaunchpad.test.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Separation of Retail UX from Database Diagnostics**:
   - The technical SQL consoles and raw schema viewers in `DatabaseManagerTab.tsx` remain preserved for internal database engineers and SYSADMINs.
   - `BackupRestoreWorkspace.tsx` serves as the non-technical, commercial-grade surface dedicated to business owners.
2. **Two-Phase Restore Safety**:
   - Destructive operations require explicit confirmation via checkbox.
   - Prior to restoring any archive, a pre-restore safety snapshot ID is automatically generated to ensure rollback feasibility.
3. **Cryptographic Integrity Manifests**:
   - Every backup file is stored alongside a companion `.manifest.json` containing the SHA-256 hash of the compressed payload, schema version, and entity counts. The restore engine validates the hash before processing.

## 6. Design Rationale
- Retail business owners should never have to think about table names, ports, connection strings, or cron syntax.
- The 6-screen design cleanly bifurcates into creation, monitoring, verification, recovery, and configuration.
- The use of recognizable icons, green verified status pills, and prominent cards makes data security transparent and reassuring.

## 7. Implementation Summary
1. Built Pydantic models for status, job progress, manifest info, restore review/execute, and settings.
2. Built `BackupRestoreService` that interacts with PostgreSQL, exports entity rows, compresses with gzip, hashes with SHA-256, and stores files in `backend/backups/packages/`.
3. Created REST endpoints protected by `MANAGER` / `SYSADMIN` authentication guards.
4. Built React component `BackupRestoreWorkspace.tsx` with light/dark theme tokens, interactive polling, and state management.
5. Wired into launchpad catalog and navigation routing.

## 8. Tests Executed
1. **Backend Pytest Integration Suite**:
   - Command: `.\.venv\Scripts\pytest.exe backend/app/tests/test_backup_restore_service.py`
   - Output: **4 passed in 68.06s** (settings lifecycle, backup creation & manifest verification, restore review & confirmation guard, formatting helpers).
2. **Frontend Vitest Workspace Suite**:
   - Command: `npm test -- src/tests/backupRestoreWorkspace.test.tsx --run`
   - Output: **8 passed in 746ms** (Screen 1 dashboard, Screen 2 progress, Screen 3 completed, Screen 4 point selector, Screen 5 confirmation guard, Screen 6 settings, action button IDs, API contract mapping).
3. **Fiori Launchpad Routing Integrity Suite**:
   - Command: `npm test -- src/tests/fioriLaunchpad.test.ts --run`
   - Output: **11 passed in 390ms**.
4. **TypeScript Compiler Check**:
   - Command: `npm run lint` (`tsc --noEmit`)
   - Output: **0 errors (exit code 0)**.

## 9. Verification Results
| Verification Item | Target | Result | Status |
|---|---|---|---|
| Main Dashboard Screen | Display status, auto-backup toggle, 3 primary cards | Verified via Vitest & markup render | **Done** |
| Backup Creation Job | Progress percentages & 4-stage stepper | Verified via Pytest & Vitest | **Done** |
| Backup Completion Screen | Verified badge, manifest details, time, size | Verified in component & live DB | **Done** |
| Restore Selection Screen | List verified points with radio selection | Verified in component & Vitest | **Done** |
| Review & Confirm Screen | Destructive warning & confirmation checkbox | Verified in component & Vitest | **Done** |
| Backup Settings Screen | Frequency, storage destinations, retention | Verified in component & Pytest | **Done** |
| Launchpad & Navigation | Tile & workspace routing wired | Verified via fioriLaunchpad.test.ts | **Done** |

## 10. Known Limitations
- Google Drive and OneDrive storage destination selections currently operate in Local / Server storage mode; OAuth token authorization flow for cloud storage providers is scheduled for a future cloud gateway integration phase.

## 11. Future Work
- Add direct cloud OAuth2 consent flows for Google Drive and Microsoft OneDrive.
- Support automated email or WhatsApp notifications on backup completion or failure.

## 12. Related ADRs
- `ADR-001` — SMRITI FastAPI Backend System of Record.
- `ADR-012` — SMRITI Multi-Tenant Database Architecture.

## 13. Related RFCs
- `RFC-2026-OPS-004` — SMRITI Retail OS Premium Backup & Recovery Standard.
