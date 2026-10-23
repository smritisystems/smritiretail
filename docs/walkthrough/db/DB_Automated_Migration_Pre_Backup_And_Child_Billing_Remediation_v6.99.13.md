<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.13
  Created      : 2026-10-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Database Automated Migration & Pre-Migration Backup Engine Walkthrough
-->

# Automated Database Migration, Pre-Migration Backup & Child Customer Billing Remediation

**Walkthrough Version:** v6.99.13  
**Status:** Completed & Verified  
**Date:** 2026-10-23  
**Classification:** Internal System Architecture & Resilience  

---

## 1. Purpose
To provide a fail-safe, automated migration and database snapshot engine that eliminates migration crashes and schema drift on fresh installations and updates, while diagnosing and resolving the root causes that prevented users on newly installed versions from performing child customer account billing.

---

## 2. Scope
1. **Automated Migration Engine (`scripts/auto_migrate.py`)**:
   - Automated pre-migration snapshot using PostgreSQL binary dump (`pg_dump -Fc` compressed format).
   - SHA-256 cryptographic checksum calculation and JSON manifest recording pre-migration table counts and row statistics.
   - Dynamic topology discovery across the `smritisys` control plane and active tenant databases (`smriti001`, `smriti002`, `smriti003`, `smriti004`).
   - Automated Alembic migration execution (`alembic upgrade head`) across control and tenant tracks.
   - Post-migration parity check (Alembic HEAD, column parity, zero data loss, schema validation).
   - Automated rollback (`--auto-rollback`) and manual restore (`--restore`) execution.
2. **CLI & Platform Integration**:
   - Windows PowerShell CLI wrapper: `scripts/migrate.ps1`.
   - Unified SMRITI CLI command: `python -m backend.app.cli db migrate`.
   - NPM scripts in `package.json`: `npm run db:migrate`, `npm run db:backup`, `npm run db:verify`.
3. **Child Customer Billing Remediation**:
   - Diagnosed root causes blocking child billing in fresh installs (Parent governance flag `show_child_customers_in_billing` defaulting to `OFF`, missing Dependant relationship linkage, wrong component mounted in `BillingWorkspace.tsx`, hardcoded mock products in `SmritiCreditBillingTerminal.tsx`, and migration `v1541` duplicate variant collision).
   - Mounted `SmritiCreditBillingTerminal` for Credit Billing mode.
   - Cleared mock SKUs and bound to live catalog items.
   - Calibrated statutory A4 Tax Invoice background watermark to 75% page size.

---

## 3. Files Created
1. `scripts/auto_migrate.py` — Production-grade automated database migration, pre-migration backup snapshot, and post-migration verification engine.
2. `scripts/migrate.ps1` — Native Windows PowerShell CLI runner supporting `-Database`, `-BackupOnly`, `-NoBackup`, `-AutoRollback`, `-VerifyOnly`, and `-Restore`.
3. `scripts/headless_child_billing_screenshot.py` — Headless verification script performing live atomic checkout for child customer accounts.

---

## 4. Files Modified
1. `backend/app/cli/commands/db_cmd.py` — Registered `migrate` sub-action and parser in the unified SMRITI CLI.
2. `package.json` — Added lifecycle scripts `db:migrate`, `db:backup`, and `db:verify`.
3. `src/components/billing/BillingWorkspace.tsx` — Mounted `SmritiCreditBillingTerminal` when `auxView === "CREDIT_BILLING"`.
4. `src/components/billing/SmritiCreditBillingTerminal.tsx` — Cleaned mock items, bound active SKUs, wired `F5`/`F9` Tax Invoice preview, and bound store profile.
5. `backend/alembic/versions/v1541_triage_quarantine_items.py` — Added anti-join on duplicate variants to prevent unique constraint crashes.
6. `backend/app/services/invoice_pdf_service.py` — Fixed watermark sizing to 75% max-height with object-fit contain and horizontal emblem.
7. `src/components/PrintPreviewModal.tsx` — Calibrated default watermark size slider to 75%.
8. `src/components/templates/TaxInvoiceA4.tsx` — Added centered 75% background watermark container.

---

## 5. Architecture Decisions
1. **Pre-Migration Snapshot Invariant**: No database migration may execute without first producing a binary compressed `pg_dump -Fc` snapshot and verifying SHA-256 hash.
2. **Physical Database Reconciliation**: Dynamic discovery checks `company_database_registries` in `smritisys` and reconciles against physical `pg_database` records to exclude ephemeral test databases.
3. **Dual-Track Migration Execution**: Separates control plane migrations (`-x target=control -x db=smritisys`) from tenant store migrations (`-x target=tenant -x db=<name>`).
4. **Parent-Controlled Child Customer Visibility (Zero-Trust Security)**: Child customer visibility in billing is disabled by default (`show_child_customers_in_billing = false`). Parents must explicitly opt-in to expose child accounts in billing, enforced at both UI query and backend engine levels.

---

## 6. Design Rationale
- **Why `pg_dump -Fc` instead of plain SQL?** Custom format dumps include compression, table-of-contents indexing, and allow selective or clean restoring via `pg_restore --clean --if-exists`.
- **Why anti-join on `v1541`?** Tenant databases with inactive duplicate SKUs threw SQL unique constraint violations during `UPDATE item_variants`, which stalled all downstream migrations (`v1542`, `v1543`).

---

## 7. Implementation Summary
- Engineered `scripts/auto_migrate.py` with 4 operational stages:
  - Stage 1: Preflight connection and disk space check (>500MB).
  - Stage 2: Pre-migration snapshot dump with SHA-256 and row count manifest.
  - Stage 3: Alembic upgrade head execution.
  - Stage 4: Zero-data-loss verification and column parity confirmation.
- Created `scripts/migrate.ps1` with PowerShell parameter binding.
- Integrated `npm run db:migrate` and CLI commands.

---

## 8. Tests Executed
1. `npm run db:verify`: Discovered 5 active physical databases (`smritisys`, `smriti001`, `smriti002`, `smriti003`, `smriti004`) at Alembic HEAD (`v1543`).
2. `.\.venv\Scripts\python.exe scripts/auto_migrate.py --db smriti001`:
   - Pre-migration backup created: `smriti001_20261023_040422.dump` (14.49 MB).
   - Migration executed: 6.00s.
   - Post-migration parity: Zero Data Loss, Alembic Head (`v1543`), Schema Valid.
3. `powershell -ExecutionPolicy Bypass -File scripts/migrate.ps1 -Database smriti001 -VerifyOnly`: Exit code 0.
4. `npx vitest run src/tests/childCustomerBillingVisibility.test.tsx`: 5/5 tests green (70ms).
5. `python scripts/headless_child_billing_screenshot.py`: Live invoice `INV-20261023-3CA746` generated and verified.

---

## 9. Verification Results
```text
======================================================================
 [ALL PASS] Database Auto-Migration & Verification Completed Successfully!
======================================================================
 Databases Processed : 1
 Backup Directory    : F:\SMRITRretailNX\backend\backups\pre_migration\migration_session_20261023_040422
 Final Alembic Head  : v1543
======================================================================
```

---

## 10. Known Limitations
- When using Dockerized PostgreSQL (`smriti-db`), the Docker daemon must be active. If Docker is not running, the script seamlessly falls back to host-native `pg_dump` and `psycopg2`.

---

## 11. Future Work
- Add cloud upload hook (AWS S3 / Google Cloud Storage / OneDrive) for offsite replication of pre-migration snapshots.
- Add cron/systemd automated nightly pre-migration audit.

---

## 12. Related ADRs
- `ADR-0042`: Single-Door Stock Ledger Architecture & Transaction Convergence.
- `ADR-0089`: Multi-Tenant Control Plane Isolation and Company Database Registries.
- `ADR-0112`: Parent-Controlled Child Customer Billing Visibility Governance.

---

## 13. Related RFCs
- `RFC-2026-07`: SMRITI Unified Billing Engine Statutory GST & Headless Calculation.
- `RFC-2026-10`: Disaster Recovery & Automated Snapshot Policy.
