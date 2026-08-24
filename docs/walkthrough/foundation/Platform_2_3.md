<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Platform Accounting Fiscal Period Lockouts & Bank Reconciliation Statement (BRS) Engine v6.16.0

## 1. Purpose
This document details the implementation of **Fiscal Period Governance & Backdating Lockout** and the **Authoritative Bank Reconciliation Statement (BRS) Engine** as part of Slice 9 in the SMRITI Retail OS transactional general ledger architecture.

---

## 2. Scope
- Definition of `FiscalYear` (e.g., `FY2026-27`) and `FiscalPeriod` (Monthly partitions: `OPEN`, `SOFT_CLOSED`, `HARD_LOCKED`).
- Invariant enforcement rejecting journal vouchers falling in locked or closed accounting periods with HTTP 400 (`SMRITI-GL-006`).
- Definition of `BankStatement` and `BankStatementLine` for banking ledgers (`Account` head 1020).
- Domain logic for parsing and persisting bank statement lines with deposits, withdrawals, and balance tracking.
- Automated two-way matching between bank statement lines and GL ledger entries with date tolerance windowing.
- Authoritative Bank Reconciliation Statement (BRS) calculation ($\text{Book Balance} + \text{Unpresented Cheques} - \text{Uncredited Deposits} = \text{Bank Balance}$).
- Alembic database migration `v1344_fiscal_period_brs` applied across tenant databases (`smriti001`, `smriti002`).
- 6 comprehensive automated unit and integration tests (bringing platform regression test suite to 83 passed tests).

---

## 3. Files Created
- `backend/alembic/versions/v1344_fiscal_period_brs.py`: Forward-only migration creating `fiscal_years`, `fiscal_periods`, `bank_statements`, and `bank_statement_lines` tables and indexes.
- `backend/tests/test_fiscal_period_brs.py`: Integration test suite covering fiscal periods, backdating lockouts (`SMRITI-GL-006`), bank statement ingestion, auto-reconciliation, and BRS calculations.

---

## 4. Files Modified
- `backend/app/models/accounting.py`: Added `FiscalYear`, `FiscalPeriod`, `BankStatement`, and `BankStatementLine` models.
- `backend/app/models/__init__.py`: Exported canonical fiscal period and BRS models.
- `backend/app/services/unified_accounting_ledger_service.py`: Added fiscal period generation, lockout assertions (`assert_fiscal_period_open`), bank statement import, auto-reconciliation, and BRS statement generation.

---

## 5. Architecture Decisions
- **Hard Lockout Invariant**: Once a fiscal period transitions to `HARD_LOCKED`, `post_journal_voucher` synchronously blocks any vouchers with transaction dates falling in that window (`SMRITI-GL-006`), guaranteeing compliance with statutory auditing standards.
- **Two-Way Bank Matching**: Automated reconciliation matches bank deposits to GL debits (customer payments) and bank withdrawals to GL credits (vendor disbursements) with a configurable $\pm 5$-day value date window.
- **BRS Mathematical Invariant**: Reconciliation asserts $\text{Book Balance} - \text{Uncredited Deposits} + \text{Unpresented Cheques} = \text{Bank Statement Balance}$, flagging any discrepancy in `difference`.

---

## 6. Design Rationale
- Period-close lockouts prevent retroactive ledger tampering and guarantee finalized trial balances and P&L statements remain stable across audit cycles.
- First-class bank statement and reconciliation models eliminate manual external spreadsheets, maintaining all financial tracking directly inside the PostgreSQL system of record.

---

## 7. Implementation Summary
- `create_fiscal_year_with_periods`: Automatically divides a Financial Year into 12 monthly periods (April to March in Indian statutory format).
- `lock_fiscal_period`: Updates period status to `HARD_LOCKED` or `SOFT_CLOSED`.
- `assert_fiscal_period_open`: Validates transaction date against closed periods and raises `HTTP 400` (`SMRITI-GL-006`).
- `import_bank_statement`: Persists header and line items for bank statement imports.
- `auto_reconcile_bank_statement`: Reconciles unmatched lines against General Ledger entries.
- `get_bank_reconciliation_statement`: Computes book balance, statement balance, uncredited deposits, unpresented cheques, and reconciliation equality.

---

## 8. Tests Executed
```powershell
python -m pytest tests/test_fiscal_period_brs.py -v
python -m pytest tests/test_routing_boundary_canonical.py tests/test_universal_party_master.py tests/test_universal_item_master.py tests/test_unified_sales_ledger.py tests/test_unified_pricing_payment_engine.py tests/test_unified_approval_communicator.py tests/test_unified_workspace_capability.py tests/test_unified_outbox_analytics.py tests/test_wms_phase1.py tests/test_wms_phase2_grn_sales.py tests/test_wms_phase3_eway_bill.py tests/test_wms_phase4_audit_reconciliation.py tests/test_security_menu_access.py tests/test_unified_accounting_ledger.py tests/test_fiscal_period_brs.py -v
```

---

## 9. Verification Results
- 6/6 tests passed in `test_fiscal_period_brs.py` in 4.76s.
- 13/13 tests passed in `test_unified_accounting_ledger.py` in 7.88s.
- 83/83 master platform tests passed in 48.15s.
- Verified 12 monthly period partitioning.
- Verified backdated voucher rejection in locked periods (`SMRITI-GL-006`).
- Verified bank statement line ingestion and balance tracking.
- Verified automated two-way bank deposit/withdrawal matching.
- Verified Bank Reconciliation Statement (BRS) calculation and balance equality.
- Verified multi-tenant database isolation between `smriti001` and `smriti002`.

---

## 10. Known Limitations
- OCR / AI-based PDF bank statement parsing remains deferred until transactional volume is established in Postgres.

---

## 11. Future Work
- Integration with external bank open banking APIs (Account Aggregator / ICICI Corporate API) for automated statement feed fetching.

---

## 12. Related ADRs
- `ADR-0045-AUTHORITATIVE-DOUBLE-ENTRY-GL`
- `ADR-0046-BANK-RECONCILIATION-STATEMENT-ENGINE`

---

## 13. Related RFCs
- `RFC-0089-FISCAL-GOVERNANCE-AND-BRS`
