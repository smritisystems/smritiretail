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
Extend the Authoritative Double-Entry Accounting Engine to support international commerce, multi-currency journal vouchers, daily currency exchange rate matrices, automatic Realized Foreign Exchange Gain/Loss calculations upon settlement, period-end Mark-to-Market (MTM) Unrealized Foreign Exchange revaluation, and strict production accounting invariants.

## 2. Scope
- Model additions: `CurrencyExchangeRate` entity, multi-currency attributes on `JournalVoucher` and `GeneralLedgerEntry`.
- Symmetrical forward-and-reverse database migration: `backend/alembic/versions/v1345_multicurrency_fx.py` with complete `downgrade()` dropping added columns and tables.
- Domain service methods in `UnifiedAccountingLedgerService`:
  - `validate_currency_code`: Enforces 3-letter ISO uppercase format (`^[A-Z]{3}$`).
  - `set_exchange_rate`: Enforces rate bounds ($0 < \text{rate} \le 100,000,000$), rate type validation (`SPOT`, `CLOSING`, `AVERAGE`, `CUSTOM`), and prevents identical currency pairing (`SMRITI-GL-011`).
  - `get_exchange_rate`: Resolves effective point-in-time rates or returns `1.000000` for identical currencies.
  - Multi-currency `post_journal_voucher`: Enforces foreign currency debit/credit equality (`SMRITI-GL-010`) and base currency double-entry invariant ($\sum \text{Debits} == \sum \text{Credits}$).
  - `reconcile_foreign_settlement_fx`: Enforces over-settlement boundary protection (`SMRITI-GL-009`), currency consistency (`SMRITI-GL-014`), and settlement pair idempotency.
  - `calculate_unrealized_fx_revaluation`: Enforces fiscal period open check and periodic MTM run idempotency (`is_idempotent_cached`).
  - `assert_voucher_immutable`: Enforces append-only immutable ledger policy (`SMRITI-GL-015`).
- REST API router endpoints in `backend/app/api/v1/accounting.py` protected by RBAC `require_role(UserRole.SYSADMIN, UserRole.MANAGER)`.
- Automated test suites: `backend/tests/t_multicurrency.py` (12/12 passed) and `backend/tests/test_accounting_api.py` (9/9 passed).
- Master platform regression suite: 104/104 passed across all 17 test suites.

## 3. Files Created
- `backend/alembic/versions/v1345_multicurrency_fx.py` — Symmetrical migration creating `currency_exchange_rates` and altering `journal_vouchers` and `general_ledger_entries`.
- `backend/tests/t_multicurrency.py` — Dedicated multi-currency and FX governance test suite.
- `docs/walkthrough/foundation/Platform_2_3_4_5__7.md` — This walkthrough document.

## 4. Files Modified
- `backend/app/models/accounting.py` — Added `CurrencyExchangeRate` model and multi-currency fields on `JournalVoucher` and `GeneralLedgerEntry`.
- `backend/app/models/__init__.py` — Exported `CurrencyExchangeRate`.
- `backend/app/services/unified_ledger.py` — Added FX accounts (`4030`, `4040`, `5050`, `5060`), currency validation, foreign balancing invariant, settlement allocation bounds, settlement pair idempotency, MTM run idempotency, and immutability guard.
- `backend/app/schemas/accounting.py` — Added Pydantic v2 schemas for exchange rates and FX revaluation.
- `backend/app/api/v1/accounting.py` — Added REST API routes with RBAC role authorization guards.
- `backend/tests/test_accounting_api.py` — Added API integration and RBAC 403 authorization rejection test cases.
- `docs/walkthrough/README.md` — Appended Slice 11 to master walkthrough index.
- `docs/implementation/README.md` — Appended Slice 11 to master implementation index.

## 5. Architecture Decisions
- **Base Currency Double-Entry Invariant**: The ledger preserves strict double-entry balance ($\sum \text{Debits} == \sum \text{Credits}$) in the company's Base Currency (INR). `debit_amount` and `credit_amount` reflect converted base values, while `foreign_debit_amount`, `foreign_credit_amount`, `foreign_currency`, and `exchange_rate` retain transactional provenance.
- **Foreign Currency Balancing Invariant**: For vouchers in a uniform foreign currency, $\sum \text{foreign\_debit} == \sum \text{foreign\_credit}$ is asserted before base currency conversion (`SMRITI-GL-010`).
- **Settlement Idempotency & Over-Settlement Protection**: `reconcile_foreign_settlement_fx` indexes settlement pairs via `reference_doc_id = f"{invoice_voucher_id}:{payment_voucher_id}"`, preventing double-posting and rejecting settlement amounts exceeding invoice foreign totals (`SMRITI-GL-009`).
- **Idempotent Mark-to-Market Revaluation**: `calculate_unrealized_fx_revaluation` indexes period revaluations via `reference_doc_no = f"MTM-{company_id}-{as_of_date.isoformat()}"`, caching runs and preventing duplicate periodic vouchers.
- **Immutable Ledger Policy**: Posted journal vouchers and general ledger entries cannot be mutated or deleted directly (`SMRITI-GL-015`); adjustments require reversing vouchers.

## 6. Design Rationale
Decoupled multi-currency storage at the line level allows mixed-currency complex journal vouchers while ensuring trial balance, profit & loss, and balance sheets calculate instantaneously from base currency aggregates without expensive runtime joins or conversion delays.

## 7. Implementation Summary
- `DEFAULT_CHART_OF_ACCOUNTS`: Automatically seeds:
  - `4030`: Foreign Exchange Gain (Realized) [REVENUE]
  - `4040`: Foreign Exchange Gain (Unrealized) [REVENUE]
  - `5050`: Foreign Exchange Loss (Realized) [EXPENSE]
  - `5060`: Foreign Exchange Loss (Unrealized) [EXPENSE]
- `set_exchange_rate`: Upserts point-in-time exchange rates with ISO 3-letter uppercase validation, disparity validation, and strictly positive bounded rates.
- `get_exchange_rate`: Resolves effective rates or returns `1.000000` for identical base currencies.
- `reconcile_foreign_settlement_fx`: Generates `VOUCHER_TYPE = "FX_REALIZATION"` balancing vouchers for realized settlement variances with over-settlement and duplicate protection.
- `calculate_unrealized_fx_revaluation`: Scans open foreign debtors/creditors and generates `VOUCHER_TYPE = "FX_UNREALIZED_MTM"` vouchers against closing rates with period lockout and idempotency checks.
- REST APIs:
  - `POST /api/v1/accounting/exchange-rates` (RBAC protected)
  - `GET /api/v1/accounting/exchange-rates`
  - `POST /api/v1/accounting/fx-revaluation/unrealized` (RBAC protected)

## 8. Tests Executed
```powershell
python -m pytest tests/t_multicurrency.py tests/test_accounting_api.py -v
python -m pytest tests/t_route_boundary.py tests/t_univ_party.py tests/t_univ_item.py tests/t_sales_ledger.py tests/t_pricing_eng.py tests/t_approval_comm.py tests/t_workspace_cap.py tests/t_outbox_stats.py tests/test_wms_phase1.py tests/t_wms_phase2.py tests/t_wms_phase3.py tests/t_wms_phase4.py tests/t_sec_menu.py tests/t_unified_ledger.py tests/t_fiscal_period.py tests/test_accounting_api.py tests/t_multicurrency.py -v
```

## 9. Verification Results
- `tests/t_multicurrency.py`: 12/12 PASSED.
- `tests/test_accounting_api.py`: 9/9 PASSED.
- Master Platform Regression Suite: 104/104 PASSED in 59.69s across 17 test suites.

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
