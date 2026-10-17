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

# SMRITI SALES — P2.2 SALES RETURN GL & INVENTORY REVERSAL
## POST-IMPLEMENTATION INDEPENDENT FORENSIC AUDIT REPORT

**Audit Objective:** Independent Read-Only Post-Implementation Forensic Verification of P2.2 Sales Return GL & Perpetual Inventory/COGS Reversal  
**Governing Standard:** `SMRITI_SALES_P2_ACCOUNTING_DECISION_FREEZE.md` (BD-01, BD-02)  
**Execution Date:** 2026-10-02  
**Lead Architect & Forensic Auditor:** Jawahar Ramkripal Mallah  
**Classification:** Internal Quality & Architectural Assurance  
**Operating Mode:** STRICT READ-ONLY (No code, database, test, or git modifications)  
**Final Audit Verdict:** **`P2.2 FORENSIC PASS`**

---

## 1. Executive Summary

This forensic audit independently examines the completed implementation of Phase P2.2: Sales Return GL & Inventory Reversal. 

All 14 forensic audit dimensions specified in the audit mandate were inspected:
1. **Git/Change Forensics:** Exact P2.2 changes identified; zero unrelated or cross-module edits (no Purchase, GRN, or P2.1 files touched).
2. **Sales Return Accounting:** Real-time double-entry GL posting verified with exact debit-credit equality (`Total Debit == Total Credit`).
3. **Historical COGS Determination:** Perpetual real-time COGS reversal (DR Inventory Asset 1040, CR Cost of Goods Sold 5010) resolved through the authoritative 4-tier cost snapshot hierarchy. Zero synthetic or random cost invented.
4. **Physical Stock Restocking:** Authoritative restock handled exclusively via `SalesStockAuthority.record_return_inward` with `with_for_update()` row locking, batch-level updates, and synchronized materialized cache.
5. **Return Quantity Eligibility:** Over-return prevention enforced at the lifecycle boundary against original invoice lines and cumulative prior returns (`SALES_RETURN_QTY_EXCEEDED`).
6. **Transaction Atomicity (BD-01):** Failure at any point (stock inward, GL voucher generation, missing account, workflow event logging) triggers complete synchronous rollback with zero dirty state or phantom records.
7. **Idempotency:** State graph transitions and repository idempotency guards prevent duplicate vouchers or duplicate stock movements on repeated/concurrent processing.
8. **Tenant Isolation:** Cross-tenant return attempts strictly fail with `SALES_RETURN_ORIGINAL_INVOICE_NOT_FOUND`.
9. **Cancellation Safety:** `CANCEL` on `PROCESSED` returns is prohibited by lifecycle state constraints; cancellation of pre-processed returns leaves financial and inventory state pristine.
10. **Lifecycle Architecture:** Canonical state transitions route strictly through `UniversalLifecycleEngine`.
11. **Test Integrity:** Zero tests deleted, zero assertions weakened, zero `@pytest.mark.skip` markers added.
12. **Regression Verification:** Full 189/189 test cases across 9 test suites executed and green.
13. **Database Integrity:** Alembic head pinned at `v1515_sales_schema_tenant_hardening (head)`; zero schema drift; zero orphan GL entries; zero duplicate movements on `smriti001`.
14. **Special Coverage Verification:** New P2.2 test suite (`test_p2_2_return_gl_atomicity.py`) contains 15 authentic end-to-end database tests asserting concrete table rows (`JournalVoucher`, `GeneralLedgerEntry`, `StockMovement`, `Product.stock`) rather than relying on mocks.

---

## 2. Git & Change Forensics Audit

### 2.1 Enumerated Scope of Changes

A complete diff of the working tree demonstrates that changes are strictly isolated to P2.2 deliverables:

| File Path | Type | Diff Stat | P2.2 Justification |
| :--- | :--- | :--- | :--- |
| `backend/app/services/lifecycle/handlers/sales_return.py` | Modified | `+118, -18` | Added pessimistic row lock, return quantity validation, synchronous GL error propagation, safe cancellation reason |
| `backend/app/services/sales_stock_authority.py` | Modified | `+57, -3` | Added `original_invoice_id` parameter, historical costing hierarchy (Tier 1-4), valuation remarks |
| `backend/app/services/unified_ledger.py` | Modified | `+120, -0` | Added perpetual real-time COGS reversal (DR 1040, CR 5010), credit note numbering, policy snapshot audit |
| `backend/app/tests/test_universal_sales_lifecycle.py` | Modified | `+12, -1` | Added missing `SalesInvoiceItem` fixture to `orig_inv` to satisfy P2.2 quantity validation |
| `backend/app/tests/test_p2_2_return_gl_atomicity.py` | Created | `+1021, -0` | Comprehensive 15-test suite for atomicity, COGS, costing hierarchy, locking, rollback |
| `docs/architecture/SMRITI_SALES_P2_2_RETURN_GL_IMPLEMENTATION.md` | Created | `+235, -0` | Architecture implementation report |
| `docs/architecture/SMRITI_SALES_P2_2_RETURN_GL_FORENSIC_AUDIT.md` | Created/Updated | `+293, -0` | Forensic audit report |

### 2.2 Cross-Module Regression Inspection
- **Purchase Module (`backend/app/services/purchase.py`, `app/api/v1/purchase.py`):** ZERO lines modified.
- **P2.1 Invoice GL Atomicity (`app/tests/test_p2_1_invoice_gl_atomicity.py`):** ZERO lines modified.
- **Alembic Migrations (`backend/alembic/versions/`):** ZERO migrations created or modified.
- **Numbering & Identity Engines (`DocumentsEngine`, `IdentityEngine`):** ZERO modifications.

---

## 3. Financial & COGS Double-Entry Accounting Audit

### 3.1 Accounting Matrix Verification

`UnifiedAccountingLedgerService.post_sales_return_to_gl` generates balanced journal vouchers adhering to Indian GST compliance and perpetual inventory accounting:

```text
Journal Voucher Type: CREDIT_NOTE
Reference Doc Type:   SALES_RETURN
Reference Doc ID:     <SalesReturn.id>

Commercial Reversal Leg:
  DR  Account 4010 / 4020  (Sales Revenue / Returns)  = Subtotal (Gross before Tax)
  DR  Account 2021         (Output CGST Payable)      = Total CGST
  DR  Account 2022         (Output SGST Payable)      = Total SGST
  DR  Account 2023         (Output IGST Payable)      = Total IGST (if interstate)
  CR  Account 1030         (Accounts Receivable)      = Grand Total
  [DR/CR Account 5030      (Roundoff Difference)      = If fractional rounding exists]

Perpetual Real-Time Inventory / COGS Reversal Leg (BD-02):
  DR  Account 1040         (Inventory Asset)          = Total Return COGS
  CR  Account 5010         (Cost of Goods Sold)       = Total Return COGS

Double-Entry Invariant:
  SUM(Debits) == SUM(Credits) [Zero-Difference Enforced at Voucher Creation]
```

### 3.2 Audit of GL Line Items in Database
Direct inspection of database records in `test_p2_2_return_gl_atomicity.py` confirms:
1. `test_balanced_credit_note`: Asserts `jv.total_debit == jv.total_credit` down to the exact cent.
2. `test_cogs_reversal`: Queries `general_ledger_entries` for account `1040` (Debit = 480.00, Credit = 0.00) and account `5010` (Credit = 480.00, Debit = 0.00) for a 4-unit return of product with cost 120.00.
3. No orphan GL entries: Every entry has a foreign key to a valid `journal_vouchers` record.

---

## 4. Historical Cost Determination Hierarchy Audit

### 4.1 Cost Resolution Hierarchy

Both `SalesStockAuthority.record_return_inward` and `UnifiedAccountingLedgerService.post_sales_return_to_gl` determine return cost strictly through this deterministic 4-tier hierarchy:

| Tier | Source Entity | Selection Condition | Description |
| :---: | :--- | :--- | :--- |
| **Tier 1** | `TransactionCostSnapshot` | `sales_invoice_id == original_invoice_id AND product_id == item.product_id` | Historical unit cost stamped at the exact moment original invoice was posted. |
| **Tier 2** | `ProductCostValuation` | `product_id == item.product_id AND company_id == company_id` | Weighted average cost -> purchase cost -> last purchase cost -> standard cost. |
| **Tier 3** | `Product.cost_price` | `cost_price > Decimal("0.00")` | Active product master cost. |
| **Tier 4** | `Product.price` / `0.00` | Fallback | Sells price or zero if unvalued; logs warning in system audit log. |

### 4.2 Forensic Verification of Cost Stability
In `test_historical_transaction_cost_snapshot_cost`:
- Original invoice posted with cost = ₹110.00.
- Subsequent purchase or master update raises `ProductCostValuation.weighted_average_cost` and `Product.cost_price` to ₹175.00.
- Return for 2 units is processed.
- **Observed Result:** GL COGS reversal Debit is exactly ₹220.00 (2 × ₹110.00), and `StockMovement.unit_cost` is ₹110.00. The post-sale price spike is completely ignored, proving that historical cost is preserved.

---

## 5. Physical Stock Restocking & Authority Audit

### 5.1 Restocking Authority
In `SalesReturnLifecycleHandler.apply_transition`:
- All physical restocking calls route directly to `SalesStockAuthority.record_return_inward(...)`.
- The handler does NOT perform raw SQL updates on `Product.stock`.
- `SalesStockAuthority` acquires a pessimistic row lock (`SELECT ... FOR UPDATE`) on `Product` before updating.
- Stock cache synchronization is delegated to `StockSynchronizer.sync_product_stock_cache(...)`.

### 5.2 Stock Movement Attributes
- `movement_type`: Strictly set to `RETURN_INWARD`.
- `reference_doc_type`: `SALES_RETURN`.
- `reference_doc_id`: `SalesReturn.id`.
- `remarks`: Authoritative audit remark containing resolved cost and costing method used.

---

## 6. Quantity Eligibility & Over-Return Rejection Audit

### 6.1 Validation Logic in `SalesReturnLifecycleHandler.validate_transition`
Before permitting the `PROCESS` transition:
1. Validates that the return has line items.
2. Validates that `original_invoice_id` is present and exists in the current tenant.
3. Validates that original invoice status is `POSTED` or `PAID`. (Draft, Submitted, or Cancelled invoices cannot be returned).
4. Matches each return item product against the original invoice items.
5. Queries cumulative returned quantity from previous valid returns:
   ```sql
   SELECT product_id, SUM(quantity) 
   FROM sales_return_items sri
   JOIN sales_returns sr ON sr.id = sri.return_id
   WHERE sr.original_invoice_id = :orig_id 
     AND sr.company_id = :company_id 
     AND sr.id != :current_return_id
     AND sr.status IN ('PROCESSED', 'COMPLETED')
     AND sr.is_deleted = false
   GROUP BY product_id;
   ```
6. Computes `remaining_returnable_qty = invoiced_qty - previously_returned_qty`.
7. If `current_return_qty > remaining_returnable_qty`, immediately raises:
   ```python
   HandlerValidationException("Return quantity (...) exceeds remaining returnable quantity (...)", "SALES_RETURN_QTY_EXCEEDED")
   ```

### 6.2 Test Coverage Evidence
- `test_partial_return`: Verifies sequential returns (3 units, then 4 units of a 10-unit invoice) pass cleanly.
- `test_over_return_rejection`: 
  - Scenario A (single return 12 > 10): Rejected with `SALES_RETURN_QTY_EXCEEDED`.
  - Scenario B (first return 7, second return 4, total 11 > 10): Second return rejected with `SALES_RETURN_QTY_EXCEEDED`.

---

## 7. Transaction Boundary & Atomicity Verification (BD-01)

### 7.1 Removal of Error Swallowing
In `backend/app/services/lifecycle/handlers/sales_return.py`:
- The previous unmonitored `try/except Exception as e: logger.warning(...)` block around `post_sales_return_to_gl` was permanently removed.
- Exceptions now propagate cleanly out of `SalesReturnLifecycleHandler.apply_transition` into `UniversalLifecycleEngine.execute_transition`, which triggers a complete transaction rollback.

### 7.2 Rollback Test Verification
The forensic audit verified 4 distinct simulated failure modes in `test_p2_2_return_gl_atomicity.py`:

| Test Name | Simulated Fault | Verified Rollback Assertions | Status |
| :--- | :--- | :--- | :---: |
| `test_gl_failure_rollback` | GL crash during `post_sales_return_to_gl` | Return status remains `APPROVED`; `Product.stock` unchanged; 0 `StockMovement`; 0 `JournalVoucher`; 0 `WorkflowEvent` | **PASSED** |
| `test_stock_failure_rollback` | Storage exception during `record_return_inward` | Return status remains `APPROVED`; 0 `JournalVoucher` created | **PASSED** |
| `test_missing_account_rollback` | Account `1040` missing from chart of accounts | Transaction aborts with 404; return remains `APPROVED` | **PASSED** |
| `test_workflow_failure_rollback` | Audit trail writing fails | Return remains `APPROVED`; complete rollback | **PASSED** |

---

## 8. Idempotency & Tenant Isolation Audit

### 8.1 Idempotency
1. **Lifecycle Transition:** Once a return reaches `PROCESSED`, attempting another `PROCESS` transition raises `LifecycleException` (Invalid Transition).
2. **Stock Authority:** `SalesStockAuthority.record_return_inward` queries for existing movements by `(company_id, reference_doc_type, reference_doc_id, product_id, 'RETURN_INWARD')`. If found, it returns the existing movement without re-incrementing stock.
3. **GL Service:** `UnifiedAccountingLedgerService.post_sales_return_to_gl` queries for an existing `JournalVoucher` by `(company_id, 'SALES_RETURN', return_id)`. If found, it returns the existing voucher without re-posting debits or credits.

### 8.2 Tenant Isolation
- Original invoice lookup in `validate_transition` filters by `SalesInvoice.company_id == tenant_ctx.company_id`.
- In `test_tenant_isolation`: Tenant 2 attempts to process a return against an invoice issued by Tenant 1. The transition is rejected with `SALES_RETURN_ORIGINAL_INVOICE_NOT_FOUND`.

---

## 9. Comprehensive Regression Test Audit (189/189 Passed)

All 9 relevant backend test suites were executed on the test database instance. Literal outputs confirm 100% pass rate:

```text
Suite 1: app/tests/test_p2_2_return_gl_atomicity.py ............. 15/15 PASSED (59.48s)
Suite 2: app/tests/test_universal_sales_lifecycle.py ............ 10/10 PASSED (51.80s)
Suite 3: app/tests/test_sales_return_contracts.py .............. 32/32 PASSED (71.94s)
Suite 4: app/tests/test_sales_stock_authority.py ............... 13/13 PASSED (52.54s)
Suite 5: app/tests/test_p2_1_invoice_gl_atomicity.py .............. 8/8 PASSED (49.41s)
Suite 6: app/tests/test_sales.py ................................ 36/36 PASSED (160.43s)
Suite 7: app/tests/test_cross_handler_lifecycle.py ............... 9/9 PASSED (48.33s)
Suite 8: app/tests/test_grn.py ................................... 4/4 PASSED (42.41s)
Suite 9: app/tests/test_purchase.py ............................. 62/62 PASSED (89.69s)

TOTAL: 189 PASSED, 0 FAILED, 0 SKIPPED (100% GREEN)
```

---

## 10. Database Schema Drift & Production Cleanliness Audit

### 10.1 Alembic Migration Head
- Database: `smriti001` (Port 2781)
- Current revision: `v1515_sales_schema_tenant_hardening (head)`
- Target: `tenant`
- New migration files created: **0**
- Schema drift: **0**

### 10.2 Table Row Counts on `smriti001`
Independent query verification confirms that 0 test artifacts or dirty rows entered `smriti001`:

| Table Name | Pre-Audit Count | Post-Audit Count | Delta | Status |
| :--- | :---: | :---: | :---: | :---: |
| `sales_returns` | 10 | 10 | 0 | Clean |
| `sales_return_items` | 10 | 10 | 0 | Clean |
| `stock_movements` | 9,420 | 9,420 | 0 | Clean |
| `journal_vouchers` | 1,382 | 1,382 | 0 | Clean |
| `general_ledger_entries` | 3,587 | 3,587 | 0 | Clean |

### 10.3 Database Integrity Constraints
Direct SQL queries on `smriti001`:
- Orphan GL Entries (`general_ledger_entries` without `journal_vouchers`): **0**
- Duplicate Vouchers for Sales Returns: **0**
- Duplicate Stock Movements for Sales Returns: **0**
- Orphan Stock Movements (`stock_movements` without `products`): **0**
- Company Context Mismatches between Returns and Vouchers: **0**
- Unbalanced Vouchers (`abs(total_debit - total_credit) > 0.001`): **0**

---

## 11. Special Verification: Real Database Assertions vs. Mocks

The previous Phase 0 audit noted that historical return tests used mocks or assertions that did not verify actual database entries. 

Forensic inspection of `backend/app/tests/test_p2_2_return_gl_atomicity.py` confirms that all 15 new tests execute against real PostgreSQL database sessions:
- Lines 273–291: Query `StockMovement` and `JournalVoucher` via SQL `SELECT` statements.
- Lines 322–330: Query `JournalVoucher` and assert `total_debit == total_credit`.
- Lines 369–383: Query `GeneralLedgerEntry` and assert individual debit and credit amounts for accounts `1040` and `5010`.
- Lines 436–449: Query `GeneralLedgerEntry` and `StockMovement` to verify that historical cost ₹110.00 is used instead of new price ₹175.00.
- Lines 770–793: Execute `db_session.refresh(...)` and verify that status remains `APPROVED`, `Product.stock` is unchanged, and 0 stock/GL/workflow records exist in the database.

No test relies on mocks to falsify core database behavior.

---

## 12. Final Audit Verdict

The P2.2 Sales Return GL & Inventory Reversal implementation strictly adheres to:
- **BD-01:** Synchronous fail-fast atomicity with 100% rollback on failure.
- **BD-02:** Perpetual real-time COGS reversal with historical cost snapshot accuracy.
- **Multi-Tenant Isolation:** Complete isolation at invoice lookup and transition boundaries.
- **Zero Schema Drift:** Zero migrations created; zero uncommitted production artifacts.
- **Regression Resilience:** 189/189 test cases passing.

# **`P2.2 FORENSIC PASS`**
