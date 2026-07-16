<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.18.2
  Created      : 2026-07-15
  Modified     : 2026-07-15
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# MC2 Phase 3 - Purchase CANCEL/AMEND/Supplier UPDATE+DELETE Walkthrough

## 1. Purpose

Migrate the Express/in-memory purchase mutation layer (PO Cancel, PO Amend,
Supplier Update, Supplier Delete) to the durable FastAPI + Postgres backend
as part of Master Command 2 (MC2) Strangler-Fig migration - Phase 3.

## 2. Scope

| Endpoint | Method | Classification |
|---|---|---|
| /purchase-orders/{id}/cancel | POST | Extend |
| /purchase-orders/{id}/amend  | POST | Extend |
| /suppliers/{id}              | PUT  | Extend |
| /suppliers/{id}              | DELETE | Extend |

## 3. Files Created

None - all additions extended existing files.

## 4. Files Modified

| File | Nature of Change |
|---|---|
| backend/app/schemas/purchase.py | Added SupplierUpdate, PurchaseOrderCancelRequest, PurchaseOrderAmendRequest |
| backend/app/services/purchase.py | Added update_supplier, delete_supplier, cancel_purchase_order, amend_purchase_order |
| backend/app/api/v1/purchase.py | Added PUT/DELETE /suppliers/{id}, POST /purchase-orders/{id}/cancel+amend |
| backend/app/tests/test_purchase.py | Appended 8 Phase 3 integration tests |

## 5. Architecture Decisions

### AD-6: PO Amend = cancel original + create new (not in-place edit)
Following Express behaviour exactly: the original PO is set to CANCELLED +
is_deleted=True, and a new CONFIRMED PO is created with the replacement items
and a notes field linking it to the original. The amendment PO id and order_no
are provided by the caller to allow client-controlled numbering conventions.

### AD-7: Supplier DELETE = soft-delete only
Suppliers may have PurchaseReceipts and PurchaseOrders referencing them with
ondelete=RESTRICT FK. Hard-deleting would violate referential integrity.
Soft-delete (is_deleted=True) hides the supplier from list/get without
touching FK constraints.

### AD-8: PO Cancel guard - RECEIVED is terminal
A PO with status=RECEIVED has already incremented stock. Cancellation is
blocked (400) to prevent orphaned stock movements. A return/debit note flow
is required in that case (future scope).

## 6. Design Rationale

Express purchase mutations operated on db_store.json with no referential
integrity. FastAPI implementation adds:
- Tenant isolation on all queries (company_id + branch_id)
- Soft-delete pattern consistent with all other SMRITI modules
- RECEIVED-terminal guard preventing accounting inconsistency
- Atomic cancel+create for amendment (DB transaction)

## 7. Implementation Summary

cancel_purchase_order():
  1. Fetch PO (404 if not found/already deleted)
  2. Guard: CANCELLED -> 400; RECEIVED -> 400
  3. Set status=CANCELLED, is_deleted=True, deleted_at=now()
  4. Append reason to notes if provided
  5. Commit and return success dict

amend_purchase_order():
  1. Fetch original PO (404 if not found)
  2. Guard: must be CONFIRMED, else 400
  3. Cancel original (status=CANCELLED, is_deleted=True)
  4. Build new PO items with server-side tax calculation
  5. Create new CONFIRMED PO with notes linking to original
  6. Commit atomically; return new PO with items

update_supplier():
  1. Fetch supplier (_get_supplier - 404 if deleted/not found)
  2. Patch only non-None fields from SupplierUpdate
  3. Update modified_at, commit, refresh, return

delete_supplier():
  1. Fetch supplier
  2. Set is_deleted=True, deleted_at=now()
  3. Commit and return success dict

## 8. Tests Executed

Command: python -m pytest app/tests/test_purchase.py -v

Result: 18 passed, 223 warnings in 11.16s

| Test | Result |
|---|---|
| test_cancel_purchase_order | PASS |
| test_cancel_nonexistent_po_returns_404 | PASS |
| test_cancel_already_cancelled_po_returns_400 | PASS |
| test_amend_purchase_order | PASS |
| test_amend_non_confirmed_po_returns_400 | PASS |
| test_update_supplier | PASS |
| test_delete_supplier_soft_deletes | PASS |
| test_delete_nonexistent_supplier_returns_404 | PASS |
| 10 pre-existing purchase tests | PASS |

Combined 3-module regression:
Command: python -m pytest app/tests/test_pos.py app/tests/test_sales.py app/tests/test_purchase.py

Result: 57 passed, 680 warnings in 34.75s

## 9. Verification Results

Evidence:
  Commit: e7bb89b - 4 files, +575 insertions, -4 deletions
  Terminal: 57/57 passed in 34.75s (POS 14 + Sales 25 + Purchase 18)

Interpretation:
  All 57 tests pass. No regressions introduced. The amend flow correctly
  validates status before cancellation and creates a fully calculated new PO.
  The supplier soft-delete correctly hides the supplier from GET/LIST queries
  via the existing is_deleted=False filter in _get_supplier and list_suppliers.

Recommendation:
  Next: Architectural Debt phase (datetime.utcnow deprecations, Pydantic
  class Config -> ConfigDict, on_event -> lifespan handlers). These are
  warnings-only but should be resolved before v4.0.

## 10. Known Limitations

1. PO Amend does not validate that new_order_no is unique before attempting
   commit (IntegrityError is caught and returns 400, but the error message
   is generic). A pre-check could improve UX.
2. No stock adjustment on PO cancel. If a GRN was already posted against
   the PO before cancel (status would be RECEIVED, blocked), this guard
   works. But partial receipts (status still CONFIRMED) are not explicitly
   handled.

## 11. Future Work

- Architectural Debt phase: utcnow, Pydantic v2, lifespan
- PO partial-receipt tracking (PARTIALLY_RECEIVED status)
- Stock reversal flow for cancelled/amended POs
- Supplier payment recording (POST /suppliers/{id}/pay)

## 12. Related ADRs

- ADR-001: FastAPI + Postgres as system of record
- ADR-002: Strangler-Fig migration order

## 13. Related RFCs

- MC2 Phase 0: Environment Verification (completed)
- HOTFIX-001: Global Authentication Enforcement (completed)
- MC2 Phase 1: POS Checkout Migration (completed)
- MC2 Phase 2: Sales UPDATE/DELETE/CANCEL (completed)
- MC2 Phase 3: Purchase CANCEL/AMEND/Supplier UPDATE+DELETE (this walkthrough)
