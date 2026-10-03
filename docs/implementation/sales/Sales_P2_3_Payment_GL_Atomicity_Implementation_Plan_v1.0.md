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

# SMRITI SALES — P2.3 PAYMENT GL ATOMICITY IMPLEMENTATION PLAN

**Plan ID:** IP-SALES-P2.3-001  
**Area:** Sales / Financial Ledger / Payments  
**Version:** 1.0.0  
**Created:** 2026-10-02  
**Lifecycle Status:** Approved  
**Governing Standard:** BD-03 — Synchronous Payment Receipt GL  

---

## 1. Objective
Implement atomic, synchronous, fail-fast customer payment accounting for SMRITI Retail OS under frozen business decision **BD-03**, enforcing the fundamental financial invariant:
$$\text{PaymentTransaction} \iff \text{PaymentAllocation} \iff \text{JournalVoucher}(\text{PAYMENT\_RECEIPT})$$
Every customer payment received against a sales invoice—whether collected at POS checkout, allocated subsequently via payment distribution, or processed through the lifecycle transition `POSTED -> PAID`—must synchronously post double-entry GL records:
- **Debit:** Cash in Hand (`1010`) or Bank Accounts (`1020`)
- **Credit:** Accounts Receivable / Debtors (`1030`)

---

## 2. Business Motivation
In the current production baseline, all 29 live payment transactions recorded in `smriti001` lack general ledger vouchers (100% payment GL deficit). While invoice creation debits Accounts Receivable (`1030`), customer payments fail to credit Accounts Receivable or debit cash/bank ledgers. This leaves customer receivables permanently overstated and cash balances understated, violating statutory accounting standards and producing distorted balance sheets. P2.3 closes this gap by enforcing immediate, synchronous GL posting across all payment channels.

---

## 3. Scope
### In Scope
1. **Lifecycle Engine Integration:** Refactoring `SalesInvoiceLifecycleHandler(action="PAY")` to orchestrate `PaymentsEngine` and `UnifiedAccountingLedgerService` instead of bare in-memory field mutations.
2. **Synchronous Payment GL:** Calling `UnifiedAccountingLedgerService.post_payment_transaction_to_gl` atomically inside `PaymentsEngine.process_payment` and `PaymentsEngine.allocate_payment`.
3. **Transaction Boundary Unification:** Enforcing `commit=False` when calling `PaymentsEngine` from lifecycle handlers and canonical posting writers, ensuring the caller session retains complete commit/rollback authority.
4. **Allocation Integrity & Over-Allocation Guards:** Adding `SalesInvoice` verification, tenant matching, and over-allocation checks (`allocated_amount <= invoice.balance_amount`) to `PaymentsEngine.allocate_payment`.
5. **Paid Invoice Cancellation Guard:** Blocking `CANCEL` transitions on `PAID` sales invoices to prevent double-crediting Accounts Receivable.
6. **Comprehensive Test Suite:** Implementing 17 real-database, zero-mock tests in `backend/app/tests/test_p2_3_payment_gl_atomicity.py`.

### Out of Scope
- Historical backfill of the 29 pre-existing live payment transactions (deferred to separate post-P2.3 migration script).
- Multi-currency forex revaluation during payment settlements.
- Implementation of P2.4 (Advances, Credits & Debit Notes).

---

## 4. Current State
- `UnifiedAccountingLedgerService.post_payment_transaction_to_gl` exists but is completely uninvoked in production workflows.
- `SalesInvoiceLifecycleHandler(action="PAY")` only mutates `paid_amount` and `balance_amount` in memory on the `SalesInvoice` model.
- `PaymentsEngine.process_payment` and `allocate_payment` default to `commit=True`, breaking atomicity.
- `allocate_payment` allows allocating funds to non-existent or foreign-company invoices and does not check invoice balance.

---

## 5. Gap Analysis
- **GAP-01 (P0):** Payment GL uninvoked $\to$ Wire `post_payment_transaction_to_gl` synchronously into payment workflows.
- **GAP-02 (P0):** Bare mutations in lifecycle handler $\to$ Delegate `action="PAY"` to `PaymentsEngine` and GL poster.
- **GAP-03 (P0):** Premature commits in `PaymentsEngine` $\to$ Enforce caller session control with `commit=False`.
- **GAP-04 (P0):** Missing invoice validation in `allocate_payment` $\to$ Validate existence, tenant match, and balance.
- **GAP-05 (P1):** Missing concurrency row locks $\to$ Add `with_for_update()` to invoice queries in payment paths.
- **GAP-06 (P1):** Unchecked cancellation of paid invoices $\to$ Guard against cancelling invoices with active payments.
- **GAP-07 (P1):** Zero payment GL tests $\to$ Implement comprehensive 17-test verification suite.

---

## 6. Architecture Impact
```
[User / POS Client / API]
           │
           ▼
UniversalLifecycleEngine (or PaymentsEngine / CanonicalSalesWriter)
           │  (Single AsyncSession Transaction Boundary)
           ├── 1. Lock SalesInvoice (SELECT FOR UPDATE)
           ├── 2. PaymentsEngine.process_payment(commit=False)
           │      ├── Insert PaymentTransaction (status="SUCCESS")
           │      └── Insert PaymentAllocation
           ├── 3. Update SalesInvoice.paid_amount & balance_amount
           ├── 4. UnifiedAccountingLedgerService.post_payment_transaction_to_gl()
           │      ├── Create JournalVoucher(voucher_type="PAYMENT_RECEIPT")
           │      ├── Insert GLE: DR Cash (1010) / Bank (1020)
           │      └── Insert GLE: CR Debtors / AR (1030)
           └── 5. Commit Session (or Rollback on any failure)
```

---

## 7. Proposed Design
1. **Account Resolution:**
   - `tender_type == "CASH"` $\to$ Account `1010` (Cash in Hand)
   - Other tenders (`"CARD"`, `"UPI"`, `"NETBANKING"`, `"BANK_TRANSFER"`) $\to$ Account `1020` (Bank Accounts)
   - Customer Receivable $\to$ Account `1030` (Accounts Receivable / Debtors)
2. **Lifecycle Handler (`sales_invoice.py`):**
   - Validate transition `PAY`: ensure invoice is `POSTED`, pay amount $> 0$, pay amount $\le \text{balance\_amount}$.
   - Apply transition `PAY`: generate `PaymentTransaction` via `PaymentsEngine(commit=False)`, update invoice `paid_amount` and `balance_amount`, post GL voucher via `post_payment_transaction_to_gl`.
   - Validate transition `CANCEL`: reject if invoice has `paid_amount > 0` or status is `PAID`.
3. **Payments Engine (`payments_engine.py`):**
   - `allocate_payment`: lock `SalesInvoice` with `with_for_update()`, check company match, check remaining balance, update invoice balances, and trigger GL posting.
   - `process_payment`: when `auto_allocate=True`, trigger GL posting synchronously before commit/flush.

---

## 8. Files Created
1. `backend/app/tests/test_p2_3_payment_gl_atomicity.py` (Complete 17-test verification suite)
2. `docs/implementation/sales/Sales_P2_3_Payment_GL_Atomicity_Implementation_Plan_v1.0.md` (This plan)
3. `docs/walkthrough/sales/Sales_P2_3_Payment_GL_Atomicity_Walkthrough_v1.0.md` (Implementation walkthrough)

---

## 9. Files Modified
1. `backend/app/services/lifecycle/handlers/sales_invoice.py` (Add validation and execution of `PAY` action and `CANCEL` guard)
2. `backend/app/services/payments_engine.py` (Add invoice validation, balance update, and synchronous GL trigger)
3. `backend/app/services/unified_ledger.py` (Harmonize `post_payment_transaction_to_gl` reference types and party fallback)
4. `docs/implementation/README.md` (Update master implementation index)
5. `docs/walkthrough/README.md` (Update master walkthrough index)

---

## 10. Dependencies
- PostgreSQL async session engine (`app.db.session`)
- `UniversalLifecycleEngine` (`app.services.lifecycle`)
- `UnifiedAccountingLedgerService` (`app.services.unified_ledger`)
- `PaymentsEngine` (`app.services.payments_engine`)
- Canonical Chart of Accounts (`1010`, `1020`, `1030`)

---

## 11. Risks & Mitigation
| Risk | Severity | Mitigation |
|---|---|---|
| Premature commit in `PaymentsEngine` breaking outer rollback | High | Pass `commit=False` from all orchestrator callers. |
| Double GL posting on duplicate payment request | Medium | Enforced by existing idempotency check (`reference_doc_id == payment_id`). |
| Missing accounts in new tenant database | Medium | `seed_default_chart_of_accounts` is called automatically before posting. |
| Concurrent double payment over-paying invoice | High | `SELECT FOR UPDATE` pessimistic row locking on `SalesInvoice`. |

---

## 12. Rollback Strategy
If any step in the payment or GL posting pipeline raises an exception:
1. The transaction raises immediately (fail-fast).
2. The `UniversalLifecycleEngine` (or outer caller) catches the exception and executes `await session.rollback()`.
3. No `PaymentTransaction` row is persisted.
4. No `PaymentAllocation` row is persisted.
5. No `JournalVoucher` or `GeneralLedgerEntry` row is persisted.
6. The `SalesInvoice` remains in its original `POSTED` status with original `paid_amount` and `balance_amount`.

---

## 13. Verification Plan
- Run full automated pytest test suite in `backend/app/tests/test_p2_3_payment_gl_atomicity.py`.
- Verify database state directly via SQL:
  - Check `JournalVoucher` has `voucher_type == 'PAYMENT_RECEIPT'`.
  - Check total debit equals total credit.
  - Check Debit Account is `1010` (Cash) or `1020` (Bank).
  - Check Credit Account is `1030` (AR).
  - Verify zero orphan records on simulated failure.

---

## 14. Test Plan (17 Test Cases)
1. `test_cash_payment_gl_creation`: Verifies DR 1010 / CR 1030 for Cash payment.
2. `test_bank_payment_gl_creation`: Verifies DR 1020 / CR 1030 for Card/UPI payment.
3. `test_partial_invoice_payment`: Verifies partial balance update and partial GL credit.
4. `test_full_invoice_settlement`: Verifies invoice transition to PAID and full settlement.
5. `test_split_multi_tender_payment`: Verifies split payment across Cash and Bank.
6. `test_multiple_invoice_allocation`: Verifies allocating 1 payment to 2 invoices.
7. `test_over_allocation_rejection`: Verifies rejection when allocation > invoice balance.
8. `test_balanced_payment_receipt_jv`: Verifies total debit == total credit on JV.
9. `test_ar_credit_matches_party_id`: Verifies party_id on AR credit line.
10. `test_gl_failure_rolls_back_payment`: Verifies complete rollback on GL exception.
11. `test_missing_account_fails_fast`: Verifies rollback when account is missing.
12. `test_duplicate_payment_idempotency`: Verifies re-post returns existing JV without duplicates.
13. `test_concurrent_payment_locking`: Verifies row locking prevents race conditions.
14. `test_cross_company_payment_blocked`: Verifies cross-company allocations are rejected.
15. `test_invoice_balance_mathematical_parity`: Verifies `grand_total == paid + balance`.
16. `test_payment_allocation_consistency`: Verifies `sum(allocations) <= payment.amount`.
17. `test_cancel_paid_invoice_guard`: Verifies cancelling PAID invoice is blocked.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md` with new plan entry.
- Create `docs/walkthrough/sales/Sales_P2_3_Payment_GL_Atomicity_Walkthrough_v1.0.md`.
- Update `docs/walkthrough/README.md` master index.

---

## 16. Deployment Plan
- Deploy code changes to development branch in `D:\Smriti_Retail_OS`.
- Verify tests pass locally against PostgreSQL.
- Commit and push to repository.
- Pull into test environment in `F:\Smriti9`.

---

## 17. Status
- **Current State:** In Progress / Implementing
- **Approval:** Pre-approved under Business Decision BD-03.

---

## 18. Related ADRs
- `ADR-004`: Unified Accounting Ledger Architecture
- `ADR-012`: Universal Document Lifecycle Governance
- `BD-03`: Synchronous Payment Receipt GL Policy

---

## 19. Related Walkthroughs
- `docs/walkthrough/sales/Sales_P2_1_Invoice_GL_Atomicity_Walkthrough_v1.0.md`
- `docs/walkthrough/sales/Sales_P2_2_Return_GL_Atomicity_Walkthrough_v1.0.md`
- `docs/walkthrough/sales/Sales_P2_3_Payment_GL_Atomicity_Walkthrough_v1.0.md` (To be created)
