<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.26.0
  Created      : 2026-09-16
  Modified     : 2026-09-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Architectural Decision Record
-->

# ADR-005: One-Way Canonical Master to Compatibility Projection Architecture & Statutory Snapshot Immutability

**Status:** Accepted  
**Date:** 2026-09-16  
**Area:** System Architecture, Master Data Management & Statutory Compliance  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  

---

## 1. Context

During the comprehensive Database & Business-Model Audit of SMRITI Retail OS, two critical coexistence patterns were evaluated:
1. **Catalog Domain:** Coexistence of the canonical 3-tier item model (`items`, `item_variants`, `item_barcodes`) with the legacy operational catalog (`products`, `product_batch_stocks`).
2. **Party Domain:** Coexistence of the Universal Party model (`parties`, `party_roles`, `customer_profiles`, `supplier_profiles`) with legacy CRM and procurement models (`customers`, `suppliers`).

A prior proposal suggested establishing **bidirectional synchronization** (`items` ↔ `products` and `parties` ↔ `customers/suppliers`) to keep both sets of tables active as co-equal masters.

Simultaneously, questions arose regarding whether historical transaction documents (such as `sales_invoices` and `sales_invoice_items`) should normalize their customer, address, and GST attributes to dynamically reference current master records.

---

## 2. Decisions

### Decision 1: Strict Rejection of Bidirectional Synchronization in Favor of One-Way Canonical Ownership
SMRITI explicitly rejects permanent bidirectional synchronization. Instead, all master data follows a **Canonical Master → Compatibility Projection** architecture:

```text
                 CANONICAL MASTER
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
        Item Master          Party Master
        items                parties
        item_variants        party_roles
        item_barcodes        profiles (customer/supplier)
             │                   │
             ▼                   ▼
      Compatibility         Compatibility
         Adapter               Adapter
             │                   │
             ▼                   ▼
        products            customers / suppliers
   (Downstream Projection)  (Downstream Projections)
```

1. **Single Source of Truth:** `items` and `parties` are the sole authoritative domain masters. All write operations (creations, edits, status transitions) MUST enter via canonical domain services (`ItemMasterService`, `UniversalPartyService`).
2. **One-Way Projection:** Legacy operational tables (`products`, `customers`, `suppliers`) receive read-compatible projections generated downstream.
3. **No Upward Mutation:** Legacy tables are never permitted to overwrite canonical masters. Any legacy service requiring edits must delegate to the canonical domain API.
4. **Gradual Consumer Deprecation:** Dependent tables (e.g. `sales_invoice_items`, `stock_movements`, `purchase_order_items`) will be migrated incrementally from legacy foreign keys to canonical foreign keys. When all consumers are migrated, compatibility projections will be retired.

### Decision 2: Permanent Statutory Transaction Snapshot Immutability Rule
Under CGST Act 2017 Section 31 and Rule 46, tax invoices and compliance ledgers are immutable legal and financial instruments.

```text
MASTER DATA
     │
     │ creates transaction
     ▼
TRANSACTION SNAPSHOT
     │
     └── NEVER dynamically rewrite historical facts
```

1. **Immutable Historical Facts:** Once a transaction is issued (`sales_invoices`, `eway_bills`, `sales_returns`), its customer legal name, GSTIN, place of supply, billing/shipping address, item descriptions, HSN codes, applied tax rates, discounts, and prices are **permanent snapshots**.
2. **Prohibition of Dynamic Foreign-Key Dereferencing:** Reporting engines, tax audits, and print layouts MUST read the snapshot fields directly from the transaction row. They MUST NEVER dynamically join current master records to populate historical invoice data.
3. **Amendment Protocol:** Corrections to historical invoices must occur exclusively via statutory Credit Notes, Debit Notes, or formal e-Way Bill cancellation/reissuance — never via database row mutation.

### Decision 3: Mandatory 5-Gate Schema Retirement Lifecycle
No database table, column, or constraint may be dropped without fulfilling the 5-Gate Safety Standard:
- **Gate 1 (Zero Rows):** Physical row count is 0 in all production tenant databases (`smriti001`, `smriti002`).
- **Gate 2 (Zero Write Paths):** Code inspection confirms zero active API routes, background workers, or repositories execute writes to the target.
- **Gate 3 (Foreign Key Severance):** All incoming foreign keys from child or companion tables are identified, decoupled, or dropped in topological order.
- **Gate 4 (DDL Archive & Verified Rollback):** Complete table DDL, indexes, and constraints are archived in `docs/archive/`, and the Alembic migration includes a verified `downgrade()` block that fully reconstructs the object.
- **Gate 5 (Full Regression Green):** The complete test suite (Pytest, Vitest, TypeScript compilation) passes with 100% green status.

---

## 3. Rationale & Analysis

### Why Bidirectional Sync Fails
Bidirectional synchronization (`A ↔ B`) introduces severe distributed data anomalies:
- **Split-Brain & Circular Triggers:** Updating `products` triggers an update to `items`, which triggers an update back to `products`, resulting in infinite loops or timestamp thrashing.
- **Hierarchy Mismatch:** `items` is a 3-tier hierarchy (`Item` → `ItemVariant` → `ItemBarcode`), whereas legacy `products` is flat. A flat-to-hierarchical reverse mapping cannot determine whether a changed attribute belongs to the parent item or a specific variant.
- **Auditing Impossibility:** Reconciling which system made which change at which microsecond creates intractable reconciliation bugs.

One-way projection (`items → products`) eliminates conflict resolution entirely: canonical data always wins, and legacy tables remain stable read-models.

---

## 4. Consequences

### Positive
- Zero risk of circular update deadlocks or split-brain catalog corruption.
- Full statutory compliance with Indian GST laws and immutable audit trail requirements.
- Legacy POS, distribution order, and reporting routines continue functioning without immediate breaking changes.
- Safe, gated decommissioning path for obsolete tables like `stores` and `user_store_assignments`.

### Negative / Trade-offs
- Downstream projection adapters require maintaining lightweight update hooks until legacy consumers are fully repointed.
- Dual-table storage overhead during the transitional convergence phase.

---

## 5. Related Artifacts & Governance

- Matrix: `docs/_audit/CANONICAL_TABLE_DEPENDENCY_MATRIX_2026.md`
- Foundation Walkthrough: `docs/walkthrough/foundation/Staged_Migration_Audit_And_Deprecation_Phase_A_B_v4.17.0.md`
- Party Architecture: `docs/implementation/purchase/Vendor_360_Universal_Party_Canonical_Architecture_v1.0.0.md`
- Migration: `backend/alembic/versions/v1454_retire_stores_table.py`
