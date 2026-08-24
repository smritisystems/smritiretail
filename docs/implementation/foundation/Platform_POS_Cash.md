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

# Platform POS Cash Drawer Movements & Physical Denominations Plan (v6.16.0)

## 1. Objective
Establish comprehensive physical cash denomination counting and auditable mid-shift cash movements (cash drops to bank/safe and till expense payouts) in ProPOS registers with real-time double-entry general ledger integration, net expected cash reconciliation, and authoritative Z-Report generation.

## 2. Business Motivation
Retail cashier environments undergo frequent cash drawer movements throughout the day, including cash drops to reduce drawer theft exposure and emergency store expense payouts (e.g. courier, stationery, minor repairs). Without structured mid-shift tracking and physical denomination recording, shift close cash variance cannot be accurately audited or reconciled against the General Ledger.

## 3. Scope
- Physical note & coin breakdown (₹2000, ₹500, ₹200, ₹100, ₹50, ₹20, ₹10, ₹5, ₹2, ₹1 notes & coins).
- Mid-shift Cash Drop (Till Skim) with double-entry voucher (Debit Bank `1020`, Credit Cash `1010`).
- Mid-shift Till Expense (Petty Cash) with double-entry voucher (Debit Expense `5000`, Credit Cash `1010`).
- Net Expected Cash formula invariant incorporating drops and expenses.
- Residual variance GL balancing (Debit `5070` Shortage / Credit `4050` Overage).
- Authoritative Z-Report API and clean-slate ephemeral database CI/CD test verification.

## 4. Current State
ProPOS shifts previously tracked opening balance, sales totals by payment mode, and closing balance, generating GL balancing entries solely from basic opening + sales vs closing count without granular denomination records or mid-shift movement logs.

## 5. Gap Analysis
1. Missing currency denomination breakdown storage for audit trails.
2. No auditable entity for mid-shift till skims or petty cash payouts from the drawer.
3. Expected cash formula omitted cash drops and till expenses.
4. Z-Report lacked itemized mid-shift drawer movements.

## 6. Architecture Impact
- **Database Schema**: Added `shift_cash_transactions` table and tracking columns to `shifts`.
- **GL Integration**: Real-time synchronous posting of cash drop and till expense vouchers through `UnifiedAccountingLedgerService`.
- **Domain Layer**: `POSService` enforces shift status validation (`OPEN`), computes denomination totals, and produces enriched Z-Reports.

## 7. Proposed Design
```text
Cashier Drawer
  ├── Mid-Shift Cash Drop   ──> Debit 1020 Bank/Safe,  Credit 1010 Cash
  ├── Mid-Shift Till Expense ──> Debit 5000 Expense,    Credit 1010 Cash
  └── Shift Close (Denominations)
        ├── Physical Count Summation
        ├── Net Expected = Opening + Sales - Drops - Expenses
        └── Residual Variance ──> Debit 5070 Shortage / Credit 4050 Overage
```

## 8. Files Created
1. `backend/alembic/versions/v1346_pos_cash_denominations.py`
2. `backend/tests/test_pos_cash_drawer_movements.py`
3. `docs/walkthrough/foundation/Platform_Accounting_POS_Cash_Drawer_Movements_v6.16.0.md`
4. `docs/implementation/foundation/Platform_POS_Cash_Drawer_Movements_Plan_v6.16.0.md`

## 9. Files Modified
1. `backend/alembic/env.py`
2. `backend/alembic/versions/a1b2c3d4e5f6_add_missing_core_tables.py`
3. `backend/app/models/pos.py`
4. `backend/app/models/__init__.py`
5. `backend/app/schemas/pos.py`
6. `backend/app/services/pos.py`
7. `backend/app/api/v1/pos.py`
8. `backend/tests/test_ephemeral_tenant_migration_harness.py`

## 10. Dependencies
- FastAPI Core backend
- PostgreSQL with JSONB support
- `UnifiedAccountingLedgerService`

## 11. Risks
- Cashiers entering incorrect denomination counts: Mitigated by client-side real-time calculation and server-side validation.

## 12. Rollback Strategy
- Symmetrical Alembic downgrade drops `shift_cash_transactions` table and columns cleanly.

## 13. Verification Plan
- Unit and integration tests for denomination calculation, GL voucher postings, API routes, and ephemeral multi-tenant databases.

## 14. Test Plan
- `pytest tests/test_pos_cash_drawer_movements.py -v`
- Full 20-suite master regression test across the platform.

## 15. Documentation Impact
- User Manual POS Operations section.
- API Documentation under `/api/v1/pos`.
- Walkthrough and Implementation Index updates.

## 16. Deployment Plan
- Apply Alembic migration `v1346_pos_cash_denominations` across all active tenant databases.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-0024-Unified-Accounting-Ledger`
- `ADR-0026-POS-Shift-Double-Entry-Reconciliation`

## 19. Related Walkthroughs
- `Platform_Accounting_POS_Cash_Drawer_Movements_v6.16.0.md`
