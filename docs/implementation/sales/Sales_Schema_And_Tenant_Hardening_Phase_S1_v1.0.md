<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.48.2
  Created      : 2026-10-01
  Modified     : 2026-10-01
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Implementation Plan
-->

# Sales Schema & Multi-Tenant Hardening (Phase S1)

**Plan ID:** SMRITI-IP-SALES-S1-v1.0  
**Domain:** Sales & Commercial Operations  
**Phase:** Phase S1  
**Status:** In Progress  
**Effective Date:** 2026-10-01  
**Target Migration:** `v1515_sales_schema_tenant_hardening`  
**Prerequisite:** Phase 0.2 Architecture Freeze (`docs/architecture/SMRITI_SALES_ARCHITECTURE_FREEZE_V1.0.md`)  

---

## 1. Objective
Harden the Sales and Fulfillment database schemas and ORM entities to achieve complete multi-tenant scoping and line-item metadata parity. Replace global PostgreSQL unique constraints on document numbers with compound tenant-scoped uniqueness (`UNIQUE(company_id, document_no)`), and elevate sales line item entities (`SalesOrderItem`, `SalesInvoiceItem`, `SalesReturnItem`, `SalesQuotationItem`) to full `BaseEntity` structural parity with automatic UUID, tenant isolation, optimistic concurrency versioning, and immutable audit metadata.

---

## 2. Business Motivation
In a multi-tenant cloud retail operating system, two independent business enterprises (Tenant A and Tenant B) must be able to use the same invoice and order numbering schemes (e.g., `SO-0001` or `INV-2026-001`) without colliding at the database level. Currently, `sales_orders.order_no`, `sales_returns.return_no`, `sales_quotations.quotation_no`, and fulfillment manifests enforce global unique constraints across the entire PostgreSQL cluster, preventing simultaneous multi-company operations. Furthermore, missing entity attributes (`uuid`, `company_id`, `branch_id`, `version`) on line items cause critical runtime crashes (such as `TypeError: 'uuid' is an invalid keyword argument for SalesInvoiceItem` during quotation conversion) and prevent line-level auditability.

---

## 3. Scope
* **In Scope:**
  1. Alembic migration `v1515_sales_schema_tenant_hardening`:
     - Replace global unique constraints on `sales_orders(order_no)`, `sales_returns(return_no)`, `sales_quotations(quotation_no)`, `packing_slips(packing_slip_number)`, and `dispatches(dispatch_number)` with composite unique constraints scoped to `(company_id, document_no)`.
     - Remove redundant global unique constraint on `sales_invoices(invoice_no)` while preserving `uq_sales_invoices_company_invoice_no`.
     - Add missing `uuid`, `company_id`, `branch_id`, `is_active`, `is_deleted`, `deleted_at`, `deleted_by`, `version`, `created_at`, `modified_at`, `created_by`, `updated_by` columns to `sales_order_items`, `sales_invoice_items`, `sales_return_items`, and `sales_quotation_items`.
     - Safely backfill `uuid` (UUIDv4 generation), `company_id`, and `branch_id` for existing historical `sales_invoice_items` rows from their parent `sales_invoices`.
  2. ORM models update in `backend/app/models/sales.py`, `backend/app/models/fulfillment.py`, and `backend/app/models/__init__.py`.
  3. Regression testing against Purchase Phase 2.1 test suites (25/25 green) to ensure strict domain isolation.
* **Out of Scope (Deferred to Later Phases):**
  - Elimination of dual stock writer collision in `FulfillmentEngine` (Phase S2).
  - Implementation of `UniversalLifecycleEngine` handlers for Sales (Phase S3).
  - Modernization of legacy sales test assertions (Phase S4).
  - 3-Way delivery matching (Phase S5).
  - Seeding of approval threshold policies (Phase S6).
  - General Ledger double-entry voucher posting (Phase S7).

---

## 4. Current State
* PostgreSQL database contains global `UNIQUE` constraints:
  - `sales_orders_order_no_key` on `sales_orders(order_no)`
  - `sales_invoices_invoice_no_key` on `sales_invoices(invoice_no)`
  - `sales_quotations_quotation_no_key` on `sales_quotations(quotation_no)`
  - `sales_returns_return_no_key` on `sales_returns(return_no)`
  - `ix_packing_slips_packing_slip_number` on `packing_slips(packing_slip_number)`
  - `ix_dispatches_dispatch_number` on `dispatches(dispatch_number)`
* `sales_order_items`, `sales_invoice_items`, `sales_return_items`, and `sales_quotation_items` inherit from raw `Base` and lack `uuid`, `company_id`, `branch_id`, `version`, and audit timestamps.
* `SalesService.convert_quotation_to_invoice` crashes at runtime with `TypeError: 'uuid' is an invalid keyword argument for SalesInvoiceItem` because the service expects line items to support UUIDs.

---

## 5. Gap Analysis
| Component | Existing Schema / Entity | Target Schema / Entity | Gap |
| :--- | :--- | :--- | :--- |
| **Sales Orders** | Global `UNIQUE(order_no)` | `UNIQUE(company_id, order_no)` | Multi-tenant collision hazard |
| **Sales Invoices** | Global `UNIQUE(invoice_no)` + compound unique | Retain compound `UNIQUE(company_id, invoice_no)` only | Redundant global constraint blocking multi-tenancy |
| **Sales Quotations** | Global `UNIQUE(quotation_no)` | `UNIQUE(company_id, quotation_no)` | Multi-tenant collision hazard |
| **Sales Returns** | Global `UNIQUE(return_no)` | `UNIQUE(company_id, return_no)` | Multi-tenant collision hazard |
| **Packing Slips** | Global `UNIQUE(packing_slip_number)` | `UNIQUE(company_id, packing_slip_number)` | Multi-tenant collision hazard |
| **Dispatches** | Global `UNIQUE(dispatch_number)` | `UNIQUE(company_id, dispatch_number)` | Multi-tenant collision hazard |
| **Line Item Entities** | Raw `Base` (`id` integer, missing uuid, company, audit) | Full `BaseEntity` structural parity | Runtime crashes on UUID assignment; missing tenant isolation |

---

## 6. Architecture Impact
* **Multi-Tenancy:** True company-level data isolation for all sales documents and their lines. Different corporate tenants can run their own numbering sequences independently.
* **Line-Item Identity:** Every line item receives an immutable UUID, supporting line-level tracebacks, returns allocation, and promotion redemption tracking.
* **Zero Breaking Changes to Integer PKs:** To protect existing foreign keys (`sales_order_reservations.order_item_id`, `smriti_promotion_redemption_items.sales_invoice_item_id`, etc.), primary keys remain integer sequences with added UUID columns, preserving backward compatibility while providing full entity parity.

---

## 7. Proposed Design

### Database Migration: `v1515_sales_schema_tenant_hardening.py`
1. Drop global unique constraints:
   - `op.drop_constraint("sales_orders_order_no_key", "sales_orders", type_="unique")`
   - `op.drop_constraint("sales_invoices_invoice_no_key", "sales_invoices", type_="unique")`
   - `op.drop_constraint("sales_quotations_quotation_no_key", "sales_quotations", type_="unique")`
   - `op.drop_constraint("sales_returns_return_no_key", "sales_returns", type_="unique")`
   - `op.drop_index("ix_packing_slips_packing_slip_number", "packing_slips")`
   - `op.drop_index("ix_dispatches_dispatch_number", "dispatches")`
2. Create compound tenant-scoped constraints:
   - `uq_sales_orders_company_order_no` on `("company_id", "order_no")`
   - `uq_sales_quotations_company_quotation_no` on `("company_id", "quotation_no")`
   - `uq_sales_returns_company_return_no` on `("company_id", "return_no")`
   - `uq_packing_slips_company_num` on `("company_id", "packing_slip_number")`
   - `uq_dispatches_company_num` on `("company_id", "dispatch_number")`
3. Add columns to item tables:
   - For `sales_order_items`, `sales_invoice_items`, `sales_return_items`, `sales_quotation_items`:
     - `uuid` (VARCHAR(36), nullable=False)
     - `company_id` (VARCHAR(50), nullable=True, FK to `companies.id`)
     - `branch_id` (VARCHAR(50), nullable=True, FK to `branches.id`)
     - `is_active` (BOOLEAN, default True)
     - `is_deleted` (BOOLEAN, default False)
     - `deleted_at` (TIMESTAMP WITH TIME ZONE)
     - `deleted_by` (VARCHAR(100))
     - `version` (INTEGER, default 1)
     - `created_at` (TIMESTAMP WITH TIME ZONE, default CURRENT_TIMESTAMP)
     - `modified_at` (TIMESTAMP WITH TIME ZONE, default CURRENT_TIMESTAMP)
     - `created_by` (VARCHAR(100))
     - `updated_by` (VARCHAR(100))
4. Data backfill:
   - Update `sales_invoice_items` from `sales_invoices` for existing historical rows.

---

## 8. Files Created
* `backend/alembic/versions/v1515_sales_schema_tenant_hardening.py`
* `docs/implementation/sales/Sales_Schema_And_Tenant_Hardening_Phase_S1_v1.0.md`
* `docs/walkthrough/sales/Sales_Schema_And_Tenant_Hardening_Phase_S1_v1.0.md`

---

## 9. Files Modified
* `backend/app/models/sales.py`
* `backend/app/models/fulfillment.py`
* `backend/app/models/__init__.py`
* `docs/implementation/README.md`
* `docs/walkthrough/README.md`
* `CHANGELOG.md`

---

## 10. Dependencies
* `v1514_purchase_bills_hardening` (Alembic head)
* `backend/app/models/sales.py`
* `backend/app/models/fulfillment.py`

---

## 11. Risks
* **Data Migration Risk:** Existing `sales_invoice_items` rows require valid UUIDs and company IDs.
  * *Mitigation:* Migration script will populate `uuid = gen_random_uuid()` and copy `company_id`, `branch_id` from parent `sales_invoices`.
* **Constraint Naming Drift:** Dropping non-existent constraints will cause migration failure.
  * *Mitigation:* Safe inspector introspection checks before dropping constraints.

---

## 12. Rollback Strategy
* Alembic `downgrade()` restores global unique constraints and drops added columns after dropping foreign key constraints.

---

## 13. Verification Plan
* Column-by-column inspection using `information_schema.columns`.
* Constraint-by-constraint inspection using `information_schema.table_constraints`.
* Multi-tenant insertion test: Verify two distinct companies can insert identical document numbers.

---

## 14. Test Plan
* Run Purchase Phase 2.1 test suite (25/25 must remain green).
* Run Sales test battery to confirm `test_convert_quotation_to_invoice` unblocked.

---

## 15. Documentation Impact
* `docs/implementation/README.md` (Updated)
* `docs/walkthrough/README.md` (Updated)
* `CHANGELOG.md` (Updated)

---

## 16. Deployment Plan
* Apply via standard automated zero-downtime migration pipeline: `alembic upgrade head`.

---

## 17. Status
* **Status:** In Progress
* **Phase:** Phase S1

---

## 18. Related ADRs
* ADR-003: Universal Transaction Lifecycle Framework
* ADR-014: Authoritative Multi-Tenant Stock Movement Ledger

---

## 19. Related Walkthroughs
* `docs/walkthrough/procurement/Universal_Document_Lifecycle_Phase2_1_Hardening_v1.0.md`
* `docs/walkthrough/sales/Sales_Schema_And_Tenant_Hardening_Phase_S1_v1.0.md`
