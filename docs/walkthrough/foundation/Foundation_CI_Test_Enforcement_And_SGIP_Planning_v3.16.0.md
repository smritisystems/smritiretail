<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-12
  Modified     : 2026-07-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI CI Test Enforcement & SGIP Planning (v3.16.0)

## 1. Purpose
Enforce Python backend test suite runs in the GitHub Actions CI workflow, fix backend pytest configuration warnings, resolve database naming mismatches between CI and app defaults, and explicitly mark the SMRITI Government Integration Platform (SGIP) documents as planning-only (Phase 0).

## 2. Scope
* **CI Workflow Configuration**: `.github/workflows/ci.yml` (Change Postgres DB service to `smriti_retail_db` and add migration + pytest run steps).
* **Pytest Testpaths**: `backend/pyproject.toml` (Set testpaths to `app/tests`).
* **Safe Database Cleaning**: `backend/app/tests/conftest.py` (Add `clear_db` FK-safe helper), and update test modules (`test_auth.py`, `test_pos.py`, `test_user_management.py`) to utilize it.
* **SGIP Planning Status**: Append Phase 0 constitution-only status warnings to `SGIP_PRODUCT_CONSTITUTION_v1.0.md` and `SGIP_IMPLEMENTATION_PLAN_v1.0.md`.

## 3. Files Created
1. **[Foundation_CI_Test_Enforcement_And_SGIP_Planning_v3.16.0.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/walkthrough/foundation/Foundation_CI_Test_Enforcement_And_SGIP_Planning_v3.16.0.md)** — Walkthrough documentation.

## 4. Files Modified
1. **[.github/workflows/ci.yml](file:///d:/IMP/GitHub/SMRITRretailNX/.github/workflows/ci.yml)** — Added alembic migrations and pytest running.
2. **[backend/pyproject.toml](file:///d:/IMP/GitHub/SMRITRretailNX/backend/pyproject.toml)** — Corrected testpaths configuration.
3. **[backend/app/tests/conftest.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/conftest.py)** — Added safe `clear_db` utility.
4. **[backend/app/tests/test_auth.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/test_auth.py)** — Integrated `clear_db`.
5. **[backend/app/tests/test_pos.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/test_pos.py)** — Integrated `clear_db`.
6. **[backend/app/tests/test_user_management.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/test_user_management.py)** — Integrated `clear_db`.
7. **[SGIP_PRODUCT_CONSTITUTION_v1.0.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/implementation/foundation/SGIP_PRODUCT_CONSTITUTION_v1.0.md)** — Added Phase 0 planning header.
8. **[SGIP_IMPLEMENTATION_PLAN_v1.0.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/implementation/foundation/SGIP_IMPLEMENTATION_PLAN_v1.0.md)** — Added Phase 0 planning header.
9. **[README.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/walkthrough/README.md)** — Walkthrough registry update.

## 5. Architecture Decisions
* **Unified Database Teardown**: Introduced a global `clear_db(session)` helper to delete database records across all tables in a strictly defined foreign-key-safe order. This guarantees that individual test suites (e.g. POS tests, CRM tests, Auth tests) do not leak foreign key references that break subsequent test runs.
* **Planning Only Isolation**: Explicitly added Phase 0 warning banners to all SGIP architecture and constitution plans, ensuring that subsequent coding agents or human reviewers do not mistake the SGIP framework as a built capability.

## 6. Design Rationale
* Renaming the CI service database from `smriti_retail` to `smriti_retail_db` matches the configuration file defaults used throughout the python backend.
* Pointing pytest `testpaths` to `["app/tests"]` solves compilation warnings and enables bare pytest execution.

## 7. Implementation Summary
* Added `Run Alembic Migrations` and `Run Python Backend Tests` stages to `.github/workflows/ci.yml`.
* Configured automated `clear_db` call in `override_db` and `override_db_and_tenant` fixtures across test scripts.
* Executed codebase scanner script to refresh intelligence center reports.

## 8. Tests Executed
* Executed Python backend test suite via `python -m pytest` from `backend/`.

## 9. Verification Results

```text
====================== 89 passed, 524 warnings in 44.63s ======================
```

## 10. Known Limitations
None.

## 11. Future Work
None.

## 12. Related ADRs
* [SGIP_ADR_001_Compliance_Architecture.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/architecture/decisions/SGIP_ADR_001_Compliance_Architecture.md)

## 13. Related RFCs
None.
