<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.22.0
  Created      : 2026-08-17
  Modified     : 2026-08-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Legacy Test Migration Matrix

**Audit Date:** 2026-08-17  
**Commit Baseline:** 79c23887  
**Target:** 158/158 PASS in `tests/`, 186/186 PASS in `app/tests/` (Total: 344/344 PASS).  
**Architecture Policy:** Zero operational business data seeded into `smritisys` Control Plane. Strict company database isolation.

---

## 1. Architecture Invariants (Frozen)

| Component | Target Database | Allowed Models / Tables |
|---|---|---|
| **Control Plane** | `smritisys` | `users`, `roles`, `companies`, `branches`, `user_company_assignments`, `company_database_registries`, `smriti_menus`, `smriti_audit_log` |
| **Operational DB (Company A)** | `smriti001` | `products`, `customers`, `customer_groups`, `suppliers`, `purchase_orders`, `purchase_order_items`, `purchase_receipts`, `purchase_receipt_items`, `sales_invoices`, `sales_invoice_items`, `sales_returns`, `eway_bills`, `stock_movements`, `dispatches` |
| **Operational DB (Company B)** | `smriti002` | Isolated operational partition for Company B |
| **Authoritative Router** | `CompanyDatabaseResolver` | Dynamic resolution of connection string from user + company_id |
| **Prohibited Elements** | `SmritiPSV`, `SmritiEcom` | No shared operational databases permitted |

---

## 2. Table-by-Table Failure Classification & Migration Record

| # | Test Name | File | Previous Database Access | Correct Database | Reason for Failure | Migration Change Applied | Verification Status |
|---|---|---|---|---|---|---|---|
| 1 | `test_sales_return_and_credit_note_workflow` | `test_sales_return_workflow.py` | `psycopg2 → smritisys.sales_returns` | `smriti001` | Operational data written to Control Plane; FK violation on missing invoice | Migrated psycopg2 to `smriti001`; created isolated test invoice `inv-test-ret-001`; added deterministic cleanup | **Done** (PASS) |
| 2 | `test_eway_bill_dispatch_workflow` | `test_eway_bill_dispatch.py` | `psycopg2 → smritisys.eway_bills` | `smriti001` | Operational data written to Control Plane; missing table in Company DB | Provisioned `eway_bills` in `smriti001`; migrated psycopg2 to `smriti001`; added isolated test invoice `inv-test-ewb-001` and cleanup | **Done** (PASS) |
| 3 | `test_grn_shortage_and_stock_increment_signature_scenario` | `test_grn_stock_increment.py` | `psycopg2 → smritisys.suppliers`, `purchase_orders`, `purchase_receipts` | `smriti001` | Operational data written to Control Plane; schema mismatches (`outstanding`, `reserved_stock`, `document_number`) | Migrated psycopg2 to `smriti001`; aligned column inserts with `smriti001` schema (`reserved_stock=0`, `outstanding=0.00`); added deterministic cleanup | **Done** (PASS) |
| 4 | `test_purchase_order_creation_and_approval_workflow` | `test_purchase_order_flow.py` | `psycopg2 → smritisys.suppliers`, `purchase_orders` | `smriti001` | Operational data written to Control Plane; schema mismatches (`outstanding`, `reserved_stock`) | Migrated psycopg2 to `smriti001`; aligned column inserts with `smriti001` schema; added deterministic cleanup | **Done** (PASS) |
| 5 | `test_01_multi_tenant_routing_company_a` | `test_sales_invoice_contract_suite.py` | `httpx → /api/v1/sales/invoices` | `smriti001` | Stale pre-seeded rows in `smriti001` had `NULL` `version`/`is_interstate` violating response schema | Removed invoice pre-seeding from conftest; set DB defaults (`version=1`, `is_interstate=false`) | **Done** (PASS) |
| 6 | `test_04_create_invoice_and_verify_stock_deduction` | `test_sales_invoice_contract_suite.py` | `httpx → /api/v1/sales/invoices` | `smriti001` | Pre-seeded invoice collision with `idempotency_key` logic | Cleaned up pre-seeded invoice collision; configured `test_engine` directly to `smriti001` | **Done** (PASS) |
| 7 | `test_05_create_invoice_outbox_event` | `test_sales_invoice_contract_suite.py` | `httpx → /api/v1/sales/invoices` | `smriti001` | Follow-on failure from test_04 collision | Verified outbox event creation against Company DB | **Done** (PASS) |
| 8 | `test_06_get_invoice_detail_authoritative` | `test_sales_invoice_contract_suite.py` | `httpx → /api/v1/sales/invoices` | `smriti001` | Follow-on failure from test_04 collision | Verified invoice detail retrieval from Company DB | **Done** (PASS) |
| 9 | `test_07_get_html_preview_matches_db` | `test_sales_invoice_contract_suite.py` | `httpx → /api/v1/sales/invoices/.../html` | `smriti001` | Follow-on from test_04 collision | Verified HTML print preview against Company DB | **Done** (PASS) |
| 10 | `test_08_get_pdf_rendered_successfully` | `test_sales_invoice_contract_suite.py` | `httpx → /api/v1/sales/invoices/.../pdf` | `smriti001` | Follow-on from test_04 collision | Verified PDF render pipeline against Company DB | **Done** (PASS) |
| 11 | `test_09_print_preview_structure` | `test_sales_invoice_contract_suite.py` | `httpx → /api/v1/sales/invoices/.../html` | `smriti001` | Follow-on from test_04 collision | Verified invoice preview structure against Company DB | **Done** (PASS) |
| 12 | `test_10_double_submit_idempotency_semantics` | `test_sales_invoice_contract_suite.py` | `httpx → /api/v1/sales/invoices` | `smriti001` | Follow-on from test_04 collision | Verified idempotency key handling against Company DB | **Done** (PASS) |
| 13 | `test_company_db_runtime_routing_allow` | `test_company_db_runtime_routing.py` | `CompanyDatabaseResolver → smritisys` | `smritisys` (Control Plane) | Test order dependency on Control Plane user assignments | Stabilized `conftest.py` Control Plane session fixture (`users`, `user_company_assignments`) | **Done** (PASS) |
| 14 | `test_company_db_resolver_authorized_user` | `test_multi_company_database_architecture.py` | `CompanyDatabaseResolver → smritisys` | `smritisys` (Control Plane) | Test order dependency on Control Plane user assignments | Stabilized `conftest.py` Control Plane session fixture | **Done** (PASS) |
| 15 | `test_resolver_enforces_alphanumeric_codes` | `test_company_db_naming_convention.py` | `CompanyDatabaseResolver → smritisys` | `smritisys` (Control Plane) | Test order dependency on Control Plane user assignments | Stabilized `conftest.py` Control Plane session fixture | **Done** (PASS) |

---

## 3. Conftest Seeding Architectural Separation

```
tests/conftest.py (Session Fixture)
 ├── smritisys (Control Plane ONLY)
 │    ├── companies ('COMP-001', 'comp-default')
 │    ├── branches ('MAIN')
 │    ├── users ('usr-super', 'usr_sysadmin', 'usr-cashier', 'usr-manager', 'usr_store_manager_a')
 │    ├── user_company_assignments (mappings to COMP-001 and comp-default)
 │    ├── smriti_menus (exactly 34 immutable menus)
 │    └── smriti_audit_log (minimum 40 audit records)
 └── smriti001 (Company 001 Operational DB)
      ├── products ('prod-ch-24-g-black-36', 'prod-ch-01-a-cream-36' with stock=1000, reserved_stock=0)
      ├── customer_groups ('cg-default')
      └── customers ('cust-ril-1888')
```

---

## 4. Final Verification Summary

- `tests/` Suite: **158 / 158 PASS (100%)**
- `app/tests/` Suite: **186 / 186 PASS (100%)**
- Total Active Regression: **344 / 344 PASS (0 FAILURES)**
- Control Plane Mutations: **0 operational records created in smritisys**
- Direct Operational `psycopg2` Access to `smritisys`: **0 occurrences in migrated tests**
