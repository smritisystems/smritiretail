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
  Classification: Enterprise Multi-Company Customer Repository & Search Walkthrough
-->

# SMRITI Customer Master Model C: Multi-Company Repository & Search Unification Walkthrough

## 1. Purpose
This walkthrough documents the successful implementation and verification of Model C Multi-Company Customer Repository Unification, Enterprise Cross-Company Customer Search (BD-4), and Tamper-Evident Regulatory Audit Trail integration in SMRITI Retail OS.

## 2. Scope
- Multi-company relational query unification (`_apply_tenant_filter`) in `CustomerRepository`.
- Preloading of `CustomerCompanyRelationship` across all customer queries (`get`, `get_all`, `search`, `enterprise_search`).
- Seamless DTO inclusion of `company_relationships` inside `CustomerResponse`.
- Privileged BD-4 enterprise search endpoint (`GET /api/v1/crm/enterprise/customers/search`) gated by `require_cross_company_customer_access` (SYSADMIN/ADMIN or `CUSTOMER.CROSS_COMPANY.LOOKUP` permission).
- Tamper-evident regulatory audit trail logging into `compliance_immutable_audit_logs` with SHA-256 payload digest and cryptographic hash-chaining.
- Comprehensive automated verification via 6/6 dedicated Pytest test suite cases and regression verification across all 17 CRM customer backend tests and 20 frontend Vitest tests.

## 3. Files Created
- `backend/tests/test_customer_multicompany_repository.py`: Automated Pytest test suite validating Model C query generation, DTO serialization, cross-company access authorization, and immutable audit logging.

## 4. Files Modified
- `backend/app/repositories/customer.py`: Overrode `_apply_tenant_filter` to enforce Model C multi-company logic; added eager loading of `CustomerCompanyRelationship`; implemented `enterprise_search`.
- `backend/app/schemas/crm.py`: Positioned `CustomerCompanyRelationship` schemas prior to customer response validators; wired `company_relationships` collection into `map_customer_to_response_dict` and `CustomerResponse`.
- `backend/app/api/v1/crm.py`: Mounted `GET /api/v1/crm/enterprise/customers/search` with RBAC guard and cryptographic audit logging; unified `get_customer_commercial_summary` with `repo.get()`.

## 5. Architecture Decisions
1. **Model C Tenant-Boundary Resolution**:
   A customer is visible within a company tenant session if:
   - The customer originated in or is bound to the company (`Customer.company_id == tenant_ctx.company_id`), OR
   - The customer is a tenant-wide master identity (`Customer.company_id IS NULL`), OR
   - An active commercial relationship exists linking the customer to the company (`EXISTS (SELECT 1 FROM customer_company_relationships ccr WHERE ccr.customer_id == Customer.id AND ccr.company_id == tenant_ctx.company_id AND ccr.is_deleted == false)`).
2. **Privileged Cross-Company Discovery (BD-4)**:
   Enterprise cross-company search is decoupled from tenant boundaries and strictly restricted to `SYSADMIN`, `ADMIN`, or roles explicitly granted `CUSTOMER.CROSS_COMPANY.LOOKUP`.
3. **Cryptographic Compliance Logging**:
   Every enterprise cross-company query is committed into `compliance_immutable_audit_logs` with a SHA-256 payload digest linked to the previous block hash (`previous_hash`) and marked with `worm_locked=True` and statutory 7-year retention.

## 6. Design Rationale
- Standard company users must only see customers relevant to their operating company. Model C ensures that once a company relationship is created, the customer becomes immediately discoverable and billable by that company without duplicating customer master records.
- Cross-company lookup across legal entities carries regulatory and data privacy considerations. Gating BD-4 behind explicit RBAC and recording tamper-evident audit logs guarantees full compliance with financial and enterprise auditing requirements.

## 7. Implementation Summary
- `CustomerRepository._apply_tenant_filter`: Replaced bare single-company equality with a compound SQL expression combining originating company matching, null check, and SQL `EXISTS` on `customer_company_relationships`.
- `CustomerResponse`: Added `company_relationships: List[CustomerCompanyRelationshipResponse] = []` and mapped non-deleted relationship records inside `map_customer_to_response_dict`.
- `crm.py`: Added `require_cross_company_customer_access` dependency and mounted `/api/v1/crm/enterprise/customers/search`.

## 8. Tests Executed
1. `backend/tests/test_customer_multicompany_repository.py`:
   - `test_customer_response_serialization_with_company_relationships`: Passed
   - `test_customer_repository_model_c_tenant_filter_generation`: Passed
   - `test_require_cross_company_customer_access_sysadmin_allowed`: Passed
   - `test_require_cross_company_customer_access_admin_allowed`: Passed
   - `test_require_cross_company_customer_access_unauthorized_rejected`: Passed
   - `test_enterprise_search_customers_audit_logging`: Passed
2. Full CRM Backend Suite (17/17 passed):
   - `test_customer_company_relationships.py` (4 tests)
   - `test_customer_lifecycle_security.py` (7 tests)
   - `test_customer_multicompany_repository.py` (6 tests)
3. Frontend Customer Vitest Suite (20/20 passed):
   - `src/tests/customerMasterLifecycle.test.tsx` (11 tests)
   - `src/tests/corporateCustomerWorkspace.test.tsx` (9 tests)
4. Quality Gates:
   - `npm run validate-registry`: 106/106 passed
   - `npm run validate-launchpad`: 57/57 passed
   - `npm run lint` (`tsc --noEmit`): 0 errors, exit 0
   - `architecture_duplication_gate.py`: 11/11 checks passed, 0 violations

## 9. Verification Results
All tests passed with zero regressions. The multi-company relational query correctly permits cross-company visibility through `CustomerCompanyRelationship` rows, and enterprise search enforces RBAC and tamper-evident audit logs.

## 10. Known Limitations
- Real-time POS offline clients operate on local SQLite caches and synchronize company relationships upon online synchronization.

## 11. Future Work
- Expose enterprise cross-company search UI modal in the Customer Master workspace for users with `CUSTOMER.CROSS_COMPANY.LOOKUP` privileges.
- Add batch relationship assigner for bulk-enrolling corporate customers across all retail sister companies.

## 12. Related ADRs
- `ADR-0042`: Enterprise Multi-Company Customer Master Model C Architecture
- `ADR-0043`: Cryptographic WORM Compliance Audit Logging for Master Data Operations

## 13. Related RFCs
- `RFC-2026-CRM-001`: Multi-Company Legal Entity Commercial Terms & Relationship Delegation
