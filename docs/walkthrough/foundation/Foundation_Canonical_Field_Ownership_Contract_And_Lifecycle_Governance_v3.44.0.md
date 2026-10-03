<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.44.0
  Created      : 2026-09-23
  Modified     : 2026-09-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Architecture Governance Walkthrough
-->

# Walkthrough: Canonical Field Ownership Contract (CFOC) & Lifecycle Governance

**Version:** 3.44.0  
**Domain:** Foundation / Architecture Governance  
**Status:** Completed  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  

---

## 1. Purpose

This document details the implementation of the **Canonical Field Ownership Contract (CFOC)** across SMRITI Retail OS. It establishes and enforces the strict architectural separation of concerns between five foundational system layers:
1. **FIELD DEFINITION** (Logical identity, label, validation rules, field lifecycle)
2. **DATABASE MAPPING** (Physical table, column, constraints, tenant boundary)
3. **API CONTRACT** (Serialization keys, DTO definitions, REST endpoints)
4. **SCREEN FIELD USAGE** (Screen placement, visibility, sectioning, ordering)
5. **UI PRESENTATION** (Widgets, formatting, styling, design tokens)

This contract enforces the **Single Owner Rule**: every business field has exactly one authoritative canonical metadata owner. Downstream consumers (DB, API, UX) consume, validate, or derive from this contract, but never independently redefine authoritative business-field metadata.

---

## 2. Scope

1. **Architecture Contract Specification**: Formalized the CFOC in `docs/architecture/CANONICAL_FIELD_OWNERSHIP_CONTRACT.md`.
2. **Field Lifecycle State Machine**: Added `FieldLifecycle` (`DRAFT`, `ACTIVE`, `DEPRECATED`, `RETIRED`, `LEGACY`) to `CanonicalFieldDef` in Python SSOT (`field_registry.py`) and TypeScript client registry (`canonicalFieldRegistry.ts`).
3. **Canonical Field ID Decoupling**: Enforced that canonical Field IDs (`<domain>.<entity>.<field>`) are logical identities independent of physical PostgreSQL column names (e.g. `customer.gst_number` mapped to `customers.gst_number` with alias `gstin`).
4. **7-Tuple Exception Governance**: Standardized all legacy baseline entries in `scripts/ux_field_governance_baseline.json` into the mandatory 7-tuple contract: `exception_id`, `field_id`, `reason`, `owner`, `created_at`, `expires_at`, `remediation_target`.
5. **CI Governance Guard Enhancement**: Added Check 7 (Field Lifecycle Integrity) and Check 8 (Exception Governance & Expiry Audit) to `scripts/ci_ux_field_governance_guard.py`.
6. **Automated Test Suites**: Extended `backend/tests/test_ux_field_governance.py` (23/23 tests green) and `src/tests/canonicalFieldRegistry.test.ts` (8/8 tests green).

---

## 3. Files Created

1. `docs/architecture/CANONICAL_FIELD_OWNERSHIP_CONTRACT.md`
2. `docs/walkthrough/foundation/Foundation_Canonical_Field_Ownership_Contract_And_Lifecycle_Governance_v3.44.0.md`

---

## 4. Files Modified

1. `backend/app/governance/field_registry.py` (Added `FieldLifecycle` enum, `lifecycle`, `api_key`, `api_endpoint` attributes, invariant enforcement, aliases).
2. `scripts/ux_field_governance_baseline.json` (Migrated 25 legacy baseline entries to mandatory 7-tuple exception governance schema).
3. `scripts/generate_ts_field_registry.py` (Emits `FieldLifecycle` type, `lifecycle`, `apiKey`, and `apiEndpoint` properties).
4. `src/services/canonicalFieldRegistry.ts` (Regenerated client SSOT registry, 132 fields, 101 KB).
5. `scripts/ci_ux_field_governance_guard.py` (Added Check 7: Lifecycle Integrity and Check 8: Exception Governance & Expiry Audit).
6. `backend/tests/test_ux_field_governance.py` (Added Domains 8, 9, 10: Lifecycle, Exception Contract, Decoupled Field IDs & Single Owner).
7. `src/tests/canonicalFieldRegistry.test.ts` (Added tests for Field Lifecycle, Single Owner Rule, and alias resolution).
8. `docs/walkthrough/README.md` (Appended entry to master walkthrough index).

---

## 5. Architecture Decisions

1. **ADR-CFOC-001: 5-Layer Field Decoupling**: No single file or layer may conflate DB column name with UI label, validation rules, and screen layout.
2. **ADR-CFOC-002: Single Owner Rule**: Authoritative business metadata is defined exclusively in `CANONICAL_FIELDS` (Python SSOT) and synchronized via automated code generation to TypeScript client (`canonicalFieldRegistry.ts`).
3. **ADR-CFOC-003: Stable Canonical Field IDs**: Logical field identifiers (`<entity>.<field>`) remain invariant when underlying physical PostgreSQL column names change. Controlled aliases bridge legacy column names.
4. **ADR-CFOC-004: Finite Lifecycle State Machine**:
   - `DRAFT`: Prohibited from production UX.
   - `ACTIVE`: General availability.
   - `DEPRECATED`: Blocked from new screens.
   - `RETIRED`: Forbidden anywhere in code; fails CI immediately.
   - `LEGACY`: Permitted only with active, unexpired exception baseline record.
5. **ADR-CFOC-005: Zero Silent Exceptions Policy**: Every exception must explicitly state owner, rationale, creation date, expiration date, and remediation target. CI enforces date validity and schema completeness.

---

## 6. Design Rationale

Prior to CFOC, components frequently conflated database column names with user-facing labels or hardcoded input validation logic inside raw JSX. When database schema updates occurred, frontend code became brittle. By decoupling canonical field identity from physical storage and enforcing single metadata ownership through CI validation, SMRITI achieves compile-time and runtime field consistency across all modules.

---

## 7. Implementation Summary

1. **Python Governance Core (`field_registry.py`)**:
   - Defined `FieldLifecycle` string enum with 5 lifecycle states.
   - Extended `CanonicalFieldDef` dataclass with `lifecycle: str = "ACTIVE"`, `api_key`, and `api_endpoint`.
   - Updated `assert_registry_invariants()` to validate lifecycle enum membership.
2. **TypeScript Registry Code Generator (`generate_ts_field_registry.py`)**:
   - Generates `export type FieldLifecycle = "DRAFT" | "ACTIVE" | "DEPRECATED" | "RETIRED" | "LEGACY";`.
   - Emits `lifecycle`, `apiKey`, and `apiEndpoint` on every registered field.
3. **CI Governance Guard (`ci_ux_field_governance_guard.py`)**:
   - Check 7: Inspects all UX files and registry to ensure no `DRAFT` or `RETIRED` fields are in production UI.
   - Check 8: Validates all entries in `ux_field_governance_baseline.json` against the 7-tuple contract and verifies `expires_at >= current_date`.
4. **Automated Testing Suite**:
   - 23 unit and integration tests across 10 verification domains in `test_ux_field_governance.py`.
   - 8 frontend tests in `canonicalFieldRegistry.test.ts`.

---

## 8. Tests Executed

1. `pytest backend/tests/test_ux_field_governance.py -v`: 23/23 tests passed in 6.35s.
2. `npx vitest run src/tests/canonicalFieldRegistry.test.ts`: 8/8 tests passed in 495ms.
3. `python scripts/ci_ux_field_governance_guard.py`: 8/8 checks passed, 0 critical/error violations.
4. `python scripts/generate_ts_field_registry.py`: 132 definitions processed, 101,574 bytes generated.

---

## 9. Verification Results

| Check / Domain | Result | Metric |
|---|---|---|
| Domain 1: Registry Invariants | PASSED | 132/132 Unique Field IDs |
| Domain 2: DB Schema Reconciliation | PASSED | 0 Broken DB Mappings |
| Domain 3: Tenant Data Boundary | PASSED | 100% Table Ownership Parity |
| Domain 4: UX Master Configs Alignment | PASSED | 89 References, 0 Orphans |
| Domain 5: Hardcoding & Baseline | PASSED | 25 Governed Legacy Entries |
| Domain 6: API Contract Alignment | PASSED | 6/6 Core Entities Mapped |
| Domain 7: TypeScript SSOT Parity | PASSED | 100% Schema & Property Parity |
| Domain 8: Field Lifecycle Governance | PASSED | 132 Fields with Valid Lifecycle |
| Domain 9: Exception Governance & Expiry | PASSED | 0 Schema Defects, 0 Expired |
| Domain 10: Decoupled ID & Single Owner | PASSED | Verified Resolution & Aliases |
| **CI Guard Status** | **PASS WITH EXPLICIT EXCEPTIONS** | **0 Critical / 0 Error Violations** |

---

## 10. Known Limitations

- 25 legacy raw JSX inputs in non-migrated screens (`BarcodeManagementTab.tsx`, `CashRegisterTab.tsx`, `CustBrowseDlg.tsx`, `CustomerBalanceSummaryTab.tsx`, `DailyCashSummaryTab.tsx`, `DenominationAuditTab.tsx`, `ECommerceDashboardTab.tsx`, `GrnReceiptTab.tsx`) remain in the baseline with active exception IDs (`EXC-LEGACY-0001` through `EXC-LEGACY-0025`), expiring on 2026-12-31, targeted for remediation in `v4.0.0-phase3`.

---

## 11. Future Work

- Incrementally migrate the 25 legacy components to use `FieldRenderer` and `MasterFormDrawer`.
- Introduce field-level auditing for API endpoints to reject unmapped input properties automatically in FastAPI request validation.

---

## 12. Related ADRs

- `ADR-041: Tenant Data Boundary Architecture v2.0`
- `ADR-042: SMRITI Canonical Parameter Namespace`
- `ADR-043: Canonical Field Ownership Contract (CFOC)`

---

## 13. Related RFCs

- `RFC-2026-0923-01: UX Field Single Source of Truth & Registry Invariants`
- `RFC-2026-0923-02: Field Lifecycle State Machine & Exception Governance`
