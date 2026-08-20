<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.29.0
  Created      : 2026-08-20
  Modified     : 2026-08-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Walkthrough — Test Fixture Environment Dependency & Routing Fix (v3.29.0)

## 1. Purpose
Resolve test fixture environment dependencies and test isolation gaps across the multi-tenant security test suites (`test_e2e_tenant_security_and_routing.py`, `test_ecom_connectors.py`, `test_company_control_center_security.py`) to guarantee deterministic 20/20 test execution on fresh databases and clean environments without silent fixture swallowing.

## 2. Scope
- `backend/tests/conftest.py`: Test environment fixture bootstrap and routing registry seeding.
- Control Plane (`smritisys`) vs Company Operational DB (`smriti001`) fixture partitioning.
- Upsert conflict handling across compound and partial unique indexes.
- Cross-test state leakage remediation between unit/ecom fixtures and security suites.

## 3. Files Created
- `docs/walkthrough/foundation/Foundation_Test_Fixture_Environment_Dependency_Fix_v3.29.0.md` (this document)

## 4. Files Modified
- `backend/tests/conftest.py`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Explicit Routing Registry Seeding (RC2)**:
   - In accordance with `SMRITI_MULTI_COMPANY_DATABASE_ARCHITECTURE_v1.0.md`, company database routing maps `COMP-001 -> smriti001` via the `company_database_registries` table in `smritisys`.
   - On a fresh database migration, `company_database_registries` contains no rows. Conftest now deterministically seeds `COMP-001 -> smriti001` in `READY` status during fixture setup.
2. **Fail-Fast Setup Policy (RC3)**:
   - Replaced all silent `try/except` warnings with immediate `pytest.fail()`. Any environmental failure (unmigrated database, missing PostgreSQL connection, foreign key breach) halts execution loudly with actionable troubleshooting guidance.
3. **Per-Test Function Scoping for Control Plane Seeding**:
   - Switched `seed_control_plane_test_assignments` from `scope="session"` to `scope="function"` to ensure that per-test teardowns (e.g., `clear_db()` in `test_ecom_connectors.py`) do not cause downstream authorization failures (such as `test_04` 403 Forbidden) in subsequent tests.

## 6. Design Rationale
- Multi-database enterprise systems require a clean distinction between the governance control plane (`smritisys`) and tenant operational databases (`smriti001`).
- When tests mix mocked dependencies and live database queries (e.g., `CompanyDatabaseResolver` calling live psycopg2 while FastAPI endpoints use dependency overrides), test fixtures must guarantee that control plane records (users, roles, assignments, registries) remain intact and consistent throughout the entire test session.

## 7. Implementation Summary
- **Branches Table Upsert**: Implemented a check-and-update pattern (`SELECT id FROM branches WHERE code = 'MAIN'`) before inserting to avoid both `branches_code_key` unique violations and `users_branch_id_fkey` foreign key constraint failures.
- **User Company Assignments**: Updated the upsert to target the partial unique index `ON CONFLICT (user_id, company_id) WHERE (is_deleted = false)` rather than `ON CONFLICT (id)`.
- **Registry Record**: Added idempotent upsert for `company_database_registries` (`COMP-001 -> smriti001`).
- **Operational Data Reachability Check**: Verified connectivity and baseline seed data for `smriti001` with explicit failure instructions for clean CI pipelines.

## 8. Tests Executed
```bash
pytest backend/tests/test_e2e_tenant_security_and_routing.py backend/app/tests/test_ecom_connectors.py backend/tests/test_company_control_center_security.py --tb=short -q
```

## 9. Verification Results
- **Terminal Output**:
```text
....................                                                     [100%]
20 passed, 22 warnings in 11.84s
```
- **Status**: **Done** (All 20/20 target tests passing deterministically across combined multi-suite execution).

## 10. Known Limitations
- Tenant operational database `smriti001` must be provisioned in PostgreSQL prior to running operational integration tests. In CI environments, `createdb -U postgres smriti001` and company-level migrations must be executed during workspace initialization.

## 11. Future Work
- Extend automated test bootstrap scripts to automatically execute `CompanyDatabaseProvisioner(dry_run=False)` if `smriti001` is not detected in PostgreSQL.

## 12. Related ADRs
- `docs/architecture/SMRITI_MULTI_COMPANY_DATABASE_ARCHITECTURE_v1.0.md`
- `docs/architecture/SMRITI_GOVERNMENT_INTEGRATION_PLATFORM_ADR_v1.0.md`

## 13. Related RFCs
- `RFC-2026-08-01`: Multi-Tenant Cryptographic JWT Context & Database Registry Routing
