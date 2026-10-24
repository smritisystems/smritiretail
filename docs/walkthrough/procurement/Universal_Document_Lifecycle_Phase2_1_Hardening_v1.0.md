<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Branch       : smritiNX

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 1.0.0
  * Created    : 2026-10-01
  * Modified   : 2026-10-01
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Universal Document Lifecycle Phase 2.1 Hardening

**Document ID:** WT-PROC-003  
**Version:** 1.0.0  
**Created:** 2026-10-01  
**Author:** Jawahar Ramkripal Mallah <founder@aitdl.com>  

---

## 1. Purpose
Documents the domain hardening of the SMRITI Universal Document Lifecycle Phase 2 procurement framework. This phase resolves four critical gaps identified during the forensic audit: (1) database-level unique constraint on `(company_id, bill_no)`, (2) atomic inventory stock movements on GRN receipt, (3) proper stock movement reversal on GRN cancellation, and (4) line-level 3-way quantity/rate matching across PO, GRN, and Purchase Bill.

## 2. Scope
- Alembic Migration `v1514_purchase_bills_hardening`: Enforces unique constraint `uq_purchase_bills_company_bill_no` and creates `purchase_bill_items` table.
- Models: Updated `PurchaseBill` and created `PurchaseBillItem` with full BaseEntity column parity. Added `items` relationship to `PurchaseOrder`.
- `GoodsReceiptLifecycleHandler`: Wired atomic `StockMovement` creation (`INWARD_GRN`) on `RECEIVE`, stock reversal (`RETURN_OUTWARD`) on `CANCEL`, and bidirectional PO status synchronization (`PARTIALLY_RECEIVED` vs `RECEIVED` vs `CONFIRMED`).
- `PurchaseBillLifecycleHandler`: Implemented strict line-item 3-way variance matching against linked Purchase Orders and Goods Receipts.
- Regression & Acceptance Testing: Extended `test_cross_handler_lifecycle.py` with 4 new automated tests covering all hardened invariants (9/9 passed).

## 3. Files Created
- `backend/alembic/versions/v1514_purchase_bills_hardening.py`
- `docs/implementation/procurement/Universal_Document_Lifecycle_Phase2_1_Hardening_v1.0.md`
- `docs/walkthrough/procurement/Universal_Document_Lifecycle_Phase2_1_Hardening_v1.0.md`

## 4. Files Modified
- `backend/app/models/purchase.py`: Added `PurchaseBillItem` entity, `items` relationship on `PurchaseBill` and `PurchaseOrder`, and `UniqueConstraint`.
- `backend/app/models/__init__.py`: Exported `PurchaseBillItem`.
- `backend/app/services/lifecycle/exceptions.py`: Enhanced `HandlerValidationException` with `self.code` attribute.
- `backend/app/services/lifecycle/handlers/goods_receipt.py`: Atomic stock ledger inwarding, cancellation reversal, and PO status synchronization.
- `backend/app/services/lifecycle/handlers/purchase_bill.py`: Line-level 3-way variance matching and eager item loading.
- `backend/app/tests/test_cross_handler_lifecycle.py`: Added 4 tests for duplicate constraint, GRN stock atomicity, cancellation reversal, and 3-way match.
- `docs/implementation/README.md`: Appended master implementation plan index.
- `docs/walkthrough/README.md`: Appended master walkthrough index.
- `CHANGELOG.md`: Recorded Phase 2.1 hardening.

## 5. Architecture Decisions
1. **Application Mutation Path Over DB Triggers:** In accordance with architectural governance feedback, immutable locks on posted bills are enforced via the `UniversalLifecycleEngine` state machine rather than intrusive database-level triggers.
2. **Authoritative Stock Movement Ledger Integration:** Goods Receipt transitions directly record immutable `StockMovement` rows (`INWARD_GRN` on receipt, `RETURN_OUTWARD` on cancellation) using the existing authoritative ledger without introducing duplicate ledger models.
3. **Decoupled Quantity Aggregation:** PO status synchronization relies on direct SQL `func.sum()` queries on active lines, preventing N+1 queries and ensuring resilience against detached ORM instances.
4. **Line-Level 3-Way Match Tolerances:** Line item matching validates quantity and rate tolerances, rejecting bills exceeding ordered quantities (`3WAY_QTY_EXCEEDED`), exceeding received quantities, or exceeding agreed prices (`3WAY_RATE_EXCEEDED`).

## 6. Design Rationale
- Physical goods receipt without stock ledger mutations causes phantom inventory and uncoordinated warehouse balances. Binding `StockMovement` creation to the `RECEIVE` transition inside `UniversalLifecycleEngine.execute_transition` ensures document status and physical stock commit or roll back together.
- Cancelled goods receipts must reverse physical stock to prevent persistent inventory overstatement.
- Commercial supplier invoices require line-item reconciliation against both purchase orders (rate and quantity commitment) and goods receipts (physical quantity delivery) to prevent supplier over-billing.

## 7. Implementation Summary
- **Migration `v1514`:** Created unique constraint `uq_purchase_bills_company_bill_no` and table `purchase_bill_items` with indexed foreign keys.
- **Stock Movements on GRN:** In `GoodsReceiptLifecycleHandler.apply_transition`, `StockMovement` rows are added to `db` with `INWARD_GRN` on `action == "RECEIVE"`. If previously received, `action == "CANCEL"` adds reversing `RETURN_OUTWARD` rows and reverts PO status to `CONFIRMED`.
- **3-Way Match on Bill:** In `PurchaseBillLifecycleHandler.validate_transition`, if `items` are present, lines are cross-referenced with `PurchaseOrderItem` and `PurchaseReceiptItem`. Quantity and rate violations immediately raise `HandlerValidationException`.

## 8. Tests Executed
```bash
pytest backend/app/tests/test_cross_handler_lifecycle.py -q
# Output: 9 passed, 14 warnings in 45.13s

pytest backend/app/tests/test_universal_lifecycle.py -q
# Output: 7 passed, 14 warnings in 46.94s

pytest backend/app/tests/test_approval_engine.py -q
# Output: 8 passed, 14 warnings in 39.60s

pytest backend/app/tests/test_grn_attachments_lifecycle.py -q
# Output: 1 passed, 14 warnings in 37.87s

python scripts/db_safety_check.py
# Output: 6/6 integrity checks passed

npx tsc --noEmit
# Output: 0 errors (clean exit 0)
```

## 9. Verification Results
- Database unique constraint `uq_purchase_bills_company_bill_no` rejected duplicate `(company_id, bill_no)` with PostgreSQL `IntegrityError`.
- GRN `RECEIVE` created 1 `StockMovement` with `INWARD_GRN` and moved PO to `RECEIVED`.
- GRN `CANCEL` created 1 `StockMovement` with `RETURN_OUTWARD` and reverted PO to `CONFIRMED`.
- 3-Way match rejected bill quantity > PO quantity, rejected bill rate > PO cost price, rejected bill quantity > GRN received quantity, and approved matching bill.

## 10. Known Limitations
- General Ledger double-entry posting (`gl_entries`) for purchase bills remains deferred until General Ledger journal posting services are connected.
- Numeric approval threshold policies remain pending business management confirmation.

## 11. Future Work
- Connect `PurchaseBillLifecycleHandler` to the General Ledger double-entry voucher engine.
- Seed production `approval_policies` upon receipt of authorized business limits.

## 12. Related ADRs
- ADR-003: Universal Transaction Lifecycle Framework
- ADR-014: Authoritative Multi-Tenant Stock Movement Ledger

## 13. Related RFCs
- RFC-PROC-002: Procurement 3-Way Variance Matching Engine
