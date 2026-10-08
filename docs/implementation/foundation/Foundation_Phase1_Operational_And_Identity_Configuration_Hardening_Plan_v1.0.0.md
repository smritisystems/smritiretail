<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-09
  Modified     : 2026-10-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Canonical Implementation Plan (IPGP)
-->

# Implementation Plan: SMRITI Retail OS — Phase 1 Operational & Identity Configuration Hardening

**Plan ID:** `IPGP-FOUNDATION-P1-v1.0.0`  
**Area:** Foundation, Statutory & Commercial Configuration  
**Status:** Completed

---

## 1. Objective
Systematically remediate all 14 validated Priority 1 (P1) forensic audit findings in SMRITI Retail OS. Transition operational seller metadata, GST state resolution, and statutory verification boundaries from embedded hardcoded literals to dynamic, tenant-isolated database models and canonical services.

---

## 2. Business Motivation
In multi-tenant, enterprise retail environments, hardcoding specific seller names (e.g. `"Tattly Threads"`), specific default GSTINs (`"27AAXFT2508H1ZR"`), or state assumptions (`"27" - Maharashtra`) creates multi-tenant isolation breaches, incorrect tax invoice generation for new tenants, and fragile statutory reporting. Phase 1 guarantees that every tenant and branch operates with dynamic, verified statutory credentials.

---

## 3. Scope
The 14 validated P1 findings grouped into three execution clusters:
- **Cluster A: Statutory State Resolution Unification (P1-6, P1-7, P1-8, P1-9, P1-10, P1-11)**:
  - Migrate `src/constants/indianLocationData.ts` and `src/components/customer/CustMailingDlg.tsx` to canonical `/control/reference/states` (`states_ref`).
  - Unify E-Way Bill (`eway_bill_service.py`), CRM Pydantic validators (`schemas/crm.py`), and WMS Pydantic validators (`schemas/wms.py`) to derive state validities from `states_ref` rather than static code lists.
- **Cluster B: Seller & Tenant Metadata De-Hardcoding (P1-1, P1-2, P1-3, P1-4, P1-5)**:
  - De-hardcode `"Tattly Threads"`, `"27AAXFT2508H1ZR"`, and state `"27"` in `CanonicalSalesPostingWriter` (`canonical_sales_writer.py:516, 657, 663, 672`).
  - Resolve seller identity and GSTIN dynamically from active tenant `Company` and `Branch` entities.
  - De-hardcode `"Maharashtra"` fallback in `sales.py:892`.
- **Cluster C: Multi-Tenant & Identity Scope Governance (P1-12, P1-13, P1-14)**:
  - Remove hardcoded `"COMP-001"` and `"MAIN"` default tenant constants from runtime business paths, requiring explicit tenant context from `TenantContext` or active session.

---

## 4. Current State
- `canonical_sales_writer.py` contains hardcoded literals: `"Tattly Threads"`, `"27AAXFT2508H1ZR"`, and `"27"` as fallbacks when tenant metadata is incomplete.
- `indianLocationData.ts` contains a 37-element hardcoded `INDIAN_STATES` array consumed by `CustMailingDlg.tsx`.
- `eway_bill_service.py` maintains its own `VALID_GST_STATE_CODES` set.
- Pydantic models in `crm.py` and `wms.py` import `GST_STATE_CODES` directly for schema validations.

---

## 5. Gap Analysis
- **Statutory Authority Gap**: State validations are scattered across static sets (`eway_bill_service.py`), arrays (`indianLocationData.ts`), and dictionaries (`gst_engine.py`) rather than unified through `states_ref`.
- **Multi-Tenant Leakage Gap**: New companies configured in SMRITI could inadvertently generate invoices with `"Tattly Threads"` or GSTIN `"27AAXFT2508H1ZR"` if company metadata fields are partially populated.

---

## 6. Architecture Impact
- Replaces static statutory sets with canonical `states_ref` validation.
- Enforces strict tenant presence: missing seller company/branch configuration in posting paths raises structured configuration exceptions (`SMRITI-CFG-TENANT-001`) rather than injecting fictitious demo data.

---

## 7. Proposed Design
1. **Dynamic Seller Identity**: In `CanonicalSalesPostingWriter`, extract `company.name` and `company.gst_number`. If missing on live transactional posting, raise `HTTPException(400, "SMRITI-CFG-001: Company legal name and GSTIN must be configured before posting sales transactions.")`.
2. **Dynamic Location State**: Derive dispatch state strictly from `Warehouse.state` / `Warehouse.pincode` or `Branch.state_code`.
3. **Reference API for UI**: Align `indianLocationData.ts` to re-export `fetchCanonicalIndianStates` from `indianStates.ts`, eliminating the duplicate static list.
4. **Service-Level State Validation**: In `eway_bill_service.py`, validate state prefixes against 2-digit numeric structure and `states_ref`.

---

## 8. Files Created
1. `backend/app/tests/test_phase1_operational_hardening.py`: Unit and integration test suite covering dynamic seller resolution and state verification.

---

## 9. Files Modified
1. `backend/app/services/canonical_sales_writer.py`
2. `backend/app/services/sales.py`
3. `backend/app/services/purchase.py`
4. `backend/app/services/eway_bill_service.py`
5. `src/constants/indianLocationData.ts`
6. `src/components/customer/CustMailingDlg.tsx`

---

## 10. Dependencies
- FastAPI `AsyncSession` & PostgreSQL `states_ref` table.
- `GlobalReferenceService` in `localization_svc.py`.
- `TenantContext` in `deps.py`.

---

## 11. Risks
- Risk: Legacy unit tests might expect `"Tattly Threads"` in snapshot assertions.
  - Mitigation: Audit and update tests to supply explicit mock company names or assert dynamically against seeded tenant.

---

## 12. Rollback Strategy
All changes are code-level refactors backed by Git commits. Rollback via `git checkout` without database migration impact.

---

## 13. Verification Plan
- Column/field parity checks.
- Zero occurrences of `"Tattly Threads"` in transactional service logic.
- Zero duplicate state arrays in `src/constants/`.

---

## 14. Test Plan
- Run `pytest backend/app/tests/test_phase1_operational_hardening.py`.
- Run frontend Vitest test suites.
- Run `npx tsc --noEmit`.

---

## 15. Documentation Impact
- Update `docs/walkthrough/README.md`.
- Create Phase 1 Walkthrough upon completion.
- Update `CHANGELOG.md`.

---

## 16. Deployment Plan
Included in next regular SMRITI Retail OS minor release.

---

## 17. Status
Completed.

---

## 18. Related ADRs
- `ADR-048`: Statutory Reference Single-Source Architecture.
- `ADR-051`: Multi-Tenant Seller Identity Strictness.

---

## 19. Related Walkthroughs
- `docs/walkthrough/statutory/Statutory_Phase0_P0_Hotfix_Remediation_And_Acceptance_v3.16.1.md`
