<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.45
  Created      : 2026-10-09
  Modified     : 2026-10-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Cross-Database Staff Identity & Attendance Reconciliation (v6.70.45)

## 1. Purpose
This walkthrough documents the architectural hardening and cross-database identity reconciliation implemented to eliminate HTTP 404 (`Not Found`) exceptions when loading or mutating staff attendance and leave records for central directory users (such as `usr-cashier-direct` and `usr-manager-direct`).

## 2. Scope
- Two-tier cross-database user identity resolution between `smritisys` (control plane) and tenant company databases (e.g. `smriti001`).
- Preserving canonical user IDs across database boundaries during auto-provisioning.
- Multi-identifier attendance and leave querying (`in_([user_id, target_user.id])`).
- Frontend defensive error handling and state reset in `StaffMasterWs.tsx`.
- Automated regression suite in `backend/app/tests/test_staff_attendance_cross_db_reconciliation.py`.

## 3. Files Created
- `backend/app/tests/test_staff_attendance_cross_db_reconciliation.py`
- `docs/implementation/hr/Cross_Database_Staff_Identity_And_Attendance_Reconciliation_Plan_v6.70.45.md`
- `docs/walkthrough/hr/Cross_Database_Staff_Identity_And_Attendance_Reconciliation_v6.70.45.md`

## 4. Files Modified
- `backend/app/api/v1/staff.py`
- `src/components/staff/StaffMasterWs.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
- **Decision 1:** The control-plane database (`smritisys.users`) remains the authoritative authority for user authentication and directory identities.
- **Decision 2:** When a valid control-plane identity accesses company-scoped transactional services (such as Attendance or Leave), the backend reconciles and syncs that user into the company database (`company_db.users`), preserving the canonical `id` so that relational foreign key constraints (`ForeignKey("users.id")`) remain valid.
- **Decision 3:** Query endpoints support matching by both the requested ID and any pre-existing local alias, preventing historical data fragmentation.

## 6. Design Rationale
Previously, `_tenant_user` queried only `company_db.users` by `User.id == user_id`. Because seeded accounts like `usr-cashier-direct` and `usr-manager-direct` reside in the control plane, `_tenant_user` immediately threw HTTP 404. Implementing a two-tier resolution guarantees zero-interruption UX while upholding strict multi-tenant boundary isolation.

## 7. Implementation Summary
- **Backend API (`backend/app/api/v1/staff.py`)**:
  - `_resolve_company_local_user`: Reconciles control-plane users by checking both `User.id == control_user.id` and `User.username == control_user.username`. When inserting a missing user, sets `id = control_user.id` rather than generating a disjoint `usr-local-...` UUID.
  - `_tenant_user`: Checks `company_db` first; if absent, checks `control_db` (`smritisys.users`) and calls `_resolve_company_local_user`; if absent, checks by username; otherwise raises HTTP 404.
  - Injected `control_db: AsyncSession = Depends(get_db)` into `list_attendance`, `get_attendance_summary`, `create_attendance`, `record_attendance_punch`, `list_leave_balances`, `list_leave_requests`, and `create_leave_request`.
- **Frontend (`src/components/staff/StaffMasterWs.tsx`)**:
  - Added defensive fallback to reset state arrays and suppress false-positive 404 error toasts when switching to attendance, leave, or assignment tabs for newly created staff.

## 8. Tests Executed
1. `pytest backend/app/tests/test_staff_attendance_cross_db_reconciliation.py -v`:
   - `test_list_attendance_cross_database_resolution` (PASSED)
   - `test_attendance_summary_cross_database_resolution` (PASSED)
   - `test_leave_balances_cross_database_autoseed` (PASSED)
   - `test_punch_attendance_cross_database_resolution` (PASSED)
2. `vitest run src/tests/employeeAttendanceStudio.test.ts src/tests/paymentModeHarmonization.test.ts`:
   - 21/21 tests passed across 2 test files.
3. `tsc --noEmit`:
   - Exited with code 0 (zero compiler errors).
4. `npm run build`:
   - Vite production bundle compiled in 42.95s with code 0.

## 9. Verification Results
All 4 new backend integration tests, 21 frontend vitest tests, and all CI architecture and UX field governance guards passed with 0 errors.

## 10. Known Limitations
None. Cross-tenant isolation is strictly maintained through tenant context validation on both databases.

## 11. Future Work
Add a background sync hook during tenant provisioning to proactively duplicate all active company users into `company_db.users` ahead of time.

## 12. Related ADRs
- `ADR-001`: Multi-Tenant Control Plane vs Company Database Separation.
- `ADR-042`: Canonical HR Ledger & Attendance Identity Policy.

## 13. Related RFCs
- `RFC-2026-HR-04`: Cross-Database Multi-Tenant Identity Harmonization.
