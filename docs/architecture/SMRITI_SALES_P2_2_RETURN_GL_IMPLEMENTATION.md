<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-10-02
  Modified     : 2026-10-02
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI SALES — P2.2 SALES RETURN GL & INVENTORY REVERSAL IMPLEMENTATION REPORT

**Document ID:** SMRITI-SALES-P2.2-IMPL-001  
**Status:** COMPLETE / VERIFIED  
**Phase:** P2.2 (Sales Return GL & Inventory Reversal)  
**Governing Architectural Policies:**  
- **BD-01:** Synchronous Fail-Fast + Atomic Rollback  
- **BD-02:** Perpetual Real-Time COGS Reversal  
- **UniversalLifecycleEngine Transaction Boundary:** Sole coordinator for transitions, events, hooks, and rollbacks  
- **SalesStockAuthority:** Sole authority for physical stock mutations and movements  
- **UnifiedAccountingLedgerService:** Sole authority for double-entry GL journals and accounts  

---

## 1. Executive Summary

Phase P2.2 implements complete atomicity and perpetual inventory reversal for the **Sales Return** lifecycle workflow (`DRAFT` / `APPROVED` -> `PROCESS` -> `PROCESSED`). 

Prior to P2.2, Sales Return transitions swallowed accounting errors inside an unmonitored `try/except` block, lacked perpetual real-time COGS reversal (DR Inventory Asset 1040, CR Cost of Goods Sold 5010), did not resolve return stock unit cost from original sales transaction cost snapshots, and permitted over-returns beyond original invoice quantities.

Under P2.2:
1. **Pessimistic Row Locking (`SELECT FOR UPDATE`):** Added to `SalesReturnHandler.get_document` to prevent race conditions and concurrent double-processing.
2. **Quantity Eligibility Validation:** Enforced in `SalesReturnHandler.validate_transition` prior to processing. Validates original invoice status (`POSTED`/`PAID`), item presence on invoice, and ensures cumulative returned quantity (`previous_processed_qty + new_return_qty`) does not exceed invoiced quantity. Violations trigger `SALES_RETURN_QTY_EXCEEDED`.
3. **Synchronous Fail-Fast & Complete Rollback (BD-01):** The silent `try/except` block in `SalesReturnHandler.apply_transition` has been permanently removed. Any failure in GL posting, account lookup, stock movement recording, or cache synchronization immediately raises an exception and aborts the entire transaction via `UniversalLifecycleEngine`.
4. **Perpetual Real-Time COGS Reversal (BD-02):** `UnifiedAccountingLedgerService.post_sales_return_to_gl` now posts balanced commercial reversal entries (DR Sales Returns 4020, DR Output Taxes 2021/2022/2023, CR Accounts Receivable 1030) **plus** perpetual inventory reversal entries:
   - **Debit:** Inventory Asset (`1040`) for `total_return_cogs`
   - **Credit:** Cost of Goods Sold (`5010`) for `total_return_cogs`
   - Both debit and credit legs strictly balance (`Total Debit == Total Credit`).
5. **Historical Cost Determination Hierarchy:** `SalesStockAuthority.record_return_inward` and `UnifiedAccountingLedgerService.post_sales_return_to_gl` now determine return unit cost from:
   - **Tier 1:** Historical `TransactionCostSnapshot` of the original invoice item (`orig_item.id`)
   - **Tier 2:** Active `ProductCostValuation` record
   - **Tier 3:** Product master `cost_price`
   - **Tier 4:** Fallback product `price` or `0.00`
   - Synchronizes stock cache via `StockSynchronizer.sync_product_stock_cache`.

---

## 2. Architectural Decisions & Boundary Specification

### 2.1 Transaction Boundary & Orchestration Flow

```text
HTTP Request: POST /api/v1/sales/returns/{id}/process
       │
       ▼
UniversalLifecycleEngine.execute_transition(db, doc_type="SALES_RETURN", doc_id, action="PROCESS", ctx)
       │
       ├─► 1. SalesReturnHandler.get_document(doc_id)
       │        └─► SELECT * FROM sales_returns WHERE id = :id FOR UPDATE; (Row locked)
       │
       ├─► 2. SalesReturnHandler.validate_transition(doc, "PROCESS", ctx)
       │        ├─► Check doc.original_invoice_id exists
       │        ├─► SELECT * FROM sales_invoices WHERE id = :orig_id; (Status must be POSTED or PAID)
       │        ├─► SELECT SUM(quantity) FROM sales_return_items WHERE return_status IN ('PROCESSED', 'COMPLETED')
       │        └─► Verify: sum(item.return_qty) + prev_returned_qty <= orig_invoice_qty
       │
       ├─► 3. SalesReturnHandler.apply_transition(doc, "PROCESS", ctx)
       │        │
       │        ├─► A. SalesStockAuthority.record_return_inward(db, doc, items, original_invoice_id)
       │        │        ├─► Resolve unit_cost via Tier 1-4 hierarchy
       │        │        ├─► INSERT INTO stock_movements (movement_type='SALES_RETURN_INWARD', ...)
       │        │        └─► StockSynchronizer.sync_product_stock_cache(db, product_id, warehouse_id)
       │        │
       │        └─► B. UnifiedAccountingLedgerService.post_sales_return_to_gl(db, doc, tenant_ctx)
       │                 ├─► Commercial Leg: DR Sales Returns 4020, DR Output Taxes, CR AR 1030
       │                 ├─► COGS Leg (BD-02): DR Inventory Asset 1040, CR COGS 5010
       │                 ├─► Verify Invariant: Total Debit == Total Credit
       │                 ├─► INSERT INTO journal_vouchers, general_ledger_entries
       │                 └─► Stamp credit_note_number on sales_returns
       │
       ├─► 4. UniversalLifecycleEngine writes WorkflowEvent audit trail
       │
       └─► 5. COMMIT transaction
             (On ANY error at steps 1-4: complete atomic ROLLBACK, no dirty stock, no phantom GL)
```

---

## 3. Financial Double-Entry Accounting Matrix

### 3.1 Credit Note & COGS Reversal Journal Entries

For a sales return of basic amount ₹1,000.00, intra-state CGST ₹90.00 (9%), SGST ₹90.00 (9%), total gross refund ₹1,180.00, and original COGS ₹600.00:

| Entry Type | Account Code | Account Name | Debit (₹) | Credit (₹) | Explanation |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Commercial** | `4020` / `4010` | Sales Returns / Revenue Contra | 1,000.00 | — | Reverses recognized revenue |
| **Commercial** | `2021` | Output CGST Payable | 90.00 | — | Reverses tax liability to government |
| **Commercial** | `2022` | Output SGST Payable | 90.00 | — | Reverses tax liability to government |
| **Commercial** | `1030` | Accounts Receivable / Customer | — | 1,180.00 | Reduces customer balance / issues credit |
| **Inventory (BD-02)** | `1040` | Inventory Asset | 600.00 | — | Re-capitalizes returned stock asset |
| **Inventory (BD-02)** | `5010` | Cost of Goods Sold | — | 600.00 | Reverses cost of goods sold expense |
| **TOTAL** | | | **1,780.00** | **1,780.00** | **Zero-Difference Invariant Preserved** |

### 3.2 Interstate Tax Handling
When `is_interstate = True`:
- Debit: Output IGST Payable (`2023`)
- Debit: Sales Returns (`4020`)
- Credit: Accounts Receivable (`1030`)

---

## 4. Costing & Stock Valuation Hierarchy

When returned goods are brought back into inventory, their asset valuation cannot use arbitrary numbers or current market rates; it must reflect the original cost of goods sold.

`SalesStockAuthority.record_return_inward` and `UnifiedAccountingLedgerService.post_sales_return_to_gl` evaluate the cost hierarchy:

```text
[Returned Line Item]
         │
         ▼
[Tier 1: Historical Cost Snapshot]
   Query TransactionCostSnapshot WHERE reference_type = 'SALES_INVOICE'
   AND reference_id = original_invoice_id AND product_id = item.product_id
   Found? ──► YES ──► Use snapshot.unit_cost (Method: SNAPSHOT)
         │ NO
         ▼
[Tier 2: Product Valuation Table]
   Query ProductCostValuation WHERE product_id = item.product_id
   Found? ──► YES ──► Use valuation.average_cost / fifo_cost (Method: VALUATION)
         │ NO
         ▼
[Tier 3: Product Master Cost Price]
   Check product.cost_price
   Positive? ─► YES ─► Use product.cost_price (Method: PRODUCT_COST)
         │ NO
         ▼
[Tier 4: Product Master Sale Price or Zero]
   Fallback to product.price or Decimal("0.00") (Method: PRODUCT_PRICE / ZERO)
```

---

## 5. Scope of Code Changes

### 5.1 Modified Files
1. `backend/app/services/lifecycle/handlers/sales_return.py`:
   - Enforced pessimistic row lock (`.with_for_update()`) on `SalesReturn` in `get_document`.
   - Added comprehensive return quantity eligibility validation in `validate_transition` before `PROCESS`.
   - Removed silent try/except block in `apply_transition`; now allows GL exceptions to propagate synchronously to `UniversalLifecycleEngine`.
   - In `apply_transition(CANCEL)`: set `doc.reason = ctx.notes` (safe fallback) without touching non-existent `notes` attribute.
   - Forwarded `original_invoice_id=doc.original_invoice_id` to `SalesStockAuthority.record_return_inward`.
2. `backend/app/services/sales_stock_authority.py`:
   - Updated `record_return_inward` to accept `original_invoice_id: Optional[str] = None`.
   - Resolved `unit_cost` via the Tier 1-4 costing hierarchy.
   - Stamped costing method into `StockMovement.remarks`.
   - Maintained read-cache consistency via `StockSynchronizer.sync_product_stock_cache`.
3. `backend/app/services/unified_ledger.py`:
   - Extended `post_sales_return_to_gl` with perpetual real-time COGS reversal:
     - DR Inventory Asset (`1040`) for `total_return_cogs`
     - CR Cost of Goods Sold (`5010`) for `total_return_cogs`
   - Balanced double-entry invariant enforced before persistence.
   - Credit note document numbering stamped on `SalesReturn.credit_note_number`.
4. `backend/app/tests/test_universal_sales_lifecycle.py`:
   - Enhanced fixture in `test_sales_return_processing_restocks_and_credit_note` to attach a valid `SalesInvoiceItem` to `orig_inv` to satisfy P2.2 quantity eligibility checks.

### 5.2 Created Files
1. `backend/app/tests/test_p2_2_return_gl_atomicity.py`:
   - Comprehensive 15-test suite verifying atomicity, double-entry equality, COGS reversal, costing hierarchy, partial returns, over-return rejection, idempotency, concurrent locking, failure rollbacks, tenant isolation, and cancellation safety.
2. `docs/architecture/SMRITI_SALES_P2_2_RETURN_GL_FORENSIC_AUDIT.md`:
   - Phase 0 forensic audit document.
3. `docs/architecture/SMRITI_SALES_P2_2_RETURN_GL_IMPLEMENTATION.md`:
   - This document.

---

## 6. Verification Test Results (189/189 Green)

All 9 test suites covering sales lifecycle, return contracts, invoice atomicity, stock authority, and purchase workflows were executed and passed with zero errors or failures.

| Test Suite File | Tests Run | Passed | Failed | Status |
| :--- | :---: | :---: | :---: | :---: |
| `app/tests/test_p2_2_return_gl_atomicity.py` | 15 | 15 | 0 | **PASSED** |
| `app/tests/test_universal_sales_lifecycle.py` | 10 | 10 | 0 | **PASSED** |
| `app/tests/test_sales_return_contracts.py` | 32 | 32 | 0 | **PASSED** |
| `app/tests/test_sales_stock_authority.py` | 13 | 13 | 0 | **PASSED** |
| `app/tests/test_p2_1_invoice_gl_atomicity.py` | 8 | 8 | 0 | **PASSED** |
| `app/tests/test_sales.py` | 36 | 36 | 0 | **PASSED** |
| `app/tests/test_cross_handler_lifecycle.py` | 9 | 9 | 0 | **PASSED** |
| `app/tests/test_grn.py` | 4 | 4 | 0 | **PASSED** |
| `app/tests/test_purchase.py` | 62 | 62 | 0 | **PASSED** |
| **TOTAL REGRESSION SUITE** | **189** | **189** | **0** | **ALL GREEN** |

### 6.1 P2.2 Specific Test Cases Breakdown
- `test_normal_return_stock_and_gl`: Verifies stock inward and credit note creation.
- `test_balanced_credit_note`: Verifies strict `Total Debit == Total Credit`.
- `test_cogs_reversal`: Verifies DR Inventory Asset (1040) and CR COGS (5010) lines.
- `test_historical_transaction_cost_snapshot_cost`: Verifies Tier 1 cost snapshot retrieval.
- `test_fallback_cost`: Verifies fallback to `ProductCostValuation` and `cost_price`.
- `test_partial_return`: Verifies partial return and remaining quantity calculation.
- `test_over_return_rejection`: Verifies rejection with `SALES_RETURN_QTY_EXCEEDED`.
- `test_repeated_return_idempotency`: Verifies rejection of already processed returns.
- `test_concurrent_return_protection`: Verifies pessimistic row locking (`with_for_update()`).
- `test_gl_failure_rollback`: Verifies no stock movement or orphan record remains on GL failure.
- `test_stock_failure_rollback`: Verifies complete rollback on stock movement failure.
- `test_missing_account_rollback`: Verifies complete rollback when GL account is absent.
- `test_workflow_failure_rollback`: Verifies complete rollback if workflow event audit fails.
- `test_tenant_isolation`: Verifies cross-tenant return processing is strictly forbidden.
- `test_cancellation_reversal_safety`: Verifies safety controls on cancellation.

---

## 7. Database Safety & Zero Migration Verification

1. **Alembic Migration Lineage:**
   - Head revision checked: `v1515_sales_schema_tenant_hardening (head)`.
   - New migrations created: **0**.
   - Schema modifications required: **None** (all existing models `SalesReturn`, `StockMovement`, `JournalVoucher`, `GeneralLedgerEntry` already possessed the required columns).
2. **Database Cleanliness (`smriti001`):**
   - Verified row counts in core tables: no test artifacts or orphaned records were committed to `smriti001`.
   - All tests executed against isolated ephemeral test databases.

---

## 8. Conclusion & Final Verdict

The P2.2 Sales Return GL & Inventory Reversal implementation is complete, verified by 189 passing tests, fully aligned with BD-01 (synchronous fail-fast atomicity) and BD-02 (perpetual real-time COGS), introduces zero schema drift, and maintains complete multi-tenant isolation.

**FINAL VERDICT:**
# `P2.2 IMPLEMENTATION PASS`
