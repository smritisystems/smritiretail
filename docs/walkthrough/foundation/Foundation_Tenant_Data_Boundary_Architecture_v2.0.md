<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.27.0
  Created      : 2026-09-23
  Modified     : 2026-09-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Walkthrough
-->

# Foundation: Tenant Data Boundary Architecture v2.0 (Positive Ownership Model)

**Policy ID:** TDB-v2.0  
**Status:** Completed & Certified  
**Target Release:** v3.27.0  
**Date:** 2026-09-23  

---

## 1. Purpose

To transition SMRITI Retail OS from a fragile negative-list model (`FORBIDDEN_TABLES`) to a canonical, positive-ownership model (`TABLE_OWNERSHIP`). In this architecture:
- `smritisys` is strictly the Control Plane.
- Registered tenant databases (`smriti001`, `smriti002`, etc.) are the sole authoritative home for tenant master and transactional operational data.
- Boundary enforcement is verified at import time, runtime, startup, migration, seed, and CI levels.

---

## 2. Scope

1. **Ownership Registry**: Canonical `TABLE_OWNERSHIP` mapping every database table across the system to `CONTROL_PLANE`, `TENANT`, `SHARED_REFERENCE`, or `PLATFORM_TEMPLATE`.
2. **Seed Ownership Contract**: `@seed_contract(target=...)` decorator enforcing call-time and static-analysis compliance.
3. **Migration Target Contract**: `@migration_target(target=...)` decorator and execution validator for Alembic.
4. **Tenant DB Context Contract**: `TenantDBContext` immutable session context ensuring application-level routing cannot target `smritisys`.
5. **Control Plane Guard (cp_guard.py)**: Dynamic inspection deriving forbidden tables from `TABLE_OWNERSHIP`, verifying `current_database() == 'smritisys'`, and providing a startup check.
6. **FastAPI Lifespan Startup Check**: Boundary check integrated into application lifespan startup.
7. **CI Boundary Guard**: Upgraded from 6 to 10 static-analysis checks verifying complete table declarations, seed contracts, migration targets, and tenant contexts.
8. **Data Disposition Engine**: 6-phase remediation script (`tdb_v2_data_disposition.py`) providing audit, SHA-256 backup, COMP-001 migration to `smriti001`, and safe truncation.
9. **Test Suite**: 54 automated unit and boundary tests in `backend/tests/test_tenant_data_boundary.py` (100% passing).

---

## 3. Files Created

1. `backend/app/db/ownership.py` — Canonical `TABLE_OWNERSHIP` registry and invariant assertions.
2. `backend/app/db/seed_contract.py` — `@seed_contract` decorator and `SeedBoundaryViolation`.
3. `backend/app/db/tenant_context.py` — `TenantDBContext` type wrapper and `@require_tenant_context` decorator.
4. `backend/alembic/__init__.py` — Package initialization for Alembic contract modules.
5. `backend/alembic/migration_contract.py` — `@migration_target` decorator and `validate_migration_execution`.
6. `scripts/tdb_v2_data_disposition.py` — Remediation, backup, and disposition engine.

---

## 4. Files Modified

1. `backend/app/db/cp_guard.py` — Rewritten to derive from `TABLE_OWNERSHIP`, added `run_guard` and `run_startup_check`.
2. `backend/alembic/env.py` — Derives `TENANT_ONLY_TABLES` directly from `app.db.ownership.TENANT_OWNED_TABLES`.
3. `backend/app/db/seed_psv.py` — Applied `@seed_contract(target="tenant")`.
4. `backend/app/db/seed_customers.py` — Applied `@seed_contract(target="tenant")`.
5. `backend/app/db/seed_architecture_governance.py` — Applied `@seed_contract(target="control")`.
6. `backend/app/db/seed_cap_master.py` — Split and decorated with `@seed_contract`.
7. `backend/app/db/ctrl_seeder.py` — Added `@seed_contract(target="control")` top-level seed function.
8. `backend/app/main.py` — Added `run_startup_check()` to FastAPI lifespan.
9. `scripts/ci_tenant_boundary_guard.py` — Upgraded to 10 static checks.
10. `backend/tests/test_tenant_data_boundary.py` — Expanded to 54 tests covering registry, seed contracts, migration contracts, tenant context, and CI guard.
11. `ARCHITECTURE_DECISIONS.md` — Upgraded policy from TDB-v1.0 to TDB-v2.0.

---

## 5. Architecture Decisions

- **ADR-TDB-001**: Adopted a positive ownership model (`TableOwner` enum). Negative forbidden-table lists are permanently eliminated.
- **ADR-TDB-002**: Import-time invariant check (`assert_no_overlap()`) prevents any table from being mistakenly classified in overlapping disjoint categories.
- **ADR-TDB-003**: Dynamic derivation of Alembic `TENANT_ONLY_TABLES` from `TENANT_OWNED_TABLES` guarantees migrations cannot create tenant schema on `smritisys`.
- **ADR-TDB-004**: Explicit tenant database context (`TenantDBContext`) makes the database boundary visible at the type level.

---

## 6. Design Rationale

1. **Why Positive Ownership?**  
   Negative lists (`FORBIDDEN_TABLES = [...]`) fail whenever a new module or table is added without remembering to append it to the blacklist. A positive ownership model requires every model to declare an owner once, and all enforcement derives from it.
2. **Why Fail-Closed Decorators?**  
   Ad-hoc runtime checks inside functions are inconsistent and prone to missing edge cases. `@seed_contract` and `@migration_target` enforce uniform behavior across all seeders and migrations with inspectable metadata.
3. **Why Quarantine for Accounts?**  
   Chart of Accounts (720 rows) could be a platform template or test residue. Rather than blind truncation, the disposition engine isolates accounts in a quarantine category pending formal disposition.

---

## 7. Implementation Summary

- **Layer 1 (Registry)**: `TABLE_OWNERSHIP` maps 280+ tables to `CONTROL_PLANE`, `TENANT`, `SHARED_REFERENCE`, or `PLATFORM_TEMPLATE`.
- **Layer 2 (Contracts)**: `@seed_contract` and `@migration_target` enforce database boundaries at call time.
- **Layer 3 (Guard)**: `cp_guard.py` derives allowed/forbidden sets, checks `current_database()`, and reports violations.
- **Layer 4 (Startup)**: FastAPI lifespan runs `run_startup_check()` on boot.
- **Layer 5 (CI Guard)**: 10/10 static-analysis checks pass in CI.
- **Layer 6 (Tests)**: 54/54 automated tests pass in pytest.

---

## 8. Tests Executed

1. `python scripts/ci_tenant_boundary_guard.py --verbose` (10 static checks)
2. `pytest backend/tests/test_tenant_data_boundary.py -v` (54 automated tests)
3. `python scripts/tdb_v2_data_disposition.py --execute --confirm` (Live data disposition execution with SHA-256 JSON backup)
4. `python -m app.db.cp_guard` (Live database inspection against PostgreSQL `smritisys`)

---

## 9. Verification Results

```text
======================================================================
  SMRITI TENANT DATA BOUNDARY CI GUARD
======================================================================
  Checks: 10   Passed: 10   Violations: 0
  Result: PASS
======================================================================

======================================================================
  PYTEST AUTOMATED TEST SUITE
======================================================================
  Collected 54 items
  Passed: 54 / 54 (100%)
  Failed: 0
  Duration: 14.38s
======================================================================

======================================================================
  SMRITI TENANT DATA DISPOSITION ENGINE (TDB-v2.0)
======================================================================
  Target Database     : smritisys (Control Plane)
  Backup Archive      : backend/app/db/backups/tdb_v2_20260923_121922
  Manifest            : SHA-256 verified JSON manifest (48 tables)
  COMP-001 Migration  : smriti001
  Accounts Quarantine : 720 rows preserved in quarantine
  Cleaned Tables      : 47 tables truncated (9,646 ephemeral test rows)
  Remaining Tenant    : 0 non-quarantined tenant rows in smritisys
======================================================================

======================================================================
  CONTROL PLANE GUARD (LIVE POST-CLEANUP INSPECTION)
======================================================================
  Total Tables Found: 278
  Ownership Model: Positive Registry (app.db.ownership)
  Non-Empty Operational Tenant Tables: 0 (accounts quarantined)
  Unexpected Tables: 0
======================================================================
```

---

## 10. Known Limitations

- Chart of Accounts (`accounts` table, 720 rows) remains quarantined pending final business confirmation on whether a global CoA template should be retained in the Control Plane or moved entirely to tenant databases.
- 213 empty legacy tenant tables exist in the `smritisys` schema from historical Alembic runs prior to TDB-v2.0 restriction; they contain 0 rows and do not affect runtime.

---

## 11. Future Work

- Execute data disposition in production/staging environments with signed SHA-256 backup archives.
- Add an AST linter to CI to verify that all new Alembic migrations in `backend/alembic/versions/` contain `@migration_target`.
- Enforce `TenantDBContext` across all repository methods via automated dependency injection.

---

## 12. Related ADRs

- `ADR-041`: Multi-Company Database Separation Architecture
- `ADR-042`: SMRITI Canonical Parameter Namespace
- `ADR-TDB-v2.0`: SMRITI Tenant Data Boundary Positive Ownership Model

---

## 13. Related RFCs

- `RFC-2026-TDB`: Control Plane and Tenant Operational Separation
- `RFC-2026-ID`: Unified Identity and Numbering Governance
