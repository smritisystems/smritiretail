<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.15.0
  Created      : 2026-08-22
  Modified     : 2026-08-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Customer Flow, Policy Enforcement & Database Referential Integrity Hardening (v6.15.0)

## 1. Purpose
Document the comprehensive hardening of the Customer Flow across the frontend POS, FastAPI checkout services, database models, policy validation, and PostgreSQL referential integrity to prevent orphan records, mock data masking, and billing credit violations.

## 2. Scope
- **Backend Policy Validation**:
  - `CrmService.check_credit_limit`: Evaluates `credit_hold` and returns `SMRITI-CREDIT-002: Customer account is on credit hold. Invoicing blocked.`
  - Evaluates `credit_limit` vs `(outstanding + invoice_amount)` and returns `SMRITI-CREDIT-001: Customer credit limit exceeded.` when `auto_block_sales` is active.
- **Canonical Walk-In Customer Resolution**:
  - Added `CUST-WALKIN` ("Walk-In / Cash Customer", mobile `9999999999`, group `CG-Retail`, 0 credit limit) across PostgreSQL seed (`seed_customers.py`) and frontend store (`customerStore.ts`).
  - Automatically resolves blank customer IDs on counter sales to `CUST-WALKIN` to maintain 100% foreign key integrity.
- **Orphan Customer Reconciler**:
  - Added `backend/app/core/reconcile_customers.py` to audit and auto-repair any detached historical invoice records.
- **Automated Verification**:
  - Created `src/tests/customerPolicyEnforcement.test.ts` (5 tests covering credit limits, warning thresholds, credit hold, and Price Group policies).

## 3. Files Created
- `src/tests/customerPolicyEnforcement.test.ts`
- `backend/app/core/reconcile_customers.py`
- `docs/walkthrough/crm/CRM_Customer_Flow_Policy_Enforcement_And_Referential_Integrity_v6.15.0.md`

## 4. Files Modified
- `backend/app/db/seed_customers.py`
- `backend/app/services/crm.py`
- `backend/app/services/sales.py`
- `src/services/customerStore.ts`
- `src/tests/customerFlowIntegrity.test.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Files Deleted
None.

## 6. Architecture Decisions
- **Pre-Flight Backend Enforcement**: Critical credit policies are enforced inside the transactional checkout path in PostgreSQL/FastAPI rather than relying exclusively on frontend browser checks.
- **Canonical Counter Sales Attachment**: By guaranteeing a default `CUST-WALKIN` entity in the database, counter sales remain fully compliant with strict relational foreign keys without inserting `NULL` or orphaned text.

## 7. Implementation Summary
1. Seeded `CUST-WALKIN` in `CANONICAL_CUSTOMERS` (`seed_customers.py`).
2. Updated `sales.py` to auto-resolve `customer_id` and execute `crm_service.check_credit_limit`.
3. Created `reconcile_customers.py` database repair utility.
4. Added Vitest unit test suite `customerPolicyEnforcement.test.ts`.
5. Built production bundle and deployed containers.

## 8. Tests Executed
- `npx vitest run src/tests/customerPolicyEnforcement.test.ts` (5/5 passed).
- `npx vitest run src/tests/customerFlowIntegrity.test.ts` (4/4 passed).
- Full Vitest suite: `npx vitest run` (38 test files, 282/282 tests passed).
- `npm run build`: Compiled in 25.43s.

## 9. Verification Results
- Zero unresolvable customer IDs.
- Zero mock masking in production POS terminals.
- Full transactional safety on credit limit violations.

## 10. Known Limitations
None.

## 11. Future Work
None.

## 12. Related ADRs
- ADR-0028: Multi-Tenant Schema & Branch Scope Alignment
- ADR-0034: Removal of In-Memory Mock Fallbacks in Production Billing

## 13. Related RFCs
- RFC-0042: Universal Customer Master & Price Group Management
