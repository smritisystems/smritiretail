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

# Platform Refactor Slice 10: Financial Reporting & Authoritative Accounting REST API Router

## 1. Purpose
Expose canonical, secure, multi-tenant REST API endpoints under `/api/v1/accounting` for the Double-Entry General Ledger, Real-Time Financial Statements (Trial Balance, P&L), Bank Reconciliation Statements (BRS), Fiscal Period Lockouts, and Period-End Balance Snapshots.

## 2. Scope
- FastAPI router `backend/app/api/v1/accounting.py` mounted at `/api/v1/accounting`.
- Pydantic v2 schemas `backend/app/schemas/accounting.py` validating requests and serialization.
- Automated API integration test suite `backend/tests/test_accounting_api.py`.
- Regression verification across all 16 platform test suites (90/90 tests passed).

## 3. Files Created
- `backend/app/api/v1/accounting.py` — REST API router exposing 10 authoritative accounting endpoints.
- `backend/app/schemas/accounting.py` — Pydantic models for voucher creation, trial balance, P&L, BRS, and fiscal period operations.
- `backend/tests/test_accounting_api.py` — Integration test suite verifying HTTP status codes and payloads.
- `docs/walkthrough/foundation/Platform_Accounting_REST_APIs_v6.16.0.md` — This walkthrough document.

## 4. Files Modified
- `backend/app/main.py` — Registered `accounting.router` under `/api/v1/accounting`.
- `docs/walkthrough/README.md` — Appended Slice 10 entry.
- `docs/implementation/README.md` — Appended Slice 10 entry.

## 5. Architecture Decisions
- **Statutory Invariant Enforcement via HTTP**: Unbalanced vouchers (`Debit != Credit`) and backdated entries in closed fiscal periods return structured HTTP 400 errors (`SMRITI-GL-001` and `SMRITI-GL-006`).
- **Dependency Injected Multi-Tenancy**: All endpoints leverage `get_company_db` and `get_tenant_context` to guarantee zero cross-tenant database leakage.

## 6. Design Rationale
Decoupled presentation serialization (Pydantic models) from the transactional domain engine (`UnifiedAccountingLedgerService`) to ensure backward compatibility and robust API error envelopes.

## 7. Implementation Summary
- `GET /api/v1/accounting/chart-of-accounts`: Fetches active Chart of Accounts.
- `GET /api/v1/accounting/trial-balance`: Real-time balanced Trial Balance verifying debits == credits.
- `GET /api/v1/accounting/profit-and-loss`: Real-time Operating Statement (P&L) with Net Operating Profit calculation.
- `POST /api/v1/accounting/vouchers`: Posts manual balanced Journal Vouchers (Debit == Credit).
- `GET /api/v1/accounting/vouchers`: Lists recent journal vouchers with pagination.
- `POST /api/v1/accounting/bank-statements`: Ingests bank statements with discrete line items.
- `POST /api/v1/accounting/bank-statements/{id}/auto-reconcile`: Runs automated two-way bank matching.
- `GET /api/v1/accounting/bank-reconciliation`: Returns Bank Reconciliation Statement (BRS).
- `POST /api/v1/accounting/fiscal-years`: Initializes FY and generates 12 monthly periods.
- `POST /api/v1/accounting/fiscal-periods/{id}/lock`: Locks or soft-closes an accounting period.
- `POST /api/v1/accounting/balance-snapshots`: Generates closing balance snapshots for fast reporting.

## 8. Tests Executed
```powershell
python -m pytest tests/test_accounting_api.py -v
python -m pytest tests/test_routing_boundary_canonical.py tests/test_universal_party_master.py tests/test_universal_item_master.py tests/test_unified_sales_ledger.py tests/test_unified_pricing_payment_engine.py tests/test_unified_approval_communicator.py tests/test_unified_workspace_capability.py tests/test_unified_outbox_analytics.py tests/test_wms_phase1.py tests/test_wms_phase2_grn_sales.py tests/test_wms_phase3_eway_bill.py tests/test_wms_phase4_audit_reconciliation.py tests/test_security_menu_access.py tests/test_unified_accounting_ledger.py tests/test_fiscal_period_brs.py tests/test_accounting_api.py -v
```

## 9. Verification Results
- `tests/test_accounting_api.py`: 7/7 PASSED in 8.90s.
- Master Platform Regression Suite: 90/90 PASSED in 50.34s across 16 test suites.

## 10. Known Limitations
- Multi-currency transactions currently settle in base currency (INR). Realized/unrealized FX gain/loss revaluation will be introduced in Slice 11.

## 11. Future Work
- Multi-Currency Ledger Valuation & Exchange Rate Tables (Slice 11).
- ProPOS End-of-Day Z-Report Automated Journalization.

## 12. Related ADRs
- `docs/architecture/ADR_001_FastAPI_Postgres_Sole_System_of_Record.md`
- `docs/architecture/ADR_008_Authoritative_Double_Entry_General_Ledger.md`

## 13. Related RFCs
- `docs/rfc/RFC_009_Statutory_Fiscal_Lockouts_And_BRS.md`
