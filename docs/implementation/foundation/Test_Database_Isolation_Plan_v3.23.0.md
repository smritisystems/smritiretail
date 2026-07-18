<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.23.0
  Created      : 2026-07-18
  Modified     : 2026-07-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Test Database Isolation & Onboarding Fixes

## 1. Objective
Stabilize the backend test suite by resolving persistent database isolation leaks, transaction failures during tenant onboarding, password policy validation flakes, and inventory trailing slash redirections.

## 2. Business Motivation
CI/CD test suites must run deterministically. Cross-test database pollution and validation errors create false negatives in test results, blocking deployments and degrading trust in development cycles.

## 3. Scope
- Fast DB cleanup via PostgreSQL `TRUNCATE TABLE ... RESTART IDENTITY CASCADE` with table presence checks.
- Nested transaction handling in onboarding using `db.begin_nested()`.
- Sequence flushes for `Branch` and `Store` entity generation to satisfy FK references.
- Unique suffix generation for system configuration parameters to prevent collisions.
- Trailing slash alignments on inventory URLs.

## 4. Current State
- `clear_db` deletes records using individual SQLAlchemy `delete()` calls, which is slow and prone to foreign key order mismatches.
- `company_setup` endpoint runs `async with db.begin():`, raising `InvalidRequestError` when executed within pre-begun test transactions.
- Temporary passwords generated via `secrets.token_urlsafe(12)` intermittently fail password strength verification rules.
- Test requests to `/api/v1/inventory` redirect to `/api/v1/inventory/`, causing test assertion failures on redirect status codes.

## 5. Gap Analysis
The application was written assuming standalone request sessions with autocommit behavior. When mocked under a unified test transaction context, session state and FK tracking failed.

## 6. Architecture Impact
- Enforces strict tenant isolation cleanup between tests.
- Transitions company onboarding to nested transactions to preserve database state on nested transaction rollbacks.

## 7. Proposed Design
- Implement `TRUNCATE` logic querying `pg_tables` schema dynamically.
- Implement conditional `db.begin_nested()` context handling based on `db.in_transaction()`.
- Sequential loop flush for dependent tables (`branches` -> `stores`).

## 8. Files Created
- `backend/app/db/seed.py`

## 9. Files Modified
- `backend/app/tests/conftest.py`
- `backend/app/tests/test_system_doctor.py`
- `backend/app/tests/test_api_v1_migration.py`
- `backend/app/api/v1/system.py`
- `docker-compose.yml`

## 10. Dependencies
- SQLAlchemy 2.0 transaction features (`in_transaction`, `begin_nested`).
- PostgreSQL-specific `TRUNCATE` syntax.

## 11. Risks
- Cascading truncates could wipe unintended data if run in production. (Mitigation: Guard `clear_db` to only run under test environments via pytest configuration).

## 12. Rollback Strategy
Revert files via `git checkout`.

## 13. Verification Plan
Run `pytest` on modified files.

## 14. Test Plan
- Run migration tests: `python -m pytest app/tests/test_api_v1_migration.py`
- Run doctor tests: `python -m pytest app/tests/test_system_doctor.py`

## 15. Documentation Impact
Walkthrough created to detail the migration.

## 16. Deployment Plan
Include changes in the standard FastAPI backend container update.

## 17. Status
Completed

## 18. Related ADRs
None.

## 19. Related Walkthroughs
- [Foundation_Test_Database_Isolation_And_Setup_Fixes_v3.17.1.md](../walkthrough/foundation/Foundation_Test_Database_Isolation_And_Setup_Fixes_v3.17.1.md)
