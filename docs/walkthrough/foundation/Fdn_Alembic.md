<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.14.4
  Created      : 2026-07-11
  Modified     : 2026-07-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# Foundation — Alembic Schema Unification Walkthrough (v3.14.4)

## 1. Purpose
This walkthrough documents the unification of the SMRITI database schema initialization under Alembic migrations, deprecating the Express-side direct execution of `schema.sql` (DDL). This guarantees a single source of truth for the database layout across both Node.js and Python container instances, preventing discrepancies.

## 2. Scope
The scope of this refactoring encompasses:
- Deprecation and deletion of `src/db/schema.sql`.
- Clean connection checks and DB seeding in Node's initialization layer (`src/db/init.ts`).
- Creation of a new root-level migration `a1b2c3d4e5f6` to safely declare core tables under Alembic control.
- Re-linking baseline migration chains to correctly support automatic UUID generation defaults.
- Injecting container start dependencies (`depends_on`) so Node boots only after Python health check indicates migrations are successfully applied.
- Fixing data integrity issues in `db_store.json` seed data.

## 3. Files Created
- `backend/alembic/versions/a1b2c3d4e5f6_add_missing_core_tables.py`

## 4. Files Modified
- `Dockerfile`
- `docker-compose.yml`
- `db_store.json`
- `src/db/init.ts`
- `backend/alembic/versions/12b68ccebec7_baseline_schema.py`
- `backend/alembic/versions/cc8a527deb42_add_pos_shift_tables.py`

## 5. Architecture Decisions
We established Alembic as the single controller of DDL layout. The Node standalone server was modified to wait for python-core's container health to verify migrations have completed prior to initial startup connection pool binding.

## 6. Design Rationale
Separating the database layout definition from the Node container and unifying it inside the python backend prevents schema divergence, enables incremental Alembic migrations in a standardized fashion, and supports robust zero-configuration database seeding.

## 7. Implementation Summary
- **DDL Elimination**: Removed the direct file read and SQL query run of `schema.sql` in `src/db/init.ts`.
- **Startup Syncing**: Integrated dependencies inside `docker-compose.yml` ensuring Node waits for Python core's status.
- **Migration Chains**: Configured default `uuid_generate_v4()::varchar` on column definitions so legacy seed structures insert cleanly.
- **Seeding Correction**: Mapped seed records to valid existing product IDs (`PROD-001`, `PROD-002`, `PROD-003`).

## 8. Tests Executed
Backend test suite executed inside the container:
```bash
docker exec -e PYTHONPATH=/app smriti-python-core python -m pytest
```

## 9. Verification Results
```
====================== 89 passed, 525 warnings in 37.39s =======================
```

## 10. Known Limitations
None.

## 11. Future Work
Integrate database health logs into frontend system dashboard metrics.

## 12. Related ADRs
- None.

## 13. Related RFCs
- None.
