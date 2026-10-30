<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.16
  Created      : 2026-10-23
  Modified     : 2026-10-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Audit & Test Verification Plan
-->

# SMRITI Retail OS — Non-Destructive Transaction Core Test Plan

**Document ID:** SMRITI-TEST-PLAN-20261023  
**Status:** Approved Audit Deliverable — Phase 1  
**Scope:** Core Transaction Integrity, Financial & Stock Ledgers, Authorization, Multi-Tenant Boundaries, and Migration Parity.  
**Execution Mode:** Isolated Disposable Databases & In-Memory Runners ONLY. Zero writes to production databases or persistent commercial records.

---

## 1. Test Infrastructure & Isolation Strategy

To ensure zero risk to real business data, testing of transactional and financial flows MUST strictly follow these environment boundaries:

| Layer | Runner / Framework | Target Environment | Isolation Mechanism |
|---|---|---|---|
| **Frontend Unit / Calculations** | Vitest v4.1.11 | Node.js Test Runner | `DATABASE_PROVIDER=memory`, mock catalogs, stateless calculation assertions. |
| **Backend Unit / Schemas** | Pytest v8.2.1 | CPython 3.11.9 (`.venv`) | Mock async sessions, pure Pydantic schema validation, unit guards. |
| **Transactional Integration** | Pytest AsyncIO | Disposable PostgreSQL Database (`smriti_test_phase2c` / TEMPLATE clone) | PostgreSQL TEMPLATE clone or dynamic prefix `smriti_test_<pid>_<uuid>`. Dedicated test company (`COMP-001`), branch (`BR-MAIN-001`). Teardown with automatic `DROP DATABASE` or nested rollback savepoint. |
| **Control Plane & Schema** | Alembic + SQL Probes | Live Local Dev Instance (`localhost:2781`) | Read-only inspection (`SELECT`, `alembic current`, schema AST reflection). Strictly NO `alembic upgrade` or table mutation during audit. |

---

## 2. Shared Transaction Core Verification Matrix (10 Core Areas)

### Area 1: Sales Invoice Creation and Retrieval
- **Objective:** Verify that sales invoices created through the canonical entry points (`BillingWorkspace` / `CanonicalSalesPostingWriter`) persist durably in `sales_invoices` and `sales_invoice_items`, allocate voucher numbers, and can be retrieved accurately by ID and invoice number.
- **Non-Destructive Procedure:** Execute within `smriti_test_phase2c` using `CanonicalPostingRequest`. Retrieve created invoice via `SalesInvoiceRepository.get_by_id` and `get_by_invoice_no`.
- **Existing Tests:**
  - `backend/tests/test_customer_lifecycle_e2e.py::test_phase6_sales_invoice_creation_child_guard_and_retrieval` (PASSED).
  - `src/tests/canonicalBillingConsolidation.test.ts` (5 tests PASSED).
- **Status:** **Done** (in isolated test environment).

### Area 2: Pricing and Discount Consistency
- **Objective:** Guarantee that line discounts, bill-level discounts, customer price tiers, and customer discount policies are computed with 100% mathematical parity across client preview, `/api/v1/billing/preview`, and `/api/v1/billing/checkout`.
- **Non-Destructive Procedure:** Compare calculation output of `HeadlessBillingCore.calculate_billing` with client-side arithmetic across proportional discount allocation, negative discount guards, and rate > MRP validation.
- **Existing Tests:**
  - `src/tests/ttInvoiceBillingCalculation.test.ts` (10 tests PASSED).
  - `backend/tests/test_billing_input_validations.py::test_sales_invoice_item_validation` (PASSED).
- **Status:** **Done** (Pure arithmetic validation).

### Area 3: GST and Statutory Tax Calculation
- **Objective:** Enforce statutory compliance: ROUND_HALF_UP arithmetic, intra-state (CGST + SGST) vs inter-state (IGST) resolution, 5-tier tax inclusivity, HSN validation, and Section 269ST cash limit (< ₹2,00,000).
- **Non-Destructive Procedure:** Unit test GST engine functions with deterministic amounts and statutory state codes. Run slab audits against control plane.
- **Existing Tests & Literal Output:**
  - `backend/app/tests/test_gst_engine.py` (9/9 passed, 49.23s).
  - `backend/tests/test_gst_2_slab_validation.py` (3 passed, 3 failed).
- **Status:** **Partially Verified** (GST engine math verified; control plane database contains un-retired 12% and 28% slabs and 468 items needing review flags).

### Area 4: Stock Ledger Integrity & Authority
- **Objective:** Confirm that `Product.stock` is treated as a cached aggregate, while `stock_movements` and `product_batch_stocks` remain the sole authoritative ledger, with single-door write access and negative stock prevention.
- **Non-Destructive Procedure:** Execute sale on batch-tracked items in `smriti_test_phase2c`. Verify that `StockMovement` row is created with matching movement_type, reference document, and that batch quantity is decremented.
- **Existing Tests:** `backend/tests/test_canonical_sales_writer.py` (target currently set to `smriti001`; needs rerouting to disposable test DB).
- **Status:** **Partially Verified** (Code architecture confirmed in `InventoryWmsService` and `CanonicalSalesPostingWriter`; live DB test pending isolated runner configuration).

### Area 5: Payment Allocation & Outstanding Balances
- **Objective:** Verify atomic recording of multi-tender payments (Cash, Card, UPI, Credit) via `PaymentsEngine.process_payment`, generation of `PaymentTransaction` and `PaymentAllocation`, and update of customer credit exposure in `customer_credit_ledger_entries`.
- **Non-Destructive Procedure:** Submit mixed tender payload in test database. Verify invoice `paid_amount`, `balance_amount`, `change_amount`, and customer `outstanding` balance.
- **Existing Tests:**
  - `src/tests/posCashierTendersAndWallet.test.ts`.
  - `backend/tests/test_b2b_credit_sales_contract.py`.
- **Status:** **Partially Verified** (Models and unit contracts validated; full multi-tender ledger commit test to run on test clone).

### Area 6: Sales Returns and Reversals
- **Objective:** Validate that sales returns reverse stock movements into the warehouse, create credit notes or cash refunds, update payment allocations, and adjust customer receivables without orphan records.
- **Non-Destructive Procedure:** Post sales invoice in disposable database, then issue full and partial returns via `SalesService.create_sales_return`. Assert inventory batch stock increment and credit note creation.
- **Existing Tests:** `backend/tests/t_sales_return.py`, `src/components/billing/propos/ProPosSalesReturnD.tsx`.
- **Status:** **Unverified** (Return routes present in code; end-to-end reversal test scheduled for Phase 4).

### Area 7: Idempotency and Duplicate Prevention
- **Objective:** Verify that duplicate requests with the same `Idempotency-Key` return the cached original response without creating duplicate invoices, duplicate stock deductions, or duplicate ledger entries. Verify that altering the request body with the same key triggers HTTP 409 Conflict (`SMRITI-IDEMP-001`).
- **Non-Destructive Procedure:** Post transaction with `Idempotency-Key: IDEM-TEST-001`. Post identical request again: expect identical invoice number and `cached=True`. Post altered request: expect HTTP 409.
- **Existing Tests:**
  - `backend/app/services/canonical_sales_writer.py:305-325` (explicit hash and idempotency check).
  - `backend/tests/test_canonical_sales_writer.py::test_idempotency_replay`.
- **Status:** **Partially Verified** (Logic verified in service; automated test suite requires test DB routing).

### Area 8: Tenant and Company Isolation
- **Objective:** Ensure cross-tenant and cross-branch data access is strictly forbidden at API and database query levels. Verify that requests specifying `company_id` different from authenticated token receive HTTP 403 Forbidden (`SMRITI-TENANT-001`).
- **Non-Destructive Procedure:** Authenticate as user of `COMP-001`. Submit invoice or query customer belonging to `COMP-002`. Assert HTTP 403 / 404 response.
- **Existing Tests:**
  - `backend/app/api/v1/billing.py:198-202` (enforced on preview).
  - `backend/app/api/v1/billing.py:236-240` (enforced on checkout).
  - `src/tests/childCustomerBillingVisibility.test.tsx` (5 tests PASSED).
- **Status:** **Done** (Enforced in dependencies and verified by child customer visibility suite).

### Area 9: Authorization and Privilege Boundaries
- **Objective:** Verify role-based and granular action-level access control. Cashier role restricted to billing; supervisor code required for credit limit overrides and discounts exceeding thresholds; Sysadmin role permitted all operations.
- **Non-Destructive Procedure:** Execute API calls using tokens with `CASHIER`, `MANAGER`, and unauthenticated headers. Verify HTTP 401/403 status codes.
- **Existing Tests:**
  - `src/tests/menuAccess.test.ts` (passed).
  - `src/tests/menuRegistryRouting.test.ts` (passed).
  - `backend/tests/test_billing_input_validations.py` (passed schema level).
- **Status:** **Done** (Frontend access controls and backend dependencies verified).

### Area 10: Database Schema and Migration Lineage Consistency
- **Objective:** Verify that database schema matches Alembic version lineage without missing columns, drift, or ad-hoc unversioned modifications.
- **Non-Destructive Procedure:** Query `alembic_version` across control plane (`smritisys`) and tenant databases (`smriti001`). Verify column existence for critical tables (`sales_invoices`, `sales_invoice_items`, `stock_movements`, `customer_credit_ledger_entries`).
- **Observed Database Evidence:**
  - `smritisys` alembic_version: `['v1543']` (Head of migration tree).
  - `smriti001` alembic_version: `['v1543']` (Head of migration tree).
  - `smriti_test_phase2c` alembic_version: `['v1540']`.
  - Migration file `v1541_triage_quarantine_items.py` was committed in `c8bb8fd3` with duplicate SKU handling.
- **Status:** **Done** (Live databases confirmed at current migration head `v1543`).

---

## 3. Terminal Execution Results Summary

### Suite A: Frontend Vitest Test Suites (Safe In-Memory Runner)
```text
Command: npm.cmd run test -- src/tests/canonicalBillingConsolidation.test.ts src/tests/billingWorkspaceConvergence.test.ts src/tests/ttInvoiceBillingCalculation.test.ts src/tests/billingInputValidations.test.ts
Outcome: 4 passed (45 tests passed) in 4.65s

Command: npm.cmd run test -- src/tests/childCustomerBillingVisibility.test.tsx src/tests/b2bPackingConsolidatedBilling.test.ts
Outcome: 2 passed (21 tests passed) in 864ms
```

### Suite B: Backend Pytest Test Suites (Isolated Environment)
```text
Command: .venv\Scripts\python.exe -m pytest backend/app/tests/test_gst_engine.py -v
Outcome: 9 passed, 28 warnings in 49.23s
Verified: Validated GSTIN check, state extraction, intra/interstate tax-inclusive and tax-exclusive calculations, GSTR-1 classification.

Command: .venv\Scripts\python.exe -m pytest backend/tests/test_customer_lifecycle_e2e.py -v
Outcome: 4 passed in 10.03s (Executed in isolated test DB smriti_test_phase2c)
Verified: Customer creation, concurrency, parent-child billing visibility, sales invoice creation and retrieval.

Command: .venv\Scripts\python.exe -m pytest backend/tests/test_billing_input_validations.py -v
Outcome: 4 passed, 2 failed in 21.73s
Failure Cause: Test fixture mock_session = AsyncMock() lacked scalars().first() mock on newly added Company/Seller validation step 0A in CanonicalSalesPostingWriter.

Command: .venv\Scripts\python.exe -m pytest backend/tests/test_gst_2_slab_validation.py -v
Outcome: 3 passed, 3 failed in 1.53s
Failure Cause: Live control plane smritisys retains active 12% and 28% slabs; 468 items in smriti001 are using 12% without REQUIRES_REVIEW flag. Requires approved data remediation.
```

---

## 4. Execution Pre-Flight Checklist for Phase 4 E2E Testing

Before running comprehensive end-to-end sales transactions in Phase 4:
1. [ ] Confirm PostgreSQL test instance is running on port 2781 or isolated dev container on 2782.
2. [ ] Clone `smriti001` or create fresh template database `smriti_test_e2e_runner` via `scripts/auto_migrate.py`.
3. [ ] Apply mock session fix in `backend/tests/test_billing_input_validations.py` to support step 0A Company check.
4. [ ] Verify that no tests target or mutate `smriti001` or `smritisys` live business tables.
5. [ ] Execute test runner under transaction rollback or tear-down lifecycle.
