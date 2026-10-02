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

# Procurement Phase 2.5: Supplier Advance Payments & Automatic Purchase Bill Knock-off Walkthrough

**Walkthrough ID:** WT-PROC-005  
**Version:** 1.0.0  
**Release:** 6.49.7  
**Area:** Procurement / Financial Accounting / Accounts Payable & Prepayments  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Status:** Completed & Live Verified  

---

## 1. Purpose
Establish an authoritative double-entry General Ledger (GL) posting, prepayment tracking, and automatic knock-off engine for Supplier Advance Payments in SMRITI Retail OS. When upfront prepayments or deposits are disbursed to vendors (e.g., upon Purchase Order issuance or pre-production dispatch), the system posts `DR 2050 (Supplier Advance Liability) / CR 1010/1020 (Cash/Bank)`. Subsequently, upon confirmation of commercial purchase bills, the system automatically or explicitly knocks off the advance liability against accounts payable (`DR 2010 Accounts Payable / CR 2050 Supplier Advance Liability`) with zero cash movement, maintaining balance sheet integrity and preventing double payments.

---

## 2. Scope
1. **Advance Prepayment Disbursement Posting**:
   - `DR 2050 (Supplier Advance Liability)`: Debited with party subledger attribution (`party_id = supplier.id`).
   - `CR 1010 (Cash in Hand)` or `CR 1020 (Bank Accounts)`: Credited based on payment mode.
   - Voucher Type: `SUPPLIER_ADVANCE`, Reference Doc Type: `SUPPLIER_PAYMENT`.
2. **Overpayment Guard Bypass for Advance Disbursements**:
   - Permits prepayment disbursements when `supplier.outstanding == 0.00` or exceeds existing balance.
3. **Automatic Creation-Time Bill Knock-off**:
   - If open confirmed purchase bills exist, an advance with `auto_allocate=True` settles open bills in strict FIFO order, posting `DR 2010 / CR 2050` (`SUPPLIER_ADVANCE_KNOCKOFF`) for settled portions and maintaining unallocated advance balances.
4. **Explicit Advance Knock-off Endpoint**:
   - `POST /api/v1/supplier-payments/advance/knockoff`: Explicitly knocks off an existing unallocated advance against a newly confirmed purchase bill.
5. **Advance Payment Cancellation & Symmetrical GL Reversal**:
   - `POST /api/v1/supplier-payments/{payment_id}/cancel`: Symmetrically reverses advance disbursements (`DR 1010/1020 / CR 2050`) under `voucher_type="SUPPLIER_ADVANCE_CANCEL"`.
6. **Zero Schema Migrations**:
   - Leverages existing `supplier_payments`, `journal_vouchers`, and `general_ledger_entries` tables, encoding advance metadata and allocation manifests directly in notes.
7. **Headless Visual Evidence**:
   - Programmatic Playwright Chromium capture (`channel="chrome"`, `headless=True`) verifying the full 3-step lifecycle without opening interactive browser windows.

---

## 3. Files Created
1. `backend/app/tests/test_supplier_advance_gl_knockoff.py`: 8-test automated test battery verifying advance disbursements, automatic knock-offs, zero-outstanding bypass, explicit knock-offs, partial multi-step knock-offs, cancellation reversals, and error guards.
2. `src/components/procurement/SupplierAdvanceKnockoffVisualizer.tsx`: High-definition, interactive visualizer component displaying the 3-step lifecycle, double-entry GL vouchers, and real-time reconciliation metrics.
3. `scripts/capture_advance_knockoff_headless_evidence.py`: Programmatic headless Playwright Chromium script capturing visual verification evidence.
4. `docs/implementation/procurement/Procurement_Phase2_5_Supplier_Advance_Payment_PO_Knockoff_Plan_v1.0.md`: Full 19-section implementation plan (`IP-PROC-005`).
5. `docs/walkthrough/procurement/evidence/supplier_advance_disbursement_and_knockoff.png`: Full lifecycle headless visual evidence screenshot.
6. `docs/walkthrough/procurement/evidence/supplier_advance_disbursement_focus.png`: Advance disbursement focus screenshot.
7. `docs/walkthrough/procurement/evidence/supplier_advance_knockoff_focus.png`: Automatic knock-off focus screenshot.

---

## 4. Files Modified
1. `backend/app/schemas/supplier_payment.py`: Added `payment_type` ("STANDARD" | "ADVANCE"), `purchase_order_id`, and `unallocated_amount` to request and response schemas; defined `SupplierAdvanceKnockoffRequest` and `SupplierAdvanceKnockoffResponse`.
2. `backend/app/services/unified_ledger.py`: Implemented advance disbursement voucher branch (`DR 2050 / CR 1010/1020`), symmetrical cancellation reversal (`DR 1010/1020 / CR 2050`), and `post_supplier_advance_knockoff_to_gl()` (`DR 2010 / CR 2050`).
3. `backend/app/services/supplier_payment.py`: Bypassed overpayment guard for advance payments, added automatic creation-time knock-off posting, implemented `knockoff_advance()`, enriched `cancel_payment`, `get_payment`, and `list_payments`.
4. `backend/app/api/v1/supplier_payment.py`: Added `POST /api/v1/supplier-payments/advance/knockoff` endpoint.
5. `src/App.tsx`: Mounted `SupplierAdvanceKnockoffVisualizer` under `standalone_supplier_advance=1` for headless verification.
6. `package.json`, `backend/app/core/config.py`, `src/config/version.ts`, `CHANGELOG.md`: Synchronized version SSOT to `6.49.7`.
7. `docs/implementation/README.md`: Registered and marked `IP-PROC-005` as Completed.
8. `docs/walkthrough/README.md`: Registered `WT-PROC-005`.

---

## 5. Architecture Decisions
- **Reusing Account 2050 (Supplier Advance Liability)**:
  - Account `2050` is a first-class Liability account in `DEFAULT_CHART_OF_ACCOUNTS`.
  - Disbursing an advance debits `2050` (creating a debit balance representing a vendor asset / prepayment claim) and credits `1010/1020` (cash/bank).
  - Knocking off debits `2010 (Accounts Payable)` and credits `2050 (Supplier Advance Liability)`, settling payable liabilities with zero net cash impact.
- **Zero Schema Migrations**:
  - Encoded structured advance tags (`__PAYMENT_TYPE__:ADVANCE`, `__PO_ID__:{po_id}`) and JSON allocation manifests directly in `notes` to prevent brittle migrations while dynamically parsing properties in service layers.
- **Strict Outbox Integration**:
  - Dispatches `SUPPLIER_PAYMENT_PROCESSED` and `SUPPLIER_ADVANCE_KNOCKED_OFF` events to `PSV_QUEUE` atomically within the database transaction.

---

## 6. Design Rationale
- Prepayments cannot be tied to a specific invoice at disbursement time because goods have not arrived and invoices do not yet exist.
- Separating advance disbursements (`DR 2050`) from accounts payable (`2010`) ensures accounts payable accurately reflects only confirmed, undisputed commercial liabilities.
- When confirmed bills arrive, the knock-off journal voucher (`DR 2010 / CR 2050`) offsets liabilities without creating duplicate bank statements or cash movements.

---

## 7. Implementation Summary

### 7.1 Visual Evidence (Headless Playwright Chromium)

![Supplier Advance Disbursement and Automatic Knock-off](file:///F:/SMRITRretailNX/docs/walkthrough/procurement/evidence/supplier_advance_disbursement_and_knockoff.png)

### 7.2 Double-Entry Accounting Matrix

| Event | Voucher Type | Debit Account | Credit Account | Cash Impact | Subledger Impact |
|---|---|---|---|---|---|
| **Advance Disbursement** | `SUPPLIER_ADVANCE` | `2050 Supplier Advance Liability` | `1010 Cash` or `1020 Bank` | Decrements Cash/Bank | Creates prepayment balance on `party_id` |
| **Confirmed Bill Arrival** | `PURCHASE_BILL` | `1040 Inventory Asset` + `1051/1052 Tax` | `2010 Accounts Payable` | None | Increments `supplier.outstanding` |
| **Automatic Knock-off** | `JOURNAL` (`SUPPLIER_ADVANCE_KNOCKOFF`) | `2010 Accounts Payable` | `2050 Supplier Advance Liability` | **₹0.00 (Zero)** | Decrements `supplier.outstanding`, bill transitions to `PAID` |
| **Advance Cancellation** | `SUPPLIER_ADVANCE_CANCEL` | `1010 Cash` or `1020 Bank` | `2050 Supplier Advance Liability` | Restores Cash/Bank | Relieves prepayment balance |

---

## 8. Tests Executed

### 8.1 Automated Test Suite (`test_supplier_advance_gl_knockoff.py`)
Executed command:
```bash
& "f:\SMRITRretailNX\.venv\Scripts\python.exe" -m pytest backend/app/tests/test_supplier_advance_gl_knockoff.py -v
```

Terminal Output:
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 8 items

backend\app\tests\test_supplier_advance_gl_knockoff.py::test_cash_advance_disbursement_generates_gl_voucher PASSED [ 12%]
backend\app\tests\test_supplier_advance_gl_knockoff.py::test_bank_advance_disbursement_generates_gl_voucher PASSED [ 25%]
backend\app\tests\test_supplier_advance_gl_knockoff.py::test_advance_disbursement_permitted_when_outstanding_zero PASSED [ 37%]
backend\app\tests\test_supplier_advance_gl_knockoff.py::test_creation_time_automatic_knockoff_against_open_bills PASSED [ 50%]
backend\app\tests\test_supplier_advance_gl_knockoff.py::test_explicit_knockoff_endpoint_against_confirmed_bill PASSED [ 62%]
backend\app\tests\test_supplier_advance_gl_knockoff.py::test_partial_knockoff_leaving_open_advance_balance PASSED [ 75%]
backend\app\tests\test_supplier_advance_gl_knockoff.py::test_advance_payment_cancellation_reversal PASSED [ 87%]
backend\app\tests\test_supplier_advance_gl_knockoff.py::test_idempotency_and_cancelled_knockoff_protection PASSED [100%]

======================= 8 passed, 18 warnings in 50.59s =======================
```

### 8.2 Standard Payment Regression Battery (`test_supplier_payment_gl_knockoff.py`)
Executed command:
```bash
& "f:\SMRITRretailNX\.venv\Scripts\python.exe" -m pytest backend/app/tests/test_supplier_payment_gl_knockoff.py -v
```

Terminal Output:
```text
======================= 9 passed, 18 warnings in 50.07s =======================
```

### 8.3 Debit Note & Purchase Bill GL Regression Battery
Executed command:
```bash
& "f:\SMRITRretailNX\.venv\Scripts\python.exe" -m pytest backend/app/tests/test_debit_note_gl_atomicity.py backend/app/tests/test_purchase_bill_gl_atomicity.py -v
```

Terminal Output:
```text
====================== 13 passed, 18 warnings in 50.12s =======================
```

### 8.4 TypeScript Compilation Check
Executed command:
```bash
npx tsc --noEmit
```
Terminal Output:
```text
(exited with code 0 - zero TypeScript errors)
```

---

## 9. Verification Results
- **Evidence Level:** Level A (Directly Observable Execution & Visual Proof)
- **Status:** **Done**
- **Quantitative Metrics:**
  - 8/8 supplier advance automated tests passed green.
  - 9/9 standard supplier payment regression tests passed green.
  - 13/13 debit note and purchase bill GL regression tests passed green.
  - 0 console / TypeScript compiler errors.
  - 3 high-definition headless screenshots captured and verified.
- **Named Architectural Mechanisms:**
  - `DR 2050 / CR 1010/1020` Prepayment Disbursement Journaling.
  - `DR 2010 / CR 2050` Automatic FIFO & Explicit Purchase Bill Knock-off.
  - `DR 1010/1020 / CR 2050` Symmetrical Cancellation Compensating Reversals.
  - Transactional Outbox Event Dispatch to `PSV_QUEUE`.
  - Non-destructive metadata encoding preserving schema immutability.

---

## 10. Known Limitations
- Multi-currency advance disbursements and currency fluctuation revaluation accounts (e.g. IAS 21) are reserved for international procurement phases.
- Advance interest accrual on long-term supplier deposits is handled under corporate treasury modules.

---

## 11. Future Work
- Integration with mobile PO approval workflow allowing instant advance disbursement triggering upon PO authorization.
- Automated aging reports specifically segmenting unallocated supplier prepayments by days outstanding.

---

## 12. Related ADRs
- `ADR-0016`: Universal Document Lifecycle Framework
- `ADR-0018`: Authoritative Double-Entry Unified Ledger Engine

---

## 13. Related RFCs
- `RFC-PROC-002`: Automated Supplier Accounts Payable Knock-off and Prepayment Accounting
