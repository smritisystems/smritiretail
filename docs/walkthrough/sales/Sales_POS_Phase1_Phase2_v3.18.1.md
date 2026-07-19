<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.18.1
  Created      : 2026-07-15
  Modified     : 2026-07-15
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# MC2 Phase 1 and Phase 2 - Sales/POS Checkout Migration Walkthrough

## 1. Purpose

Migrate the Express/in-memory sales transactional layer (POS Checkout, Sales Invoice
UPDATE/DELETE, Sales Quotation/Order/Return UPDATE/DELETE) to the durable FastAPI +
Postgres backend as part of Master Command 2 (MC2) - Strangler-Fig migration.

## 2. Scope

| Phase | Endpoints Migrated | Classification |
|---|---|---|
| Phase 1 | POST /api/v1/pos/checkout | Create |
| Phase 2 | PUT/DELETE /api/v1/sales-invoices/{id} | Extend |
| Phase 2 | PUT/DELETE /api/v1/sales-invoices/quotations/{id} | Extend |
| Phase 2 | PUT/DELETE /api/v1/sales-invoices/orders/{id} | Extend |
| Phase 2 | PUT/DELETE /api/v1/sales-invoices/returns/{id} | Extend |

## 3. Files Created

None - all additions extended existing files.

## 4. Files Modified

| File | Nature of Change |
|---|---|
| backend/app/schemas/pos.py | Added POSCheckoutItem, POSCheckoutRequest, POSCheckoutResponse |
| backend/app/services/pos.py | Added pos_checkout() - shift validation, idempotency, stock deduction, StockMovement |
| backend/app/api/v1/pos.py | Added POST /pos/checkout endpoint |
| backend/app/tests/test_pos.py | Added 4 POS checkout integration tests |
| backend/app/services/sales.py | Added 8 update/cancel/delete methods; added sqlalchemy delete import + 4 Update schema imports |
| backend/app/api/v1/sales.py | Full rewrite: added PUT+DELETE for all 4 entities; added Update schema imports |
| backend/app/tests/test_sales.py | Appended 9 Phase 2 tests (including _make_manager helper) |

## 5. Architecture Decisions

### AD-1: POS Checkout - idempotency via invoice_no unique constraint + IntegrityError guard
Pre-insert invoice_no check + IntegrityError catch at commit provides race-safe idempotency
without explicit locking. Matches the pattern already used in create_sales_invoice.

### AD-2: POS Checkout - stock deduction per item, StockMovement recorded
Each checkout item deducts quantity from Product.stock and creates a StockMovement row
(type OUT, source POS) within the same DB transaction. Atomic: partial stock deductions
are impossible (all-or-nothing on rollback).

### AD-3: Invoice CANCEL = soft-delete (not hard DELETE)
DELETE /api/v1/sales-invoices/{id} sets status=Cancelled and is_deleted=True.
No hard row deletion. Mirrors Express behaviour. Financial audit trail must be preserved.
Accounting reversal is handled separately via Sales Returns.

### AD-4: Invoice UPDATE - item replacement via delete-orphan cascade
Using raw execute(delete(SalesInvoiceItem).where(...)) leaves stale objects in the
SQLAlchemy session identity map; the unit-of-work re-inserts them on commit causing
IntegrityError. Decision: Reassign invoice.items = [new_items_list]. The
cascade=all,delete-orphan relationship handles DELETE of old rows and INSERT of new rows
in the correct order. This is the idiomatic SQLAlchemy ORM pattern.

### AD-5: RBAC for mutating operations
PUT and DELETE on all entities require MANAGER or SYSADMIN role.
Create (POST) continues to allow CASHIER.

## 6. Design Rationale

The Express implementations used in-memory arrays and no FK constraints.
The FastAPI implementation adds: tenant isolation, soft-delete, modified_at timestamp,
server-side total recalculation, and atomic stock deduction.

## 7. Implementation Summary

Phase 1 - POS Checkout:
  1. Validate shift is OPEN
  2. Check invoice_no uniqueness (idempotency)
  3. For each item: deduct stock, record StockMovement
  4. Apply bill-level discount (flat or percent)
  5. Persist SalesInvoice with shift_id set
  6. On IntegrityError at commit: rollback, return existing invoice

Phase 2 - Sales Mutations:
  - update_*() methods: partial patch of scalar fields; if items supplied, collection
    is replaced via delete-orphan cascade and totals recalculated
  - cancel_sales_invoice(): sets status=Cancelled, is_deleted=True
  - delete_sales_*() (quotation/order/return): sets is_deleted=True

## 8. Tests Executed

Command: python -m pytest app/tests/test_pos.py app/tests/test_sales.py -v

Result: 39 passed, 480 warnings in 25.92s

Phase 1 - 14 tests (4 new + 10 pre-existing): ALL PASSED
Phase 2 - 25 tests (9 new + 16 pre-existing): ALL PASSED
Combined: 39/39 PASSED

## 9. Verification Results

Evidence:
  Phase 1 commit: bd90fc0 - 6 files, +495 insertions
  Phase 2 commit: 2cdc60e - 3 files, +708 insertions
  Terminal: 39 passed, 480 warnings in 25.92s

Interpretation:
  All 39 tests pass. The item-replacement IntegrityError root-cause (stale ORM identity
  map with bulk delete()) was identified and corrected with the delete-orphan cascade
  collection-reassignment pattern.

Recommendation:
  Proceed to Phase 3: Purchase module UPDATE/DELETE/CANCEL, OR address architectural
  debt items before expanding scope.

## 10. Known Limitations

1. Invoice UPDATE - no stock reversal: Modifying items on a posted invoice does not
   reverse/re-deduct stock. Intentional (matching Express behaviour).
2. Sales Return UPDATE - no stock re-adjustment on item change. Same caveat.
3. datetime.utcnow() deprecations: 165 warnings across tests. Planned for Architectural Debt phase.
4. Pydantic v1 class Config deprecations: 170+ warnings. Planned for Architectural Debt phase.

## 11. Future Work

- Phase 3: Purchase module UPDATE/DELETE/CANCEL (Extend classification)
- Architectural Debt: datetime.utcnow() to datetime.now(timezone.utc)
- Architectural Debt: Pydantic class Config to model_config = ConfigDict(...)
- Architectural Debt: @app.on_event to lifespan handlers
- Stock-adjustment flow for invoice updates
- E-Invoice / GSTN integration in FastAPI (compliance gateway)

## 12. Related ADRs

- ADR-001: FastAPI + Postgres as system of record (Backend System-of-Record Policy)
- ADR-002: Strangler-Fig migration order (SMRITI Platform Abstraction Layer)

## 13. Related RFCs

- MC2 Phase 0: Environment Verification (completed)
- HOTFIX-001: Global Authentication Enforcement (completed)
- MC2 Phase 1: POS Checkout Migration (this walkthrough)
- MC2 Phase 2: Sales UPDATE/DELETE/CANCEL Migration (this walkthrough)
