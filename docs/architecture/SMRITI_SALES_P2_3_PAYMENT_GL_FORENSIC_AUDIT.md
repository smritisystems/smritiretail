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

# SMRITI SALES — P2.3 PAYMENT GL FORENSIC AUDIT
**Phase 0: Pre-Implementation Read-Only Architectural & Database Audit**  
**Authoritative Standard:** BD-03 — Synchronous Payment Receipt GL  
**Target Invariant:** `PaymentTransaction` $\iff$ `PaymentAllocation` $\iff$ `JournalVoucher(PAYMENT_RECEIPT)`  
**Accounting Formula:**  
- **Debit:** Cash in Hand (`1010`) / Bank Accounts (`1020`)
- **Credit:** Accounts Receivable / Debtors (`1030`)

---

## 1. Executive Summary

### 1.1 Objective & Context
This forensic audit was commissioned prior to the implementation of **P2.3 Payment GL** under the frozen business decision **BD-03 (Synchronous Payment Receipt GL)**. The core mandate of BD-03 is to ensure that customer payments received against sales invoices (whether at POS checkout or post-billing settlement) execute with atomic, fail-fast, double-entry financial accounting:
$$\text{PaymentTransaction} \iff \text{PaymentAllocation} \iff \text{JournalVoucher}(\text{PAYMENT\_RECEIPT})$$
Every settlement must synchronously debit the tender ledger (Cash `1010` or Bank `1020`) and credit Accounts Receivable (`1030`), guaranteeing zero drift between payment gateway records, allocation tables, invoice balances, and General Ledger (GL) entries.

### 1.2 Core Audit Findings
1. **Existing Orphaned GL Service:**  
   `UnifiedAccountingLedgerService.post_payment_transaction_to_gl` (`backend/app/services/unified_ledger.py#L1363-L1457`) already implements the exact double-entry logic required by BD-03 (DR `1010`/`1020`, CR `1030`). However, **it is completely uninvoked in production workflows**. Neither POS billing, document lifecycle transitions, nor direct payment APIs call this method.
2. **100% Payment GL Deficit in Live Database:**  
   Live read-only inspection of the production database (`smriti001`) revealed **29 payment transactions** totaling **₹7,410.00**, accompanied by **29 payment allocations** totaling **₹7,410.00**. **Exactly 0 of these 29 payments have a corresponding `JournalVoucher` or `GeneralLedgerEntry`**.
3. **Bare In-Memory Status Mutations:**  
   `SalesInvoiceLifecycleHandler` under `action="PAY"` (`backend/app/services/lifecycle/handlers/sales_invoice.py#L272-L276`) mutates `doc.paid_amount` and `doc.balance_amount` directly in memory without creating a `PaymentTransaction`, without allocating funds, and without posting to GL.
4. **Premature Commit Risks:**  
   `PaymentsEngine.process_payment` and `PaymentsEngine.allocate_payment` default to `commit: bool = True` (`backend/app/services/payments_engine.py#L86, #L373`), which violates transaction atomicity if invoked within `UniversalLifecycleEngine` or multi-step service boundaries.
5. **Missing Invoice Validations in Standalone Allocation:**  
   `PaymentsEngine.allocate_payment` (`#L366-L431`) validates that the allocation does not exceed the payment transaction amount, but **fails to verify whether the target `invoice_id` exists, whether it belongs to the same company, or whether the allocation exceeds the invoice's remaining balance**.
6. **Concurrency Gaps:**  
   `SalesInvoice` row locking (`with_for_update()`) is omitted during payment processing and payment allocation, allowing potential race conditions during concurrent settlements.

### 1.3 Audit Verdict
**FINAL VERDICT: P2.3 READY WITH CONDITIONS**  
The underlying data structures (`PaymentTransaction`, `PaymentAllocation`, `JournalVoucher`, `GeneralLedgerEntry`) and GL posting logic already exist and are architecturally sound. P2.3 can proceed once the documented P0 gaps are remediated as part of the implementation.

---

## 2. Git & Change Forensics

### 2.1 Working Tree Status
A strict read-only inspection of the git working tree was executed to verify that no source code, test files, or migrations have been modified for P2.3, and that the completed P2.2 working tree remains fully intact.

#### Terminal Output: `git status --short`
```bash
 M backend/app/services/lifecycle/handlers/sales_return.py
 M backend/app/services/sales_stock_authority.py
 M backend/app/services/unified_ledger.py
 A backend/app/tests/test_p2_2_return_gl_atomicity.py
 M backend/app/tests/test_universal_sales_lifecycle.py
 A docs/architecture/SMRITI_SALES_P2_2_RETURN_GL_FORENSIC_AUDIT.md
 A docs/architecture/SMRITI_SALES_P2_2_RETURN_GL_IMPLEMENTATION.md
```

#### Terminal Output: `git diff --stat`
```bash
 backend/app/services/lifecycle/handlers/sales_return.py |  118 ++-
 backend/app/services/sales_stock_authority.py           |   60 +-
 backend/app/services/unified_ledger.py                  |  120 +++
 backend/app/tests/test_p2_2_return_gl_atomicity.py      | 1021 ++++++++++++++++++++
 backend/app/tests/test_universal_sales_lifecycle.py     |   13 +-
 docs/architecture/SMRITI_SALES_P2_2_RETURN_GL_FORENSIC_AUDIT.md | 289 ++++++
 docs/architecture/SMRITI_SALES_P2_2_RETURN_GL_IMPLEMENTATION.md | 235 +++++
 7 files changed, 1838 insertions(+), 18 deletions(-)
```

### 2.2 Analysis
- All modified files belong exclusively to **P2.2 Sales Return GL + Inventory/COGS Reversal**.
- Zero P2.3 code modifications exist.
- Zero untracked temporary files or uncommitted scratch scripts exist in the repository tree.
- The P2.2 implementation is complete and uncompromised.

---

## 3. Current Payment Lifecycle Trace

Three distinct code paths exist in the application for processing customer payments:

```
[Path A: POS Checkout]
CanonicalSalesWriter.post_sales_transaction()
  ├── PaymentsEngine.process_payment(commit=False)
  │     ├── PaymentTransaction(status="SUCCESS")
  │     └── PaymentAllocation(allocated_amount)
  ├── Direct mutation: db_invoice.paid_amount = total_paid
  ├── Direct mutation: db_invoice.balance_amount = grand_total - total_paid
  ├── Outbox: CanonicalSalesInvoicePostedEvent
  └── UnifiedAccountingLedgerService.post_sales_invoice_to_gl()
        ├── DR Accounts Receivable (1030) = Grand Total
        └── CR Sales Revenue (4010) + Taxes (2021/2022/2023)
        [CRITICAL DEFICIT: Zero Payment GL posted! AR remains uncollected!]

[Path B: Lifecycle Action "PAY"]
UniversalLifecycleEngine.execute_transition(doc, action="PAY")
  └── SalesInvoiceLifecycleHandler.apply_transition(action="PAY")
        ├── doc.paid_amount = Decimal(payload.get("amount"))
        └── doc.balance_amount = max(0, grand_total - paid_amount)
        [CRITICAL DEFICIT: In-memory mutation only. No PaymentTransaction, no GL!]

[Path C: Direct REST API]
POST /api/v1/payments/process
  └── PaymentsEngine.process_payment(commit=True)
        ├── PaymentTransaction(status="SUCCESS")
        ├── PaymentAllocation(auto_allocate=True)
        └── session.commit()
        [CRITICAL DEFICIT: Invoice paid_amount/balance_amount NOT updated! No GL!]
```

### Detailed Trace by Component

1. **`CanonicalSalesWriter.post_sales_transaction`**  
   (`backend/app/services/canonical_sales_writer.py#L701-L736`):
   - Invoked during retail POS checkout.
   - Converts `req.tenders` into `PaymentTenderItem` records.
   - Calls `PaymentsEngine.process_payment(session, company_id, req, commit=False)` with `auto_allocate=True`.
   - Directly mutates `db_invoice.paid_amount = total_paid` and `db_invoice.balance_amount = max(0, net_rounded - total_paid)` (`#L733-L734`).
   - Emits `CanonicalSalesInvoicePostedEvent` via the transactional outbox (`#L738-L750`).
   - The outbox consumer triggers `post_sales_invoice_to_gl` (`backend/app/services/unified_ledger.py#L441-L550`), which debits Account `1030` (AR) for the full `grand_total`.
   - **Glaring Deficit:** No payment GL is posted. Even when a customer pays 100% cash at the POS counter, the General Ledger records a debit to Accounts Receivable (`1030`), but never debits Cash (`1010`) or credits AR (`1030`).

2. **`SalesInvoiceLifecycleHandler` (`action="PAY"`)**  
   (`backend/app/services/lifecycle/handlers/sales_invoice.py#L272-L276`):
   - The lifecycle handler exposes transition `POSTED -> PAID` via action `PAY`.
   - Line 272-276 contains only:
     ```python
     elif act == "PAY":
         pay_amount = payload.get("amount") or doc.grand_total
         doc.paid_amount = Decimal(str(pay_amount))
         doc.balance_amount = max(Decimal("0.00"), Decimal(str(doc.grand_total or 0.00)) - doc.paid_amount)
     ```
   - It performs bare field assignment. It creates no `PaymentTransaction`, no `PaymentAllocation`, emits no outbox event, and invokes no GL service.

3. **`PaymentsEngine.process_payment`**  
   (`backend/app/services/payments_engine.py#L80-L273`):
   - Validates idempotency against `PaymentTransaction.idempotency_key`.
   - Creates a `PaymentTransaction` row per tender with status `"SUCCESS"`.
   - If `req.auto_allocate=True`, creates a `PaymentAllocation` row.
   - Executes `await session.commit()` if `commit=True` (`#L219-L220`).
   - Does NOT update `SalesInvoice.paid_amount` or `SalesInvoice.balance_amount`.
   - Does NOT invoke `UnifiedAccountingLedgerService.post_payment_transaction_to_gl`.

4. **`PaymentsEngine.allocate_payment`**  
   (`backend/app/services/payments_engine.py#L366-L431`):
   - Allocates unallocated payment balance across an invoice.
   - Checks that allocation does not exceed `tx.amount - already_allocated`.
   - Creates `PaymentAllocation` row.
   - Does NOT verify that `invoice_id` exists in the database.
   - Does NOT verify that `invoice_id` belongs to `company_id`.
   - Does NOT verify that `allocated_amount <= invoice.balance_amount`.
   - Does NOT update `SalesInvoice.paid_amount` or `balance_amount`.
   - Does NOT invoke GL posting.

---

## 4. Payment Writers Inventory

The following table catalogs every component across the codebase that modifies payment records, invoice balances, or GL ledgers:

| Writer | File | Method | Purpose | Canonical? | Risk Level |
|---|---|---|---|---|---|
| `PaymentsEngine` | `backend/app/services/payments_engine.py` | `process_payment` | Creates `PaymentTransaction` and `PaymentAllocation` | **Yes (Payments)** | **P0 (Premature commit, missing GL)** |
| `PaymentsEngine` | `backend/app/services/payments_engine.py` | `allocate_payment` | Allocates unallocated payment to invoice | **Yes (Allocations)** | **P0 (No invoice validation, missing GL)** |
| `PaymentsEngine` | `backend/app/services/payments_engine.py` | `process_refund` | Creates refund `PaymentTransaction`, updates status | **Yes (Refunds)** | **P1 (Missing GL reversal)** |
| `CanonicalSalesWriter` | `backend/app/services/canonical_sales_writer.py` | `post_sales_transaction` | POS checkout payment creation and invoice balance update | **Yes (POS Sales)** | **P0 (Direct invoice balance mutation, missing Payment GL)** |
| `SalesInvoiceLifecycleHandler` | `backend/app/services/lifecycle/handlers/sales_invoice.py` | `apply_transition(PAY)` | Transitions invoice to PAID | **Yes (Lifecycle)** | **P0 (Bare in-memory mutation, lifecycle bypass)** |
| `SalesService` | `backend/app/services/sales.py` | `create_invoice` | Bridges legacy sales create to canonical posting | No (Wrapper) | Low (Delegates to `CanonicalSalesWriter`) |
| `EcomEngine` | `backend/app/services/ecom_engine.py` | `convert_order_to_sales_invoice` | Sets `paid_amount = net_amount` directly | No (Ad-hoc) | **P1 (Bypasses PaymentsEngine and GL)** |
| `DispatchImportService` | `backend/app/services/dispatch_import.py` | `import_dispatch` | Sets `paid_amount = grand_total` directly | No (Ad-hoc) | **P1 (Bypasses PaymentsEngine and GL)** |
| `UnifiedPricingPaymentService` | `backend/app/services/pricing_payment.py` | `record_payment_settlement` | Legacy multi-tender recording (pre-PaymentsEngine) | No (Deprecated) | **P2 (Used only in `t_pricing_eng.py`)** |
| `SalesReturnRefundAdapter` | `backend/app/services/sales_return_refund_adapter.py` | `process_refund` | Creates return refund `PaymentTransaction` | Yes (Return Refund) | Low (Audited in P2.2) |
| `UnifiedAccountingLedgerService` | `backend/app/services/unified_ledger.py` | `post_payment_transaction_to_gl` | Authoritative double-entry GL poster for payments | **Yes (GL System)** | **P0 (Currently uninvoked/orphaned)** |

---

## 5. Payment GL Current State: 15-Point Forensic Assessment

| # | Forensic Question | Current Behavior | Evidence / Citation |
|---|---|---|---|
| 1 | Is a `JournalVoucher` created on payment? | **NO.** Zero payment vouchers exist. | `payments_engine.py#L217-L223`, Live DB: 0 JVs for PTs |
| 2 | Is `reference_doc_type` `PAYMENT_RECEIPT`? | In `post_payment_transaction_to_gl`, `voucher_type="PAYMENT_RECEIPT"`, but `reference_doc_type=payment.reference_doc_type` (`"SALES_INVOICE"`). | `unified_ledger.py#L1450, #L1453` |
| 3 | Is `reference_doc_id` the `PaymentTransaction.id`? | Yes, in `post_payment_transaction_to_gl`. | `unified_ledger.py#L1454` |
| 4 | Are GL entries created synchronously? | **NO.** Currently not created at all. | `canonical_sales_writer.py#L725-L736` |
| 5 | Is Cash/Bank debited? | In `post_payment_transaction_to_gl`, line 1410 debits `tender_account.id` (1010/1020). | `unified_ledger.py#L1410-L1415` |
| 6 | Is Accounts Receivable credited? | In `post_payment_transaction_to_gl`, line 1417 credits `acc_debtors.id` (1030). | `unified_ledger.py#L1417-L1422` |
| 7 | Does amount equal allocation? | **NO.** It uses `payment.amount`. If a payment has multiple allocations, it treats the entire payment as a single lump sum. | `unified_ledger.py#L1402` |
| 8 | Is correct company/tenant used? | Yes. `company_id` filter is strictly applied. | `unified_ledger.py#L1379, #L1386` |
| 9 | Are Cash vs Bank accounts selected correctly? | Checks `payment.tender_type == "CASH"` $\to 1010$, else $\to 1020$. | `unified_ledger.py#L1396-L1400` |
| 10 | What happens if GL posting fails? | Unhandled in callers. In `CanonicalSalesWriter`, stock/invoice commits would roll back only if inside the same session block. | `canonical_sales_writer.py#L725` |
| 11 | Can payment remain POSTED while GL is missing? | **YES.** 100% of live payments (29/29) are SUCCESS with 0 GL entries. | Live DB Query: `PT=29, JV=0` |
| 12 | Can GL exist while payment remains unposted? | No. `post_payment_transaction_to_gl` requires payment row to exist first. | `unified_ledger.py#L1379-L1382` |
| 13 | Can duplicate payment processing create duplicate JVs? | No. Idempotency guard checks `reference_doc_id == payment_id`. | `unified_ledger.py#L1385-L1392` |
| 14 | Is payment processing idempotent? | Yes, `PaymentsEngine.process_payment` checks `idempotency_key`. | `payments_engine.py#L94-L107` |
| 15 | Is concurrency protected? | **NO.** `SalesInvoice` is not locked with `with_for_update()` during payment or allocation. | `payments_engine.py#L80-L273, #L366-L431` |

---

## 6. Payment Allocation Forensics

### 6.1 Authority of `PaymentAllocation`
- **Data Model:** `PaymentAllocation` (`backend/app/models/payment_ledger.py#L48-L62`) stores:
  - `payment_id`: Foreign key to `PaymentTransaction.id`
  - `invoice_id`: Target invoice reference
  - `allocated_amount`: Numeric(15, 2)
  - `discount_allowed`: Numeric(15, 2)
  - `settled_at`: Timestamp
  - `company_id`, `branch_id`: Tenant identifiers

### 6.2 Structural Questions Answered
1. **Can one payment allocate to multiple invoices?**  
   **YES.** A user can invoke `PaymentsEngine.allocate_payment` multiple times against the same `payment_id` with different `invoice_id` values, provided $\sum \text{allocated\_amount} \le \text{payment.amount}$.
2. **Can an invoice receive multiple payments?**  
   **YES.** Multiple `PaymentAllocation` records can point to the same `invoice_id`.
3. **Can allocation exceed invoice outstanding amount?**  
   **YES (VULNERABILITY).** `PaymentsEngine.allocate_payment` (`#L366-L431`) never queries `SalesInvoice` to verify its `balance_amount`. It allows allocating ₹1,000 to an invoice that only owes ₹100.
4. **Can allocation exceed payment amount?**  
   **NO.** Line 396 explicitly raises:
   `ValueError(f"Allocation amount ₹{alloc_req_amt} exceeds unallocated payment balance ₹{unalloc}")`.
5. **Are allocations tenant/company scoped?**  
   The record carries `company_id`, but `allocate_payment` does not check if the referenced invoice belongs to the same `company_id`.
6. **Are allocations immutable after posting?**  
   Currently, there are no triggers or lifecycle guards preventing modification or deletion of allocations.

---

## 7. AR Balance Accounting & Competing Sources of Truth

### 7.1 Source of Truth Analysis
An audit of invoice balance calculation revealed **four competing sources of truth**:

```
[Source 1: SalesInvoice.paid_amount & balance_amount]
  - Denormalized columns on sales_invoices table.
  - Updated by: CanonicalSalesWriter, SalesInvoiceLifecycleHandler.
  - NOT updated by: PaymentsEngine.allocate_payment.

[Source 2: PaymentAllocation Table]
  - Normalized join table tracking payment-to-invoice settlements.
  - Updated by: PaymentsEngine (auto_allocate or allocate_payment).
  - Ignored by: SalesInvoiceLifecycleHandler (action="PAY").

[Source 3: PaymentTransaction Table]
  - Tracks total funds collected by tender type.
  - Contains reference_doc_id pointing directly to invoice in POS flows.

[Source 4: General Ledger Account 1030 (Accounts Receivable)]
  - System-of-record financial ledger.
  - Debited by post_sales_invoice_to_gl.
  - NEVER credited by payment flows today.
```

### 7.2 Invariant Requirement for P2.3
To establish rock-solid accounting integrity, P2.3 must mandate:
$$\text{SalesInvoice.paid\_amount} \equiv \sum \text{PaymentAllocation.allocated\_amount}$$
$$\text{SalesInvoice.balance\_amount} \equiv \text{SalesInvoice.grand\_total} - \text{SalesInvoice.paid\_amount}$$
$$\text{GL Account 1030 Balance for Customer} \equiv \sum \text{Invoice Debits} - \sum \text{Payment Credits}$$

---

## 8. Cash / Bank Account Resolution

### 8.1 Account Mapping Logic
In `UnifiedAccountingLedgerService.post_payment_transaction_to_gl` (`backend/app/services/unified_ledger.py#L1396-L1408`):
```python
tender_type = (payment.tender_type or "CASH").upper()
if tender_type == "CASH":
    tender_account = await cls.get_account_by_code(session, company_id, "1010")
else:
    tender_account = await cls.get_account_by_code(session, company_id, "1020")

acc_debtors = await cls.get_account_by_code(session, company_id, "1030")
```

### 8.2 Account Characteristics
- **`1010` (Cash in Hand):** Used when `tender_type == "CASH"`.
- **`1020` (Bank Accounts):** Used for non-cash tenders (`"CARD"`, `"UPI"`, `"NETBANKING"`, `"WALLET"`, `"BANK_TRANSFER"`).
- **`1030` (Accounts Receivable / Debtors):** Credited for customer settlements.
- **Tenant Scoping:** Deterministically resolved per company via `get_account_by_code(session, company_id, code)`.
- **Seeding Guard:** `seed_default_chart_of_accounts(session, company_id, branch_id)` is invoked prior to account lookup to ensure COA existence.
- **Limitation:** Specific bank accounts (e.g. HDFC vs ICICI) cannot currently be routed dynamically based on tender metadata; all non-cash settlements default to code `1020`.

---

## 9. Transaction Atomicity & Commit Boundaries

### 9.1 The Premature Commit Defect
`PaymentsEngine.process_payment` and `PaymentsEngine.allocate_payment` accept a parameter `commit: bool = True`:
```python
# backend/app/services/payments_engine.py#L219-L223
if commit:
    await session.commit()
else:
    await session.flush()
```
When invoked from API controllers (`backend/app/api/v1/payments.py#L55, #L100`), `commit` is left as `True`.  
If GL posting is called after `process_payment`, any error during GL voucher generation would occur **after the payment transaction has already been committed to the database**. This violates the fail-fast atomicity requirement of BD-03:
> *"The Payment GL must be synchronous, atomic and fail-fast."*

### 9.2 Required Transaction Boundary for P2.3
In P2.3, the caller (`UniversalLifecycleEngine` or `CanonicalSalesWriter` or `PaymentService`) must maintain complete ownership of the database session transaction. `PaymentsEngine` must be invoked with `commit=False`, and GL vouchers must be posted within the exact same session before any final commit:
```
BEGIN TRANSACTION;
  1. Lock SalesInvoice (SELECT ... FOR UPDATE)
  2. Create PaymentTransaction (flush)
  3. Create PaymentAllocation (flush)
  4. Update SalesInvoice.paid_amount & balance_amount (flush)
  5. Post JournalVoucher(PAYMENT_RECEIPT) + GeneralLedgerEntries (flush)
  6. Emit Outbox / Audit events (flush)
COMMIT;
```
If any step fails, the entire transaction rolls back cleanly.

---

## 10. Idempotency & Concurrency

### 10.1 Idempotency Analysis
- **Payment Level:** `PaymentTransaction` table enforces a database unique constraint:
  `uq_payment_idempotency_key` on `(company_id, idempotency_key)`.
  In `PaymentsEngine.process_payment` (`#L94-L146`), if a matching idempotency key is found, the engine short-circuits and returns existing records without re-inserting.
- **GL Level:** `UnifiedAccountingLedgerService.post_payment_transaction_to_gl` (`#L1385-L1392`) queries:
  ```python
  select(JournalVoucher).where(
      JournalVoucher.company_id == company_id,
      JournalVoucher.reference_doc_id == payment_id,
      JournalVoucher.is_deleted == False
  )
  ```
  If an existing voucher is found, it returns the existing voucher immediately, preventing duplicate GL entries.

### 10.2 Concurrency Vulnerability
- During POS billing, `CanonicalSalesWriter` relies on `TransactionIntegrityEngine.acquire_idempotency_lock`.
- However, during standalone payment processing (`PaymentsEngine.process_payment`) and allocation (`PaymentsEngine.allocate_payment`), **no row lock (`SELECT FOR UPDATE`) is acquired on `SalesInvoice`**.
- **Race Condition:** Two concurrent payment requests against the same invoice could both read `balance_amount = 500`, allocate ₹500 each, resulting in `paid_amount = 1000` on a ₹500 invoice.

---

## 11. Tenant / Company Isolation

### 11.1 Scoping Audit
All relevant entities contain `company_id`:
- `PaymentTransaction.company_id`
- `PaymentAllocation.company_id`
- `SalesInvoice.company_id`
- `JournalVoucher.company_id`
- `GeneralLedgerEntry.company_id`

### 11.2 Live Database Cross-Company Audit
A read-only query was executed across all live allocations in `smriti001`:
```sql
SELECT count(*) 
FROM payment_allocations pa
JOIN payment_transactions pt ON pa.payment_id = pt.id
JOIN sales_invoices si ON pa.invoice_id = si.id
WHERE pa.company_id != pt.company_id OR pa.company_id != si.company_id;
```
**Result:** `0` cross-company records found.

### 11.3 Code-Level Vulnerability
In `PaymentsEngine.allocate_payment` (`#L366-L431`):
The input parameter `req.invoice_id` is written directly into `PaymentAllocation(invoice_id=req.invoice_id)` without verifying:
```python
invoice = await session.execute(
    select(SalesInvoice).where(SalesInvoice.id == req.invoice_id, SalesInvoice.company_id == company_id)
)
```
This allows a malicious or buggy API caller to allocate Company A's payment to Company B's invoice. This check must be enforced in P2.3.

---

## 12. Cancellation / Reversal Forensics

### 12.1 Current Payment Cancellation
- `PaymentsEngine` provides `process_refund`, but has **no cancellation or voiding mechanism** for payments.
- `process_refund` creates a new `PaymentTransaction` with `reference_doc_type="PAYMENT_REFUND"`, but does NOT post any reversing GL entries.

### 12.2 The Paid Invoice Cancellation Dilemma
In `SalesInvoiceLifecycleHandler.apply_transition(action="CANCEL")` (`backend/app/services/lifecycle/handlers/sales_invoice.py#L251-L270`):
If an invoice is cancelled after being marked `PAID`:
1. It calls `post_sales_cancellation_to_gl`, which credits Account `1030` (AR) to reverse the invoice's original debit.
2. But if a payment was already made, Account `1030` was already credited by the payment!
3. Cancelling the invoice without refunding/reversing the payment leaves Account `1030` with a **double credit** (net negative receivable) and leaves Cash/Bank debited with no offsetting liability.
4. **Architectural Guard Needed:** P2.3 must strictly forbid cancelling a `PAID` sales invoice unless its allocated payments are explicitly unallocated or refunded first.

---

## 13. Existing Accounting Infrastructure

P2.3 will reuse the following production-hardened accounting infrastructure:
1. **`UnifiedAccountingLedgerService.post_journal_voucher`**:
   Authoritative voucher creator enforcing balanced debits/credits, currency precision (`0.01`), and entry numbering.
2. **`UnifiedAccountingLedgerService.post_payment_transaction_to_gl`**:
   The core payment GL method, ready to be wired into lifecycle handlers and payment engines.
3. **`UnifiedAccountingLedgerService.get_account_by_code`**:
   Deterministic, cached COA account resolver.
4. **`UniversalLifecycleEngine`**:
   Strict state machine engine enforcing role-based permissions and atomic execution.
5. **`TransactionIntegrityEngine`**:
   Centralized locking and idempotency verification.

---

## 14. Live Database Forensics (Database: `smriti001`)

Direct read-only inspection of the live PostgreSQL database (`smriti001` on port `2781`) yielded the following exact forensic metrics:

### 14.1 Record Counts
| Table Name | Live Count | Notes |
|---|---|---|
| `payment_transactions` | **29** | All 29 have `tender_type = "CASH"` and `status = "SUCCESS"` |
| `payment_allocations` | **29** | Exactly 1 allocation per payment transaction |
| `sales_invoices` | **207** | 190 `Submitted` (active), 17 `Cancelled` |
| `journal_vouchers` | **17** | All 17 vouchers are `SALES_INVOICE_CANCEL`. **0 Payment vouchers** |
| `general_ledger_entries` | **68** | Exactly 4 entries per cancellation voucher ($17 \times 4 = 68$) |

### 14.2 Integrity & Consistency Queries
| Integrity Metric Checked | SQL Check | Result | Forensic Status |
|---|---|---|---|
| Orphan allocations without payment | `LEFT JOIN payment_transactions WHERE pt.id IS NULL` | **0** | Clean |
| Orphan allocations without invoice | `LEFT JOIN sales_invoices WHERE si.id IS NULL` | **0** | Clean |
| Duplicate payment vouchers | `GROUP BY reference_doc_id HAVING count(*) > 1` | **0** | Clean |
| Unbalanced payment vouchers | `HAVING abs(sum(debit) - sum(credit)) > 0.001` | **0** | Clean |
| Cross-company allocations | `pa.company_id != pt.company_id OR pa.company_id != si.company_id` | **0** | Clean |
| POSTED payments with NO GL voucher | `WHERE pt.status='SUCCESS' AND jv.id IS NULL` | **29** | **100% GL Deficit** |
| Invoices where `grand_total != paid + balance` | `abs(grand_total - (paid_amount + balance_amount)) > 0.01` | **0** | Clean |
| Invoices where `paid_amount != sum(allocations)` | `abs(paid_amount - sum(allocated_amount)) > 0.01` | **0** | Clean |
| Total sum of `payment_transactions.amount` | `SELECT sum(amount) FROM payment_transactions` | **₹7,410.00** | Balanced |
| Total sum of `payment_allocations.allocated_amount` | `SELECT sum(allocated_amount) FROM payment_allocations` | **₹7,410.00** | Balanced |
| Total sum of `sales_invoices.paid_amount` | `SELECT sum(paid_amount) FROM sales_invoices` | **₹7,410.00** | Balanced |

---

## 15. Existing Test Integrity

### 15.1 Existing Test Suite Inventory
An audit of existing tests across `backend/tests/` and `backend/app/tests/` was conducted:

| Test File | Total Tests | Mock vs Real DB | Tests Payment GL? | Quality Assessment |
|---|---|---|---|---|
| `backend/tests/t_payments.py` | 6 | Real DB (`smriti001`) | **NO** | Tests `PaymentsEngine` DTO responses and allocation limits. Asserts zero `JournalVoucher` or `GeneralLedgerEntry`. |
| `backend/tests/t_pricing_eng.py` | 5 | Real DB (`smriti001`) | **NO** | Tests legacy `UnifiedPricingPaymentService` settlement. Zero GL assertions. |
| `backend/app/tests/test_universal_sales_lifecycle.py` | 12 | Real DB (`async_db`) | **NO** | Tests `SUBMIT`, `POST`, `CANCEL`. Does **not** test `PAY`. |
| `backend/app/tests/test_p2_1_invoice_gl_atomicity.py` | 9 | Real DB (`async_db`) | **NO** | Tests invoice posting GL and cancellation reversal GL. Zero payment tests. |
| `backend/app/tests/test_p2_2_return_gl_atomicity.py` | 10 | Real DB (`async_db`) | **NO** | Tests sales return GL and refund adapter. Zero customer payment tests. |

### 15.2 Test Summary
- **Existing Payment Tests:** 6 (`t_payments.py`)
- **Real DB Tests:** 6
- **Mock-Only Tests:** 0
- **Tests Verifying `JournalVoucher` on Payment:** **0 (Zero)**
- **Tests Verifying GL Debits/Credits on Payment:** **0 (Zero)**
- **Tests Verifying Invoice Rollback on GL Failure:** **0 (Zero)**

---

## 16. Proposed P2.3 Test Matrix

For P2.3 implementation, the following minimum 17-test suite must be implemented in `backend/app/tests/test_p2_3_payment_gl_atomicity.py`:

| # | Test Name | Setup | Action | DB Assertions | Expected Rollback State |
|---|---|---|---|---|---|
| 1 | `test_cash_payment_gl_creation` | POSTED invoice for ₹1,000 | Record ₹1,000 CASH payment | `JV(PAYMENT_RECEIPT)` created, DR 1010 ₹1000, CR 1030 ₹1000 | N/A (Happy Path) |
| 2 | `test_bank_payment_gl_creation` | POSTED invoice for ₹2,500 | Record ₹2,500 UPI/CARD payment | `JV(PAYMENT_RECEIPT)` created, DR 1020 ₹2500, CR 1030 ₹2500 | N/A (Happy Path) |
| 3 | `test_partial_invoice_payment` | POSTED invoice for ₹1,000 | Record ₹400 CASH payment | Invoice `paid_amount=400`, `balance=600`, DR 1010 ₹400, CR 1030 ₹400 | N/A (Happy Path) |
| 4 | `test_full_invoice_settlement` | POSTED invoice for ₹1,000 | Record 2nd payment of ₹600 | Invoice `status=PAID`, `paid=1000`, `balance=0`, second JV for ₹600 | N/A (Happy Path) |
| 5 | `test_split_multi_tender_payment` | POSTED invoice for ₹1,500 | Pay ₹500 Cash + ₹1000 Card | 2 JVs (or 1 composite JV), DR 1010 ₹500, DR 1020 ₹1000, CR 1030 ₹1500 | N/A (Happy Path) |
| 6 | `test_multiple_invoice_allocation` | 2 Invoices (Inv A: ₹600, Inv B: ₹400) | Pay ₹1,000 unallocated, allocate A=600, B=400 | 2 Allocations created, Inv A bal=0, Inv B bal=0, GL reflects ₹1000 settlement | N/A (Happy Path) |
| 7 | `test_over_allocation_rejection` | POSTED invoice for ₹500 | Attempt allocate ₹600 | Raises `ValueError` / `HandlerValidationException` | Zero allocation, zero balance change, zero JV |
| 8 | `test_balanced_payment_receipt_jv` | POSTED invoice for ₹888.50 | Pay ₹888.50 | Total JV Debit == Total JV Credit == ₹888.50 | N/A (Happy Path) |
| 9 | `test_ar_credit_matches_party_id` | Invoice with Customer CUST-01 | Pay ₹1,000 | `GLE(CR 1030).party_id == 'CUST-01'` | N/A (Happy Path) |
| 10 | `test_gl_failure_rolls_back_payment` | POSTED invoice for ₹1,000 | GL service raises simulated DB exception | Exception propagated | **PaymentTransaction NOT created, Allocation NOT created, Invoice balance unchanged** |
| 11 | `test_missing_account_fails_fast` | Delete Account 1010 for tenant | Attempt cash payment | Raises 404 / AccountMissingException | Complete rollback: no payment, no balance mutation |
| 12 | `test_duplicate_payment_idempotency` | Post payment with idempotency key | Post exact same request | Returns existing transaction and JV without inserting duplicates | JV count == 1, GLE count == 2 |
| 13 | `test_concurrent_payment_locking` | Invoice for ₹1,000 | 2 concurrent tasks attempt ₹700 payment | Second task detects balance exceeded or serializes cleanly | Total paid never exceeds ₹1,000 |
| 14 | `test_cross_company_payment_blocked` | Comp A invoice, Comp B payment | Attempt allocate Comp B to Comp A | Raises `TenantIsolationException` | Zero allocation committed |
| 15 | `test_invoice_balance_mathematical_parity` | Multi-item invoice with tax | Pay series of 3 partial payments | At each step: `grand_total == paid_amount + balance_amount` | N/A |
| 16 | `test_payment_allocation_consistency` | Unallocated payment ₹5,000 | Allocate ₹2,000, ₹1,500 | `sum(allocations) <= payment.amount`, unallocated = ₹1,500 | N/A |
| 17 | `test_cancel_paid_invoice_guard` | Invoice marked PAID | Attempt CANCEL transition | Raises `HandlerValidationException` (Must reverse payment first) | Invoice remains PAID, zero GL mutation |

---

## 17. Architectural Gap Analysis

| Gap ID | Area | Description | Classification | Action Plan for P2.3 |
|---|---|---|---|---|
| **GAP-01** | Accounting | `UnifiedAccountingLedgerService.post_payment_transaction_to_gl` is uninvoked across all payment flows. | **P0** | Wire synchronously into `SalesInvoiceLifecycleHandler(action="PAY")`, `CanonicalSalesWriter`, and `PaymentsEngine`. |
| **GAP-02** | Lifecycle | `SalesInvoiceLifecycleHandler` performs bare field mutation on `paid_amount`/`balance_amount` with no `PaymentTransaction` or GL. | **P0** | Refactor `apply_transition(PAY)` to delegate to `PaymentsEngine` and `UnifiedAccountingLedgerService`. |
| **GAP-03** | Atomicity | `PaymentsEngine` defaults to `commit=True`, causing premature transaction commits. | **P0** | Enforce `commit=False` when called from lifecycle/orchestrator; caller owns transaction boundary. |
| **GAP-04** | Validation | `PaymentsEngine.allocate_payment` does not check invoice existence, tenant isolation, or remaining balance. | **P0** | Add explicit `SalesInvoice` verification, tenant matching, and over-allocation guards in `allocate_payment`. |
| **GAP-05** | Concurrency | Missing `SELECT FOR UPDATE` on `SalesInvoice` during payment processing and allocation. | **P1** | Add `with_for_update()` row locking on `SalesInvoice` inside payment workflows. |
| **GAP-06** | Accounting | Cancelling a `PAID` invoice triggers a double-credit on Accounts Receivable (1030). | **P1** | Add guard in `SalesInvoiceLifecycleHandler` preventing cancellation of `PAID` invoices without prior payment reversal. |
| **GAP-07** | Testing | Zero tests currently verify `JournalVoucher` creation or GL double-entry for customer payments. | **P1** | Implement complete 17-test suite `test_p2_3_payment_gl_atomicity.py`. |
| **GAP-08** | Legacy Code | `UnifiedPricingPaymentService` contains duplicate payment logic. | **P2** | Mark deprecated; isolate to legacy test suite until retirement. |
| **GAP-09** | Historical Data | 29 live payments in `smriti001` have 0 GL vouchers. | **INFO** | Document requirement for historical backfill script post-P2.3. |

---

## 18. P2.3 Implementation Readiness & Final Verdict

### 18.1 Readiness Assessment
1. **Core Accounting Invariant:** Fully specified by BD-03.
2. **Data Models:** `PaymentTransaction`, `PaymentAllocation`, `SalesInvoice`, `JournalVoucher`, `GeneralLedgerEntry` schemas are 100% in place.
3. **GL Service Logic:** `UnifiedAccountingLedgerService.post_payment_transaction_to_gl` is already written and tested in structure.
4. **Transaction Boundary:** Must be unified under caller-controlled `commit=False` with fail-fast rollback.

### 18.2 Final Verdict
```
================================================================================
FINAL VERDICT: P2.3 READY WITH CONDITIONS
================================================================================
```

### 18.3 Conditions for P2.3 Implementation
P2.3 implementation may commence **strictly subject to the following engineering conditions**:
1. **No Bare Mutations:** `SalesInvoiceLifecycleHandler(action="PAY")` must never directly mutate `paid_amount` or `balance_amount`; it must invoke `PaymentsEngine` to create authoritative `PaymentTransaction` and `PaymentAllocation` records.
2. **Synchronous Fail-Fast GL:** Every payment recorded must synchronously invoke `UnifiedAccountingLedgerService.post_payment_transaction_to_gl` in the same database session.
3. **Strict Session Atomicity:** `PaymentsEngine.process_payment` and `allocate_payment` must be invoked with `commit=False` inside lifecycle transitions; any failure in GL posting must cleanly roll back payment records and invoice balances.
4. **Authoritative Allocation Guards:** `PaymentsEngine.allocate_payment` must load `SalesInvoice` with `with_for_update()`, verify tenant/company isolation, and reject allocations exceeding `invoice.balance_amount`.
5. **No Cancellation of Paid Invoices:** `SalesInvoiceLifecycleHandler` must reject `CANCEL` transitions on `PAID` invoices unless all associated payments have been unallocated or refunded.
6. **17/17 Tests Green:** P2.3 cannot be declared complete until all 17 tests in `test_p2_3_payment_gl_atomicity.py` pass against live PostgreSQL with literal terminal outputs and zero mocks.
