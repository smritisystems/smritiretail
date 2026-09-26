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
  Classification: Architecture Walkthrough — UX Field Governance & SSOT
-->

# Foundation: UX Field ↔ DB Mapping, Duplication & Hardcoding Governance Audit (v3.44.0)

## 1. Purpose
Establish and enforce the foundational SMRITI architectural principle:
> **ONE FIELD → ONE CANONICAL DEFINITION → ONE AUTHORITATIVE DB MAPPING → MANY UX REFERENCES**

Prevent UI components and forms from independently owning authoritative business-field definitions (labels, required status, validation regex, max lengths). Implement a complete repository-wide audit, canonical field registry SSOT in Python and TypeScript, database seeder, master form wiring, automated test suite, and a CI-blocking governance guard.

---

## 2. Scope
- Physical database discovery across `smriti001` (Tenant) and `smritisys` (Control Plane) (295 tables, 6,128 columns).
- Python SSOT: `backend/app/governance/field_registry.py` (132 canonical fields with strict uniqueness invariants).
- PostgreSQL Control Plane Seed: `smritisys.field_definitions` populated via `seed_field_definitions.py`.
- TypeScript SSOT: `src/services/canonicalFieldRegistry.ts` generated with helper query functions.
- Master UX Engine: Refactored `src/components/global/master/types.ts`, `MasterFormDrawer.tsx`, `MasterListScreen.tsx`, and all 9 Master configs in `src/components/global/configs/`.
- CI Governance Guard: `scripts/ci_ux_field_governance_guard.py` verifying 6 invariant checks.
- Baseline Tracking: `scripts/ux_field_governance_baseline.json` governing legacy raw JSX inputs.
- Test Suites: `backend/tests/test_ux_field_governance.py` (15/15 passed) and `src/tests/canonicalFieldRegistry.test.ts` (6/6 passed).

---

## 3. Files Created
1. `backend/app/governance/__init__.py`: Governance package init with UADHP.
2. `backend/app/governance/field_registry.py`: Python SSOT containing 132 canonical fields, uniqueness invariants, and alias resolver.
3. `backend/app/db/seed_field_definitions.py`: Idempotent seeder populating `smritisys.field_definitions` under `@seed_contract(target="control")`.
4. `src/services/canonicalFieldRegistry.ts`: Auto-generated TypeScript SSOT mirror of the field registry.
5. `scripts/generate_ts_field_registry.py`: Code generator compiling Python `CANONICAL_FIELDS` into TypeScript.
6. `scripts/generate_field_governance_baseline.py`: AST/regex analyzer detecting raw legacy business field definitions.
7. `scripts/ux_field_governance_baseline.json`: Governed baseline tracking 25 legacy raw JSX inputs.
8. `scripts/ci_ux_field_governance_guard.py`: CI-blocking audit script enforcing 6 zero-tolerance governance checks.
9. `backend/tests/test_ux_field_governance.py`: Comprehensive pytest suite covering all 7 audit domains (15 tests).
10. `src/tests/canonicalFieldRegistry.test.ts`: Vitest suite verifying client-side SSOT resolution (6 tests).
11. `UX_FIELD_GOVERNANCE_AUDIT.md`: Human-readable markdown audit report.
12. `UX_FIELD_GOVERNANCE_AUDIT.json`: Machine-readable audit results.
13. `UX_FIELD_GOVERNANCE_AUDIT.csv`: Tabular audit results.

---

## 4. Files Modified
1. `backend/app/api/v1/ui_control_plane.py`: Added `entity_key` filtering and governance fields to `get_field_definitions`.
2. `src/components/global/master/types.ts`: Added optional `fieldId?: CanonicalFieldId | string` to `MasterFormFieldDef` and `MasterColumnDef`.
3. `src/components/global/master/MasterFormDrawer.tsx`: Integrated `getCanonicalField` for automated label, placeholder, max length, and validation derivation.
4. `src/components/global/master/MasterListScreen.tsx`: Integrated `getCanonicalField` for automated column label derivation.
5. `src/components/global/configs/customerMaster.con.tsx`: Attached canonical `fieldId`s (`customer.name`, `customer.mobile`, `customer.outstanding`, etc.).
6. `src/components/global/configs/itemMaster.config.tsx`: Attached canonical `fieldId`s (`product.name`, `product.code`, `product.barcode`, `product.price`, `product.stock`, etc.).
7. `src/components/global/configs/supplierMaster.con.tsx`: Attached canonical `fieldId`s (`supplier.name`, `supplier.mobile`, `supplier.outstanding`, etc.).
8. `src/components/global/configs/staffMaster.config.tsx`: Attached canonical `fieldId`s (`user.full_name`, `user.username`, `user.role`, `user.designation`, `user.branch`, etc.).
9. `src/components/global/configs/masterLookup.confi.tsx`: Attached canonical `fieldId`s (`master_value.name`, `master_value.code`, `master_value.active`, `master_value.master_type_id`).
10. `src/components/global/configs/posProfiles.config.tsx`: Attached canonical `fieldId`s (`pos_profile.name`, `pos_profile.code`, `pos_profile.cashier`, `pos_profile.warehouse`).
11. `src/components/global/configs/documentSeries.con.tsx`: Attached canonical `fieldId`s (`document_series.code`, `document_series.document_type`, `document_series.prefix`, etc.).
12. `src/components/global/configs/approvalMatrix.con.tsx`: Attached canonical `fieldId`s (`approval_policy.name`, `approval_policy.document_type`).
13. `src/components/global/configs/termsEngine.config.tsx`: Attached canonical `fieldId`s (`terms_clause.title`, `terms_clause.code`, `terms_clause.content`).
14. `src/types.ts`: Added optional demographic and address fields (`religion`, `ageGroup`, `loyaltyTier`, etc.) to `Customer`.
15. `package.json`: Added `governance:fields` script to run the CI guard.

---

## 5. Architecture Decisions
1. **SSOT Location:** The authoritative single source of truth for business fields is maintained in Python (`backend/app/governance/field_registry.py`) and compiled into TypeScript (`src/services/canonicalFieldRegistry.ts`) to avoid duplicate metadata maintenance.
2. **Tenant Data Boundary Enforcement:** Field metadata stored in `smritisys.field_definitions` maintains positive table ownership (`TENANT` vs `CONTROL_PLANE`). Field definitions themselves never contain or move tenant transactional data.
3. **Controlled Alias Resolution:** Business aliases (e.g. `customer.phone` -> `customer.mobile`, `item.name` -> `product.name`) are governed explicitly with recorded reasons and cannot be defined ad-hoc.
4. **Controlled Legacy Baseline:** Existing raw JSX components are recorded in `scripts/ux_field_governance_baseline.json` with ownership and remediation targets, blocking any new hardcoded fields.

---

## 6. Design Rationale
- Independent UI metadata definitions lead to silent drift, inconsistent Indian GST/PAN/Mobile validations, and broken database persistence.
- Driving labels and validation from the canonical metadata layer guarantees that modifying a field's business rule updates all consuming screens simultaneously.

---

## 7. Implementation Summary
- 132 canonical fields declared with physical DB column parity in PostgreSQL.
- 100% of 9 Master UI configurations wired to canonical field IDs.
- CI guard executes in < 2 seconds with 0 broken mappings, 0 duplicate IDs, 0 conflicting definitions, and 0 orphan UX references.
- 0 TypeScript compiler errors across 3,593 modules.

---

## 8. Tests Executed
1. `pytest backend/tests/test_ux_field_governance.py -v`: 15/15 passed in 3.61s.
2. `npx vitest run src/tests/canonicalFieldRegistry.test.ts`: 6/6 passed in 1.19s.
3. `npm run governance:fields`: All 6 CI checks passed with exit code 0.
4. `npm run build`: Production bundle created in 35.38s with 0 errors.
5. `npm run lint`: `tsc --noEmit` exited with 0 errors.

---

## 9. Verification Results
```
CI GUARD RESULT: PASS WITH EXPLICIT EXCEPTIONS
Critical/Error Violations: 0
Registry Invariants: PASS (132/132)
Physical DB Schema: PASS (132/132 live columns matched)
Tenant Boundary Parity: PASS (100%)
UX Master Configs: PASS (89/89 field references verified, 0 orphans)
Hardcoding Guard: PASS (0 unauthorized fields, 25 governed baseline entries)
API Contract Alignment: PASS (6/6 core entities mapped)
```

---

## 10. Known Limitations
- Legacy JSX forms outside `MasterFormDrawer` currently rely on `scripts/ux_field_governance_baseline.json`. Future migrations should refactor them to use `MasterFormDrawer` or `FieldRenderer`.

---

## 11. Future Work
- Gradually migrate the 25 baselined legacy raw JSX inputs into canonical `MasterFormDrawer` or `FieldRenderer` components to reduce baseline count to 0.
- Expand canonical field definitions to specialized sub-ledger and POS barcode print templates.

---

## 12. Related ADRs
- `ADR-0045`: Positive Table Ownership Architecture (TDB-v2.0)
- `ADR-0052`: Canonical UI Control Plane & Field Definition Architecture

---

## 13. Related RFCs
- `RFC-2026-09-001`: UX Field SSOT & DB Mapping Governance
