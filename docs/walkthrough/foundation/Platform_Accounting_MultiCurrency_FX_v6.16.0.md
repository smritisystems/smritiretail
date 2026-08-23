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

# Platform Refactor Slice 11: Multi-Currency General Ledger Valuation, Exchange Rate Tables & Realized/Unrealized FX Engine

## 1. Purpose
Extend the Authoritative Double-Entry Accounting Engine to support international commerce, multi-currency journal vouchers, daily currency exchange rate matrices, automatic Realized Foreign Exchange Gain/Loss calculations upon settlement, and period-end Mark-to-Market (MTM) Unrealized Foreign Exchange revaluation.

## 2. Scope
- Model additions: `CurrencyExchangeRate` entity, multi-currency attributes on `JournalVoucher` and `GeneralLedgerEntry`.
- Forward-only database migration: `backend/alembic/versions/v1345_multicurrency_fx.py` applied across tenant databases (`smriti001`, `smriti002`).
- Domain service methods in `UnifiedAccountingLedgerService`: `set_exchange_rate`, `get_exchange_rate`, multi-currency `post_journal_voucher`, `reconcile_foreign_settlement_fx`, `calculate_unrealized_fx_revaluation`.
- REST API router endpoints in `backend/app/api/v1/accounting.py` and schemas in `backend/app/schemas/accounting.py`.
- Automated test suites: `backend/tests/test_multicurrency_fx.py` (6/6 passed) and `backend/tests/test_accounting_api.py` (8/8 passed).
- Master platform regression suite: 97/97 tests passed across all 17 test suites.

## 3. Files Created
- `backend/alembic/versions/v1345_multicurrency_fx.py` — Database migration creating `currency_exchange_rates` and altering `journal_vouchers` and `general_ledger_entries`.
- `backend/tests/test_multicurrency_fx.py` — Multi-currency unit and integration test suite.
- `docs/walkthrough/foundation/Platform_Accounting_MultiCurrency_FX_v6.16.0.md` — This walkthrough document.

## 4. Files Modified
- `backend/app/models/accounting.py` — Added `CurrencyExchangeRate` model and multi-currency fields on `JournalVoucher` and `GeneralLedgerEntry`.
- `backend/app/models/__init__.py` — Exported `CurrencyExchangeRate`.
- `backend/app/services/unified_accounting_ledger_service.py` — Added standard FX chart of accounts heads (`4030`, `4040`, `5050`, `5060`) and exchange rate / settlement / revaluation methods.
- `backend/app/schemas/accounting.py` — Added Pydantic v2 schemas for exchange rates and FX revaluation.
- `backend/app/api/v1/accounting.py` — Added REST API routes for exchange rate management and unrealized MTM revaluation.
- `backend/tests/test_accounting_api.py` — Added test case for exchange rates and FX revaluation API endpoints.
- `docs/walkthrough/README.md` — Appended Slice 11 to master walkthrough index.
- `docs/implementation/README.md` — Appended Slice 11 to master implementation index.

## 5. Architecture Decisions
- **Base Currency Double-Entry Invariant**: The ledger preserves strict double-entry balance ($\sum \text{Debits} == \sum \text{Credits}$) in the company's Base Currency (INR). `debit_amount` and `credit_amount` reflect converted base values, while `foreign_debit_amount`, `foreign_credit_amount`, `foreign_currency`, and `exchange_rate` retain transactional provenance.
- **Realized Settlement Difference Automation**: When customer or supplier transactions settle at an exchange rate differing from the booking rate, the engine automatically calculates the rupee difference and posts balancing journal entries to Account `4030` (Realized Gain) or Account `5050` (Realized Loss).
- **Point-in-Time Spot Rate Fallback**: `get_exchange_rate` queries the latest effective rate on or before the document date for the specified currency pair (`from_curr / to_curr`), failing closed with `SMRITI-GL-007` if no valid rate exists.

## 6. Design Rationale
Decoupled multi-currency storage at the line level allows mixed-currency complex journal vouchers while ensuring trial balance, profit & loss, and balance sheets calculate instantaneously from base currency aggregates without expensive runtime joins or conversion delays.

## 7. Implementation Summary
- `DEFAULT_CHART_OF_ACCOUNTS`: Automatically seeds:
  - `4030`: Foreign Exchange Gain (Realized) [REVENUE]
  - `4040`: Foreign Exchange Gain (Unrealized) [REVENUE]
  - `5050`: Foreign Exchange Loss (Realized) [EXPENSE]
  - `5060`: Foreign Exchange Loss (Unrealized) [EXPENSE]
- `set_exchange_rate`: Upserts point-in-time exchange rates with strict positive rate validation (`SMRITI-GL-008`).
- `get_exchange_rate`: Resolves effective rates or returns `1.000000` for identical base currencies.
- `reconcile_foreign_settlement_fx`: Generates `VOUCHER_TYPE = "FX_REALIZATION"` balancing vouchers for realized settlement variances.
- `calculate_unrealized_fx_revaluation`: Scans open foreign debtors/creditors and generates `VOUCHER_TYPE = "FX_UNREALIZED_MTM"` vouchers against closing rates.
- REST APIs:
  - `POST /api/v1/accounting/exchange-rates`
  - `GET /api/v1/accounting/exchange-rates`
  - `POST /api/v1/accounting/fx-revaluation/unrealized`

## 8. Tests Executed
```powershell
python -m pytest tests/test_accounting_api.py tests/test_multicurrency_fx.py -v
python -m pytest tests/test_routing_boundary_canonical.py tests/test_universal_party_master.py tests/test_universal_item_master.py tests/test_unified_sales_ledger.py tests/test_unified_pricing_payment_engine.py tests/test_unified_approval_communicator.py tests/test_unified_workspace_capability.py tests/test_unified_outbox_analytics.py tests/test_wms_phase1.py tests/test_wms_phase2_grn_sales.py tests/test_wms_phase3_eway_bill.py tests/test_wms_phase4_audit_reconciliation.py tests/test_security_menu_access.py tests/test_unified_accounting_ledger.py tests/test_fiscal_period_brs.py tests/test_accounting_api.py tests/test_multicurrency_fx.py -v
```

## 9. Verification Results
- `tests/test_multicurrency_fx.py`: 6/6 PASSED in 4.81s.
- `tests/test_accounting_api.py`: 8/8 PASSED in 8.90s.
- Master Platform Regression Suite: 97/97 PASSED in 58.37s across 17 test suites.

## 10. Known Limitations
- Automated real-time external rate feed integration (e.g. daily RBI/ECB scrapers) will be orchestrated via background outbox scheduled jobs in future maintenance phases.

## 11. Future Work
- ProPOS Cash Register Shift Close (Z-Report) Automated Balancing Voucher Posting (Slice 12).
- Multi-Tenant Ephemeral Database CI/CD Test Harness.

## 12. Related ADRs
- `docs/architecture/ADR_001_FastAPI_Postgres_Sole_System_of_Record.md`
- `docs/architecture/ADR_008_Authoritative_Double_Entry_General_Ledger.md`

## 13. Related RFCs
- `docs/rfc/RFC_010_Multi_Currency_Valuation_And_FX_Gain_Loss.md`
