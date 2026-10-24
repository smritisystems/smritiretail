<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-20
  Modified     : 2026-10-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
  Policy ID    : IPGP-v1.0
-->

# Implementation Plan: Governed Master Lookup Integration for Customer Creation v1.0.0

## 1. Objective
Integrate the canonical SMRITI Master Lookup and Hybrid Governed Combobox System into Customer Master (`CustMasterWs.tsx`, `CustFormTab.tsx`) and Customer 360° (`Customer360DashboardView.tsx`, `CorporateCustomer360.tsx`) creation workflows on branch `smritiNX`. Prevent arbitrary, inconsistent, duplicate, and unauthorized customer master entries while enabling authorized users to select approved master lookups (Customer Types, Customer Groups, Store Codes, Commercial Terms, Business Classifications) and maintain reusable master records under strict governance.

## 2. Business Motivation
In enterprise and multi-store retail ecosystems (e.g. Reliance Retail, large wholesale accounts, franchise networks), manual typing of customer classifications, store codes, and commercial terms results in master data fragmentation, conflicting credit terms, invalid tax/store routings, and silent duplicate collisions. By binding customer creation to canonical master registries, SMRITI Retail OS ensures that:
- Customer classifications adhere to governed, active enterprise masters.
- Physical Store Codes resolve through the authoritative store/branch registry, preventing cross-customer collisions while preserving delivery vs. billing address separation.
- Commercial Payment Terms automatically populate credit limits, credit days, and interest policies directly from the system terms catalog.
- Duplicate customer creation fails safely with clear guidance instead of silently overwriting existing records.
- Recursive ancestor traversal prevents circular parent-child customer hierarchies.

## 3. Scope
- **Frontend Master Combobox Enhancement:** Extend `GovernedLookupCombobox.tsx` with optional `onCreateNew`, `createActionLabel`, and `loading` states, ensuring backward compatibility with Item Master while empowering Customer workflows with inline creation actions.
- **Customer Master Legacy Form Integration:** Integrate `GovernedLookupCombobox` into `CustFormTab.tsx` for Customer Type, Customer Group, and Price Group.
- **Customer 360° Workspace Integration:** Wire `GovernedLookupCombobox` into `Customer360DashboardView.tsx` across the Basic Details, Corporate & Tax, and Commercial Terms tabs.
- **Defect D-1 Remediation:** Eliminate unauthorized silent `PUT` fallback in `CustMasterWs.tsx:L1303-L1315` upon HTTP 409 duplicate conflict; preserve in-progress form data and display friendly guidance.
- **Defect D-2 Remediation:** Eliminate silent fallback to Reliance Retail `cust-rrl-192b561d` in `backend/app/api/v1/crm.py:L430-L450` when customer ID is missing/not found; return HTTP 404.
- **Defect D-3 Remediation:** Dynamic system record ID rendering in `Customer360DashboardView.tsx:L2191`.
- **Gap G-1 Remediation:** Implement recursive ancestor cycle detection in `backend/app/services/crm.py` for `/crm/customers/{id}/dependants`.
- **Database Schema:** Zero database migrations (Case A schema reuse). All physical tables (`customers`, `customer_groups`, `customer_relationships`, `customer_delivery_locations`, `customer_billing_locations`, `branches`, `companies`, `master_types`, `master_values`) already exist in PostgreSQL `smriti001` and `smritisys`.

## 4. Current State
- `GovernedLookupCombobox` exists in `src/components/itemMaster/GovernedLookupCombobox.tsx` but is restricted to Brand, Category, Sub-Category, Department, and Size Group.
- Customer forms (`CustFormTab.tsx` and `Customer360DashboardView.tsx`) rely on native unsearchable `<select>` dropdowns with hardcoded option arrays.
- `CustMasterWs.tsx` contains Defect D-1: when a duplicate customer is submitted (HTTP 409), it extracts `matchedId` and overwrites the existing customer via `PUT /crm/customers/{matchedId}`.
- `backend/app/api/v1/crm.py` contains Defect D-2: when a non-existent customer ID is requested, it falls back to querying `cust-rrl-192b561d` instead of raising HTTP 404.
- `Customer360DashboardView.tsx` contains Defect D-3: hardcoded `cust-rrl-192b561d` displayed on the Basic tab.
- Parent-Child relationship endpoint (`POST /crm/customers/{id}/dependants`) checks only direct equality (`customer_id == dependant_id`) without checking multi-level cyclical graphs.

## 5. Gap Analysis
| Component / Field | Existing Implementation | Proposed Governed Solution | Business Rationale |
|---|---|---|---|
| **Duplicate Prevention (D-1)** | Silently overwrites existing customer on HTTP 409 (`CustMasterWs.tsx:1307`) | Rethrow HTTP 409; highlight conflict reason; preserve in-progress form | Prevents catastrophic data corruption and accidental customer account hijacking |
| **Non-Existent 360 Fallback (D-2)** | Falls back to Reliance Retail `cust-rrl-192b561d` | Raise HTTP 404 Not Found | Prevents showing another merchant's sensitive corporate data on draft/invalid IDs |
| **System Record ID (D-3)** | Hardcoded `cust-rrl-192b561d` | Dynamic `{customer.id \|\| "Auto-generated on Save"}` | Visual accuracy and traceability |
| **Parent-Child Hierarchy (G-1)** | Checks only `parent == child` | Recursive ancestor graph traversal preventing cycles (A->B->C->A) | Prevents infinite recursion in hierarchical aggregation, PSV, and credit limits |
| **Customer Type** | Native `<select>` with hardcoded strings | `GovernedLookupCombobox` backed by `/lookup/customer_type/values` + canonical enum fallback | Enforces enterprise-approved classifications with high-velocity search |
| **Customer Group** | Native `<select>` without typeahead search | `GovernedLookupCombobox` with auto-population of Credit Terms & Days | Unifies AR credit policies directly from canonical `customer_groups` master |
| **Store Code** | Ad-hoc text input in some views | `StoreCodeLookupModal` + `/crm/store-codes/lookup` (Branch / CDL authority) | Prevents cross-customer store collisions; preserves delivery vs billing distinction |
| **Commercial Terms** | Hardcoded strings in select | `GovernedLookupCombobox` connected to `/api/v1/terms` canonical master | Guarantees compliance with approved net credit terms (`NET30`, `NET15`, etc.) |

## 6. Architecture Impact
- **Canonical Field Registry (CFOC v3.46.0):** No drift; all mapped fields exist in `CANONICAL_FIELDS` in `backend/app/governance/field_registry.py`.
- **Multi-Tenant Boundary:** Strict tenant isolation (`company_id == tenant_ctx.company_id`). No cross-tenant lookup leakage.
- **Zero Schema Migrations:** All required tables and columns already exist in PostgreSQL `smriti001` and `smritisys`.
- **FastAPI + PostgreSQL System of Record:** Sole backend transactional authority per SMRITI Backend System-of-Record Policy.

## 7. Proposed Design
1. **GovernedLookupCombobox Extension:**
   - Add optional props: `onCreateNew?: () => void`, `createActionLabel?: string`, `loading?: boolean`.
   - Render "+ Create New [Entity]" button at bottom of dropdown when `onCreateNew` is supplied.
2. **Defect D-1 Remediation in `CustMasterWs.tsx`:**
   - In `handleSave()`, delete the `existingIdMatch` regex and subsequent `PUT` execution.
   - Simply rethrow `postErr` so the UI catches it and displays: `"Duplicate Customer Conflict: A customer with this mobile, email, GSTIN, or code already exists."`
3. **Defect D-2 Remediation in `crm.py`:**
   - In `get_corporate_customer_360`, remove the `if not customer: ... fallback to cust-rrl-192b561d`.
   - Replace with: `raise HTTPException(status_code=404, detail=f"Corporate customer '{customer_id}' not found.")`.
4. **Defect D-3 Remediation in `Customer360DashboardView.tsx`:**
   - Replace hardcoded `cust-rrl-192b561d` with `{propCustomer?.id || formData.id || "Auto-generated on Save"}`.
5. **Recursive Parent-Child Cycle Prevention in `crm.py` & `crm_service.py`:**
   - Helper `async def _check_circular_relationship(session, parent_id, dependant_id)` performs depth-first traversal of `customer_relationships`. If `parent_id` is reachable from `dependant_id`, raise HTTP 400.
6. **Lookup Combobox Wiring in Customer Master & 360°:**
   - Wire `GovernedLookupCombobox` for Customer Type, Customer Group, and Commercial Terms with fallback to canonical approved options.

## 8. Files Created
1. `docs/implementation/crm/Customer_Creation_Governed_Master_Lookup_Integration_Plan_v1.0.0.md` — This plan.
2. `src/tests/customerGovernedMasterLookup.test.tsx` — Test suite for Governed Lookups, duplicate protection, and cycle prevention.
3. `docs/walkthrough/crm/Customer_Creation_Governed_Master_Lookup_Integration_v1.0.0.md` — Walkthrough upon completion.

## 9. Files Modified
1. `src/components/customer/CustMasterWs.tsx` — Fix Defect D-1 (remove silent PUT overwrite).
2. `backend/app/api/v1/crm.py` — Fix Defect D-2 (404 on missing customer) & Fix Gap G-1 (cycle prevention).
3. `src/components/itemMaster/GovernedLookupCombobox.tsx` — Add optional creation action & loading props.
4. `src/components/customer/corporate360/Customer360DashboardView.tsx` — Fix Defect D-3 & integrate GovernedLookupCombobox.
5. `src/components/customer/CustFormTab.tsx` — Integrate GovernedLookupCombobox for Customer Type and Group.
6. `docs/implementation/README.md` — Append plan to master index.

## 10. Dependencies
- FastAPI Core (`backend/app/api/v1/crm.py`, `backend/app/api/v1/master_lookup.py`).
- PostgreSQL `smriti001` and `smritisys`.
- React 18, Vite, Lucide React icons, Tailwind CSS.
- Vitest & Pytest test runners.

## 11. Risks
- **Risk 1:** Regression in Item Master dropdowns if `GovernedLookupCombobox` props break contract.
  - *Mitigation:* All new props are strictly optional with default fallbacks; existing tests (`governedLookupCombobox.test.ts`) must pass 100%.
- **Risk 2:** Existing test suites asserting fallback behavior on `get_corporate_customer_360`.
  - *Mitigation:* Run full `test_corporate_customer_360.py` and update any test mocking non-existent customer IDs to expect HTTP 404.

## 12. Rollback Strategy
- All changes are code-only on Git branch `smritiNX`.
- Zero database migrations; schema is untouched.
- Rollback via `git checkout` or `git revert` cleanly restores prior state without data loss.

## 13. Verification Plan
- [ ] TypeScript typecheck: `npx tsc --noEmit` -> 0 errors.
- [ ] Frontend test suites: `npx vitest run src/tests/customerGovernedMasterLookup.test.tsx src/tests/customer360DashboardView.test.tsx src/tests/governedLookupCombobox.test.ts`.
- [ ] Backend test suites: `pytest backend/app/tests/test_corporate_customer_360.py backend/app/tests/test_customer.py`.
- [ ] Architecture Duplication Gate: `python scripts/architecture_duplication_gate.py`.
- [ ] Field Governance Guard: `python scripts/ci_ux_field_governance_guard.py`.
- [ ] Production Build: `npm run build` -> Exit code 0.

## 14. Test Plan
- Unit tests validating `GovernedLookupCombobox` with and without `onCreateNew`.
- Integration tests verifying HTTP 409 DUPLICATE_CUSTOMER does NOT execute a PUT and preserves form state.
- Integration tests verifying HTTP 404 when querying non-existent corporate customer.
- Cycle detection tests rejecting circular parent-child relationships (A->B->A and A->B->C->A).
- Store code lookup test confirming disabled states for claimed stores.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create `docs/walkthrough/crm/Customer_Creation_Governed_Master_Lookup_Integration_v1.0.0.md`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
1. Code edits and testing on branch `smritiNX` in `F:\SMRITRretailNX`.
2. Commit on `smritiNX`.
3. Push to `origin/smritiNX`.
4. Pull into test environment `F:\Smriti9`.
5. Verify test pass in `F:\Smriti9`.

## 17. Status
Approved — Ready for Execution.

## 18. Related ADRs
- `ADR-008`: Canonical Color / Size / Master Lookup Scoping.
- `ADR-012`: Single System-of-Record (FastAPI + PostgreSQL).
- `ADR-019`: Multi-Tenant Isolation & Row-Level Locking (`with_for_update`).

## 19. Related Walkthroughs
- `docs/walkthrough/crm/Customer_360_Dashboard_Implementation_v6.99.0.md`
- `docs/walkthrough/catalog/Catalog_Item_Master_Lookup_Combobox_UX_Transformation_v6.72.7.md`
- `docs/walkthrough/master/Master_Lookup_Compliance_Audit_Exposure_v3.31.0.md`
