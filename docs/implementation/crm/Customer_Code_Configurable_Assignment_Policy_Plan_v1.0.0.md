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
-->

# Implementation Plan: Customer Code Configurable Assignment Policy (Hybrid Mode)

**Document ID:** PLAN-CRM-CUST-CODE-001  
**Area:** CRM / Customer Master / Identity Governance  
**Author:** Jawahar Ramkripal Mallah  
**Status:** Approved  
**Lifecycle:** In Progress  

---

## 1. Objective

Implement a governed, configurable Customer Code assignment policy that allows SMRITI Retail OS administrators to control how Customer Codes are selected, recommended, generated, and assigned during customer creation. 

The policy introduces a **Hybrid Mode** that:
1. Recommends the next sequential valid Customer Code (`CUST-{seq:06d}`).
2. Enables selection of existing eligible, unassigned customer codes where available.
3. Restricts manual code entry to authorized operators (`SYSADMIN`, `ADMIN`, `MANAGER`).
4. Enforces strict uniqueness within the authoritative `COMPANY` scope backed by physical database index `uq_customers_company_code_active`.
5. Preserves all existing historical customer identifiers without renumbering.

---

## 2. Business Motivation

In modern retail and corporate B2B environments, businesses require flexible customer code assignment:
- **High-Velocity Counter POS:** Requires 100% automated, zero-friction, collision-free code assignment without cashier intervention.
- **Enterprise B2B / Key Accounts:** Finance and operations teams often need to align customer codes with statutory ERPs (e.g. `REL001`, `TATA-MUM-01`) or legacy contract accounts.
- **Data Integrity:** Ordinary cashiers must not invent arbitrary free-text codes or collide with existing accounts. When collisions occur, operator input must never be lost or silently overwritten.

---

## 3. Scope

### In Scope
- **Backend API & Service Layer (`backend/app/api/v1/crm.py`, `backend/app/services/crm.py`):**
  - Read-only preview & recommendation endpoint: `GET /api/v1/crm/customer-codes/recommendation`.
  - Customer code validation endpoint: `POST /api/v1/crm/customer-codes/validate`.
  - Eligible unassigned customer code discovery: `GET /api/v1/crm/customer-codes/eligible-pool`.
  - Hardened customer creation logic with role-gated manual entry and atomic sequential allocation.
  - Concurrency collision handling returning HTTP 409 `CUSTOMER_CODE_COLLISION` with immediate retry candidates.
- **Configuration Layer (`SystemParameterService`):**
  - Resolving customer code policy parameters (`SMRITI.CUSTOMER.CODE_ASSIGNMENT_MODE`, `SMRITI.CUSTOMER.MANUAL_CODE_ALLOWED`, `SMRITI.CUSTOMER.CODE_PREFIX`).
- **Frontend Workspace & Forms (`CustFormTab.tsx`, `Customer360DashboardView.tsx`, `CreateCustomerModal.tsx`):**
  - Governed Customer Code selector supporting recommendation badge, manual entry toggle for authorized users, and existing code selection.
- **Zero Schema Migrations:**
  - Case A full schema reuse of `customers`, `system_parameters`, `smriti_numbering_registry`, and `uq_customers_company_code_active`.

### Out of Scope
- Global customer renumbering or retroactive modification of historical customer codes.
- Altering the tenant-wide `identity_code` (Layer D) engine.

---

## 4. Current State

1. **`CreateCustomerModal.tsx`:** Omitted `code` from payload, blindly relying on server fallback.
2. **`CustFormTab.tsx`:** Rendered Customer Code as `readOnly` displaying `"Generating..."`.
3. **`Customer360DashboardView.tsx`:** Rendered Customer Code as an unvalidated open text input.
4. **`backend/app/services/crm.py`:** Line 476 generated `CUST-{id[:8].upper()}` (hash-based pseudo-random string). If a client sent a manual code, it was saved without role verification.
5. **Database Constraint:** `uq_customers_company_code_active` index on `(company_id, code)` already enforces uniqueness per company, but errors resulted in generic 409 exceptions.

---

## 5. Gap Analysis

| Requirement | Current Implementation | Target Implementation |
| :--- | :--- | :--- |
| **Assignment Mode** | Ad-hoc (hash slice or raw client string) | Configurable `HYBRID` mode |
| **Code Recommendation** | None (computed only on persist) | `GET /crm/customer-codes/recommendation` non-mutating preview |
| **Manual Code Entry** | Unchecked in backend API | Restricted to `AUTHORIZED_USERS_ONLY` (`SYSADMIN`, `ADMIN`, `MANAGER`) |
| **Existing Code Selection** | None | Searchable combobox for eligible inactive/unassigned codes |
| **Collision Recovery** | Generic HTTP 409 | HTTP 409 with structured payload & fresh candidate suggestion |
| **Form UX** | Disparate across 3 components | Unified governed selector with suggestion pills and permission badges |

---

## 6. Architecture Impact

- **Identity Layer Alignment:**
  - Layer A: `Customer.id` (UUIDv7 technical key).
  - Layer D: `Customer.identity_code` (Tenant-wide sequential code, e.g. `CRM-CUS-00000868`).
  - Business Layer: `Customer.code` (Company-scoped human code, e.g. `CUST-000101` or approved manual code).
- **Security & Authorization:**
  - Enforced via JWT claims and `TenantContext`. Client company tampering is rejected with HTTP 403.
  - Manual code submission by unauthorized roles returns HTTP 403 `MANUAL_CUSTOMER_CODE_UNAUTHORIZED`.

---

## 7. Proposed Design

### A. Customer Code Policy Contract
```typescript
interface CustomerCodePolicy {
  assignmentMode: "HYBRID" | "AUTO_ONLY" | "MANUAL_ONLY";
  uniquenessScope: "COMPANY";
  manualEntryAllowed: boolean; // based on user role + system parameter
  codePrefix: string;          // default "CUST-"
  padding: number;             // default 6 digits
  suggestedNextCode: string;   // e.g. "CUST-000101"
}
```

### B. Numbering Resolution
1. Query highest existing sequential numeric code for `company_id` matching prefix pattern (e.g. `^CUST-(\d+)$`).
2. Candidate `next_seq = max(existing_seq, registry_seq) + 1`.
3. Format candidate: `f"{prefix}{next_seq:06d}"`.
4. Check candidate against `customers` table in `company_id`. If taken, advance until unique.

---

## 8. Files Created

1. `docs/implementation/crm/Customer_Code_Configurable_Assignment_Policy_Plan_v1.0.0.md`: This 19-section implementation plan.
2. `src/tests/customerCodeAssignmentPolicy.test.tsx`: Automated Vitest test suite for Customer Code policy, recommendation, and manual entry governance.
3. `backend/app/tests/test_customer_code_policy.py`: Pytest unit test suite covering DTOs, policy algorithms, role gating, and inactive pools.
4. `backend/app/tests/test_customer_code_policy_db.py`: Real PostgreSQL database-backed integration and concurrency test suite (8/8 passed).

---

## 9. Files Modified

1. `backend/app/services/crm.py`: Added sequential code allocation, recommendation preview, manual entry role checks, and structured collision handling.
2. `backend/app/api/v1/crm.py`: Added `/customer-codes/recommendation`, `/customer-codes/validate`, and `/customer-codes/eligible-pool` endpoints.
3. `src/components/customer/CustFormTab.tsx`: Integrated governed Customer Code selector with suggestion pill and manual entry toggle.
4. `src/components/customer/corporate360/Customer360DashboardView.tsx`: Integrated governed Customer Code selector with suggestion pill and manual entry toggle.
5. `src/components/customer/lifecycle/CreateCustomerModal.tsx`: Added Customer Code selector supporting recommended code and manual entry.
6. `docs/implementation/README.md`: Appended plan to master index.

---

## 10. Dependencies

- `backend/app/models/crm.py`: `Customer` model and `uq_customers_company_code_active`.
- `backend/app/services/system_parameter.py`: Policy configuration resolution.
- `backend/app/api/deps.py`: `TenantContext`, `get_current_user`, `require_role`.
- `src/components/itemMaster/GovernedLookupCombobox.tsx`: UI combobox with typeahead.

---

## 11. Risks

- **Race Condition on Submission:** Two users submitting the same code simultaneously.
  *Mitigation:* Database partial unique index `uq_customers_company_code_active` acts as the final gate. Service catches `IntegrityError`, rolls back, and returns HTTP 409 with a fresh code recommendation.
- **Form State Destruction:** Accidental clearing of form fields on collision.
  *Mitigation:* Frontend retains all state and notifies user with actionable error banner.

---

## 12. Rollback Strategy

- All code changes are application-level. No database DDL or migrations are performed.
- Rollback can be performed via git revert of the affected commits without database schema impact.

---

## 13. Verification Plan

1. Verify TypeScript types: `npx tsc --noEmit` (0 errors).
2. Verify frontend unit & integration tests: `npx vitest run src/tests/customerCodeAssignmentPolicy.test.tsx`.
3. Verify backend integration tests: Pytest customer tests.
4. Verify architecture gate: `python scripts/architecture_duplication_gate.py`.
5. Verify field governance guard: `python scripts/ci_ux_field_governance_guard.py`.
6. Verify production build: `npm run build`.

---

## 14. Test Plan

- Test 1: Next code recommendation preview returns valid sequential code (`CUST-000101`).
- Test 2: Cashier submitting manual custom code is rejected with HTTP 403.
- Test 3: Manager submitting manual custom code is accepted.
- Test 4: Duplicate code submission in same company returns HTTP 409 with reason.
- Test 5: Duplicate code submission across different companies is allowed per `COMPANY` scope.
- Test 6: In-progress form inputs are preserved after duplicate conflict.
- Test 7: Missing company context is rejected with HTTP 400 Bad Request.
- Test 8: Policy values dynamically read from authoritative `SystemParameter` configuration.
- Test 9: 20 concurrent requests under uninitialized registry atomically allocate 20 consecutive unique codes without duplicates.
- Test 10: Inactive/deleted customer codes are excluded from auto-generation, and explicit reuse records `SmritiAuditLog` audit entry.

---

## 15. Documentation Impact

- Walkthrough: `docs/walkthrough/crm/Customer_Code_Configurable_Assignment_Policy_v1.0.0.md`.
- Master Indexes: `docs/implementation/README.md`, `docs/walkthrough/README.md`.

---

## 16. Deployment Plan

1. Merge into `smritiNX` after full test pass.
2. Per environment rules, sync to `F:\Smriti9` test environment exclusively via `git pull`.

---

## 17. Status

- **Plan Status:** Approved
- **Lifecycle:** Completed

---

## 18. Related ADRs

- `ADR-CRM-2026-1020-01`: Zero-Migration Schema Reuse for Governed Master Values.
- `ADR-CRM-2026-1020-02`: Prohibition of Implicit Overwrite on Duplicate Conflict.
- `ADR-CRM-2026-1020-04`: Hybrid Customer Code Assignment & Company Uniqueness Scope.

---

## 19. Related Walkthroughs

- `docs/walkthrough/crm/Customer_Code_Configurable_Assignment_Policy_v1.0.0.md`.
- `docs/walkthrough/crm/Customer_Creation_Governed_Master_Lookup_Integration_v1.0.0.md`.
