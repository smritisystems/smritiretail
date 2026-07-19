<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-13
  Modified     : 2026-07-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Master Framework — Phase F.3 (Terms Library & Print Templates Postgres Migration) Implementation Plan

## 1. Objective
Migrate terms library configurations, print templates, and print profiles from legacy in-memory arrays to dedicated PostgreSQL database tables, fully retiring these arrays from `store.ts` and minimizing flat-file writes.

## 2. Business Motivation
Terms libraries and print templates dictate vital operational outputs (legal contracts, invoice receipts, label barcodes). Retaining them in transient Node memory presents high data loss and inconsistency risks across multiple server instances. Migrating them to PostgreSQL ensures ACID transactions, proper versioning, and persistent storage.

## 3. Scope
* **SQLAlchemy Models:** Append SQLAlchemy model definitions for `PrintTemplate` and `PrintProfile` in `backend/app/models/barcode.py` extending `BaseEntity` from `..db.base`.
* **Alembic migrations:** Register and create database schemas for `print_templates` and `print_profiles` tables.
* **Express Routes Refactoring:**
  * Refactor terms handlers in `src/routes/terms.ts` to query database tables.
  * Refactor print/barcode template handlers in `src/routes/barcode.ts` to read/write `print_templates` and `print_profiles`.
* **Setup Seeding Integration:** Update the `/api/company/setup` route in `src/routes/system.ts` to provision default print templates and terms clauses directly in PostgreSQL.
* **State Cleanups:** Remove `termsLibraryList`, `termsDefaultsList`, `termsSnapshots`, `approvalWorkflowLogs`, `printTemplates`, and `printProfiles` from `src/state/store.ts`.
* **Unit Testing:** Create a new test file `src/tests/termsAndPrintMigration.test.ts` to run CRUD validation on the migrated routes.

## 4. Current State
* The database contains the necessary terms tables (`terms_clauses`, `terms_defaults`, `terms_snapshots`, and `approval_workflow_logs`), but Express routes still read and write to in-memory store arrays.
* Print templates and profiles are fully stored in Node memory and serialized/deserialized to `db_store.json`.

## 5. Gap Analysis
* **Gaps:** Absence of SQLAlchemy model mappings for print templates and profiles.
* **Redundancies:** Code in Express routes is performing mutations on memory arrays followed by blocking `saveDb()` serialization calls.

## 6. Architecture Impact
* Transition configurations to database-backed persistent storage.
* Eliminate synchronous flat-file I/O overhead.

## 7. Proposed Design
Both `PrintTemplate` and `PrintProfile` SQLAlchemy models must extend `BaseEntity` (from `backend/app/db/base.py`), which means they automatically inherit the columns: `id`, `uuid`, `company_id` (FK to companies), `branch_id` (FK to branches), `created_at`, `modified_at`, `created_by`, `updated_by`, `is_active`, `is_deleted`, `deleted_at`, `deleted_by`, and `version`.

### PostgreSQL Tables for Print Templates & Profiles
* `print_templates`:
  * `title` (String(200), nullable=False)
  * `label_size` (String(50), nullable=False)
  * `printer_language` (String(50), nullable=False)
  * `printer_family` (String(100), nullable=False)
  * `version` (String(50), default="1.0.0")
  * `is_default_size` (Boolean, default=False)
  * `raw_prn` (Text, nullable=False)
  * `field_mappings` (Text, nullable=True)  # Store JSON representation as string
* `print_profiles`:
  * `name` (String(200), nullable=False)
  * `template_id` (String(50) foreign key reference to `print_templates.id`, ondelete="RESTRICT", nullable=False)
  * `printer_ip` (String(50), nullable=False)
  * `printer_port` (Integer, default=9100)
  * `dpi` (Integer, default=203)
  * `copies` (Integer, default=1)
  * `label_size` (String(50), default="50x25")
  * `is_default` (Boolean, default=False)

## 8. Files Created
* `backend/alembic/versions/xxxx_add_print_templates_and_profiles.py` (Alembic migration script)
* `src/tests/termsAndPrintMigration.test.ts` (Vitest unit tests)

## 9. Files Modified
* `backend/app/models/barcode.py` (Add PrintTemplate and PrintProfile models)
* `src/routes/terms.ts` (Refactor terms routes to PostgreSQL)
* `src/routes/barcode.ts` (Refactor template/profile routes to PostgreSQL)
* `src/routes/system.ts` (Provision default print templates and terms during dynamic setup)
* `src/state/store.ts` (Retire in-memory arrays and serialization hooks)
* `docs/walkthrough/README.md` (Register new walkthrough)
* `CHANGELOG.md` (Add release log for Phase F.3)

## 10. Dependencies
* PostgreSQL, SQLAlchemy, Alembic, Node `pg` pool.

## 11. Risks
* Data migration mismatch for existing flat-file templates to Postgres. Mitigated by writing a self-healing seeding block during initial startup.

## 12. Rollback Strategy
* Run `alembic downgrade -1` to roll back the database schemas.
* Simultaneously execute `git revert` on the Express routes, helpers, and `store.ts` commits to restore in-memory state arrays and serialization hooks.

## 13. Verification Plan
* Validate that migrations run successfully: `alembic upgrade head`.
* Query tables manually to verify structure.

## 14. Test Plan
* Run frontend unit test suites: `npm run test` (including the new `src/tests/termsAndPrintMigration.test.ts`).
* Validate CRUD APIs `/api/terms/clauses`, `/api/terms/defaults`, `/api/terms/snapshots`, `/api/barcode/templates`, `/api/barcode/profiles`.

## 15. Documentation Impact
* Generate Walkthrough at `docs/walkthrough/foundation/SMRITI_Master_Framework_Phase_F_3_Walkthrough_v3.16.0.md` and update index in `docs/walkthrough/README.md`.

## 16. Deployment Plan
* Apply migrations during container/server startup.

## 17. Status
* Approved

## 18. Related ADRs
* None

## 19. Related Walkthroughs
* None
