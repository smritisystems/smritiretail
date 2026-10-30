<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.1.0
  Created      : 2026-10-15
  Modified     : 2026-10-15
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Muster Roll & Wages Navigation Remediation Walkthrough v1.1.0

## 1. Purpose
Expose the existing Muster Roll, Attendance, and Wage Reconciliation capabilities through a dedicated, role-controlled workspace without duplicating existing business logic, database tables, or backend computation engines. Enable direct navigation from the Fiori Launchpad, canonical menu routing, and the Staff 360 workspace.

## 2. Scope
- First-class Launchpad tile: `muster-roll` ("Muster Roll & Workforce Wages") with roles `["MANAGER", "SYSADMIN"]`.
- Direct entry into Monthly Muster Roll (`initialSection="muster_roll"`) and Wages (`initialSection="wages"`).
- Canonical routing aliases in `TabRenderer.tsx` and registration in `layout_store.tsx` and `navigationResolver.ts`.
- Breadcrumb trail registration in `BreadcrumbRegistry.ts` (`"muster-roll": "staff-management"`).
- Staff 360 toolbar quick action button and Attendance tab link in `StaffMasterWs.tsx`.
- Sticky table columns and header rows for horizontal 31-day grid navigation in `AttendanceWorkspaceTab.tsx`.

## 3. Files Created
None (surgical remediation of existing navigation layer).

## 4. Files Modified
- `src/components/hr/AttendanceWorkspaceTab.tsx`
- `src/components/shell/TabRenderer.tsx`
- `src/components/launchpad/launchpadCatalog.ts`
- `src/layout_engine/layout_store.tsx`
- `src/navigation/breadcrumb/BreadcrumbRegistry.ts`
- `src/components/shell/navigationResolver.ts`
- `src/components/StaffManagementTab.tsx`
- `src/components/staff/StaffMasterWs.tsx`
- `src/tests/menuRegistryRouting.test.ts`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
- **Reuse Existing Attendance Workspace Component**: Reused `AttendanceWorkspaceTab` rather than duplicating attendance logic or creating parallel masters.
- **Parametric Initial Section**: Added `initialSection?: "register" | "muster_roll" | "wages" | "corrections" | "summary"` to `AttendanceWorkspaceTabProps` and bound it to reactive section state via `useEffect`.
- **Zero Database Schema Changes**: Reused existing tables (`attendance_records`, `employee_salary_structures`, `monthly_wage_sheets`, `wage_payout_items`) with zero migration requirements.

## 6. Design Rationale
- Operators navigating from the Launchpad tile or Staff 360 expect to immediately land on the Monthly Muster Roll (Form II) view or Wages sheet without extra clicks.
- Horizontally scrolling a 31-day table requires sticky frozen employee columns (`sticky left-0`) and sticky top headers (`sticky top-0`) to maintain context on smaller laptops and tablets.
- Role gates (`MANAGER`, `SYSADMIN`) match statutory labor compliance access standards.

## 7. Implementation Summary
1. **Launchpad Integration**: Registered tile `muster-roll` under `"System & Operations"` with icon `view_timeline` and restricted roles `["MANAGER", "SYSADMIN"]`. Validated via `validate-launchpad-registry.mjs` (53/53 tiles valid).
2. **Tab Routing & Aliases**: Added aliases `menu-muster-roll`, `muster-roll`, `muster`, `hr-muster-roll` -> `muster-roll` and `menu-wages`, `wages`, `payroll`, `wage-reconciliation` -> `wages`. Added respective tab rendering branches with `initialSection="muster_roll"` and `initialSection="wages"`.
3. **Staff 360 Quick Links**: Added `onNavigate` handler in `StaffManagementTabProps` and `StaffMasterWsProps`. Added `#staff-muster-roll-btn` in header toolbar and `#staff-tab-muster-roll-btn` in Attendance tab.
4. **Breadcrumb Engine**: Registered parent override in `BreadcrumbRegistry.ts` mapping `muster-roll` to `staff-management`.
5. **Sticky Grid UX**: Enhanced `AttendanceWorkspaceTab.tsx` with `sticky top-0 z-20` on header rows and `sticky left-0 top-0 z-30` on the fixed employee column corner.

## 8. Tests Executed
1. `node scripts/validate-launchpad-registry.mjs`: Validated catalog tile count and App route mapping.
2. `npx vitest run src/tests/menuRegistryRouting.test.ts`: Tested canonical 39 menu IDs and muster-roll/wages route resolution.
3. `npx vitest run src/tests/staffAttendance.integration.test.ts`: Verified 40 staff attendance integration specs.
4. `npx tsc --noEmit`: Executed complete project TypeScript type checking.
5. `.\.venv\Scripts\pytest.exe backend/app/tests/test_muster_roll_and_wage_engine.py -v`: Verified 7 backend wage engine and muster roll tests.
6. `python scripts/ci_ux_field_governance_guard.py`: Checked field registry invariants and physical DB reconciliation.

## 9. Verification Results
- `validate-launchpad-registry.mjs`: PASSED (53 unique catalog tiles, all mapped).
- `menuRegistryRouting.test.ts`: PASSED (4/4 tests green in 3.70s).
- `staffAttendance.integration.test.ts`: PASSED (40/40 tests green in 393ms).
- `tsc --noEmit`: PASSED (0 errors).
- `pytest test_muster_roll_and_wage_engine.py`: PASSED (7/7 tests green in 46.14s).
- `ci_ux_field_governance_guard.py`: PASSED (0 critical/error violations).

## 10. Known Limitations
- The underlying attendance and wage records depend on PostgreSQL connection to port 2781. If disconnected, fallback states are shown.

## 11. Future Work
- Add dedicated sub-section deep-linking for Wage Finalization and Bank Payout Export directly from Launchpad parameters.

## 12. Related ADRs
- `ADR-HR-001`: Staff & Human Resources Domain Architecture
- `ADR-UI-012`: Fiori Launchpad Governance & Catalog Registry Policy

## 13. Related RFCs
- `RFC-HR-WAGES-001`: Statutory Form II Muster Roll & Monthly Wage Reconciliation Engine
