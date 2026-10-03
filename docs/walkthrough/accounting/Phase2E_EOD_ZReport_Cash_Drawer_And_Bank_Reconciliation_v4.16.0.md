<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.16.0
  Created      : 2026-09-09
  Modified     : 2026-09-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Phase 2E: EOD Z-Report Cash Drawer Variance Rollup & Bank Reconciliation Automation Walkthrough v4.16.0

## 1. Purpose
Document the technical implementation and empirical test verification of Phase 2E: EOD Z-Report Cash Drawer Variance Rollup & Bank Reconciliation Automation. This capability bridges closed POS register shifts with automated deposit slip postings and two-way bank statement matching in SMRITI Retail OS.

## 2. Scope
- Physical cash drawer variance balancing vouchers via `post_shift_close_to_gl`.
- Cash drawer bank deposit translation to authoritative double-entry GL vouchers via `post_bank_deposit_to_gl` (Debit Bank Accounts 1020, Credit Cash in Hand 1010).
- Outbox event dispatch extension for `BANK_DEPOSIT_POSTED` and `CASH_DEPOSIT_RECORDED` in `dispatch_outbox_event`.
- Event staging of `SHIFT_CLOSED` on channel `POS_STREAM` within `POSService.close_shift`.
- REST API endpoint `POST /api/v1/accounting/bank-deposits` backed by Pydantic schemas.
- Automated two-way matching between bank statement deposit lines and GL bank debits.
- 9-test characterization suite `backend/tests/test_eod_bank_reconciliation.py`.

## 3. Files Created
- `backend/tests/test_eod_bank_reconciliation.py`: End-to-end test suite containing 9 automated tests.
- `docs/implementation/accounting/Phase2E_EOD_ZReport_Cash_Drawer_And_Bank_Reconciliation_Plan_v4.16.0.md`: IPGP 19-section implementation plan.
- `docs/walkthrough/accounting/Phase2E_EOD_ZReport_Cash_Drawer_And_Bank_Reconciliation_v4.16.0.md`: This walkthrough document.

## 4. Files Modified
- `backend/app/services/unified_ledger.py`: Implemented `post_bank_deposit_to_gl` and case `F` in `dispatch_outbox_event`.
- `backend/app/services/pos.py`: Added transactional outbox staging for `SHIFT_CLOSED` in `close_shift`.
- `backend/app/schemas/accounting.py`: Added `BankDepositCreate` and `BankDepositResponse` Pydantic models.
- `backend/app/api/v1/accounting.py`: Implemented `POST /api/v1/accounting/bank-deposits`.
- `docs/implementation/README.md`: Updated master index table.
- `docs/walkthrough/README.md`: Updated master index table.

## 5. Architecture Decisions
- **Strict Double-Entry Invariant:** All bank deposit vouchers strictly enforce `total_debit == total_credit` in Base Currency (INR).
- **Idempotency Safeguard:** Vouchers enforce deduplication using `reference_doc_id` and `reference_doc_no` to protect against duplicate deposit submissions.
- **Asynchronous Decoupling:** `POSService.close_shift` stages `SHIFT_CLOSED` events into `integration_outbox_events` within the active transaction, avoiding blocking external HTTP dependencies.
- **Flexible Bank Account Resolution:** Supports both predefined COA account codes (`1020` Bank, `1010` Cash) and specific UUID account identifiers for multi-bank setups.

## 6. Design Rationale
Cash drawers in multi-store retail environments experience physical discrepancies that must be reconciled at the end of each day. By translating cash shortage to expense account 5070 and overage to income account 4050, the ledger maintains audit integrity. When physical cash is dropped into a commercial bank account, generating a `BANK_DEPOSIT` journal voucher directly enables the bank reconciliation engine (`auto_reconcile_bank_statement`) to match statement deposit lines against the GL debit on the bank account.

## 7. Implementation Summary
1. **GL Deposit Posting Method (`post_bank_deposit_to_gl`):**
   - Inputs: `amount`, `bank_account_code="1020"`, `cash_account_code="1010"`, `deposit_date`, `reference_no`, `reference_doc_id`, `branch_id`, `narration`.
   - Idempotency query verifies prior voucher existence before posting.
   - Posts voucher with lines:
     - Line 1: Debit Bank Account (1020) = `amount`
     - Line 2: Credit Cash in Hand (1010) = `amount`
2. **Outbox Event Dispatcher Extension:**
   - Handles `BANK_DEPOSIT_POSTED`, `CASH_DEPOSIT_RECORDED`, and `BANK_DEPOSIT` event types.
   - Extracts payload parameters and routes to `post_bank_deposit_to_gl`.
3. **Shift Close Outbox Event:**
   - In `POSService.close_shift`, `OutboxService.record_event` is called with `event_type="SHIFT_CLOSED"`, `target_channel="POS_STREAM"`, and `aggregate_type="SHIFT"`.
4. **REST API Endpoint (`POST /api/v1/accounting/bank-deposits`):**
   - Secured with role dependency `require_role(SYSADMIN, MANAGER, CASHIER)`.
   - Returns HTTP 201 with `BankDepositResponse`.

## 8. Tests Executed
```bash
pytest backend/tests/test_eod_bank_reconciliation.py -v
```
All 9 test cases executed and passed:
1. `test_shift_close_shortage_gl_posting`: Verified shortage posts Debit 5070, Credit 1010, idempotent.
2. `test_shift_close_overage_gl_posting`: Verified overage posts Debit 1010, Credit 4050.
3. `test_shift_close_zero_variance_gl_posting`: Verified zero variance returns None without redundant vouchers.
4. `test_pos_service_close_shift_stages_outbox_event`: Verified `SHIFT_CLOSED` outbox event on `POS_STREAM`.
5. `test_z_report_rollup_accuracy`: Verified Z-report rollup with linked GL voucher.
6. `test_bank_deposit_gl_posting_and_idempotency`: Verified `BANK_DEPOSIT` GL voucher (Debit 1020, Credit 1010).
7. `test_bank_statement_two_way_auto_reconciliation`: Verified two-way matching between statement line and GL entry.
8. `test_bank_deposit_outbox_worker_dispatch`: Verified asynchronous outbox dispatcher translates deposit events to GL.
9. `test_bank_deposit_rest_api`: Verified REST API endpoint returns HTTP 201 with `BankDepositResponse`.

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
backend\tests\test_eod_bank_reconciliation.py::test_shift_close_shortage_gl_posting PASSED [ 11%]
backend\tests\test_eod_bank_reconciliation.py::test_shift_close_overage_gl_posting PASSED [ 22%]
backend\tests\test_eod_bank_reconciliation.py::test_shift_close_zero_variance_gl_posting PASSED [ 33%]
backend\tests\test_eod_bank_reconciliation.py::test_pos_service_close_shift_stages_outbox_event PASSED [ 44%]
backend\tests\test_eod_bank_reconciliation.py::test_z_report_rollup_accuracy PASSED [ 55%]
backend\tests\test_eod_bank_reconciliation.py::test_bank_deposit_gl_posting_and_idempotency PASSED [ 66%]
backend\tests\test_eod_bank_reconciliation.py::test_bank_statement_two_way_auto_reconciliation PASSED [ 77%]
backend\tests\test_eod_bank_reconciliation.py::test_bank_deposit_outbox_worker_dispatch PASSED [ 88%]
backend\tests\test_eod_bank_reconciliation.py::test_bank_deposit_rest_api PASSED [100%]
======================= 9 passed, 10 warnings in 45.81s =======================

Full Regression Test Suite (45/45 passed in 96.34s):
  - test_accounting_outbox_integration.py: 5/5 PASSED
  - t_unified_ledger.py: 13/13 PASSED
  - t_outbox_stats.py: 9/9 PASSED
  - test_canonical_sales_writer.py: 5/5 PASSED
  - t_daemon_rollup.py: 4/4 PASSED
  - test_eod_bank_reconciliation.py: 9/9 PASSED

Static Verification:
  - npx tsc --noEmit: Exited with code 0 (0 errors).
  - python scripts/architecture_duplication_gate.py: PASSED (0 P0/P1 violations).
```

## 10. Known Limitations
- Cash denominations breakdown is stored as JSON metadata on the shift and does not currently alter individual journal voucher lines (variance is booked in aggregate).
- Automated bank statement matching uses amount and a ±5 day date window; complex splits (e.g. one deposit slip matching multiple partial bank credits) require manual clearing.

## 11. Future Work
- Support for automated bank feed API integrations (e.g. Open Banking / Account Aggregator framework).
- Machine learning-based fuzzy narration matching for disputed bank reconciliation lines.

## 12. Related ADRs
- `docs/architecture/ADR_UNIFIED_ACCOUNTING_LEDGER.md`
- `docs/architecture/ADR_TRANSACTIONAL_OUTBOX_ARCHITECTURE.md`

## 13. Related RFCs
- `RFC-2026-08-01: ProPOS Cash Drawer & Float Management`
- `RFC-2026-09-05: Transactional Outbox Pattern for Multi-Tenant ERP Systems`
