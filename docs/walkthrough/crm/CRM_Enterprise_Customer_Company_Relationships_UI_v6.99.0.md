<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.0
  Created      : 2026-10-19
  Modified     : 2026-10-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Enterprise Customer Master Architecture Walkthrough
-->

# Walkthrough — Enterprise Customer Company Relationships UI & Commercial Policy Governance (Model C — Phase 2)

**Document ID:** WGP-CRM-003  
**Version:** 6.99.0  
**Date:** 2026-10-19  
**Area:** CRM / Corporate Customer Master Workspace UI  
**Author:** Jawahar Ramkripal Mallah  
**Classification:** Internal — Production Engineering Walkthrough  
**Status:** Completed & Certified  

---

## 1. Purpose

This document details the frontend implementation and integration of **Tenant-Level Customer Identity with Company-Specific Commercial Relationships (Model C — Phase 2)** across the SMRITI Corporate Customer Master Workspace (`CustMasterWs.tsx`) and the Commercial Terms Panel (`CorporateCommercialTermsPanel.tsx`).

Building on the certified PostgreSQL migration `v1540` and backend REST APIs delivered in Phase 1, this phase surfaces sovereign legal-entity commercial terms—including company credit limits, payment credit days, credit-hold toggles, and commercial customer group assignments—directly into the Corporate Customer Master UI with full reactive synchronization, optimistic state handling, and SMRITI Registry Governance compliance.

---

## 2. Scope

- **Frontend Data Contracts:** Defined TypeScript interfaces `CustomerCompanyRelationship` in `src/components/customer/types.ts` supporting both canonical snake_case API payloads and camelCase property accessors.
- **Corporate Commercial Terms Panel (`CorporateCommercialTermsPanel.tsx`):**
  - Integrated Model C Legal Entity Commercial Policy section with multi-company switcher tabs/chips.
  - Provided interactive inputs with governance `data-field-key` tags (`ccr_company_id`, `ccr_customer_group`, `ccr_credit_limit`, `ccr_credit_days`, `ccr_credit_hold`).
  - Added real-time Credit Hold toggle badge: "CREDIT ON HOLD — INVOICING BLOCKED" (Rose) vs "CREDIT CLEAN — INVOICING PERMITTED" (Emerald).
  - Preserved all high-density commercial metrics (Payment Category, Payment Terms, Credit Limit, Credit Days, Current Outstanding, Credit Utilization progress bar).
  - Supported inline expansion for adding new operating entity relationships.
- **Corporate Customer Master Workspace Integration (`CustMasterWs.tsx`):**
  - Added reactive loading of company commercial relationships via `GET /api/v1/crm/customers/{id}/company-relationships`.
  - Added robust fallback to default primary operating company (`COMP-001`) for drafts and unlinked accounts.
  - Implemented `handleUpdateCompanyRelationship` to update database via `PUT /crm/customers/{customer_id}/company-relationships/{rel_id}` while immediately synchronizing primary operating entity terms into the active customer state.
  - Implemented `handleAddCompanyRelationship` to create new company commercial relationships via `POST /crm/customers/{customer_id}/company-relationships`.
- **Quality Gates & Certification:** Re-issued Preflight Certificate `PF-2026-1019-E8C032`, passed 11/11 architecture CI duplication gate checks, verified 18/18 Vitest customer workspace tests, passed 106/106 form registry components, and achieved 0 `tsc --noEmit` errors with a clean production Vite build.

---

## 3. Files Created

1. `.architecture/certificates/PF-2026-1019-E8C032.json` — Preflight Certificate for modified `CorporateCommercialTermsPanel.tsx`.
2. `docs/walkthrough/crm/CRM_Enterprise_Customer_Company_Relationships_UI_v6.99.0.md` — This official WGP walkthrough document.

---

## 4. Files Modified

1. `src/components/customer/types.ts` — Added `CustomerCompanyRelationship` interface and `companyRelationships` field to `RetailCustomerRecord`.
2. `src/components/customer/corporateWorkspace/CorporateCommercialTermsPanel.tsx` — Upgraded to surface Model C multi-company commercial parameters, credit hold toggles, and entity switcher.
3. `src/components/customer/CustMasterWs.tsx` — Wired `companyRelationships` loading, synchronization, update, and creation handlers into both overview and tabbed views.
4. `src/tests/corporateCustomerWorkspace.test.tsx` — Added unit test validating Model C multi-company commercial parameters, chips, hold badges, and data-field-key governance.
5. `docs/walkthrough/README.md` — Chronological master index updated.

---

## 5. Architecture Decisions

### AD-1: Two-Way Synchronization Between Primary Entity & Customer Record
While Model C specifies that commercial terms are authoritatively stored in `customer_company_relationships`, existing downstream billing, order entry, and ledger modules read `customer.creditLimit` and `customer.creditDays` for the primary operating company (`COMP-001`). When commercial terms are modified on the primary entity in the UI, changes automatically update both the `customer_company_relationships` record and synchronize into `customer.creditLimit` / `customer.creditDays`.

### AD-2: Zero-Latency Optimistic State with Asynchronous DB Persistence
Updates to credit limits, credit days, and credit-hold status immediately mutate the UI state to guarantee zero-latency responsiveness for data operators, followed by asynchronous REST calls to `PUT /crm/customers/{customer_id}/company-relationships/{rel_id}`. In the event of network disruption, a warning notification is raised while local form integrity is preserved.

### AD-3: Registry Governance Field Key Compliance
In accordance with SMRITI Form Registry Governance (`scripts/validate-registry-usage.mjs`), all interactive input elements within the Model C commercial panel carry explicit `data-field-key` identifiers (`ccr_company_id`, `ccr_customer_group`, `ccr_credit_limit`, `ccr_credit_days`, `ccr_credit_hold`).

---

## 6. Design Rationale

- **Compact Executive Density:** Corporate B2B customers often transact across multiple group legal entities (e.g., domestic retail, distribution, export). Rather than forcing operators to navigate disparate screens, entity relationships are presented as selectable chips with color-coded hold indicators directly within Tab 4 (Commercial Terms).
- **Fail-Closed Credit Hold Visualization:** Credit holds are a critical statutory and credit-risk control. The UI represents a credit hold using a prominent rose-colored banner with shield alert icon (`ShieldAlert`), ensuring operators immediately perceive blocked invoicing status.

---

## 7. Implementation Summary

- **Contract Extension:**
  ```typescript
  export interface CustomerCompanyRelationship {
    id: string;
    uuid?: string;
    customerId?: string;
    customer_id?: string;
    companyId?: string;
    company_id?: string;
    customerGroupId?: string | null;
    customer_group_id?: string | null;
    creditLimit?: number;
    credit_limit?: number;
    creditDays?: number;
    credit_days?: number;
    creditHold?: boolean;
    credit_hold?: boolean;
    status?: string;
    isActive?: boolean;
  }
  ```

- **Panel Capabilities:**
  - Multi-company entity selector pills (`COMP-001`, `comp-foreign-002`).
  - Read-only company ID display with relationship identifier.
  - Entity-specific Credit Limit (INR) and Credit Days stepper inputs.
  - One-click Credit Hold Toggle button (`CREDIT ON HOLD` vs `CREDIT CLEAN`).
  - Expandable form for adding additional operating legal entity commercial relationships.

---

## 8. Tests Executed

1. **Vitest Customer Test Suites:**
   ```bash
   npx vitest run src/tests/corporateCustomerWorkspace.test.tsx src/tests/customerMasterLifecycle.test.tsx
   ```
   **Output:** 18/18 tests passed across 2 test files in 897ms.

2. **Form Registry Validation:**
   ```bash
   npm run validate-registry
   ```
   **Output:** 106/106 form components verified, 0 registry violations.

3. **Launchpad Registry Validation:**
   ```bash
   npm run validate-launchpad
   ```
   **Output:** 57/57 catalog tiles verified.

4. **Architecture Duplication CI Gate:**
   ```bash
   .venv\Scripts\python.exe scripts/architecture_duplication_gate.py
   ```
   **Output:** 11/11 checks executed, 0 violations, 0 registered debt.

5. **TypeScript Compiler Verification:**
   ```bash
   npm run lint
   ```
   **Output:** `tsc --noEmit` exited with code 0 (0 errors).

6. **Production Vite Bundle Build:**
   ```bash
   npm run build
   ```
   **Output:** Built in 59.59s with 0 compilation errors.

---

## 9. Verification Results

| Verification Check | Target / Metric | Result | Status |
| :--- | :--- | :--- | :--- |
| **Vitest Tests** | 18 unit tests | 18 passed (100%) | **Done** |
| **Backend Pytest** | 4 relationship tests | 4 passed (100%) | **Done** |
| **Form Registry** | 106 components | 106 validated (100%) | **Done** |
| **Launchpad** | 57 catalog tiles | 57 validated (100%) | **Done** |
| **Architecture Gate** | 11 CI checks | 0 violations (100%) | **Done** |
| **TypeScript Lint** | `tsc --noEmit` | Exit code 0, 0 errors | **Done** |
| **Production Build** | `vite build` | Clean bundle (59.59s) | **Done** |

---

## 10. Known Limitations

- **Branch-Specific Overrides:** Phase 2 surfaces company-level commercial terms (`(customer_id, company_id)`). Optional branch-level overrides (`branch_id`) are supported in the data model and schema, but GUI controls for granular branch credit limits remain scheduled for subsequent delivery.

---

## 11. Future Work

- **Phase 3:** Integration of Customer Master Transaction Security & Eligibility (pre-flight checks before deactivation or permanent deletion across sales, invoices, and credit ledgers).
- **Phase 4:** Multi-Currency credit limits for foreign operating entities.

---

## 12. Related ADRs

- `docs/architecture/SMRITI_ENTERPRISE_CUSTOMER_DECISIONS_AND_REVISED_PLAN.md` — ADR Decision 1 (Model C Tenant-Level Sovereign Customer Identity with Company-Specific Relationships).
- `docs/architecture/ADR_CUSTOMER_CONCURRENCY_SAFETY.md` — Optimistic concurrency locking specification.

---

## 13. Related RFCs

- `RFC-CRM-001` — Sovereign Customer Entity Model & Tenant-Level Federation.
- `RFC-CRM-002` — Statutory Credit Control & Multi-Company Billing Governance.
