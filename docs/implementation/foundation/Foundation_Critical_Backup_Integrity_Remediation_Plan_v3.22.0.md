<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.22.0
  Created      : 2026-10-22
  Modified     : 2026-10-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Retail OS Critical Backup Integrity & True Recovery Remediation

## 1. Objective
Remediate the critical backup integrity flaw where partial data exports (20.9 KB, only 1,000 product records) were previously mislabeled and falsely certified as "Verified" and "Complete" system backups. Implement PostgreSQL-native `pg_dump -Fc` full recovery artifacts (schemas, DDL, constraints, indexes, sequences, and data), isolate table extraction failures using safe nested savepoints (`sess.begin_nested()`), prevent production restore of incomplete backups, and update the UI to provide honest, transparent reporting.

## 2. Business Motivation
A retail management system's primary survival mechanism is disaster recovery. If a partial data export (containing only 1,000 products and omitting sales, customers, suppliers, inventory ledgers, and accounting records) is falsely reported as complete, a business owner suffering hardware failure or data corruption would face catastrophic and irreversible data loss when attempting to recover. SMRITI Retail OS must guarantee 100% data fidelity, mathematical integrity, and honest verification reporting.

## 3. Scope
- **Backend Core**: Upgrade `MasterBackupEngine` (`backend/app/core/backup_engine.py`) with native `pg_dump -Fc` execution, TOC verification (`pg_restore -l`), nested savepoint extraction isolation, and honest dynamic `entities_count` summary.
- **Backend Service**: Upgrade `BackupRestoreService` (`backend/app/services/backup_restore_service.py`) to audit legacy manifests, enforce protection status rules, block partial backups from production restoration, and provide native `pg_restore` execution.
- **API Endpoints**: Extend `/api/v1/backup/create` and `/api/v1/backup/restore/review` with `backup_mode`, `backup_category`, `is_complete_business_backup`, `omitted_tables`, and `block_reason`.
- **Frontend UI**: Remediate `BackupRestoreWorkspace.tsx` completion card (560–680px responsive width, restrained 56px status icon, honest omitted tables warning, and primary "View Backup History" / secondary "Back to Backup Centre" actions).
- **Automated Verification**: End-to-end regression tests verifying column fixes, savepoint isolation, partial export blocking, and isolated temporary database restore.

## 4. Current State
- The previous backup engine executed a sequential Python loop across 10 tables.
- A column name mismatch (`phone` instead of canonical `mobile` on `customers`) threw an `UndefinedColumnError`, aborting the PostgreSQL transaction block.
- All subsequent 8 tables failed with `InFailedSQLTransactionError`, resulting in 0 records extracted.
- The engine compressed whatever records it had (only 1,000 products), computed a SHA-256 hash on the zip file, and falsely claimed: "Data included: Products, Sales, Customers, Settings, Files" and "Verification: Passed".
- No native PostgreSQL backup tooling existed; only partial JSON row exports were generated.

## 5. Gap Analysis
1. **Tooling Gap**: Native PostgreSQL recovery (`pg_dump` / `pg_restore`) was missing; database schemas, DDL, foreign keys, indexes, and sequences were not backed up.
2. **Schema Mismatch Gap**: Hardcoded SQL queries referenced non-existent columns (`customers.phone` instead of `customers.mobile`, `sales_invoices.total_amount` instead of `sales_invoices.grand_total`).
3. **Transaction Abort Gap**: Sequential queries inside a single un-nested transaction caused any single table failure to cascade and fail all subsequent tables.
4. **Integrity Semantic Gap**: The system conflated cryptographic archive integrity (SHA-256 hash matches the zip file) with business completeness (all required tables and records exist).
5. **Restore Safety Gap**: The restore service allowed destructive overwrites from incomplete partial exports.

## 6. Architecture Impact
- **Disaster Recovery Tier**: Establishes PostgreSQL Custom Format (`.dump` via `pg_dump -Fc`) as the authoritative full system backup, preserving all 311 tables, 1,369 indexes, sequences, and constraints in ~14.5 MB packages.
- **Tenant Isolation**: Resolves tenant database dynamically (`smriti001` for `COMP-001`), ensuring multi-tenant isolation.
- **Savepoint Isolation**: Introduces `async with sess.begin_nested():` for resilient logical data exports.

## 7. Proposed Design
1. **Master Backup Engine Dual-Mode Runner**:
   - `backup_mode="full"`: Executes `docker exec smriti-db pg_dump -U postgres -d {target_db} -Fc`, verifies TOC entries via `pg_restore -l`, copies archive to host `backend/backups/packages/`, computes SHA-256, and extracts live table counts.
   - `backup_mode="logical"`: Resilient table-by-table export using canonical column names (`mobile`, `grand_total`, `stock_movements`) and nested sub-transactions.
2. **Completeness & Status Segregation**:
   - `file_integrity_status`: Passed/Failed (hash & decompression check).
   - `completeness_status`: Complete/Partial/Failed.
   - If any required table is omitted or 0 records: `backup_category="PARTIAL"`, `is_complete_business_backup=False`, `is_restorable=False`, `verification_status="Partial"`.
3. **Production Restore Guard**:
   - `review_restore_point` inspects `backup_category` and `is_complete_business_backup`.
   - If partial: returns `can_restore=False` and `block_reason="PARTIAL_BACKUP_CANNOT_OVERWRITE_PRODUCTION"`.
   - `execute_restore` hard-blocks execution unless `can_restore=True`.
4. **Frontend UX Overhaul**:
   - Responsive completion card (560–680px).
   - Restrained 56px status icon (emerald check for full, amber alert for partial, rose circle for failed).
   - Prominent amber/rose warning callouts detailing omitted tables.
   - Primary action: "View Backup History"; Secondary action: "Back to Backup Centre".

## 8. Files Created
- `backend/app/tests/test_backup_integrity_remediation.py`: Dedicated 5-suite regression and isolated restore tests.
- `docs/implementation/foundation/Foundation_Critical_Backup_Integrity_Remediation_Plan_v3.22.0.md`: This implementation plan.
- `docs/walkthrough/foundation/Foundation_Critical_Backup_Integrity_Remediation_v3.22.0.md`: Formal WGP walkthrough document.

## 9. Files Modified
- `backend/app/schemas/backup.py`: Added forensic integrity and completeness fields.
- `backend/app/core/backup_engine.py`: Added native `pg_dump` pipeline, TOC inspection, canonical queries, and savepoint isolation.
- `backend/app/services/backup_restore_service.py`: Added completeness auditing, partial restore blocker, and native `pg_restore`.
- `backend/app/api/v1/backup.py`: Forwarded `backup_mode` and enriched status responses.
- `src/components/backup/BackupRestoreWorkspace.tsx`: Remediated completion and review screens.
- `src/tests/backupRestoreWorkspace.test.tsx`: Expanded frontend tests to 10/10.

## 10. Dependencies
- PostgreSQL 15 `pg_dump` and `pg_restore` (available inside `smriti-db` container).
- Docker host CLI for container execution.
- Python `subprocess`, `hashlib`, `gzip`, and SQLAlchemy async sessions.

## 11. Risks
- Large database dump duration: Mitigated with 300s timeout and compressed `-Fc` stream.
- Disk space exhaustion: Preflight storage check enforces 2x safety margin.
- Accidental test restore into production: Prevented by SMRITI test isolation guard (`_is_testing()` blocking non-`smriti_test_*` databases).

## 12. Rollback Strategy
Git revert on branch `smritiNX` restores previous engine and UI components. All backup artifacts are created out-of-band and do not alter existing database schemas or transactional data.

## 13. Verification Plan
1. Validate column names on live `smriti001` schema (`customers.mobile`, `sales_invoices.grand_total`).
2. Verify sub-transaction rollback prevents InFailedSQLTransactionError.
3. Test native `pg_dump` generates >10 MB `.dump` file with >1,000 TOC entries.
4. Execute isolated restore into temporary test database and verify 100% table and row parity.
5. Verify frontend screens render honest status, omitted table badges, and blocked restore controls.

## 14. Test Plan
- Backend Pytest:
  - `backend/app/tests/test_master_backup_engine.py` (5 tests)
  - `backend/app/tests/test_backup_restore_service.py` (4 tests)
  - `backend/app/tests/test_backup_integrity_remediation.py` (5 tests)
- Frontend Vitest:
  - `src/tests/backupRestoreWorkspace.test.tsx` (10 tests)
- TypeScript Typecheck:
  - `npx tsc --noEmit` (0 errors)

## 15. Documentation Impact
- Update `docs/implementation/README.md` master index.
- Update `docs/walkthrough/README.md` master index.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
1. Commit all modified and created files on branch `smritiNX` in `F:\SMRITRretailNX`.
2. Sync to test environment `F:\Smriti9` via `git pull`.
3. Verify headless test executions pass cleanly.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-0042`: Dual-Mode Database Backup Architecture (Native pg_dump & Resilient Logical Export)
- `ADR-0043`: Production Disaster Recovery Integrity & Incomplete Backup Restoration Invariants

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Foundation_Critical_Backup_Integrity_Remediation_v3.22.0.md`
- `docs/walkthrough/foundation/Master_Backup_Restore_Engine_And_Windows_CLI_Walkthrough_v1.0.0.md`
