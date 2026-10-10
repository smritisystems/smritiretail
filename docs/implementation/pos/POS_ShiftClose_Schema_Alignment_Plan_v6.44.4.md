<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.44.4
  Created      : 2026-09-26
  Modified     : 2026-09-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: POS Shift-Close Frontend/Backend Schema Alignment v6.44.4

**Status:** Completed
**Branch:** smritiNX
**Commit:** f36f7c8b
**Date:** 2026-09-26

## 1. Objective

Align ProPosShiftCloseDl.tsx API payload field names to the authoritative ShiftClose Pydantic
schema to eliminate silent data loss during shift-close cash reconciliation.

## 2. Business Motivation

Every cashier shift-close was silently losing the closing_balance value and coins denomination
totals, producing HTTP 400 errors or false cash shortages in the financial audit ledger
(pos_shift_denomination_counts). This is a cash-handling flow with direct financial impact.

## 3. Scope

IN SCOPE:
- ProPosShiftCloseDl.tsx handleCloseShift payload construction
- ProPosShiftCloseDl.tsx API response mapping
- backend/app/services/pos.py denom_multiplier_map coins_total entry
- Regression test: test_shift_close_frontend_schema_regression.py

OUT OF SCOPE:
- ShiftClose Pydantic schema (authoritative, correct)
- Shift SQLAlchemy model (authoritative, correct)
- Any Alembic migration (no DB schema change required)
- Any other POS or billing component

## 4. Current State (Before Fix)

ProPosShiftCloseDl.tsx sent:
  actual_cash (wrong), actual_card (spurious), actual_upi (spurious),
  denominations.coins (wrong key), notes (wrong key)

Pydantic ShiftClose with extra=ignore silently dropped all mismatched fields.
closing_balance received None. Backend raised 400 or persisted null with false shortage.

## 5. Gap Analysis

Field name mismatch (5 fields):
  actual_cash       -> closing_balance    (rename required in frontend)
  notes             -> closing_notes      (rename required in frontend)
  actual_card       -> (remove)           (not a ShiftClose field)
  actual_upi        -> (remove)           (not a ShiftClose field)
  denominations.coins -> coins_total      (key translation required in frontend)
  pos.py denom_multiplier_map             (coins_total key missing)

## 6. Architecture Impact

None. No schema, model, or migration change. Frontend-only wire format correction + one
additive map entry in the service layer.

## 7. Proposed Design

- Build explicit backendDenominations object in ProPosShiftCloseDl.tsx translating all
  denomination keys including coins -> coins_total before building API payload.
- Add coins_total: Decimal("1.00") to denom_multiplier_map in POSService.close_shift.
- Response mapping to use authoritative backend field names (res.closing_balance,
  res.variance, res.closed_at, res.identity_code).

## 8. Files Created

backend/tests/test_shift_close_frontend_schema_regression.py (new)

## 9. Files Modified

src/components/billing/propos/ProPosShiftCloseDl.tsx
backend/app/services/pos.py

## 10. Dependencies

- CashDenominationBreakdown schema (pos.py line 106-132): coins_total field confirmed
- Shift model (models/pos.py line 83-87): closing_balance, denominations columns confirmed
- POSService.close_shift (services/pos.py line 871): denom_multiplier_map confirmed

## 11. Risks

LOW - frontend-only payload change. No DB schema or service logic changes that affect
other flows. denom_multiplier_map change is additive (both coins and coins_total accepted).

## 12. Rollback Strategy

git revert f36f7c8b
Three files restored. No DB migration needed. No data loss risk on rollback.

## 13. Verification Plan

1. pytest regression test - exact frontend payload accepted, DB values correct
2. vitest full suite - no collateral regressions
3. Baseline comparison - identical t_pos_shift_gl.py failures on clean HEAD

## 14. Test Plan

test_pro_pos_shift_close_payload_reconciliation_e2e:
  - Simulate exact frontend payload (5000 notes + 50 coins)
  - Assert closing_balance = 5050.00 in DB
  - Assert variance = 0.00
  - Assert pos_shift_denomination_counts has coin row (actual_amount = 50.00)
  - Assert notes_500 row (actual_amount = 5000.00)

test_pro_pos_shift_close_without_denominations_fallback:
  - Simulate closing_balance-only payload (no denominations)
  - Assert accepted without 400
  - Assert closing_balance = 3500.00, variance = 0.00

## 15. Documentation Impact

- Walkthrough: docs/walkthrough/pos/POS_ShiftClose_Schema_Alignment_v6.44.4.md
- Implementation Plan: this document
- Walkthrough Index: docs/walkthrough/README.md (updated)
- Implementation Index: docs/implementation/README.md (updated)
- CHANGELOG.md (updated)

## 16. Deployment Plan

1. git commit f36f7c8b on smritiNX (done)
2. git push smritiNX
3. git pull on F:\Smriti9 (test environment per AGENTS.md DEV/TEST rule)
4. Verify shift-close flow end-to-end on test register

## 17. Status

Completed. Commit f36f7c8b. 2/2 pytest tests passed. 1057/1057 vitest tests passed.

## 18. Related ADRs

- FastAPI + Postgres Sole Backend Architecture
- Frontend must align to backend schema

## 19. Related Walkthroughs

- docs/walkthrough/pos/POS_ShiftClose_Schema_Alignment_v6.44.4.md
