<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-13
  Modified     : 2026-07-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Master Framework — Phase F.3 (Terms Library & Print Templates Postgres Migration)

## 1. Purpose
Migrate print templates, print profiles, terms library, terms defaults, terms snapshots, and approval workflow logs from transient in-memory arrays to dedicated PostgreSQL database tables, fully retiring these arrays from `store.ts`.

## 2. Scope
- Model `PrintTemplate` and `PrintProfile` SQLAlchemy classes in `backend/app/models/barcode.py` extending `BaseEntity` to inherit security, multi-tenancy, auditing, and version tracking columns.
- Autogenerate and apply Alembic schema migration for the `print_templates` and `print_profiles` tables in PostgreSQL.
- Refactor the Express routes inside `src/routes/terms.ts` and `src/routes/barcode.ts` to execute queries directly on PostgreSQL tables using the `pg` pool.
- Update the динамический wizard `/api/company/setup` in `src/routes/system.ts` to provision standard default terms clauses, terms defaults, print templates, and print profiles in PostgreSQL.
- Retire in-memory arrays (`termsLibraryList`, `termsDefaultsList`, `approvalWorkflowLogs`, `termsSnapshots`, `printTemplates`, `printProfiles`) and load/save hooks from `src/state/store.ts`.
- Add a new comprehensive unit test file `src/tests/termsAndPrintMigration.test.ts` to validate CRUD endpoints.

## 3. Files Created
- [SMRITI_Master_Framework_Phase_F_3_Walkthrough_v3.16.0.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/walkthrough/foundation/SMRITI_Master_Framework_Phase_F_3_Walkthrough_v3.16.0.md)
- [termsAndPrintMigration.test.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/tests/termsAndPrintMigration.test.ts)

## 4. Files Modified
- [barcode.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/barcode.py)
- [env.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/alembic/env.py)
- [terms.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/terms.ts)
- [barcode.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/barcode.ts)
- [system.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/system.ts)
- [store.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/state/store.ts)
- [README.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/walkthrough/README.md)
- [CHANGELOG.md](file:///d:/IMP/GitHub/SMRITRretailNX/CHANGELOG.md)

## 5. Architecture Decisions
Retire transient memory states and rely on PostgreSQL as the single source of record for legal terms, print layout definitions, and hardware profiles. Both models are registered on the `BaseEntity` schema to automatically enforce multi-tenancy (`company_id`/`branch_id`) and version auditing.

## 6. Design Rationale
Removing configuration state mutations from transient memory prevents print template mismatches and legal clauses corruption across multiple instances, while completely eliminating Event Loop stalls caused by writing huge arrays synchronously to `db_store.json`.

## 7. Implementation Summary
- **SQLAlchemy Schema Addition:** Model structures appended for templates/profiles in `backend/app/models/barcode.py`.
- **Alembic Table Migrations:** Registered tables in `env.py` and successfully migrated the database using `alembic upgrade head`.
- **Express Routes Refactoring:** Replaced in-memory array manipulation with direct PostgreSQL insert/update/select queries.
- **Dynamic Wizard Seeding:** Setup wizard (`system.ts`) updated to provision standard out-of-the-box configurations.
- **State Store Cleanup:** Retired 6 arrays and load/save hooks from `store.ts`.

## 8. Tests Executed
- Rebuilt system using `npm run build`.
- Ran compiler type check using `npx tsc --noEmit`.
- Ran Vitest suite using `npm run test`.

## 9. Verification Results
All tests passed successfully:
- vitest: 60/60 tests passed.
- tsc: Completed with 0 errors.

## 10. Known Limitations
None.

## 11. Future Work
None.

## 12. Related ADRs
- None.

## 13. Related RFCs
- None.
