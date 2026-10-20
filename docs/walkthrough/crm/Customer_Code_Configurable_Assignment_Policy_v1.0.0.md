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

# Walkthrough: SMRITI Retail OS — Customer Code Configurable Assignment Policy (Hybrid Mode)

**Document ID:** `WGP-CRM-2026-1020-02`  
**Topic Area:** CRM / Customer Master / Customer Code Governance  
**Target Version:** `v1.0.0`  
**Author:** Jawahar Ramkripal Mallah  
**Classification:** Internal Commercial  

---

## 1. Purpose

This walkthrough documents the design, implementation, and verification of the **Configurable Customer Code Assignment Policy** in **Hybrid Mode** for SMRITI Retail OS.

The policy empowers retail and enterprise tenant administrators to govern how Customer Codes are assigned, recommended, generated, and validated during customer account onboarding without weakening identity integrity or tenancy boundaries.

Key capabilities introduced:
- Non-mutating Customer Code candidate recommendation preview (`GET /crm/customers/code-recommendation`).
- Pure sequential atomic allocation under row-locks via `SmritiNumberingRegistry` (`CUST-{seq:06d}`).
- Company-scoped uniqueness enforcement using physical PostgreSQL partial unique index `uq_customers_company_code_active`.
- Role-based authorization gating restricting manual custom code entries strictly to `SYSADMIN`, `ADMIN`, and `MANAGER`, while permitting `CASHIER` to seamlessly allocate system-recommended sequences.
- Hybrid support for selecting eligible unassigned/inactive codes from historical records.
- Concurrency collision recovery returning structured HTTP 409 responses with fresh candidate codes while preserving 100% of the user's entered form data.

---

## 2. Scope

- **In Scope:**
  - Backend schema models in `backend/app/schemas/crm.py`: `CustomerCodeRecommendationResponse`, `CustomerCodeValidationRequest`, `CustomerCodeValidationResponse`, and `EligibleCustomerCodeItem`.
  - Backend service methods in `backend/app/services/crm.py`: `preview_next_customer_code`, `allocate_next_customer_code`, `get_customer_code_recommendation`, `validate_customer_code`, `get_eligible_customer_code_pool`, and role-gated `create_customer`.
  - REST endpoints in `backend/app/api/v1/crm.py`: `GET /customers/code-recommendation`, `POST /customers/validate-code`, and `GET /customers/eligible-codes`.
  - Frontend customer creation modal `src/components/customer/lifecycle/CreateCustomerModal.tsx`: Hybrid mode tabs (`Auto-Suggested`, `Custom Code`, `Eligible Inactive`), live validation feedback, and collision state preservation.
  - Frontend customer form `src/components/customer/CustFormTab.tsx`: Governed Customer Code display with Company Scope sequential indicator.
  - Automated test suites: Vitest (`src/tests/customerCodeAssignmentPolicy.test.tsx`) and Pytest (`backend/app/tests/test_customer_code_policy.py`).
- **Out of Scope:**
  - Altering canonical internal UUIDv7 technical keys (`Customer.id`).
  - Altering universal tenant-wide identity codes (`Customer.identity_code`).
  - Database schema alterations or DDL migrations (Zero-migration Case A schema reuse).

---

## 3. Files Created

1. `backend/app/tests/test_customer_code_policy.py`: Automated Pytest unit test suite verifying DTO validation, sequential calculation algorithms, role permission rules, and inactive code pool filtering.
2. `backend/app/tests/test_customer_code_policy_db.py`: Comprehensive real-PostgreSQL database-backed integration and concurrency acceptance test suite (8 tests) covering missing company context rejection, authoritative parameter resolution, role-gated assignment, format/uniqueness validation, read-only preview invariance, 20-worker concurrent first-time registry initialization, cross-company isolation, and historical code exclusion with `SmritiAuditLog` auditing.
3. `src/tests/customerCodeAssignmentPolicy.test.tsx`: Automated Vitest test suite verifying modal UI controls, input field keys, assignment mode toggles, and collision error recovery.
4. `docs/implementation/crm/Customer_Code_Configurable_Assignment_Policy_Plan_v1.0.0.md`: 19-section formal Implementation Plan adhering to IPGP.
5. `docs/walkthrough/crm/Customer_Code_Configurable_Assignment_Policy_v1.0.0.md`: This 13-section formal walkthrough document adhering to WGP.

---

## 4. Files Modified

1. `backend/app/schemas/crm.py`: Added 4 DTO models (`CustomerCodeRecommendationResponse`, `CustomerCodeValidationRequest`, `CustomerCodeValidationResponse`, `EligibleCustomerCodeItem`).
2. `backend/app/services/crm.py`: Enforced fail-closed tenant validation (`_require_company_id()`), authoritative `SystemParameter` configuration resolution (`_resolve_code_policy_config()`), race-safe numbering registry initialization under nested savepoint isolation (`begin_nested()`), sequential code preview, row-locked counter allocation excluding historical records, recommendation provider, code validation logic, eligible inactive pool discovery, and role-gated customer creation with structured 409 collision handling and `SmritiAuditLog` auditing.
3. `backend/app/api/v1/crm.py`: Mounted `/customers/code-recommendation`, `/customers/validate-code`, and `/customers/eligible-codes` routes; updated `create_customer` to pass authenticated user context.
4. `src/components/customer/lifecycle/CreateCustomerModal.tsx`: Added Customer Code assignment UI supporting Auto-Suggested, Custom Code, and Eligible Inactive modes with real-time validation and form-preserving collision recovery.
5. `src/components/customer/CustFormTab.tsx`: Integrated dynamic recommended code preview and sequential company scope badges.
6. `docs/implementation/README.md`: Appended plan entry to master index.
7. `docs/walkthrough/README.md`: Appended walkthrough entry to master index.

---

## 5. Architecture Decisions

- **ADR-CRM-2026-1020-04 (Hybrid Customer Code Assignment & Company Uniqueness Scope):**  
  The system adopts `HYBRID` assignment with `COMPANY` uniqueness scope. Physical uniqueness is enforced by the existing PostgreSQL partial unique index `uq_customers_company_code_active` on `(company_id, code)` where `code IS NOT NULL AND status = 'Active' AND is_deleted = false`.
- **ADR-CRM-2026-1020-05 (Separation of Customer Code from Universal Identity Code):**  
  Maintains clean separation between Layer D universal identity (`Customer.identity_code`, e.g., `CRM-CUS-00000868`) managed by `IdentityEngine`, and the human-facing company business code (`Customer.code`, e.g., `CUST-000101` or alphanumeric custom codes).
- **ADR-CRM-2026-1020-06 (Role-Gated Manual Custom Code Entry):**  
  Cashiers are restricted from arbitrary manual code entry to prevent code pollution and fragmentation. Only Managers and Administrators may provide custom codes. Cashiers receive seamless automatic allocation.

---

## 6. Design Rationale

1. **Elimination of Hash-Based Fallbacks:**  
   Previously, line 476 of `backend/app/services/crm.py` generated `CUST-{id[:8].upper()}` (e.g. `CUST-5CB207`). This produced non-sequential, confusing codes. The new design computes clean sequential numbers (`CUST-000101`, `CUST-000102`).
2. **Atomic Row-Locking Under Concurrency:**  
   Sequential counters in `SmritiNumberingRegistry` are locked using `SELECT ... FOR UPDATE` within the same transaction that creates the customer. If historical records exceed the registry counter, the engine dynamically advances past existing numbers to prevent race conditions.
3. **Preserving User Form State on Conflict:**  
   If a concurrency conflict or collision occurs (HTTP 409), user input across name, contact, corporate tax, and billing details is never destroyed. The modal surfaces the conflict, fetches a fresh recommendation, and allows instant retry.

---

## 7. Implementation Summary

### Backend Implementation
- `_require_company_id`: Guarantees fail-closed isolation. All customer operations strictly require a valid company context; implicit fallback (such as `COMP-001`) has been completely eradicated.
- `_resolve_code_policy_config`: Authoritatively resolves company-level `SystemParameter` configurations (`SMRITI.CUSTOMER.CODE_ASSIGNMENT_MODE`, `SMRITI.CUSTOMER.CODE_PREFIX`, `SMRITI.CUSTOMER.CODE_MANUAL_ROLES`, `SMRITI.CUSTOMER.IS_CUST_CODE_ASSIGNED`).
- `preview_next_customer_code`: Non-mutating read-only preview. Scans existing company records (active, inactive, and deleted) and numbering registry counters, returning `CUST-{next_seq:06d}` without altering the database.
- `allocate_next_customer_code`: Row-locked atomic sequence advancement using `SELECT FOR UPDATE` on `SmritiNumberingRegistry`. Handles first-time initialization race conditions via nested savepoint isolation (`async with self.db.begin_nested():`), preventing duplicate registry row creation under concurrent load. Excludes all historical codes from generation.
- `create_customer`: Integrates `IdentityEngine` strictly with verified `company_id`. Enforces role permissions for manual entry, maps customer code duplicates to structured HTTP 409 `CUSTOMER_CODE_COLLISION` responses with fresh recommendations, and creates audit records (`SmritiAuditLog`) with `change_type="HISTORICAL_CODE_REUSE"` when historical codes are intentionally reclaimed.
- `validate_customer_code`: Enforces uppercase alphanumeric normalized regex (`^[A-Z0-9_\-\.]+$`), length (2-50 chars), role authorization, and company-scoped uniqueness.

### Frontend Implementation
- In `CreateCustomerModal.tsx`, Step 2 features the Governed Customer Code selector with three mode tabs:
  - `Auto-Suggested`: Displays recommended code with Sequential Company Scope badge and refresh icon. Leaves `payload.code` omitted so the backend atomically allocates under row locks upon submission.
  - `Custom Code`: Enabled for Managers/Admins with live blur validation via `/crm/customers/validate-code`. Shows lock indicator and guidance if unauthorized.
  - `Eligible Inactive`: Discovers and reclaims unassigned/archived codes within the company.
- Preserves all entered form inputs on collision and updates the recommendation banner.

---

## 8. Tests Executed

1. **Database-Backed Integration & Concurrency Acceptance Suite (`backend/app/tests/test_customer_code_policy_db.py`):**
   - `test_missing_company_context_rejected`: Proves missing or empty company context is rejected with HTTP 400 Bad Request.
   - `test_policy_values_read_from_authoritative_system_parameters`: Proves dynamic policy resolution for prefix, assignment mode, and manual roles from `SystemParameter`.
   - `test_authorized_and_unauthorized_manual_assignment_enforced`: Proves unauthorized Cashier manual codes are rejected with HTTP 403 while Admin/Manager succeed.
   - `test_invalid_formats_and_normalized_duplicates_rejected`: Proves character validation, length bounds, normalized collision detection, and HTTP 409 responses.
   - `test_preview_does_not_mutate_numbering_registry`: Proves preview endpoint remains strictly read-only and sequence numbers are not burned.
   - `test_database_backed_concurrency_and_first_time_initialization`: Proves 20 concurrent async customer creations against an uninitialized company safely create exactly 1 registry record and allocate 20 consecutive, unique codes without collisions or rollbacks.
   - `test_cross_company_isolation`: Proves identical customer codes can exist across separate companies without conflict or cross-company leakage.
   - `test_inactive_historical_codes_not_silently_reused_and_audit_trail`: Proves inactive codes are excluded from automated generation, and manual reuse generates a verifiable `SmritiAuditLog` audit entry.
2. **Vitest Frontend Test Suite (`src/tests/customerCodeAssignmentPolicy.test.tsx`):**
   - Renders `CreateCustomerModal` with Customer Code Assignment controls and field keys.
   - Renders `CustFormTab` with existing assigned customer code and company scope badge.
   - Renders `CustFormTab` with unassigned customer displaying `Hybrid Policy • Auto-Recommended`.
   - Verifies collision recovery state preservation payload structure.
3. **Vitest Regression Test Suites:**
   - `src/tests/customerGovernedMasterLookup.test.tsx`: 7/7 passed.
   - `src/tests/customerMasterLifecycle.test.tsx`: 25/25 passed.
4. **Pytest Backend Unit Test Suite (`backend/app/tests/test_customer_code_policy.py`):**
   - 6/6 unit tests passed covering DTO serialization, role checks, algorithm edge cases, and inactive pool filtering.
5. **Pytest Regression Test Suite (`backend/app/tests/test_customer.py`):**
   - 6/6 tests passed.

---

## 9. Verification Results

| Verification Check | Target / Command | Result | Evidence |
| :--- | :--- | :--- | :--- |
| **Python Syntax & Compile** | `python -m py_compile` | **PASS** | Exit code 0 across modified services and routes |
| **Database-Backed Acceptance** | `pytest test_customer_code_policy_db.py` | **PASS** | 8/8 tests passed (100% green, 77.38s) |
| **Backend Unit Tests** | `pytest test_customer_code_policy.py` | **PASS** | 6/6 tests passed |
| **Backend Regression Tests** | `pytest test_customer.py` | **PASS** | 6/6 tests passed |
| **Frontend Unit Tests** | `vitest run customerCodeAssignmentPolicy.test.tsx` | **PASS** | 4/4 tests passed |
| **Frontend Master Lookup Tests**| `vitest run customerGovernedMasterLookup.test.tsx` | **PASS** | 7/7 tests passed |
| **Frontend Lifecycle Tests** | `vitest run customerMasterLifecycle.test.tsx` | **PASS** | 25/25 tests passed |
| **TypeScript Compilation** | `npx tsc --noEmit` | **PASS** | Exit code 0 (0 errors) |
| **Architecture Gate** | `python scripts/architecture_duplication_gate.py` | **PASS** | 11 checks executed, 0 violations |
| **Field Governance Guard** | `python scripts/ci_ux_field_governance_guard.py` | **PASS** | 0 critical violations, 0 drift |
| **Production Build** | `npm run build` | **PASS** | Exit code 0 (`built in 50.15s`) |

---

## 10. Known Limitations

- In the current release, the prefix format defaults to `"CUST-"` with 6-digit numeric padding (`{prefix}{seq:06d}`). Dynamic custom prefix patterns per customer category (e.g., `CORP-`, `RET-`) can be configured via `SystemParameter` in subsequent iterations.
- Inactive code reclamation is restricted to customers whose status is `Archived` or whose record is marked `is_deleted = true`.

---

## 11. Future Work

- Surface company-level prefix customization controls in `CompanyProfileStudio.tsx`.
- Support configurable customer series ranges per branch / outlet for distributed point-of-sale resilience.

---

## 12. Related ADRs

- `ADR-CRM-2026-1020-01`: Zero-Migration Schema Reuse for Governed Master Values.
- `ADR-CRM-2026-1020-02`: Prohibition of Implicit Overwrite on Duplicate Conflict.
- `ADR-CRM-2026-1020-04`: Hybrid Customer Code Assignment & Company Uniqueness Scope.
- `ADR-CRM-2026-1020-05`: Separation of Customer Code from Universal Identity Code.
- `ADR-CRM-2026-1020-06`: Role-Gated Manual Custom Code Entry.

---

## 13. Related RFCs

- `RFC-CRM-2026-0918-01`: SMRITI Unified Identity Control Plane & Numbering Registry.
- `RFC-CRM-2026-1019-01`: Enterprise Corporate Customer Master Architecture & Lifecycle Security.
