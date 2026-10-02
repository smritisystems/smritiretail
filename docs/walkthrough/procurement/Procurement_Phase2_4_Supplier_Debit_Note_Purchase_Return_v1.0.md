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
Classification: Internal
-->

# Walkthrough: Procurement Phase 2.4 — Supplier Debit Notes & Purchase Returns General Ledger Integration

**Walkthrough ID:** WT-PROC-004  
**Implementation Plan:** [IP-PROC-004](../../implementation/procurement/Procurement_Phase2_4_Supplier_Debit_Note_Purchase_Return_Plan_v1.0.md)  
**Target Version:** 6.49.6  
**Status:** Completed  
**Evidence Level:** Level A (Direct terminal verification logs, comprehensive automated test battery, zero TypeScript errors)  

---

## 1. Purpose
Establish an authoritative, double-entry General Ledger (GL) posting and reversal engine for Supplier Debit Notes and Purchase Return claims. When defective goods, short shipments, or agreed price discounts result in a debit note issued to a vendor, the system atomically reduces accounts payable liabilities, reverses inventory assets, reverses claimed input tax credit (ITC) across CGST/SGST/IGST, handles fractional cent rounding, and maintains bi-directional audit linkage.

---

## 2. Scope
- Double-entry GL integration for supplier debit notes in `UnifiedAccountingLedgerService` (`post_debit_note_to_gl`).
- Compensating GL reversal engine for debit note voiding and cancellation (`reverse_debit_note_gl`).
- Full lifecycle coordination in `PurchaseService` (`create_debit_note`, `cancel_debit_note`).
- Addition of cancel endpoint: `POST /api/v1/purchase/debit-notes/{debit_note_id}/cancel`.
- Automated test battery in `backend/app/tests/test_debit_note_gl_atomicity.py`.
- Regression verification across `test_supplier_payment_gl_knockoff.py`, `test_purchase_bill_gl_atomicity.py`, and `test_cross_handler_lifecycle.py`.
- Version SSOT bump to `6.49.6`.

---

## 3. Files Created
1. `docs/implementation/procurement/Procurement_Phase2_4_Supplier_Debit_Note_Purchase_Return_Plan_v1.0.md`: Implementation plan covering all 19 IPGP sections.
2. `backend/app/tests/test_debit_note_gl_atomicity.py`: Automated test battery verifying debit note GL posting, interstate/intrastate tax routing, cent roundoff, and cancellation reversal.
3. `docs/walkthrough/procurement/Procurement_Phase2_4_Supplier_Debit_Note_Purchase_Return_v1.0.md`: This formal walkthrough document.

---

## 4. Files Modified
1. `backend/app/services/unified_ledger.py`: Added `post_debit_note_to_gl()` and `reverse_debit_note_gl()`.
2. `backend/app/services/purchase.py`: Linked `post_debit_note_to_gl()` in `create_debit_note()` and implemented `cancel_debit_note()`.
3. `backend/app/schemas/purchase.py`: Added `DebitNoteCancelRequest` and added `journal_voucher_id` to `DebitNoteResponse`.
4. `backend/app/api/v1/purchase.py`: Exposed `POST /api/v1/purchase/debit-notes/{debit_note_id}/cancel`.
5. `CHANGELOG.md`: Added release notes for version `6.49.6`.
6. `package.json`: Version bumped to `6.49.6`.
7. `backend/app/core/config.py`: Version bumped to `6.49.6`.
8. `src/config/version.ts`: Version bumped to `6.49.6`.
9. `docs/implementation/README.md`: Registered `IP-PROC-004` as `Completed`.
10. `docs/walkthrough/README.md`: Registered `WT-PROC-004` as `Done`.

---

## 5. Architecture Decisions
- **Canonical Double-Entry Accounting Matrix:**
  - **Issue Debit Note:**
    - `Debit: 2010 Accounts Payable / Sundry Creditors` = `total_debit_amount` (with `party_id = supplier_id`).
    - `Credit: 1040 Inventory Asset` = `claim_amount` (taxable goods value returned).
    - `Credit: 1051 Input CGST` + `1052 Input SGST` (for intrastate, 50/50 split) or `1053 Input IGST` (for interstate) = `tax_amount`.
    - `Debit / Credit: 5030 Roundoff Account` = sub-cent fractional balancing.
  - **Cancel Debit Note:**
    - `Debit: 1040 Inventory Asset` = `claim_amount`.
    - `Debit: 1051 Input CGST` + `1052 Input SGST` or `1053 Input IGST` = `tax_amount`.
    - `Debit / Credit: 5030 Roundoff Account` = fractional cent balancing.
    - `Credit: 2010 Accounts Payable / Sundry Creditors` = `total_debit_amount` (with `party_id = supplier_id`).
- **Idempotency Protection:** Both `post_debit_note_to_gl` and `reverse_debit_note_gl` query for existing vouchers matching `(reference_doc_type, reference_doc_id)` before posting, preventing duplicate journal lines.
- **Zero Schema Migrations:** Reuses existing database models (`JournalVoucher`, `GeneralLedgerEntry`, `Supplier`, `Account`) with zero database schema changes or migrations.

---

## 6. Design Rationale
- Attributing the debit line on Account `2010` to `party_id = supplier_id` ensures that subledger vendor statements, aging reports, and Vendor 360 balances are automatically derived from the authoritative General Ledger.
- Input tax credit reversals directly satisfy statutory GST compliance by reducing electronic input credit registers matching supplier credit notes.
- Symmetrical cancellation guarantees that accidental or rejected debit notes can be voided without leaving phantom ledger balances or corrupting supplier outstanding amounts.

---

## 7. Implementation Summary
- **UnifiedAccountingLedgerService**:
  - `post_debit_note_to_gl(session, company_id, debit_note_id, supplier_id, claim_amount, tax_amount, total_debit_amount, ...)`
  - `reverse_debit_note_gl(session, company_id, debit_note_id, supplier_id, claim_amount, tax_amount, total_debit_amount, ...)`
- **PurchaseService**:
  - `create_debit_note()`: Stamped `journal_voucher_id`, decremented `supplier.outstanding`, published `PURCHASE_DEBIT_NOTE_POSTED` event.
  - `cancel_debit_note()`: Created reversal voucher, restored `supplier.outstanding`, published `PURCHASE_DEBIT_NOTE_CANCELLED` event.
- **API & Schemas**:
  - Added `DebitNoteCancelRequest(supplier_id, claim_amount, tax_amount, total_debit_amount, debit_note_no, reason)`
  - Added `POST /api/v1/purchase/debit-notes/{debit_note_id}/cancel`

---

## 8. Tests Executed
Literal terminal logs from automated test executions:

### Primary Battery: `test_debit_note_gl_atomicity.py`
```
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 6 items

backend\app\tests\test_debit_note_gl_atomicity.py::test_intrastate_debit_note_gl_posting PASSED [ 16%]
backend\app\tests\test_debit_note_gl_atomicity.py::test_interstate_debit_note_gl_posting PASSED [ 33%]
backend\app\tests\test_debit_note_gl_atomicity.py::test_debit_note_roundoff_adjustment PASSED [ 50%]
backend\app\tests\test_debit_note_gl_atomicity.py::test_debit_note_gl_idempotency PASSED [ 66%]
backend\app\tests\test_debit_note_gl_atomicity.py::test_debit_note_cancellation_reversal PASSED [ 83%]
backend\app\tests\test_debit_note_gl_atomicity.py::test_debit_note_cancellation_idempotency PASSED [100%]

======================= 6 passed, 18 warnings in 44.68s =======================
```

### Regressions Battery: `test_supplier_payment_gl_knockoff.py` (Phase 2.3)
```
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 9 items

backend\app\tests\test_supplier_payment_gl_knockoff.py::test_cash_payment_generates_balanced_gl_voucher PASSED [ 11%]
backend\app\tests\test_supplier_payment_gl_knockoff.py::test_bank_payment_generates_balanced_gl_voucher PASSED [ 22%]
backend\app\tests\test_supplier_payment_gl_knockoff.py::test_direct_bill_knockoff_full_settlement PASSED [ 33%]
backend\app\tests\test_supplier_payment_gl_knockoff.py::test_direct_bill_knockoff_partial_settlement PASSED [ 44%]
backend\app\tests\test_supplier_payment_gl_knockoff.py::test_multi_bill_explicit_allocations PASSED [ 55%]
backend\app\tests\test_supplier_payment_gl_knockoff.py::test_fifo_auto_allocation_across_open_bills PASSED [ 66%]
backend\app\tests\test_supplier_payment_gl_knockoff.py::test_overpayment_rejection_guard PASSED [ 77%]
backend\app\tests\test_supplier_payment_gl_knockoff.py::test_payment_cancellation_reverses_gl_and_restores_bills PASSED [ 88%]
backend\app\tests\test_supplier_payment_gl_knockoff.py::test_idempotent_voucher_posting_and_cancellation PASSED [100%]

======================= 9 passed, 18 warnings in 47.33s =======================
```

### Regressions Battery: `test_purchase_bill_gl_atomicity.py` (Phase 2.2)
```
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 7 items

backend\app\tests\test_purchase_bill_gl_atomicity.py::test_purchase_bill_post_creates_balanced_gl_voucher PASSED [ 14%]
backend\app\tests\test_purchase_bill_gl_atomicity.py::test_purchase_bill_post_interstate_igst PASSED [ 28%]
backend\app\tests\test_purchase_bill_gl_atomicity.py::test_purchase_bill_post_roundoff_adjustment PASSED [ 42%]
backend\app\tests\test_purchase_bill_gl_atomicity.py::test_purchase_bill_post_idempotency PASSED [ 57%]
backend\app\tests\test_purchase_bill_gl_atomicity.py::test_purchase_bill_cancellation_reversal PASSED [ 71%]
backend\app\tests\test_purchase_bill_gl_atomicity.py::test_purchase_bill_cancellation_idempotency PASSED [ 85%]
backend\app\tests\test_purchase_bill_gl_atomicity.py::test_purchase_bill_cancel_unposted_bill_noop_gl PASSED [100%]

======================= 7 passed, 18 warnings in 45.70s =======================
```

### Regressions Battery: `test_cross_handler_lifecycle.py`
```
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 9 items

backend\app\tests\test_cross_handler_lifecycle.py::test_cross_handler_registry_coexistence PASSED [ 11%]
backend\app\tests\test_cross_handler_lifecycle.py::test_cross_handler_end_to_end_lifecycle_execution PASSED [ 22%]
backend\app\tests\test_cross_handler_lifecycle.py::test_grn_cancellation_preserves_historical_queryability PASSED [ 33%]
backend\app\tests\test_cross_handler_lifecycle.py::test_purchase_bill_concurrency_conflict_rejection PASSED [ 44%]
backend\app\tests\test_cross_handler_lifecycle.py::test_purchase_bill_cross_tenant_isolation PASSED [ 55%]
backend\app\tests\test_cross_handler_lifecycle.py::test_purchase_bill_duplicate_number_constraint PASSED [ 66%]
backend\app\tests\test_cross_handler_lifecycle.py::test_grn_receive_creates_stock_movement_and_updates_po PASSED [ 77%]
backend\app\tests\test_cross_handler_lifecycle.py::test_grn_cancel_reverses_stock_movement_and_po_status PASSED [ 88%]
backend\app\tests\test_cross_handler_lifecycle.py::test_purchase_bill_line_level_3way_matching PASSED [100%]

======================= 9 passed, 18 warnings in 44.60s =======================
```

### TypeScript Validation
```
npx tsc --noEmit
Exit Code: 0 (0 errors)
```

---

## 9. Verification Results
- 31/31 automated tests green across all procurement & accounting integration suites.
- 0 TypeScript compiler errors.
- Version SSOT validated across `package.json`, `backend/app/core/config.py`, `src/config/version.ts`, and `CHANGELOG.md` at `6.49.6`.

---

## 10. Known Limitations
- Current debit notes are posted at header level with taxable claim and tax totals. Line-by-line item returns against individual GRN items will be modeled in Procurement Phase 3.

---

## 11. Future Work
- Procurement Phase 2.5: Supplier Advance Payments & Purchase Order Knock-off.
- Procurement Phase 3: Item-wise Purchase Return & Replacement Engine.

---

## 12. Related ADRs
- `ADR-0016`: Universal Document Lifecycle Framework
- `ADR-0018`: Authoritative Double-Entry Unified Ledger Engine

---

## 13. Related RFCs
- `RFC-0089`: Unified Double-Entry Accounting Ledger Architecture
- `RFC-0104`: Commercial Procurement & Accounts Payable Convergence
