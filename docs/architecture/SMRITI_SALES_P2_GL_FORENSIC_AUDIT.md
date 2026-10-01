<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-10-01
  Modified     : 2026-10-01
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Sales Architecture — P2 General Ledger & Accounting Read-Only Forensic Audit

**Policy ID:** SMRITI-SALES-P2-GL-AUDIT-v1.0  
**Phase:** Phase 0 (Read-Only Forensic Audit)  
**Date:** 2026-10-01  
**Scope:** Sales, Returns, Payments, and General Ledger (GL) Architecture  
**Execution Boundary:** STRICT READ-ONLY. Zero code modified, zero migrations created, zero database writes.  

---

## Executive Summary

Pursuant to the governance rules established following the verification of P1 Physical Stock Authority, a comprehensive read-only forensic audit of the SMRITI financial and general ledger architecture was conducted. The audit focused on end-to-end financial transaction emission, chart of accounts (COA) integrity, payment processing, transaction atomicity, and error handling across Sales Invoices, Sales Returns, and Customer Payments.

### Key Audit Findings:
1. **Critical Silent Failure Vulnerability:** Both `SalesInvoiceLifecycleHandler` and `SalesReturnLifecycleHandler` wrap General Ledger calls in unrestricted `try...except Exception: pass` blocks. If GL posting fails (due to unseeded accounts, locked fiscal periods, rounding anomalies, or database constraint violations), the error is suppressed. Invoices transition to `POSTED` and inventory is permanently decremented, while the financial ledger records zero accounting impact.
2. **Premature Session Commit in COA Seeding:** `UnifiedAccountingLedgerService.seed_default_chart_of_accounts` calls `await session.commit()`. When called inside an outer transaction, it breaks caller transaction boundaries and forces premature commits.
3. **Disconnected Payment-to-GL Emission:** While `PaymentsEngine` records `PaymentTransaction` and `PaymentAllocation` records in the payment ledger, it does not invoke `post_payment_transaction_to_gl`. Furthermore, `SalesInvoiceLifecycleHandler` with `action="PAY"` merely updates `doc.paid_amount` on `SalesInvoice` without creating either payment records or GL receipts.
4. **Absence of Perpetual Inventory COGS:** Standard sales invoice posting debits Debtors (1030) and credits Revenue (4010) plus Output GST (2021/2022/2023). It does not record Cost of Goods Sold (COGS) debit (5010) or Inventory Asset credit (1040).
5. **Rogue Stock Accounting Boundary Service:** A secondary accounting service `StockAccountingBoundaryService` in `backend/app/services/stock_acct_svc.py` performs direct `session.commit()` calls and queries `Account` by `account_code` without filtering by `company_id`, posing a tenant data isolation risk.

**P2 AUDIT STATUS:** `HOLD (Remediation Design Required Before Implementation)`

---

## Section 1: Sales Invoice Financial Flow

### 1.1 Execution Flow Trace
```text
SalesInvoice (Draft / Submitted)
    ↓  UniversalLifecycleEngine.execute_transition(action="POST")
SalesInvoiceLifecycleHandler.apply_transition()
    ↓
1. doc.status = "POSTED"
    ↓
2. SalesStockAuthority.record_outward_sale()
   - Row-locks Product rows (SELECT FOR UPDATE)
   - Checks physical availability
   - Writes StockMovement (OUTWARD_SALE)
   - Synchronizes product.stock cache via StockSynchronizer
    ↓
3. UnifiedAccountingLedgerService.post_sales_invoice_to_gl()  [WRAPPED IN try...except: pass]
   - Idempotency check: JournalVoucher(SALES_INVOICE, reference_doc_id=invoice_id)
   - seed_default_chart_of_accounts()  <-- Calls session.commit() prematurely!
   - Resolves Accounts:
       * 1030: Accounts Receivable / Debtors
       * 4010: Sales Revenue
       * 2021: Output CGST
       * 2022: Output SGST
       * 2023: Output IGST
       * 5030: Roundoff Account
   - Generates Balancing GL Lines:
       Debit:  Account 1030 (Debtors) = Grand Total (party_id = customer_id)
       Credit: Account 4010 (Sales Revenue) = Subtotal (taxable value)
       Credit: Account 2021 (Output CGST) = CGST sum
       Credit: Account 2022 (Output SGST) = SGST sum
       Credit: Account 2023 (Output IGST) = IGST sum
       Credit/Debit: Account 5030 (Roundoff) = Difference
   - Validates Double-Entry: abs(total_debit - total_credit) <= 0.001
   - Appends JournalVoucher + GeneralLedgerEntry rows
   - Flushes to session
```

### 1.2 Customer Balance & AR Synchronization
- In `SalesInvoiceLifecycleHandler`: The GL entry records `party_id=inv.customer_id` against Account 1030 (Debtors). However, the customer master table `Customer.outstanding` is **NOT** updated, and no `CustomerCreditLedgerEntry` is created.
- In `CanonicalSalesPostingWriter`: `Customer.outstanding` is updated and `CustomerCreditLedgerEntry` is created, but only for `payment_mode="CREDIT"`.

### 1.3 Stock & COGS Accounting
- Sales invoice posting does not produce perpetual inventory COGS entries.
- Account 5010 (Cost of Goods Sold) and Account 1040 (Stock in Hand / Inventory Asset) remain unmutated during sales invoicing. Physical stock accounting is maintained exclusively in the `stock_movements` inventory ledger.

---

## Section 2: Sales Return Financial Flow

### 2.1 Execution Flow Trace
```text
SalesReturn (Approved)
    ↓  UniversalLifecycleEngine.execute_transition(action="PROCESS")
SalesReturnLifecycleHandler.apply_transition()
    ↓
1. doc.status = "PROCESSED"
    ↓
2. SalesStockAuthority.record_return_inward()
   - Restocks inventory (StockMovement: RETURN_INWARD)
   - Rebuilds product.stock cache
    ↓
3. UnifiedAccountingLedgerService.post_sales_return_to_gl()  [WRAPPED IN try...except: logger.warning]
   - Idempotency check: JournalVoucher(SALES_RETURN, reference_doc_id=return_id)
   - Seeds COA
   - Generates Balancing Reversing GL Lines:
       Debit:  Account 4010 (Sales Revenue) = Subtotal
       Debit:  Account 2021 (Output CGST) = CGST sum
       Debit:  Account 2022 (Output SGST) = SGST sum
       Debit:  Account 2023 (Output IGST) = IGST sum
       Debit/Credit: Account 5030 (Roundoff) = Roundoff difference
       Credit: Account 1030 (Accounts Receivable / Debtors) = Grand Total
   - Validates Double-Entry Balance
   - Flushes JournalVoucher + GeneralLedgerEntry rows
```

### 2.2 Reversal & Credit Note Status
- The return generates an authoritative Credit Note entry in the GL by debiting Revenue and crediting Debtors.
- However, if `post_sales_return_to_gl` encounters an error, the exception is logged as a warning (`logger.warning`), and the document remains marked `PROCESSED` with stock replenished, leaving the GL unbalanced against the physical stock movement.

---

## Section 3: Payment Financial Flow

### 3.1 Current Payment Architectures
The system currently possesses three disconnected payment handling paths:

1. **`SalesInvoiceLifecycleHandler` (action="PAY"):**
   ```python
   elif act == "PAY":
       pay_amount = payload.get("amount") or doc.grand_total
       doc.paid_amount = Decimal(str(pay_amount))
       doc.balance_amount = max(Decimal("0.00"), Decimal(str(doc.grand_total or 0.00)) - doc.paid_amount)
   ```
   - **Finding:** No financial entry is created. No payment record is inserted into `payment_transactions`. No GL voucher is generated.
2. **`PaymentsEngine.process_payment`:**
   - Creates `PaymentTransaction` and `PaymentAllocation` records.
   - Handles multi-tender payments (Cash, UPI, Card, Netbanking).
   - Enforces Section 269ST cash limits (₹2,00,000 threshold).
   - **Finding:** Does **not** post to General Ledger. Does not call `post_payment_transaction_to_gl`.
3. **`UnifiedAccountingLedgerService.post_payment_transaction_to_gl`:**
   - Implemented in `backend/app/services/unified_ledger.py` (lines 1113–1209).
   - Translates `PaymentTransaction` into a double-entry voucher:
     * Customer Receipt: Debit Cash (1010) / Bank (1020), Credit Debtors (1030).
     * Supplier Payment: Debit Creditors (2010), Credit Cash (1010) / Bank (1020).
   - **Finding:** This method is only invoked via the asynchronous outbox dispatcher (`dispatch_outbox_event`). It is never invoked synchronously during POS sales or invoice payment workflows.

---

## Section 4: GL Authority & Financial Writer Matrix

The following table inventories every service and module that creates or modifies `JournalVoucher`, `GeneralLedgerEntry`, and payment ledger records:

| Service / Module | Target Entity | Trigger Method | Document Type / Reference | Authority Classification | Defect / Vulnerability |
|---|---|---|---|---|---|
| **UnifiedAccountingLedgerService** | `JournalVoucher`, `GeneralLedgerEntry` | `post_sales_invoice_to_gl` | `SALES_INVOICE` | **Authoritative GL Engine** | Called in swallowed try-except block; seeds COA with premature commit |
| **UnifiedAccountingLedgerService** | `JournalVoucher`, `GeneralLedgerEntry` | `post_sales_cancellation_to_gl` | `SALES_INVOICE_CANCEL` | **Authoritative GL Engine** | Reversal voucher; suppressed errors |
| **UnifiedAccountingLedgerService** | `JournalVoucher`, `GeneralLedgerEntry` | `post_sales_return_to_gl` | `SALES_RETURN` | **Authoritative GL Engine** | Return credit note voucher; suppressed errors |
| **UnifiedAccountingLedgerService** | `JournalVoucher`, `GeneralLedgerEntry` | `post_purchase_receipt_to_gl` | `PURCHASE_RECEIPT` | **Authoritative GL Engine** | Purchase accrual (GRN); intact |
| **UnifiedAccountingLedgerService** | `JournalVoucher`, `GeneralLedgerEntry` | `post_payment_transaction_to_gl` | `PAYMENT_RECEIPT` / `SUPPLIER_PAYMENT` | **Authoritative GL Engine** | Orphaned from synchronous payment routes |
| **StockAccountingBoundaryService** | `JournalVoucher`, `GeneralLedgerEntry` | `record_journal_voucher` | Custom / Ad-hoc | **Rogue Writer** | Directly calls `await session.commit()`; queries `Account` without `company_id` |
| **PaymentsEngine** | `PaymentTransaction`, `PaymentAllocation` | `process_payment` | `SALES_INVOICE` | **Authoritative Payment Writer** | Does not emit GL entry |
| **CanonicalSalesPostingWriter** | `SalesInvoice`, `CustomerCreditLedgerEntry` | `post_sales_transaction` | `SALES_INVOICE` | **Sales Posting Writer** | Emits outbox event but skips synchronous GL voucher |
| **SalesService (Legacy)** | `SalesInvoice` | `cancel_sales_invoice` | `SALES_INVOICE_CANCEL` | **Legacy Writer** | Marks `is_deleted=True`; calls `post_sales_cancellation_to_gl` |

---

## Section 5: Silent Failure Audit

A forensic scan of error suppression patterns across accounting and sales workflows identified four major failure points:

### Defect 5.1: Swallowed Invoice GL Exceptions
**Location:** `backend/app/services/lifecycle/handlers/sales_invoice.py` (lines 243–252)
```python
# 2. Financial GL Posting via UnifiedAccountingLedgerService
try:
    await UnifiedAccountingLedgerService.post_sales_invoice_to_gl(
        session=db,
        company_id=tenant_ctx.company_id,
        invoice_id=doc.id,
        branch_id=tenant_ctx.branch_id,
    )
except Exception:
    # If GL is not configured or in test environments without COA, do not crash invoice posting
    pass
```
- **Evidence:** Bare `except Exception: pass`.
- **Impact:** An invoice transitions to `status="POSTED"`, physical stock is deducted, but if GL fails, the financial impact is completely lost with zero audit log or error record.

### Defect 5.2: Swallowed Invoice Cancellation GL Exceptions
**Location:** `backend/app/services/lifecycle/handlers/sales_invoice.py` (lines 266–276)
```python
try:
    await UnifiedAccountingLedgerService.post_sales_cancellation_to_gl(
        session=db,
        company_id=tenant_ctx.company_id,
        invoice_id=doc.id,
        branch_id=tenant_ctx.branch_id,
        reason=payload.get("reason"),
        cancelled_by=getattr(user, "username", None) or str(user.id),
    )
except Exception:
    pass
```
- **Evidence:** Bare `except Exception: pass`.

### Defect 5.3: Suppressed Sales Return GL Exceptions
**Location:** `backend/app/services/lifecycle/handlers/sales_return.py` (lines 217–226)
```python
try:
    await UnifiedAccountingLedgerService.post_sales_return_to_gl(
        session=db,
        company_id=tenant_ctx.company_id,
        return_id=doc.id,
        branch_id=tenant_ctx.branch_id,
    )
except Exception as e:
    logger.warning("Could not post sales return %s to GL: %s", doc.id, e, exc_info=True)
```
- **Evidence:** Exception logged as `logger.warning`, but execution continues without failing the transition.

### Defect 5.4: Legacy Sales Service Cancellation Suppression
**Location:** `backend/app/services/sales.py` (lines 1701–1711)
```python
try:
    await UnifiedAccountingLedgerService.post_sales_cancellation_to_gl(...)
except Exception as e:
    logger.warning("Notice during GL cancellation posting: %s", e)
```

---

## Section 6: Transaction Atomicity & Partial-Commit Scenarios

### 6.1 The COA Seeding Commit Hazard
In `backend/app/services/unified_ledger.py` (line 187):
```python
async def seed_default_chart_of_accounts(cls, session: AsyncSession, company_id: str, ...):
    ...
    await session.commit()
    return created_accounts
```
Because `seed_default_chart_of_accounts` is called inside `post_sales_invoice_to_gl`, `post_sales_cancellation_to_gl`, and `post_sales_return_to_gl`, any active database transaction is committed midway through execution. If a subsequent step in invoice posting fails, earlier mutations can no longer be rolled back.

### 6.2 Partial-Commit Scenario Trace
1. Caller starts transaction on `AsyncSession`.
2. `SalesInvoice` status set to `POSTED`.
3. `SalesStockAuthority` records physical stock deduction (`StockMovement`) and calls `sync_product_stock_cache`.
4. `UnifiedAccountingLedgerService.post_sales_invoice_to_gl` is invoked:
   - If COA is unseeded, `seed_default_chart_of_accounts` calls `await session.commit()`. The status change and stock deduction are now permanently committed to PostgreSQL!
   - Next, `post_journal_voucher` executes. If an error occurs (e.g. `SMRITI-GL-006: Fiscal period locked` or `SMRITI-GL-001: Unbalanced voucher`):
   - An `HTTPException` is raised.
   - `SalesInvoiceLifecycleHandler` catches the exception via `except Exception: pass`.
   - Result: Stock is deducted and invoice is POSTED, but GL voucher is missing. **Atomicity is completely broken.**

---

## Section 7: Idempotency Analysis

1. **Database-Level Unique Constraints:**
   - `journal_vouchers`: `UniqueConstraint("company_id", "voucher_no", name="uq_journal_vouchers_company_no")`
   - `accounts`: `UniqueConstraint("company_id", "account_code", name="uq_accounts_company_code")`
   - `fiscal_years`: `UniqueConstraint("company_id", "financial_year_code", name="uq_fiscal_year_company_code")`
   - `fiscal_periods`: `UniqueConstraint("company_id", "fiscal_year_id", "period_number", name="uq_fiscal_period_comp_fy_num")`
   - `payment_transactions`: `UniqueConstraint("idempotency_key", name="uq_payment_idempotency_key")`
2. **Missing Database-Level Idempotency Constraint on Reference Documents:**
   - There is **no unique constraint** on `(company_id, reference_doc_type, reference_doc_id)` in `journal_vouchers`.
   - Idempotency is enforced only by application-level select statements:
     ```python
     existing_stmt = select(JournalVoucher).where(
         JournalVoucher.company_id == company_id,
         JournalVoucher.reference_doc_type == "SALES_INVOICE",
         JournalVoucher.reference_doc_id == invoice_id,
         JournalVoucher.is_deleted == False
     )
     ```
   - Concurrent worker threads processing the same invoice could both observe `existing_voucher is None` and generate duplicate journal vouchers with distinct `voucher_no` values.

---

## Section 8: Reversals & Historical Audit Immutability

1. **Compensating Vouchers:**
   - In accordance with statutory accounting standards, cancellations do not update or delete existing GL rows.
   - `post_sales_cancellation_to_gl` writes a distinct reversing voucher (`voucher_type="SALES_CANCEL"`, `reference_doc_type="SALES_INVOICE_CANCEL"`).
   - Reversal lines exactly mirror the original lines with debits and credits inverted.
2. **FK Cascades Disabled:**
   - In `backend/app/models/accounting.py`, the `cascade="all, delete-orphan"` attribute was removed from `JournalVoucher.entries`.
   - The database constraint `fk_gle_voucher_id_restrict` restricts deletion of journal vouchers that have associated general ledger entries.
3. **Database Audit Evidence:**
   - PostgreSQL inspection in `smriti001` revealed 14 existing `SALES_CANCEL` vouchers.
   - All 14 vouchers have `total_debit == total_credit` (₹1,899.00 each) with 0 balancing discrepancy and zero orphaned GL entries.

---

## Section 9: Multi-Tenant Isolation

1. **Company ID Partitioning:**
   - `accounts`, `journal_vouchers`, `general_ledger_entries`, `fiscal_years`, `fiscal_periods`, `payment_transactions`, and `payment_allocations` all possess a `company_id` column.
   - `UnifiedAccountingLedgerService` consistently filters queries by `company_id`.
2. **Cross-Tenant Leakage Risk Identified:**
   - In `backend/app/services/stock_acct_svc.py` (lines 272–275):
     ```python
     stmt_acc = select(Account).where(
         Account.account_code == line.account_code,
     )
     account = (await session.execute(stmt_acc)).scalars().first()
     ```
   - **Risk:** This query searches `accounts` across the entire database without filtering by `company_id`. If Company B posts a voucher using account code `1010`, it could link its GL entry to an `Account` record owned by Company A.

---

## Section 10: Accounting Policy & Business Decisions Required

Before implementing changes to P2 GL code, the following architectural and business decisions must be formalized:

1. **Fail-Fast vs. Asynchronous Outbox Eventual Consistency:**
   - *Option A (Fail-Fast):* Invoicing and GL posting must be strictly synchronous and atomic. If GL posting fails, the entire invoice post transaction (including stock deduction) rolls back immediately.
   - *Option B (Eventual Outbox):* Invoice POST commits status and stock immediately, then writes an outbox event. A background daemon asynchronously posts the GL voucher with retry and dead-letter queues.
   - *Recommendation:* Option A for standard interactive billing; Option B with deterministic retry guarantees for offline POS sync.
2. **COGS Perpetual Inventory Recognition:**
   - Does SMRITI require real-time perpetual inventory valuation in the General Ledger on every invoice POST?
   - If YES: requires defining cost valuation logic (FIFO, weighted average cost, or standard cost) to calculate COGS amount and book `Debit: COGS (5010) / Credit: Inventory (1040)`.
   - If NO: inventory valuation remains periodic (periodic inventory system via monthly Trial Balance adjustment).
3. **Payment Receipt Convergence:**
   - Direct POS cash/card tenders must automatically trigger `post_payment_transaction_to_gl` to clear Accounts Receivable (1030) and debit Cash (1010) / Bank (1020).
4. **Removal of `session.commit()` from Service Layers:**
   - `seed_default_chart_of_accounts` and all service-layer methods must only flush (`await session.flush()`), leaving transaction commit authority strictly to the request transaction boundary.

---

## Section 11: Existing Test Suite Verification

All relevant test suites were executed to establish a baseline of current functionality. No tests were modified.

| Test Suite | Command | Total Tests | Passed | Failed | Skipped | Execution Time |
|---|---|---|---|---|---|---|
| **Purchase Phase 2.1** | `pytest app/tests/test_purchase.py -v` | 62 | 62 | 0 | 0 | 78.14s |
| **Goods Receipt (GRN)** | `pytest app/tests/test_grn.py -v` | 4 | 4 | 0 | 0 | 42.67s |
| **Cross-Handler Lifecycle** | `pytest app/tests/test_cross_handler_lifecycle.py -v` | 9 | 9 | 0 | 0 | 51.39s |
| **P1 Stock Authority** | `pytest app/tests/test_sales_stock_authority.py -v` | 13 | 13 | 0 | 0 | 61.09s |
| **Universal Sales Lifecycle** | `pytest app/tests/test_universal_sales_lifecycle.py -v` | 10 | 10 | 0 | 0 | 42.51s |
| **Sales Return Contracts** | `pytest app/tests/test_sales_return_contracts.py -v` | 32 | 32 | 0 | 0 | 66.33s |
| **Sales Core Suite** | `pytest app/tests/test_sales.py -v` | 36 | 36 | 0 | 0 | 66.71s |
| **Canonical Billing Phase 1** | `pytest app/tests/test_phase1_canonical_billing.py -v` | 11 | 11 | 0 | 0 | 54.40s |
| **Headless Billing Phase 2** | `pytest app/tests/test_phase2_headless_billing.py -v` | 18 | 18 | 0 | 0 | 55.89s |
| **TOTAL** | | **195** | **195** | **0** | **0** | **519.13s** |

All 195 tests across 9 suites are 100% passing.

---

## Section 12: Purchase Regression Verification

- **Purchase Core:** 62/62 PASSED.
- **GRN Model & Allocation:** 4/4 PASSED.
- **Line-level 3-Way Matching:** 9/9 PASSED in cross-handler lifecycle.
- **Verdict:** Zero purchase regressions detected.

---

## Section 13: PostgreSQL Database Forensics

Direct SQL introspection against the active database `smriti001` yielded the following findings:

1. **Table Inventory & Record Counts:**
   - `accounts`: 1,140 rows
   - `journal_vouchers`: 14 rows
   - `general_ledger_entries`: 56 rows
   - `payment_transactions`: 29 rows
   - `payment_allocations`: 29 rows
   - `customer_credit_ledger_entries`: 165 rows
   - `fiscal_years`: 0 rows
   - `fiscal_periods`: 0 rows
   - `account_balance_snapshots`: 0 rows
   - `bank_statements`: 0 rows
   - `currency_exchange_rates`: 0 rows
2. **Data Consistency & Ledger Balance Audits:**
   - `SELECT COUNT(*) FROM journal_vouchers WHERE abs(total_debit - total_credit) > 0.001`: **0 unbalanced vouchers**.
   - `SELECT COUNT(*) FROM general_ledger_entries gle LEFT JOIN journal_vouchers jv ON gle.voucher_id = jv.id WHERE jv.id IS NULL`: **0 orphan entries**.
   - `SELECT COUNT(*) FROM general_ledger_entries gle LEFT JOIN accounts acc ON gle.account_id = acc.id WHERE acc.id IS NULL`: **0 orphan account references**.
3. **Database Schema Parity:**
   - Foreign key constraints `general_ledger_entries_account_id_fkey` and `fk_gle_voucher_id_restrict` are enforced.
   - Unique constraints on `accounts (company_id, account_code)` and `journal_vouchers (company_id, voucher_no)` are present.

---

## Section 14: Required Engineering Work & Final Verdict

### Required Engineering Work for P2 Implementation Phase:
1. **Remove Error Suppression:** Replace `try...except Exception: pass` in `SalesInvoiceLifecycleHandler` and `SalesReturnLifecycleHandler` with explicit transaction rollback and structured domain error propagation.
2. **Eliminate Service-Level Commits:** Refactor `seed_default_chart_of_accounts` and `StockAccountingBoundaryService` to use `await session.flush()` instead of `await session.commit()`.
3. **Harmonize Payment GL Posting:** Connect `PaymentsEngine` to `post_payment_transaction_to_gl` so all received customer tenders synchronously emit `PAYMENT_RECEIPT` vouchers.
4. **Fix Cross-Tenant Account Lookup in StockAcctService:** Add `company_id` filter to `select(Account)` in `stock_acct_svc.py`.
5. **Add Unique Constraint / Advisory Lock on Reference Docs:** Add pessimistic locking (`with_for_update`) or database constraint on `(company_id, reference_doc_type, reference_doc_id)` in `journal_vouchers` to eliminate concurrent duplicate postings.

---

## Final Verdict

**P2 AUDIT STATUS: HOLD**

The read-only audit is complete. Critical flaws in error suppression, atomicity, and payment integration were identified. In accordance with the prompt's instructions:
- **Zero code was modified.**
- **Zero database changes were made.**
- **No commit or push was executed.**
- Execution stops here pending user approval of the P2 remediation design.
