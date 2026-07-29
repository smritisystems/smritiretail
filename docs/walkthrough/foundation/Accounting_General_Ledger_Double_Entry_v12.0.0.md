<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders:
  * Pushpa Devi Jawahar Mallah (Founder & Chairperson)
  * Jawahar Ramkripal Mallah (Founder, CEO & Chief Software Architect)

  Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
  Version    : 12.0.0
  Created    : 2026-07-21
  Modified   : 2026-07-21
  Copyright  : © SMRITIBooks.com. All Rights Reserved.
  License    : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Phase 17: General Ledger & Double-Entry Accounting Engine (v12.0.0) — Walkthrough

## 1. Purpose
This walkthrough documents the implementation of Phase 17: **General Ledger & Double-Entry Accounting Engine (v12.0.0)** under the **SMRITI Plug-in Module Architecture (AOP-001)**. Accounting is an optional plug-in module, ensuring SMRITI operates as a standalone Retail OS platform by default without mandatory financial dependencies.

## 2. Scope
- Alembic DDL Migration (`v1200_general_ledger_double_entry_accounting.py`).
- SQLAlchemy ORM models (`ChartOfAccounts`, `JournalVoucherModel`, `JournalLedgerEntryModel`, `FiscalPeriod`).
- Pydantic V2 Schemas & DTOs (`accounting.py`).
- Async SQLAlchemy Repository (`AccountingRepository`).
- `AccountingService` upgrade with `ACCOUNTING_MODE` feature flag (`DISABLED`, `BASIC`, `ADVANCED`).
- REST API router `/api/v1/accounting/` (`settings`, `accounts`, `vouchers`, `trial-balance`, `profit-loss`, `balance-sheet`).
- Automated Pytest suite (`test_accounting.py`).

## 3. Files Created
- `/backend/alembic/versions/v1200_general_ledger_double_entry_accounting.py`
- `/backend/app/models/accounting.py`
- `/backend/app/schemas/accounting.py`
- `/backend/app/repositories/accounting.py`
- `/backend/app/api/v1/accounting.py`
- `/backend/app/tests/test_accounting.py`
- `/docs/implementation/accounting/General_Ledger_Double_Entry_Accounting_Plan_v12.0.0.md`
- `/docs/walkthrough/foundation/Accounting_General_Ledger_Double_Entry_v12.0.0.md`

## 4. Files Modified
- `/backend/app/core/config.py` — Added `ACCOUNTING_MODE` settings ("DISABLED" default).
- `/backend/app/services/accounting.py` — Integrated dormant bypass log and double-entry GL validator.
- `/backend/app/models/__init__.py` — Exported accounting models.
- `/backend/app/api/v1/__init__.py` — Exported accounting submodules.
- `/backend/app/main.py` — Mounted accounting router under `/api/v1`.
- `/docs/implementation/README.md` — Updated master implementation index.
- `/docs/walkthrough/README.md` — Updated master walkthrough index.

## 5. Architecture Decisions
- **Standalone Retail Core (AOP-001):** SMRITI is a Retail OS first. Accounting is a plug-in module (`ACCOUNTING_MODE="DISABLED"` by default). When disabled, business events bypass GL posting cleanly.
- **Strict Double-Entry Enforcement:** When `ACCOUNTING_MODE="ADVANCED"`, `total_debit == total_credit` is strictly enforced for all posted vouchers.

## 6. Design Rationale
- Stores and Kiranas do not require double-entry GL ledgers. Enterprise customers can enable `ACCOUNTING_MODE="ADVANCED"` with one switch without changing business logic or data structures.

## 7. Implementation Summary
- Standard Chart of Accounts seeded (1000-Assets, 2000-Liabilities, 3000-Equity, 4000-Revenue, 5000-COGS, 6000-Expenses).
- Real-time financial reports: Trial Balance, Profit & Loss (Income Statement), Balance Sheet (Assets = Liabilities + Equity).

## 8. Tests Executed
- `.\.venv311\Scripts\pytest backend/app/tests/test_accounting.py -v` (3 Passed)
- `npx tsc --noEmit` (0 Errors)

## 9. Verification Results
```text
backend/app/tests/test_accounting.py::test_retail_only_disabled_accounting_mode_bypasses_posting PASSED
backend/app/tests/test_accounting.py::test_advanced_accounting_mode_unbalanced_voucher_fails PASSED
backend/app/tests/test_accounting.py::test_advanced_accounting_posting_unit_mock PASSED
3 passed, 0 errors.
```

## 10. Known Limitations
- Multi-currency currency exchange rate fluctuation adjustments are handled in Phase 18.

## 11. Future Work
- Phase 18: Multi-Currency & Bank Automated Reconciliation Engine (v13.0.0).

## 12. Related ADRs
- ADR-002 SMRITI Metadata Architecture
- AOP-001 SMRITI Optionality Principle

## 13. Related RFCs
- RFC-017 General Ledger & Financial Accounting Plug-in Interface
