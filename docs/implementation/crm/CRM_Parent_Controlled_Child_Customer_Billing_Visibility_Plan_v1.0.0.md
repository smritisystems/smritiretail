<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.13
  Created      : 2026-10-22
  Modified     : 2026-10-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Parent-Controlled Child Customer Visibility in Billing

**Plan ID:** IP-CRM-2026-1022-01  
**Area:** CRM & POS Billing Subsystems  
**Topic:** Parent-Controlled Subordinate Account Billing Visibility Policy  
**Version:** 1.0.0  
**Classification:** Internal Governance & Implementation Plan  
**Status:** Completed  

---

## 1. Objective
Enable enterprise and retail corporate parent accounts to explicitly govern whether subordinate/child customer accounts (e.g. branch retail outlets, store delivery locations, family dependants) appear in Billing and POS customer selection selectors, and prevent direct billing checkout bypass via backend validation.

---

## 2. Business Motivation
In multi-tier retail business models (e.g. Reliance Retail Limited with corporate head office and numerous retail outlets, or retail consumers with family members), billing is often centrally controlled by the corporate headquarters or primary account holder. Subordinate child accounts should only be individually selectable at POS cash desks if the parent organization authorizes decentralized billing. Uncontrolled visibility causes cashier confusion, incorrect invoicing to subordinate nodes, and ledger discrepancies.

---

## 3. Scope
- **Database Schema**: Add `show_child_customers_in_billing` column to `customers` table with a partial index `ix_customers_show_child_billing` on `(company_id, show_child_customers_in_billing) WHERE is_deleted = false`.
- **Backend ORM & Schemas**: Update SQLAlchemy model `Customer` and Pydantic schemas `CustomerBase`, `CustomerUpdate`, `CustomerResponse`, and `BillingCustomerItem`.
- **CRM Service & Repository**: Add `billing_only` query isolation to `CustomerRepository.get_all()` and `CustomerRepository.search()`, exposed via `/api/v1/crm/customers` and `/api/v1/crm/customers/search`.
- **Billing Catalog Service**: Upgrade `BillingCatalogService.get_customers()` to enforce SQL relationship filtering.
- **Headless Billing & POS Engine**: Enforce validation guard in `headless_billing.py` (`calculate_billing`) returning HTTP 400 (`SMRITI-CUST-042`) on unauthorized child checkout.
- **Frontend Master Workspaces**: Add setting toggle switch and status badge in `CustRetailDetTab.tsx` (Section 2) and `EnterpriseCustomerMasterView.tsx` (Card 7).
- **Frontend Billing Selectors**: Display `Child: {parent_name}` badge in `CustomerMasterModal.tsx` and supply `billing_only=true` in `CustBrowseDlg.tsx` and `ProPosBillingTerm.tsx`.
- **Automated Testing**: 7/7 backend integration tests in Pytest and 5/5 frontend unit tests in Vitest.

---

## 4. Current State
- Parent-child customer relationships are maintained in `customer_relationships` (`parent_customer_id`, `dependant_customer_id`, `relation`, `apply_same_mailing`).
- Child customers are also flagged via `customers.is_dependant`.
- Prior to this implementation, billing customer queries either returned all customers or filtered only by status (`Active`), causing subordinate entities to appear indiscriminately in billing search dropdowns regardless of parent authorization.

---

## 5. Gap Analysis
1. **Missing Parent Configuration**: No boolean attribute existed on the parent customer record to indicate whether child accounts may be billed.
2. **Missing Billing Selector Filtering**: Neither `BillingCatalogService.get_customers()` nor CRM customer searches distinguished between regular standalone accounts and subordinate child accounts governed by parent policy.
3. **Missing Checkout API Guard**: Direct API submissions to `/api/v1/billing/checkout` or `/api/v1/billing/preview` with a child customer ID could succeed without verifying parent approval.
4. **Missing UI Indication**: POS customer directory did not display visual hierarchy badges distinguishing child accounts from parent accounts.

---

## 6. Architecture Impact
- **Single-Door Principle Maintained**: All customer queries for POS flow through `BillingCatalogService.get_customers()` or `/api/v1/crm/customers?billing_only=true`.
- **Database Index Optimization**: The partial index ensures zero query degradation for tenant-scoped billing queries.
- **Strict Immutability**: Historical sales invoices, receipts, and ledger balances are completely untouched.

---

## 7. Proposed Design
```
+-------------------------------------------------------------+
|                      Parent Customer                        |
|  - show_child_customers_in_billing = TRUE / FALSE           |
+-------------------------------------------------------------+
                              |
       +----------------------+----------------------+
       |                                             |
       v                                             v
[ Billing / POS Selector ]              [ Checkout Validation ]
- get_customers(billing_only=true)      - calculate_billing(customer_id)
- If FALSE: Child hidden                - If FALSE & child: HTTP 400 (SMRITI-CUST-042)
- If TRUE: Child visible with badge     - If TRUE: Bill generated normally
```

---

## 8. Files Created
1. `backend/alembic/versions/v1543_add_show_child_customers_in_billing.py`
2. `backend/tests/test_child_customer_billing_visibility.py`
3. `src/tests/childCustomerBillingVisibility.test.tsx`
4. `docs/walkthrough/crm/CRM_Parent_Controlled_Child_Customer_Billing_Visibility_v1.0.0.md`
5. `docs/implementation/crm/CRM_Parent_Controlled_Child_Customer_Billing_Visibility_Plan_v1.0.0.md`

---

## 9. Files Modified
1. `backend/app/models/crm.py`
2. `backend/app/schemas/crm.py`
3. `backend/app/schemas/billing_catalog.py`
4. `backend/app/repositories/customer.py`
5. `backend/app/services/billing_catalog_service.py`
6. `backend/app/services/headless_billing.py`
7. `backend/app/api/v1/crm.py`
8. `src/components/customer/types.ts`
9. `src/components/customer/CustRetailDetTab.tsx`
10. `src/components/customer/corporateWorkspace/EnterpriseCustomerMasterView.tsx`
11. `src/components/customer/CustMasterWs.tsx`
12. `src/components/billing/CustomerMasterModal.tsx`
13. `src/components/billing/propos/CustBrowseDlg.tsx`
14. `src/components/billing/propos/ProPosBillingTerm.tsx`
15. `docs/walkthrough/README.md`
16. `docs/implementation/README.md`
17. `CHANGELOG.md`

---

## 10. Dependencies
- PostgreSQL 15+
- SQLAlchemy 2.0+
- Alembic 1.13+
- FastAPI 0.110+
- React 18 + Vite

---

## 11. Risks
| Risk | Severity | Mitigation |
|---|---|---|
| Accidental exclusion of standalone customers | High | Unit test `test_standalone_customer_always_visible_in_billing` asserts standalone accounts are never suppressed. |
| Performance impact on customer lookups | Medium | Subquery optimization with partial index `ix_customers_show_child_billing`. |
| Checkout API bypass | High | Transactional guard in `headless_billing.py` raising `SMRITI-CUST-042`. |

---

## 12. Rollback Strategy
- Database: Execute `alembic downgrade v1542` to drop the column and partial index.
- Code: Git revert the commits modifying the frontend and backend files.

---

## 13. Verification Plan
1. Run backend unit & integration tests covering catalog filtering, direct billing blocking, standalone customer passthrough, toggle activation, and repository search isolation.
2. Run frontend unit tests covering Retail Details tab toggle, Enterprise Customer Master Card 7 toggle, and Customer Master Modal child badge rendering.
3. Validate TypeScript type correctness with `npx tsc --noEmit`.
4. Validate Python syntax with `python -m py_compile`.

---

## 14. Test Plan
- **Test Suite 1**: `backend/tests/test_child_customer_billing_visibility.py` (7 tests)
  - `test_child_customer_hidden_by_default`
  - `test_child_customer_visible_when_parent_enabled`
  - `test_standalone_customer_always_visible_in_billing`
  - `test_direct_billing_child_customer_blocked_when_disabled`
  - `test_direct_billing_child_customer_allowed_when_enabled`
  - `test_toggle_parent_setting_updates_state`
  - `test_customer_repository_billing_only_filter`
- **Test Suite 2**: `src/tests/childCustomerBillingVisibility.test.tsx` (5 tests)
  - `CustRetailDetTab renders 'Show Child Customers in Billing' toggle with Disabled badge by default`
  - `CustRetailDetTab displays Enabled badge when showChildCustomersInBilling is true`
  - `EnterpriseCustomerMasterView renders toggle in Card 7 Child Customers section`
  - `EnterpriseCustomerMasterView displays ON state when showChildCustomersInBilling is true`
  - `CustomerMasterModal renders Child Customer badge for subordinate accounts`

---

## 15. Documentation Impact
- Updated `CHANGELOG.md` under `[6.99.13]`.
- Created formal walkthrough `docs/walkthrough/crm/CRM_Parent_Controlled_Child_Customer_Billing_Visibility_v1.0.0.md`.
- Appended walkthrough index `docs/walkthrough/README.md`.
- Appended implementation plan index `docs/implementation/README.md`.

---

## 16. Deployment Plan
1. Execute database migration `alembic upgrade head`.
2. Deploy backend service (`backend/app`).
3. Build and deploy frontend client bundle.
4. Verify setting toggle in Customer Master and test billing lookup in POS terminal.

---

## 17. Status
**Completed** — Verified with 7/7 backend tests green, 5/5 frontend tests green, 0 `tsc --noEmit` errors, and 0 Python compile errors.

---

## 18. Related ADRs
- `ADR-0042`: Hierarchical Customer Master Governance & Single-Door Billing Catalog Isolation.
- `ADR-0038`: Strangler-Fig Migration to FastAPI/PostgreSQL System-of-Record.

---

## 19. Related Walkthroughs
- `WT-CRM-2026-1022-01`: [Walkthrough: Parent-Controlled Child Customer Visibility in Billing](../../walkthrough/crm/CRM_Parent_Controlled_Child_Customer_Billing_Visibility_v1.0.0.md)
