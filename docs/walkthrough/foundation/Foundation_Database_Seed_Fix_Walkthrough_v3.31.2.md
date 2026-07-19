<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.31.2
  Created      : 2026-07-19
  Modified     : 2026-07-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Database Seeding Fix — v3.31.2

## 1. Purpose
Document the resolution of `UndefinedColumnError` and `NotNullViolationError` raised during database seeding in Docker container startup due to the use of a non-existent `uuid` column in raw SQL insert statements for `master_types` and `master_values` tables.

## 2. Scope
- Correct query insertion syntax in `backend/app/db/seed.py`.
- Re-build and run Docker Compose stack to verify automatic database migrations and default data seeding.
- Verify container health status and ensure API service is operational.

## 3. Files Created
None.

## 4. Files Modified
- [seed.py](file:///f:/SMRITRretailNXmgrt/backend/app/db/seed.py)

## 5. Architecture Decisions
Remove `uuid` column from raw SQL inserts for entity tables that do not inherit from `BaseEntity` (which provides `uuid` column) but instead inherit from SQLAlchemy's base `Base` class (which only has `id` primary key column).

## 6. Design Rationale
Tables `master_types` and `master_values` do not inherit from `BaseEntity`, so they don't have the `uuid` column. Attempting to insert into the non-existent `uuid` column caused `asyncpg.exceptions.UndefinedColumnError: column "uuid" of relation "master_types" does not exist`. Removing the `uuid` field from these queries resolves the issue and ensures that database seeding completes successfully.

## 7. Implementation Summary
Updated database seeding queries in `backend/app/db/seed.py` by removing the `uuid` column and its associated bound parameter from the insert statements for `master_types` and `master_values`.

## 8. Tests Executed
Checked container startup logs to verify successful seeding execution:
```powershell
docker compose logs python-core
```

## 9. Verification Results
Seeding output from the logs confirmed complete database initialization:
```text
Running default database seeds...
[SMRITI DB SEED] Seeding master lookup type 'department'...
[SMRITI DB SEED] Seeding master lookup type 'designation'...
...
[SMRITI DB SEED] Default database seeding completed successfully.
```

## 10. Known Limitations
None.

## 11. Future Work
None.

## 12. Related ADRs
None.

## 13. Related RFCs
None.
