<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 6.40.0
  * Created    : 2026-09-29
  * Modified   : 2026-09-29
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal Core Architecture
-->

# Implementation Plan: Phase 1 — Master Data Integrity & Referential Safeguards

**Plan Version:** v1.0.0  
**Status:** Draft — Awaiting Human Architecture Approval  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  
**Classification:** Core Business Architecture & Data Governance  
**Target Environment:** SMRITI Retail OS (`smriti-api` / `smriti001` on PostgreSQL 15)  

---

## Epistemic Legend & Statement Classification

Per SMRITI Governance Rule 9 and implementation guidelines, every statement, finding, and specification in this plan is explicitly tagged with one of four epistemic states:

- **[VERIFIED]**: Directly observed, proven, and grounded in literal source code, AST, or PostgreSQL catalog queries executed on live environment `smriti001`.
- **[INFERRED]**: Deductions derived from verifiable code paths, architectural design conventions, or standard operational patterns.
- **[PROPOSED]**: Architectural recommendations, new services, schemas, or migrations formulated for implementation.
- **[UNKNOWN]**: Items requiring further human architectural determination or runtime stress characterization.

---

## 1. Objective

- **[VERIFIED]** A system-wide architectural audit of database `smriti001` revealed critical referential vulnerabilities: master lookup values, product SKUs, customers, suppliers, warehouses, and branches can be soft-deleted while actively referenced by transactional history or live inventory.
- **[PROPOSED]** The objective of **Phase 1: Master Data Integrity** is to establish an unbreachable, production-safe referential protection framework across SMRITI Retail OS.
- **[PROPOSED]** Phase 1 delivers four foundational integrity pillars:
  1. **Generic Reference Guard / Reference Shield:** A universal dependency checking engine preventing deletion or retirement of master lookup values and master entities actively referenced by child entities or operational transactions, returning standard `HTTP 409 Conflict`.
  2. **Active Balance Pre-Flight Guards:** Authoritative ledger-driven pre-flight checks blocking the retirement/deletion of products with on-hand or reserved stock, customers with outstanding credit balances or open orders, suppliers with active payables or pending POs/GRNs, warehouses with inventory, and branches with open POS shifts.
  3. **`master_values` Uniqueness Enforcement:** Partial unique index preventing duplicate lookup codes within tenant scopes across case variations, whitespace, and deleted states.
  4. **Duplicate Data Remediation Strategy:** Surgical, non-destructive resolution of existing duplicate lookup records (`FOOTWEAR_EU`) prior to index creation.
  5. **Governed Alembic DAG Alignment:** Seamless migration sequence anchored to the canonical tenant head (`v1504`) without DAG bifurcations.
  6. **Regression & Integrity Verification:** Comprehensive automated test suite certifying tenant isolation, concurrency row locks, and historical audit reporting.

---

## 2. Scope

- **[VERIFIED]** The Phase 1 audit and design covers the following subsystems:
  1. **Generic Master Lookups:** `master_types` (17 configured types), `master_values` (29 populated records).
  2. **Catalog & Entity Masters:** `products` (2,024 rows), `items` (788 rows), `item_variants` (817 rows).
  3. **Commercial Parties:** `customers` (1,078 rows), `suppliers` (58 rows).
  4. **Organizational Hierarchy:** `companies` (683 rows), `branches` (1,266 rows), `warehouses` (122 rows).
  5. **Authoritative Transaction Ledgers & State:**
     - Inventory: `product_batch_stocks`, `stock_movements`, `psv_stock_balances`.
     - Sales & CRM: `customer_credit_ledger_entries`, `sales_invoices`, `sales_orders`.
     - Procurement: `purchase_orders`, `purchase_receipts` (GRN), `supplier_payments`.
     - POS Operations: `shifts`, `cash_registers`.
  6. **Backend Routers & Services:**
     - `backend/app/api/v1/master_lookup.py`
     - `backend/app/api/v1/inventory.py`
     - `backend/app/api/v1/crm.py`
     - `backend/app/api/v1/purchase.py`
     - `backend/app/api/v1/masters.py`
     - `backend/app/services/stock_synchronizer.py`
     - Database triggers: `trg_master_value_reference_guard` (`prevent_referenced_master_value_retirement`).

---

## 3. Non-Goals

- **[VERIFIED]** The following areas are strictly out of scope for Phase 1:
  1. **No Code Mutations in Audit Phase:** Zero application code, database records, or Alembic migrations are modified during this audit phase.
  2. **Phase 2 & Phase 3 Work Excluded:** No canonical sales writer rewiring, universal identity refactoring, or Stage 4 event outbox modifications.
  3. **No Hard SQL Deletions:** SMRITI platform policy strictly prohibits hard SQL `DELETE` on transactional or master entities. All operations are lifecycle transitions (deactivation, soft deletion, tombstoning).
  4. **No Automated Multi-Head DAG Merge:** Alembic heads `v1497b` and `v1504` will not be combined arbitrarily without explicit human architecture sign-off.
  5. **No Static Reference Data Modification:** Read-only statutory tables (`uoms_ref`, `hsn_sac_codes_ref`, `tax_references_ref`) remain untouched.

---

## 4. Current-State Evidence

- **[VERIFIED]** Live database inspection of PostgreSQL database `smriti001` (container `smriti-db`, host port 2781) and AST inspection of `backend/app/` produced the following empirical facts:
  1. **Selective Reference Guard Gap:** In `backend/app/api/v1/master_lookup.py` (lines 184–263) and database trigger `prevent_referenced_master_value_retirement()`, active reference checks exist ONLY for `style_article` and `vendor_code` (plus parent-child hierarchy). For the other 15 types (`brand`, `category`, `color`, `size`, `department`, `designation`, `expense_category`, `payment_mode`, `bank`, `currency`, `color_group`, `size_group`, `subcategory`, `item_attribute`, `PO_CROSS_VENDOR_REASON`), the function unconditionally returns `None`.
  2. **Active Brand & Category Consumption:**
     - `products.brand`: 527 active rows across 6 distinct brands; 516 rows directly match `master_values`.
     - `items.brand`: 300 active rows across 15 distinct brands; 219 rows match `master_values`.
     - `products.category`: 1,953 active rows across 19 distinct categories; 1,465 rows match `master_values`.
     - `items.category`: 688 active rows across 14 distinct categories; 573 rows match `master_values`.
     - Soft-deleting a brand (e.g. `'Beanstalk'`) or category (e.g. `'Apparel'`) succeeds immediately without warning, leaving active catalog items referencing deleted master metadata.
  3. **Unchecked Product Deletion:** `backend/app/api/v1/inventory.py:delete_product()` sets `is_deleted = True` via `ProductRepository.soft_delete()` without inspecting `product_batch_stocks` or `stock_movements`. An operator can delete a SKU having 500 units on hand in a central warehouse.
  4. **Unchecked Customer Deletion:** `backend/app/services/crm.py:delete_customer()` marks `is_deleted = True` without checking `customer_credit_ledger_entries` or `sales_invoices.balance_amount`.
  5. **Unchecked Supplier Deletion:** `backend/app/services/purchase.py:delete_supplier()` marks `is_deleted = True` without verifying open `purchase_orders` or unbilled `purchase_receipts`.
  6. **Unchecked Organization Deletion:** `backend/app/api/v1/masters.py:delete_master()` marks companies, branches, or warehouses as `is_deleted = True` without verifying downstream dependencies (open shifts, active stock, subordinate branches).
  7. **Missing Uniqueness Constraint:** `\d master_values` confirms only `master_values_pkey` on `(id)` exists. There is no unique index on `(master_type_id, code)` or `(master_type_id, code, company_id)`.
  8. **Live Duplicate Record Found:** Exactly one duplicate pair exists in `master_values`:
     - Code: `FOOTWEAR_EU` | Type: `size_group` | Name: `Footwear EU Sizes`
     - Row 1: `id` = `e44cd008-01d1-48da-b57b-9dda1d1c28eb` (created `2026-09-12 19:34:46`)
     - Row 2: `id` = `b2d10a23-9279-4760-a8f0-02eeb3bfed97` (created `2026-09-12 21:05:49`)
     - Child References: Zero (0) rows in any public table reference either UUID.
  9. **Alembic Multi-Head State:** `alembic heads` reports 2 unmerged heads: `v1497b (head)` (control-plane migration) and `v1504 (head)` (tenant-plane migration). `alembic_version` contains 6 concurrent rows.

---

## 5. Schema Findings & Ground Truth Evidence

- **[VERIFIED]** Detailed verification of schema columns and data types across `smriti001`:

### 5.1 System Lookup Tables

| Table | Column | Data Type | Nullable | FK Constraint / Target | Business Meaning |
|---|---|---|:---:|---|---|
| `master_types` | `id` | `uuid` | NO | PRIMARY KEY | Lookup type surrogate identifier |
| `master_types` | `code` | `varchar(50)` | NO | UNIQUE (`master_types_code_key`) | Lookup type business key (`brand`, `category`) |
| `master_types` | `depends_on` | `varchar(50)` | YES | FK -> `master_types(code)` | Hierarchical type dependency |
| `master_values` | `id` | `uuid` | NO | PRIMARY KEY | Lookup value surrogate identifier |
| `master_values` | `master_type_id` | `uuid` | NO | FK -> `master_types(id)` | Parent lookup type |
| `master_values` | `code` | `varchar(50)` | NO | None (NO UNIQUE INDEX) | Lookup business code (`SMRITI`, `APPAREL`) |
| `master_values` | `name` | `varchar(255)` | NO | None | Display label |
| `master_values` | `parent_value_id`| `uuid` | YES | FK -> `master_values(id)` | Parent lookup value |
| `master_values` | `company_id` | `varchar(50)` | YES | None (Indexed) | Scoping: `GLOBAL` or `COMP-*` or `NULL` |
| `master_values` | `branch_id` | `varchar(50)` | YES | None (Indexed) | Branch scoping |
| `master_values` | `active` | `boolean` | NO | None | Active toggle (Note naming drift: `active`) |
| `master_values` | `is_deleted` | `boolean` | YES | None | Soft delete flag |

### 5.2 Product & Item Master Tables

| Table | Column | Data Type | Nullable | FK Constraint / Target | Actual Population Finding |
|---|---|---|:---:|---|---|
| `products` | `id` | `varchar(50)` | NO | PRIMARY KEY | Surrogate PK (e.g. `PRD-001`, `0191...`) |
| `products` | `brand` | `varchar(100)` | YES | **NO FK** | Stores brand name/code literal (527 populated) |
| `products` | `category` | `varchar(100)` | NO | **NO FK** | Stores category name/code literal (1,953 populated) |
| `products` | `category_code` | `varchar(50)` | YES | **NO FK** | **100% NULL across all 2,024 rows** |
| `products` | `color` | `varchar(50)` | YES | **NO FK** | Color string literal (471 populated) |
| `products` | `size` | `varchar(50)` | YES | **NO FK** | Size string literal (471 populated) |
| `products` | `style_code` | `varchar(100)` | YES | **NO FK** | Style code literal (471 populated) |
| `products` | `vendor_code` | `varchar(100)` | YES | **NO FK** | Vendor code literal (1 populated) |
| `products` | `stock` | `integer` | NO | **Materialized Cache** | Cached aggregate from `product_batch_stocks` |
| `products` | `reserved_stock`| `numeric(12,4)`| NO | **Materialized Cache** | Reserved quantity from active orders |
| `items` | `brand` | `varchar(100)` | YES | **NO FK** | Brand literal (300 populated) |
| `items` | `category` | `varchar(100)` | YES | **NO FK** | Category literal (688 populated) |
| `items` | `category_code` | `varchar(50)` | YES | **NO FK** | **100% NULL across all 788 rows** |
| `items` | `department` | `varchar(100)` | YES | **NO FK** | Department literal (0 populated in items) |
| `item_variants` | `color` | `varchar(50)` | YES | **NO FK** | Color string literal (817 populated) |
| `item_variants` | `size` | `varchar(50)` | YES | **NO FK** | Size string literal (789 populated) |

- **[VERIFIED]** **Critical Schema Invariant:** Consuming product tables (`products`, `items`, `item_variants`) do NOT use surrogate foreign keys referencing `master_values(id)`. Instead, they reference natural string codes/names (`products.brand`, `products.category`). Therefore, PostgreSQL `ON DELETE RESTRICT` constraints cannot be attached to `master_values(id)`. Referential integrity must be enforced via an **application Reference Shield and database validation trigger**.

---

## 6. Reference Dependency Matrix (Reference Shield)

- **[VERIFIED]** Based on exhaustive database inspection, below is the complete dependency matrix for all 17 master lookup types and core master entities:

| Master Type | Consuming Table | Consuming Column | Reference Type | Tenant Scope | Active/Deleted Filter | Safe Delete Condition |
|---|---|---|---|---|---|---|
| `brand` | `products` | `brand` | Natural string (`code`/`name`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `brand` | `items` | `brand` | Natural string (`code`/`name`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `brand` | `variant_templates` | `brand` | Natural string (`code`/`name`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `category` | `products` | `category` | Natural string (`code`/`name`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `category` | `items` | `category` | Natural string (`code`/`name`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `category` | `variant_templates` | `category` | Natural string (`code`/`name`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `color` | `products` | `color` | Natural string (`code`/`name`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `color` | `item_variants` | `color` | Natural string (`code`/`name`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `color` | `sales_invoice_lines`| `color` | Natural string (`code`/`name`) | `company_id` | Document active | Historical reference |
| `size` | `products` | `size` | Natural string (`code`/`name`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `size` | `item_variants` | `size` | Natural string (`code`/`name`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `color_group`| `attribute_groups` | `color_group_id` | Natural string (`code`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `size_group` | `attribute_groups` | `size_group_id` | Natural string (`code`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `size_group` | `products` | `size_scale_id` | Natural string (`code`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `department` | `users` | `department` | Natural string (`code`/`name`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `department` | `staff_profiles` | `department` | Natural string (`code`/`name`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `designation`| `users` | `designation` | Natural string (`code`/`name`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `designation`| `staff_profiles` | `designation` | Natural string (`code`/`name`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `payment_mode`| `sales_invoices` | `payment_mode` | Natural string (`code`) | `company_id` | Posted invoices | `COUNT(*) = 0` |
| `currency` | `accounts` | `currency` | ISO Currency code (`code`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `style_article`| `products` | `style_code` | Natural code (`code`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `style_article`| `sales_order_items` | `article_no` / `vendor_style`| Natural code (`code`) | `company_id` | Order active | `COUNT(*) = 0` |
| `style_article`| `variant_templates` | `master_value_id`| Surrogate UUID (`id`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `vendor_code`| `products` | `vendor_code` | Natural code (`code`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `vendor_code`| `sales_orders` | `vendor_code` | Natural code (`code`) | `company_id` | Order active | `COUNT(*) = 0` |
| `vendor_code`| `variant_templates` | `vendor_code` | Natural code (`code`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |
| `PO_CROSS_VENDOR_REASON`| `po_product_decision_log`| `approval_reason_code`| Code string (`code`)| `company_id`| Decision log active | `COUNT(*) = 0` |
| *Parent Value*| `master_values` | `parent_value_id`| Surrogate UUID (`id`) | `company_id` | `is_deleted = false` | `COUNT(*) = 0` |

---

## 7. Balance Dependency Matrix (Pre-Flight Balance Guards)

- **[VERIFIED]** Per SMRITI Ledger Governance, transactional state must be calculated directly from authoritative ledgers rather than cached master fields:

| Master Entity | Target Table | Authoritative Ledger / Source of Truth | Authoritative Calculation Formula | Blocking Pre-Flight Condition | HTTP Error |
|---|---|---|---|---|:---:|
| **Product** | `products` | 1. `product_batch_stocks`<br>2. `stock_movements`<br>3. `sales_order_reservations` | - Batch SKUs: $\sum (\text{quantity} - \text{damaged\_quantity})$<br>- Non-Batch: $\sum \text{inflow} - \sum \text{outflow}$<br>- Reserved: $\sum \text{reserved\_qty}$ | 1. On-hand stock $> 0$<br>2. Reserved stock $> 0$<br>3. Open PO items exist | `409 Conflict` |
| **Customer** | `customers` | 1. `customer_credit_ledger_entries`<br>2. `sales_invoices`<br>3. `sales_orders` | - Running balance: Latest `balance_after`<br>- Unpaid receivables: $\sum \text{balance\_amount}$<br>- Open orders: Status $\in (\text{'OPEN'}, \text{'CONFIRMED'})$ | 1. Credit balance $\neq 0$<br>2. Unpaid invoice $> 0$<br>3. Open sales orders exist | `409 Conflict` |
| **Supplier** | `suppliers` | 1. `purchase_orders`<br>2. `purchase_receipts` (GRN)<br>3. `supplier_payments` / AP Ledger | - Open PO value: $\sum \text{grand\_total}$ for status $\in (\text{'DRAFT'}, \text{'CONFIRMED'}, \text{'PARTIAL'})$<br>- Pending GRN: Status $\notin (\text{'CANCELLED'}, \text{'BILLED'})$<br>- Payables: Outstanding ledger balance | 1. Open POs exist<br>2. Unbilled GRNs exist<br>3. Net payables balance $\neq 0$ | `409 Conflict` |
| **Warehouse** | `warehouses` | 1. `product_batch_stocks`<br>2. `stock_movements`<br>3. `stock_transfers`<br>4. `stock_audits` | - Warehouse on-hand: $\sum \text{quantity}$ across all SKUs<br>- Transfers in-transit: Status $\in (\text{'IN\_TRANSIT'}, \text{'PENDING'})$<br>- Audits open: Status $\in (\text{'IN\_PROGRESS'})$ | 1. Total warehouse stock $> 0$<br>2. Active stock transfers exist<br>3. In-progress stock audits exist | `409 Conflict` |
| **Branch** | `branches` | 1. `shifts` (POS)<br>2. `warehouses`<br>3. `sales_orders`<br>4. `purchase_orders` | - Open POS shifts: `status = 'OPEN'`<br>- Active warehouses: `warehouses.is_deleted = false`<br>- In-flight branch orders | 1. Open POS shift exists<br>2. Active warehouses with stock exist<br>3. Open branch orders exist | `409 Conflict` |

---

## 8. Duplicate-Data Findings & Classification

- **[VERIFIED]** Full empirical audit of all 29 rows in `master_values` yielded the following findings:
  1. **Total Population:** 29 rows across 6 populated master types (`PO_CROSS_VENDOR_REASON`: 10, `brand`: 7, `category`: 6, `color_group`: 3, `size_group`: 3).
  2. **Active vs Deleted:** 29 active rows (29 with `active = true`, 0 with `is_deleted = true`).
  3. **Duplicate Identification:** Exactly one duplicate code group exists:
     ```text
     Type: size_group | Code: FOOTWEAR_EU | Name: Footwear EU Sizes | Tenant: NULL (GLOBAL)
       - Row A: id = 'e44cd008-01d1-48da-b57b-9dda1d1c28eb' | updated_at = 2026-09-12 19:34:46.587235+00
       - Row B: id = 'b2d10a23-9279-4760-a8f0-02eeb3bfed97' | updated_at = 2026-09-12 21:05:49.046534+00
     ```
  4. **Child Reference Audit:** Cross-referencing both UUIDs against all 3,594 text and UUID columns across all 285 tables in `smriti001` confirmed:
     - References to `e44cd008-01d1-48da-b57b-9dda1d1c28eb`: Exactly 0 rows.
     - References to `b2d10a23-9279-4760-a8f0-02eeb3bfed97`: Exactly 0 rows.
     - References to business code `'FOOTWEAR_EU'`: 1 row in `size_groups.code` and 1 row in `attribute_groups.size_group_id`.
  5. **Classification:**
     - **Class A (True Duplicate):** Row B (`b2d10a23-...`) is an exact redundant duplicate inserted 91 minutes after Row A during initial bootstrap seeding. Neither row holds surrogate FK references.
  6. **Company-Scope Drift Finding:**
     - 6 brand records store string literal `company_id = 'GLOBAL'`.
     - 23 records store `company_id = NULL`.
     - In PostgreSQL, `NULL != NULL` under default unique indexing, meaning two rows with `company_id = NULL` bypass standard `UNIQUE (master_type_id, code, company_id)` constraints.

- **[PROPOSED]** **Exact Proposed Unique Index Specification:**
  ```sql
  CREATE UNIQUE INDEX uq_master_values_type_code_scope 
  ON master_values (
      master_type_id, 
      UPPER(TRIM(code)), 
      COALESCE(company_id, 'GLOBAL')
  ) 
  WHERE (is_deleted IS NOT TRUE);
  ```
  - **Mechanisms:**
    1. Case insensitive (`UPPER`) and whitespace stripped (`TRIM`).
    2. `COALESCE(company_id, 'GLOBAL')` seamlessly bridges `NULL` company IDs with `'GLOBAL'` company IDs, preventing duplicate global lookups.
    3. Partial index predicate `WHERE (is_deleted IS NOT TRUE)` allows re-registration of a code after it has been retired/deleted.

---

## 9. Proposed Architecture

- **[PROPOSED]** Phase 1 deploys a **Two-Tier Defense-in-Depth Architecture**:

```
                       INCOMING RETIRE / DELETE REQUEST
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │  Tenant Scope & Auth Context  │
                      └───────────────┬───────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │  Pessimistic Row Lock (SELECT)│
                      │       WITH FOR UPDATE         │
                      └───────────────┬───────────────┘
                                      │
                     ┌────────────────┴────────────────┐
                     ▼                                 ▼
         [ Tier 1: Reference Guard ]       [ Tier 1: Balance Guard ]
         Query Dependency Registry         Query Authoritative Ledgers
         - products.brand / category       - product_batch_stocks
         - items.brand / category          - stock_movements
         - attribute_groups.*              - customer_credit_ledgers
         - sales_orders / invoices         - purchase_orders / GRNs
                     │                                 │
                     └────────────────┬────────────────┘
                                      │
                           Any Active Links > 0?
                                  /       \
                             YES /         \ NO
                                /           \
                               ▼             ▼
                    HTTP 409 Conflict    Soft-Delete / Retire
                    (Human Error Msg)    is_deleted = TRUE
                                             │
                                             ▼
                                 [ Tier 2: Kernel Trigger ]
                                 PostgreSQL BEFORE UPDATE Trigger
                                 prevent_referenced_master_value_retirement()
                                             │
                                             ▼
                                     COMMIT TRANSACTION
```

### 9.1 Component 1: Centralized Dependency Registry (`ReferenceShieldService`)
- Declares the exact consuming tables, columns, matching semantics (exact match, case-insensitive, surrogate ID vs business code), and active/deleted filters.
- Reusable across both generic lookups and first-class masters.

### 9.2 Component 2: Centralized Balance Guard (`BalancePreFlightGuard`)
- Integrates with `StockSynchronizer` for on-hand stock and reserved inventory.
- Inspects `customer_credit_ledger_entries` and open unbilled orders for customers.
- Inspects `purchase_orders` and `purchase_receipts` for suppliers.
- Inspects `shifts` and warehouse batches for branch/warehouse lifecycle changes.

### 9.3 Component 3: Database Kernel Trigger Hardening
- Extends PostgreSQL trigger `prevent_referenced_master_value_retirement()` on `master_values` to check all populated types (`brand`, `category`, `color_group`, `size_group`, `PO_CROSS_VENDOR_REASON`), preventing deletion even if application code is bypassed (e.g. ad-hoc script or SQL console).

---

## 10. API Behavior & Human-Readable Error Policy (HREP)

- **[PROPOSED]** All API deletion endpoints return strictly standardized HTTP status codes and SMRITI HREP-compliant error bodies:

### 10.1 Status Codes
- `200 OK` / `204 No Content`: Successful soft-deletion/retirement.
- `400 Bad Request`: Invalid payload or attempt to alter immutable code fields.
- `404 Not Found`: Master record does not exist or belongs to another tenant.
- `409 Conflict`: Deletion blocked due to active references or positive balances.

### 10.2 HREP Error Payloads (Examples)

**Referenced Lookup Blocked (Brand):**
```json
{
  "detail": {
    "error_code": "SMRITI-REF-001",
    "title": "Lookup Value In Use",
    "explanation": "Cannot retire Brand 'BEANSTALK'. It is currently assigned to 45 active products and 12 items in the product catalog.",
    "suggested_action": "Reassign or retire the affected products before retiring this brand.",
    "reference_id": "REF-BRD-BEANSTALK",
    "active_references": {
      "products": 45,
      "items": 12
    }
  }
}
```

**Product Active Stock Blocked:**
```json
{
  "detail": {
    "error_code": "SMRITI-BAL-001",
    "title": "Active Stock On Hand",
    "explanation": "Cannot delete Product 'SKU-SHOE-001' (Running Shoes EU 42). There are 120.00 units on hand across 2 warehouses and 5.00 units reserved in open sales orders.",
    "suggested_action": "Transfer or write off existing stock and fulfill open reservations before deleting this SKU.",
    "reference_id": "BAL-PRD-SKU-SHOE-001",
    "balance_summary": {
      "on_hand": 120.0,
      "reserved": 5.0,
      "authoritative_ledger": "product_batch_stocks"
    }
  }
}
```

**Branch Open Shift Blocked:**
```json
{
  "detail": {
    "error_code": "SMRITI-BAL-005",
    "title": "Open Cashier Shift Active",
    "explanation": "Cannot deactivate Branch 'BR-MAIN' (Downtown Store). Cash Register 1 has an active shift opened by cashier 'usr-john'.",
    "suggested_action": "Perform end-of-day register closing (Z-Report) and close all active shifts before retiring this branch.",
    "reference_id": "BAL-BR-MAIN-SHIFTS"
  }
}
```

---

## 11. Transaction Boundaries & Concurrency Locking Strategy

- **[PROPOSED]** Every delete/retire operation enforces atomic transactional isolation:

```text
BEGIN (AsyncSession Transaction)
  │
  ├─ 1. Authentication & RBAC Check (MANAGER or SYSADMIN required)
  ├─ 2. Tenant Scoping Validation (company_id match or GLOBAL sysadmin)
  │
  ├─ 3. Pessimistic Row Lock:
  │     SELECT * FROM <entity_table> 
  │     WHERE id = :id AND is_deleted = FALSE 
  │     FOR UPDATE;
  │     (If row does not exist or is already deleted -> ROLLBACK & Raise 404)
  │
  ├─ 4. Reference Pre-Flight Guard:
  │     Execute registered consumer queries within the same transaction.
  │     (If count > 0 -> ROLLBACK & Raise 409 Conflict)
  │
  ├─ 5. Active Balance Pre-Flight Guard:
  │     Query authoritative ledgers (product_batch_stocks, shifts, etc.)
  │     (If balance / open documents > 0 -> ROLLBACK & Raise 409 Conflict)
  │
  ├─ 6. Lifecycle Mutation:
  │     UPDATE <entity_table>
  │     SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = :user_id
  │     WHERE id = :id;
  │
  ├─ 7. Database Trigger Validation:
  │     BEFORE UPDATE trigger executes in kernel; raises exception on violation.
  │
  ├─ 8. Immutable Audit Trail:
  │     Write structured entry to ComplianceAuditService with SHA-256 diff.
  │
COMMIT;
```

- **Concurrency Invariant:** Pessimistic `FOR UPDATE` locking prevents race conditions where a concurrent cashier or clerk attempts to bill against an SKU in the exact millisecond it is being retired. Any concurrent write to the locked entity or its immediate children will queue or fail gracefully.

---

## 12. Alembic Migration Strategy

- **[VERIFIED]** Current DAG status:
  - Control-plane head: `v1497b (head)` (`v1497b_retire_ctrl_tenant_id_columns.py`)
  - Tenant-plane head: `v1504 (head)` (`v1504_tombstone_validate_all_fks.py`)
- **[PROPOSED]** The Phase 1 migration script `v1505_master_data_integrity_phase1.py` MUST be created with:
  ```python
  revision = "v1505"
  down_revision = "v1504"  # Extends canonical tenant-plane lineage
  branch_labels = None
  depends_on = None
  ```
- **[PROPOSED]** Migration Execution Plan (in `v1505`):
  1. **Pre-Index Data Remediation:** Soft-delete duplicate `FOOTWEAR_EU` (`id = 'b2d10a23-9279-4760-a8f0-02eeb3bfed97'`).
  2. **Index Creation:**
     ```sql
     CREATE UNIQUE INDEX uq_master_values_type_code_scope 
     ON master_values (
         master_type_id, 
         UPPER(TRIM(code)), 
         COALESCE(company_id, 'GLOBAL')
     ) 
     WHERE (is_deleted IS NOT TRUE);
     ```
  3. **Kernel Trigger Update:** Replace `prevent_referenced_master_value_retirement()` with comprehensive multi-type validation.
- **[PROPOSED]** Downgrade Plan (`downgrade()`):
  1. Drop unique index `uq_master_values_type_code_scope`.
  2. Restore original `prevent_referenced_master_value_retirement()` trigger function.
  3. Un-delete Row B (`b2d10a23-...`) if required for complete reversal.

---

## 13. Data Remediation Strategy

- **[VERIFIED]** Exactly one duplicate pair exists in `master_values`:
  - `FOOTWEAR_EU` (UUID 1: `e44cd008-01d1-48da-b57b-9dda1d1c28eb`, UUID 2: `b2d10a23-9279-4760-a8f0-02eeb3bfed97`).
  - Child references in database: 0.
- **[PROPOSED]** Remediation Procedure (executed safely inside migration `v1505`):
  ```sql
  -- Step 1: Verify exactly 2 rows exist
  -- Step 2: Mark second row as deleted
  UPDATE master_values 
  SET is_deleted = TRUE, 
      deleted_at = NOW(), 
      deleted_by = 'MIGRATION_V1505_REMEDIATION'
  WHERE id = 'b2d10a23-9279-4760-a8f0-02eeb3bfed97'
    AND is_deleted IS NOT TRUE;
  ```
- **[VERIFIED]** Because child tables store `'FOOTWEAR_EU'` as a code string rather than a surrogate UUID, retiring UUID 2 has zero impact on `size_groups.code` or `attribute_groups.size_group_id`.

---

## 14. Test Strategy

- **[PROPOSED]** An end-to-end automated test suite `backend/tests/test_phase1_master_data_integrity.py` covering 5 distinct test suites:

### 14.1 Suite 1: Reference Guard Tests
1. `test_unused_brand_can_be_deleted`: Create scratch brand, confirm 0 references, delete succeeds with 200/204.
2. `test_referenced_brand_blocked_409`: Query Brand `'BEANSTALK'` (referenced by live products), attempt DELETE, assert `HTTP 409 Conflict`, assert error response mentions products count.
3. `test_referenced_category_blocked_409`: Attempt DELETE on Category `'APPAREL'`, assert `HTTP 409 Conflict`.
4. `test_size_group_reference_blocked_409`: Attempt DELETE on Size Group `'FOOTWEAR_EU'`, assert `HTTP 409 Conflict`.
5. `test_tenant_isolation_delete`: Attempt DELETE by User of Company B on Company A's brand, assert `HTTP 404` or `403`.

### 14.2 Suite 2: Balance Pre-Flight Tests
1. `test_product_with_positive_stock_blocked_409`: Select SKU with `product_batch_stocks.quantity > 0`, call `DELETE /api/v1/products/{id}`, assert `HTTP 409 Conflict` with stock details.
2. `test_product_with_zero_stock_deletable`: Select or create SKU with 0 batch stock and 0 movements, delete succeeds.
3. `test_customer_with_credit_balance_blocked_409`: Customer with non-zero ledger balance cannot be deleted (`409`).
4. `test_supplier_with_open_po_blocked_409`: Supplier with `DRAFT` or `CONFIRMED` PO cannot be deleted (`409`).
5. `test_warehouse_with_active_batches_blocked_409`: Warehouse with stock batches cannot be deleted (`409`).
6. `test_branch_with_open_shift_blocked_409`: Branch with open register shift cannot be deleted (`409`).

### 14.3 Suite 3: `master_values` Uniqueness Tests
1. `test_duplicate_code_same_company_rejected`: Inserting `'BRAND_X'` twice for Company A raises `HTTP 400` / DB UniqueViolation.
2. `test_case_variation_rejected`: Inserting `'brand_x'` when `'BRAND_X'` exists raises duplicate error.
3. `test_whitespace_variation_rejected`: Inserting `' BRAND_X '` raises duplicate error.
4. `test_different_companies_allowed`: Company A and Company B can both create `'BRAND_X'`.
5. `test_global_vs_company_collision`: If `'BRAND_X'` is `GLOBAL`, Company A cannot re-insert identical global record.
6. `test_deleted_code_reuse_allowed`: Once `'BRAND_X'` is soft-deleted, a new `'BRAND_X'` can be registered.

### 14.4 Suite 4: Concurrency & Lock Tests
1. `test_concurrent_delete_and_reference`: Run 10 parallel tasks attempting to link an item to a brand while another task deletes the brand; assert no orphaned references escape.

### 14.5 Suite 5: Regression & Reporting Tests
1. `test_historical_invoice_renders_with_retired_master`: Verify that a sales invoice referencing a retired/soft-deleted brand still renders historical reports without error.

---

## 15. Rollback Strategy

- **[PROPOSED]** If any unexpected operational blocker or regression arises:
  1. **Application Code Rollback:** Revert router commits via `git revert`. The previous code will ignore the enhanced reference guard and return to legacy behavior.
  2. **Database Schema Rollback:**
     ```bash
     docker exec smriti-api alembic downgrade v1504
     ```
     This cleanly drops the unique index `uq_master_values_type_code_scope` and restores the original trigger function.
  3. **Data Remediation Rollback:**
     ```sql
     UPDATE master_values 
     SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL 
     WHERE id = 'b2d10a23-9279-4760-a8f0-02eeb3bfed97';
     ```

---

## 16. Verification Commands

- **[PROPOSED]** Exact commands to verify the environment before, during, and after implementation:

```bash
# 1. Verify Alembic heads
docker exec smriti-api alembic heads

# 2. Inspect master_values duplicates
docker exec smriti-db psql -U postgres -d smriti001 -c "
SELECT master_type_id, UPPER(TRIM(code)), COALESCE(company_id, 'GLOBAL'), count(*) 
FROM master_values 
WHERE is_deleted IS NOT TRUE 
GROUP BY 1, 2, 3 
HAVING count(*) > 1;"

# 3. Verify unique index creation
docker exec smriti-db psql -U postgres -d smriti001 -c "
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'master_values' AND indexname = 'uq_master_values_type_code_scope';"

# 4. Verify trigger function
docker exec smriti-db psql -U postgres -d smriti001 -c "
SELECT prosrc FROM pg_proc WHERE proname = 'prevent_referenced_master_value_retirement';"

# 5. Run automated test suite
docker exec smriti-api pytest backend/tests/test_phase1_master_data_integrity.py -v
```

---

## 17. Acceptance Criteria

- **[PROPOSED]** Phase 1 will be declared **Done** only when all of the following criteria are empirically verified:
  1. [ ] Duplicate `FOOTWEAR_EU` row is safely soft-deleted with 0 child orphans created.
  2. [ ] Partial unique index `uq_master_values_type_code_scope` is active in `pg_indexes`.
  3. [ ] Attempting to delete `brand` `'BEANSTALK'` returns `HTTP 409 Conflict`.
  4. [ ] Attempting to delete `category` `'APPAREL'` returns `HTTP 409 Conflict`.
  5. [ ] Attempting to delete a product with batch stock $> 0$ returns `HTTP 409 Conflict`.
  6. [ ] Attempting to delete a customer with credit ledger balance $> 0$ returns `HTTP 409 Conflict`.
  7. [ ] Attempting to delete a supplier with open POs or pending GRNs returns `HTTP 409 Conflict`.
  8. [ ] Attempting to delete a warehouse with stock returns `HTTP 409 Conflict`.
  9. [ ] Attempting to delete a branch with an open POS shift returns `HTTP 409 Conflict`.
  10. [ ] All 5 automated test suites pass (100% green).
  11. [ ] Historical sales invoices, stock movements, and ledger reports remain intact and report-accurate.

---

## 18. Risks & Mitigations

| Risk ID | Category | Risk Description | Likelihood | Impact | Architectural Mitigation |
|---|---|---|:---:|:---:|---|
| **RSK-P1-001** | Data Loss | Unintentional hard deletion of referenced historical data | LOW | CRITICAL | Strictly enforce soft-delete (`is_deleted = true`); trigger and ORM prohibit hard `DELETE`. |
| **RSK-P1-002** | Lock Contention | `SELECT ... FOR UPDATE` causes latency spikes on high-volume tables | MEDIUM | MEDIUM | Keep row locks scoped strictly to the master entity being deleted; lock duration $< 5\text{ms}$. |
| **RSK-P1-003** | Index Failure | `CREATE UNIQUE INDEX` fails due to unhandled duplicate codes | LOW | HIGH | Execute pre-index remediation script inside migration transaction before creating index. |
| **RSK-P1-004** | Migration Bifurcation | Creating migration from wrong parent creates a third head | MEDIUM | HIGH | Explicitly anchor `down_revision = "v1504"` (canonical tenant head). |
| **RSK-P1-005** | UI Breakage | Frontend expects 200 on delete and crashes on 409 | LOW | MEDIUM | Ensure 409 payload adheres to SMRITI HREP standard format parsed by toast notification engine. |

---

## 19. Open Architectural Decisions Requiring Approval

### DECISION-001: String Code Matching vs Future Surrogate FKs
- **[VERIFIED]** Currently, `products.brand`, `products.category`, and `items.category` store natural text strings rather than UUID foreign keys referencing `master_values.id`.
- **[INFERRED]** Retrofitting strict PostgreSQL foreign keys `FOREIGN KEY (brand_id) REFERENCES master_values(id)` would require massive schema refactoring across 2,024 products and 788 items, breaking existing integrations.
- **[PROPOSED]** Phase 1 enforces referential integrity at the application Reference Shield and database trigger level using normalized natural string matching (`UPPER(TRIM(val))`), deferring surrogate FK refactoring to a future major schema release.
- **Human Architect Action Required:** Approve natural string reference shield for Phase 1.

### DECISION-002: Alembic Multi-Head DAG Architecture
- **[VERIFIED]** Alembic currently reports 2 heads: `v1497b` (control-plane) and `v1504` (tenant-plane).
- **[INFERRED]** This divergence occurred because `v1497a` and `v1497b` both branched from `v1496`.
- **[PROPOSED]** Phase 1 branches directly from `v1504` (`down_revision = "v1504"`). A separate maintenance migration to merge `v1497b` and `v1504` can be scheduled independently.
- **Human Architect Action Required:** Confirm branching from `v1504` without immediate head merging.

### DECISION-003: Consolidation of 'GLOBAL' vs NULL Company Scoping
- **[VERIFIED]** 6 brand records store `company_id = 'GLOBAL'`, while categories and other types store `company_id = NULL`.
- **[PROPOSED]** Standardize all system-wide global master values to `company_id = NULL` (or consistently map them via `COALESCE(company_id, 'GLOBAL')` in queries and indexes).
- **Human Architect Action Required:** Approve `COALESCE(company_id, 'GLOBAL')` as the canonical tenant scoping bridge.

---

## 20. Implementation Order (Phase 1 Roadmap)

Upon human architectural approval, Phase 1 will be executed in the following strict order:

1. **Step 1:** Create `ReferenceShieldService` with full consumer dependency registry (`backend/app/services/reference_shield.py`).
2. **Step 2:** Create `BalancePreFlightGuard` with authoritative ledger queries (`backend/app/services/balance_guard.py`).
3. **Step 3:** Update `backend/app/api/v1/master_lookup.py` to integrate Reference Shield and pessimistic row locks.
4. **Step 4:** Update `backend/app/api/v1/inventory.py` to integrate Balance Guard on product deletion.
5. **Step 5:** Update `backend/app/api/v1/crm.py` to integrate Balance Guard on customer deletion.
6. **Step 6:** Update `backend/app/api/v1/purchase.py` to integrate Balance Guard on supplier deletion.
7. **Step 7:** Update `backend/app/api/v1/masters.py` to integrate Reference and Balance Guards on branch/warehouse/company deletion.
8. **Step 8:** Create and execute Alembic migration `v1505` (`remediate duplicate FOOTWEAR_EU`, `create unique index`, `harden database trigger`).
9. **Step 9:** Execute verification test suite `test_phase1_master_data_integrity.py`.
10. **Step 10:** Update walkthrough, implementation index, and changelog.
