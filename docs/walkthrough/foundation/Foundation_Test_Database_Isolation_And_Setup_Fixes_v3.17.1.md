<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.1
  Created      : 2026-07-18
  Modified     : 2026-07-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Test Database Isolation & Onboarding Fixes

## 1. Purpose
Address persistent test database state pollution, transaction failures, and onboarding validation flaws that caused test failures in `/api/v1/company/setup` and `/api/v1/inventory/` endpoint validation flows.

## 2. Scope
- Fast DB cleanup via Postgres `TRUNCATE ... CASCADE` with table existence check.
- Safe transaction handling during tenant onboarding using Nested Transactions (Savepoints) when running within test transactions.
- Split-flush ordering for `Branch` and `Store` records to resolve foreign key reference conflicts.
- Unique ID suffix generation for `SystemConfig` records to prevent sub-second timestamp collisions.
- Validation fixes for unassigned user logins and URL trailing slashes.

## 3. Files Created
- [seed.py](../../../backend/app/db/seed.py) — Idempotent Postgres seeding script for default credentials (super, manager, cashier).

## 4. Files Modified
- [conftest.py](../../../backend/app/tests/conftest.py) — Refactored `clear_db` to query `pg_tables` and run bulk `TRUNCATE TABLE ... RESTART IDENTITY CASCADE` on all active tables.
- [test_system_doctor.py](../../../backend/app/tests/test_system_doctor.py) — Added `try/finally` block to `override_db` fixture for safe teardown.
- [test_api_v1_migration.py](../../../backend/app/tests/test_api_v1_migration.py) — Integrated post-test database cleanup, configured correct SYSADMIN roles, added branch codes to payloads, and adjusted `/api/v1/inventory/` canonical paths.
- [system.py](../../../backend/app/api/v1/system.py) — Implemented `begin_nested()` transaction boundaries, separate `Branch`/`Store` flushes, and collision-free UUID-suffix system configuration IDs.
- [docker-compose.yml](../../../docker-compose.yml) — Passed `INTERNAL_SERVICE_KEY` env var to app and python-core containers.

## 5. Architecture Decisions
- **Nested Transactions (Savepoints):** In test environments, tests wrap operations in transactions. Executing `db.begin()` on an already transactional session fails. Using `db.begin_nested()` when `db.in_transaction()` is true allows company setup to create savepoints and rollback/commit safely.
- **Dynamic Table Existence Querying:** Querying `pg_tables` in the `public` schema before truncating ensures that database migrations don't fail due to non-existent tables during partial test runs.

## 6. Design Rationale
- **Deterministic Password Generation:** Replacing `secrets.token_urlsafe(12)` in onboarding with a policy-compliant character generation function prevents intermittent validation failures.
- **Trailing Slash Canonicalization:** FastAPI redirects paths without trailing slashes. Specifying `/api/v1/inventory/` directly in tests bypasses redirection steps.

## 7. Implementation Summary
- Split `Branch` and `Store` entity generation into sequential loops with `await db.flush()` between them so Postgres can validate branch IDs before stores reference them.
- Updated `set_system_config` ID scheme to append a random 6-character suffix to timestamp IDs: `sys-{timestamp}-{rand}`.
- Replaced row-by-row `delete()` statements with a single bulk query `TRUNCATE TABLE` across all tables, falling back dynamically to existing tables.

## 8. Tests Executed
- `python -m pytest app/tests/test_api_v1_migration.py -v --tb=short` (PASSED)
- `python -m pytest app/tests/test_system_doctor.py -v` (PASSED)

## 9. Verification Results
All tests in `test_api_v1_migration.py` and `test_system_doctor.py` successfully completed and verified database isolation.

## 10. Known Limitations
None.

## 11. Future Work
Apply similar `begin_nested()` patterns to other transactional endpoints if they are executed inside database-heavy test configurations.

## 12. Related ADRs
None.

## 13. Related RFCs
None.
