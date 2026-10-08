<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.34
  Created      : 2026-10-08
  Modified     : 2026-10-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: POS Real-Time Sales Commission Accrual & Return Reversal

**Plan ID:** IP-HR-004  
**Status:** Approved  
**Version:** 1.0.0  
**Domain:** HR & Workforce Operations / POS Transaction Integrity  

---

## 1. Objective
Establish automated, real-time sales commission posting by wiring sales invoice completion and sales return refund workflows directly to `commission_ledgers`:
1. Atomically accrue salesperson incentives (`transaction_type='EARNED'`) in `commission_ledgers` upon invoice finalization in `CanonicalSalesPostingWriter`.
2. Atomically reverse salesperson commissions (`transaction_type='REVERSED'`) in `commission_ledgers` upon credit note / sales return creation in `SalesService.create_sales_return`.

## 2. Business Motivation
In physical retail environments, sales representatives earn performance commissions per bill or per line item. Delayed or manual batch calculation creates mistrust, discrepancies between store reports and payouts, and commission leakage when refunded or returned merchandise is not clawed back. Real-time ledger posting ensures instant commission visibility and absolute auditability.

## 3. Scope
- **Backend Hooks (`backend/app/services/sales_hook.py`):**
  - `write_commission_accrual()`: Evaluates item-level and bill-level salesperson tags, matches active `CommissionRule`, and writes `EARNED` ledger entries.
  - `write_commission_reversal()`: Calculates proportional return amounts and writes offsetting `REVERSED` entries.
- **Sales Transaction Writers:**
  - `CanonicalSalesPostingWriter.post_sales_invoice` in `backend/app/services/canonical_sales_writer.py`.
  - `SalesService.create_sales_return` in `backend/app/services/sales.py`.
- **Automated Test Suite:**
  - Pytest verification in `backend/app/tests/t_sales_commission_hook_verify.py`.

## 4. Current State
- `commission_ledgers` exists with 22 columns including `gross_sales_amount`, `commission_amount`, `reference_invoice_id`, `reference_return_id`.
- Commission calculations previously existed only as on-demand endpoints (`/crm-growth/commissions/calculate` or `/staff/incentives`), requiring manual trigger.
- POS invoices finalized without creating live transactional ledger entries in `commission_ledgers`.

## 5. Gap Analysis
| Component | Before State | Target State |
|---|---|---|
| Invoice Finalize | 0 commission ledger rows written | Real-time `EARNED` row in `commission_ledgers` per salesperson |
| Sales Return | No commission clawback | Proportional `REVERSED` row with `reference_return_id` |
| Participant Resolution | Strict manual setup required | Automatic fallback to `users` profile resolution |

## 6. Architecture Impact
- **Database Schema:** Zero migrations required. `commission_ledgers`, `commission_participants`, and `commission_rules` already exist in tenant databases.
- **Transaction Boundary:** Hooks run inside the caller's active database session without early commits, preserving ACID atomicity and rollback safety.

## 7. Proposed Design
```text
[POS Invoice Checkout] ──► CanonicalSalesPostingWriter ──► write_commission_accrual() ──► commission_ledgers (EARNED)
[Sales Return / Refund] ──► SalesService.create_sales_return ──► write_commission_reversal() ──► commission_ledgers (REVERSED)
```

## 8. Files Created
- `docs/implementation/hr/POS_Realtime_Commission_Accrual_And_Reversal_Plan_v1.0.0.md`
- `docs/walkthrough/hr/POS_Realtime_Commission_Accrual_And_Reversal_v1.0.0.md`
- `backend/app/tests/t_sales_commission_hook_verify.py`

## 9. Files Modified
- `backend/app/services/sales_hook.py`
- `backend/app/services/canonical_sales_writer.py`
- `backend/app/services/sales.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- SQLAlchemy async engine, `select`, `text`
- Decimal rounding precision
- `CommissionLedger`, `CommissionParticipant`, `CommissionRule`

## 11. Risks
- Zero or missing rules: Handled by 2% default fallback heuristic.
- Performance impact: Bounded by single indexed query on `commission_participants` and `commission_rules`.

## 12. Rollback Strategy
Revert changes in `sales_hook.py`, `canonical_sales_writer.py`, and `sales.py`. No database migration rollback required.

## 13. Verification Plan
1. Pytest suite `t_sales_commission_hook_verify.py`:
   - Invoice with salesperson generates `EARNED` row in `commission_ledgers`.
   - Sales return generates `REVERSED` row with negative commission amount.
2. Regression test of full sales and staff suites.

## 14. Test Plan
- Test full lifecycle: User -> POS Invoice with salesperson -> Commission Ledger Verification -> Sales Return -> Commission Clawback Verification.

## 15. Documentation Impact
- Update implementation master index (`docs/implementation/README.md`).
- Update walkthrough master index (`docs/walkthrough/README.md`).
- Update `CHANGELOG.md` for release v6.70.34.

## 16. Deployment Plan
Push to `origin/smritiNX` and deploy to test environment.

## 17. Status
Approved — In Execution.

## 18. Related ADRs
- ADR-014: Unified Staff and Identity Architecture.
- ADR-028: Multi-Tenant Schema Isolation.

## 19. Related Walkthroughs
- `Attendance_Punch_Clocking_And_Biometric_Webhook_v1.0.0.md`
- `POS_Realtime_Commission_Accrual_And_Reversal_v1.0.0.md`
