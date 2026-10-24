<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.14
  Created      : 2026-10-23
  Modified     : 2026-10-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Retail OS End-to-End Customer Lifecycle Audit & Validation

**Walkthrough ID:** WT-CRM-2026-1023-01  
**Area:** CRM, POS Billing & Headless Transaction Subsystems  
**Topic:** End-to-End Customer Lifecycle Audit, Verification & Child Billing Guard Hardening  
**Version:** 1.0.0  
**Classification:** Internal Technical Verification & Governance Walkthrough  
**Status:** Completed  

---

## 1. Purpose
Validate and certify the complete lifecycle of customer entities across SMRITI Retail OS without simulated mocks, headless and without browser:
`Customer Creation → Viewing → Editing → Concurrency Locking → Billing/POS Selection → Parent-Child Visibility Enforcement → Invoice Creation → Invoice Retrieval & Repository Querying`.

---

## 2. Scope
1. **Customer Master Creation:** Rejection of missing required fields, Indian GSTIN checksum/format regex enforcement (`GSTIN_REGEX`), duplicate unique code collision detection (HTTP 409 `CUSTOMER_CODE_COLLISION`), duplicate mobile detection (HTTP 409 `DUPLICATE_CUSTOMER`), database persistence, and direct repo retrieval.
2. **Customer Modifications & Concurrency:** Field updates (email, tags, notes), optimistic locking protection via `expected_modified_at` raising HTTP 409 `CONCURRENT_MODIFICATION_DETECTED` on stale timestamps, direct database state verification, and audit logging.
3. **Billing/POS Customer Selection & Parent-Child Policy:** Standalone customer lookup via `BillingCatalogService.get_customers()`, subordinate child customer hiding when parent `show_child_customers_in_billing = False`, and child customer visibility with badge when parent `show_child_customers_in_billing = True`.
4. **Sales Invoice Creation & Child Checkout Guard:** Enforcement of checkout rejection (HTTP 400 `SMRITI-CUST-042`) when attempting invoice creation for a child customer whose parent visibility is disabled; authorized invoice posting via `CanonicalSalesPostingWriter.post_sales_transaction` for standalone customers; atomic ledger persistence and dual-key retrieval by invoice ID and invoice number.

---

## 3. Files Created
1. `backend/tests/test_customer_lifecycle_e2e.py`: Authoritative 4-phase end-to-end integration and verification test suite covering Customer Creation, Customer Edit & Optimistic Concurrency, POS Billing Directory & Parent-Child Visibility, and Sales Invoice Checkout Guard & Retrieval.
2. `docs/walkthrough/crm/CRM_Customer_Lifecycle_End_To_End_Audit_v1.0.0.md`: This comprehensive walkthrough document.

---

## 4. Files Modified
1. `backend/app/services/headless_billing.py`: Unindented child customer visibility validation from within `if db_customer is None:`. When called via `CanonicalSalesPostingWriter`, `db_customer` is pre-resolved; unindenting ensures child billing authorization policy is universally enforced regardless of caller pre-resolution.
2. `backend/app/services/canonical_sales_writer.py`: Enclosed `PSVProjectionService.project_posted_invoice` invocation inside `async with session.begin_nested():` savepoint isolation. Guarantees non-fatal auxiliary PSV projection warnings never abort the primary transactional invoice posting and inventory ledger commits.

---

## 5. Architecture Decisions
- **Strict Child Customer Checkout Guard:** Child customer checkout cannot be bypassed by direct API calls to `post_sales_transaction` or `/api/v1/billing/checkout`. If a customer is flagged as dependant or linked to a parent in `customer_relationships`, checkout is rejected with HTTP 400 (`SMRITI-CUST-042`) unless at least one parent explicitly sets `show_child_customers_in_billing = True`.
- **Nested Savepoint Isolation for Projections:** Auxiliary downstream projection hooks (such as Party Stock Visibility metric recomputation) must execute in a nested transaction (`session.begin_nested()`). If a schema mismatch or background query error occurs in an auxiliary projection, the savepoint rolls back cleanly without marking the outer database transaction as aborted in `asyncpg`.

---

## 6. Design Rationale
- **Zero Mock Data Policy:** The audit runs strictly against a real PostgreSQL database (`smriti_test_phase2c` on port 2781) with complete DDL, foreign keys, constraints, and triggers. No in-memory dictionaries or synthetic mocks were used.
- **Optimistic Concurrency Protection:** SMRITI Retail OS requires multi-terminal concurrency safety. When an operator attempts to update a customer profile, the server validates `expected_modified_at`. If another operator modified the record in the interim, the update is rejected with HTTP 409 `CONCURRENT_MODIFICATION_DETECTED` to prevent silent overwrites.

---

## 7. Implementation Summary
- **Bug Discovery & Remediation in `headless_billing.py`:** Discovered that the child customer visibility check introduced in `v1543` was nested inside `if db_customer is None:`. Because `CanonicalSalesPostingWriter` pre-resolves `db_customer` on line 1028, the guard was bypassed when posting invoices through canonical sales transactions. Unnested the check to run unconditionally whenever `db_customer` is resolved and not `CUST-WALKIN`.
- **Auxiliary Savepoint Hardening in `canonical_sales_writer.py`:** Wrapped `PSVProjectionService.project_posted_invoice` in `async with session.begin_nested():`. If an auxiliary PSV query encounters column drift, the transaction remains viable and commits the invoice and inventory movements reliably.
- **Physical Schema Parity:** Added column `product_id VARCHAR(50)` to `psv_sku_tracking` in the test database matching Alembic migration `a1b2c3d4e5f6_add_missing_core_tables.py` and ORM model `PSVPartySkuTracking`.

---

## 8. Tests Executed

### Backend Pytest Suite:
```bash
pytest backend/tests/test_customer_lifecycle_e2e.py -v
```

Terminal output:
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0 -- C:\Users\netma\AppData\Local\Programs\Python\Python313\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collecting ... collected 4 items

backend\tests\test_customer_lifecycle_e2e.py::test_phase3_customer_creation_validation_and_persistence PASSED [ 25%]
backend\tests\test_customer_lifecycle_e2e.py::test_phase4_customer_edit_concurrency_and_persistence PASSED [ 50%]
backend\tests\test_customer_lifecycle_e2e.py::test_phase5_billing_pos_customer_selection_and_parent_child_visibility PASSED [ 75%]
backend\tests\test_customer_lifecycle_e2e.py::test_phase6_sales_invoice_creation_child_guard_and_retrieval PASSED [100%]

============================== 4 passed in 8.94s ==============================
```

### Frontend Vitest Suite:
```bash
npm test -- --run src/tests/childCustomerBillingVisibility.test.tsx src/tests/customerMasterLifecycle.test.tsx src/tests/custLookup.test.ts
```

Terminal output:
```text
 ✓ src/tests/custLookup.test.ts (7 tests) 38ms
 ✓ src/tests/childCustomerBillingVisibility.test.tsx (5 tests) 67ms
 ✓ src/tests/customerMasterLifecycle.test.tsx (25 tests) 87ms

 Test Files  3 passed (3)
      Tests  37 passed (37)
   Start at  00:06:32
   Duration  855ms (transform 683ms, setup 0ms, import 1.12s, tests 191ms, environment 0ms)
```

---

## 9. Verification Results
- **Phase 1 (Discovery):** Verified Customer Master UI (`src/components/customer/`), CRM APIs (`backend/app/api/v1/crm.py`), services (`backend/app/services/crm.py`), models (`backend/app/models/crm.py`), Billing Catalog (`backend/app/services/billing_catalog_service.py`), Headless Billing Core (`backend/app/services/headless_billing.py`), Canonical Sales Writer (`backend/app/services/canonical_sales_writer.py`), and Sales Invoice retrieval (`backend/app/repositories/sales.py`). Status: **Done**.
- **Phase 2 (Safe Test Environment):** Test isolation confirmed on database `smriti_test_phase2c` (port 2781) satisfying `_is_testing()` guard with zero impact on production data. Status: **Done**.
- **Phase 3 (Customer Creation):** Validated field rejection, GSTIN checksum/format regex, 409 code collision, 409 mobile collision, persistence, and retrieval. Status: **Done**.
- **Phase 4 (Customer Edit):** Validated field modification, optimistic locking 409 conflict, and database persistence. Status: **Done**.
- **Phase 5 (Billing/POS Selection):** Validated standalone customer lookup, child customer hiding when parent disabled, and child customer visibility when parent enabled. Status: **Done**.
- **Phase 6 (Sales Invoice Creation & Retrieval):** Validated unauthorized child checkout rejection (HTTP 400 `SMRITI-CUST-042`), authorized standalone invoice posting with items and tenders, direct persistence in `sales_invoices`, and repository retrieval by ID and invoice number. Status: **Done**.

---

## 10. Known Limitations
- The child customer checkout guard currently inspects the direct parent-child relationship. Multi-tier recursive grandparent hierarchies (e.g., Parent → Subsidiary → Outlet) evaluate the immediate parent's `show_child_customers_in_billing` flag.

---

## 11. Future Work
- Add recursive CTE grandparent permission inheritance option for complex multi-tier enterprise conglomerates.

---

## 12. Related ADRs
- `ADR-0041`: Single-Door Transaction Posting and Sales Invoice Immutability.
- `ADR-0052`: Parent-Child Customer Organizational Hierarchies and Billing Governance.

---

## 13. Related RFCs
- `RFC-2026-CRM-08`: Subordinate Customer POS Discovery and Authorization Protocol.
