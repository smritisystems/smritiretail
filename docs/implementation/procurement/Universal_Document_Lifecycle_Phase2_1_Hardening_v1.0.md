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

# Implementation Plan: Universal Document Lifecycle Phase 2.1 Hardening

**Document ID:** IP-PROC-003  
**Version:** 1.0.0  
**Status:** In Progress  
**Created:** 2026-10-01  
**Author:** Jawahar Ramkripal Mallah <founder@aitdl.com>  

---

## 1. Objective
Harden the Universal Document Lifecycle Phase 2 procurement implementation by establishing atomic stock movement recording on Goods Receipt (GRN) `RECEIVE`, reversing stock on `CANCEL`, enforcing database-level unique constraints on `purchase_bills(company_id, bill_no)`, introducing the `purchase_bill_items` line-item table, and implementing line-level 3-way matching across Purchase Order, GRN, and Purchase Bill.

## 2. Business Motivation
The forensic audit of Phase 2 confirmed that while high-level document state machine transitions and engine genericity pass, deep domain consistency requires:
1. Physical inventory movements must be atomically committed when a GRN transitions to `RECEIVED`.
2. Stock must be reversed when a received GRN is cancelled.
3. Commercial purchase bills must support line-by-line verification against goods physically received and purchase orders contracted, preventing over-invoicing and fraudulent supplier billing.
4. Duplicate bill numbers per company must be impossible at the database constraint layer.

## 3. Scope
- Alembic migration `v1514`: Add DB unique constraint `uq_purchase_bills_company_bill_no` and create table `purchase_bill_items`.
- Model definitions: Update `PurchaseBill` with relationship and create `PurchaseBillItem` in `backend/app/models/purchase.py`.
- `GoodsReceiptLifecycleHandler`: Integrate atomic `StockMovement` creation on `action == "RECEIVE"` and stock reversal on `action == "CANCEL"`. Update linked PO status (`RECEIVED` vs `PARTIALLY_RECEIVED`) based on total received vs ordered quantity.
- `PurchaseBillLifecycleHandler`: Implement line-level 3-way match checking quantity and rate variances against linked PO and GRN line items.
- Regression testing: Expand test suites to cover stock movement atomicity, cancellation reversal, duplicate bill constraint enforcement, and 3-way match validation.

## 4. Current State
- `v1513` created `purchase_bills` with a non-unique composite index `ix_purchase_bills_company_bill_no`.
- `purchase_bills` is a header-only table without line items.
- `GoodsReceiptLifecycleHandler` mutates document status and PO status, but does not emit `stock_movements`.
- `ApprovalEngine` is verified with Tests A–H; production approval thresholds remain explicitly undefined pending business confirmation.

## 5. Gap Analysis
1. **Database Constraint:** Absence of `UNIQUE(company_id, bill_no)` allows duplicate bill numbers if `identity_code` is unset.
2. **Stock Ledger Disconnect:** `GoodsReceiptLifecycleHandler` transitions state without writing to the authoritative `stock_movements` ledger.
3. **Cancellation Reversal:** Cancelling a received GRN does not debit stock.
4. **3-Way Matching:** Header-only check fails to verify item-level prices and quantities.

## 6. Architecture Impact
- Enforces the core platform rule: **document status ≠ stock balance ≠ financial balance**.
- Preserves `UniversalLifecycleEngine` as completely document-type agnostic (0 doc_type branches).
- Upgrades Alembic lineage to single head `v1514_purchase_bills_hardening (head)`.

## 7. Proposed Design
1. **Migration `v1514`:**
   - Execute `op.create_unique_constraint("uq_purchase_bills_company_bill_no", "purchase_bills", ["company_id", "bill_no"])`.
   - Execute `op.create_table("purchase_bill_items", ...)` with Foreign Keys to `purchase_bills`, `products`, `items`, `purchase_order_items`, and `purchase_receipt_items`.
2. **GRN Inwarding & Reversal Hook:**
   - On `RECEIVE`: Create `StockMovement(movement_type="INWARD_GRN", quantity=item.quantity_received)` for each item with `commit=False`, allowing `UniversalLifecycleEngine` to commit document and ledger in a single atomic database transaction.
   - On `CANCEL`: If previously received, create `StockMovement(movement_type="RETURN_OUTWARD", quantity=item.quantity_received)` and reset PO status.
3. **3-Way Match Algorithm:**
   - For each bill item linked to `po_item_id` or matching product: verify `bill_item.quantity <= po_item.quantity` and `bill_item.rate <= po_item.cost_price`.
   - For each bill item linked to `receipt_item_id` or matching product: verify `bill_item.quantity <= receipt_item.quantity_received`.
   - Reject mismatches exceeding configured variance tolerance with `HandlerValidationException("3WAY_MISMATCH")`.

## 8. Files Created
- `backend/alembic/versions/v1514_purchase_bills_hardening.py`
- `docs/implementation/procurement/Universal_Document_Lifecycle_Phase2_1_Hardening_v1.0.md`

## 9. Files Modified
- `backend/app/models/purchase.py`: Added `PurchaseBillItem` and `UniqueConstraint`.
- `backend/app/models/__init__.py`: Exported `PurchaseBillItem`.
- `backend/app/services/lifecycle/handlers/goods_receipt.py`: Atomic stock movements and reversals.
- `backend/app/services/lifecycle/handlers/purchase_bill.py`: Line-level 3-way match validations.
- `backend/app/tests/test_cross_handler_lifecycle.py`: Extended tests for 3-way match, stock atomicity, and constraint.
- `docs/implementation/README.md`: Appended index.

## 10. Dependencies
- PostgreSQL 15+
- SQLAlchemy 2.0+ Async
- Alembic
- Existing `StockMovement` ledger

## 11. Risks
- Historical databases with duplicate `(company_id, bill_no)` could fail migration. *Mitigated by checking table row count before migration (currently 0 rows).*
- Performance of 3-way line matching for large orders. *Mitigated by indexed foreign keys and batch query loading.*

## 12. Rollback Strategy
- Alembic downgrade to `v1513_purchase_bills_table`.
- Git revert of handler modifications.

## 13. Verification Plan
- Column-by-column parity diff of `purchase_bill_items`.
- Terminal output of `alembic current` and `alembic heads` showing single head `v1514`.
- Literal test execution of `test_cross_handler_lifecycle.py` and `test_goods_receipt_lifecycle.py`.
- Assertion of `stock_movements` count before and after GRN `RECEIVE` and `CANCEL`.

## 14. Test Plan
1. Test unique constraint rejection on duplicate `(company_id, bill_no)`.
2. Test GRN `RECEIVE` creates exact `StockMovement` entries with `INWARD_GRN`.
3. Test GRN `CANCEL` creates exact reversing `StockMovement` entries with `RETURN_OUTWARD`.
4. Test Purchase Bill 3-way match allows valid bills and rejects quantity/price variance violations.

## 15. Documentation Impact
- Update `docs/architecture/SMRITI_DOCUMENT_LIFECYCLE_PHASE2_REPORT.md`.
- Update `CHANGELOG.md` and walkthrough index.

## 16. Deployment Plan
- Run `alembic upgrade head`.
- Verify database constraint via information_schema query.

## 17. Status
In Progress

## 18. Related ADRs
- ADR-003: Universal Transaction Lifecycle Framework
- ADR-014: Authoritative Multi-Tenant Stock Movement Ledger

## 19. Related Walkthroughs
- `docs/walkthrough/procurement/Universal_Document_Lifecycle_Phase2_GRN_PurchaseBill_v1.0.md`
