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

# Walkthrough: SMRITI Sales Phase P2.3 — Synchronous Payment Receipt GL & Atomicity

**Document Identifier:** `WGP-SALES-P2.3-v1.0`  
**Phase:** Sales P2.3 — Payment General Ledger Integration  
**Business Decision Enforced:** BD-03 (Synchronous Payment Receipt GL)  
**Status:** Completed & Verified  

---

## 1. Purpose
The purpose of Phase P2.3 is to establish an inviolable, synchronous, and fail-fast accounting link between customer payment events and the general ledger. Prior to P2.3, customer payments recorded via `PaymentTransaction` and `PaymentAllocation` failed to emit financial journal vouchers, leaving a 100% GL deficit on customer receivables settlement. Phase P2.3 closes this audit gap by guaranteeing:
$$\text{PaymentTransaction} \iff \text{PaymentAllocation} \iff \text{JournalVoucher}(\text{PAYMENT\_RECEIPT})$$

---

## 2. Scope
1. **Synchronous GL Voucher Generation:**
   - On payment settlement, automatically post a balanced `JournalVoucher(voucher_type="PAYMENT_RECEIPT")`.
   - Debit: Cash in Hand (`1010`) or Bank Accounts (`1020`) depending on tender type.
   - Credit: Accounts Receivable (`1030`) linked to the customer party ID.
2. **Lifecycle Transition Integration:**
   - Equip `SalesInvoiceLifecycleHandler` with authoritative `PAY` action transition.
   - Enforce balance checks: $0 < \text{payment\_amount} \le \text{invoice.balance\_amount}$.
   - Mutate invoice status (`PAID` when balance reaches zero, otherwise remain `POSTED`).
   - Block `CANCEL` transitions on `PAID` or partially settled invoices (`INVOICE_PAID_CANNOT_CANCEL`).
3. **PaymentsEngine Hardening:**
   - Synchronize `SalesInvoice.paid_amount` and `balance_amount` during auto-allocation.
   - Pessimistic locking (`with_for_update`) during manual `allocate_payment`.
   - Cross-company tenant isolation guards blocking unauthorized multi-tenant allocation.
4. **Zero-Mock Verification Suite:**
   - 17 comprehensive integration tests covering single-tender, multi-tender split, partial payments, idempotency, concurrent locking, failure rollbacks, and cancellation guards.

---

## 3. Files Created
1. `backend/app/tests/test_p2_3_payment_gl_atomicity.py` — 17-test zero-mock atomicity and ledger verification suite.
2. `docs/architecture/SMRITI_SALES_P2_3_PAYMENT_GL_FORENSIC_AUDIT.md` — Phase 0 Read-Only forensic baseline audit document.
3. `docs/implementation/sales/Sales_P2_3_Payment_GL_Atomicity_Implementation_Plan_v1.0.md` — 19-section formal implementation plan.
4. `docs/walkthrough/sales/Sales_P2_3_Payment_GL_Atomicity_Walkthrough_v1.0.md` — This walkthrough document.

---

## 4. Files Modified
1. `backend/app/services/unified_ledger.py`:
   - Updated `post_payment_transaction_to_gl` to enforce `reference_doc_type = voucher_type` (`"PAYMENT_RECEIPT"` for customer payments).
   - Resolved customer fallback party ID from `SalesInvoice.customer_id` when payment transaction party is null.
   - Guaranteed balanced debit = credit JournalVoucher creation.
2. `backend/app/services/lifecycle/handlers/sales_invoice.py`:
   - Added validation for `action="PAY"` against invoice outstanding balance.
   - Added cancellation guard `INVOICE_PAID_CANNOT_CANCEL` for paid or partially paid invoices.
   - Implemented `apply_transition(action="PAY")` connecting `PaymentsEngine.process_payment` and updating invoice balance fields.
   - Initialized `balance_amount = grand_total` and `paid_amount = Decimal("0.00")` on invoice `POST`.
3. `backend/app/services/payments_engine.py`:
   - Synchronized `SalesInvoice.paid_amount` and `balance_amount` in `process_payment(auto_allocate=True)`.
   - Added row locking and company boundary verification in `allocate_payment`.
   - Triggered synchronous fail-fast GL voucher posting on created transactions before commit.

---

## 5. Architecture Decisions
- **AD-SALES-P2.3-01: Synchronous Fail-Fast GL (BD-03):** Asynchronous background workers or event queues are strictly prohibited for payment GL posting. Payment recording and GL posting execute within the same transactional boundary.
- **AD-SALES-P2.3-02: Universal Ledger Service Cohesion:** Reused `UnifiedAccountingLedgerService.post_payment_transaction_to_gl` rather than creating separate POS-specific payment handlers, ensuring universal compliance across POS, B2B Dispatch, and CRM.
- **AD-SALES-P2.3-03: Row Locking on Settlement:** Applied `SELECT FOR UPDATE` on `SalesInvoice` records in `allocate_payment` to prevent concurrent race conditions from over-allocating invoice balances.

---

## 6. Design Rationale
- **Deterministic Balance Parity:** In retail accounting, `grand_total == paid_amount + balance_amount` is an absolute invariant. Any partial settlement must synchronously decrease `balance_amount` by the exact tender amount.
- **Tender-Ledger Mapping:** Cash payments debit `1010` (Cash in Hand). Electronic payments (UPI, Card, NetBanking, Cheque) debit `1020` (Bank Accounts). Accounts Receivable (`1030`) is credited with `party_id` tracking customer ledger balance.
- **Cancellation Defense:** Once payments exist against an invoice, direct cancellation would orphan the financial ledger and inventory state. The system requires reversing or refunding payment transactions before cancellation can proceed.

---

## 7. Implementation Summary
```text
Customer Payment Request
        │
        ▼
UniversalLifecycleEngine.execute_transition(action="PAY")
        │
        ├─► Validate state == POSTED, 0 < amount <= balance_amount
        │
        ▼
PaymentsEngine.process_payment(commit=False)
        │
        ├─► Insert PaymentTransaction (amount, tender_type)
        ├─► Insert PaymentAllocation (invoice_id, allocated_amount)
        ├─► Mutate SalesInvoice (paid_amount += amount, balance_amount -= amount)
        │
        ▼
UnifiedAccountingLedgerService.post_payment_transaction_to_gl()
        │
        ├─► Create JournalVoucher(PAYMENT_RECEIPT, ref_doc_id=payment_id)
        ├─► DR Account 1010 (Cash) or 1020 (Bank)
        ├─► CR Account 1030 (Accounts Receivable, party_id=customer_id)
        ├─► Assert Total Debit == Total Credit
        │
        ▼
DB Commit (Atomic & Synchronous)
```

---

## 8. Tests Executed
The test suite `backend/app/tests/test_p2_3_payment_gl_atomicity.py` executes 17 comprehensive zero-mock integration test scenarios:
1. `test_cash_payment_gl_creation` — Cash payment creates balanced JV with DR 1010 and CR 1030.
2. `test_bank_payment_gl_creation` — UPI/Card payment creates balanced JV with DR 1020 and CR 1030.
3. `test_partial_invoice_payment` — Partial payment updates balance and leaves invoice in `POSTED`.
4. `test_full_invoice_settlement` — Remainder payment transitions invoice to `PAID`.
5. `test_split_multi_tender_payment` — Multi-tender split (Cash + UPI) creates distinct transactions and balanced GL vouchers.
6. `test_multiple_invoice_allocation` — Single payment distributed across two separate invoices.
7. `test_over_allocation_rejection` — Attempting to allocate more than invoice balance is rejected.
8. `test_balanced_payment_receipt_jv` — JournalVoucher debits strictly equal credits with zero rounding error.
9. `test_ar_credit_matches_party_id` — AR credit line explicitly links to customer party ID.
10. `test_gl_failure_rolls_back_payment` — Simulated GL outage causes complete atomic transaction rollback.
11. `test_missing_account_fails_fast` — Missing chart of accounts configuration fails fast without balance corruption.
12. `test_duplicate_payment_idempotency` — Duplicate idempotency keys return identical results without duplicate GL entries.
13. `test_concurrent_payment_locking` — Row locking protects balance against concurrent payment race conditions.
14. `test_cross_company_payment_blocked` — Tenant boundary violation prevents cross-company allocation.
15. `test_invoice_balance_mathematical_parity` — Mathematical parity $grand\_total == paid + balance$ across lifecycle states.
16. `test_payment_allocation_consistency` — Total allocated amount cannot exceed transaction amount.
17. `test_cancel_paid_invoice_guard` — Direct cancellation of paid or partially paid invoice is blocked.

---

## 9. Verification Results
- All 17 integration tests run against isolated PostgreSQL test database clones.
- Exact terminal outputs captured and logged per Rule 2 of `AGENTS.md`.

---

## 10. Known Limitations
- Payment reversals / refunds are handled under Sales Return & Credit Note flows (Phase P2.2 and Phase P2.4).
- Discount allowed line item posting currently logs under allocation details; discount expense ledger integration will be extended in P2.4.

---

## 11. Future Work
- **Phase P2.4:** Customer Advance Payments & Credit Note Settlement GL integration.
- **Phase P2.5:** Multi-currency payment receipt revaluation.

---

## 12. Related ADRs
- `ADR-0082` — PostgreSQL Sole Backend System of Record.
- `ADR-0094` — Universal Document Lifecycle Engine Architecture.
- `ADR-0112` — Universal Accounting Ledger Service and Double-Entry Invariants.

---

## 13. Related RFCs
- `RFC-2026-07-001` — SMRITI Retail OS Accounting Integration Standard.
- `RFC-2026-09-004` — Universal Payments Engine and Multi-Tender Settlement.
