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
  Classification: Implementation Plan
-->

# SMRITI Sales Architecture — Implementation Plan (Phases S1–S7)

**Plan ID:** SMRITI-IP-SALES-ALL-PHASES-v1.0  
**Area:** Sales & Commercial Operations  
**Version:** v1.0.0  
**Effective Date:** 2026-10-01  
**Status:** Completed  
**Alembic Revision:** `v1515_sales_schema_tenant_hardening`  

---

## 1. Objective
Implement all approved Sales architecture phases (Phases S1 through S7) end-to-end using the existing SMRITI Universal Document Lifecycle Framework and ledger architecture, while strictly preserving Purchase Phase 2.1 in a zero-regression state.

---

## 2. Business Motivation
Prior to this implementation, Sales operations contained disparate document handling pathways, lack of line item auditability, potential double-deduction risks when dispatches coincided with invoices, and absence of standardized 3-way matching. Unifying these workflows under the Universal Lifecycle Engine ensures compliance, data integrity, and multi-tenant commercial security.

---

## 3. Scope
- Phase S1: Schema and tenant hardening across sales orders, quotations, returns, invoices, packing slips, and dispatches.
- Phase S2: Canonical `SalesStockAuthority` with double-deduction prevention.
- Phase S3: Universal Lifecycle Handlers for Sales Order, Sales Quotation, Sales Invoice, Sales Return, and Fulfillment.
- Phase S4: Full sales regression verification across legacy and modern suites.
- Phase S5: 3-way line-level variance matching between order, fulfillment, and invoice.
- Phase S6: Financial GL posting for sales invoices, returns, credit notes, and cancellations.
- Phase S7: Multi-tenant isolation and optimistic concurrency certification.

---

## 4. Current State
- Migration `v1515` applied and verified.
- `SalesStockAuthority` implemented and verified.
- All domain handlers registered in `UniversalLifecycleEngine`.
- Test suites pass 100% (93/93 tests across Sales and Purchase invariant).

---

## 5. Gap Analysis
All identified gaps between legacy sales flows and the Universal Lifecycle Architecture have been closed:
- Replaced global document number uniqueness with composite tenant uniqueness.
- Elevated sales line items to full `BaseEntity` parity.
- Replaced uncoordinated stock modifications with atomic, locked `SalesStockAuthority` operations.
- Bound credit notes and cancellations to authoritative GL balancing entries.

---

## 6. Architecture Impact
- **Database:** Composite unique keys prevent cross-tenant numbering collisions.
- **Service Layer:** Standardized on `UniversalLifecycleEngine` executing registered handlers.
- **Inventory:** Synchronized with `stock_movements` as the authoritative source of truth.
- **Finance:** Integrated with `UnifiedAccountingLedgerService`.

---

## 7. Proposed Design
Domain lifecycle handlers subclass `BaseDocumentLifecycleHandler` and implement:
- `load_document`: Enforces multi-tenant isolation.
- `validate_transition`: Enforces state transitions, version checks, and 3-way variance matching.
- `apply_transition`: Performs atomic inventory updates via `SalesStockAuthority` and financial postings via `UnifiedAccountingLedgerService`.

---

## 8. Files Created
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

## 9. Files Modified
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

## 10. Dependencies
- PostgreSQL 14+ with composite index support.
- SQLAlchemy 2.0+ Async Engine.
- FastAPI with Pydantic validation.

---

## 11. Risks
- Concurrent operations on high-volume products: Mitigated via `SELECT ... FOR UPDATE` row locks and optimistic `version` columns.
- Double-deduction on dispatch: Mitigated via invoice movement lookup in `SalesStockAuthority.record_dispatch_outward`.

---

## 12. Rollback Strategy
All database modifications are tracked in Alembic migration `v1515`. Rollback procedure:
1. Revert application code on branch `smritiNX`.
2. Downgrade Alembic to previous revision `alembic downgrade -1`.
3. Note: No rollback required as all tests pass with zero regression.

---

## 13. Verification Plan
- Automated test execution across all sales test suites.
- Purchase Phase 2.1 cross-handler verification.
- Post-implementation forensic schema and AST audit.

---

## 14. Test Plan
- Unit and integration tests for stock movements: `test_sales_stock_authority.py`.
- Lifecycle engine transition tests: `test_universal_sales_lifecycle.py`.
- Full contract suites: `test_sales.py`, `test_sales_return_contracts.py`.
- Invariant regression suite: `test_cross_handler_lifecycle.py`.

---

## 15. Documentation Impact
- Created Implementation Plan and Walkthrough for Phases S1–S7.
- Created Master Implementation Completion Report in `docs/architecture/`.
- Updated master indices in `docs/implementation/README.md` and `docs/walkthrough/README.md`.
- Updated `CHANGELOG.md`.

---

## 16. Deployment Plan
1. Code committed to `smritiNX` upon approval of forensic audit.
2. Migrations applied via `alembic upgrade head`.
3. Deploy FastAPI backend and restart services.

---

## 17. Status
**Completed** — Verified with automated tests and architectural safety gates.

---

## 18. Related ADRs
- `ADR-0042`: SMRITI Universal Document Lifecycle Architecture
- `ADR-0043`: Authoritative Stock Ledger & Materialized Cache Synchronization Policy
- `ADR-0045`: Multi-Tenant Scoped Document Numbering

---

## 19. Related Walkthroughs
- `docs/walkthrough/sales/Sales_Architecture_Universal_Lifecycle_And_Stock_GL_Integration_Phases_S1_S7_v1.0.md`
