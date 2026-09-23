<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.46.0
  Created      : 2026-09-23
  Modified     : 2026-09-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Architecture Implementation Plan — CFOC Change-Time Enforcement
-->

# SMRITI Retail OS — Implementation Plan: CFOC Change-Time Enforcement (v3.46.0)

## 1. Objective
Shift the Canonical Field Ownership Contract (CFOC v3.46.0) from post-hoc CI detection to proactive **Change-Time Enforcement**. Guarantee that database migrations cannot introduce ungoverned columns, tenant runtime databases reject boundary contamination fail-closed, active fields remain immutable, and developers follow the canonical 6-step promotion order.

## 2. Business Motivation
Detecting bad fields only during late CI builds increases cycle times and risks schema drift slipping into feature branches. By enforcing governance at migration authoring time and during runtime startup, SMRITI Retail OS guarantees zero ungoverned column sprawl across multi-tenant PostgreSQL clusters.

## 3. Scope
- Alembic migration AST analyzer (`scripts/ci_migration_cfoc_guard.py`).
- Declarative physical column classification contract (`backend/app/governance/column_classification.py`).
- Runtime tenant boundary inspection in `backend/app/db/cp_guard.py`.
- Field immutability & semantic versioning policy in `backend/app/governance/field_registry.py`.
- Automatic exception expiry countdown in `scripts/ci_ux_field_governance_guard.py`.
- Canonical new-field developer tooling (`scripts/create_canonical_field.py`).
- CI pipeline integration (`.github/workflows/ci.yml`).

## 4. Current State
- CFOC v3.45.0 locked the baseline: 132 canonical fields, SHA-256 fingerprint, zero TS registry drift, 9 CI checks.
- However, developers could create Alembic migration scripts introducing new columns without first registering them in CFOC.
- Runtime database startup only checked `smritisys`, leaving tenant DB boundary validation manual.

## 5. Gap Analysis
1. **Migration-Time Gap:** No static check on Alembic scripts to verify newly added columns against CFOC before execution.
2. **Column Classification Registry:** Physical columns on governed tables were audited ad-hoc rather than stored in a formal declarative contract.
3. **Runtime Tenant Boundary:** Tenant databases were not verified at startup for contamination by control-plane governance structures.
4. **Field Immutability:** Active fields had no programmatic barrier against in-place renaming or silent metadata modifications without version bumps.

## 6. Architecture Impact
- Enforces pre-migration column classification across all 165 migration versions.
- Introduces `CFOC_DB_COLUMN_CLASSIFICATION` mapping 2,373 column instances across a closed 5-category contract.
- Enhances FastAPI lifespan startup with tenant boundary health checks.
- Bumps CFOC version to `3.46.0`.

## 7. Proposed Design
1. **Alembic AST Extractor:** Traverses Python AST to extract all `op.add_column` and `op.create_table` calls.
2. **Declarative Contract:** Closed enum `ColumnClassification` (`CANONICAL_BUSINESS`, `AUDIT`, `TECHNICAL_FK`, `FRAMEWORK`, `MIGRATION`).
3. **Fail-Closed Tenant Inspector:** Validates presence of canonical business tables and absence of pure control plane governance tables.
4. **Immutability Validator:** Rejects renames of `field_id` or physical column mappings for active fields.

## 8. Files Created
- `backend/app/governance/column_classification.py`
- `scripts/ci_migration_cfoc_guard.py`
- `scripts/create_canonical_field.py`
- `docs/walkthrough/foundation/Foundation_CFOC_Change_Time_Enforcement_v3.46.0.md`
- `docs/implementation/foundation/Foundation_CFOC_Change_Time_Enforcement_Plan_v3.46.0.md`

## 9. Files Modified
- `backend/app/governance/field_registry.py`
- `backend/app/db/cp_guard.py`
- `scripts/ci_ux_field_governance_guard.py`
- `backend/tests/test_ux_field_governance.py`
- `src/services/canonicalFieldRegistry.ts`
- `src/tests/canonicalFieldRegistry.test.ts`
- `.github/workflows/ci.yml`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- Python 3.13 (`ast`, `hashlib`, `difflib`, `psycopg2`).
- TypeScript 5.8 / Vitest 4.1.
- PostgreSQL 16+ (`smriti001`, `smritisys`).

## 11. Risks
- **Risk:** Developer creates an Alembic migration for an internal index/support column and CI fails.
  - **Mitigation:** Column can be immediately classified as `TECHNICAL_FK`, `FRAMEWORK`, or `MIGRATION` in `column_classification.py`.
- **Risk:** Tenant DB startup checks causing latency on large clusters.
  - **Mitigation:** Checks run via lightweight metadata catalog queries (`information_schema.tables`) completing in <50ms.

## 12. Rollback Strategy
Non-destructive code changes. Rollback via `git revert` of the v3.46.0 commit restores the v3.45.0 baseline without schema alteration.

## 13. Verification Plan
1. `python scripts/ci_migration_cfoc_guard.py` (Assert exit code 0).
2. `npm run governance:fields` (Assert 11/11 checks pass).
3. `pytest backend/tests/test_ux_field_governance.py -v` (Assert 37/37 pass).
4. `npx vitest run src/tests/canonicalFieldRegistry.test.ts` (Assert 10/10 pass).
5. `npx tsc --noEmit` (Assert 0 errors).

## 14. Test Plan
- Unit test for declarative column classification invariants (`TestDeclarativeColumnClassificationContract`).
- Unit test for migration AST scanning (`TestMigrationCFOCParity`).
- Unit test for field immutability and version bump policy (`TestFieldImmutabilityAndVersioningPolicy`).
- Unit test for tenant runtime boundary inspection (`TestRuntimeTenantDatabaseBoundaryInspection`).

## 15. Documentation Impact
- Updated `CHANGELOG.md` under `[6.44.1]`.
- Created formal Walkthrough `Foundation_CFOC_Change_Time_Enforcement_v3.46.0.md`.
- Updated master indices in `docs/walkthrough/README.md` and `docs/implementation/README.md`.

## 16. Deployment Plan
1. Merge commit into `origin/smritiNX`.
2. Automated GitHub Actions CI executes migration and governance guards.
3. Deploy to test environment via `git pull`.

## 17. Status
**Completed** (2026-09-23)

## 18. Related ADRs
- `ADR-041: Tenant Data Boundary Architecture v2.0`
- `ADR-043: Canonical Field Ownership Contract (CFOC)`
- `ADR-044: Zero-Manual-Registry Drift & Deterministic Fingerprinting`
- `ADR-045: CFOC Change-Time Enforcement & Declarative Column Classification`

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Foundation_CFOC_Change_Time_Enforcement_v3.46.0.md`
- `docs/walkthrough/foundation/Foundation_CFOC_Hardening_And_Zero_Manual_Registry_Drift_v3.45.0.md`
