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

  * Version    : 6.49.6
  * Created    : 2026-10-02
  * Modified   : 2026-10-02
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Implementation Plan: Procurement Phase 2.4 — Supplier Debit Notes & Purchase Returns General Ledger Integration

**Plan ID:** IP-PROC-004  
**Status:** Completed  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Area:** Procurement / Financial Accounting / Accounts Payable Reductions  
**Target Release:** 6.49.6  

---

## 1. Objective
Establish authoritative double-entry general ledger posting and reversal for supplier debit notes and purchase returns (`PurchaseService.create_debit_note()`). When a debit note is issued to a vendor (`POST /api/v1/purchase/debit-notes/`), post a balanced double-entry `JournalVoucher` (`DEBIT_NOTE`), debiting Accounts Payable (`2010`) linked to the supplier (`party_id=supplier_id`), crediting Inventory Asset (`1040`) for the taxable claim amount, crediting Input GST reversal accounts (`1051 Input CGST` + `1052 Input SGST` for intrastate, or `1053 Input IGST` for interstate), and balancing fractional cent rounding into `5030 Roundoff Account`. Support debit note cancellation/voiding with compensating reversal vouchers (`DEBIT_NOTE_CANCEL`).

---

## 2. Business Motivation
In retail procurement, goods returned to suppliers (damaged stock, quality variance, short shipments) require formal Debit Notes that legally reduce accounts payable liability:
1. **Accounts Payable Ledger Parity:** Debit notes must debit Account `2010` (Sundry Creditors) in the GL so the trial balance matches the operational supplier outstanding balance.
2. **Input Tax Credit (ITC) Reversal:** Under GST law, returning purchase goods mandates reversal of previously claimed Input CGST/SGST/IGST. Posting distinct credits to tax accounts ensures tax audit compliance.
3. **Audit Immutability & Reversibility:** Any cancelled or disputed debit note must generate an exact compensating reversal voucher without modifying historical records.

---

## 3. Scope
- **In Scope:**
  - `backend/app/services/unified_ledger.py`: Implement `post_debit_note_to_gl()` and `reverse_debit_note_gl()`.
  - `backend/app/services/purchase.py`: Wire `post_debit_note_to_gl()` inside `create_debit_note()` within the active transaction; add `cancel_debit_note()`.
  - `backend/app/api/v1/purchase.py`: Add `POST /purchase/debit-notes/{debit_note_id}/cancel` endpoint.
  - Double-entry GL posting: Intrastate vs. Interstate tax routing.
  - Automated test battery `backend/app/tests/test_debit_note_gl_atomicity.py`.
- **Out of Scope:**
  - Automatic debit note deduction against specific supplier payment checkout (can be selected manually).
  - Supplier credit note matching (supplier portal Phase 3).

---

## 4. Current State
- `PurchaseService.create_debit_note()` decrements `supplier.outstanding` and dispatches an outbox event `PURCHASE_DEBIT_NOTE_ISSUED`.
- No `JournalVoucher` is generated in `UnifiedAccountingLedgerService`.
- No cancellation or reversal mechanism exists for debit notes.
- Input GST reversal is not posted to GL accounts `1051`, `1052`, or `1053`.

---

## 5. Gap Analysis
| Component | Existing State | Required Target State |
|:---|:---|:---|
| **GL Method: Post Debit Note** | None | `UnifiedAccountingLedgerService.post_debit_note_to_gl` |
| **GL Method: Reverse Debit Note** | None | `UnifiedAccountingLedgerService.reverse_debit_note_gl` |
| **Double-Entry Tax Split** | Unrecorded in GL | Credits `1040` (claim) + `1051/1052` (CGST/SGST) or `1053` (IGST) |
| **Party Attribution** | None | Debits `2010` with `party_id=supplier.id` |
| **Cancellation Route** | None | `POST /api/v1/purchase/debit-notes/{id}/cancel` |
| **Automated Tests** | 0 dedicated tests | Dedicated atomicity test suite covering intrastate/interstate GL and reversal |

---

## 6. Architecture Impact
- **General Ledger (`UnifiedAccountingLedgerService`):** Strict double-entry invariant (`sum(debits) == sum(credits) == total_debit_amount`).
- **Transactional Consistency:** Debit note issuance, supplier outstanding decrement, and GL voucher posting occur in a single atomic database transaction.
- **Audit Outbox:** Dispatches `GL_VOUCHER_POSTED` to `ACCOUNTING_STREAM`.

---

## 7. Proposed Design

### Double-Entry Accounting Matrix (Debit Note Issuance)
| Line | Account Code | Account Name | Party Type | Party ID | Debit Amount | Credit Amount | Remarks |
|:---:|:---:|:---|:---:|:---:|:---:|:---:|:---|
| 1 | `2010` | Accounts Payable (Creditors) | `SUPPLIER` | `supplier_id` | `total_debit_amount` | `0.00` | Payable reduction for Supplier {name} |
| 2 | `1040` | Inventory Asset | — | — | `0.00` | `claim_amount` | Inventory reduction on debit note return |
| 3 | `1051` | Input CGST | — | — | `0.00` | `cgst_amount` | Input CGST reversal (intrastate) |
| 4 | `1052` | Input SGST | — | — | `0.00` | `sgst_amount` | Input SGST reversal (intrastate) |
| 5 | `1053` | Input IGST | — | — | `0.00` | `igst_amount` | Input IGST reversal (interstate) |
| 6 | `5030` | Roundoff Account | — | — | `debit_round` | `credit_round` | Sub-cent balancing |

### Double-Entry Accounting Matrix (Debit Note Cancellation)
| Line | Account Code | Account Name | Party Type | Party ID | Debit Amount | Credit Amount | Remarks |
|:---:|:---:|:---|:---:|:---:|:---:|:---:|:---|
| 1 | `1040` | Inventory Asset | — | — | `claim_amount` | `0.00` | Reversal of inventory reduction |
| 2 | `1051` | Input CGST | — | — | `cgst_amount` | `0.00` | Reversal of Input CGST deduction |
| 3 | `1052` | Input SGST | — | — | `sgst_amount` | `0.00` | Reversal of Input SGST deduction |
| 4 | `1053` | Input IGST | — | — | `igst_amount` | `0.00` | Reversal of Input IGST deduction |
| 5 | `5030` | Roundoff Account | — | — | `debit_round` | `credit_round` | Sub-cent balancing |
| 6 | `2010` | Accounts Payable (Creditors) | `SUPPLIER` | `supplier_id` | `0.00` | `total_debit_amount` | Reversal of payable reduction |

---

## 8. Files Created
1. `docs/implementation/procurement/Procurement_Phase2_4_Supplier_Debit_Note_Purchase_Return_Plan_v1.0.md` (This document)
2. `backend/app/tests/test_debit_note_gl_atomicity.py` (Test battery)
3. `docs/walkthrough/procurement/Procurement_Phase2_4_Supplier_Debit_Note_Purchase_Return_v1.0.md` (Walkthrough)

---

## 9. Files Modified
1. `backend/app/services/unified_ledger.py`: Added `post_debit_note_to_gl()` and `reverse_debit_note_gl()`.
2. `backend/app/services/purchase.py`: Integrated GL posting in `create_debit_note()` and added `cancel_debit_note()`.
3. `backend/app/api/v1/purchase.py`: Added `POST /purchase/debit-notes/{debit_note_id}/cancel`.
4. `docs/implementation/README.md`: Registered plan in master index.
5. `docs/walkthrough/README.md`: Registered walkthrough in master index.
6. `CHANGELOG.md`: Added release notes.

---

## 10. Dependencies
- `app.models.purchase.Supplier`, `PurchaseReceipt`
- `app.models.accounting.JournalVoucher`, `GeneralLedgerEntry`, `Account`
- `app.services.unified_ledger.UnifiedAccountingLedgerService`

---

## 11. Risks
| Risk | Severity | Mitigation |
|:---|:---:|:---|
| Unbalanced tax entries | High | Strict mathematical reconciliation: `total_debit_amount == claim_amount + tax_amount + roundoff`. |
| Interstate tax classification error | Medium | Resolve company GST state vs. supplier GST state dynamically. |
| Negative supplier balance | Low | Supplier outstanding can become debit balance (advance claim) if returns exceed purchases. |

---

## 12. Rollback Strategy
Revert `create_debit_note()` in `backend/app/services/purchase.py` to previous version. No database schema migrations required.

---

## 13. Verification Plan
1. Run `pytest backend/app/tests/test_debit_note_gl_atomicity.py -v`.
2. Run `pytest backend/app/tests/test_supplier_payment_gl_knockoff.py -v`.
3. Run `pytest backend/app/tests/test_purchase_bill_gl_atomicity.py -v`.
4. Run `pytest backend/app/tests/test_cross_handler_lifecycle.py -v`.
5. Run `npx tsc --noEmit`.

---

## 14. Test Plan
- **Test Case 1:** Intrastate Debit Note produces balanced GL voucher (`DR 2010 / CR 1040, CR 1051, CR 1052`).
- **Test Case 2:** Interstate Debit Note produces balanced GL voucher (`DR 2010 / CR 1040, CR 1053`).
- **Test Case 3:** Roundoff balancing on non-integer cent totals.
- **Test Case 4:** Idempotency guard preventing duplicate voucher posting.
- **Test Case 5:** Debit Note cancellation produces symmetric compensating reversal voucher (`DR 1040, 1051, 1052 / CR 2010`).
- **Test Case 6:** Cancellation idempotency guard.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`
- Create `docs/walkthrough/procurement/Procurement_Phase2_4_Supplier_Debit_Note_Purchase_Return_v1.0.md`
- Update `docs/walkthrough/README.md`

---

## 16. Deployment Plan
Standard git merge into `smritiNX`. Zero database schema migrations required.

---

## 17. Status
**Completed** — Implemented, verified with 6/6 tests green, and zero regressions (31/31 green).

---

## 18. Related ADRs
- `ADR-0016`: Universal Document Lifecycle Framework
- `ADR-0018`: Authoritative Double-Entry Unified Ledger Engine

---

## 19. Related Walkthroughs
- `WT-PROC-004`: `docs/walkthrough/procurement/Procurement_Phase2_4_Supplier_Debit_Note_Purchase_Return_v1.0.md`
