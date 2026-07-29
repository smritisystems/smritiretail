<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 12.0.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Phase 17: General Ledger & Double-Entry Accounting Engine (v12.0.0)

## 1. Objective
Implement a fully compliant, high-throughput **General Ledger (GL) & Double-Entry Accounting Engine** for SMRITI Retail OS. This module transitions `AccountingService` from an audit-logging stub into an active financial transactional system of record backed by PostgreSQL, ensuring that every financial transaction (Sales, Purchases, POS Checkout, GST Settlement, Supplier Payments) posts balanced debits and credits into standard Chart of Accounts (COA) ledgers.

## 2. Business Motivation
- **Financial Audit Compliance:** Enforces GAAP and Indian AS double-entry accounting laws.
- **Automated Financial Statements:** Real-time generation of Trial Balance, Profit & Loss (P&L), and Balance Sheet reports without manual spreadsheets.
- **Multi-Branch Ledger Tracking:** Supports branch-level cost centers and consolidated enterprise financial views.

## 3. Scope
- Alembic DDL schema migration (`v1200_general_ledger_double_entry_accounting.py`).
- Domain models (`ChartOfAccounts`, `JournalVoucherModel`, `JournalLedgerEntryModel`, `FiscalPeriod`).
- Schemas & DTOs for journal vouchers, accounts, and financial reports.
- `AccountingService` implementation for voucher posting and statement compilation.
- REST API gateway `/api/v1/accounting/`.
- Automated test suite (`backend/app/tests/test_accounting.py`).

## 4. Current State
- `AccountingService` in `backend/app/services/accounting.py` is a stub logging posting intent.

## 5. Gap Analysis
- Financial records require true PostgreSQL double-entry storage and trial balance calculations.

## 6. Architecture Impact
- Replaces stub in `backend/app/services/accounting.py` with PostgreSQL async repository operations.

## 7. Proposed Design
- Strict validation: `total_debit == total_credit` required for all vouchers.
- Thread-safe, async transaction handling.

## 8. Files Created
- `/backend/alembic/versions/v1200_general_ledger_double_entry_accounting.py`
- `/backend/app/models/accounting.py`
- `/backend/app/schemas/accounting.py`
- `/backend/app/repositories/accounting.py`
- `/backend/app/api/v1/accounting.py`
- `/backend/app/tests/test_accounting.py`

## 9. Files Modified
- `/backend/app/services/accounting.py`
- `/backend/app/main.py`
- `/docs/implementation/README.md`
- `/docs/walkthrough/README.md`

## 10. Dependencies
- FastAPI, SQLAlchemy 2.0 Async, Pydantic V2.

## 11. Risks
- **Unbalanced Vouchers:** Rejected with HTTP 400.

## 12. Rollback Strategy
- Git revert of commit.

## 13. Verification Plan
- Automated pytest suite and `npx tsc --noEmit`.

## 14. Test Plan
- Unit tests for voucher balance validation, trial balance, P&L, and balance sheet.

## 15. Documentation Impact
- Implementation plan and walkthrough documentation.

## 16. Deployment Plan
- Git commit and Alembic upgrade.

## 17. Status
Approved / In Progress.

## 18. Related ADRs
- ADR-002 SMRITI Metadata Architecture.

## 19. Related Walkthroughs
- `docs/walkthrough/accounting/Accounting_General_Ledger_Double_Entry_v12.0.0.md`
