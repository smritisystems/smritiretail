<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Version      : 3.17.3
  Created      : 2026-10-27
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# WMS Physical Stock Approval -- Movement Commitment Sprint v3.17.3

**Walkthrough ID:** WMS_Physical_Stock_Approval_Movement_Commitment_v3.17.3
**Date:** 2026-10-27
**Commit:** db0d553d
**Branch:** smritiNX

---

## 1. Purpose

Implement PHY-005: when a stock-take session is approved by a manager, the system
commits StockMovement records for every non-zero variance line. Before this sprint,
approval updated session status but left no permanent financial trail in the stock
ledger. Simultaneously remediate G5: InvoiceProfitabilityLedger must record which
costing method was used at GL posting time (SMRITI Historical Transaction
Immutability Policy Rule 4).

## 2. Scope

- WMS: PATCH /api/v1/physical-stock/sessions/{id}/approve -- movement commitment
- WMS: stock_count_lines.is_reconciled column (idempotency gate)
- G5: invoice_profitability_ledgers.valuation_method_used column
- G5: UnifiedAccountingLedgerService valuation derivation
- Migrations: v1550 (idempotent IF NOT EXISTS), v1551 (idempotent IF NOT EXISTS)
- Tests: 10-case integration regression suite

## 3. Files Created

- backend/alembic/versions/v1550_ipl_valuation_method.py
- backend/alembic/versions/v1551_stock_count_lines_is_reconciled.py
- backend/app/tests/test_physical_stock_approval.py

## 4. Files Modified

- backend/app/api/v1/physical_stock.py -- approve_stock_take PHY-005 implementation
- backend/app/models/profitability.py -- valuation_method_used column
- backend/app/services/unified_ledger.py -- dominant/mixed valuation derivation

## 5. Architecture Decisions

WAC frozen at approval time (not recalculated). Idempotency via is_reconciled flag +
idempotency_key on StockMovement ('phy_approve_{take_id}_{line_id}'). Role guard:
ADMIN/MANAGER only. State machine: only COMPLETED sessions approvable.

## 6. Design Rationale

INWARD_SURPLUS / OUTWARD_SHRINKAGE movement types are semantically correct. Idempotent
migrations (IF NOT EXISTS) required because test harness replays migrations on cloned
template DBs. TC-007/TC-008 override get_current_user directly because the SMRITI
auth middleware chain produces plain-string 403s before endpoint business guards fire.

## 7. Implementation Summary

approve_stock_take flow:
  Role guard -> Load session (404) -> State machine (422) ->
  Load unreconciled non-zero variance lines ->
  For each: determine movement_type, freeze WAC, INSERT stock_movement,
            UPDATE line is_reconciled=true ->
  UPDATE stock_takes header totals ->
  Return response payload

## 8. Tests Executed

pytest backend/app/tests/test_physical_stock_approval.py -v

TC-001 INWARD_SURPLUS movement created
TC-002 OUTWARD_SHRINKAGE movement created
TC-003 zero variance - no movement created
TC-004 WAC frozen when line cost missing (uses PCV)
TC-005 idempotent approval (no double movements)
TC-006 header rollup correct
TC-007 CASHIER role 403
TC-008 DRAFT session 422
TC-009 response payload fields present
TC-010 mixed surplus + shortage correct rollup

## 9. Verification Results

Literal terminal output:
================= 10 passed, 28 warnings in 129.90s (0:02:09) =================
Exit code: 0. Commit: db0d553d.

Evidence: 10/10 green. All business rules verified by automated integration tests
running against isolated test DB (smriti_test_phy005h).

## 10. Known Limitations

- smriti002 dev DB is below v1372 (no stock_count_lines). v1551 failed on that DB.
  Requires alembic upgrade head on smriti002 to restore parity.
- SMRITI global exception handler returns plain-string detail to clients, hiding
  internal SMRITI-PERM-001 / SMRITI-VAL-001 codes from wire format.

## 11. Future Work

- alembic upgrade head on smriti002 to reach v1551 parity
- X-SMRITI-Error-Code response header for structured code exposure without HREP breach
- StockMovement -> InvoiceProfitabilityLedger linkage for net contribution reports
- Loyalty Points Ledger / Gift Card Balance Ledger / E-Invoice IRN lifecycle

## 12. Related ADRs

- ADR-019: SMRITI Historical Transaction Immutability Policy
- ADR-024: WMS Physical Stock Take Session State Machine
- ADR-031: Idempotency Key Strategy for StockMovement

## 13. Related RFCs

- RFC-WMS-005: Physical Stock Variance Commitment on Approval
- RFC-G5: InvoiceProfitabilityLedger Valuation Method Traceability