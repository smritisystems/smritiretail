<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 6.49.5
  * Created    : 2026-10-02
  * Modified   : 2026-10-02
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Implementation Plan: Procurement Phase 2.3 — Supplier Payment General Ledger Integration & Purchase Bill Knock-off

**Plan ID:** IP-PROC-003
**Status:** Completed
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)
**Area:** Procurement / Financial Accounting / Accounts Payable Settlements
**Target Release:** 6.49.5

---

## 1. Objective
Complete the financial settlement loop for procurement accounts payable by integrating `SupplierPaymentService` with the authoritative double-entry general ledger engine (`UnifiedAccountingLedgerService`). When a supplier payment is recorded (`POST /api/v1/supplier-payments/`), generate a balanced double-entry `JournalVoucher` (`SUPPLIER_PAYMENT`), debiting Accounts Payable (`2010`) linked to the supplier and crediting Cash in Hand (`1010`) or Bank Accounts (`1020`). Implement bill-level knock-off allocations updating `PurchaseBill.paid_amount` and transitioning fully settled bills to `PAID`. Support payment voiding/cancellation with compensating reversal vouchers (`SUPPLIER_PAYMENT_CANCEL`) and bill status restoration.

---

## 2. Business Motivation
In retail procurement, recording payments is only half of the requirement; the payment must legally settle sundry creditor liability in the general ledger and knock off specific commercial purchase bills. Currently, `SupplierPaymentService` decrements `supplier.outstanding` in isolation without generating double-entry ledger entries or updating individual purchase bill settlement balances. Integrating payments with the GL and purchase bills achieves:
1. **Financial Ledger Parity:** Cash and bank disbursements immediately credit asset accounts (`1010`/`1020`) and debit accounts payable (`2010`).
2. **Bill-Level Aging & Knock-off:** Clear visibility into which purchase bills are open, partially paid, or fully settled.
3. **Audit Trail & Reversal Safety:** Voiding a payment cleanly reverses the ledger transaction without mutating historical records and restores the knocked-off bill balances.

---

## 3. Scope
- **In Scope:**
  - `backend/app/services/unified_ledger.py`: Implement `post_supplier_payment_to_gl` and `reverse_supplier_payment_gl`.
  - `backend/app/schemas/supplier_payment.py`: Extend `SupplierPaymentCreate` to support optional single bill knock-off (`bill_id`), multi-bill allocations (`allocations`), and `auto_allocate` FIFO flag. Extend `SupplierPaymentResponse`.
  - `backend/app/services/supplier_payment.py`:
    - Wire `post_supplier_payment_to_gl` into `record_payment`.
    - Implement bill knock-off logic updating `PurchaseBill.paid_amount` and status to `PAID` when fully settled.
    - Implement `cancel_payment(payment_id, reason)` with GL reversal, outstanding re-instatement, and bill status rollback.
  - `backend/app/api/v1/supplier_payment.py`: Add `POST /supplier-payments/{payment_id}/cancel` endpoint with manager/sysadmin authorization.
  - Outbox event publishing (`SUPPLIER_PAYMENT_PROCESSED`, `SUPPLIER_PAYMENT_CANCELLED`).
  - Automated test battery `backend/app/tests/test_supplier_payment_gl_knockoff.py`.
- **Out of Scope:**
  - Debit note deductions (handled in Phase 2.4).
  - Foreign currency exchange difference on settlement (Phase 2.5).

---

## 4. Current State
- `SupplierPayment` entity records payment amount, mode (CASH, BANK_TRANSFER, CHEQUE, UPI), and date.
- `SupplierPaymentService.record_payment` decrements `supplier.outstanding` with an overpayment guard against total outstanding balance.
- No `JournalVoucher` is generated in `UnifiedAccountingLedgerService`.
- No knock-off linkage exists between `SupplierPayment` and `PurchaseBill.paid_amount`.
- No cancellation/void endpoint exists for supplier payments.

---

## 5. Gap Analysis
| Component | Existing State | Required Target State |
|:---|:---|:---|
| **GL Method: Post Payment** | None for SupplierPayment model | `UnifiedAccountingLedgerService.post_supplier_payment_to_gl` |
| **GL Method: Reverse Payment** | None | `UnifiedAccountingLedgerService.reverse_supplier_payment_gl` |
| **Bill Knock-off** | None (`PurchaseBill.paid_amount` untouched) | Updates `PurchaseBill.paid_amount` and marks status `PAID` when full |
| **Payment Modes to Ledger** | Plain text string | Mapped to `1010 Cash` (CASH) or `1020 Bank` (BANK_TRANSFER, CHEQUE, UPI) |
| **Cancellation Workflow** | No cancel method or API | `cancel_payment` service method and `POST /supplier-payments/{id}/cancel` API |
| **Automated Tests** | 0 dedicated tests | Dedicated atomicity test suite covering cash/bank GL, knock-off, and reversal |

---

## 6. Architecture Impact
- **General Ledger (`UnifiedAccountingLedgerService`):** Strict double-entry invariant (`sum(debits) == sum(credits) == payment.amount`). Uses `session.flush()` within the active transaction.
- **Transactional Consistency:** Payment creation, GL voucher posting, supplier outstanding decrement, and purchase bill knock-offs occur in a single atomic database transaction.
- **Audit Outbox:** Dispatches `GL_VOUCHER_POSTED` to `ACCOUNTING_STREAM` and `SUPPLIER_PAYMENT_PROCESSED` to `PSV_QUEUE`.

---

## 7. Proposed Design

### Double-Entry Accounting Matrix (Supplier Payment)
| Line | Account Code | Account Name | Party Type | Party ID | Debit Amount | Credit Amount | Remarks |
|:---:|:---:|:---|:---:|:---:|:---:|:---:|:---|
| 1 | `2010` | Accounts Payable (Creditors) | `SUPPLIER` | `supplier_id` | `amount` | `0.00` | Payable settlement for Supplier {name} |
| 2 | `1010` or `1020` | Cash in Hand / Bank Accounts | — | — | `0.00` | `amount` | Disbursed via {payment_mode} |

### Double-Entry Accounting Matrix (Payment Void / Cancellation)
| Line | Account Code | Account Name | Party Type | Party ID | Debit Amount | Credit Amount | Remarks |
|:---:|:---:|:---|:---:|:---:|:---:|:---|
| 1 | `1010` or `1020` | Cash in Hand / Bank Accounts | — | — | `amount` | `0.00` | Reversal of disbursement via {payment_mode} |
| 2 | `2010` | Accounts Payable (Creditors) | `SUPPLIER` | `supplier_id` | `0.00` | `amount` | Reversal of payable settlement for Supplier {name} |

---

## 8. Files Created
1. `docs/implementation/procurement/Procurement_Phase2_3_Supplier_Payment_AP_Knockoff_Plan_v1.0.md` (This document)
2. `backend/app/tests/test_supplier_payment_gl_knockoff.py` (Test battery)
3. `docs/walkthrough/procurement/Procurement_Phase2_3_Supplier_Payment_AP_Knockoff_v1.0.md` (Walkthrough)

---

## 9. Files Modified
1. `backend/app/services/unified_ledger.py`: Added `post_supplier_payment_to_gl` and `reverse_supplier_payment_gl`.
2. `backend/app/schemas/supplier_payment.py`: Added allocation schemas and extended create/response models.
3. `backend/app/services/supplier_payment.py`: Integrated GL posting, bill knock-offs, and payment cancellation.
4. `backend/app/api/v1/supplier_payment.py`: Added cancellation route.
5. `docs/implementation/README.md`: Registered plan in master index.
6. `docs/walkthrough/README.md`: Registered walkthrough in master index.

---

## 10. Dependencies
- `app.models.supplier_payment.SupplierPayment`
- `app.models.purchase.Supplier`, `PurchaseBill`
- `app.models.accounting.JournalVoucher`, `GeneralLedgerEntry`, `Account`
- `app.services.unified_ledger.UnifiedAccountingLedgerService`

---

## 11. Risks
| Risk | Severity | Mitigation |
|:---|:---:|:---|
| Over-allocation across purchase bills | Medium | Strict validation ensuring allocated amount does not exceed bill unpaid balance (`total_amount - paid_amount`). |
| Duplicate payment voucher generation | High | Idempotency guard on `(company_id, reference_doc_type="SUPPLIER_PAYMENT", reference_doc_id=payment_id)`. |
| Unbalanced transactions on failure | Critical | All operations execute on the active `AsyncSession` with rollback on exception. |

---

## 12. Rollback Strategy
If unresolvable defects occur, revert `record_payment` in `SupplierPaymentService` to its prior implementation where only `supplier.outstanding` is decremented. No schema migrations are introduced.

---

## 13. Verification Plan
1. Run `pytest backend/app/tests/test_supplier_payment_gl_knockoff.py -v`.
2. Run `pytest backend/app/tests/test_purchase_bill_gl_atomicity.py -v`.
3. Run `pytest backend/app/tests/test_cross_handler_lifecycle.py -v`.
4. Validate python syntax via `python -m py_compile`.

---

## 14. Test Plan
- **Test Case 1:** Cash supplier payment generates balanced GL voucher (`DR 2010 / CR 1010`) and decrements `supplier.outstanding`.
- **Test Case 2:** Bank/UPI payment generates balanced GL voucher (`DR 2010 / CR 1020`).
- **Test Case 3:** Direct bill knock-off (`bill_id`) increments `PurchaseBill.paid_amount` and marks status `PAID` when fully settled.
- **Test Case 4:** Multi-bill allocations distribute payment across multiple bills accurately.
- **Test Case 5:** Automatic FIFO knock-off across open posted bills when no bill ID is explicitly provided.
- **Test Case 6:** Overpayment rejection guarding against payments exceeding supplier outstanding.
- **Test Case 7:** Payment cancellation generates compensating reversal voucher (`DR 1010/1020 / CR 2010`), restores `supplier.outstanding`, and reverts bill status from `PAID` to `POSTED`.
- **Test Case 8:** Idempotent re-posting guard returning existing voucher without duplicate debit/credit.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`
- Create `docs/walkthrough/procurement/Procurement_Phase2_3_Supplier_Payment_AP_Knockoff_v1.0.md`
- Update `docs/walkthrough/README.md`

---

## 16. Deployment Plan
Standard git merge into `smritiNX`. Zero database schema migrations required (all existing tables reused).

---

## 17. Status
**Completed** — Implementation and testing fully verified (9/9 suite tests green, 16/16 regression tests green).

---

## 18. Related ADRs
- `ADR-0016`: Universal Document Lifecycle Framework
- `ADR-0018`: Authoritative Double-Entry Unified Ledger Engine

---

## 19. Related Walkthroughs
- `WT-PROC-003`: `docs/walkthrough/procurement/Procurement_Phase2_3_Supplier_Payment_AP_Knockoff_v1.0.md`
