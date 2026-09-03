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

  * Version    : 3.30.0
  * Created    : 2026-09-03
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: B2B Credit Transaction Contract & Headless UAT Certification

## 1. Purpose
Document the complete architectural contract implementation, testing, and dedicated headless UAT certification for the B2B Corporate Credit Sales workflow in SMRITI Retail OS. This resolves the forensic root cause where `BillingTerm.tsx` credit transactions defaulted to Cash in the settlement studio and backend, enforces canonical document numbering via `DocumentsEngine`, cleanly decouples idempotency from document uniqueness, and guarantees atomic synchronous updates to customer outstanding balances.

## 2. Scope
- **Frontend Contract:** `src/components/billing/types.ts`, `src/components/billing/BillingTerm.tsx`, `src/components/billing/InvoiceSettlementD.tsx` (`InvoiceSettlementStudio`).
- **Backend Service:** `backend/app/services/sales.py` (`create_sales_invoice`).
- **Automated Tests:** `backend/tests/test_b2b_credit_sales_contract.py`.
- **Headless UAT Runner:** `scripts/run_b2b_billing_headless_uat.py`.

## 3. Files Created
- `backend/tests/test_b2b_credit_sales_contract.py`
- `CUSTOMER_B2B_CREDIT_TRANSACTION_CONTRACT_REVIEW.md`
- `docs/walkthrough/billing/Billing_B2B_Credit_Transaction_Contract_v3.30.0.md`

## 4. Files Modified
- `src/components/billing/types.ts`
- `src/components/billing/InvoiceSettlementD.tsx`
- `src/components/billing/BillingTerm.tsx`
- `backend/app/services/sales.py`
- `scripts/run_b2b_billing_headless_uat.py`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **Single Settlement Component:** Reused and adapted the existing `InvoiceSettlementD.tsx` (`InvoiceSettlementStudio`) for Credit / On Account sales instead of duplicating or creating a second settlement modal.
- **Canonical Payment Mode:** Canonical database value is strictly `"CREDIT"`. `"On Account"` is used as user interface terminology only.
- **Synchronous Atomic Outstanding Accounting:** Customer outstanding is updated synchronously inside the `SalesService.create_sales_invoice` database transaction: `new_outstanding = previous_outstanding + calculated_grand_total`.
- **Document Numbering:** Automatically delegates sequence allocation to `DocumentsEngine.allocate_next_number_in_transaction` (`DocumentSeries`) whenever client invoice numbers are empty, `"AUTO"`, or static defaults (`"D1DS13-1"`).
- **Decoupled Idempotency from Document Uniqueness:** Idempotency is keyed strictly by HTTP `Idempotency-Key` (or payload ID). Duplicate invoice numbers submitted under a different transaction raise `HTTP 409 Conflict`.

## 6. Design Rationale
Adapting the existing settlement modal provides a unified settlement experience while presenting a customized B2B Credit Facility overview (Sanctioned Limit, Outstanding, Headroom, Payment Terms, Calculated Due Date) without cluttering retail cashiers. Enforcing atomic ledger updates in the sales service ensures mathematical parity between invoices and accounts receivable without asynchronous eventual-consistency drift.

## 7. Implementation Summary
- **Phase 1 & 2 (Frontend):** Enhanced `PaymentMode` union with `"Credit" | "On Account"`. Added `transaction` prop to `SmritiInvoiceSettlementModal`. In `InvoiceSettlementD`, resolved authoritative credit policy directly from `Customer` / `CustomerGroup` without arbitrary hardcoded fallbacks (500,000 / 60 days net removed). If policy is unconfigured, displays explicit non-invented status (`Policy Not Configured`, `Unassigned Policy`). Concealed physical cash denomination counters, set default tender to On Account (`amount: 0`), and enabled immediate settlement. In `BillingTerm.tsx`, ensured `payment_mode: "CREDIT"`, `paid_amount: 0`, and `balance_amount: netAmount` are transmitted.
- **Phase 3, 4, 5, 6 (Backend):** In `backend/app/services/sales.py`, isolated the idempotency check to match only on `idempotency_key`. Handled document series allocation via `DocumentsEngine` with row-level locks. Added `HTTP 409 Conflict` on duplicate custom invoice numbers.
- **Phase 7 (Concurrency Safety & Fail-Closed Enforcement):** Enforced PostgreSQL exclusive row-level locking (`SELECT ... FOR UPDATE`) on the `Customer` record inside `SalesService.create_sales_invoice` during credit transactions and settled sales. Bound credit limit verification, credit hold checks, and customer outstanding incrementation into the same atomic locking boundary, preventing concurrent terminals from racing or double-spending credit headroom. Removed all swallowed exceptions around credit checks (`except Exception: pass`), ensuring credit control strictly fails closed.
- **Phase 8 (Authoritative API Schemas & Eager Loading):** Added `credit_limit`, `credit_days`, `unlimited_credit`, and `credit_hold` to `CustomerBase` and `Customer` model properties with setters. In `CustomerRepository`, eagerly loaded `Customer.group` on `get`, `get_all`, and `search`.
- **Phase 9 (Automated Test Suite — 11 Discrete Items):** Authored 11 distinct, independently executed test cases in `backend/tests/test_b2b_credit_sales_contract.py` covering:
  1. `test_credit_invoice_payment_mode_is_credit`
  2. `test_credit_invoice_paid_amount_is_zero`
  3. `test_credit_invoice_balance_amount_equals_grand_total`
  4. `test_credit_invoice_nonzero_opening_outstanding_delta` (₹50,000 opening balance delta verification)
  5. `test_credit_control_fails_closed_on_unexpected_crm_error` (infrastructure failure verification)
  6. `test_cash_sale_preserves_existing_behavior`
  7. `test_credit_limit_exceeded_raises_400`
  8. `test_credit_hold_raises_400`
  9. `test_idempotency_safe_retry_same_key`
  10. `test_duplicate_invoice_number_raises_409`
  11. `test_canonical_document_series_allocation`
- **Phase 10 (Headless UAT Hardening & Non-Zero Opening Balance Delta):** Enhanced `scripts/run_b2b_billing_headless_uat.py` with anti-replay detection, customer ID parity assertions, payment mode assertions, non-zero opening balance seeding (₹50,000.00), customer outstanding increment checks (asserting `delta == grand_total`), and PDF binary content assertions.

## 8. Tests Executed
1. `pytest backend/tests/test_b2b_credit_sales_contract.py -v` (11/11 PASSED in 10.02s)
2. `npm run build` (3,526 modules transformed, built in 24.71s, exit code 0)
3. `python scripts/architecture_duplication_gate.py` (10/10 checks PASSED, 0 violations)
4. `python scripts/run_b2b_billing_headless_uat.py` (9/9 steps PASSED in headless Chromium)

## 9. Verification Results
- **Headless UAT Output:** 9/9 Steps PASSED. Committed Invoice: `ID=inv-1788419623-eb4563`, `No=INV-0017`, `Mode=CREDIT`, `Paid=₹0.00`, `Balance=₹1050.00`, `GrandTotal=₹1050.00`.
- **Customer Outstanding:** `Initial=₹50,000.00` -> `New=₹51,050.00` (`Delta=+₹1,050.00` exact mathematical parity verified).
- **PDF Binary Stream:** HTTP 200, Content-Type `application/pdf`, `%PDF` magic header valid, 68,884 bytes, customer name, invoice number, and GSTIN text matches verified.
- **Direct SQL Inspection:**
  - `sales_invoices.payment_mode = 'CREDIT'`
  - `sales_invoices.paid_amount = 0.00`
  - `sales_invoices.balance_amount = 1050.00`
  - `sales_invoices.grand_total = 1050.00`
  - `customers.outstanding = 51050.00`

## 10. Known Limitations
None. B2B credit sale transactions adhere strictly to accounting symmetry, concurrency safety, and fail-closed security.

## 11. Future Work
- Integration of automated payment receipts against outstanding credit invoices via Accounts Receivable reconciliation module.

## 12. Related ADRs
- ADR-0022: Unified Documents Numbering Engine & Series Architecture
- ADR-0038: PostgreSQL Transactional System of Record & Strangler-Fig Express Decommission

## 13. Related RFCs
- RFC-0084: Universal B2B Settlement & Credit Governance
