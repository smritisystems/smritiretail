<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.49.0
  Created      : 2026-10-01
  Modified     : 2026-10-01
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough Document
-->

# SMRITI Sales Architecture — Universal Lifecycle & Stock/GL Integration (Phases S1–S7)

**Document ID:** SMRITI-WT-SALES-ALL-PHASES-v1.0  
**Area:** Sales & Commercial Operations  
**Version:** v1.0.0  
**Effective Date:** 2026-10-01  
**Alembic Revision:** `v1515_sales_schema_tenant_hardening`  
**Baseline Principle:** Purchase Phase 2.1 is **FROZEN & ISOLATED** (9/9 Cross-Handler Tests Passing).  

---

## 1. Purpose
This walkthrough documents the comprehensive end-to-end technical implementation of all approved Sales architecture phases (Phases S1 through S7). It details how the entire Sales subsystem was converged onto the canonical SMRITI Universal Document Lifecycle Framework, unified inventory ledgering (`SalesStockAuthority`), and authoritative double-entry general ledger posting (`UnifiedAccountingLedgerService`).

---

## 2. Scope
- Phase S1: Database schema and multi-tenant composite uniqueness hardening (`v1515`).
- Phase S2: Canonical `SalesStockAuthority` engine with double-deduction prevention.
- Phase S3: Universal Lifecycle Handlers for `SalesOrder`, `SalesQuotation`, `SalesInvoice`, `SalesReturn`, `PackingSlip`, and `Dispatch`.
- Phase S4: Full sales regression certification across contracts and workflows.
- Phase S5: 3-way line-level variance matching between Sales Order, Fulfillment, and Sales Invoice.
- Phase S6: Financial credit note and sales cancellation GL voucher posting.
- Phase S7: Multi-tenant isolation and optimistic concurrency verification.

---

## 3. Files Created
1. `backend/alembic/versions/v1515_sales_schema_tenant_hardening.py`
2. `backend/app/services/sales_stock_authority.py`
3. `backend/app/services/lifecycle/handlers/sales_order.py`
4. `backend/app/services/lifecycle/handlers/sales_quotation.py`
5. `backend/app/services/lifecycle/handlers/sales_invoice.py`
6. `backend/app/services/lifecycle/handlers/sales_return.py`
7. `backend/app/services/lifecycle/handlers/fulfillment.py`
8. `backend/app/tests/test_sales_stock_authority.py`
9. `backend/app/tests/test_universal_sales_lifecycle.py`
10. `docs/architecture/SMRITI_SALES_IMPLEMENTATION_COMPLETION_REPORT.md`
11. `docs/implementation/sales/Sales_Architecture_Universal_Lifecycle_And_Stock_GL_Integration_Phases_S1_S7_v1.0.md`
12. `docs/walkthrough/sales/Sales_Architecture_Universal_Lifecycle_And_Stock_GL_Integration_Phases_S1_S7_v1.0.md`

---

## 4. Files Modified
1. `backend/app/models/sales.py`
2. `backend/app/models/fulfillment.py`
3. `backend/app/models/__init__.py`
4. `backend/app/schemas/sales.py`
5. `backend/app/services/sales.py`
6. `backend/app/services/canonical_sales_writer.py`
7. `backend/app/services/stock_synchronizer.py`
8. `backend/app/services/unified_ledger.py`
9. `backend/app/services/lifecycle/handlers/__init__.py`
10. `backend/app/tests/test_sales_return_contracts.py`
11. `docs/implementation/README.md`
12. `docs/walkthrough/README.md`
13. `CHANGELOG.md`

---

## 5. Architecture Decisions
1. **Single Source of Inventory Truth:** `SalesStockAuthority` serves as the sole gateway for all outward deliveries, customer returns, invoice deductions, and cancellation rollbacks. Direct mutations of `products.stock` without recording `StockMovement` are prohibited.
2. **Double-Deduction Prevention Architecture:** When dispatch manifests are issued for previously posted invoices, `SalesStockAuthority` detects the prior `OUTWARD_SALE` movement and bypasses redundant physical stock deductions while updating the delivery status.
3. **Double-Entry Balancing for Credit Notes:** Credit notes debit Sales Revenue (4010) and Output Tax ledgers (2021, 2022, 2023) and credit Accounts Receivable (1030). Any fractional variance is routed to Roundoff (5030).
4. **Tenant-Scoped Document Numbering:** Document sequence numbers are unique per tenant `(company_id, document_no)`.

---

## 6. Design Rationale
- **Deterministic Domain Lifecycle:** Encapsulating state transitions within dedicated domain handlers guarantees that business rules, stock checks, and GL entries are consistently applied regardless of the API entry point (B2B Dispatch, POS, Speed Invoice, or EDI).
- **Soft-Delete Safety Invariant:** Business lifecycle transitions explicitly enforce `is_deleted = False` and increment `version`, completely preventing accidental soft-deletion during status updates.

---

## 7. Implementation Summary
- **Migration `v1515`:** Replaced global unique constraints with composite company constraints and added audit columns to all four sales line item tables.
- **Stock Authority:** Implemented `record_outward_sale`, `record_return_inward`, `record_sales_cancellation_reversal`, and `record_dispatch_outward` with row locking and idempotency guards.
- **Handlers:** Built handlers for Sales Order, Sales Quotation, Sales Invoice, Sales Return, Packing Slip, and Dispatch.
- **GL Posting:** Added `post_sales_return_to_gl` to `UnifiedAccountingLedgerService`.
- **Safety Gates:** Implemented comprehensive automated test coverage for stock authority, lifecycle transitions, concurrency, multi-tenancy, and 3-way matching.

---

## 8. Tests Executed
1. `pytest backend/app/tests/test_universal_sales_lifecycle.py -v` (10 tests)
2. `pytest backend/app/tests/test_sales_stock_authority.py -v` (6 tests)
3. `pytest backend/app/tests/test_sales.py -v` (36 tests)
4. `pytest backend/app/tests/test_sales_return_contracts.py -v` (32 tests)
5. `pytest backend/app/tests/test_cross_handler_lifecycle.py -v` (9 tests - Purchase Invariant)

---

## 9. Verification Results
- **Sales Lifecycle:** 10/10 Passed (100%)
- **Sales Stock Authority:** 6/6 Passed (100%)
- **Sales API & Service Contracts:** 36/36 Passed (100%)
- **Sales Return & Refund Contracts:** 32/32 Passed (100%)
- **Purchase Cross-Handler Lifecycle:** 9/9 Passed (100%)
- **Total Tests Passing:** 93/93 Passed (100%)

---

## 10. Known Limitations
- Monetary thresholds and multi-tiered manager approval matrices remain pending official business policy specification; handlers enforce actor tenant authorization pending matrix definition.

---

## 11. Future Work
- Real-time stock reservation expiration background jobs for abandoned draft sales orders.
- Native WhatsApp/SMS delivery tracking integration hooks for dispatched manifests.

---

## 12. Related ADRs
- `ADR-0042`: SMRITI Universal Document Lifecycle Architecture
- `ADR-0043`: Authoritative Stock Ledger & Materialized Cache Synchronization Policy
- `ADR-0045`: Multi-Tenant Scoped Document Numbering

---

## 13. Related RFCs
- `RFC-2026-07-S1`: Sales Schema and Line Item BaseEntity Normalization
- `RFC-2026-07-S2`: Unified Sales Stock Movement Authority
