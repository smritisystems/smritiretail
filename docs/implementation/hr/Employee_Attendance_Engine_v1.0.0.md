<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Employee Attendance & Commission Engine (v1.0.0)

## 1. Objective
Establish the foundational calculation engine and user interface for employee attendance tracking, leave recording, tiered commission slab calculation, and monthly payroll payout summaries.

## 2. Business Motivation
Automate attendance records and retail sales commission calculations to streamline staff management, enforce statutory compliance, and eliminate payroll inaccuracies.

## 3. Scope
- Calculation engine: `src/utils/employeeAttendanceEngine.ts`.
- Modal UI: `src/components/hr/EmployeeAttendanceModal.tsx`.
- Unit tests: `src/tests/employeeAttendanceEngine.test.ts`.

## 4. Current State
Previous attendance tracking relied on manual physical registers with separate spreadsheet-based commission calculations.

## 5. Gap Analysis
Absence of automated clock-in/out hour calculation, lack of marginal commission tier breakdown, and manual loss-of-pay (LOP) deductions.

## 6. Architecture Impact
Introduces pure calculation utility `EmployeeAttendanceEngine` supporting `FLAT_PCT`, `TIERED`, and `TARGET_BASED` commission schemes.

## 7. Proposed Design
- Pure functions for `clockIn`, `clockOut`, `markAbsent`, `markLeave`.
- Marginal tax-bracket-style slab computation to prevent cliff-edge disincentives.
- Payout calculation applying proportional base salary deduction for unpaid leave and absences.

## 8. Files Created
- `src/utils/employeeAttendanceEngine.ts`
- `src/components/hr/EmployeeAttendanceModal.tsx`
- `src/tests/employeeAttendanceEngine.test.ts`
- `docs/walkthrough/hr/Employee_Attendance_Engine_v1.0.0.md`

## 9. Files Modified
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- React 18
- Vitest

## 11. Risks
Incorrect clock-in time entry leading to inaccurate half-day status. Mitigated by explicit `< 4 hours` threshold logic.

## 12. Rollback Strategy
Remove created engine and modal files.

## 13. Verification Plan
Execute `npm test` verifying clock-in/out, tiered slabs, LOP deductions, and period report aggregation.

## 14. Test Plan
Unit tests covering:
1. `clockIn`/`clockOut` hours worked and half-day detection.
2. Flat commission percentage and target bonus.
3. Marginal tiered slabs with step breakdown.
4. Comprehensive payout calculation with LOP deductions.

## 15. Documentation Impact
Create walkthrough `docs/walkthrough/hr/Employee_Attendance_Engine_v1.0.0.md`.

## 16. Deployment Plan
Commit and push to repository.

## 17. Status
Completed.

## 18. Related ADRs
- `ADR-HR-001`: HR Domain Registration.

## 19. Related Walkthroughs
- [Employee Attendance & Commission Engine v1.0.0](../../walkthrough/hr/Employee_Attendance_Engine_v1.0.0.md)
