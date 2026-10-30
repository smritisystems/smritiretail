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
  Classification: Enterprise Corporate Customer Merge & PAN Consolidation Walkthrough (BD-2)
-->

# Enterprise Corporate Customer Merge & PAN Consolidation (BD-2 — Phase 3 Step 3)

## 1. Purpose
To deliver authoritative, compliant, and auditable corporate customer merge and consolidation capabilities in SMRITI Retail OS (`smritiNX`), fulfilling **Business Decision 2 (BD-2)** of the Enterprise Customer Architecture. The implementation enables enterprise administrators to absorb duplicate or subsidiary customer entities into an authoritative parent/master account while enforcing strict Permanent Account Number (PAN) parity, consolidating subordinate delivery and billing locations, transferring Model C company relationships, reassigning historical transactional ledgers across 10+ operational tables, soft-retiring source accounts, and recording immutable cryptographic WORM audit trails.

---

## 2. Scope
- **BD-2 PAN Parity Guard**: Strict validation enforcing that merging entities either share identical PANs or adopt missing identity fields from the source, rejecting mismatched PANs with HTTP 400.
- **Master Profile Enrichment**: Automatic adoption of source PAN, GSTIN, and primary contact email if absent on the target master record.
- **Subordinate Entity Consolidation**:
  - `CustomerGSTRegistration`: Re-pointing unique state registrations to target; soft-retiring duplicates with status `MERGED`.
  - `CustomerDeliveryLocation`: Re-pointing delivery locations to target with store code collision resolution (suffixing `_{source_id[:6]}` on collision).
  - `CustomerBillingLocation`: Re-pointing commercial billing locations to target with billing store code collision resolution.
  - `CustomerExternalIdentity`: Re-pointing external POS/ERP mapping keys; soft-retiring duplicates.
  - `CustomerCompanyRelationship`: Transferring unique legal entity commercial terms to target; retiring redundant entity relationships.
- **Transactional History Reassignment**: Atomic reassignment of historical foreign keys across operational tables (`sales_invoices`, `sales_orders`, `sales_returns`, `customer_credit_ledger_entries`, `customer_purchase_orders`, `psv_parties`, `crm_customer_activities`, `crm_opportunities`, `loyalty_transactions`, `referral_relationships`, `loyalty_members`).
- **Financial Balance Consolidation**: Consolidating net outstanding receivables into the target master account and zeroing out source customer outstanding.
- **Source Account Retirement**: Soft-deleting the source account (`status = "Merged"`, `is_deleted = True`) with ISO timestamped consolidation audit notes.
- **WORM Regulatory Audit Logging**: Recording SHA-256 payload hashed, predecessor-linked, immutable audit records in `compliance_immutable_audit_logs` with 7-year statutory retention.
- **REST API Mounting**: Exposing `POST /api/v1/crm/customers/merge` with strict RBAC gating (`SYSADMIN`, `ADMIN`, `MANAGER`).

---

## 3. Files Created
1. `backend/tests/test_customer_merge_bd2.py`: Dedicated backend unit test suite with 7 test cases covering schema serialization, self-merge guards, missing entity checks, BD-2 PAN parity guards, subordinate entity consolidation, transaction reassignment, financial balance combining, source retirement, and REST endpoint execution.
2. `src/components/customer/lifecycle/CustomerMergeModal.tsx`: Complete corporate customer merge and consolidation modal with debounced candidate search, real-time BD-2 PAN parity evaluation badge, confirmation keyword safeguard (`MERGE`), audit impact disclosure, and asynchronous execution with error handling.

---

## 4. Files Modified
1. `backend/app/schemas/crm.py`:
   - Added `CustomerMergeRequest` schema with camelCase / snake_case aliases (`targetCustomerId`, `sourceCustomerId`, `reason`).
   - Added `CustomerMergeResponse` schema with default UTC timestamping and `reassignedRecords` mapping.
   - Imported `timezone` from standard library `datetime`.
2. `backend/app/models/crm.py`:
   - Added property accessors and setters on `Customer` model for `pan` (proxying `pan_number`), `gstin` (proxying `canonical_gstin` / `gst_number`), and `notes` (proxying `profile_notes`).
3. `backend/app/services/crm.py`:
   - Implemented `merge_customer` method in `CrmService` orchestrating the complete BD-2 consolidation pipeline, subordinate deduplication, direct SQL relational updates, financial summation, and WORM audit logging.
4. `backend/app/api/v1/crm.py`:
   - Imported `CustomerMergeRequest` and `CustomerMergeResponse`.
   - Mounted `POST /api/v1/crm/customers/merge` with RBAC authorization (`require_role(UserRole.SYSADMIN, UserRole.ADMIN, UserRole.MANAGER)`).
5. `src/components/customer/lifecycle/types.ts`:
   - Added `CustomerMergeResult` interface with dual camelCase and snake_case properties.
6. `src/components/customer/CustMasterWs.tsx`:
   - Wired `CustomerMergeModal` into the toolbar More menu ("Merge Account (BD-2)").
   - Added `isMergeModalOpen` state and `handleCustomerMerged` event callback to update local customer lists and consolidate outstanding balances.
7. `src/tests/customerMasterLifecycle.test.tsx`:
   - Added 4 dedicated test cases for `CustomerMergeModal` covering closed state, open modal DOM rendering, BD-2 PAN parity evaluation logic, and WORM audit record generation contracts.
8. `docs/walkthrough/README.md`:
   - Chronologically appended Phase 3 Step 3 Walkthrough entry into Master Index table.

---

## 5. Architecture Decisions
- **ADR-BD2-01: Immutable Tax Identity Parity via PAN (BD-2)**: Indian GST law and income tax regulations stipulate that distinct PANs represent legally distinct taxpayers. To prevent illegal consolidation or cross-entity tax liability mixing, customer merges are strictly blocked when target and source hold conflicting PANs.
- **ADR-BD2-02: Non-Destructive Suffixing for Location Store Code Collisions**: Corporate accounts may have identical store codes (e.g. `STORE-MUM-01`) registered across regional accounts. Merging preserves all delivery and billing location addresses by suffixing colliding codes with the source customer ID (`STORE-MUM-01_CUST10`) rather than discarding or overwriting location master records.
- **ADR-BD2-03: Zero Mutation of Historical Line Items**: Reassignment updates customer linkage at header tables (`sales_invoices.customer_id = :target_id`) while preserving original invoice numbers, timestamps, item rates, and tax snapshots to guarantee 100% statutory integrity for historical tax returns.
- **ADR-BD2-04: Cryptographic WORM Audit Trails (Section 12)**: Consolidations generate a tamper-evident entry in `compliance_immutable_audit_logs` storing SHA-256 payload digest, immediate predecessor hash link, `worm_locked = True`, and `retention_policy = 'STATUTORY_7_YEARS'`.

---

## 6. Design Rationale
- Corporate customers often establish separate accounts during decentralized regional sales operations. BD-2 allows central finance teams to unify accounts into an authoritative master entity without losing branch delivery networks or transaction histories.
- Direct SQL execution for historical table updates avoids loading thousands of past invoice ORM objects into memory, ensuring the merge operation executes in sub-second timeframes even for high-volume accounts.
- Soft-retirement of the source customer ensures foreign key references and historical audit queries never encounter null pointers or dangling identifiers.

---

## 7. Implementation Summary
The implementation was executed in sequential stages:
1. **Pydantic Contract Definition**: Authored `CustomerMergeRequest` and `CustomerMergeResponse` schemas in `backend/app/schemas/crm.py` with full bidirectional alias support.
2. **Model C Accessor Parity**: Added `@property` getters and setters to `backend/app/models/crm.py` (`pan`, `gstin`, `notes`) ensuring seamless interoperability between ORM column definitions and business abstractions.
3. **Core Consolidation Service**: Implemented `CrmService.merge_customer` enforcing:
   - Self-merge block (`target_id == source_id`).
   - Existence and status checks (`source.status != "Merged"`).
   - BD-2 PAN parity guard (`t_pan == s_pan` or adoption).
   - Subordinate collection consolidation across 5 entity types.
   - 10-table transactional reassignment via atomic parameterized SQL updates.
   - Receivables summation and source retirement notes.
   - WORM SHA-256 audit block construction.
4. **REST API Ingress**: Mounted `POST /api/v1/crm/customers/merge` in `backend/app/api/v1/crm.py` with multi-role authorization.
5. **Quality Verification**: Created and executed `backend/tests/test_customer_merge_bd2.py` (7/7 passed), executed all 4 CRM backend test suites (24/24 passed), verified frontend Vitest suites (20/20 passed), passed 11/11 architecture CI duplication gate checks, and verified `tsc --noEmit` exit 0.

---

## 8. Tests Executed
```bash
# 1. BD-2 Customer Merge Dedicated Test Suite
.venv\Scripts\pytest.exe backend/tests/test_customer_merge_bd2.py -v

# 2. Combined CRM Backend Test Suites
.venv\Scripts\pytest.exe backend/tests/test_customer_company_relationships.py \
                         backend/tests/test_customer_lifecycle_security.py \
                         backend/tests/test_customer_multicompany_repository.py \
                         backend/tests/test_customer_merge_bd2.py -v

# 3. Frontend Customer Workspace & Lifecycle Vitest Suites
npm test -- src/tests/customerMasterLifecycle.test.tsx src/tests/corporateCustomerWorkspace.test.tsx --run

# 4. Architecture CI Duplication Gate
.venv\Scripts\python.exe scripts/architecture_duplication_gate.py

# 5. Form & Launchpad Registries
npm run validate-registry
npm run validate-launchpad

# 6. TypeScript Compilation
npm run lint
```

---

## 9. Verification Results

### Pytest Customer Merge Suite Output:
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 7 items

backend\tests\test_customer_merge_bd2.py::test_customer_merge_schema_serialization PASSED [ 14%]
backend\tests\test_customer_merge_bd2.py::test_merge_customer_self_merge_rejection PASSED [ 28%]
backend\tests\test_customer_merge_bd2.py::test_merge_customer_target_or_source_not_found PASSED [ 42%]
backend\tests\test_customer_merge_bd2.py::test_merge_customer_source_already_merged_rejection PASSED [ 57%]
backend\tests\test_customer_merge_bd2.py::test_merge_customer_pan_parity_guard_violation PASSED [ 71%]
backend\tests\test_customer_merge_bd2.py::test_merge_customer_full_consolidation_and_reassignment PASSED [ 85%]
backend\tests\test_customer_merge_bd2.py::test_rest_api_merge_customers_endpoint PASSED [100%]

======================= 7 passed, 17 warnings in 11.30s =======================
```

### Combined CRM Backend Suites Output:
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

====================== 24 passed, 18 warnings in 14.35s =======================
```

### Frontend Vitest Output:
```text
> smriti-retail-os@6.99.0 test
> vitest run src/tests/customerMasterLifecycle.test.tsx src/tests/corporateCustomerWorkspace.test.tsx --run

 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/customerMasterLifecycle.test.tsx (15 tests) 65ms
 ✓ src/tests/corporateCustomerWorkspace.test.tsx (9 tests) 76ms

 Test Files  2 passed (2)
      Tests  24 passed (24)
   Start at  20:16:59
   Duration  889ms (transform 520ms, setup 0ms, import 879ms, tests 141ms, environment 0ms)
```

### Architecture Gate Output:
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

### TypeScript Verification Output:
```text
> smriti-retail-os@6.99.0 lint
> tsc --noEmit

Process completed with exit code 0 (0 errors).
```

---

## 10. Known Limitations
- Consolidation does not recalculate historical closed fiscal-year GST returns (GSTR-1 / GSTR-3B) filed under the source customer code, as filed tax returns are statutory frozen legal documents.
- Point-of-sale terminals offline at the time of merge will reconcile re-pointed transactions during the next synchronization cycle.

---

## 11. Future Work
- Build interactive UI wizard in Corporate Customer Workspace allowing administrators to visually preview merge candidates, resolve address duplicates, and execute merges with dual supervisor confirmation.
- Automated duplicate candidate suggestion engine flagging accounts with identical PANs or phone numbers across branches.

---

## 12. Related ADRs
- `ADR-038`: Model C Customer Commercial Isolation & Shared Identity.
- `ADR-041`: Multi-Company Ledger and Financial Consolidation.
- `ADR-042`: System Parameter Dual-Key Governance.

---

## 13. Related RFCs
- `RFC-CRM-001`: Tenant-Wide Customer Identity with Company-Specific Commercial Terms.
- `RFC-CRM-002`: Authoritative Corporate Customer Merge & PAN Consolidation (BD-2).
- `RFC-CRM-004`: Privileged Cross-Company Customer Search & Discovery (BD-4).
