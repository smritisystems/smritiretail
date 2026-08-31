<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.121.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Employee Attendance & Commission Tracking Engine (v1.0.0-GA)

## 1. Purpose
Documents the Employee Attendance & Commission Engine — daily attendance with clock-in/out and leave tracking, three commission computation modes (FLAT/TIERED/TARGET), payout calculation with LOP deductions, and period-level reporting across employees.

## 2. Scope
- `EmployeeAttendanceEngine` covering `clockIn()`, `clockOut()`, `markAbsent()`, `markLeave()`, `computeCommission()`, `computePayout()`, `periodReport()`.
- Commission types: FLAT_PCT (flat % on net sales), TIERED (marginal slab), TARGET_BASED (commission only if target hit).
- Payout: `earnedSalary = baseSalary × (effectivePresent / workingDays)`; `lop = unpaidLeave + absent`; `netPayout = gross - lopDeduction`.
- `EmployeeAttendanceModal`: 3-employee sidebar, period report strip, 3-tab (Attendance log, Commission/slab breakdown, Payout line-item).

## 3. Files Created
- `src/utils/employeeAttendanceEngine.ts`
- `src/components/hr/EmployeeAttendanceModal.tsx`
- `src/tests/employeeAttendanceEngine.test.ts`
- `docs/walkthrough/hr/Employee_Attendance_Engine_v1.0.0.md`

## 4. Files Modified
- `docs/walkthrough/README.md`, `docs/implementation/README.md`, `CHANGELOG.md`

## 5. Architecture Decisions
1. **TIERED commission uses a marginal slab model, not a bracket model**: Sales in each slab are taxed only at that slab's rate (like income tax). This prevents cliff-edge disincentives where earning ₹1 more drops take-home pay. `slabBreakdown[]` makes the calculation transparent and auditable.
2. **Half-days count as 0.5 for `earnedSalary`**: `effectivePresent = present - halfDays × 0.5`. This is derived from `hoursWorked < 4` trigger in `clockOut()`. The 4-hour threshold is configurable by changing the `clockOut()` comparison.
3. **LOP = unpaidLeave + absent, not casual/sick leave**: Casual and sick leave are paid leave types — they do not reduce salary. Only UNPAID leave and outright absence trigger LOP deduction.
4. **`computePayout()` is a pure function of `(profile, attendanceRecs[], commission, workingDays)`**: It does not read from a database or call `computeCommission()` internally. This allows the UI to preview payout with a hypothetical commission figure (e.g., updated mid-month net sales).
5. **`periodReport()` computes `avgAttendancePct` as an arithmetic mean across employees**: `Σ(presentDays / workingDays × 100) / n`. This is a simple mean, not a weighted mean — branch managers review individual records for outliers.

## 6. Design Rationale
Commission transparency is a top employee retention factor in retail. The `slabBreakdown[]` field makes every rupee of commission explainable to the employee. LOP automation prevents payroll errors from manual absent tracking. The TARGET_BASED mode is used for department managers where a flat commission would incentivize volume over margin.

## 7. Implementation Summary
- `clockIn()`: Returns new `AttendanceRecord` with status PRESENT, `hoursWorked=0`.
- `clockOut()`: `hours = (outMs - inMs) / 3600000`; status = HALF_DAY if hours < 4; PRESENT otherwise.
- `markAbsent()` / `markLeave()`: Returns record with status ABSENT or LEAVE; `leaveType` stored per record.
- `computeCommission()`: Dispatches on `commissionType`; TIERED iterates slabs with `remaining` counter; TARGET_BASED checks `netSales >= targetAmt` before computing commission; `targetBonusAmt` computed independently of commission type.
- `computePayout()`: `effectivePresent` reduces halfDays by 0.5; `lop = unpaidLeave + absent`; `earnedSalary = base × effectivePresent / workingDays`; `lopDeduction = lop / workingDays × base`; `netPayout = gross - lopDeduction`.
- `periodReport()`: Single-pass sum over `PayoutRecord[]`; `avgAttendancePct = Σ(present/working×100) / n`.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/employeeAttendanceEngine.test.ts`**: 4/4 passed (no patches required).
  - Test 1: clockOut 09:00→18:30 = 9.5h PRESENT; clockOut 09:00→11:00 = 2h HALF_DAY ✓
  - Test 2: FLAT_PCT 1.5% × ₹300,000 = ₹4,500; targetAchievementPct=150%; targetBonus=₹2,500; total=₹7,000; miss (₹150k): bonus=₹0, commission=₹2,250 ✓
  - Test 3: TIERED ₹250k → slab1=₹1,000 + slab2=₹1,500 + slab3=₹1,000 = ₹3,500; slabBreakdown length=3; slab amounts correct ✓
  - Test 4: 22 present + 0.5 half-day + 2 absent + 1 CASUAL + 1 UNPAID; presentDays=22, lop=3 (2+1); earnedSalary ≈ ₹16,923; commission=₹1,500; periodReport headcount=1, avgAttendancePct ≈ 84.6% ✓
- **Total Frontend Suite**: 93/93 test files, 544/544 tests green, exit code 0.

## 10. Known Limitations
- `computeCommission()` does not handle returns/cancellations reducing `netSales` retroactively. Production subtracts approved return amounts from the employee's net sales at month-end before computing commission.
- No shift-differential support: overtime pay or night-shift premiums are not modelled.

## 11. Future Work
- FastAPI `POST /api/v1/attendance/`, `GET /api/v1/attendance/{empId}/period/{period}`, `GET /api/v1/payroll/{period}`.
- Biometric integration: clock-in via fingerprint/face — maps device ID → empId → `clockIn()`.
- Payslip PDF generation via the label print engine.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record. `ADR-055`: Attendance Policy, LOP Calculation Standard, Commission Slab Governance.

## 13. Related RFCs
- `RFC-124`: HR Commission Programme, Target Setting Process, Payroll Integration, and Biometric Attendance Policy.
