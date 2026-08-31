<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.95.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Employee Shift Management & Commission Calculation Engine (v1.0.0-GA)

## 1. Purpose
Documents the implementation of the Shift Management & Commission Engine — shift roster management with clock-in/out, break tracking, overtime computation, and a 4-tier commission matrix (BRONZE/SILVER/GOLD/PLATINUM) with base rate + incentive bonus above configurable sales thresholds.

## 2. Scope
- `ShiftEngine` covering shift creation, clock-in/out (with late arrival detection), break start/end with duration tracking, overtime calculation, and commission computation.
- `ShiftCommissionStudioModal` with 3-tab view: Roster (shift KPIs + pay summary), Team Commission summary (incentive progress bars), and Tier Reference.
- 4 commission tiers with ascending rates and thresholds.
- 6 shift statuses: SCHEDULED, CLOCKED_IN, ON_BREAK, CLOCKED_OUT, ABSENT, HALF_DAY.

## 3. Files Created
- `src/utils/shiftEngine.ts`
- `src/components/hrm/ShiftCommissionStudioModal.tsx`
- `src/tests/shiftEngine.test.ts`
- `docs/implementation/hrm/Shift_Management_Commission_Engine_v1.0.0.md`
- `docs/walkthrough/hrm/Shift_Management_Commission_Engine_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Order-up-to-max commission model**: Base rate applied to all sales; incentive rate applied only to the delta above the tier threshold — preventing cliff effects at tier boundaries.
2. **Overtime at 1.5× rate**: Standard Indian Shops & Establishments Act overtime multiplier applied to hours beyond 8 per shift.
3. **HALF_DAY auto-classification**: If `hoursWorked < 4` on clock-out, status auto-sets to HALF_DAY, enabling attendance policy enforcement without manual supervisor override.
4. **Break duration tracking**: Each `BreakRecord` captures `startAt`, `endAt`, and computed `durationMinutes` — deducted from gross hours worked for accurate net hours calculation.

## 6. Design Rationale
Commission-based retail staff motivation requires real-time visibility into earnings. The 3-tab studio modal lets both associates and managers see current shift status, running commission totals, and how far they are from the incentive threshold — driving sales behaviour during the shift.

## 7. Implementation Summary
- `ShiftEngine.createShift()`: Builds a SCHEDULED shift with deterministic `shiftId`.
- `ShiftEngine.clockIn()`: Records `clockInAt`, computes `lateMinutes`.
- `ShiftEngine.clockOut()`: Computes net `hoursWorked` (gross minus breaks), `overtimeHours`, `earlyDepartureMinutes`, auto-sets HALF_DAY if < 4 hours.
- `ShiftEngine.startBreak() / endBreak()`: Manages `BreakRecord` list with duration computation.
- `ShiftEngine.calculateCommission()`: Computes `baseCommission`, `incentiveBonus`, `basePay` (standard + 1.5× overtime), and `totalPay`. Returns per-invoice `breakdown`.

## 8. Tests Executed
```bash
npm test
```

## 9. Verification Results
- **`src/tests/shiftEngine.test.ts`**: 4/4 tests passed.
- **Total Frontend Suite**: 66/66 test files, 436/436 tests green in 9.76s.

## 10. Known Limitations
- Shift records are in-memory; production persists to `employee_shifts` and `shift_breaks` Postgres tables.
- Sales attributions are manually associated; production queries `sales_invoices` with `salesperson_id` FK.
- Commission disbursement to payroll (salary slip generation) is a future integration.

## 11. Future Work
- FastAPI `POST /api/v1/shifts/clock-in`, `POST /api/v1/shifts/clock-out` with device fingerprint + IP logging.
- Payroll integration: auto-generate monthly salary slip from shift hours + commission totals.
- Branch-level leaderboard with real-time sales ranking during shift.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-029`: Employee Commission Tier Architecture and Overtime Policy.

## 13. Related RFCs
- `RFC-098`: Commission Tier Rate Matrix, Incentive Threshold Policy, and Overtime Calculation Standard.
