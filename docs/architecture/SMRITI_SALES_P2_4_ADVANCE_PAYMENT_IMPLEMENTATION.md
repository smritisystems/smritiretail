<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.21.0
  Created      : 2026-10-02
  Modified     : 2026-10-02
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS Sales P2.4 — Customer Advance Payment & Invoice Knock-off Architecture & Implementation

## 1. Executive Summary & Architectural Scope
Phase P2.4 implements double-entry Customer Advance Payments and Invoice Knock-off for SMRITI Retail OS. It adheres strictly to the canonical double-entry accounting standard (BD-03 / P2.4):
- **Customer Advance Receipt:**
  - Cash Receipt: `DR 1010 Cash in Hand` / `CR 2050 Customer Advance Liability`
  - Bank/UPI Receipt: `DR 1020 Bank Accounts` / `CR 2050 Customer Advance Liability`
- **Advance → Sales Invoice Knock-Off:**
  - `DR 2050 Customer Advance Liability` / `CR 1030 Accounts Receivable`
- **Critical Accounting Invariant:**
  - Customer advance payments NEVER credit Revenue directly (`4010`).
  - Invoice knock-off NEVER touches Cash/Bank (`1010`/`1020`) — zero cash movement occurs during knock-off settlement.

---

## 2. Reused Existing Tables & Schema Non-Proliferation
In accordance with zero-schema-duplication constraints, **no new database tables, no new allocation schemas, and no Alembic migrations** were introduced:
1. `payment_transactions`: The canonical system of record for advance receipts.
   - `reference_doc_type = "CUSTOMER_ADVANCE"`
   - `party_id = customer_id`
   - `auto_allocate = False`
2. `payment_allocations`: The canonical record for subsequent invoice knock-offs.
   - Links `payment_id` (advance) to `invoice_id` (target sales invoice).
   - Generates deterministic allocation identities (`pal_...`) supporting idempotent retry.
3. `journal_vouchers` & `general_ledger_entries`: Double-entry accounting system of record.
   - Advance receipt: `reference_doc_type = "PAYMENT_TRANSACTION"`, voucher type `JOURNAL` / `RECEIPT`.
   - Invoice knock-off: `reference_doc_type = "PAYMENT_ALLOCATION"`, voucher type `JOURNAL`.
4. `sales_invoices`: Authorized system of record for invoice balances.
   - `paid_amount` updated atomically.
   - `balance_amount = max(0, grand_total - paid_amount)`.
   - Transitions to `PAID` when `balance_amount == 0.00`.

---

## 3. Account 2050 Configuration & Seeding Architecture
1. **Canonical Chart of Accounts Registry:**
   - Account `2050` ("Customer Advance Liability", Type: `LIABILITY`, Root: `LIABILITY`, Parent: `2000`, `party_type="CUSTOMER"`) was registered directly into `DEFAULT_CHART_OF_ACCOUNTS` in [unified_ledger.py](file:///f:/SMRITRretailNX/backend/app/services/unified_ledger.py).
2. **Company-Scoped Dynamic Resolution:**
   - `UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "2050")` resolves the account scoped to the company.
   - If missing in a company COA, `seed_default_chart_of_accounts(session, company_id)` seeds it idempotently.
3. **Historical Company Migration Safety:**
   - Seeding was executed across all 41 existing tenant company charts of accounts via transaction-safe batching.
   - Exactly 41 account rows were added (bringing total system accounts from 1,230 to 1,271) without schema changes or DDL modifications.

---

## 4. Advance Receipt Flow
1. **Endpoint/Invocation:**
   - `PaymentsEngine.process_payment(session, company_id, req, commit=...)`
   - `req.reference_doc_type = "CUSTOMER_ADVANCE"`
   - `req.party_id = customer_id`
   - `req.auto_allocate = False`
2. **Persistence & GL Generation:**
   - Inserts `PaymentTransaction` row (`status="SUCCESS"`).
   - Synchronously invokes `UnifiedAccountingLedgerService.post_payment_transaction_to_gl()`.
   - Resolves tender type:
     - `CASH` -> Account `1010` (Cash in Hand)
     - `BANK_TRANSFER` / `UPI` / `CARD` -> Account `1020` (Bank Accounts)
   - Resolves liability: Account `2050` (Customer Advance Liability).
   - Creates balanced `JournalVoucher` and 2 `GeneralLedgerEntry` rows.

---

## 5. Unallocated Advance Balance Invariant
The authoritative balance is derived exclusively from canonical database state:
$$\text{unallocated\_amount} = \text{payment.amount} - \sum(\text{active non-deleted } \text{payment\_allocations.allocated\_amount})$$
- Invariant: $0 \le \text{unallocated\_amount} \le \text{payment.amount}$.
- No duplicate or competing balance cache column is stored on `payment_transactions`.
- Attempting to allocate an amount greater than $\text{unallocated\_amount}$ raises an immediate validation exception and aborts atomically.

---

## 6. Advance → Invoice Knock-Off Flow
1. **Endpoint/Invocation:**
   - `PaymentsEngine.allocate_payment(session, company_id, payment_id, req, commit=...)`
   - Supports direct allocation or orchestration via `UniversalLifecycleEngine` (`SalesInvoice` action `PAY` with `advance_payment_id`).
2. **Pessimistic Concurrency & Row Locking:**
   - Selects `PaymentTransaction` with `.with_for_update()` lock.
   - Selects target `SalesInvoice` with `.with_for_update()` lock.
3. **Pre-Allocation Validations:**
   - `tx.status == "SUCCESS"` (cancelled/void advances rejected).
   - `inv.status not in ("CANCELLED", "VOID")` (cancelled invoices rejected).
   - `inv.company_id == tx.company_id` (cross-company allocation rejected).
   - `inv.customer_id == tx.party_id` (customer mismatch rejected).
   - `alloc_req_amt <= unallocated_advance` (advance over-allocation rejected).
   - `alloc_req_amt <= inv.balance_amount` (invoice over-allocation rejected).
4. **State Mutation:**
   - Creates `PaymentAllocation` row.
   - Mutates `inv.paid_amount` and `inv.balance_amount`. Sets `inv.status = "PAID"` if balance reaches 0.
5. **Knock-Off GL Posting:**
   - Invokes `UnifiedAccountingLedgerService.post_payment_allocation_to_gl()`.
   - Entry: `DR 2050 Customer Advance Liability` / `CR 1030 Accounts Receivable` with `party_id = inv.customer_id`.
   - Zero Cash/Bank entries created.

---

## 7. Atomicity, Idempotency & Rollback Guarantees
- **Atomic Rollback on Error:**
  - In `PaymentsEngine.process_payment` and `allocate_payment`, all operations and GL calls are wrapped in `try...except`. If `commit=True` and any GL posting or database operation fails, `await session.rollback()` is invoked immediately, ensuring zero orphan transactions, zero unbalanced journal vouchers, and immediate restoration of invoice balance.
- **Idempotency:**
  - Advance Receipt: Idempotency keys (`idempotency_key`) return existing transactions without creating duplicate records or journal vouchers.
  - Advance Knock-off: Deterministic allocation ID generation (`uuid.uuid5(company_id, payment_id, idempotency_key)`) prevents double-allocation on network retries.

---

## 8. Multi-Invoice & Partial Settlement Support
- **Partial Knock-off:** Customer advance of ₹10,000 against invoice of ₹6,000 allocates ₹6,000, leaving ₹4,000 unallocated balance available for subsequent allocations.
- **Multi-Invoice Knock-off:** Customer advance of ₹10,000 can be sequentially or iteratively knocked off against multiple invoices (e.g. ₹3,000 + ₹4,000 + ₹3,000), resulting in exactly ₹10,000 allocated and ₹0 remaining, with separate balanced knock-off journal vouchers for each invoice.

---

## 9. Historical Data Non-Interference
- Prior to P2.4, exactly 29 historical payments existed in `payment_transactions` (all direct invoice settlements with `reference_doc_type = "SALES_INVOICE"`).
- **Zero historical payments were converted or altered.**
- Historical table row counts remain completely preserved.

---

## 10. Live PostgreSQL Verification Evidence

### Test Suite Execution
- **P2.4 Test Suite:** `app/tests/test_p2_4_advance_payment.py`
  - 17/17 PASSED in 94.75s.
- **P2.3 Test Suite (Payment GL Atomicity):** `app/tests/test_p2_3_payment_gl_atomicity.py`
  - 17/17 PASSED in 55.80s.
- **P2.2 Test Suite (Return GL Atomicity):** `app/tests/test_p2_2_return_gl_atomicity.py`
  - 15/15 PASSED in 53.10s.
- **P2.1 Test Suite (Invoice GL Atomicity):** `app/tests/test_p2_1_invoice_gl_atomicity.py`
  - 8/8 PASSED in 45.61s.
- **Combined P2.1–P2.4 Suite:**
  - 57/57 PASSED in 92.34s.
- **Sales Stock Authority & Universal Lifecycle Regression Suite:**
  - 32/32 PASSED in 59.53s.
- **Total Combined Verified Tests:** **89 / 89 PASSED (100% Green, Zero Regressions)**.

---

## 11. Known Architectural Boundaries
- P2.4 strictly covers Customer Advance Payments and Invoice Knock-off.
- Customer wallets, credit balances, customer refund processing (P2.5), and payment reversal engines remain outside P2.4 scope.
