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

# SMRITI Retail OS — Sales Finance Phase P2.4
## Customer Advance Payments & Invoice Knock-Off — Forensic Architecture Audit

**Policy ID:** SMRITI-AUDIT-P2.4-ADVANCE-001  
**Status:** COMPLETE (READ-ONLY FORENSIC AUDIT)  
**Verdict:** **READY WITH CONDITIONS**  
**Implementation Phase:** PHASE 0 (READ-ONLY FORENSIC AUDIT)  
**Target Codebase:** `backend/app/` (FastAPI + PostgreSQL)  
**Database Audited:** PostgreSQL (`localhost:2781/smritisys` & Ephemeral Test Suites)  

---

## 1. Executive Summary

Phase P2.4 introduces **Customer Advance Payments** and **Invoice Knock-Off** into the SMRITI Retail OS financial subsystem. Under canonical double-entry accounting and statutory principles (Indian Companies Act, 2013; Section 31(3)(d) of the CGST Act, 2017):
1. **Advance Receipt:** When a customer gives money prior to invoice issuance, the receipt is recorded as a balance sheet liability, **NOT** as revenue and **NOT** as a direct credit to Accounts Receivable:
   - Cash Tender: $\text{Debit Cash in Hand (1010)} \quad / \quad \text{Credit Customer Advance Liability (2050)}$
   - Bank/UPI Tender: $\text{Debit Bank Accounts (1020)} \quad / \quad \text{Credit Customer Advance Liability (2050)}$
2. **Invoice Knock-Off / Allocation:** When an existing customer advance is subsequently allocated to extinguish an outstanding Sales Invoice balance, a non-cash settlement voucher is posted:
   - $\text{Debit Customer Advance Liability (2050)} \quad / \quad \text{Credit Accounts Receivable (1030)}$
   - Cash and Bank accounts remain completely untouched during knock-off (zero cash movement).

This forensic audit was conducted strictly under **Phase 0 Read-Only Governance**. Zero source code, tests, database rows, seeds, or migrations were modified.

### Key Forensic Findings:
1. **100% Data Model Sufficiency:** The existing `PaymentTransaction` and `PaymentAllocation` models (`backend/app/models/payment_ledger.py`) are fully capable of representing customer advance payments, partial allocations, and multi-invoice knock-offs **without adding any new database tables or altering column definitions**.
2. **Account 2050 Configuration Gap:** Account `2050` ("Customer Advance Liability") **does not exist** in the live database (`smritisys`) and is **missing from `DEFAULT_CHART_OF_ACCOUNTS`** in `backend/app/services/unified_ledger.py`. Under `2000 - Liabilities`, only `2010` (AP) and `2021-2023` (Output GST) currently exist. Account `2050` must be added to the chart of accounts specification.
3. **Flaw in Existing `allocate_payment()` GL Behavior:** Currently, `PaymentsEngine.allocate_payment()` invokes `UnifiedAccountingLedgerService.post_payment_transaction_to_gl(payment_id)`. Because `post_payment_transaction_to_gl` is keyed to `payment.id` and has an idempotency guard, it returns the existing payment voucher, generating **zero GL entries** for the knock-off. Furthermore, if executed without the guard, it would credit AR and debit Cash/Bank, incorrectly double-counting cash. A dedicated knock-off posting function (`post_payment_allocation_to_gl`) is mandatory.
4. **Allocation Concurrency Vulnerability:** `PaymentsEngine.allocate_payment()` locks the target `SalesInvoice` with `with_for_update()`, but **does not lock the `PaymentTransaction` row**. Two concurrent requests attempting to allocate the same advance against two different invoices can race and over-allocate the advance balance. Adding `with_for_update()` to `PaymentTransaction` selection resolves this vulnerability.
5. **Historical Integrity:** The live database contains exactly 29 historical payment transactions totaling ₹7,410.00. All 29 transactions are 100% allocated to direct sales invoices with zero unallocated balance. There are zero corrupted, floating, or orphan historical payments.

---

## 2. Business Rule / BD-04 Candidate

### Business Rule Specification: BD-04 (Customer Advance & Knock-Off Parity)

| Event | Statutory Trigger | Canonical Debit (DR) | Canonical Credit (CR) | Invariant / Guard |
|---|---|---|---|---|
| **Advance Inflow** | Customer deposits money before invoice | `1010` (Cash) or `1020` (Bank) | `2050` (Customer Advance Liability) | Grand Total == Credit. Party ID == Customer ID. Never credit Revenue (`4010`). |
| **Invoice Issuance** | Sales Invoice finalized/posted | `1030` (Accounts Receivable) | `4010` (Sales) + `2021-2023` (GST) | Standard P2.1 Invoice GL. |
| **Advance Knock-Off** | Advance allocated against open invoice | `2050` (Customer Advance Liability) | `1030` (Accounts Receivable) | Cash/Bank NOT touched. Allocation $\le$ Unallocated Advance. Allocation $\le$ Invoice Balance. Party ID Parity. |
| **Advance Refund** | Unused advance returned to customer | `2050` (Customer Advance Liability) | `1010` (Cash) or `1020` (Bank) | Refund $\le$ Unallocated Balance ($Amount - \sum Allocations$). |
| **Multi-Invoice Knock-Off** | 1 advance split across $N$ invoices | `2050` (Customer Advance Liability) | `1030` (Accounts Receivable) | $\sum_{i=1}^N \text{Allocation}_i \le \text{Advance Amount}$. Each produces distinct balanced JV. |

---

## 3. Current Payment Architecture

The end-to-end payment flow in SMRITI Retail OS is orchestrated through the following components:

```text
[Sales Invoice / Lifecycle / POS]
             ↓
[PaymentsEngine.process_payment()]
             ↓
  ┌─────────────────────────┐
  │   PaymentTransaction    │ (Multi-tender ledger: CASH, CARD, UPI, BANK)
  └─────────────────────────┘
             ↓ (if auto_allocate=True)
  ┌─────────────────────────┐
  │    PaymentAllocation    │ (Links payment to SalesInvoice.id)
  └─────────────────────────┘
             ↓
[SalesInvoice.paid_amount & balance_amount synchronized]
             ↓
[UnifiedAccountingLedgerService.post_payment_transaction_to_gl()]
             ↓
  ┌─────────────────────────┐
  │     JournalVoucher      │ (Voucher Type: PAYMENT_RECEIPT)
  └─────────────────────────┘
             ↓
  ┌─────────────────────────┐
  │   GeneralLedgerEntry    │ (DR 1010/1020, CR 1030)
  └─────────────────────────┘
```

### Architectural Component Audit:
1. **Creation of Payment Transactions:** Handled exclusively in `backend/app/services/payments_engine.py` inside `PaymentsEngine.process_payment()`. Each tender line in `ProcessPaymentRequest.tenders` creates a discrete `PaymentTransaction` row with a unique `idempotency_key` and system-generated `transaction_no`.
2. **Creation of Allocations:** Handled in two places:
   - Inline during `process_payment()` when `auto_allocate=True` (lines 201–239 of `payments_engine.py`).
   - On-demand via `PaymentsEngine.allocate_payment()` (lines 400–498 of `payments_engine.py`).
3. **Representation of Unallocated Balance:** Unallocated balance is not stored as a separate denormalized database column; it is calculated dynamically as:
   $$\text{Unallocated Balance} = \text{PaymentTransaction.amount} - \sum_{\text{active allocations}} \text{PaymentAllocation.allocated\_amount}$$
4. **Can a Payment Exist Without Allocation?** **YES.** In `ProcessPaymentRequest`, `auto_allocate` is a configurable boolean flag (default `True`). Setting `auto_allocate=False` creates the `PaymentTransaction` and GL voucher while skipping allocation generation completely.
5. **Can Payment Amount Exceed Allocation?** **YES.** When a customer overpays or deposits an advance, `already_allocated + alloc_req_amt \le tx_amt` is enforced in `allocate_payment()` (line 429). The residual remains as an unallocated liability balance.
6. **Can Multiple Invoices Consume One Payment?** **YES.** The relationship between `PaymentTransaction` and `PaymentAllocation` is $1:N$ (`PaymentTransaction.allocations`). Multiple `PaymentAllocation` rows can point to the same `payment_id` with different `invoice_id` values.
7. **Can One Invoice Consume Multiple Payments?** **YES.** An invoice balance can be extinguished by multiple allocations originating from different `PaymentTransaction` records.
8. **Tenant/Company Isolation:** Enforced via `company_id` on all entities. `allocate_payment()` explicitly rejects cross-company allocation (`inv.company_id != company_id`).

---

## 4. Existing Schema Audit

### 1. `payment_transactions` (`backend/app/models/payment_ledger.py`)
```sql
CREATE TABLE payment_transactions (
    id VARCHAR(50) PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL,
    company_id VARCHAR(50) NOT NULL,
    branch_id VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by VARCHAR(100),
    version INTEGER DEFAULT 1,
    transaction_no VARCHAR(100) NOT NULL UNIQUE,
    reference_doc_type VARCHAR(50) NOT NULL,
    reference_doc_id VARCHAR(50) NOT NULL,
    party_id VARCHAR(50),
    tender_type VARCHAR(30) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
    gateway_reference VARCHAR(100),
    captured_at TIMESTAMPTZ
);
```

### 2. `payment_allocations` (`backend/app/models/payment_ledger.py`)
```sql
CREATE TABLE payment_allocations (
    id VARCHAR(50) PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL,
    company_id VARCHAR(50) NOT NULL,
    branch_id VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by VARCHAR(100),
    version INTEGER DEFAULT 1,
    payment_id VARCHAR(50) NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
    invoice_id VARCHAR(50) NOT NULL,
    allocated_amount NUMERIC(15, 2) NOT NULL,
    discount_allowed NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    settled_at TIMESTAMPTZ
);
```

### Schema Sufficiency Determination:
The existing tables contain **all required columns** to model customer advances:
- For Advance: `reference_doc_type = 'CUSTOMER_ADVANCE'`, `reference_doc_id = customer_id` (or receipt code), `party_id = customer_id`.
- For Knock-Off: `PaymentAllocation` records the exact amount deducted from the advance and credited to the invoice.
- **Verdict: NO SCHEMA CHANGES OR NEW TABLES REQUIRED.**

---

## 5. Existing GL Architecture Audit

Audited source: `backend/app/services/unified_ledger.py`.

### Current `post_payment_transaction_to_gl()` (lines 1362–1468):
```python
@classmethod
async def post_payment_transaction_to_gl(
    cls,
    session: AsyncSession,
    company_id: str,
    payment_id: str,
    branch_id: Optional[str] = None
) -> JournalVoucher:
    # 1. Fetch PaymentTransaction
    ...
    # 2. Check existing voucher (Idempotency)
    existing_stmt = select(JournalVoucher).where(
        JournalVoucher.company_id == company_id,
        JournalVoucher.reference_doc_id == payment_id,
        JournalVoucher.is_deleted == False
    )
    existing_voucher = (await session.execute(existing_stmt)).scalar_one_or_none()
    if existing_voucher:
        return existing_voucher
    ...
    # 3. Postings:
    if ref_type in ["PURCHASE_BILL", "SUPPLIER_PAYMENT", ...]:
        # DR 2010 (Creditors), CR 1010/1020 (Cash/Bank)
    else:
        # Customer settlement:
        # DR 1010/1020 (Cash/Bank), CR 1030 (Debtors/AR)
```

### Critical GL Findings:
1. **Hardcoded Credit to 1030:** For all non-purchase receipts, `post_payment_transaction_to_gl()` unconditionally credits `acc_debtors` (Account `1030`). If called for an advance receipt, it reduces AR instead of increasing Liability (`2050`).
2. **Missing Knock-Off Method:** There is currently no `post_payment_allocation_to_gl()` method in `UnifiedAccountingLedgerService`.
3. **Double-Count Flaw in `allocate_payment()`:** In `PaymentsEngine.allocate_payment()` (lines 478–483), the method calls `post_payment_transaction_to_gl(payment_id=tx.id)`. Because a voucher already exists for `payment_id`, the idempotency guard swallows the call, resulting in **zero GL entries** for the knock-off. If the idempotency guard were bypassed, it would credit AR and debit Cash/Bank again, duplicating the cash entry.

---

## 6. Account Configuration Audit

### Live Database Query Results (`localhost:2781/smritisys`):

```sql
SELECT account_code, account_name, account_type, company_id, is_active 
FROM accounts 
WHERE account_code IN ('1010', '1020', '1030', '2050') 
   OR LOWER(account_name) LIKE '%advance%' 
ORDER BY account_code;
```

| Account Code | Account Name | Account Type | Status in DB | Status in `DEFAULT_CHART_OF_ACCOUNTS` |
|---|---|---|---|---|
| **1010** | Cash in Hand | ASSET | Active (29 companies) | Present |
| **1020** | Bank Accounts | ASSET | Active (29 companies) | Present |
| **1030** | Accounts Receivable (Debtors) | ASSET | Active (29 companies) | Present |
| **2050** | Customer Advance Liability | LIABILITY | **MISSING** | **MISSING (GAP)** |

### Classification:
Account `2050` is a **Configuration & Seed GAP**. It does not exist in any tenant company in the live database, nor in the default template definitions in `unified_ledger.py`. Under Phase 0 rules, it is not created now. It will be added to `DEFAULT_CHART_OF_ACCOUNTS` during Phase P2.4 implementation.

---

## 7. Advance Payment Support Audit

Can a payment currently be created without invoice allocation? **YES.**

In `PaymentsEngine.process_payment()`:
- Setting `ProcessPaymentRequest.auto_allocate = False` bypasses lines 201–239.
- Setting `ProcessPaymentRequest.reference_doc_type = "CUSTOMER_ADVANCE"` and `reference_doc_id = customer_id` creates a standalone `PaymentTransaction`.
- The unallocated advance balance is naturally available for future allocations.

---

## 8. Invoice Knock-Off Support Audit

Can an existing advance be knocked off against an invoice?
Inspected: `PaymentsEngine.allocate_payment()` (lines 400–498 of `payments_engine.py`).

| Verification Item | Existing Code State | Audit Finding |
|---|---|---|
| **Invoice Row Locking** | `SalesInvoice ... with_for_update()` | Supported (line 443) |
| **Payment Row Locking** | `select(PaymentTransaction) ...` | **VULNERABLE (Missing `with_for_update`)** |
| **Tenant / Company Guard** | `inv.company_id != company_id` check | Supported (lines 447–448) |
| **Customer Identity Guard** | Does `tx.party_id == inv.customer_id`? | **MISSING (Any advance can allocate to any invoice)** |
| **Unallocated Balance Check** | `already_allocated + alloc_req_amt > tx_amt` | Supported (lines 429–433) |
| **Invoice Balance Check** | `alloc_req_amt > inv_bal` | Supported (lines 450–453) |
| **Invoice Status Sync** | If balance == 0, `status = "PAID"` | Supported (lines 454–457) |
| **GL Posting Behavior** | Calls `post_payment_transaction_to_gl` | **DEFECTIVE (No GL generated; returns existing voucher)** |

---

## 9. Multi-Invoice Allocation Audit

Scenario:
- Advance Received: ₹10,000
- Invoice A: ₹4,000
- Invoice B: ₹3,000
- Remaining Advance: ₹3,000

The current data model supports this natively:
1. `allocate_payment(payment_id, invoice_id=A, amount=4000)`:
   - Sum of allocations becomes ₹4,000. Unallocated balance = ₹6,000.
2. `allocate_payment(payment_id, invoice_id=B, amount=3000)`:
   - Sum of allocations becomes ₹7,000. Unallocated balance = ₹3,000.
Each allocation creates a distinct row in `payment_allocations`. Once `post_payment_allocation_to_gl()` is implemented, each allocation will generate a balanced Journal Voucher (`DR 2050 / CR 1030`).

---

## 10. Partial Knock-Off Audit

Scenario:
- Advance Received: ₹10,000
- Invoice A: ₹7,000

After allocation:
- Advance Unallocated: ₹3,000
- Invoice Outstanding: ₹0.00 (Status: `PAID`)
- Expected GL: $\text{DR 2050: ₹7,000} \quad / \quad \text{CR 1030: ₹7,000}$
- Cash/Bank Account (`1010`/`1020`): Untouched.

The allocation logic in lines 420–474 computes these values accurately. The only required change is routing GL creation to `post_payment_allocation_to_gl()`.

---

## 11. Tenant / Company Isolation Audit

Tenant isolation is enforced across all entities:
- `PaymentTransaction.company_id`
- `PaymentAllocation.company_id`
- `SalesInvoice.company_id`
- `Account.company_id`
- `JournalVoucher.company_id`
- `GeneralLedgerEntry.company_id`

In `PaymentsEngine.allocate_payment()`:
- Line 413: Payment query filters by `PaymentTransaction.company_id == company_id`.
- Lines 447–448: Invoice check explicitly rejects cross-company allocation:
  `if inv.company_id != company_id: raise ValueError("Cross-company allocation forbidden...")`
- GL Account lookup filters by `Account.company_id == company_id`.
Cross-company contamination is strictly prevented.

---

## 12. Concurrency & Idempotency Audit

### Idempotency:
- `PaymentTransaction`: Enforced via DB unique constraint `uq_payment_idempotency_key` on `idempotency_key`. In `process_payment()`, duplicate keys return the existing transaction without re-execution.
- `PaymentAllocation`: Currently lacks an explicit unique idempotency key column, but is guarded by `uq_payment_alloc_doc` on `(payment_id, invoice_id)`. Repeated allocation against the same invoice without specifying distinct parameters is rejected.

### Concurrency Vulnerability:
- In `PaymentsEngine.allocate_payment()`:
  - Line 411: `select(PaymentTransaction)` has **NO** `with_for_update()`.
  - Line 443: `select(SalesInvoice)` has `with_for_update()`.
  - **Risk:** If two concurrent threads execute `allocate_payment()` for the same ₹10,000 advance against two different invoices (Invoice 1 for ₹8,000 and Invoice 2 for ₹8,000), both read `already_allocated = 0`, both pass validation, and both commit allocations totaling ₹16,000.
  - **Remediation:** Must add `.with_for_update()` to the `PaymentTransaction` query in `allocate_payment()`.

---

## 13. Atomicity & Rollback Audit

Failure scenarios and required transaction boundaries:
1. **Advance Creation Failure:**
   - If GL creation fails during advance receipt, the entire database transaction rolls back.
   - Result: No orphan `PaymentTransaction` row; no partial financial state.
2. **Allocation Knock-Off Failure:**
   - If GL creation fails during `allocate_payment()`, the allocation, invoice balance reduction, and status change must all roll back atomically.
   - Result: Advance unallocated balance remains ₹10,000; invoice remains unpaid; no partial journal voucher created.

Both operations will be enclosed in an atomic `session.begin_nested()` or unified transaction block.

---

## 14. Historical Data Findings

Audit query executed against PostgreSQL `smritisys` on 2026-10-02:
```json
{
  "payment_transactions_summary": {
    "total_payments": 29,
    "total_payment_amount": 7410.0,
    "companies_with_payments": 29,
    "ref_doc_types_count": 1
  },
  "payment_ref_types_breakdown": [
    {
      "reference_doc_type": "SALES_INVOICE",
      "tender_type": "CASH",
      "count": 29,
      "total_amount": 7410.0
    }
  ],
  "allocations_summary": {
    "total_allocations": 29,
    "total_allocated_amount": 7410.0,
    "total_discount_allowed": 0.0
  },
  "unallocated_analysis": {
    "total_payments_checked": 29,
    "zero_allocation_count": 0,
    "fully_allocated_count": 29,
    "partially_allocated_count": 0,
    "over_allocated_count": 0,
    "zero_allocation_sample": [],
    "partially_allocated_sample": [],
    "over_allocated_sample": []
  }
}
```

### Forensic Analysis of Historical Data:
- Every single historical payment transaction in the database (29 of 29) is tied to a `SALES_INVOICE` and is 100% allocated.
- Total Unallocated Historical Balance: **₹0.00**.
- Zero corrupted or floating payments exist.
- Per Phase 0 rules, no historical data conversion or backfill will be performed.

---

## 15. Existing Test Coverage & Regression Baseline

### Regression Baseline Run (2026-10-02):
Executed full test suites for P2.1, P2.2, and P2.3 against live disposable PostgreSQL databases.

#### Test Execution 1: P2.3 Payment GL + P2.2 Sales Return GL
Command:
```powershell
& "F:\SMRITRretailNX\.venv\Scripts\pytest.exe" app/tests/test_p2_3_payment_gl_atomicity.py app/tests/test_p2_2_return_gl_atomicity.py -v
```
Literal Terminal Output:
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 32 items

app/tests/test_p2_3_payment_gl_atomicity.py::test_cash_payment_gl_creation PASSED [  3%]
app/tests/test_p2_3_payment_gl_atomicity.py::test_bank_payment_gl_creation PASSED [  6%]
app/tests/test_p2_3_payment_gl_atomicity.py::test_partial_invoice_payment PASSED [  9%]
app/tests/test_p2_3_payment_gl_atomicity.py::test_full_invoice_settlement PASSED [ 12%]
app/tests/test_p2_3_payment_gl_atomicity.py::test_split_multi_tender_payment PASSED [ 15%]
app/tests/test_p2_3_payment_gl_atomicity.py::test_multiple_invoice_allocation PASSED [ 18%]
app/tests/test_p2_3_payment_gl_atomicity.py::test_over_allocation_rejection PASSED [ 21%]
app/tests/test_p2_3_payment_gl_atomicity.py::test_balanced_payment_receipt_jv PASSED [ 25%]
app/tests/test_p2_3_payment_gl_atomicity.py::test_ar_credit_matches_party_id PASSED [ 28%]
app/tests/test_p2_3_payment_gl_atomicity.py::test_gl_failure_rolls_back_payment PASSED [ 31%]
app/tests/test_p2_3_payment_gl_atomicity.py::test_missing_account_fails_fast PASSED [ 34%]
app/tests/test_p2_3_payment_gl_atomicity.py::test_duplicate_payment_idempotency PASSED [ 37%]
app/tests/test_p2_3_payment_gl_atomicity.py::test_concurrent_payment_locking PASSED [ 40%]
app/tests/test_p2_3_payment_gl_atomicity.py::test_cross_company_payment_blocked PASSED [ 43%]
app/tests/test_p2_3_payment_gl_atomicity.py::test_invoice_balance_mathematical_parity PASSED [ 46%]
app/tests/test_p2_3_payment_gl_atomicity.py::test_payment_allocation_consistency PASSED [ 50%]
app/tests/test_p2_3_payment_gl_atomicity.py::test_cancel_paid_invoice_guard PASSED [ 53%]
app/tests/test_p2_2_return_gl_atomicity.py::test_normal_return_stock_and_gl PASSED [ 56%]
app/tests/test_p2_2_return_gl_atomicity.py::test_balanced_credit_note PASSED [ 59%]
app/tests/test_p2_2_return_gl_atomicity.py::test_cogs_reversal PASSED    [ 62%]
app/tests/test_p2_2_return_gl_atomicity.py::test_historical_transaction_cost_snapshot_cost PASSED [ 65%]
app/tests/test_p2_2_return_gl_atomicity.py::test_fallback_cost PASSED    [ 68%]
app/tests/test_p2_2_return_gl_atomicity.py::test_partial_return PASSED   [ 71%]
app/tests/test_p2_2_return_gl_atomicity.py::test_over_return_rejection PASSED [ 75%]
app/tests/test_p2_2_return_gl_atomicity.py::test_repeated_return_idempotency PASSED [ 78%]
app/tests/test_p2_2_return_gl_atomicity.py::test_concurrent_return_protection PASSED [ 81%]
app/tests/test_p2_2_return_gl_atomicity.py::test_gl_failure_rollback PASSED [ 84%]
app/tests/test_p2_2_return_gl_atomicity.py::test_stock_failure_rollback PASSED [ 87%]
app/tests/test_p2_2_return_gl_atomicity.py::test_missing_account_rollback PASSED [ 90%]
app/tests/test_p2_2_return_gl_atomicity.py::test_workflow_failure_rollback PASSED [ 93%]
app/tests/test_p2_2_return_gl_atomicity.py::test_tenant_isolation PASSED [ 96%]
app/tests/test_p2_2_return_gl_atomicity.py::test_cancellation_reversal_safety PASSED [100%]

================= 32 passed, 18 warnings in 87.13s (0:01:27) ==================
```

#### Test Execution 2: P2.1 Invoice GL Atomicity
Command:
```powershell
& "F:\SMRITRretailNX\.venv\Scripts\pytest.exe" app/tests/test_p2_1_invoice_gl_atomicity.py -v
```
Literal Terminal Output:
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 8 items

app/tests/test_p2_1_invoice_gl_atomicity.py::test_invoice_post_creates_balanced_revenue_and_cogs_gl PASSED [ 12%]
app/tests/test_p2_1_invoice_gl_atomicity.py::test_gl_failure_causes_complete_rollback PASSED [ 25%]
app/tests/test_p2_1_invoice_gl_atomicity.py::test_stock_failure_causes_complete_rollback PASSED [ 37%]
app/tests/test_p2_1_invoice_gl_atomicity.py::test_missing_account_causes_complete_rollback PASSED [ 50%]
app/tests/test_p2_1_invoice_gl_atomicity.py::test_cost_valuation_hierarchy_and_zero_cost PASSED [ 62%]
app/tests/test_p2_1_invoice_gl_atomicity.py::test_duplicate_post_idempotency PASSED [ 75%]
app/tests/test_p2_1_invoice_gl_atomicity.py::test_tenant_isolation_gl_lookup PASSED [ 87%]
app/tests/test_p2_1_invoice_gl_atomicity.py::test_invoice_cancellation_reverses_revenue_and_cogs PASSED [100%]

======================= 8 passed, 18 warnings in 55.89s =======================
```

**Total Regression Baseline:** 40 / 40 tests PASSED (100% green). Baseline is completely stable.

---

## 16. Required P2.4 Test Matrix

To achieve `Done` verification in Phase P2.4, the following 17 tests must be implemented in `app/tests/test_p2_4_advance_payment_gl_atomicity.py`:

| # | Test Function Name | Objective & Invariants Verified |
|---|---|---|
| 1 | `test_cash_advance_receipt_gl` | Cash advance produces `DR 1010 / CR 2050` (Customer Advance Liability). Revenue NOT touched. |
| 2 | `test_bank_advance_receipt_gl` | Bank/UPI advance produces `DR 1020 / CR 2050`. Party ID matches Customer. |
| 3 | `test_advance_unallocated_balance_math` | $\text{Unallocated} = \text{Amount} - \sum \text{Allocations}$. Matches exact decimal precision. |
| 4 | `test_full_advance_knockoff_single_invoice` | Advance ₹5,000 allocated to Invoice ₹5,000. Invoice status `PAID`. GL: `DR 2050 / CR 1030`. |
| 5 | `test_partial_advance_knockoff_single_invoice` | Advance ₹10,000 allocated to Invoice ₹7,000. Remaining Advance ₹3,000. Invoice status `PAID`. |
| 6 | `test_partial_invoice_knockoff_by_advance` | Advance ₹4,000 allocated to Invoice ₹10,000. Invoice balance ₹6,000 (status `POSTED`). |
| 7 | `test_multi_invoice_sequential_knockoff` | Advance ₹10k allocated across Inv A (₹4k) and Inv B (₹3k). Remaining Advance ₹3k. Two distinct JVs. |
| 8 | `test_over_allocation_rejected` | Attempting to allocate more than the unallocated advance balance raises `ValueError`. |
| 9 | `test_allocation_exceeding_invoice_balance_rejected` | Attempting to allocate more than the invoice outstanding balance raises `ValueError`. |
| 10 | `test_customer_party_mismatch_guard` | Advance belonging to Customer A cannot be allocated to Customer B's invoice. |
| 11 | `test_cross_company_allocation_guard` | Advance belonging to Company A cannot be allocated to Company B's invoice. |
| 12 | `test_advance_receipt_gl_failure_rollback` | Simulated GL service failure during advance receipt causes 100% rollback of `PaymentTransaction`. |
| 13 | `test_advance_knockoff_gl_failure_rollback` | Simulated GL service failure during knock-off rolls back `PaymentAllocation` and leaves invoice balance intact. |
| 14 | `test_concurrent_advance_allocation_row_locking` | Concurrent allocations on the same advance acquire `with_for_update` row lock; total allocated never exceeds advance. |
| 15 | `test_duplicate_allocation_idempotency` | Repeated allocation requests with the same parameters return the existing allocation safely. |
| 16 | `test_unused_advance_refund_gl` | Refunding an unused advance produces `DR 2050 / CR 1010/1020`. Cannot refund more than unallocated balance. |
| 17 | `test_cancel_invoice_with_advance_guard` | Cancelling an invoice that has active advance allocations is rejected with `HandlerValidationException`. |

---

## 17. Gaps & Risks

### Gaps Identified:
1. **Account 2050 Missing:** Account `2050` ("Customer Advance Liability") does not exist in `DEFAULT_CHART_OF_ACCOUNTS` and is unseeded in live company databases.
2. **Missing Knock-Off GL Engine Method:** No method currently exists in `UnifiedAccountingLedgerService` to record `DR 2050 / CR 1030` for allocations.
3. **Flawed GL Invocation in `allocate_payment()`:** `allocate_payment()` calls `post_payment_transaction_to_gl()`, which returns the receipt voucher and records zero entries for knock-off.
4. **Missing Row Lock on `PaymentTransaction` in `allocate_payment()`:** Leaves multi-invoice concurrent allocations susceptible to race conditions.
5. **Missing Customer Identity Match Check in `allocate_payment()`:** Current code does not verify that `PaymentTransaction.party_id == SalesInvoice.customer_id`.

### Risks & Mitigations:
| Risk | Severity | Mitigation |
|---|---|---|
| Double-counting Cash upon Knock-off | CRITICAL | Route knock-off GL exclusively to `post_payment_allocation_to_gl()` which only touches `2050` and `1030`. |
| Concurrent Over-allocation of Advance | HIGH | Acquire `with_for_update()` row lock on `PaymentTransaction` before computing unallocated balance. |
| Settle Invoice with Wrong Customer's Advance | MEDIUM | Enforce `tx.party_id == inv.customer_id` check in `allocate_payment()`. |

---

## 18. Reuse Opportunities

1. **`PaymentTransaction` Model:** 100% reusable. No columns or tables needed.
2. **`PaymentAllocation` Model:** 100% reusable. No columns or tables needed.
3. **`PaymentsEngine.process_payment()`:** 100% reusable. By setting `auto_allocate=False` and `reference_doc_type="CUSTOMER_ADVANCE"`, advance receipts are created cleanly.
4. **`PaymentsEngine.allocate_payment()`:** 90% reusable. Existing balance validations and invoice synchronization logic are sound; only requires adding row locking, party check, and updating GL call.
5. **`JournalVoucher` & `GeneralLedgerEntry` Models:** 100% reusable.

---

## 19. Required Changes (For Phase P2.4 Implementation)

1. **`backend/app/services/unified_ledger.py`:**
   - Add Account `2050` to `DEFAULT_CHART_OF_ACCOUNTS`:
     ```python
     {"code": "2050", "name": "Customer Advance Liability", "type": "LIABILITY", "root": "LIABILITY", "is_group": False, "parent": "2000", "party_type": "CUSTOMER"}
     ```
   - In `post_payment_transaction_to_gl()`, branch on `ref_type == "CUSTOMER_ADVANCE"`:
     - Credit Account `2050` instead of `1030`.
   - Implement `post_payment_allocation_to_gl(session, company_id, allocation_id)`:
     - Debit Account `2050` (Customer Advance Liability).
     - Credit Account `1030` (Accounts Receivable, `party_id = customer_id`).
     - Voucher Type: `JOURNAL` (or `ADVANCE_KNOCKOFF`).
2. **`backend/app/services/payments_engine.py`:**
   - In `allocate_payment()`:
     - Add `.with_for_update()` to `PaymentTransaction` query.
     - Add `if tx.party_id and inv.customer_id and tx.party_id != inv.customer_id:` validation guard.
     - Replace `post_payment_transaction_to_gl` with `await UnifiedAccountingLedgerService.post_payment_allocation_to_gl(session, company_id, alloc.id)`.

---

## 20. Explicit Non-Changes

To maintain architectural stability and prevent scope creep:
- **NO new database tables** will be created.
- **NO schema migrations** or DDL alters will be executed.
- **NO modifications** to `SalesInvoiceLifecycleHandler` core state machine transitions.
- **NO automated backfill** or conversion of historical payment transactions.
- **NO invoice settlement restructuring** or changes to P2.1, P2.2, or P2.3 baseline code.
- **NO credit note settlement or refund engine rewrites**.

---

## 21. Explicit Answers to the 15 Required Design Questions

1. **Is PaymentTransaction already sufficient to represent an advance?**  
   **YES.** `PaymentTransaction` contains `id`, `company_id`, `branch_id`, `reference_doc_type` (`CUSTOMER_ADVANCE`), `reference_doc_id` (`customer_id`), `party_id` (`customer_id`), `tender_type`, `amount`, and `idempotency_key`. It represents customer advances completely.
2. **Is PaymentAllocation already sufficient to represent advance knock-off?**  
   **YES.** `PaymentAllocation` contains `payment_id`, `invoice_id`, `allocated_amount`, `company_id`, and `settled_at`. It represents the link between advance and invoice without modification.
3. **How is unallocated balance calculated?**  
   $$\text{Unallocated Balance} = \text{PaymentTransaction.amount} - \sum_{\text{active}} \text{PaymentAllocation.allocated\_amount}$$
4. **Where should the advance GL be generated?**  
   In `UnifiedAccountingLedgerService.post_payment_transaction_to_gl()`, when `reference_doc_type == "CUSTOMER_ADVANCE"`.
5. **Where should knock-off GL be generated?**  
   In a dedicated method `UnifiedAccountingLedgerService.post_payment_allocation_to_gl(session, company_id, allocation_id)`.
6. **Should PAYMENT_RECEIPT remain the voucher type for an advance, or should an existing/new voucher type be used?**  
   For advance receipt: `PAYMENT_RECEIPT` (with `reference_doc_type = "CUSTOMER_ADVANCE"`).  
   For knock-off / allocation: `JOURNAL` (or `ADVANCE_KNOCKOFF`), as it is a non-cash balance sheet adjustment.
7. **Is account 2050 already configured?**  
   **NO.** It does not exist in `smritisys` or `DEFAULT_CHART_OF_ACCOUNTS`. It is a configuration and seed gap.
8. **Should customer advance liability be company-scoped?**  
   **YES, ABSOLUTELY.** In SMRITI, all chart of accounts are partitioned by `company_id` (`uq_accounts_company_code`).
9. **How should partial knock-off work?**  
   Advance ₹10k allocated to Invoice ₹7k creates `PaymentAllocation` for ₹7k. Remaining unallocated balance is ₹3k. Invoice balance becomes ₹0 (status `PAID`). GL: `DR 2050: ₹7k / CR 1030: ₹7k`. Cash is untouched.
10. **How should multi-invoice allocation work?**  
    One advance can have multiple `PaymentAllocation` rows pointing to different `invoice_id`s, as long as $\sum \text{allocated\_amount} \le \text{advance amount}$. Each allocation generates its own balancing GL voucher.
11. **How should cancellation/refund of an unused advance work?**  
    Via `PaymentsEngine.process_refund()` with `DR 2050 / CR 1010/1020`. Only unallocated balance ($Amount - \sum Allocations$) can be refunded.
12. **How should cancellation of an invoice with advance allocation work?**  
    Direct invoice cancellation is blocked with `HandlerValidationException("Cannot cancel invoice with active payments/allocations")`. The allocation must first be reversed/de-allocated before the invoice can be cancelled.
13. **How should historical unallocated payments be handled?**  
    Forensic query proved there are **0 unallocated historical payments** (all 29 are 100% allocated). No historical migration is needed.
14. **What exact database transaction boundary is required?**  
    Both advance creation and advance knock-off must execute their operational inserts and GL voucher creation inside a single atomic database transaction (`session.commit()` at the end, rolling back all entities on any error).
15. **What exact tests are required before P2.4 can be declared complete?**  
    The 17-test suite specified in Section 16 (`test_p2_4_advance_payment_gl_atomicity.py`), verifying GL debit/credit parity, balance arithmetic, row locks, tenant isolation, and atomic rollback.

---

## 22. Final Verdict

### Classification: **READY WITH CONDITIONS**

Phase P2.4 is cleared for implementation once the following 5 conditions are fulfilled during the implementation phase:
1. **Condition 1:** Account `2050` ("Customer Advance Liability", `LIABILITY`, `party_type="CUSTOMER"`, `parent="2000"`) must be defined in `DEFAULT_CHART_OF_ACCOUNTS` and seeded per company.
2. **Condition 2:** `UnifiedAccountingLedgerService.post_payment_allocation_to_gl()` must be implemented to post `DR 2050 / CR 1030` on invoice knock-off.
3. **Condition 3:** `UnifiedAccountingLedgerService.post_payment_transaction_to_gl()` must be updated to credit `2050` when `reference_doc_type == "CUSTOMER_ADVANCE"`.
4. **Condition 4:** `PaymentsEngine.allocate_payment()` must be updated to acquire `with_for_update()` on `PaymentTransaction` to prevent concurrency race conditions.
5. **Condition 5:** `PaymentsEngine.allocate_payment()` must enforce customer parity (`tx.party_id == inv.customer_id`).

---
