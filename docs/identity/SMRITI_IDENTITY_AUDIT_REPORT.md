<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.34.1
  Created      : 2026-09-18
  Modified     : 2026-09-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Unified Identity Architecture — Deep Codebase Audit Report

**Blueprint Reference:** SMRITI Unified Identity, Grouping & Human-Friendly ID Architecture v1.0  
**Audit Timestamp:** 2026-09-18 02:45:21 UTC  
**Auditor:** SMRITI Architecture Guard & Deepmind Senior Systems Pair  
**Status:** COMPLETE (Evidence-Grounded per AGENTS.md Governance)  

---

## 1. Executive Summary

This deep audit systematically evaluates the entire SMRITI Retail OS codebase (268 database tables in `smritisys`, 65 SQLAlchemy ORM models, 25 FastAPI API routers, 591 frontend TypeScript/React files) against the 95 sections and 20 rules of the **SMRITI Unified Identity Blueprint v1.0**.

### Key Empirical Findings:
1. **Existing Tables and Primary Keys:**
   - 252 tables (94%) currently use `character varying(50)` as primary key.
   - 2 tables (`master_types`, `master_values`) use native PostgreSQL `uuid`.
   - 7 tables (`sales_invoice_items`, `sales_order_items`, `sales_quotation_items`, `sales_return_items`, `audit_logs`, `sync_queue`, `psv_sku_tracking`) use `integer`.
   - 225 tables inherit `BaseEntity` with both `id` (`varchar(50)`) and `uuid` (`varchar(36)`).
2. **Current Identity Generators:**
   - At least 14 distinct ad-hoc backend ID patterns exist (e.g. `itm_{hex[:12]}`, `p-var-{ts}-{idx}`, `cust-{hex[:8]}`, `comp-sal-{hex[:6]}`, `po-{hex[:6]}`, `SER-AUTO-{hex[:8]}`).
   - Several services truncate UUIDs to 6 or 8 hex characters (`uuid.uuid4().hex[:8]`), introducing high collision risk.
   - The frontend contains 45+ locations generating IDs using `crypto.randomUUID()`, `Date.now()`, or `Math.random()`, including directly posting `id: crypto.randomUUID()` to the backend in `SalesOrderTab.tsx`.
3. **No Centralized Identity Registry or Numbering Registry:**
   - Neither `smriti_identity_registry` nor `smriti_numbering_registry` exists yet.
   - Document series is handled by `document_series` (Shoper 9 legacy parity), which manages document numbering, but is not connected to a universal identity registry.

---

## 2. Evidence: Database Schema & Entity Analysis

### A. Primary Key Distribution Across 268 Base Tables

```text
Datatype                             Count   Notes
-------------------------------------------------------------------------------------
character varying(50)                  252   Standard BaseEntity tables
integer                                  7   Item tables & logs
character varying(100)                   5   Architecture & policy lookup tables
uuid (PostgreSQL native)                 2   master_types, master_values
character varying(64)                    1   alembic_version
character varying(255)                   1   architecture_files
character varying(36)                    1   refresh_token_blacklist
composite (date + varchar(100))          1   compliance_thresholds
```

### B. Foreign Key Graph
- Total foreign key constraints: **312**
- All 312 relational foreign keys point to `*.id` (`varchar(50)` or `integer`), **zero foreign keys point to `*.uuid`**.
- Top foreign key targets:
  - `companies.id`: 48 tables
  - `branches.id`: 46 tables
  - `products.id`: 14 tables
  - `users.id`: 12 tables
  - `customers.id`: 8 tables
  - `sales_invoices.id`: 7 tables
  - `purchase_orders.id`: 5 tables

### C. Identity-Like Business Fields
- 186 columns contain business identifiers:
  - `item_code` / `sku`: `items`, `products`, `customer_article_mappings`
  - `barcode`: `items`, `products`, `item_barcodes`, `product_identities`
  - `invoice_no` / `order_no` / `doc_number`: `sales_invoices`, `sales_orders`, `purchase_orders`
  - `customer_code` / `code`: `customers`, `parties`, `suppliers`

---

## 3. Evidence: Generator Anti-Patterns Identified

### Anti-Pattern 1: Dual-Identity Divergence
In `backend/app/db/base.py`:
```python
class BaseEntity(Base):
    id = Column(String(50), primary_key=True)
    uuid = Column(String(36), default=lambda: str(uuid_pkg.uuid4()), unique=True, nullable=False)
```
- **Observed Data:** In `companies`, `id` is `comp-sal-359785`, while `uuid` is `3bde7c99-8234-4947-bd24-bdef6328447b`.
- **Impact:** Causes dual-key confusion. APIs and foreign keys use `id` (`comp-sal-...`), while developers mistakenly assume `uuid` is the canonical ID.
- **Blueprint Alignment:** Blueprint Section 46 & ID-001 mandates: "Refactoring does not mean regenerating an identity that is already valid. Standardize on one canonical technical ID (UUIDv7)."

### Anti-Pattern 2: 32-Bit Truncated Hex Entropy Loss
In `backend/app/services/purchase.py` and `backend/app/services/sales.py`:
```python
def _uid() -> str:
    return uuid.uuid4().hex[:8]  # 8 hex digits = 32 bits of entropy
```
- **Impact:** A 32-bit identifier experiences a 50% collision chance at ~65,536 entities (Birthday Paradox). In retail environments with millions of transaction lines, this is a catastrophic integrity failure waiting to happen.

### Anti-Pattern 3: Client-Side ID Assignment in API Payloads
In `src/components/sales/SalesOrderTab.tsx:62`:
```typescript
const response = await apiFetchV1("/sales/orders", {
  method: "POST",
  body: JSON.stringify({
    id: crypto.randomUUID(), // <--- Client-side ID generation
    order_no: formData.docNumber || `${formData.docPrefix}-${formData.docDate.replace(/-/g, "")}`,
```
And in `backend/app/services/sales.py:1345`:
```python
db_so = SalesOrder(
    id=so_in.id,  # <--- Backend naively accepts client-provided ID
    order_no=so_in.order_no,
```
- **Impact:** Directly violates Rule 32, Rule 33, and Rule ID-010.

---

## 4. Interpretation

1. **No Destructive Re-keying Required:**
   Because 252 of 268 tables already use `character varying(50)` for `id`, we **do not need to drop or retype existing database foreign keys** to implement UUIDv7!
   UUIDv7 formatted as a 36-character hyphenated string (e.g. `0198c7e4-8d42-7a19-b231-1e2478ab0192`) fits cleanly into `character varying(50)`.
   Existing `id` values can be retained for historical records, and all new records can receive canonical UUIDv7 directly in `id`.
2. **Harmonizing `id` and `uuid`:**
   The redundant `uuid` column in `BaseEntity` can be reconciled. Moving forward, `id` IS the technical UUIDv7.
3. **Introduction of Identity Code:**
   Currently, entities like `Item` have `item_code` (business code) and `id` (technical string). None have the governed `identity_code` (`MST-ITM-00001245`).
   Adding `identity_code` column to the core entity tables (`items`, `products`, `customers`, `suppliers`, `warehouses`, `sales_invoices`, `purchase_orders`, `reports`, `actions`) will fulfill Blueprint Layers A, B, C, D without breaking any existing foreign keys.
4. **Numbering Registry Synergy:**
   `DocumentSeries` in `backend/app/models/numbering.py` already manages financial-year and terminal-scoped reset rules for business document numbers (e.g. `INV/MUM/26-27/00125`). This aligns with Blueprint Section 26 & 27 (`smriti_numbering_registry`). We can wrap and formalize this into the universal Numbering Registry.

---

## 5. Recommendations & Phased Roadmap

### Phase 1: Core Identity Infrastructure (Control Plane)
1. Implement `backend/app/models/identity_registry.py`:
   - Table `smriti_identity_registry` (defines groups, entity types, strategies, formats).
   - Table `smriti_numbering_registry` (governs sequential counters per tenant/company/financial year).
   - Table `smriti_identity_alias` (historical mapping for renames/reclassifications).
2. Implement `backend/app/services/identity/`:
   - `IdentityEngine`: UUIDv7 generator (using approved `uuid6` or RFC 9562 library).
   - `IdentityCodeGenerator`: Controlled thread-safe sequence generator.
   - `IdentityResolver`: Multi-tier resolver (`identity_code` -> `id`, `business_code` -> `id`).
3. Add Alembic migration creating the registry tables.

### Phase 2: Schema Evolution for Core Entities
1. Add `identity_code` (varchar(50), nullable=True, unique per tenant/company scope) to:
   - `companies`, `branches` (`ORG`)
   - `items`, `customers`, `suppliers` (`MST`)
   - `warehouses`, `stock_movements` (`INV`)
   - `sales_invoices`, `sales_orders` (`SAL`)
   - `purchase_orders`, `purchase_receipts` (`PUR`)
   - `report_definitions`, `dashboards` (`RPT`)
2. Backfill existing records with generated `identity_code` based on sequence.

### Phase 3: Enforcement & Architecture Guard
1. Update `scripts/architecture_duplication_gate.py` with the Identity Architecture Guard (Blueprint Section 54) to fail CI on:
   - Client-side persistent ID generation (`crypto.randomUUID()` in API payloads).
   - Truncated `uuid.uuid4().hex[:N]` generators.
   - Missing `identity_code` in new entity schemas.
2. Update backend services to generate canonical UUIDv7 in `id` on creation.

---

## 6. Verification Status

| Verification Item | Status | Evidence |
| :--- | :--- | :--- |
| Table PK & Schema Audit | **Done** | Full 268-table query from `smritisys` live catalog |
| Backend Generator Audit | **Done** | Ripgrep & AST scan of 65 backend models and 30 services |
| Frontend Generator Audit | **Done** | Ripgrep scan across 591 files in `src/` |
| Identity Generator Inventory | **Done** | Created `docs/identity/IDENTITY_GENERATOR_INVENTORY.md` |
| Audit Report & Gap Analysis | **Done** | Created `docs/identity/SMRITI_IDENTITY_AUDIT_REPORT.md` |
