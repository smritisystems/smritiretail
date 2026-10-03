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

# Walkthrough: SMRITI Sales Phase P2.4 — Customer Advance Payment & Invoice Knock-off

**Document Identifier:** `WGP-SALES-P2.4-v1.0`  
**Phase:** Sales P2.4 — Customer Advance Payment & Invoice Knock-off  
**Business Decision Enforced:** BD-03 / P2.4 (Customer Advance Liability & Knock-off Allocation)  
**Status:** Completed & Verified  

---

## 1. Purpose
The purpose of Phase P2.4 is to implement double-entry Customer Advance Payments and subsequent Sales Invoice Knock-off in SMRITI Retail OS without schema duplication or unverified claims.
Prior to P2.4, customer payments could only be processed as direct invoice settlements crediting Accounts Receivable (`1030`). When money was received before an invoice existed, there was no authoritative mechanism to record customer deposits as liabilities (`2050`) or to subsequently knock off invoices without triggering duplicate cash movements. Phase P2.4 establishes:
1. **Advance Receipt:** Customer funds received before invoice issuance create a dedicated double-entry liability:
   $$\text{CASH/BANK} \implies \text{DR } 1010/1020 \quad / \quad \text{CR } 2050 \text{ (Customer Advance Liability)}$$
2. **Invoice Knock-Off:** Subsequent allocation against an outstanding Sales Invoice settles the receivable against the advance liability with zero cash movement:
   $$\text{KNOCK-OFF} \implies \text{DR } 2050 \text{ (Customer Advance Liability)} \quad / \quad \text{CR } 1030 \text{ (Accounts Receivable)}$$

---

## 2. Scope
1. **Customer Advance Receipt:**
   - Process advance payments via `PaymentsEngine.process_payment(reference_doc_type="CUSTOMER_ADVANCE", auto_allocate=False)`.
   - Synchronously post double-entry GL voucher: `DR 1010/1020` / `CR 2050` with `party_id = customer_id`.
   - Revenue (`4010`) is never credited at receipt stage.
2. **Unallocated Balance Calculation:**
   - Authoritative dynamic calculation: $\text{unallocated} = \text{payment.amount} - \sum(\text{active allocations})$.
   - Enforce $0 \le \text{unallocated} \le \text{payment.amount}$. Zero competing cache columns.
3. **Advance → Sales Invoice Knock-Off:**
   - Dedicated allocation endpoint `PaymentsEngine.allocate_payment()`.
   - Post knock-off GL voucher: `DR 2050` / `CR 1030` with `party_id = customer_id`.
   - Cash/Bank (`1010`/`1020`) is never touched during knock-off.
4. **Pessimistic Concurrency & Row Locking:**
   - Two-phase lock: `PaymentTransaction SELECT ... FOR UPDATE` followed by `SalesInvoice SELECT ... FOR UPDATE`.
   - Arithmetic balance validation occurs strictly after locks are acquired.
5. **Multi-Tenant & Customer Isolation:**
   - Strict database-level checks: `payment.company_id == invoice.company_id` and `payment.party_id == invoice.customer_id`.
6. **Idempotency & Atomic Rollback:**
   - Advance receipt: Short-circuits duplicate requests matching `idempotency_key`.
   - Knock-off: Deterministic UUID5 primary key `pal_{uuid5(company_id_payment_id_idempotency_key)}`.
   - Atomic rollback: `try...except` in `PaymentsEngine` triggers `session.rollback()` on GL failure when `commit=True`.
7. **Multi-Invoice & Partial Knock-off:**
   - Single advance can settle partial invoices or span multiple invoices sequentially.
8. **Real PostgreSQL Zero-Mock Test Suite:**
   - 17 comprehensive integration tests verifying live database rows, balances, GL entries, and rollback behavior.

---

## 3. Files Created
1. `backend/app/tests/test_p2_4_advance_payment.py` — 17-test zero-mock real PostgreSQL integration test suite.
2. `docs/architecture/SMRITI_SALES_P2_4_ADVANCE_PAYMENT_FORENSIC_AUDIT.md` — Phase 0 Read-Only forensic baseline audit document.
3. `docs/architecture/SMRITI_SALES_P2_4_ADVANCE_PAYMENT_IMPLEMENTATION.md` — Complete architecture and implementation documentation.
4. `docs/implementation/sales/Sales_P2_4_Customer_Advance_Payment_And_Invoice_Knockoff_Implementation_Plan_v1.0.md` — 19-section formal implementation plan.
5. `docs/walkthrough/sales/Sales_P2_4_Customer_Advance_Payment_And_Invoice_Knockoff_Walkthrough_v1.0.md` — This walkthrough document.

---

## 4. Files Modified
1. `backend/app/schemas/payments.py`:
   - Updated `ProcessPaymentRequest.reference_doc_type` to document `CUSTOMER_ADVANCE`.
   - Added `idempotency_key: Optional[str] = None` to `PaymentAllocationRequest`.
2. `backend/app/services/unified_ledger.py`:
   - Registered account `2050` ("Customer Advance Liability", `LIABILITY`, parent `2000`, `party_type="CUSTOMER"`) in `DEFAULT_CHART_OF_ACCOUNTS`.
   - In `post_payment_transaction_to_gl()`: added `CUSTOMER_ADVANCE` branch generating `DR 1010/1020` / `CR 2050`.
   - Implemented `post_payment_allocation_to_gl()` generating `DR 2050` / `CR 1030` for `reference_doc_type = "PAYMENT_ALLOCATION"`.
3. `backend/app/services/payments_engine.py`:
   - In `allocate_payment()`: added `with_for_update()` row locking on `PaymentTransaction` and `SalesInvoice`.
   - Added status validation (`tx.status == "SUCCESS"`, `inv.status not in ("CANCELLED", "VOID")`), customer identity check (`tx.party_id == inv.customer_id`), and idempotency short-circuit via deterministic `alloc_id`.
   - Routed knock-off GL to `post_payment_allocation_to_gl()` for `CUSTOMER_ADVANCE`.
   - Wrapped operations in `try...except` to execute `await session.rollback()` on failure when `commit=True`.
4. `backend/app/services/lifecycle/handlers/sales_invoice.py`:
   - In `apply_transition()` under `act == "PAY"`, added support for `advance_payment_id` payload to invoke `PaymentsEngine.allocate_payment(commit=False)` directly.

---

## 5. Architecture Decisions
- **AD-SALES-P2.4-01: Table Non-Proliferation:** Reused canonical `PaymentTransaction` (receipt) and `PaymentAllocation` (knock-off) tables. No new tables or schema columns created.
- **AD-SALES-P2.4-02: Zero Cash Movement on Knock-off:** Knock-off GL strictly transfers liability (`2050`) to accounts receivable (`1030`). Cash/Bank accounts (`1010`/`1020`) are never touched.
- **AD-SALES-P2.4-03: Dynamic Unallocated Balance:** Unallocated balance is computed on demand from non-deleted `PaymentAllocation` rows under row locks, preventing dual-cache synchronization drift.
- **AD-SALES-P2.4-04: Deterministic Locking Hierarchy:** Two-phase lock always locks `PaymentTransaction` first, then `SalesInvoice`, eliminating deadlock hazards during concurrent multi-invoice settlements.

---

## 6. Design Rationale
- **Statutory Double-Entry Compliance:** In Indian GST and retail accounting standards, customer advances represent a current liability until matched against an invoice. Direct revenue credit on advance is statutory non-compliance.
- **Identity Isolation:** B2B credit and retail customer accounts must remain strictly segregated. Customer ID parity (`tx.party_id == inv.customer_id`) prevents rogue cross-settlement between accounts.
- **Fail-Fast Atomicity:** Wrapping mutations and GL postings in session-aware `try...except` blocks ensures that if a general ledger posting fails, the uncommitted allocation and invoice status changes are instantly discarded, preserving 100% database purity.

---

## 7. Implementation Summary
```text
Customer Advance Receipt Flow:
Customer Deposit Request
        │
        ▼
PaymentsEngine.process_payment(reference_doc_type="CUSTOMER_ADVANCE", auto_allocate=False)
        │
        ├─► Insert PaymentTransaction (amount, tender_type, status="SUCCESS")
        │
        ▼
UnifiedAccountingLedgerService.post_payment_transaction_to_gl()
        │
        ├─► Debit 1010 (Cash in Hand) or 1020 (Bank Accounts)
        └─► Credit 2050 (Customer Advance Liability) [party_id = customer_id]


Advance Knock-Off Flow:
Knock-Off Request (invoice_id, allocated_amount, idempotency_key)
        │
        ▼
PaymentsEngine.allocate_payment()
        │
        ├─► 1. SELECT PaymentTransaction FOR UPDATE
        ├─► 2. Compute unallocated_amount = payment.amount - SUM(allocations)
        ├─► 3. SELECT SalesInvoice FOR UPDATE
        ├─► 4. Validate customer_id, company_id, balance_amount, status
        ├─► 5. Insert PaymentAllocation
        ├─► 6. Update SalesInvoice.paid_amount & balance_amount
        │
        ▼
UnifiedAccountingLedgerService.post_payment_allocation_to_gl()
        │
        ├─► Debit 2050 (Customer Advance Liability)
        └─► Credit 1030 (Accounts Receivable) [party_id = customer_id]
        [ZERO Cash/Bank entries]
```

---

## 8. Tests Executed
The test suite in `backend/app/tests/test_p2_4_advance_payment.py` executes 17 real PostgreSQL integration tests:
1. `test_cash_advance_creates_payment_and_gl` — Cash advance creates `PaymentTransaction` and balanced `DR 1010 / CR 2050`.
2. `test_bank_advance_creates_gl` — Bank transfer advance creates balanced `DR 1020 / CR 2050`.
3. `test_advance_initially_unallocated` — Advance has `unallocated == amount` and `auto_allocate == False`.
4. `test_partial_advance_invoice_allocation` — Partial knock-off leaves correct remaining balance on advance and invoice.
5. `test_full_advance_invoice_allocation` — Full settlement marks invoice `PAID` with balance ₹0.00.
6. `test_multi_invoice_allocation` — Single ₹10,000 advance knocked off across Invoices A (₹3,000), B (₹4,000), C (₹3,000).
7. `test_over_allocation_of_advance_rejected` — Attempt to allocate beyond unallocated balance raises error.
8. `test_over_allocation_of_invoice_rejected` — Attempt to allocate beyond invoice balance raises error.
9. `test_customer_identity_mismatch_rejected` — Customer A advance cannot be allocated to Customer B invoice.
10. `test_cross_company_allocation_rejected` — Advance in Company A cannot allocate to invoice in Company B.
11. `test_concurrent_allocation_row_locking` — Row locking prevents concurrent over-allocation race conditions.
12. `test_duplicate_allocation_idempotency` — Retried allocation with `idempotency_key` returns existing allocation.
13. `test_receipt_gl_failure_rolls_back_advance` — Receipt GL failure rolls back `PaymentTransaction` atomically.
14. `test_knockoff_gl_failure_rolls_back_allocation` — Knock-off GL failure rolls back allocation and restores invoice balance.
15. `test_cancelled_invoice_cannot_receive_allocation` — Allocation against cancelled invoice is rejected.
16. `test_cancelled_advance_cannot_be_allocated` — Allocation from cancelled advance is rejected.
17. `test_lifecycle_pay_with_advance` — `UniversalLifecycleEngine` `action="PAY"` with `advance_payment_id` knocks off invoice.

---

## 9. Verification Results
- **P2.4 Test Suite:** 17/17 PASSED in 94.75s.
- **P2.3 Test Suite (Payment GL Atomicity):** 17/17 PASSED in 55.80s.
- **P2.2 Test Suite (Return GL Atomicity):** 15/15 PASSED in 53.10s.
- **P2.1 Test Suite (Invoice GL Atomicity):** 8/8 PASSED in 45.61s.
- **Combined Finance Core Suite:** 57/57 PASSED in 92.34s.
- **Sales Lifecycle & Authority Regression Suite:** 32/32 PASSED in 59.53s.
- **Total Combined Verified Tests:** 89 / 89 PASSED (0 failures, 0 regressions).
- **Alembic Head:** `v1515_sales_schema_tenant_hardening` (UNCHANGED).
- **Historical Data Safety:** All 29 historical payments remain intact with `reference_doc_type = 'SALES_INVOICE'`.

---

## 10. Known Limitations
- Customer advance refunds and credit note wallets are explicitly governed by Phase P2.5 and remain unbuilt.
- Currency is currently standard Indian Rupee (`INR`); multi-currency forex revaluation on advances is out of scope.

---

## 11. Future Work
- **Sales P2.5:** Customer Credit Notes, Wallet Engine, and Advance Refund Processing.
- **POS Integration:** Direct F8 Settlement modal button in POS for "Apply Customer Advance".

---

## 12. Related ADRs
- `ADR-SALES-P2.4-01`: Reusing Canonical Payment Ledger Tables for Advance Accounting.
- `ADR-SALES-P2.4-02`: Zero Cash Movement Invariant on Invoice Knock-off Settlement.
- `ADR-SALES-P2.4-03`: Pessimistic Two-Phase Row Locking Hierarchy on Allocation.

---

## 13. Related RFCs
- `RFC-SALES-FINANCE-003`: SMRITI Retail OS Double-Entry General Ledger Payment & Advance Specification.
