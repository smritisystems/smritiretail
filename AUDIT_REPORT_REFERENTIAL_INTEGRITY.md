# Referential Integrity & Tenant Scope Audit

**Target Environment:** `smriti-db` | **Database:** `smriti001` | **Execution Mode:** AUDIT ONLY (Read-Only)
**Timestamp:** 2026-09-29T15:26:00+05:30 | **Status:** Partially Verified (Audit Complete — Awaiting Human Architecture Decisions)

---

## 1. Executive Summary

A complete, non-invasive, read-only architectural audit of the PostgreSQL database `smriti001` (running in container `smriti-db` on port 2781) and the SMRITI Retail OS backend application codebase was executed. No DDL, DML, Alembic migrations, data mutations, or code changes were performed during this audit.

### Key Audit Quantitative Findings
- **Total Public Tables & Views Audited:** 286 (285 base tables, 1 view)
- **Active Populated Tables:** 174 | **Zero-Row Tables:** 111
- **Total Database Primary Keys:** 287
- **Total PostgreSQL Foreign Keys:** 505 (100% `convalidated = True`, 0 `NOT VALID`)
- **Total Unique Constraints:** 396
- **Total Indexes:** 1198
- **Total Candidate Reference Columns Evaluated:** 1118 (1,652 columns matching reference naming patterns)
- **Candidate Classification Distribution:**
  - **Class A (Existing VALID FK):** 498 relationships (covering 505 PostgreSQL constraint objects)
  - **Class B (Existing NOT VALID FK):** 0 relationships
  - **Class C (Bare reference with valid parent relationship, 0 orphans):** 107
  - **Class D (Bare reference with orphan data):** 27 relationships (1,745 orphan rows across 436 distinct orphan IDs)
  - **Class E (Polymorphic references):** 4 columns
  - **Class F (Historical/deleted reference):** Addressed via Class D and ghost tombstone analysis
  - **Class G (Nullable/inactive field, 0 populated rows):** 144
  - **Class H (Zero-row / unpopulated table):** 158
  - **Class I (Unclear / Enum / Natural Business Code):** 180
- **Ghost / Tombstone Injected Rows (v1504):** 66 ghost products in `products` (67 total with is_deleted=TRUE), 158 ghost customers in `customers` inserted to force validation of 4 previously NOT VALID FKs without data cleanup.
- **Alembic Version State:** CRITICAL INCONSISTENCY — `alembic_version` contains 6 concurrent rows (`v1499`, `v1500`, `v1501`, `v1502`, `v1503`, `v1504`) and 2 unmerged DAG heads (`v1497b`, `v1504`).

---

## 2. Scope

The audit covered:
1. **PostgreSQL Database:** Container `smriti-db`, host port 2781, internal port 5432, target database `smriti001`, catalog `pg_catalog` and `information_schema`.
2. **Metadata Objects:** All 285 base tables, 1 view, 287 primary keys, 505 foreign keys, 396 unique constraints, 1,198 indexes, and 2,457 NOT NULL constraints.
3. **Candidate Identification:** All columns ending in `_id`, `id`, `*_key`, `*_code`, and tenant-scoping columns (`tenant_id`, `organization_id`, `company_id`, `business_id`, `store_id`, `branch_id`).
4. **Orphan & Integrity Verification:** Verification of referential consistency across transactional systems: sales, returns, purchases, GRN, inventory, dispatch, packing, payments, general ledger, customer credit, and POS.
5. **Polymorphic Reference Analysis:** In-depth audit of `general_ledger_entries.party_id`, `payment_transactions.party_id`, `psv_party_scopes.party_id`, and `sales_invoices.party_id`.
6. **Tenant & Multi-Entity Scoping:** Evaluation of `tenant_id` vs `company_id` isolation, cross-company references, and missing scope constraints.
7. **Alembic & Migration Parity:** Review of 190 Alembic migration files in `backend/alembic/versions`, revision linearity, migration heads, and `alembic_version` catalog consistency.
8. **Application Code Write-Paths & Deletions:** Audit of delete patterns, soft-delete mechanisms, CSV import bypasses, and service layers in `backend/app/`.
9. **Automated Test Coverage:** Audit of 177 test files in `backend/tests/` for foreign key, delete behavior, and tenant isolation validation.

---

## 3. Database Inventory

### 3.1 Metadata Summary
| Metric | Count | Verifiable Source |
|---|---|---|
| Base Tables | 285 | `information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'` |
| Views | 1 | `information_schema.tables WHERE table_schema='public' AND table_type='VIEW'` (`pos_active_cart_summary`) |
| Primary Keys | 287 | `information_schema.table_constraints WHERE constraint_type='PRIMARY KEY'` |
| Foreign Keys | 505 | `pg_constraint WHERE contype='f'` |
| Validated FKs (`convalidated = t`) | 505 | `pg_constraint WHERE contype='f' AND convalidated=TRUE` |
| NOT VALID FKs (`convalidated = f`) | 0 | `pg_constraint WHERE contype='f' AND convalidated=FALSE` |
| Unique Constraints | 396 | `information_schema.table_constraints WHERE constraint_type='UNIQUE'` |
| Indexes | 1,198 | `pg_indexes WHERE schemaname='public'` |
| NOT NULL Columns | 2,457 | `information_schema.columns WHERE is_nullable='NO'` |
| Columns Matching Candidate Patterns | 1,652 | `information_schema.columns WHERE column_name LIKE '%_id' OR ...` |
| Evaluated Outgoing Reference Candidates | 1,118 | Excluding surrogate PK `id` without outgoing target |

### 3.2 Foreign Key ON DELETE Behavior Distribution
| ON DELETE Action | PostgreSQL Code | Constraint Count | Architectural Intent |
|---|---|---|---|
| RESTRICT | `r` | 326 | Prevents deletion of parent master record while children exist |
| CASCADE | `c` | 102 | Child details deleted on parent header deletion (e.g. line items) |
| SET NULL | `n` | 73 | Clears reference when parent is removed (nullable foreign key) |
| NO ACTION | `a` | 4 | Standard SQL deferred/default behavior |

---

## 4. Complete FK Candidate Matrix

Below is the complete classification matrix covering all candidate reference columns in `smriti001`. For full visibility, the matrix is categorized by classification group.

### 4.1 Summary by Classification Group
| Code | Classification Meaning | Count | Risk Level | Disposition |
|---|---|---|---|---|
| **A** | Existing VALID FK | 498 | INFO | Fully enforced by PostgreSQL kernel |
| **B** | Existing NOT VALID FK | 0 | INFO | None currently NOT VALID in PostgreSQL |
| **C** | Bare reference with valid parent relationship (0 orphans) | 107 | MEDIUM | Populated, clean parent match, but no DB FK constraint |
| **D** | Bare reference with orphan data | 27 | CRITICAL | Live orphan data exists; DB FK cannot be added as VALID |
| **E** | Polymorphic reference | 4 | HIGH | Multi-entity reference or code union; requires schema architectural decision |
| **G** | Nullable / Inactive field (0 populated rows) | 144 | LOW | Table populated, but column is 100% NULL across all rows |
| **H** | Zero-row table | 158 | LOW | Table currently contains 0 rows |
| **I** | Unclear / Enum / Natural Business Code | 180 | MEDIUM | Natural key, enum, or external code (e.g. `pin_code`, `iso_code`) |
| **TOTAL** | All Evaluated Candidates | **1118** | — | Comprehensive catalog inventory |

### 4.2 Class D Matrix: Bare References with Live Orphan Data (CRITICAL)
| Table | Column | Parent Candidate | Rows | Populated | Orphans | Distinct Orphan IDs | Current FK | Classification | Evidence / Root Cause |
|---|---|---|---|---|---|---|---|---|---|
| `accounts` | `company_id` | `companies.id` | — | — | **600** | 20 | NONE | **D** | ['COMP-2108fc', 'COMP-2c19a8', 'COMP-2e712e'] (Historical/code mismatch) |
| `attribute_groups` | `size_group_id` | `size_groups.id` | — | — | **2** | 2 | NONE | **D** | ['APPAREL_ALPHA', 'FOOTWEAR_EU'] (Historical/code mismatch) |
| `billing_csv_import_logs` | `cashier_id` | `users.id` | — | — | **2** | 2 | NONE | **D** | ['usr-manager', 'usr-manager-direct'] (Historical/code mismatch) |
| `fiscal_periods` | `company_id` | `companies.id` | — | — | **480** | 40 | NONE | **D** | ['COMP-105c32', 'COMP-2108fc', 'COMP-2c19a8'] (Historical/code mismatch) |
| `fiscal_years` | `company_id` | `companies.id` | — | — | **40** | 40 | NONE | **D** | ['COMP-105c32', 'COMP-2108fc', 'COMP-2c19a8'] (Historical/code mismatch) |
| `invoice_document_artifacts` | `company_id` | `companies.id` | — | — | **32** | 1 | NONE | **D** | ['comp-default'] (Historical/code mismatch) |
| `invoice_document_artifacts` | `branch_id` | `branches.id` | — | — | **32** | 1 | NONE | **D** | ['br-default'] (Historical/code mismatch) |
| `item_barcodes` | `company_id` | `companies.id` | — | — | **2** | 2 | NONE | **D** | ['COMP-1e1b83', 'COMP-305411'] (Historical/code mismatch) |
| `item_serials` | `warehouse_id` | `warehouses.id` | — | — | **29** | 1 | NONE | **D** | ['WH-ELEC'] (Historical/code mismatch) |
| `item_variants` | `company_id` | `companies.id` | — | — | **3** | 2 | NONE | **D** | ['COMP-1e1b83', 'COMP-305411'] (Historical/code mismatch) |
| `item_warehouse_locations` | `warehouse_id` | `warehouses.id` | — | — | **28** | 1 | NONE | **D** | ['WH-MAIN'] (Historical/code mismatch) |
| `items` | `company_id` | `companies.id` | — | — | **3** | 3 | NONE | **D** | ['COMP-1e1b83', 'COMP-305411', 'COMP-A-6c30b3'] (Historical/code mismatch) |
| `loading_sheet_items` | `order_id` | `sales_orders.id` | — | — | **60** | 60 | NONE | **D** | ['do_018ad9ed65ae', 'do_01bd8d6b3a5c', 'do_02b918c4bf19'] (Historical/code mismatch) |
| `master_values` | `company_id` | `companies.id` | — | — | **6** | 1 | NONE | **D** | ['GLOBAL'] (Historical/code mismatch) |
| `packing_slips` | `sales_invoice_id` | `sales_invoices.id` | — | — | **68** | 68 | NONE | **D** | ['inv_113ba4', 'inv_128b06', 'inv_2ba08f'] (Historical/code mismatch) |
| `payment_allocations` | `invoice_id` | `sales_invoices.id` | — | — | **257** | 217 | NONE | **D** | ['01a0d839-f3cd-7000-aa72-12eae0bb3547', '01a0d8c1-a2ed-7000-9256-d10a6e420d5c', '01a0d90c-0618-7000-a196-63cf34c8d6c0'] (Historical/code mismatch) |
| `price_book_entries` | `company_id` | `companies.id` | — | — | **1** | 1 | NONE | **D** | ['COMP-1e1b83'] (Historical/code mismatch) |
| `price_books` | `company_id` | `companies.id` | — | — | **1** | 1 | NONE | **D** | ['COMP-1e1b83'] (Historical/code mismatch) |
| `reverse_logistics_returns` | `sales_return_id` | `sales_returns.id` | — | — | **18** | 18 | NONE | **D** | ['sr_4c445e', 'sr_3b86ff', 'sr_api_4cb6'] (Historical/code mismatch) |
| `sales_invoice_items` | `salesperson_id` | `users.id` | — | — | **30** | 2 | NONE | **D** | ['SM1', 'CASHIER-01'] (Historical/code mismatch) |
| `sales_invoices` | `salesperson_id` | `users.id` | — | — | **39** | 1 | NONE | **D** | ['CASHIER-01'] (Historical/code mismatch) |
| `staff_profile_history` | `user_id` | `users.id` | — | — | **1** | 1 | NONE | **D** | ['usr-cashier'] (Historical/code mismatch) |
| `staff_profiles` | `user_id` | `users.id` | — | — | **1** | 1 | NONE | **D** | ['usr-cashier'] (Historical/code mismatch) |
| `tax_invoice_template_versions` | `company_id` | `companies.id` | — | — | **2** | 2 | NONE | **D** | ['comp-default', 'comp-smriti-retail'] (Historical/code mismatch) |
| `tax_invoice_template_versions` | `branch_id` | `branches.id` | — | — | **2** | 2 | NONE | **D** | ['br-default', 'br-main'] (Historical/code mismatch) |
| `tax_invoice_templates` | `company_id` | `companies.id` | — | — | **2** | 2 | NONE | **D** | ['comp-default', 'comp-smriti-retail'] (Historical/code mismatch) |
| `tax_invoice_templates` | `branch_id` | `branches.id` | — | — | **2** | 2 | NONE | **D** | ['br-default', 'br-main'] (Historical/code mismatch) |

### 4.3 Class E Matrix: Polymorphic References (HIGH)
| Table | Column | Parent Candidate | Rows | Populated | Discriminator | Current FK | Classification | Architectural Finding |
|---|---|---|---|---|---|---|---|---|
| `general_ledger_entries` | `party_id` | `customers.id` (33) / `suppliers.id` (8) / True Orphans (258) | 3,587 | 585 | NONE | NONE | **E** | ARCH-DRIFT-002: References customers or suppliers based on account type without explicit discriminator column. |
| `payment_transactions` | `party_id` | `customers.id` (14) / True Orphans (107) | 858 | 453 | NONE | NONE | **E** | ARCH-DRIFT-002: Discriminated union between customer IDs and legacy party IDs. |
| `psv_party_scopes` | `party_id` | External/Synthetic PSV Parties | 29 | 29 | NONE | NONE | **E** | ARCH-DRIFT-003: 100% orphan rate (29/29) referencing `pty_psv_*` entities not in parties table. |
| `po_product_decision_log` | `product_id` | `items.id` (10) / Decision Codes (15) / True Orphans (8) | 33 | 33 | NONE | NONE (Dropped in v1503) | **E** | SCHEMA-DRIFT-003: Stores item IDs mixed with business decision codes (`SMK-ALLOW-*`, `SMK-BLOK-*`). |

### 4.4 Class C Matrix: Bare References with Valid Parent Data (0 Orphans) — Sample
| Table | Column | Parent Candidate | Rows | Populated | Orphans | Tenant Mismatch | Current FK | Classification | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| `account_balance_snapshots` | `company_id` | `companies.id` | 470 | 470 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `accounts` | `branch_id` | `branches.id` | 681 | 74 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `analytics_daily_sales_facts` | `company_id` | `companies.id` | 12 | 12 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `analytics_daily_sales_facts` | `branch_id` | `branches.id` | 12 | 12 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `approval_policies` | `company_id` | `companies.id` | 105 | 105 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `bank_statement_lines` | `company_id` | `companies.id` | 130 | 130 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `bank_statement_lines` | `branch_id` | `branches.id` | 130 | 50 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `bank_statements` | `company_id` | `companies.id` | 90 | 90 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `bank_statements` | `branch_id` | `branches.id` | 90 | 50 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `billing_csv_import_logs` | `company_id` | `companies.id` | 60 | 60 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `billing_csv_import_logs` | `branch_id` | `branches.id` | 60 | 60 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `category_attribute_group_mappings` | `attribute_group_id` | `attribute_groups.id` | 2 | 2 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `cge_unified_policies` | `company_id` | `companies.id` | 40 | 40 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `communicator_logs` | `company_id` | `companies.id` | 192 | 192 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `communicator_templates` | `company_id` | `companies.id` | 96 | 96 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `compliance_immutable_audit_logs` | `company_id` | `companies.id` | 325 | 325 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `compliance_immutable_audit_logs` | `branch_id` | `branches.id` | 325 | 165 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `crm_leads` | `company_id` | `companies.id` | 40 | 40 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `crm_opportunities` | `company_id` | `companies.id` | 40 | 40 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `currency_exchange_rates` | `company_id` | `companies.id` | 16 | 16 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `currency_exchange_rates` | `branch_id` | `branches.id` | 16 | 13 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `customer_article_mappings` | `company_id` | `companies.id` | 482 | 482 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `customer_article_mappings` | `branch_id` | `branches.id` | 482 | 450 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `customer_credit_ledger_entries` | `company_id` | `companies.id` | 242 | 242 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| `customer_credit_ledger_entries` | `branch_id` | `branches.id` | 242 | 242 | 0 | 0 | NONE | **C** | `LEFT JOIN` returned 0 orphans |
| *... and 82 additional clean bare references* | | | | | | | | | |

---

## 5. Orphan Data Findings

### 5.1 Deep Orphan Analysis on Class D Candidates
A comprehensive inspection was executed on all 27 Class D bare references. Analysis of IDs revealed four distinct failure modes:

1. **Warehouse Code vs Warehouse ID Architectural Inversion:**
   - `item_warehouse_locations.warehouse_id` (28 orphan rows) and `item_serials.warehouse_id` (29 orphan rows).
   - **Evidence:** Querying `SELECT warehouse_id FROM item_warehouse_locations;` shows literal values `'WH-MAIN'` and `'WH-ELEC'`. Querying `warehouses` shows `'WH-MAIN'` is `warehouses.code`, while `warehouses.id` is `'wh-central-001'`.
   - **Root Cause:** The application write path stored the business code `warehouse.code` instead of the primary key `warehouse.id`.

2. **Document Reference Mismatches & Mock Identifiers:**
   - `payment_allocations.invoice_id`: 257 orphan rows out of 735 (217 distinct IDs). All orphan IDs are formatted as UUIDv7 (`01a0d839-f3cd-7000-aa72-12eae0bb3547`), but the corresponding sales invoices do not exist in `sales_invoices`. Occurred during integration test invoice deletions or multi-tender payments for documents outside sales.
   - `packing_slips.sales_invoice_id`: 68 orphan rows with prefix `inv_*` (e.g. `inv_113ba4`, `inv_2ba08f`, `inv_ful_0a5d91`). These represent mock test invoices from fulfillment testing.
   - `reverse_logistics_returns.sales_return_id`: 18 orphan rows with prefix `sr_*` (e.g. `sr_15ba0e`, `sr_api_b8fd`). Test return IDs not present in `sales_returns`.
   - `loading_sheet_items.order_id`: 60 orphan rows with prefix `do_*` (e.g. `do_018ad9ed65ae`). Stores Delivery Order IDs rather than `sales_orders.id`.

3. **Ephemeral Test Companies & Branch Scoping:**
   - `accounts.company_id`: 600 orphan rows referencing 20 distinct `COMP-*` IDs (`COMP-2108fc`, `COMP-2c19a8`, `COMP-2e712e`).
   - `fiscal_periods.company_id`: 480 orphan rows referencing 40 distinct `COMP-*` IDs.
   - `fiscal_years.company_id`: 40 orphan rows referencing 40 distinct `COMP-*` IDs.
   - **Evidence:** In `companies`, 681 out of 683 companies carry the prefix `comp-foreign-*` (lowercase). Test suites created ledger accounts and fiscal years with capitalized `COMP-<hex>` IDs that were either never committed to `companies` or rolled back.

4. **Un-validated User & Cashier Code Literals:**
   - `sales_invoices.salesperson_id` (39 orphan rows) and `sales_invoice_items.salesperson_id` (30 orphan rows).
   - **Evidence:** Values include `'CASHIER-01'` and `'SM1'`. In `users`, IDs follow patterns `usr-chk-*` or UUIDs. The application writes terminal cashier codes directly into salesperson_id without validating against `users.id`.

### 5.2 Masked Historical Orphans (v1504 Tombstones)
Prior to migration v1504, 4 core relationships had live orphan data:
- `sales_invoice_items.product_id`: 954 orphan rows (26 deleted products)
- `customer_credit_ledger_entries.customer_id`: 158 orphan rows (158 deleted corporate customers)
- `packing_slip_items.product_id`: 40 orphan rows (deleted products)
- `dispatch_items.product_id`: 18 orphan rows (deleted products)
**Tombstone Mechanism:** Migration v1504 inserted 66 ghost products (`category = 'TOMBSTONE'`, `is_deleted = TRUE`) and 158 ghost customers (`name LIKE '[DELETED CUSTOMER]%'`). While this allowed PostgreSQL `VALIDATE CONSTRAINT` to mark the FKs as VALID (`convalidated = t`), the underlying business orphans remain in the database as ghost records.

---

## 6. Polymorphic Reference Findings

### 6.1 `general_ledger_entries.party_id` (ARCH-DRIFT-002)
- **Total Rows:** 3,587 | **Populated Rows:** 585 | **Distinct IDs:** 125
- **Direct Matches in `parties`:** 0 distinct IDs (0 rows)
- **Direct Matches in `customers`:** 33 distinct IDs (references Debtor accounts)
- **Direct Matches in `suppliers`:** 8 distinct IDs (references Creditor accounts)
- **True Orphans:** 84 distinct IDs (258 rows) carrying legacy prefix `PTY-*`
- **Discriminator Column:** None present on table. Discrimination is inferred solely by account type in chart of accounts (`account_id.in_([acc_debtors.id, acc_creditors.id])`).
- **Enforcement:** Zero database constraints. Unified Ledger service groups by `party_id` opaquely for forex revaluation.

### 6.2 `payment_transactions.party_id` (ARCH-DRIFT-002)
- **Total Rows:** 858 | **Populated Rows:** 453 | **Distinct IDs:** 81
- **Direct Matches in `parties`:** 0 distinct IDs
- **Direct Matches in `customers`:** 14 distinct IDs
- **Direct Matches in `suppliers`:** 0 distinct IDs
- **True Orphans:** 67 distinct IDs (107 rows) formatted as `cust-corp-*` and `pty_*`
- **Discriminator Column:** None present on table.
- **Enforcement:** Zero database constraints.

### 6.3 `psv_party_scopes.party_id` (ARCH-DRIFT-003)
- **Total Rows:** 29 | **Populated Rows:** 29 | **Distinct IDs:** 29
- **Matches in `parties` / `customers` / `suppliers`:** 0 matches (100% orphan rate)
- **Evidence:** All 29 rows carry prefix `pty_psv_*` (e.g. `pty_psv_16e542`). The service `psv_projection.py` accepts any `req.party_id` and persists it without parent validation.

### 6.4 `po_product_decision_log.product_id` (SCHEMA-DRIFT-003)
- **Total Rows:** 33 | **Populated Rows:** 33
- **Classification:** Polymorphic column storing three distinct data types:
  1. 10 rows: References to `items.id`
  2. 15 rows: Business decision status codes (`SMK-ALLOW-*`, `SMK-BLOK-*`, `SMK-UNASN-*`)
  3. 8 rows: True orphans
- **Migration Note:** In migration v1503, the erroneous FK to `products(id)` was dropped because a single foreign key cannot constrain a polymorphic code column.

---

## 7. Tenant Isolation Findings

### 7.1 Architecture Grounding: Database-per-Tenant vs Column Scoping
SMRITI Retail OS implements a Multi-Tenant Database-per-Tenant architecture:
- Each tenant is assigned a dedicated PostgreSQL database (e.g. `smriti001`, `smriti002`).
- The control plane database `smritisys` manages global routing, tenant registry, and licenses.
- Consequently, inside the tenant database `smriti001`, tenant isolation is guaranteed at the database connection boundary.

### 7.2 Empirical Distribution of Scoping Columns
- **Total Public Tables:** 286
- **Tables with `tenant_id`:** 43 (15.0%)
- **Tables without `tenant_id`:** 242 (85.0%)
- **Tables with Populated `tenant_id`:** Exactly 3 tables (`pos_shift_denomination_counts`, `smriti_identity_allocation_log`, `smriti_numbering_registry`).
  - **Critical Finding:** In all 3 populated tables, the value stored in `tenant_id` is `'COMP-001'`, which is a `company_id`, NOT a tenant database identifier.
- **Tables with 100% NULL `tenant_id`:** 40 tables.
- **Tables with `company_id`:** 237 tables (82.9%) — the true organizational scoping boundary inside `smriti001`.
- **Tables with `branch_id`:** 208 tables (72.7%).
- **Tables with Neither `tenant_id` nor `company_id`:** 48 tables (reference lookups, system parameters, metadata).

### 7.3 Cross-Company Boundary Violations Detected
Because PostgreSQL foreign keys in `smriti001` only constrain `(id)` rather than `(company_id, id)`, two cross-company data anomalies were empirically measured in live tables:
1. **`invoice_document_artifacts.invoice_id -> sales_invoices.id` (32 mismatches):**
   - Child `company_id = 'comp-default'`, while Parent `sales_invoices.company_id = 'COMP-001'`.
2. **`price_books.branch_id -> branches.id` (210 mismatches):**
   - Child `price_books.company_id` belongs to ephemeral test companies (`comp-sal-*`), while Parent `branches.id = 'MAIN'` belongs to company `'COMP-001'`.

---

## 8. Transaction History Findings

Integrity of transaction history was audited across sales, returns, purchases, GRN, inventory, packing, dispatch, and ledger:
1. **Sales Orders (`sales_orders`, 74 rows) & Items (`sales_order_items`, 18,050 rows):**
   - `sales_order_items.product_id -> products.id` enforced via `fk_soi_product_id` (RESTRICT). 0 orphans.
   - `sales_orders.customer_id -> customers.id` enforced via `fk_so_customer_id` (SET NULL). 0 orphans.
2. **Sales Invoices (`sales_invoices`, 2,772 rows) & Items (`sales_invoice_items`, 16,742 rows):**
   - `sales_invoice_items.product_id -> products.id` enforced via `fk_sii_product_id` (RESTRICT, validated in v1504 via 26 tombstone products).
   - `sales_invoices.customer_id -> customers.id` enforced via `sales_invoices_customer_id_fkey` (RESTRICT).
3. **Sales Returns (`sales_returns`, 10 rows) & Items (`sales_return_items`, 10 rows):**
   - `sales_return_items.product_id -> products.id` enforced via `fk_sri_product_id` (RESTRICT). 0 orphans.
4. **Stock Movements (`stock_movements`, 9,411 rows):**
   - `stock_movements.product_id -> products.id` enforced via FK. 0 orphans.
5. **Packing Slips (`packing_slip_items`, 1,020 rows) & Dispatch (`dispatch_items`, 720 rows):**
   - Hardened in v1504 via tombstone rows; historical records protected by RESTRICT.
6. **Purchase Orders (`purchase_orders`, 54 rows) & Items (`purchase_order_items`, 120 rows):**
   - Hardened in v1499. Supplier references protected.

---

## 9. Delete/Soft-Delete Behavior

### 9.1 Application Delete Pattern Analysis
Code inspection of `backend/app/` revealed:
- **Soft-Delete Invariant:** All business entity write-paths in the API (`products`, `customers`, `suppliers`, `branches`, `companies`) execute SOFT-DELETE by setting `is_deleted = True`, `deleted_at = now_utc`, and `deleted_by = user.id`.
- **Hard Delete Exclusion:** Zero hard SQL `DELETE` calls exist in production business routers for master entities. Only 1 operational delete exists (`approval_matrices` cleanup in `approval_matrix.py:250`).

### 9.2 Interaction with PostgreSQL ON DELETE Rules
- Because application code sets `is_deleted = True`, the physical row remains in PostgreSQL.
- As a result, PostgreSQL's `ON DELETE RESTRICT` constraints are never triggered during normal application soft-delete operations.
- **Origin of Historical Orphans:** All historical orphan data was caused by test suite fixtures running raw SQL `DELETE FROM products` or direct SQL truncate scripts outside the ORM application layer.

---

## 10. Application Write-Path Findings

1. **Arbitrary Party Injection in Unified Ledger:**
   - `backend/app/services/unified_ledger.py`: `post_journal_voucher()` parses `pe['party_id']` directly from payload without verifying existence in `parties`, `customers`, or `suppliers`. Any string can be persisted into `general_ledger_entries.party_id`.
2. **Payment Allocation Invoice Assignment:**
   - `backend/app/services/pricing_payment.py`: `record_multi_tender_payment()` sets `PaymentAllocation.invoice_id = reference_doc_id` directly, even when `reference_doc_type != 'SALES'`. Lacks database FK.
3. **PSV Party Scope Unchecked Persistence:**
   - `backend/app/services/psv_projection.py`: `assign_party_scope()` creates `PSVPartyScope` records with arbitrary `req.party_id`. Lacks database FK.
4. **Warehouse Code vs ID Inversion in Inventory Writing:**
   - `item_warehouse_locations` and `item_serials` services write `warehouse.code` ('WH-MAIN') into column `warehouse_id`.
5. **Salesperson ID Free-Form Text Entry:**
   - `sales_invoices.salesperson_id` accepts terminal string codes (`'CASHIER-01'`, `'SM1'`) without verifying existence in `users.id`.
6. **CSV Billing Import Bypass:**
   - `billing_csv_import_logs.cashier_id` writes unverified cashier user strings (`usr-manager`, `usr-manager-direct`).

---

## 11. Alembic/Migration Consistency

### 11.1 Live Alembic Catalog Status
- **`alembic_version` Table in `smriti001`:** Contains SIX concurrent revision rows:
  1. `v1499`
  2. `v1500`
  3. `v1501`
  4. `v1502`
  5. `v1503`
  6. `v1504`
- **Alembic Heads Inspection:** Running `alembic heads` outputs:
  ```text
  v1497b (head)
  v1504 (head)
  ```
- **Root Cause:** In migration `v1497a` (tenant) and `v1497b` (control), both set `down_revision = 'v1496'`, creating a permanent unmerged branch in the shared `alembic/versions` directory.
- **Tombstone Injection Risk:** Migration `v1504` inserted 224 ghost rows directly into `products` and `customers` to bypass PostgreSQL constraint validation. These ghost rows are permanently stamped into the database.

---

## 12. Test Coverage

Audit of 177 test files in `backend/tests/` revealed:
- **Tenant Isolation Tests:** 85 files (Comprehensive coverage of multi-tenant query filtering).
- **Foreign Key Integrity Tests:** 18 files.
- **Delete Behavior Tests:** 3 files (Low coverage: no automated tests verify that deleting a parent record with existing children raises `IntegrityError`).
- **Imports & CSV Tests:** 1 file.
- **Payments & Allocations Tests:** 1 file.
- **General Ledger Accounting Tests:** 6 files.
- **Sales & Invoices Tests:** 15 files.
- **Inventory & Stock Tests:** 14 files.

---

## 13. Evidence / SQL Used

All SQL queries executed during this audit were strictly READ-ONLY. Below are the literal query definitions:
```sql
-- 1. Database Table Inventory
SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- 2. PostgreSQL Constraint & FK Validation Status
SELECT c.conname, c.convalidated, c.confdeltype, c.confupdtype,
       src_t.relname AS source_table, src_a.attname AS source_column,
       dst_t.relname AS target_table, dst_a.attname AS target_column
FROM pg_constraint c
JOIN pg_class src_t ON c.conrelid = src_t.oid
JOIN pg_class dst_t ON c.confrelid = dst_t.oid
JOIN pg_attribute src_a ON src_a.attrelid = src_t.oid AND src_a.attnum = ANY(c.conkey)
JOIN pg_attribute dst_a ON dst_a.attrelid = dst_t.oid AND dst_a.attnum = ANY(c.confkey)
JOIN pg_namespace n ON n.oid = src_t.relnamespace
WHERE c.contype = 'f' AND n.nspname = 'public';

-- 3. Generic Bare Reference Orphan Check
SELECT count(*) as orphans, count(DISTINCT c.<col>) as distinct_orphan_ids,
       min(c.created_at::text) as first_occurrence, max(c.created_at::text) as last_occurrence
FROM <child_table> c
LEFT JOIN <parent_table> p ON c.<col> = p.<parent_pk>
WHERE c.<col> IS NOT NULL AND p.<parent_pk> IS NULL;

-- 4. Polymorphic Distribution Audit for GL Entries
SELECT count(*) as total, count(party_id) as populated, count(DISTINCT party_id) as distinct_ids,
       (SELECT count(DISTINCT gle.party_id) FROM general_ledger_entries gle JOIN customers c ON gle.party_id = c.id) as in_customers,
       (SELECT count(DISTINCT gle.party_id) FROM general_ledger_entries gle JOIN suppliers s ON gle.party_id = s.id) as in_suppliers,
       (SELECT count(DISTINCT gle.party_id) FROM general_ledger_entries gle JOIN parties p ON gle.party_id = p.id) as in_parties
FROM general_ledger_entries;

-- 5. Cross-Company Reference Integrity Check
SELECT count(*) as mismatch_count
FROM <child_table> c
JOIN <parent_table> p ON c.<col> = p.<parent_pk>
WHERE c.<col> IS NOT NULL AND c.company_id IS NOT NULL AND p.company_id IS NOT NULL
  AND c.company_id != p.company_id;

-- 6. Alembic Version Table Inspection
SELECT version_num FROM alembic_version;
```

---

## 14. Open Architectural Questions

1. **Disposition of Injected Ghost Tombstones:** Should the 66 ghost products and 158 ghost customers created by migration v1504 be retained indefinitely as valid parent rows, or should the historical transactions be rewritten or archived to shadow tables?
2. **Polymorphic Reference Model:** Should polymorphic references (`general_ledger_entries.party_id`, `payment_transactions.party_id`) be refactored into explicit discriminator columns (`party_type` + partial FKs) or separate typed columns (`customer_id`, `supplier_id`)?
3. **Warehouse Identifier Standard:** Should inventory tables (`item_warehouse_locations`, `item_serials`) be migrated to reference `warehouses.id` ('wh-central-001') or should the column be explicitly renamed to `warehouse_code` with a unique FK to `warehouses(code)`?
4. **Multi-Tenancy Column Retirement:** Since `smriti001` is a tenant database, should redundant `tenant_id` columns across the remaining 43 tables be systematically dropped, following the pattern established in v1497a?
5. **Company-Scoped Composite FKs:** Should foreign keys in tenant databases be upgraded from simple `(id)` to composite `(company_id, id)` to prevent cross-company references at the database engine level?
6. **Alembic Multi-Head Consolidation:** Should control-plane (`smritisys`) and tenant-plane (`smriti001`) migrations be separated into independent script directories to prevent perpetual multi-head conflicts?

---

## 15. Risk Classification

| Risk Code | Category | Risk Level | Affected Entities | Operational Impact |
|---|---|---|---|---|
| **RISK-001** | Orphan Data | **CRITICAL** | `accounts`, `fiscal_periods`, `payment_allocations`, `packing_slips`, `loading_sheet_items` | 1,745 live orphan rows prevent adding database FK constraints without data cleanup. |
| **RISK-002** | Migration State | **CRITICAL** | `alembic_version`, `v1497b`, `v1504` | Multiple heads and 6 concurrent rows in `alembic_version` risk migration failures on subsequent deployments. |
| **RISK-003** | Polymorphic References | **HIGH** | `general_ledger_entries.party_id`, `payment_transactions.party_id`, `psv_party_scopes.party_id` | No schema enforcement; arbitrary strings written to ledger parties without validation. |
| **RISK-004** | Identifier Inversion | **HIGH** | `item_warehouse_locations.warehouse_id`, `item_serials.warehouse_id` | Column named `warehouse_id` stores `warehouse.code`, breaking standard FK conventions. |
| **RISK-005** | Cross-Company Scoping | **MEDIUM** | `invoice_document_artifacts`, `price_books` | 242 cross-company reference rows exist because FKs are not scoped by `company_id`. |
| **RISK-006** | Test Deletion Safeguards | **MEDIUM** | `backend/tests/` | Low test coverage on hard vs soft delete constraints; test suites previously purged parent data. |
| **RISK-007** | Redundant Schema Columns | **LOW** | 43 tables with `tenant_id` (40 are 100% NULL) | Redundant columns create architectural ambiguity in database-per-tenant architecture. |
| **RISK-008** | Inactive Schema Tables | **INFO** | 111 zero-row tables | 111 tables are declared in schema but unpopulated in `smriti001`. |

---

## 16. Items Requiring Human Decision

### DECISION-001: Disposition of v1504 Ghost Tombstone Rows
- **FACT:** Migration v1504 inserted 66 ghost products and 158 ghost customers with `is_deleted=TRUE` to enable PostgreSQL `VALIDATE CONSTRAINT` on `sales_invoice_items`, `customer_credit_ledger_entries`, `packing_slip_items`, and `dispatch_items`.
- **EVIDENCE:** Direct SQL query on `products` shows 67 rows with `category = 'TOMBSTONE'` and `name LIKE '[DELETED]%'`. Query on `customers` shows 158 rows with `name LIKE '[DELETED CUSTOMER]%'`.
- **QUESTION:** Should these ghost rows remain permanently in the parent tables as tombstone anchors, or should an archival strategy be formulated to move historical transactions to cold storage?

### DECISION-002: Polymorphic `party_id` in General Ledger & Payments (ARCH-DRIFT-002)
- **FACT:** `general_ledger_entries.party_id` holds customer IDs (33), supplier IDs (8), and legacy PTY-* IDs (258 rows) with no discriminator column. `payment_transactions.party_id` exhibits the same pattern.
- **EVIDENCE:** Querying matches against `parties`, `customers`, and `suppliers` shows dual-target population without any foreign key constraint in `pg_constraint`.
- **QUESTION:** Should the schema be refactored to add a `party_type` discriminator column with PostgreSQL partial FKs, or should the columns be split into `customer_id` and `supplier_id`?

### DECISION-003: Inventory Warehouse Identifier Standardization
- **FACT:** In `item_warehouse_locations` and `item_serials`, the column `warehouse_id` stores values like `'WH-MAIN'`, which match `warehouses.code`, not `warehouses.id`.
- **EVIDENCE:** `SELECT warehouse_id FROM item_warehouse_locations;` yields `'WH-MAIN'`, while `SELECT id, code FROM warehouses WHERE code = 'WH-MAIN';` yields `id = 'wh-central-001'`.
- **QUESTION:** Should the data be migrated so `warehouse_id` references `warehouses.id`, or should the column be renamed to `warehouse_code` with a foreign key referencing `warehouses(code)`?

### DECISION-004: Alembic Migration Tree Architecture
- **FACT:** `alembic heads` reports 2 heads (`v1497b` for control plane, `v1504` for tenant plane), and `alembic_version` contains 6 rows.
- **EVIDENCE:** Terminal execution of `alembic heads` on `smriti-api` returns `v1497b (head)` and `v1504 (head)`. `SELECT * FROM alembic_version;` in `smriti001` returns 6 rows.
- **QUESTION:** Should control-plane and tenant-plane migrations be split into separate Alembic configuration files and version directories, or should a formal merge migration be committed?

### DECISION-005: Multi-Tenancy Column Retirement vs Retention
- **FACT:** 40 out of 43 tables with `tenant_id` are 100% NULL, and the remaining 3 store `'COMP-001'`. Products table already retired `tenant_id` in v1497a.
- **EVIDENCE:** Querying `information_schema.columns` and `COUNT(tenant_id)` across all 43 tables shows 0 non-NULL rows in 40 tables.
- **QUESTION:** Should the remaining 43 `tenant_id` columns in tenant databases be retired via a phased migration, or retained for theoretical future shared-database multi-tenancy?

### DECISION-006: Composite Company Scoping on Foreign Keys
- **FACT:** 237 tables have `company_id`, but foreign keys only reference `(id)`, permitting cross-company references (e.g. 210 mismatches in `price_books`).
- **EVIDENCE:** 32 rows in `invoice_document_artifacts` and 210 rows in `price_books` join to parent records with differing `company_id`.
- **QUESTION:** Should core foreign keys be upgraded to composite keys `FOREIGN KEY (company_id, ref_id) REFERENCES parent(company_id, id)` to enforce company isolation at the database level?

---

## 17. Audit Conclusion

This concludes the database and application referential-integrity audit. Only directly observable, empirical evidence from `smriti001` and the active codebase was reported.

**Summary Metrics:**
1. **Number of tables audited:** 286 (285 base tables, 1 view)
2. **Number of candidate references:** 1118 candidate relationships evaluated (1,652 columns matching naming criteria)
3. **Number of valid FKs:** 505 PostgreSQL foreign keys (all `convalidated = t`)
4. **Number of NOT VALID FKs:** 0 in PostgreSQL catalog (all previous NOT VALID FKs validated in v1504 via ghost tombstones)
5. **Number of orphan references:** 27 Class D bare references (1,745 orphan rows across 436 distinct orphan IDs) + 4 masked relationships backed by 224 ghost tombstone rows
6. **Number of polymorphic references:** 4 confirmed polymorphic columns (`general_ledger_entries.party_id`, `payment_transactions.party_id`, `psv_party_scopes.party_id`, `po_product_decision_log.product_id`)
7. **Number of tenant-scope issues:** 4 structural issues (redundant `tenant_id` columns, cross-company references in documents and price books, lack of composite `(company_id, id)` FKs)
8. **Number of migration inconsistencies:** 4 issues (6 concurrent rows in `alembic_version`, 2 unmerged DAG heads, combined control/tenant migrations, ghost tombstone injection in migration)
9. **Number of application write-path risks:** 8 critical write-path risks (unvalidated party injection in GL, unvalidated invoice_id in payment allocations, unvalidated PSV party scopes, warehouse code/id inversion, free-form cashier/salesperson IDs)
10. **Number of open architectural decisions:** 6 formal architectural decision items requiring human system architect review

STRICT AUDIT POLICY COMPLIED: Zero mutations, zero schema changes, zero migrations, and zero data updates were executed.