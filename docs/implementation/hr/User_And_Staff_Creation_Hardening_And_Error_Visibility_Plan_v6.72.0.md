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

# Implementation Plan: User & Staff Creation Hardening, Tenant Resolution & Error Visibility v6.72.0

## 1. Objective
Resolve critical obstacles in system user and staff profile creation across SMRITI Retail OS, eliminating silent failure modes where operations fail without end-user error feedback, ensuring robust multi-tenant branch code resolution, wiring the missing "New User" modal in Security Management, and establishing strict compliance with the SMRITI Human-Readable Error Policy (HREP).

## 2. Business Motivation
Store administrators, human resource managers, and system auditors cannot onboard new store cashiers, sales staff, or backend users without reliable, immediate error feedback. When creation fails silently (due to unlinked toast callbacks, rigid branch primary key lookups, or unhandled database conflicts), store operations are stalled and operators are left without guidance. Providing immediate inline validation, proactive password policy feedback, and resilient branch resolution ensures smooth workforce onboarding and audit compliance.

## 3. Scope
- **Backend Schema (`backend/app/schemas/user.py`):** Add role normalization field validator to `StaffUserCreate` accepting uppercase, lowercase, and shorthand role aliases.
- **Backend Service (`backend/app/services/user.py`):** Harden branch lookup in `create_staff_user` and `create_user` to support both `Branch.id` and `Branch.code` with canonical alias resolution (`normalize_branch_value`) and company default branch fallback. Wrap database commit in `try...except IntegrityError` to return clear business conflict guidance.
- **Frontend App Shell (`src/components/shell/TabRenderer.tsx`):** Forward `onNotification={addNotification}` to `StaffManagementTab`.
- **Frontend Staff 360 Workspace (`src/components/staff/StaffMasterWs.tsx`):** Add in-dialog error alert banner state and visual feedback for password policy and network rejections in the Create Staff modal.
- **Frontend Security Users View (`src/components/security/UsersView.tsx`):** Implement the missing `CreateUserModal` connected to the `+ New User` button with validation and server synchronization.
- **Automated Verification:** Comprehensive test suites in `src/tests/userStaffCreation.test.ts` and backend pytest suite validating role normalization, branch resolution, duplicate integrity protection, and error propagation.

## 4. Current State
- `TabRenderer.tsx` mounts `<StaffManagementTab currentUser={currentUser} />` without passing `onNotification`. Any `onNotification?.(...)` invocation in `StaffMasterWs.tsx` silently evaluates to `undefined`.
- `StaffMasterWs.tsx` Create Staff modal has no local error alert banner, leaving operators with no indication of why creation failed or which password policy rules were violated.
- `UsersView.tsx` line 245 has a dead `<button><Plus size={14} /> New User</button>` with no `onClick` handler and no modal form.
- `UserService.create_staff_user` attempts `select(Branch).where(Branch.id == branch_id)`. When the default `'MAIN'` branch code is sent, it fails to match primary key `'BR-MAIN-001'`, throwing HTTP 400.
- `StaffUserCreate` lacks `@field_validator("role", mode="before")`, causing lowercase roles from web forms to fail with HTTP 422.
- `UserService.create_staff_user` does not catch `IntegrityError` on commit, surfacing unhandled database exceptions as generic `SMRITI-DATA-001` errors.

## 5. Gap Analysis
| Component | Existing Behavior | Target Behavior |
|---|---|---|
| `TabRenderer.tsx` | `onNotification` omitted | `onNotification={addNotification}` passed to `StaffManagementTab` |
| `StaffMasterWs.tsx` modal | Silent failure on regex/API reject | High-visibility inline error alert banner + toast notification |
| `UsersView.tsx` | Dead `+ New User` button | Interactive `CreateUserModal` with role selection, validation & API dispatch |
| `UserService.create_staff_user` | Strict `Branch.id` PK match | Dual `Branch.id` and `Branch.code` matching with canonical normalization & company fallback |
| `StaffUserCreate` schema | Exact uppercase enum required | Normalizes uppercase/lowercase/shorthand roles gracefully |
| `UserService` commit | Raw `IntegrityError` uncaught | Intercepted with friendly business message `SMRITI-VAL-001` / `400 Bad Request` |

## 6. Architecture Impact
- **Non-Breaking Extension:** Preserves all existing REST APIs, schemas, and database constraints.
- **Multi-Tenant Parity:** Ensures that branch codes (`MAIN`, `BR-MAIN-001`) resolve consistently across control plane and store tenants.
- **HREP Compliance:** Guarantees that every user-facing failure produces clear, actionable guidance.

## 7. Proposed Design
1. **Schema Layer:** Add `@field_validator("role", mode="before")` on `StaffUserCreate` in `user.py`.
2. **Service Layer:** Enhance `UserService` branch queries to test `or_(Branch.id == candidate, Branch.code == candidate, Branch.id == canonical, Branch.code == canonical)`. Catch `IntegrityError` on commit and return user-friendly conflict messages.
3. **UI Shell Layer:** Wire `onNotification={addNotification}` in `TabRenderer.tsx`.
4. **Staff UI Layer:** Introduce `createError` state and alert banner in `StaffMasterWs.tsx` modal.
5. **Security UI Layer:** Build `CreateUserModal` in `UsersView.tsx` with role options, password policy enforcement, and API dispatch.

## 8. Files Created
- `docs/implementation/hr/User_And_Staff_Creation_Hardening_And_Error_Visibility_Plan_v6.72.0.md`
- `docs/walkthrough/hr/User_And_Staff_Creation_Hardening_And_Error_Visibility_v6.72.0.md`
- `src/tests/userStaffCreation.test.ts`

## 9. Files Modified
- `backend/app/schemas/user.py`
- `backend/app/services/user.py`
- `src/components/shell/TabRenderer.tsx`
- `src/components/staff/StaffMasterWs.tsx`
- `src/components/security/UsersView.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- FastAPI `HTTPException`
- SQLAlchemy `or_`, `select`, `IntegrityError`
- React hooks (`useState`, `useCallback`, `useMemo`)
- Lucide React iconography (`AlertCircle`, `Plus`, `X`, `CheckCircle2`)

## 11. Risks
- Risk: Loose branch matching might assign wrong branch if codes collide across companies.
- Mitigation: Branch query enforces `Branch.company_id == comp_id` and `Branch.is_deleted == False`.

## 12. Rollback Strategy
Revert atomic commit `git revert <commit-hash>`. The database schema is unchanged, ensuring zero rollback data migration friction.

## 13. Verification Plan
1. Vitest test suite executing password validation, error display states, and API payload creation.
2. Backend pytest validating role normalization, branch resolution, and duplicate handling.
3. TypeScript `npx tsc --noEmit` clean compile.

## 14. Test Plan
- Test case 1: Lowercase role `"cashier"` normalized to `UserRole.CASHIER`.
- Test case 2: Default branch `'MAIN'` resolves correctly to `'BR-MAIN-001'`.
- Test case 3: Duplicate username triggers clear 400 error.
- Test case 4: Password policy checks reject weak passwords with descriptive error text.
- Test case 5: Create staff modal displays inline error banner.
- Test case 6: Security UsersView opens New User modal and dispatches creation request.

## 15. Documentation Impact
- Update `docs/implementation/README.md`
- Create `docs/walkthrough/hr/User_And_Staff_Creation_Hardening_And_Error_Visibility_v6.72.0.md`
- Update `docs/walkthrough/README.md`
- Add entry to `CHANGELOG.md` under `[6.72.0]`

## 16. Deployment Plan
Commit and push to `smritiNX` branch. Changes are immediately available in frontend bundles and FastAPI application.

## 17. Status
Completed

## 18. Related ADRs
- ADR-HR-001: Staff 360 Canonical Architecture
- ADR-SEC-004: Role-Based Access Control and Permission Action Enforcement

## 19. Related Walkthroughs
- `docs/walkthrough/hr/Staff_Attendance_UX_UI_And_Database_Wiring_Walkthrough_v1.0.0.md`
- `docs/walkthrough/hr/User_And_Staff_Creation_Hardening_And_Error_Visibility_v6.72.0.md`
