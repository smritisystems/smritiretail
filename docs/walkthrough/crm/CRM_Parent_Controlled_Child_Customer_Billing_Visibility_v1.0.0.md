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

# Walkthrough: Parent-Controlled Child Customer Visibility in Billing

**Document ID:** WT-CRM-2026-1022-01  
**Area:** CRM & Billing Integration  
**Topic:** Parent-Controlled Child Customer Visibility in Billing / POS  
**Version:** 1.0.0  
**Classification:** Internal Governance & Architecture Walkthrough  

---

## 1. Purpose
This walkthrough documents the design, database migration, backend business logic, validation guards, and frontend user interface implementation for **Parent-Controlled Child Customer Visibility in Billing**. In retail enterprise and corporate hierarchical accounts, child/subordinate customers (e.g. retail outlets, corporate branch stores, sub-units, or family dependants) must appear in Billing and POS customer selection selectors **only when explicitly enabled by the Parent Customer's configuration** (`show_child_customers_in_billing`). When disabled, child customer records remain intact in the CRM master, CRM searches, customer 360, and reports, but are hidden from billing lookup pickers and prevented from direct checkout bypass.

---

## 2. Scope
- **Database Schema**: Added `show_child_customers_in_billing` column to `customers` table with partial index for fast tenant query execution.
- **ORM & Pydantic Contracts**: Updated SQLAlchemy model `Customer` and Pydantic schemas `CustomerBase`, `CustomerUpdate`, `CustomerResponse`, and `BillingCustomerItem`.
- **CRM Service & Repository**: Updated `CustomerRepository.get_all()` and `CustomerRepository.search()` with `billing_only: bool = False` filter, and exposed `billing_only` query parameter in `/api/v1/crm/customers` and `/api/v1/crm/customers/search`.
- **Billing Catalog Service**: Upgraded `BillingCatalogService.get_customers()` to enforce SQL-level filtering so child customers only appear if their parent has `show_child_customers_in_billing == True`.
- **Headless Billing & POS Transaction Engine**: Enforced transactional pre-checkout validation guard in `headless_billing.py` (`calculate_billing`) raising `SMRITI-CUST-042` with HTTP 400 if direct API requests target a child customer whose parent has visibility disabled.
- **Frontend Customer Workspaces**: Added parent-level setting toggle in `CustRetailDetTab.tsx` and `EnterpriseCustomerMasterView.tsx`, with bidirectional DTO mapping in `CustMasterWs.tsx`.
- **Frontend Billing Pickers**: Bound `CustomerMasterModal.tsx`, `CustBrowseDlg.tsx`, and `ProPosBillingTerm.tsx` to display child badges and supply `billing_only=true`.
- **Test Automation**: Delivered 7/7 backend integration tests in Pytest and 5/5 frontend tests in Vitest.

---

## 3. Files Created
1. `backend/alembic/versions/v1543_add_show_child_customers_in_billing.py` — Alembic revision adding `show_child_customers_in_billing BOOLEAN NOT NULL DEFAULT FALSE` and partial index on `(company_id, show_child_customers_in_billing) WHERE is_deleted = false`.
2. `backend/tests/test_child_customer_billing_visibility.py` — Pytest automated test suite covering catalog filtering, direct billing blocking (`SMRITI-CUST-042`), standalone customer passthrough, toggle activation, and repository search isolation.
3. `src/tests/childCustomerBillingVisibility.test.tsx` — Vitest unit test suite covering Customer Retail Details tab toggle, Enterprise Customer Master Card 7 toggle, and Customer Master Modal child badge indicators.

---

## 4. Files Modified
1. `backend/app/models/crm.py` — Added `show_child_customers_in_billing` column definition with `default=False, server_default=text("false")`.
2. `backend/app/schemas/crm.py` — Added `show_child_customers_in_billing: Optional[bool]` and `showChildCustomersInBilling` alias, updating `map_customer_to_response_dict`.
3. `backend/app/schemas/billing_catalog.py` — Added `is_child_customer: bool = False`, `parent_customer_id: Optional[str] = None`, `parent_customer_name: Optional[str] = None` to `BillingCustomerItem`.
4. `backend/app/repositories/customer.py` — Added `_apply_billing_visibility_filter()` and `billing_only: bool = False` parameter to `get_all()` and `search()`.
5. `backend/app/api/v1/crm.py` — Added `billing_only: bool = Query(False)` parameter to `list_customers` and `search_customers`.
6. `backend/app/services/billing_catalog_service.py` — Implemented SQL relationship filtering in `get_customers()` ensuring subordinate accounts are hidden unless parent allows billing.
7. `backend/app/services/headless_billing.py` — Added transactional pre-computation guard in `calculate_billing` enforcing `SMRITI-CUST-042` when child customer billing is disabled.
8. `src/components/customer/types.ts` — Added `showChildCustomersInBilling?: boolean` and `show_child_customers_in_billing?: boolean` to `RetailCustomerRecord`.
9. `src/components/customer/CustRetailDetTab.tsx` — Added "Show Child Customers in Billing" toggle card with status badge and descriptive guidance in Section 2.
10. `src/components/customer/corporateWorkspace/EnterpriseCustomerMasterView.tsx` — Added "Show Child Customers in Billing" toggle switch and status badge in Card 7 header.
11. `src/components/customer/CustMasterWs.tsx` — Added default seed value and payload mapping in `handleSave`.
12. `src/components/billing/CustomerMasterModal.tsx` — Updated `BillingCustomer` interface and rendered `Child: {parent_customer_name}` badge.
13. `src/components/billing/propos/CustBrowseDlg.tsx` — Appended `?billing_only=true` to live customer API fetch.
14. `src/components/billing/propos/ProPosBillingTerm.tsx` — Appended `&billing_only=true` to quick search query endpoint.

---

## 5. Architecture Decisions
1. **Parent-Level Control vs Child-Level Control**:
   - *Decision*: Store `show_child_customers_in_billing` exclusively on the **Parent Customer** record, not replicated across children.
   - *Rationale*: A parent enterprise or primary household account holder governs policy for all subordinate branches/dependants. Centralizing the flag on the parent prevents configuration fragmentation and ensures single-click policy updates for accounts with dozens or hundreds of branches.
2. **Visibility Control vs Record Invalidation**:
   - *Decision*: The visibility flag suppresses records from billing selectors and checkout validation only; it never soft-deletes, archives, or mutates child customer records.
   - *Rationale*: Historical sales, invoices, and accounting ledgers must remain intact. Turning visibility off does not alter past audit logs or previous sales invoices.
3. **Defense-in-Depth Validation (Selector + Checkout API)**:
   - *Decision*: Enforce filtering at the selector level (`BillingCatalogService.get_customers`, `crm.py?billing_only=true`) AND transaction computation level (`headless_billing.py:calculate_billing`).
   - *Rationale*: Hiding accounts from the UI does not prevent headless API calls or automated bots from submitting checkout payloads with child IDs. Raising `SMRITI-CUST-042` guarantees compliance even if UI controls are bypassed.

---

## 6. Design Rationale
- **Partial Indexing**: Created `ix_customers_comp_show_child_billing` on `(company_id, show_child_customers_in_billing) WHERE is_deleted = false` to guarantee O(log N) lookup time without index bloat on deleted customer archives.
- **Fail-Closed Default**: Default value is strictly `FALSE`. Child customers do not appear in billing until explicitly enabled by the parent configuration.
- **Clear Human-Facing Labels**: Standardized UI setting text to `"Show Child Customers in Billing"` with explicit tooltips and active ON/OFF badges.

---

## 7. Implementation Summary
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

## 8. Tests Executed
### 8.1 Backend Test Execution (Pytest)
```
Command: pytest backend/tests/test_child_customer_billing_visibility.py
Platform: win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
Output:
collected 7 items

backend\tests\test_child_customer_billing_visibility.py .......          [100%]

============================== 7 passed in 4.82s ==============================
```

### 8.2 Frontend Test Execution (Vitest)
```
Command: npx vitest run src/tests/childCustomerBillingVisibility.test.tsx
Output:
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/childCustomerBillingVisibility.test.tsx (5 tests) 70ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  22:29:23
   Duration  822ms (transform 278ms, setup 0ms, import 467ms, tests 70ms, environment 0ms)
```

### 8.3 TypeScript Compilation Check
```
Command: npx tsc --noEmit
Output: Exit Code 0 (Clean, 0 errors)
```

### 8.4 Python Syntax Verification
```
Command: python -m py_compile backend/alembic/versions/v1543_add_show_child_customers_in_billing.py backend/app/models/crm.py backend/app/schemas/crm.py backend/app/schemas/billing_catalog.py backend/app/repositories/customer.py backend/app/services/billing_catalog_service.py backend/app/services/headless_billing.py backend/app/api/v1/crm.py
Output: Exit Code 0 (Clean, 0 errors)
```

---

## 9. Verification Results
| Verification Item | Scope | Status | Evidence |
|---|---|---|---|
| Database Migration Lineage | `v1543` revises `v1542` | **Done** | `v1543_add_show_child_customers_in_billing.py` column and index verified |
| Model & Schemas AST Parity | `Customer`, `CustomerBase`, `BillingCustomerItem` | **Done** | Python bytecode compiled, clean type definitions |
| Catalog Filtering Logic | Child hidden by default, visible when parent enabled | **Done** | Pytest `test_child_customer_hidden_by_default`, `test_child_customer_visible_when_parent_enabled` green |
| Direct Billing API Guard | Direct `/checkout` and `/preview` rejected | **Done** | Pytest `test_direct_billing_child_customer_blocked_when_disabled` HTTP 400 `SMRITI-CUST-042` green |
| Standalone Passthrough | Independent customers unaffected | **Done** | Pytest `test_standalone_customer_always_visible_in_billing` green |
| CRM Repository Isolation | `billing_only` query parameter isolates billing searches | **Done** | Pytest `test_customer_repository_billing_only_filter` green |
| Frontend Toggle & Badges | Retail Tab, Enterprise Card 7, POS Modal | **Done** | Vitest 5/5 tests green, 0 `tsc --noEmit` errors |

---

## 10. Known Limitations
- When a child customer is assigned multiple parents (rare multi-parent accounts), enabling the setting on any one active parent enables billing visibility for that child.
- Existing historical invoices issued prior to toggling the setting remain permanently associated with the child customer and are not retroactively modified.

---

## 11. Future Work
- Add branch-specific billing allowance per child in corporate accounts where specific branches have spending caps or time windows.
- Provide automated parent alert when a subordinate account is billed in POS.

---

## 12. Related ADRs
- `ADR-0042`: Hierarchical Customer Master Governance & Single-Door Billing Catalog Isolation.
- `ADR-0038`: Strangler-Fig Migration to FastAPI/PostgreSQL System-of-Record.

---

## 13. Related RFCs
- `RFC-2026-CRM-08`: Parent-Controlled Subordinate Account Visibility & Billing Authorization Policy.
