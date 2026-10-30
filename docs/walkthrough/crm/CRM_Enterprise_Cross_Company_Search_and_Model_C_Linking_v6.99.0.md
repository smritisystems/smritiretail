<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.0
  Created      : 2026-10-19
  Modified     : 2026-10-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Enterprise Cross-Company Search & Model C Relationship Linking Walkthrough (BD-4)
-->

# Enterprise Cross-Company Search & Model C Relationship Linking (BD-4 — Phase 3 Step 4)

## 1. Purpose
To deliver the user-facing interface and Model C commercial relationship linking capabilities for **Business Decision 4 (BD-4)** of the Enterprise Customer Architecture. The implementation enables privileged corporate users (`SYSADMIN`, `ADMIN`, `MANAGER`, `GROUP_CFO`, `CENTRAL_CREDIT_MANAGER`) to discover customer master identities across all operating legal entities within the tenant, view multi-company commercial terms, and seamlessly establish company-specific commercial relationships (`CustomerCompanyRelationship`) with custom credit limits, payment terms, and credit-hold controls, while enforcing Indian statutory compliance and cryptographic WORM audit trails.

---

## 2. Scope
- **Privileged Access Gating (BD-4)**: Strict role-based access control permitting cross-company discovery only to authorized corporate financial and administrative roles (`SYSADMIN`, `ADMIN`, `MANAGER`, `GROUP_CFO`, `CENTRAL_CREDIT_MANAGER`). Unauthorized cashier and store-level operators receive non-technical governance disclosures.
- **Enterprise Tenant Query**: Real-time debounced search querying the privileged backend endpoint `GET /api/v1/crm/enterprise/customers/search?q={query}&limit=20`.
- **Statutory Audit Disclosure**: Surface visible compliance notice that every query is recorded in `compliance_immutable_audit_logs` with SHA-256 payload verification.
- **Model C Commercial Term Inspector**: Visual chip display showing all existing commercial terms and credit limits across group legal entities.
- **Fast Model C Linking Workflow**: For discovered customers not yet active in the current operating company, an inline configuration drawer enables instant establishment of local commercial terms (credit limit, payment days, customer group, and credit-hold toggle) and persists via `POST /api/v1/crm/customers/{id}/company-relationships`.
- **Customer Master Workspace Integration**: Wired directly into `CustMasterWs.tsx` toolbar More menu under `Enterprise Group Search (BD-4)` with automatic record loading and state synchronization.

---

## 3. Files Created
1. `src/components/customer/lifecycle/EnterpriseCustomerSearchModal.tsx`: Enterprise cross-company discovery modal with debounced search, RBAC role guard, existing commercial term inspector chips, and inline Model C relationship creation workflow. Certified under Preflight Certificate `PF-2026-1019-CC252E`.

---

## 4. Files Modified
1. `src/components/customer/CustMasterWs.tsx`:
   - Wired `EnterpriseCustomerSearchModal` into toolbar More dropdown under `Enterprise Group Search (BD-4)`.
   - Added `isEnterpriseSearchOpen` state.
   - Implemented `handleEnterpriseCustomerSelected` event handler to load discovered records or append newly linked customers to local arrays with reactive state notifications.
2. `src/tests/customerMasterLifecycle.test.tsx`:
   - Added 5 dedicated Vitest test cases covering closed state, open modal DOM rendering, unauthorized role RBAC warnings, privileged role authorization, and Model C relationship detection logic.
3. `docs/walkthrough/README.md`:
   - Chronologically appended Phase 3 Step 4 Walkthrough entry into Master Index table.

---

## 5. Architecture Decisions
- **ADR-BD4-01: Sovereign Operating Boundary by Default**: Store cashiers and outlet operators are restricted to customers with an active relationship in their assigned company to prevent leaking wholesale pricing contracts, proprietary customer lists, or credit terms across legal entities.
- **ADR-BD4-02: Cryptographic WORM Audit Trails for Group Lookups**: Every enterprise query is logged into `compliance_immutable_audit_logs` with SHA-256 digest chaining, `worm_locked = True`, and 7-year statutory retention.
- **ADR-BD4-03: On-Demand Model C Commercial Relationship Creation**: Discovered group customers are not automatically copied or duplicated. Instead, a new `customer_company_relationships` row is generated linking the sovereign customer ID with the current company ID and custom commercial parameters.

---

## 6. Design Rationale
- Discovered group accounts share the single canonical customer identity (same legal person, PAN, and GSTINs) while keeping billing limits, accounts receivable, and credit exposure strictly sovereign per operating legal entity.
- Inline relationship establishment avoids requiring administrators to manually navigate across multiple settings panels, accelerating corporate onboarding and inter-company trading agreements.

---

## 7. Implementation Summary
1. **Component Design**: Authored `EnterpriseCustomerSearchModal.tsx` following the SMRITI design language (clean slate/indigo dark-mode compatible palettes, rounded-xl borders, Lucide iconography, accessible focus states).
2. **Preflight Certification**: Issued certificate `PF-2026-1019-CC252E` verifying file path, content hash, canonical owner, and capability mapping (`customer.crud`).
3. **Workspace Integration**: Wired into `CustMasterWs.tsx` More menu and mounted dialog before closing JSX.
4. **Automated Testing**: Authored 5 new Vitest unit tests in `customerMasterLifecycle.test.tsx` (bringing lifecycle suite to 20/20 passed, 29/29 across frontend customer test suites).
5. **Quality Gates Passed**: 24/24 backend Pytest tests passed, 11/11 architecture CI duplication gate checks passed, and `npm run lint` (`tsc --noEmit`) completed with 0 errors.

---

## 8. Tests Executed
```bash
# 1. Frontend Customer Lifecycle & Workspace Vitest Suites
npm test -- src/tests/customerMasterLifecycle.test.tsx src/tests/corporateCustomerWorkspace.test.tsx --run

# 2. Combined CRM Backend Test Suites
.venv\Scripts\pytest backend/tests/test_customer_company_relationships.py \
                         backend/tests/test_customer_lifecycle_security.py \
                         backend/tests/test_customer_multicompany_repository.py \
                         backend/tests/test_customer_merge_bd2.py -v

# 3. Architecture CI Duplication Gate
.venv\Scripts\python.exe scripts/architecture_duplication_gate.py

# 4. TypeScript Typecheck
npm run lint
```

---

## 9. Verification Results

### Frontend Vitest Output:
```text
> smriti-retail-os@6.99.0 test
> vitest run src/tests/customerMasterLifecycle.test.tsx src/tests/corporateCustomerWorkspace.test.tsx --run

 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/customerMasterLifecycle.test.tsx (20 tests) 69ms
 ✓ src/tests/corporateCustomerWorkspace.test.tsx (9 tests) 82ms

 Test Files  2 passed (2)
      Tests  29 passed (29)
   Start at  20:35:46
   Duration  950ms (transform 564ms, setup 0ms, import 949ms, tests 151ms, environment 0ms)
```

### Backend CRM Pytest Output:
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 24 items

backend\tests\test_customer_company_relationships.py::test_customer_company_relationship_schema_validation PASSED [  4%]
backend\tests\test_customer_company_relationships.py::test_customer_company_relationship_model_structure PASSED [  8%]
backend\tests\test_customer_company_relationships.py::test_cross_company_customer_group_guard PASSED [ 12%]
backend\tests\test_customer_company_relationships.py::test_matching_company_customer_group_passes_guard PASSED [ 16%]
backend\tests\test_customer_lifecycle_security.py::test_customer_delete_eligibility_schema_serialization PASSED [ 20%]
backend\tests\test_customer_lifecycle_security.py::test_customer_deactivate_request_schema PASSED [ 25%]
backend\tests\test_customer_lifecycle_security.py::test_check_delete_eligibility_blocks_on_invoices_and_balance PASSED [ 29%]
backend\tests\test_customer_lifecycle_security.py::test_check_delete_eligibility_permits_clean_customer PASSED [ 33%]
backend\tests\test_customer_lifecycle_security.py::test_permanent_delete_raises_400_when_blocked PASSED [ 37%]
backend\tests\test_customer_lifecycle_security.py::test_permanent_delete_executes_when_clean PASSED [ 41%]
backend\tests\test_customer_lifecycle_security.py::test_deactivate_and_reactivate_customer_lifecycle PASSED [ 45%]
backend\tests\test_customer_multicompany_repository.py::test_customer_response_serialization_with_company_relationships PASSED [ 50%]
backend\tests\test_customer_multicompany_repository.py::test_customer_repository_model_c_tenant_filter_generation PASSED [ 54%]
backend\tests\test_customer_multicompany_repository.py::test_require_cross_company_customer_access_sysadmin_allowed PASSED [ 58%]
backend\tests\test_customer_multicompany_repository.py::test_require_cross_company_customer_access_admin_allowed PASSED [ 62%]
backend\tests\test_customer_multicompany_repository.py::test_require_cross_company_customer_access_unauthorized_rejected PASSED [ 66%]
backend\tests\test_customer_multicompany_repository.py::test_enterprise_search_customers_audit_logging PASSED [ 70%]
backend\tests\test_customer_merge_bd2.py::test_customer_merge_schema_serialization PASSED [ 75%]
backend\tests\test_customer_merge_bd2.py::test_merge_customer_self_merge_rejection PASSED [ 79%]
backend\tests\test_customer_merge_bd2.py::test_merge_customer_target_or_source_not_found PASSED [ 83%]
backend\tests\test_customer_merge_bd2.py::test_merge_customer_source_already_merged_rejection PASSED [ 87%]
backend\tests\test_customer_merge_bd2.py::test_merge_customer_pan_parity_guard_violation PASSED [ 91%]
backend\tests\test_customer_merge_bd2.py::test_merge_customer_full_consolidation_and_reassignment PASSED [ 95%]
backend\tests\test_customer_merge_bd2.py::test_rest_api_merge_customers_endpoint PASSED [100%]

====================== 24 passed, 18 warnings in 15.87s =======================
```

### Architecture CI Duplication Gate:
```text
================================================================================
 SMRITI ARCHITECTURE GOVERNANCE — CI / PRE-COMMIT GATE (HARDENED)
================================================================================
 Checks Executed:    11
 P0/P1 Violations:   0
 Registered Debt:    0
--------------------------------------------------------------------------------

================================================================================
 CI GATE STATUS: PASSED — Zero unapproved canonical duplications detected.
================================================================================
```

### TypeScript Verification:
```text
> smriti-retail-os@6.99.0 lint
> tsc --noEmit

Process completed with exit code 0 (0 errors).
```

---

## 10. Known Limitations
- Model C linking requires the target customer group (`customer_group_id`) to be pre-configured for the operating legal entity to satisfy the cross-company customer group guard.

---

## 11. Future Work
- Add keyboard shortcut (e.g. `Ctrl+Alt+F`) in Customer Master workspace for direct activation of Enterprise Search.
- Visual badge indicator on customer search input showing whether query is company-scoped or enterprise-wide.

---

## 12. Related ADRs
- `ADR-038`: Model C Customer Commercial Isolation & Shared Identity.
- `ADR-041`: Multi-Company Ledger and Financial Consolidation.
- `ADR-BD4-01`: Sovereign Operating Boundary by Default.

---

## 13. Related RFCs
- `RFC-CRM-001`: Tenant-Wide Customer Identity with Company-Specific Commercial Terms.
- `RFC-CRM-004`: Privileged Cross-Company Customer Search & Discovery (BD-4).
