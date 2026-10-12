<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.72.0
  Created      : 2026-10-12
  Modified     : 2026-10-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: User & Staff Creation Hardening, Tenant Resolution & Error Visibility v6.72.0

## 1. Purpose
This walkthrough documents the comprehensive hardening and bug resolution across system user and staff creation in SMRITI Retail OS. It addresses the issue where operators were unable to create new staff or system users and received zero error feedback upon submission, rectifying multi-tenant branch resolution, wiring missing UI dialogs, and enforcing the SMRITI Human-Readable Error Policy (HREP).

## 2. Scope
- **Frontend Notification Wiring:** Passing `onNotification={addNotification}` down from `TabRenderer.tsx` into `StaffManagementTab.tsx` and `StaffMasterWs.tsx`.
- **Frontend In-Modal Error Alerting:** Adding reactive error alert banners directly into the Create Staff modal dialog in `StaffMasterWs.tsx` for real-time validation and server rejection feedback.
- **Frontend Security Users View Wiring:** Implementing the interactive `CreateUserModal` dialog in `UsersView.tsx` and attaching it to the `+ New User` toolbar button.
- **Backend Branch Resolution Hardening:** Upgrading `UserService.create_staff_user` and `UserService.create_user` to resolve branch candidates by both `Branch.id` and `Branch.code` using canonical alias mapping (`normalize_branch_value`) and company default branch fallback.
- **Backend Schema Normalization:** Expanding `StaffUserCreate.normalize_role` to parse uppercase, lowercase, and shorthand role aliases into valid `UserRole` enums.
- **Backend Integrity Protection:** Wrapping database transaction commits in `try...except IntegrityError` to produce clear, actionable duplicate credential messages instead of raw database exceptions.

## 3. Files Created
- `docs/implementation/hr/User_And_Staff_Creation_Hardening_And_Error_Visibility_Plan_v6.72.0.md` — Implementation plan with 19 IPGP sections.
- `docs/walkthrough/hr/User_And_Staff_Creation_Hardening_And_Error_Visibility_v6.72.0.md` — Walkthrough with 13 WGP sections.
- `src/tests/userStaffCreation.test.ts` — 17 unit and integration tests covering password validation, role normalization, payload structure, and error formatting.

## 4. Files Modified
- `src/components/shell/TabRenderer.tsx` — Passed `onNotification={addNotification}` to `<StaffManagementTab />`.
- `src/components/staff/StaffMasterWs.tsx` — Added `createError` state, in-modal error alert banner, and clear error messaging on validation/network failure.
- `src/components/security/UsersView.tsx` — Added `CreateUserModal`, form validation, password policy guidance, and wired the `+ New User` button.
- `backend/app/schemas/user.py` — Added `@field_validator("role", mode="before")` on `StaffUserCreate` supporting lowercase and shorthand roles.
- `backend/app/services/user.py` — Hardened branch queries in `create_staff_user` and `create_user` to match both code and PK with canonical alias resolution; wrapped commit in `IntegrityError` handler.
- `docs/implementation/README.md` — Registered plan in master index table.
- `docs/walkthrough/README.md` — Registered walkthrough in master index table.
- `CHANGELOG.md` — Appended release notes under `[6.72.0]`.

## 5. Architecture Decisions
- **Dual Branch Key Resolution (ADR-HR-002):** In multi-tenant retail POS environments, client applications frequently hold store codes (e.g. `'MAIN'`, `'BANDRA-01'`) rather than internal UUIDs (`'BR-MAIN-001'`). The backend service now checks `or_(Branch.id == candidate, Branch.code == candidate, Branch.id == canonical, Branch.code == canonical)` scoped to the active tenant company, ensuring seamless client-server contract compatibility.
- **Two-Tier Error Delivery (ADR-UI-006):** In modal workflows, toast notifications alone are insufficient if the modal remains open over the application workspace. The system implements a two-tier feedback standard: (1) High-visibility red alert banner directly inside the modal with specific remediation instructions, and (2) Global toast notification for unified workspace telemetry.

## 6. Design Rationale
- Operators previously experienced "silent button clicks" because `onNotification` was `undefined` in `StaffManagementTab.tsx`, causing all `onNotification?.(...)` calls to silently evaluate to `undefined`.
- The `+ New User` button in Security Management had no `onClick` handler, rendering user creation from Security completely inaccessible.
- By providing inline feedback, operators immediately understand specific password policy rules (minimum 8 characters, uppercase, lowercase, digit, special symbol) rather than submitting blindly and wondering why nothing happens.

## 7. Implementation Summary
1. **Frontend App Shell:** Modified `src/components/shell/TabRenderer.tsx` to pass `onNotification={addNotification}` to `StaffManagementTab`.
2. **Staff 360 Workspace:** In `src/components/staff/StaffMasterWs.tsx`, introduced `createError` state, reset handlers, and an inline alert banner in the modal with `AlertCircle` iconography.
3. **Security Users View:** In `src/components/security/UsersView.tsx`, constructed `CreateUserModal` with role dropdown, password policy validation, error banner, and `POST /users/` integration.
4. **Backend Services:** In `backend/app/services/user.py`, replaced rigid primary key branch lookups with canonical code/ID matching, resolved foreign keys safely for `user_branch_assignments`, and wrapped transaction commits in `IntegrityError` rollback handlers.
5. **Backend Schemas:** In `backend/app/schemas/user.py`, unified `StaffUserCreate.normalize_role` to parse lowercase roles and shorthand aliases (`store` -> `STORE_MANAGER`, `purchase` -> `PURCHASE_EXECUTIVE`, `admin` -> `SYSADMIN`).

## 8. Tests Executed
```bash
# 1. Vitest User & Staff Creation Suite
npx vitest run src/tests/userStaffCreation.test.ts
# Output: 17 passed (17) in 347ms

# 2. Vitest Staff Attendance & Shift Integration Suites
npx vitest run src/tests/staffAttendance.integration.test.ts src/tests/staffShift.integration.test.ts
# Output: 69 passed (69) in 595ms

# 3. Backend Verification Script
python scratch/verify_backend.py
# Output:
#   [OK] Schema normalized lowercase 'cashier' -> UserRole.CASHIER
#   [OK] Schema normalized lowercase 'admin' -> UserRole.SYSADMIN
#   [OK] Schema normalized shorthand 'store' -> UserRole.STORE_MANAGER
#   [OK] Created staff with branchId='MAIN': id=usr-3c8eaf7b, role=UserRole.CASHIER
#   [OK] DB user properly mapped to foreign key branch_id='BR-MAIN-001' and company_id='COMP-001'
#   [OK] Duplicate username properly rejected with HTTP 400: 'Username 'test_staff_main_res_01' is already taken.'
#   ALL BACKEND VERIFICATIONS PASSED!

# 4. Full Static Analysis Typecheck
npx tsc --noEmit
# Output: Exit code 0, 0 errors across all modules
```

## 9. Verification Results
- **Password Policy:** 7/7 unit tests verifying length, character class, and special character requirements.
- **Role Normalization:** 7/7 unit tests verifying case-insensitivity and shorthand aliases.
- **Branch Resolution:** Verified in live PostgreSQL session mapping branch code `'MAIN'` to foreign key `'BR-MAIN-001'`.
- **Duplicate Detection:** Verified in live PostgreSQL session rejecting duplicates with business-friendly HTTP 400.
- **Regression Safety:** 69/69 existing staff integration tests passed. Zero TypeScript compilation errors.

## 10. Known Limitations
- When an operator with non-manager/non-sysadmin privileges attempts to create a staff member, the backend strictly enforces `require_permission("staff_mgmt", "CREATE")`. This is by design per SMRITI RBAC governance.

## 11. Future Work
- Add configurable password complexity policies in `SystemParameterService` for enterprise tenants with custom security standards.
- Add bulk user CSV import tool in Security Users View.

## 12. Related ADRs
- ADR-HR-001: Staff 360 Canonical Architecture
- ADR-HR-002: Dual Branch Key Resolution & Canonical Multi-Tenant Mapping
- ADR-UI-006: Two-Tier Modal Error Alerting Standard

## 13. Related RFCs
- RFC-8594: Legacy Header Deprecation Gateway
- RFC-SEC-012: SMRITI RBAC Role Normalization Specification
