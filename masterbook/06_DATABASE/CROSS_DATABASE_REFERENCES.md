# SMRITI RETAIL OS — CROSS-DATABASE REFERENCES AUDIT & GOVERNANCE
**Document ID:** MBOOK-DB-XREF-001  
**Version:** 1.0.0 (Phase 2 Architectural Audit)  
**Date:** 2026-08-11  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Classification:** Proprietary Architectural Governance — FROZEN BASELINE  

---

## 1. Executive Summary & Purpose

When migrating SMRITI Retail OS from a shared database to a physically isolated multi-database topology (`smriti_control` vs `smriti_company_{company_code}`), PostgreSQL relational foreign keys (`REFERENCES`) CANNOT cross physical database boundaries.

This specification documents the complete audit of cross-database reference boundaries, their replacements, and application-level validation strategies.

---

## 2. Foreign Key Boundary Audit Matrix

| Current Column / Constraint | Source Table (Company DB) | Current FK Target | Target DB | Proposed Replacement | Application-Level Validation Strategy |
|---|---|---|---|---|---|
| `company_id` | All 184 Company tables | `companies(id)` | Control DB | `VARCHAR(64)` UUID String | Validated via `ControlDatabaseRegistryService.verify_user_company_access()` at session creation. |
| `tenant_id` | All 184 Company tables | `tenants(id)` | Control DB | `VARCHAR(64)` UUID String | Validated via `TenantContext` in JWT claims. |
| `branch_id` | `sales_invoices`, `pos_sessions`, `stock_movements`, etc. | `branches(id)` | Control DB / Company DB | `VARCHAR(64)` String | Validated via User Branch Assignments in Control DB. |
| `user_id` / `cashier_id` | `pos_sessions`, `journal_vouchers`, `sales_invoices` | `users(id)` | Control DB | `VARCHAR(64)` UUID String | Validated against `ControlUser.id` during JWT authentication. |
| `created_by` / `updated_by` | `BaseEntity` (All Company tables) | `users(id)` / String | Control DB | `VARCHAR(100)` Username / User ID String | Populated automatically from `current_user.username` in `TenantContext`. No DB FK constraint. |
| `approved_by` | `journal_vouchers`, `purchase_orders`, `dispatches` | `users(id)` | Control DB | `VARCHAR(64)` User ID String | Validated against Control DB Approval Workflows (`smriti_approval_histories`). |

---

## 3. Intra-Database Foreign Keys (Preserved inside Company DBs)

All relational foreign keys where BOTH source and target tables reside inside the Company DB MUST BE PRESERVED:
- `sales_invoice_items.invoice_id ──► sales_invoices.id` (CASCADE)
- `purchase_order_items.po_id ──► purchase_orders.id` (CASCADE)
- `product_barcodes.product_id ──► products.id` (CASCADE)
- `inventory_ledger_entries.product_id ──► products.id` (RESTRICT)
- `journal_ledger_entries.voucher_id ──► journal_vouchers.id` (CASCADE)
- `pos_transaction_items.transaction_id ──► pos_transactions.id` (CASCADE)
- `customer_addresses.customer_id ──► customers.id` (CASCADE)
- `supplier_contacts.supplier_id ──► suppliers.id` (CASCADE)

---

## 4. Summary Rules

1. **NO Cross-Database Postgres FKs:** No table inside a Company DB may define a SQL `FOREIGN KEY` constraint pointing to a table in Control DB or another Company DB.
2. **UUID String Storage:** Use `String(64)` for all cross-database reference columns (`company_id`, `tenant_id`, `branch_id`, `user_id`).
3. **Control DB Authority:** The Control DB remains the sole authority for validating user identities, company permissions, and tenant assignments.
