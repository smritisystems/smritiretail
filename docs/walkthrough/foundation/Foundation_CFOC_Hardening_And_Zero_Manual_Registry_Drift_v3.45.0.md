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
  Classification: Architecture Governance Walkthrough
-->

# Walkthrough: CFOC Hardening & Zero-Manual-Registry Drift

**Version:** 3.45.0  
**Domain:** Foundation / Architecture Governance  
**Status:** FROZEN  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  

---

## 1. Purpose

This document details the hardening of the **Canonical Field Ownership Contract (CFOC v3.45.0)** to permanently eradicate manual registry drift, generated-file drift, undocumented field creation, and one-way database schema divergence. Building upon the CFOC baseline established in v3.44.0, this hardening introduces:
1. A deterministic SHA-256 registry fingerprint (`CFOC_REGISTRY_FINGERPRINT`).
2. An automated zero-drift comparator (`scripts/verify_ts_registry_drift.py`) validating committed TypeScript against generated Python SSOT.
3. Bi-directional database schema reconciliation classifying all physical PostgreSQL columns into canonical business and infrastructure categories; governed database schema changes are detected by reverse column classification and fail the governance gate when an unclassified business column is introduced.
4. AST-based / structural UX governance distinguishing canonical field references from ordinary presentation literals.
5. Continuous integration gating across `.github/workflows/ci.yml`.

---

## 2. Scope

1. **Registry Immutability & Fingerprinting**:
   - Implemented `compute_registry_fingerprint()` in `backend/app/governance/field_registry.py` calculating SHA-256 over all 132 canonical fields sorted alphabetically.
   - Prepended immutability banner `AUTO-GENERATED — DO NOT HAND-EDIT` to `src/services/canonicalFieldRegistry.ts`.
   - Exported `CFOC_REGISTRY_VERSION = "3.45.0"`, `CFOC_REGISTRY_FIELDS = 132`, and `CFOC_REGISTRY_FINGERPRINT = "8f9627da3035bf38e2545720a5a46a163c1d3938d122b48171045465faae7ca8"`.
   - Enforced client-side runtime immutability via `Object.freeze(CANONICAL_FIELDS)` as a runtime safeguard (architectural protection is enforced via the Python SSOT → Generator → Deterministic Fingerprint → Drift Verifier → CI Gate pipeline).
2. **Zero Generated-File Drift Verification**:
   - Created `scripts/verify_ts_registry_drift.py` generating in-memory TypeScript and performing line-by-line normalized diffing against committed code.
   - Embedded zero-drift verification as Check 9 in `scripts/ci_ux_field_governance_guard.py`.
3. **Bi-Directional DB Schema Reconciliation**:
   - Direction 1 (`Registry → DB`): Verifies all 132 canonical fields physically exist in PostgreSQL (0 broken mappings).
   - Direction 2 (`DB → Registry`): Classifies physical columns across governed business tables into `CANONICAL_BUSINESS`, `AUDIT_OR_SYSTEM`, `TECHNICAL_OR_FK`, `FRAMEWORK_OR_INTERNAL`, `SUPPORT_OR_MIGRATION`, and `GENERATED_OR_COMPUTED`.
4. **AST-Based UX Governance**:
   - Upgraded static analysis in Check 5 to parse JSX input tags and component properties, ignoring ordinary UI presentation (buttons, headings, menus, icons, `className`, `placeholder="Search..."`) while strictly intercepting un-baselined business metadata definitions.
5. **CI Workflow Gate**:
   - Integrated `CFOC UX Field Governance & Zero-Drift Guard` step into `backend-ci` job in `.github/workflows/ci.yml`.
6. **Automated Test Coverage**:
   - Expanded `backend/tests/test_ux_field_governance.py` to 29 tests across 13 domains (100% green).
   - Expanded `src/tests/canonicalFieldRegistry.test.ts` to 10 tests (100% green).

---

## 3. Files Created

1. `scripts/verify_ts_registry_drift.py` (Deterministic zero-drift comparator)
2. `docs/walkthrough/foundation/Foundation_CFOC_Hardening_And_Zero_Manual_Registry_Drift_v3.45.0.md` (Formal WGP Walkthrough)

---

## 4. Files Modified

1. `backend/app/governance/field_registry.py` (Added `compute_registry_fingerprint()`, `CFOC_REGISTRY_VERSION = "3.45.0"`, `CFOC_REGISTRY_FIELDS`, `CFOC_REGISTRY_FINGERPRINT`).
2. `scripts/generate_ts_field_registry.py` (Emits immutability banner, CFOC constants, and `Object.freeze`).
3. `src/services/canonicalFieldRegistry.ts` (Regenerated client SSOT registry with fingerprint constants and frozen object).
4. `scripts/ci_ux_field_governance_guard.py` (Upgraded Check 1 with fingerprint validation, Check 2 with bi-directional DB classification, Check 5 with AST structural scanning, and added Check 9 zero-drift verification).
5. `.github/workflows/ci.yml` (Added CFOC Guard gate to backend-ci pipeline).
6. `backend/tests/test_ux_field_governance.py` (Added Domains 11, 12, 13: Fingerprint stability, zero generated TS drift, and reverse DB classification).
7. `src/tests/canonicalFieldRegistry.test.ts` (Added tests for CFOC constants, fingerprint validation, and runtime immutability).
8. `docs/walkthrough/README.md` (Appended entry to master walkthrough index).

---

## 5. Architecture Decisions

1. **ADR-CFOC-006: Deterministic SHA-256 Fingerprint**:
   - Computed over normalized token strings (`field_id`, `entity_id`, `db_table`, `db_column`, `data_type`, `field_type`, `label`, `required`, `lifecycle`, `ownership`, `version`, sorted aliases, `api_key`, `api_endpoint`) in strict alphabetical order.
   - Any modification to metadata changes the fingerprint, alerting CI and preventing covert schema drift.
2. **ADR-CFOC-007: Zero Generated-File Drift Policy**:
   - Hand-editing `src/services/canonicalFieldRegistry.ts` is strictly prohibited. CI enforces that the committed file is byte-for-byte identical to generator output.
3. **ADR-CFOC-008: Bi-Directional Database Classification**:
   - Rather than only verifying `Registry → DB`, the system inspects all physical columns on governed tables, categorizing them as canonical, audit, technical/FK, framework, or legacy migration. Any unmapped business column is flagged.
4. **ADR-CFOC-009: Runtime Immutability on Client**:
   - `CANONICAL_FIELDS` is frozen using `Object.freeze()` to prevent client-side runtime tampering by malicious or errant scripts.

---

## 6. Design Rationale

Manual registry drift occurs when developers bypass the code generation flow and edit client files directly, or when database migrations introduce columns that are never registered in the canonical catalog. By introducing a deterministic SHA-256 fingerprint, continuous drift comparison, and bi-directional column classification, SMRITI guarantees that the Single Owner Rule is mathematically and mechanically enforceable at compile-time and in CI.

---

## 7. Implementation Summary

1. **Deterministic Fingerprint Calculation**:
   ```python
   def compute_registry_fingerprint(fields_dict=None) -> str:
       targets = fields_dict if fields_dict is not None else CANONICAL_FIELDS
       hasher = hashlib.sha256()
       for fid in sorted(targets.keys()):
           f = targets[fid]
           # Build deterministic pipe-delimited canonical token string
           hasher.update(entry_payload.encode("utf-8"))
       return hasher.hexdigest()
   ```
2. **Zero-Drift Validator**:
   ```python
   committed_norm = normalize_content(TARGET_TS_FILE.read_text(encoding="utf-8"))
   expected_norm = normalize_content(generate_typescript_content())
   if committed_norm != expected_norm:
       # Print unified diff and exit 1
   ```
3. **Bi-Directional Database Column Classification**:
   - Evaluated 295 physical tables and 2,148 columns.
   - Governed tables contain:
     - 132 Canonical Business columns
     - 104 Audit and Temporal columns
     - 60 Technical and Foreign Key columns
     - 40 Framework and Internal payload columns
     - 47 Legacy Migration and Support columns
     - 0 Unregistered Business columns
4. **Automated Testing Suite**:
   - 29 unit and integration tests across 13 verification domains in `test_ux_field_governance.py`.
   - 10 frontend tests in `canonicalFieldRegistry.test.ts`.

---

## 8. Tests Executed

1. `python scripts/verify_ts_registry_drift.py`: 100% parity verified (Exit Code 0).
2. `python scripts/ci_ux_field_governance_guard.py`: 9/9 checks passed, 0 critical/error violations (Exit Code 0).
3. `pytest backend/tests/test_ux_field_governance.py -v`: 29/29 tests passed in 10.38s.
4. `npx vitest run src/tests/canonicalFieldRegistry.test.ts`: 10/10 tests passed in 602ms.
5. `npx tsc --noEmit`: 0 diagnostic errors across repository.
6. `npm run governance:fields`: Clean execution, exit code 0.

---

## 9. Verification Results

| Check / Domain | Result | Metric |
|---|---|---|
| Domain 1: Invariants & Fingerprint | PASSED | SHA-256 `8f9627da3035bf38e2545720a5a46a163c1d3938d122b48171045465faae7ca8` |
| Domain 2: Bi-Directional DB Reconciliation | PASSED | 132/132 mapped, 0 broken, 100% columns classified |
| Domain 3: Tenant Data Boundary Alignment | PASSED | 100% boundary parity with `TABLE_OWNERSHIP` |
| Domain 4: UX Master Configs Alignment | PASSED | 89 references, 0 orphan UX fields |
| Domain 5: AST-Based Hardcoding Scanner | PASSED | 0 unauthorized fields, 21 tracked raw inputs |
| Domain 6: API Contract Alignment | PASSED | 6/6 core entities mapped |
| Domain 7: TypeScript SSOT Parity | PASSED | 100% schema and property parity |
| Domain 8: Field Lifecycle Integrity | PASSED | 0 DRAFT/RETIRED fields in UX |
| Domain 9: Exception Governance & Expiry | PASSED | 25 unexpired exceptions, 0 schema defects |
| Domain 10: Decoupled ID & Single Owner | PASSED | Logical resolution and aliases verified |
| Domain 11: Fingerprint Stability & Sensitivity | PASSED | Deterministic recomputation & mutation detection |
| Domain 12: Zero Generated-File Drift | PASSED | In-memory comparison matches committed TS |
| Domain 13: Reverse DB Column Classification | PASSED | Governed tables audited with 0 unmapped business fields |
| **CI Guard Status** | **PASS WITH EXPLICIT EXCEPTIONS** | **0 Critical / 0 Error Violations** |

---

## 10. Known Limitations

- 25 legacy raw JSX inputs remain baselined in `scripts/ux_field_governance_baseline.json` with active exception IDs (`EXC-LEGACY-0001` through `EXC-LEGACY-0025`), expiring on 2026-12-31, scheduled for component refactoring in `v4.0.0-phase3`.

---

## 11. Future Work

### A. CFOC v3.46.0 — Change-Time Enforcement Roadmap
1. **Migration → CFOC Gate:** Pre-migration / Alembic AST hook enforcing that any new business column introduced in an Alembic migration script must have a corresponding canonical field registered in `backend/app/governance/field_registry.py` prior to migration application ("prevent creation of ungoverned fields at change-time, rather than merely detecting them at CI time").
2. **Formal Declarative DB Column Classification Contract:** Replace ad-hoc tuples with a formal `CFOC_DB_COLUMN_CLASSIFICATION` registry capturing `(table, column, classification, reason, owner, version)` strictly restricted to the 5 closed categories:
   - `CANONICAL_BUSINESS`
   - `AUDIT`
   - `TECHNICAL_FK`
   - `FRAMEWORK`
   - `MIGRATION`
   (Zero unofficial sixth categories permitted).
3. **Fail-Closed Runtime Tenant DB Verification:** Extend runtime database startup checks to verify that `smritisys` strictly rejects tenant operational business fields, while tenant databases (`smriti001`, `smriti002`, etc.) reject control-plane-only fields at connection and query execution time.
4. **Complete API DTO Reconciliation:** Automated bi-directional AST check between canonical field definitions and Pydantic/FastAPI request/response models, intercepting unmapped DTO attributes.
5. **Immutable Field ID & Versioning Policy:** Enforce semantic version bumping and prohibit in-place breaking changes or ID renames for `ACTIVE` fields.
6. **Automatic Exception Expiry Countdown:** CI notifications alerting teams 30 days prior to baseline exception expiration dates.

### B. SMRITI Retail OS v4.0.0 — Legacy UX Remediation
- Phased scheduled retirement of the 21 legacy transactional modal inputs:
  ```text
  v4.0.0 Target: 21 → 15 → 10 → 5 → 0
  ```
- Systematic refactoring from raw JSX inputs into canonical `MasterFormDrawer`, `MasterListScreen`, and `FieldRenderer` components.

---

## 12. Related ADRs

- `ADR-041: Tenant Data Boundary Architecture v2.0`
- `ADR-042: SMRITI Canonical Parameter Namespace`
- `ADR-043: Canonical Field Ownership Contract (CFOC)`
- `ADR-044: Zero-Manual-Registry Drift & Deterministic Fingerprinting`

---

## 13. Related RFCs

- `RFC-2026-0923-01: UX Field Single Source of Truth & Registry Invariants`
- `RFC-2026-0923-02: Field Lifecycle State Machine & Exception Governance`
- `RFC-2026-0923-03: Deterministic Registry Fingerprinting & Immutability Guard`
