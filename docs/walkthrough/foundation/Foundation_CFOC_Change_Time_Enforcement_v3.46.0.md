<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.46.0-p4
  Created      : 2026-09-23
  Modified     : 2026-09-23 (p4 — API DTO Reconciliation Guard added)
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Architecture Governance Walkthrough
-->

# Walkthrough: CFOC v3.46.0 — Change-Time Enforcement

**Version:** 3.46.0  
**Domain:** Foundation / Architecture Governance  
**Status:** Completed  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  

---

## 1. Purpose

This document details the architecture and implementation of **CFOC v3.46.0 — Change-Time Enforcement**. Elevating the Canonical Field Ownership Contract from post-hoc CI detection to proactive prevention, CFOC v3.46.0 ensures that ungoverned fields cannot be created in database migrations, runtime boundary violations are rejected fail-closed, and developers are guided through canonical promotion order.

Core Architectural Premise:
> *"Don't only detect bad fields. Prevent creation of ungoverned fields."*

---

## 2. Scope

1. **Migration → CFOC Gate**:
   - Automated AST parsing of all 165 Alembic migrations (`backend/alembic/versions/*.py`).
   - Intercepts `op.add_column()` and `op.create_table()` calls on governed tables, guaranteeing every column is either canonically registered or formally classified before migration execution.
2. **Declarative DB Column Classification Contract**:
   - Created `backend/app/governance/column_classification.py` implementing a closed 5-category contract (`CANONICAL_BUSINESS`, `AUDIT`, `TECHNICAL_FK`, `FRAMEWORK`, `MIGRATION`).
   - Classified 2,373 column instances across governed business tables with strict ownership, versioning, and rationale metadata.
3. **Fail-Closed Runtime Tenant DB Verification**:
   - Extended `backend/app/db/cp_guard.py` with `inspect_tenant_cfoc_boundary()`, verifying that tenant databases (`smriti001`+) never contain control-plane exclusive tables/fields, and that `smritisys` never contains tenant operational data.
4. **API DTO Reconciliation Guard** *(Pillar 4 — added commit `58dd2cd9`)*:
   - Created `scripts/ci_api_dto_reconciliation.py`, a pure AST-based bi-directional reconciliation engine.
   - Inspects **35 Pydantic classes** across **14 governed entity schemas** against the canonical field registry.
   - Detects: (A) ACTIVE canonical columns missing from write-side DTOs (warning) and (B) unregistered business-pattern fields in DTOs with no canonical registration (hard failure, exit 1).
   - Result: **0 violations** on first clean run. 21 informational warnings for server-side computed fields intentionally absent from Create DTOs.
5. **Immutable Field ID & Semantic Version Policy**:
   - Added `validate_field_immutability()` in `backend/app/governance/field_registry.py` ensuring `field_id`, `db_table`, and `db_column` cannot be renamed once `ACTIVE`, and enforcing version bumps on metadata changes.
6. **Automatic Exception Expiry Countdown**:
   - Enhanced Check 8 of `scripts/ci_ux_field_governance_guard.py` to calculate `days_until_expiry` and emit proactive warning alerts for exceptions within 30 days of expiration.
7. **Canonical New-Field Developer Tooling**:
   - Built `scripts/create_canonical_field.py`, an interactive and CLI wizard enforcing the 6-step canonical promotion order.
8. **Comprehensive Test Suite & CI Integration**:
   - Expanded Pytest suite from 29 to 35 passing tests across 17 governance domains.
   - Added `CFOC Migration-Time Column Guard` and `CFOC API DTO Reconciliation Guard` to `.github/workflows/ci.yml`.

---

## 3. Files Created

1. `backend/app/governance/column_classification.py` — Declarative 5-category column classification contract.
2. `scripts/ci_migration_cfoc_guard.py` — Alembic migration AST scanner.
3. `scripts/create_canonical_field.py` — Developer CLI wizard enforcing CFOC promotion order.
4. `docs/walkthrough/foundation/Foundation_CFOC_Change_Time_Enforcement_v3.46.0.md` — This WGP walkthrough document.
5. `scripts/ci_api_dto_reconciliation.py` — AST-based Pydantic DTO ↔ Canonical Field Registry reconciliation guard (Pillar 4).

---

## 4. Files Modified

1. `backend/app/governance/field_registry.py` — Version bumped to 3.46.0; added `validate_field_immutability()`.
2. `backend/app/db/cp_guard.py` — Added `inspect_tenant_cfoc_boundary()` and wired tenant inspection into `run_startup_check()`.
3. `scripts/ci_ux_field_governance_guard.py` — Added Checks 10 (Migration-Time CFOC Parity) and 11 (Declarative Column Classification), and 30-day countdown warning.
4. `backend/tests/test_ux_field_governance.py` — Added Domains 14, 15, 16, 17 (35 total tests).
5. `src/services/canonicalFieldRegistry.ts` — Regenerated frontend SSOT with v3.46.0 versioning.
6. `src/tests/canonicalFieldRegistry.test.ts` — Updated Vitest version assertions to v3.46.0.
7. `.github/workflows/ci.yml` — Added `CFOC Migration-Time Column Guard` and `CFOC API DTO Reconciliation Guard` steps. Bumped to CI v2.1.0.
8. `package.json` — Added `npm run governance:dto` and `npm run governance:all` scripts.
9. `docs/walkthrough/README.md` — Updated master index.
10. `docs/implementation/README.md` — Updated master implementation index.
11. `CHANGELOG.md` — Documented v3.46.0 release under `[6.44.1]`.

---

## 5. Architecture Decisions

### ADR-1: Closed 5-Category Physical Column Contract
- **Decision:** Physical columns across governed tables must belong to exactly one of 5 closed categories: `CANONICAL_BUSINESS`, `AUDIT`, `TECHNICAL_FK`, `FRAMEWORK`, `MIGRATION`.
- **Rationale:** Prevents ad-hoc or undocumented categories. Guarantees that any column holding business data is formally governed by CFOC.

### ADR-2: Migration-Time AST Guard
- **Decision:** Use Python `ast` to parse Alembic migrations rather than relying on regex or live database reflection alone.
- **Rationale:** Static AST inspection allows CI to intercept ungoverned columns before migrations are executed on staging or production databases.

### ADR-3: Field Immutability Once ACTIVE
- **Decision:** Prohibit in-place renames of `field_id` or physical column mappings for `ACTIVE` fields. Require version increments for metadata modifications.
- **Rationale:** Protects downstream consumers (frontend components, reporting engines, API clients) from breaking changes.

### ADR-4: Bi-Directional API DTO Reconciliation (Pure AST, No Runtime)
- **Decision:** Reconcile Pydantic DTO field names against canonical `db_column` identifiers using Python `ast` only — zero FastAPI/SQLAlchemy imports in CI.
- **Rationale:** Avoids requiring database connectivity or app startup in CI. Any clean Python 3.11 environment can run the guard.
- **Trade-off:** A `DTO_CANONICAL_ALIASES` map must be maintained as Pydantic schemas evolve (e.g., `gstin` → `gst_number`, `legal_name` → `customer_name`). This is a documented, explicit governance artifact — not a hidden coupling.

---

## 6. Design Rationale

By implementing change-time enforcement, the developer feedback loop is shifted left:
1. A developer writing an Alembic migration is warned immediately if a column is added without canonical registration.
2. The `create_canonical_field.py` wizard simplifies compliance, generating copy-paste ready definitions.
3. Runtime startup verifies database boundaries across both control plane and tenant environments.

---

## 7. Implementation Summary

- **Total Canonical Fields:** 132 fields maintained across 14 governed tables.
- **Total Classified Columns:** 2,373 columns categorized.
- **Migration Coverage:** 165 Alembic migration scripts inspected (0 unclassified).
- **DTO Coverage:** 35 Pydantic classes reconciled across 14 governed entity schemas (0 violations).
- **Checks in CI Guard:** Expanded from 9 to 11 automated checks.
- **CI Jobs:** 5 governance gate steps in `backend-ci` (Naming, Boundary, Migration CFOC, DTO Reconciliation, UX Field Governance).

---

## 8. Tests Executed

1. `python scripts/ci_migration_cfoc_guard.py` (Exit Code 0).
2. `python scripts/ci_api_dto_reconciliation.py` (Exit Code 0 — 35 classes, 0 violations).
3. `python scripts/verify_ts_registry_drift.py` (Exit Code 0).
4. `npm run governance:fields` (11/11 Checks Passed, Exit Code 0).
5. `pytest backend/tests/test_ux_field_governance.py -v` (35/35 Passed in 10.06s).
6. `npx vitest run src/tests/canonicalFieldRegistry.test.ts` (10/10 Passed in 499ms).
7. `npx tsc --noEmit` (Zero TypeScript errors).

---

## 9. Verification Results

| Governance Domain | Target | Result | Evidence |
|---|---|---|---|
| Domain 10: Migration CFOC Parity | 0 unclassified | **0 unclassified** | 165 migration scripts scanned |
| Domain 11: Column Classification | Closed 5-categories | **2,373 columns classified** | `CFOC_DB_COLUMN_CLASSIFICATION` |
| Domain 14: Classification Invariants | Valid categories | **PASSED** | 5 closed enum values verified |
| Domain 15: Migration Guard | AST verified | **PASSED** | Exit code 0 |
| Domain 16: Field Immutability | Rejection on rename | **PASSED** | `validate_field_immutability` tested |
| Domain 17: Tenant DB Boundary | 0 missing tables | **PASSED** | `inspect_tenant_cfoc_boundary("smriti001")` clean |
| **Pillar 4: API DTO Reconciliation** | **0 violations** | **PASSED** | 35 classes, 14 entities, exit 0, commit `58dd2cd9` |
| Pytest Test Suite | 35 tests | **35/35 PASSED** | 17 domains green |
| Vitest Test Suite | 10 tests | **10/10 PASSED** | Runtime immutability & version 3.46.0 |
| TypeScript Compiler | 0 errors | **0 ERRORS** | `tsc --noEmit` |

---

## 10. Known Limitations

- 21 legacy transactional modal inputs remain baselined under approved exceptions (`EXC-LEGACY-0001` through `EXC-LEGACY-0025`), expiring on 2026-12-31, scheduled for phased migration in v4.0.0.

---

## 11. Future Work

- **SMRITI Retail OS v4.0.0 — Legacy UX Remediation:**
  - Systematic retirement of the 21 legacy transactional modal inputs:
    ```text
    Target: 21 → 15 → 10 → 5 → 0
    ```
  - Migrate raw modal inputs to canonical `MasterFormDrawer` and `FieldRenderer` components.

---

## 12. Related ADRs

- `ADR-041: Tenant Data Boundary Architecture v2.0`
- `ADR-043: Canonical Field Ownership Contract (CFOC)`
- `ADR-044: Zero-Manual-Registry Drift & Deterministic Fingerprinting`
- `ADR-045: CFOC Change-Time Enforcement & Declarative Column Classification`

---

## 13. Related RFCs

- `RFC-2026-0923-01: UX Field Single Source of Truth & Registry Invariants`
- `RFC-2026-0923-02: Field Lifecycle State Machine & Exception Governance`
- `RFC-2026-0923-03: Deterministic Registry Fingerprinting & Immutability Guard`
- `RFC-2026-0923-04: Migration-Time CFOC Gates & Closed Column Classification`
- `RFC-2026-0923-05: API DTO ↔ Canonical Registry Bi-Directional Reconciliation`
