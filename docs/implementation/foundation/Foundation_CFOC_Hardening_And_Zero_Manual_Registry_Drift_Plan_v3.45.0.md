<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.45.0
  Created      : 2026-09-23
  Modified     : 2026-09-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Architecture Implementation Plan — CFOC Hardening
-->

# SMRITI Retail OS — Implementation Plan: CFOC Hardening & Zero-Manual-Registry Drift (v3.45.0)

## 1. Objective
Harden the Canonical Field Ownership Contract (CFOC v3.45.0) against manual registry drift, generated-file tampering, and undocumented database field introductions without redesigning or disrupting the established baseline of 132 canonical fields, 0 broken DB mappings, and 25 explicitly governed legacy exceptions.

## 2. Business Motivation
In an enterprise retail ERP system, field definitions (labels, required status, validation rules, formatting, and DB mappings) must have an absolute single source of truth (SSOT). Without automated drift guards, frontend developers may hand-edit generated TypeScript files or introduce ad-hoc field definitions in JSX, leading to silent schema drift, runtime validation inconsistencies, and data corruption across store terminals.

## 3. Scope
- Authoritative Python SSOT (`backend/app/governance/field_registry.py`).
- Frontend generated mirror (`src/services/canonicalFieldRegistry.ts`).
- Registry generation & verification toolchains (`scripts/generate_ts_field_registry.py`, `scripts/verify_ts_registry_drift.py`).
- Bi-directional PostgreSQL schema reconciliation & AST-based UX governance (`scripts/ci_ux_field_governance_guard.py`).
- Continuous integration pipeline (`.github/workflows/ci.yml`).
- Test suites (`backend/tests/test_ux_field_governance.py`, `src/tests/canonicalFieldRegistry.test.ts`).

## 4. Current State
- CFOC v3.44.0 provided basic 5-layer separation and 8-check CI guard.
- However, `canonicalFieldRegistry.ts` could be manually modified without failing CI if the generator was not invoked.
- Database reconciliation was primarily unidirectional (Registry → DB), without complete reverse classification of all physical columns on governed tables.
- Hardcoded field scanning relied on simple regex patterns rather than AST-aware structural parsing.

## 5. Gap Analysis
1. **Unmonitored Generated-File Drift:** Need deterministic validation comparing committed TS vs Python SSOT.
2. **Reverse Column Classification:** Need comprehensive audit of all physical columns in PostgreSQL tables (`CANONICAL_BUSINESS`, `AUDIT`, `TECHNICAL_FK`, `FRAMEWORK`, `MIGRATION`) to guarantee 0 unmapped business columns.
3. **Cryptographic Integrity:** Need a stable SHA-256 fingerprint generated over all canonical fields to detect any metadata alterations.
4. **Client-side Immutability:** Need runtime protection (`Object.freeze`) to prevent runtime mutations in frontend execution.

## 6. Architecture Impact
- Reaffirms `backend/app/governance/field_registry.py` as the sole authoritative owner of business field metadata.
- Implements deterministic SHA-256 fingerprinting (`CFOC_REGISTRY_FINGERPRINT`).
- Hardens CI workflow with zero-drift enforcement.
- Retains full backward compatibility with all 9 Master UI configurations and core modules.

## 7. Proposed Design
1. **Fingerprint Generator:** `compute_registry_fingerprint()` calculates SHA-256 over alphabetically sorted field definitions.
2. **Drift Comparator:** `scripts/verify_ts_registry_drift.py` normalizes line endings and performs unified diff comparison.
3. **AST/Structural UX Scanner:** Structural tokenization distinguishing business metadata objects from presentation attributes (`className`, `placeholder`).
4. **Reverse DB Reconciliation:** Classifies all 383 columns across governed tables.

## 8. Files Created
- `scripts/verify_ts_registry_drift.py`
- `docs/walkthrough/foundation/Foundation_CFOC_Hardening_And_Zero_Manual_Registry_Drift_v3.45.0.md`
- `docs/implementation/foundation/Foundation_CFOC_Hardening_And_Zero_Manual_Registry_Drift_Plan_v3.45.0.md`

## 9. Files Modified
- `backend/app/governance/field_registry.py`
- `scripts/generate_ts_field_registry.py`
- `scripts/ci_ux_field_governance_guard.py`
- `.github/workflows/ci.yml`
- `backend/tests/test_ux_field_governance.py`
- `src/services/canonicalFieldRegistry.ts`
- `src/tests/canonicalFieldRegistry.test.ts`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- Python 3.13 (`hashlib`, `difflib`, `pathlib`, `psycopg2`).
- TypeScript 5.8 / Vitest 4.1.
- PostgreSQL 16+ (`smriti001`, `smritisys`).

## 11. Risks
- **Risk:** Developers manually editing `canonicalFieldRegistry.ts` cause CI build failures.
  - **Mitigation:** Clear auto-generated banner in header and explicit error message pointing to `python scripts/generate_ts_field_registry.py`.
- **Risk:** New DB migrations adding columns without updating governance.
  - **Mitigation:** Check 2 of `ci_ux_field_governance_guard.py` flags unclassified columns immediately during pre-merge testing.

## 12. Rollback Strategy
All changes are non-destructive and backward compatible. Rollback is accomplished via `git revert` of the CFOC v3.45.0 commit, restoring the v3.44.0 baseline without database migration or data loss.

## 13. Verification Plan
1. Re-run `scripts/verify_ts_registry_drift.py` (Assert exit code 0).
2. Re-run `scripts/ci_ux_field_governance_guard.py` (Assert 9/9 checks OK).
3. Re-run backend Pytest suite (Assert 29/29 tests pass).
4. Re-run frontend Vitest suite (Assert 10/10 tests pass).
5. Re-run `npx tsc --noEmit` (Assert 0 errors).

## 14. Test Plan
- Unit tests for SHA-256 fingerprint generation, determinism, and mutation detection (`TestDeterministicRegistryFingerprint`).
- Parity tests for zero generated-file drift and simulated tampering (`TestZeroGeneratedFileDrift`).
- Reverse database column classification tests (`TestReverseDatabaseColumnClassification`).
- Vitest assertions for runtime immutability (`Object.isFrozen`) and fingerprint format.

## 15. Documentation Impact
- Updated `CHANGELOG.md` with v3.45.0 entry.
- Created `docs/walkthrough/foundation/Foundation_CFOC_Hardening_And_Zero_Manual_Registry_Drift_v3.45.0.md`.
- Appended to `docs/walkthrough/README.md` and `docs/implementation/README.md`.

## 16. Deployment Plan
1. Commit and push to `origin/smritiNX`.
2. CI automatically validates via GitHub Actions `backend-ci`.
3. Standard production release synchronization.

## 17. Status
**Completed** (2026-09-23)

## 18. Related ADRs
- `docs/architecture/CANONICAL_FIELD_OWNERSHIP_CONTRACT.md`
- `docs/architecture/ADR_TENANT_DATA_BOUNDARY_V2.md`

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Foundation_CFOC_Hardening_And_Zero_Manual_Registry_Drift_v3.45.0.md`
- `docs/walkthrough/foundation/Foundation_Canonical_Field_Ownership_Contract_And_Lifecycle_Governance_v3.44.0.md`
