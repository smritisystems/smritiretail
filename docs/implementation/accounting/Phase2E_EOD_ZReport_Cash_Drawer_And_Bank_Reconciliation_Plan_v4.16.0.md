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

# Phase 2E: EOD Z-Report Cash Drawer Variance Rollup & Bank Reconciliation Automation Implementation Plan v4.16.0

## 1. Objective
Establish an automated, double-entry financial bridge between POS register shift closures (Z-Reports) and authoritative General Ledger vouchers, alongside automated Bank Deposit Slip translation and two-way Bank Statement matching. The objective is to eliminate untracked cash drawer discrepancies and automate bank cash deposit reconciliation.

## 2. Business Motivation
In retail multi-store operations, cash drawer discrepancies (cash shortages or overages) frequently go untracked at shift handover, resulting in financial leakage or distorted trial balances. Furthermore, cash drops and physical deposits to commercial banks (e.g. HDFC, ICICI, SBI) often require manual journal entries. Automating the generation of double-entry vouchers upon shift close and bank deposit slip submission eliminates manual accounting friction and ensures two-way bank statement clearing.

## 3. Scope
- Authoritative cash deposit translation in `UnifiedAccountingLedgerService.post_bank_deposit_to_gl` (Debit Bank Accounts 1020, Credit Cash in Hand 1010).
- Transactional outbox event dispatch extension in `UnifiedAccountingLedgerService.dispatch_outbox_event` supporting `BANK_DEPOSIT_POSTED` and `CASH_DEPOSIT_RECORDED`.
- Shift close atomic outbox event staging (`SHIFT_CLOSED` on `POS_STREAM`) in `POSService.close_shift`.
- REST API endpoint `POST /api/v1/accounting/bank-deposits` backed by Pydantic schemas (`BankDepositCreate`, `BankDepositResponse`).
- Two-way automated reconciliation between bank statement deposit lines and GL bank account debits within a ±5 day date window.
- Characterization testing across unit, service, outbox worker, and REST API layers.

## 4. Current State
- Prior to Phase 2E, `post_shift_close_to_gl` handled shift variance balancing, but `POSService.close_shift` did not stage outbox events for downstream accounting subscribers.
- Physical bank cash deposits required manual GL vouchers without automated slip deduplication or idempotency guards.
- Bank statement automated reconciliation lacked direct validation against register cash deposit slips.

## 5. Gap Analysis
1. **Outbox Decoupling Gap:** Shift closures occurred without staging outbox events on `POS_STREAM`.
2. **Bank Deposit GL Automation Gap:** No automated method existed to post bank cash deposit slips directly into the GL with idempotency protection.
3. **API Exposure Gap:** No dedicated `/accounting/bank-deposits` REST endpoint was available for cashier and accountant roles.
4. **Reconciliation Verification Gap:** Lack of end-to-end characterization tests proving two-way reconciliation between physical deposit slips, GL ledger entries, and ingested bank statements.

## 6. Architecture Impact
- **Ledger Invariant:** Total Debits strictly equal Total Credits on every bank deposit and shift close voucher.
- **Transactional Outbox:** Shift close operations emit `SHIFT_CLOSED` events into `integration_outbox_events` within the caller's database transaction.
- **Two-Way Clearing:** Bank statements automatically match `BankStatementLine.deposit_amount` to `GeneralLedgerEntry.debit_amount` for bank account `1020`.

## 7. Proposed Design
```text
POS Register Shift Close (POSService)
    ├── Atomic Z-Report Rollup & Variance Calculation
    ├── Synchronous post_shift_close_to_gl (Debit 5070 Shortage / Credit 1010 Cash, or vice-versa)
    └── OutboxService.record_event("SHIFT_CLOSED", "POS_STREAM")
           ↓
Physical Bank Deposit Slip (POST /api/v1/accounting/bank-deposits)
    └── UnifiedAccountingLedgerService.post_bank_deposit_to_gl
           ├── Debit: Bank Accounts (1020)
           └── Credit: Cash in Hand (1010)
                  ↓
Bank Statement Ingestion & Auto-Reconciliation
    └── UnifiedAccountingLedgerService.auto_reconcile_bank_statement
           └── Match: Statement Deposit Amount == GL Bank Account Debit
```

## 8. Files Created
- `backend/tests/test_eod_bank_reconciliation.py`: Characterization test suite covering 9 automated test scenarios.
- `docs/implementation/accounting/Phase2E_EOD_ZReport_Cash_Drawer_And_Bank_Reconciliation_Plan_v4.16.0.md`: This implementation plan.
- `docs/walkthrough/accounting/Phase2E_EOD_ZReport_Cash_Drawer_And_Bank_Reconciliation_v4.16.0.md`: Accompanying walkthrough document.

## 9. Files Modified
- `backend/app/services/unified_ledger.py`: Added `post_bank_deposit_to_gl` and `BANK_DEPOSIT_POSTED` outbox dispatch handler.
- `backend/app/services/pos.py`: Added `SHIFT_CLOSED` outbox event recording in `close_shift`.
- `backend/app/schemas/accounting.py`: Added `BankDepositCreate` and `BankDepositResponse` schemas.
- `backend/app/api/v1/accounting.py`: Added `POST /api/v1/accounting/bank-deposits` endpoint.
- `docs/implementation/README.md`: Master index update.
- `docs/walkthrough/README.md`: Master index update.

## 10. Dependencies
- PostgreSQL multi-tenant database cluster (`smriti001`, `smriti002`).
- SQLAlchemy 2.0 async engine and sessionmaker.
- Pydantic V2 schemas and FastAPI dependency injection.

## 11. Risks
- **Duplicate Deposit Submissions:** Risk of double-crediting cash deposits. Mitigated by idempotency keys based on `reference_doc_id` and `reference_doc_no`.
- **Date Drift in Bank Statements:** Bank clearing dates may drift from physical slip drop dates. Mitigated by ±5 day date window in matching engine.

## 12. Rollback Strategy
All database mutations occur inside explicit database transactions. If any step fails during deposit voucher creation or statement matching, the transaction is rolled back completely. Code changes can be rolled back via git revert without schema migrations.

## 13. Verification Plan
- Unit and integration tests for shift close shortage, overage, and zero variance.
- Transactional outbox event assertion verifying `SHIFT_CLOSED` on `POS_STREAM`.
- Bank deposit double-entry ledger balance equality (Debit == Credit).
- Idempotent re-submission verification for deposit vouchers.
- Two-way bank statement auto-reconciliation matching verification.
- HTTP REST API verification with `TestClient` / `AsyncClient`.

## 14. Test Plan
- Run `pytest backend/tests/test_eod_bank_reconciliation.py -v`.
- Run full regression suite `pytest backend/tests/test_accounting_outbox_integration.py backend/tests/t_unified_ledger.py backend/tests/t_outbox_stats.py backend/tests/test_canonical_sales_writer.py backend/tests/t_daemon_rollup.py backend/tests/test_eod_bank_reconciliation.py -v`.
- Run TypeScript verification `npx tsc --noEmit`.
- Run CI duplication gate `python scripts/architecture_duplication_gate.py`.

## 15. Documentation Impact
- Updated `docs/implementation/README.md`.
- Updated `docs/walkthrough/README.md`.
- Published formal walkthrough `Phase2E_EOD_ZReport_Cash_Drawer_And_Bank_Reconciliation_v4.16.0.md`.

## 16. Deployment Plan
1. Pull branch changes into development workspace.
2. Verify all 45 automated regression tests pass.
3. Validate TypeScript compilation and architecture gates.
4. Deploy to testing environment via git pull per DEV vs TEST governance rule.

## 17. Status
Completed

## 18. Related ADRs
- `docs/architecture/ADR_UNIFIED_ACCOUNTING_LEDGER.md`
- `docs/architecture/ADR_TRANSACTIONAL_OUTBOX_ARCHITECTURE.md`

## 19. Related Walkthroughs
- `docs/walkthrough/accounting/Phase2D_Unified_Accounting_Ledger_Outbox_Integration_v4.15.0.md`
- `docs/walkthrough/accounting/Phase2E_EOD_ZReport_Cash_Drawer_And_Bank_Reconciliation_v4.16.0.md`
