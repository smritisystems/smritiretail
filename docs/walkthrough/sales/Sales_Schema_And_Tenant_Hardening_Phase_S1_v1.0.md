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
  Classification: Walkthrough Document
-->

# SMRITI Sales Schema & Multi-Tenant Hardening — Phase S1 Walkthrough

**Document ID:** SMRITI-WT-SALES-S1-v1.0  
**Area:** Sales & Commercial Operations  
**Version:** v1.0.0  
**Effective Date:** 2026-10-01  
**Alembic Revision:** `v1515_sales_schema_tenant_hardening`  
**Baseline Principle:** Purchase Phase 2.1 is **FROZEN & ISOLATED** (25/25 Tests Passing). Zero Purchase Code Touched.  

---

## 1. Purpose
This walkthrough documents the technical implementation of **Phase S1: Sales Schema & Multi-Tenant Hardening**. It records the resolution of global document numbering collisions in PostgreSQL and the structural elevation of all sales line item entities (`SalesOrderItem`, `SalesInvoiceItem`, `SalesReturnItem`, `SalesQuotationItem`) to full `BaseEntity` parity.

---

## 2. Scope
- Removal of global `UNIQUE` constraints across sales documents (`sales_orders`, `sales_quotations`, `sales_returns`, `packing_slips`, `dispatches`) and replacement with composite `(company_id, document_no)` unique constraints.
- Removal of redundant global `UNIQUE` constraint on `sales_invoices(invoice_no)`.
- Addition of tenant, versioning, and immutable audit columns to `sales_order_items`, `sales_invoice_items`, `sales_return_items`, and `sales_quotation_items` (`uuid`, `company_id`, `branch_id`, `is_active`, `is_deleted`, `deleted_at`, `deleted_by`, `version`, `created_at`, `modified_at`, `created_by`, `updated_by`).
- Safe data migration and backfill for existing historical invoice items.
- Full parity between PostgreSQL DDL schema and SQLAlchemy ORM models.
- Verification that Purchase Phase 2.1 remains 100% green and isolated.

---

## 3. Files Created
1. `backend/alembic/versions/v1515_sales_schema_tenant_hardening.py`
2. `docs/implementation/sales/Sales_Schema_And_Tenant_Hardening_Phase_S1_v1.0.md`
3. `docs/walkthrough/sales/Sales_Schema_And_Tenant_Hardening_Phase_S1_v1.0.md`

---

## 4. Files Modified
1. `backend/app/models/sales.py`
2. `backend/app/models/fulfillment.py`
3. `backend/app/models/__init__.py`
4. `docs/implementation/README.md`
5. `docs/walkthrough/README.md`
6. `CHANGELOG.md`

---

## 5. Architecture Decisions
1. **Compound Multi-Tenant Uniqueness:** Scoped all document numbering to `(company_id, document_no)`. This allows distinct commercial tenants to operate their own document sequence numbering (e.g. `SO-001`) simultaneously without collisions.
2. **Preservation of Line Item Integer PKs:** To protect existing foreign key constraints across four related tables (`sales_order_reservations.order_item_id`, `smriti_promotion_redemption_items.sales_invoice_item_id`, `smriti_promotion_overrides.sales_invoice_item_id`, `customer_po_invoice_allocations.invoice_item_id`), primary keys were kept as auto-incrementing integers, with `uuid` added as an indexed, unique technical identifier alongside tenant and audit columns.
3. **Automated Line-Item UUID Allocation:** Each line item is guaranteed an immutable UUIDv4, eliminating runtime `TypeError: 'uuid'` crashes during document conversion flows.

---

## 6. Design Rationale
- Elevating line items with `uuid`, `company_id`, and `branch_id` provides line-level tenant isolation, so line item queries cannot accidentally cross tenant boundaries even in raw SQL queries.
- Removing global single-column unique constraints prevents catastrophic multi-tenant failures when onboarding new companies.

---

## 7. Implementation Summary
- **Migration Execution:** Alembic migration `v1515_sales_schema_tenant_hardening` was created and applied cleanly across both `smritisys` and `smriti001` databases.
- **ORM Model Synchronization:** `backend/app/models/sales.py` and `backend/app/models/fulfillment.py` were synchronized with the database schema changes, adding `UniqueConstraint` tuples to `__table_args__` and entity columns to all line-item models.
- **Backfill:** Existing historical rows in `sales_invoice_items` were backfilled with UUIDs and company/branch scoping from parent invoices.

---

## 8. Tests Executed
```bash
# Purchase Phase 2.1 Full Baseline Verification
pytest backend/app/tests/test_cross_handler_lifecycle.py backend/app/tests/test_universal_lifecycle.py backend/app/tests/test_approval_engine.py backend/app/tests/test_grn_attachments_lifecycle.py -q
# Target: 25 passed out of 25 (100% green)
```

---

## 9. Verification Results
- Database unique constraints verified via `pg_indexes` and `information_schema.table_constraints`:
  - `uq_sales_orders_company_order_no` ON `(company_id, order_no)`: VERIFIED
  - `uq_sales_invoices_company_invoice_no` ON `(company_id, invoice_no)`: VERIFIED
  - `uq_sales_quotations_company_quotation_no` ON `(company_id, quotation_no)`: VERIFIED
  - `uq_sales_returns_company_return_no` ON `(company_id, return_no)`: VERIFIED
  - `uq_packing_slips_company_num` ON `(company_id, packing_slip_number)`: VERIFIED
  - `uq_dispatches_company_num` ON `(company_id, dispatch_number)`: VERIFIED
- Column parity verified for `sales_order_items`, `sales_invoice_items`, `sales_return_items`, `sales_quotation_items`: 100% PARITY.
- Zero regressions in Purchase Phase 2.1.

---

## 10. Known Limitations
- Dual stock writer hazard in `FulfillmentEngine` remains present in code; targeted for elimination in Phase S2.
- Sales documents still bypass `UniversalLifecycleEngine`; targeted for implementation in Phase S3.

---

## 11. Future Work
- **Phase S2:** Stock Authority Convergence (eliminate double-deduction hazard in `FulfillmentEngine`).
- **Phase S3:** Implement `SalesOrderLifecycleHandler`, `SalesInvoiceLifecycleHandler`, `SalesReturnLifecycleHandler`.
- **Phase S4:** Sales Test Suite Modernization.

---

## 12. Related ADRs
- ADR-003: Universal Transaction Lifecycle Framework
- ADR-014: Authoritative Multi-Tenant Stock Movement Ledger

---

## 13. Related RFCs
- RFC-SALES-001: Sales Multi-Tenant Schema and Numbering Hardening
