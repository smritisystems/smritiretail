<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Platform Accounting: POS Cash Drawer Physical Denominations & Mid-Shift Cash Movements Walkthrough (v6.16.0)

## 1. Purpose
This document details the architecture, data models, real-time double-entry general ledger integration, and verification of **Vertical Slice 14: POS Cash Drawer Physical Denominations & Mid-Shift Cash Drop / Till Expense Vouchers**. It establishes cashier-level physical denomination breakdown on shift close, real-time mid-shift cash drops (drawer to safe/bank) with GL postings, mid-shift till petty cash payouts with GL expense vouchers, net expected cash reconciliation, and authoritative Z-Report generation.

## 2. Scope
- **Physical Denomination Breakdown**: Structured currency note and coin breakdown (₹2000, ₹500, ₹200, ₹100, ₹50, ₹20, ₹10, ₹5, ₹2, ₹1 notes & coins) on shift closure with JSONB serialization.
- **Mid-Shift Cash Drop (Till Skim)**: Payout from register drawer to company safe/bank with real-time double-entry GL voucher posting (Debit `1020` Bank/Safe, Credit `1010` Cash in Hand).
- **Mid-Shift Till Expense (Petty Cash)**: Operational store expense payout from drawer with real-time double-entry GL voucher posting (Debit `5000` General Expense, Credit `1010` Cash in Hand).
- **Net Expected Cash Reconciliation Formula**:
  $$\text{Expected Cash} = \text{Opening Balance} + \text{Cash Sales} + \text{Cash In} - \text{Cash Drops} - \text{Till Expenses}$$
- **Shift Close Variance Balancing**: Automated GL balancing voucher generation for residual cash discrepancy (Debit `5070` Cash Shortage or Credit `4050` Cash Overage).
- **Authoritative Z-Report Expansion**: Enriched Z-Report response containing total cash movements, denomination breakdown, expected cash, and linked GL voucher audit trails.
- **Clean-Slate Ephemeral Database Test Verification**: Full lifecycle execution on dynamically provisioned isolated PostgreSQL tenant databases.

## 3. Files Created
1. `backend/alembic/versions/v1346_pos_cash_denominations.py` — Alembic revision adding `cash_drops_total`, `till_expenses_total`, `cash_in_total`, and `denominations` to `shifts` table, and creating `shift_cash_transactions` table with indexes and foreign keys.
2. `backend/tests/test_pos_cash_drawer_movements.py` — Comprehensive integration and API test suite covering physical denominations, cash drops, till expenses, combined variance balancing, REST endpoints, and ephemeral database validation.
3. `docs/walkthrough/foundation/Platform_Accounting_POS_Cash_Drawer_Movements_v6.16.0.md` — This walkthrough document.
4. `docs/implementation/foundation/Platform_POS_Cash_Drawer_Movements_Plan_v6.16.0.md` — Implementation plan document.

## 4. Files Modified
1. `backend/alembic/env.py` — Included `shift_cash_transactions` in schema inclusion filter.
2. `backend/alembic/versions/a1b2c3d4e5f6_add_missing_core_tables.py` — Updated `sales_invoices` DDL to include full model column attributes.
3. `backend/app/models/pos.py` — Added cash movement columns and `ShiftCashTransaction` entity.
4. `backend/app/models/__init__.py` — Exported `ShiftCashTransaction`.
5. `backend/app/schemas/pos.py` — Added Pydantic schemas for cash denominations, cash drops, till expenses, and enriched Z-Report responses.
6. `backend/app/services/pos.py` — Added `record_cash_drop`, `record_till_expense`, updated `close_shift` with denomination summation and net expected cash formula, and expanded `get_z_report`.
7. `backend/app/api/v1/pos.py` — Added REST API routes for `/pos/shifts/{shift_id}/cash-drop` and `/pos/shifts/{shift_id}/till-expense`.
8. `backend/tests/test_ephemeral_tenant_migration_harness.py` — Updated schema assertion for `shift_cash_transactions` and target head revision `v1346_pos_cash_denominations`.

## 5. Architecture Decisions
- **Real-Time Synchronous GL Posting for Cash Movements**: Mid-shift cash drops and till expenses generate immediate double-entry journal vouchers in `journal_vouchers` and `general_ledger_entries`, maintaining an exact real-time trial balance.
- **Physical Denomination Summation Priority**: If cashiers submit a detailed currency note and coin count, `POSService.close_shift` automatically calculates the total closing balance as the authoritative sum of denominations while preserving the granular JSON breakdown.
- **Auditable Transaction Entity**: All mid-shift drawer movements are logged into `shift_cash_transactions` with foreign key linkage to `shifts`, requesting user, transaction reason, receipt reference, and the resulting journal voucher.

## 6. Design Rationale
- **Cash Drawer Audit Trail**: Retail cash drawers often undergo mid-day bank deposits or emergency petty cash expenses. By formalizing `ShiftCashTransaction`, cashiers and store managers maintain full visibility into why the cash drawer balance differs from opening + sales.
- **Zero Raw Decimal JSON Incompatibility**: Pydantic v2 `model_dump(mode="json")` is utilized before storing denomination dictionaries into PostgreSQL `JSONB` columns, avoiding `TypeError: Object of type Decimal is not JSON serializable` under `asyncpg`.

## 7. Implementation Summary
- **Migration & Schema**: Created `shift_cash_transactions` table with index on `shift_id` and `(company_id, branch_id)`.
- **Domain Service**:
  - `POSService.record_cash_drop()`: Validates shift is `OPEN`, updates running `shift.cash_drops_total`, posts double-entry GL voucher (Debit `1020` Bank, Credit `1010` Cash), commits `ShiftCashTransaction`.
  - `POSService.record_till_expense()`: Validates shift is `OPEN`, updates running `shift.till_expenses_total`, posts double-entry GL voucher (Debit `5000` Expenses, Credit `1010` Cash), commits `ShiftCashTransaction`.
  - `POSService.close_shift()`: Parses physical denominations, evaluates net expected cash, computes variance, and posts shortage (`5070`) or overage (`4050`) balancing voucher.
- **REST Endpoints**:
  - `POST /api/v1/pos/shifts/{shift_id}/cash-drop`
  - `POST /api/v1/pos/shifts/{shift_id}/till-expense`
  - `POST /api/v1/pos/shifts/close/{shift_id}`
  - `GET /api/v1/pos/shifts/{shift_id}/z-report`

## 8. Tests Executed
```bash
python -m pytest tests/test_pos_cash_drawer_movements.py -v
```
All 6 tests passed:
1. `test_physical_cash_denominations_calculation_and_closing` — PASSED
2. `test_mid_shift_cash_drop_to_bank_safe` — PASSED
3. `test_mid_shift_till_expense_payout` — PASSED
4. `test_combined_cash_movements_and_closing_shortage_gl_balancing` — PASSED
5. `test_api_pos_cash_drop_and_till_expense_endpoints` — PASSED
6. `test_ephemeral_clean_database_cash_movements_verification` — PASSED

Full platform 20-suite regression test:
```bash
python -m pytest tests/test_routing_boundary_canonical.py tests/test_universal_party_master.py tests/test_universal_item_master.py tests/test_unified_sales_ledger.py tests/test_unified_pricing_payment_engine.py tests/test_unified_approval_communicator.py tests/test_unified_workspace_capability.py tests/test_unified_outbox_analytics.py tests/test_wms_phase1.py tests/test_wms_phase2_grn_sales.py tests/test_wms_phase3_eway_bill.py tests/test_wms_phase4_audit_reconciliation.py tests/test_security_menu_access.py tests/test_unified_accounting_ledger.py tests/test_fiscal_period_brs.py tests/test_accounting_api.py tests/test_multicurrency_fx.py tests/test_pos_shift_gl_integration.py tests/test_ephemeral_tenant_migration_harness.py tests/test_pos_cash_drawer_movements.py -v
```
**Result**: `123 passed, 23 warnings in 139.79s (0:02:19)`

## 9. Verification Results
| Verification Item | Target | Result | Status |
| :--- | :--- | :--- | :--- |
| Physical Denominations Summation | `POSService.close_shift` | Computed exact total from note and coin counts | Done |
| Mid-Shift Cash Drop GL Posting | `POSService.record_cash_drop` | Debit `1020`, Credit `1010` | Done |
| Mid-Shift Till Expense GL Posting | `POSService.record_till_expense` | Debit `5000`, Credit `1010` | Done |
| Net Expected Cash Calculation | Formula invariant | Factor Opening + Sales - Drops - Expenses | Done |
| POS Shift Close Balancing Voucher | Residual variance | Debit `5070` Shortage / Credit `4050` Overage | Done |
| Authoritative Z-Report API | `/pos/shifts/{id}/z-report` | Full movements, denominations, GL metadata | Done |
| Ephemeral Clean-Slate Parity | Fresh PostgreSQL DB | Full migration upgrade, seeding, and execution | Done |
| Full Platform Regression | 20 test suites | 123/123 passed (100%) | Done |

## 10. Known Limitations
- Mid-shift cash movement receipts currently log receipt references as string metadata; physical receipt attachments/images are deferred to the unified attachment service.

## 11. Future Work
- Integration with smart cash drawers and optical currency counting machines via WebSerial/WebSocket peripheral drivers.

## 12. Related ADRs
- `ADR-0024-Unified-Accounting-Ledger`
- `ADR-0026-POS-Shift-Double-Entry-Reconciliation`

## 13. Related RFCs
- `RFC-2026-08-POS-Cash-Drawer-Governance`
