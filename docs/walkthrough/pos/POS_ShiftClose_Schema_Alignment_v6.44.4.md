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

# POS Shift-Close Frontend to Backend Schema Alignment v6.44.4

**Area:** POS / Billing
**Branch:** smritiNX
**Commit:** f36f7c8b
**Status:** Completed
**Date:** 2026-09-26

---

## 1. Purpose

Eliminate a verified cash-handling silent data-loss bug. Every shift-close submission from
ProPosShiftCloseDl.tsx sent field names (actual_cash, notes, denominations.coins) that did not
match the backend ShiftClose Pydantic schema (closing_balance, closing_notes,
denominations.coins_total). Pydantic default extra=ignore silently dropped mismatched fields,
causing HTTP 400 rejections or false cash shortage variances on every shift close.

## 2. Scope

Frontend: ProPosShiftCloseDl.tsx - payload construction, response mapping
Backend Service: backend/app/services/pos.py - denom_multiplier_map coins_total key
Tests: New regression test file covering full reconciliation and fallback path
Schema / DB model: NOT changed - authoritative and correct

## 3. Files Created

backend/tests/test_shift_close_frontend_schema_regression.py
  Regression test covering exact frontend payload shape, DB persistence, coin audit row.
  2 async pytest cases: full denomination reconciliation + denomination-free fallback.

## 4. Files Modified

src/components/billing/propos/ProPosShiftCloseDl.tsx
  - Rebuilt handleCloseShift payload: actual_cash -> closing_balance, notes -> closing_notes
  - Added explicit backendDenominations map translating coins -> coins_total
  - Removed spurious actual_card / actual_upi fields (not ShiftClose fields)
  - Fixed response mapping: reads res.closing_balance, res.variance, res.closed_at, res.identity_code

backend/app/services/pos.py
  - Added "coins_total": Decimal("1.00") to denom_multiplier_map in close_shift()
  - Ensures coins_total key is correctly written to pos_shift_denomination_counts

## 5. Architecture Decisions

1. Backend is authoritative. ShiftClose Pydantic schema and Shift SQLAlchemy model define the
   contract. The frontend must conform. No backend field renames were performed.
2. Frontend state key vs wire key separation. CashDenominations TypeScript interface retains
   coins as local state field. A translation step (backendDenominations) maps it to coins_total
   when building the API payload. This isolates UI rendering concerns from API contract.
3. denom_multiplier_map is additive. Legacy "coins" key retained alongside new "coins_total"
   key to protect any older client integrations. Non-breaking additive change.

## 6. Design Rationale

Root cause: ProPosShiftCloseDl.tsx used informal display-oriented names (actual_cash, notes)
rather than the database column names exposed by the FastAPI schema. When ShiftClose schema was
formalized in August 2026, the frontend was not updated. Pydantic extra=ignore prevented any
runtime 422 error, making the regression invisible until cash figures were manually audited.

The fix is the minimum surgical change: only payload construction and one service-side map
entry were touched. No schema, no model, no migration, no other POS component.

## 7. Implementation Summary

BEFORE FIX - Payload sent by ProPosShiftCloseDl.tsx:
  { "actual_cash": 5050.00, "actual_card": 0.00, "actual_upi": 0.00,
    "denominations": { "notes_500": 10, "coins": 50 }, "notes": "Cashier handover" }
  Result: All fields silently dropped. closing_balance = None.
  Backend raised HTTP 400 or persisted closing_balance = null with false shortage.

AFTER FIX - Payload sent by ProPosShiftCloseDl.tsx:
  { "closing_balance": 5050.00, "closing_notes": "Cashier handover",
    "denominations": { "notes_2000":0, "notes_500":10, "notes_200":0, "notes_100":0,
    "notes_50":0, "notes_20":0, "notes_10":0, "notes_5":0, "notes_2":0, "notes_1":0,
    "coins_total": 50.00 } }
  Result: All fields match ShiftClose. closing_balance = Decimal(5050.00), variance = 0.00.
  pos_shift_denomination_counts: notes_500 x10 row + coins_total x50 row.

## 8. Tests Executed

Command: pytest backend/tests/test_shift_close_frontend_schema_regression.py -v
Output:
  test_pro_pos_shift_close_payload_reconciliation_e2e PASSED
  test_pro_pos_shift_close_without_denominations_fallback PASSED
  2 passed in 4.86s

Command: node_modules/.bin/vitest run
Output:
  Test Files  153 passed (153)
        Tests  1057 passed (1057)
     Duration  21.63s

Baseline check: git stash + re-run t_pos_shift_gl.py on clean HEAD.
Result: Same 7 pre-existing failures. Our changes introduced zero new failures.

## 9. Verification Results

Evidence:
  2/2 regression tests PASSED (pytest 9.1.1, Python 3.13.11)
  1057/1057 Vitest tests PASSED (153 test files)
  git diff confirmed only 3 files changed, no collateral modifications

Interpretation:
  closing_balance, closing_notes, and denominations.coins_total are now correctly
  transmitted and persisted. variance is correctly 0.00 when counted cash equals expected.
  pos_shift_denomination_counts receives exact coin and note breakdown rows.
  t_pos_shift_gl.py 7 failures are identical on clean HEAD - pre-existing, unrelated to ShiftClose.

Recommendation:
  Update t_pos_shift_gl.py separately to remove hardcoded id values from ShiftOpen() calls.

## 10. Known Limitations

- CashDenominations TypeScript interface in types.ts retains coins as UI state field.
  The backendDenominations translation must be maintained on every API submission.
- t_pos_shift_gl.py is broken due to an unrelated ShiftOpen validator. Pre-existing.

## 11. Future Work

- Update t_pos_shift_gl.py: stop passing id to ShiftOpen() (separate task, requires sign-off).
- Consider adding extra=forbid to ShiftClose schema to surface future drift as 422 not silent drop.
- Consider renaming CashDenominations.coins to coins_total in types.ts to remove translation step.

## 12. Related ADRs

- ADR: FastAPI + Postgres Sole Backend Architecture (AGENTS.md Rule 1)
- ADR: Frontend must align to backend schema, not vice versa (AGENTS.md Rule)

## 13. Related RFCs

- RFC: SMRITI Backend System-of-Record Policy (AGENTS.md 2026-07-12)
- RFC: SMRITI Human-Readable Error Policy
