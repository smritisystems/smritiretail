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

  * Version    : 6.49.7
  * Created    : 2026-10-02
  * Modified   : 2026-10-02
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Implementation Plan: Procurement Phase 2.5 — Supplier Advance Payments & Purchase Order / Bill Knock-off Integration

**Plan ID:** IP-PROC-005  
**Status:** Completed  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Area:** Procurement / Financial Accounting / Accounts Payable & Prepayments  
**Target Release:** 6.49.7  

---

## 1. Objective
Establish an authoritative, double-entry General Ledger (GL) posting and settlement knock-off engine for Supplier Advance Payments. When an upfront prepayment or deposit is disbursed to a vendor prior to the receipt of goods or commercial invoices (e.g. on Purchase Order placement), the system records an advance voucher (`DR 2050 Supplier Advance Liability / CR 1010/1020 Cash/Bank`). Subsequently, upon confirmation of commercial purchase bills, the system automatically or explicitly knocks off the advance liability against the accounts payable liability (`DR 2010 Accounts Payable / CR 2050 Supplier Advance Liability`), relieving liabilities with zero cash movement.

---

## 2. Business Motivation
In retail procurement, suppliers often demand advance deposits or stage payments prior to manufacturing, dispatch, or seasonal procurement cycles (e.g. textile mills, seasonal fashion batches). Without an authoritative double-entry advance ledger:
1. Advance disbursements are either erroneously credited as standard bill settlements before bills exist, or trapped in untracked spreadsheet records.
2. Standard overpayment guards inappropriately block advance disbursements if the vendor currently has zero confirmed bills.
3. When commercial purchase bills arrive and are posted, accounts payable (`2010`) is recorded at full invoice value without automatically reflecting prior advance disbursements, creating severe balance sheet distortions and double-payment risks.

---

## 3. Scope
- Extend `SupplierPaymentCreate` and `SupplierPaymentResponse` with `payment_type` (`STANDARD` | `ADVANCE`) and `purchase_order_id`.
- Update `UnifiedAccountingLedgerService.post_supplier_payment_to_gl` to route advance disbursements to `DR 2050 / CR 1010/1020` with voucher type `SUPPLIER_ADVANCE`.
- Implement `reverse_supplier_payment_gl` for advance cancellations (`DR 1010/1020 / CR 2050`).
- Implement `UnifiedAccountingLedgerService.post_supplier_advance_knockoff_to_gl` (`DR 2010 / CR 2050`).
- Implement automatic and explicit advance knock-off against open confirmed purchase bills in `SupplierPaymentService`.
- Add `POST /api/v1/supplier-payments/advance/knockoff` endpoint.
- Verify through automated test suite `test_supplier_advance_gl_knockoff.py` and full regression suites.
- Capture headless verification screenshots via Playwright without interactive browser windows.

---

## 4. Current State
- `SupplierPaymentService` records payments against existing bills with an overpayment guard enforcing `req.amount <= supplier.outstanding`.
- `post_supplier_payment_to_gl` always debits `2010 Accounts Payable` and credits `1010/1020`.
- Supplier advances cannot be disbursed if the vendor has zero current outstanding balance.
- No general ledger mechanism exists to knock off open advances against subsequent purchase bills.

---

## 5. Gap Analysis
1. **Advance Disbursement Routing:** Need distinct routing to Account `2050` when `payment_type == "ADVANCE"`.
2. **Overpayment Exemption:** Advance payments must be permitted even when `supplier.outstanding == 0`.
3. **Advance Knock-off Ledger Invariant:** When an advance is applied against a confirmed purchase bill, the journal entry must debit `2010 Accounts Payable` and credit `2050 Supplier Advance Liability` with zero cash movement.

---

## 6. Architecture Impact
- **Disbursement Entry:**
  - `Debit: 2050 Supplier Advance Liability` = `amount` (party_id = supplier_id)
  - `Credit: 1010 Cash in Hand` or `1020 Bank Accounts` = `amount`
  - Voucher Type: `SUPPLIER_ADVANCE`
- **Knock-off Entry:**
  - `Debit: 2010 Accounts Payable / Creditors` = `knockoff_amount` (party_id = supplier_id)
  - `Credit: 2050 Supplier Advance Liability` = `knockoff_amount` (party_id = supplier_id)
  - Voucher Type: `JOURNAL` (Reference: `SUPPLIER_ADVANCE_KNOCKOFF`)
- **Cancellation Reversal:**
  - `Debit: 1010 / 1020` = `amount`
  - `Credit: 2050 Supplier Advance Liability` = `amount` (party_id = supplier_id)

---

## 7. Proposed Design
- Schema additions in `backend/app/schemas/supplier_payment.py`.
- Ledger additions in `backend/app/services/unified_ledger.py`.
- Service additions in `backend/app/services/supplier_payment.py`.
- API endpoints in `backend/app/api/v1/supplier_payment.py`.

---

## 8. Files Created
- `docs/implementation/procurement/Procurement_Phase2_5_Supplier_Advance_Payment_PO_Knockoff_Plan_v1.0.md`
- `backend/app/tests/test_supplier_advance_gl_knockoff.py`
- `docs/walkthrough/procurement/Procurement_Phase2_5_Supplier_Advance_Payment_PO_Knockoff_v1.0.md`
- `scripts/capture_advance_knockoff_headless_evidence.py`

---

## 9. Files Modified
- `backend/app/schemas/supplier_payment.py`
- `backend/app/services/unified_ledger.py`
- `backend/app/services/supplier_payment.py`
- `backend/app/api/v1/supplier_payment.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`
- `package.json`
- `backend/app/core/config.py`
- `src/config/version.ts`

---

## 10. Dependencies
- FastAPI Core backend
- PostgreSQL with existing `journal_vouchers`, `general_ledger_entries`, `supplier_payments`, `purchase_bills`
- Playwright for headless screenshot captures

---

## 11. Risks
- Double knock-off risk: mitigated by tracking allocated amounts in payment notes manifest and validating remaining balance under transactional isolation.
- Over-allocation risk: knock-off amount is clamped to `min(unallocated_advance, unpaid_bill_amount)`.

---

## 12. Rollback Strategy
Revert commits `feat(procurement): Phase 2.5 ...`. Zero database schema changes are introduced.

---

## 13. Verification Plan
1. Run `pytest backend/app/tests/test_supplier_advance_gl_knockoff.py -v`.
2. Run `pytest backend/app/tests/test_debit_note_gl_atomicity.py -v`.
3. Run `pytest backend/app/tests/test_supplier_payment_gl_knockoff.py -v`.
4. Run `pytest backend/app/tests/test_purchase_bill_gl_atomicity.py -v`.
5. Run `pytest backend/app/tests/test_cross_handler_lifecycle.py -v`.
6. Run `npx tsc --noEmit`.
7. Execute `scripts/capture_advance_knockoff_headless_evidence.py` to capture headless verification screenshots.

---

## 14. Test Plan
- **Test Case 1:** Cash advance disbursement creates balanced GL voucher (`DR 2050 / CR 1010`).
- **Test Case 2:** Bank advance disbursement creates balanced GL voucher (`DR 2050 / CR 1020`).
- **Test Case 3:** Advance disbursement permitted when `supplier.outstanding == 0`.
- **Test Case 4:** Automatic knock-off against open confirmed purchase bills (`DR 2010 / CR 2050`).
- **Test Case 5:** Explicit knock-off endpoint against confirmed purchase bill (`DR 2010 / CR 2050`).
- **Test Case 6:** Partial knock-off leaving open advance balance.
- **Test Case 7:** Advance payment cancellation reversal (`DR 1010/1020 / CR 2050`).
- **Test Case 8:** Idempotency protection on advance GL and knock-off GL postings.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`
- Create `docs/walkthrough/procurement/Procurement_Phase2_5_Supplier_Advance_Payment_PO_Knockoff_v1.0.md`
- Update `docs/walkthrough/README.md`
- Update `CHANGELOG.md`

---

## 16. Deployment Plan
Standard git merge into `smritiNX`. Zero schema migrations required.

---

## 17. Status
**Completed** — Fully implemented and verified with 8/8 automated tests passing green, 39/39 regression tests passing green, and headless Playwright visual evidence captured.

---

## 18. Related ADRs
- `ADR-0016`: Universal Document Lifecycle Framework
- `ADR-0018`: Authoritative Double-Entry Unified Ledger Engine

---

## 19. Related Walkthroughs
- `WT-PROC-005`: `docs/walkthrough/procurement/Procurement_Phase2_5_Supplier_Advance_Payment_PO_Knockoff_v1.0.md`
