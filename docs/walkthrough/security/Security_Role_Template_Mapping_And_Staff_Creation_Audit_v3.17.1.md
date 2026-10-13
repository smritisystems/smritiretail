<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.1
  Created      : 2026-10-13
  Modified     : 2026-10-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Role Template Mapping & Staff Creation Deep Audit & Remediation v3.17.1

## 1. Purpose
To deliver a deep forensic audit and permanent technical remediation of user and staff creation across SMRITI Retail OS. Specifically, addressing why user creation historically succeeded when assigning the **Cashier** role while failing or generating errors for other roles (Store Manager, Branch Admin, HR Executive, Accountant, etc.), and eliminating runtime exceptions during role assignments and profile updates.

## 2. Scope
- **Backend Service Layer (`backend/app/services/user.py`):**
  - Eliminated `NameError` crash in `update_staff_user` caused by out-of-scope `role_to_id` reference.
  - Consolidated role ID lookup into a centralized, module-level dictionary `ROLE_ENUM_TO_ID` covering all 14 `UserRole` enums.
  - Ensured consistent auto-assignment of predefined system role IDs when `role_id` is omitted in both creation and update flows.
- **Database Schema & Seeding (`smritisys.roles`):**
  - Audited all 15 system roles in the control database `smritisys`.
  - Created and executed Alembic migration `v1528_canonical_role_permissions_remediation.py` upgrading legacy dot-notation permissions (e.g. `staff.manage`, `pos.sell`) to canonical `resource.ACTION` notation (`staff_mgmt.CREATE`, `staff_mgmt.VIEW`).
  - Preserved Phase 1E RBAC R-3 Option B architectural requirement where both `role-sales-executive` (scoped) and `role-sales_executive` (legacy seed wildcard) remain present and active.
- **Security & Authorization (`security_matrix.py`):**
  - Confirmed the root cause of why Cashier creation appeared to succeed while other roles were blocked: creation callers (`SYSADMIN` / `MANAGER`) have implicit `staff_mgmt.CREATE` permission, but non-MANAGER callers were blocked because role templates carried legacy dot-notation permissions that failed the `security_matrix.evaluate_action_permission` gate.
- **Automated Verification:**
  - Pytest RBAC suite (`backend/tests/t_rbac_roles.py`): 20/20 passed.
  - Vitest user creation suite (`src/tests/userStaffCreation.test.ts`): 17/17 passed.
  - End-to-end multi-role verification script: 14/14 `UserRole` enums created and verified, plus role update verified.

## 3. Files Created
- `backend/alembic/versions/v1528_canonical_role_permissions_remediation.py` — Alembic database migration synchronizing system roles to canonical permissions format on control database `smritisys`.
- `docs/implementation/security/Security_Role_Template_Mapping_And_Staff_Creation_Audit_Plan_v3.17.1.md` — Formal 19-section implementation plan.
- `docs/walkthrough/security/Security_Role_Template_Mapping_And_Staff_Creation_Audit_v3.17.1.md` — This walkthrough document.

## 4. Files Modified
- `backend/app/services/user.py` — Defined `ROLE_ENUM_TO_ID` module dictionary; wired into `create_staff_user` and `update_staff_user`; bumped header to v3.17.1.
- `docs/implementation/README.md` — Appended implementation plan to master index.
- `docs/walkthrough/README.md` — Appended walkthrough to master index.
- `CHANGELOG.md` — Updated with audit findings and resolution log.

## 5. Architecture Decisions
- **AD-01: Module-Scope Canonical Role Map (`ROLE_ENUM_TO_ID`):** Rather than repeating role ID lookups across multiple methods or relying on local dictionary instantiations, a single module-level dictionary defines the 1-to-1 canonical relationship between `UserRole` enums and system role IDs in `roles`.
- **AD-02: Strict Adherence to Phase 1E RBAC R-3 Option B:** The legacy wildcard seed role `role-sales_executive` (with underscore) is retained untouched alongside `role-sales-executive` (with hyphen) to maintain test contract compliance in `t_rbac_roles.py` Scenario M. Newly created sales staff are deterministically assigned the scoped `role-sales-executive`.
- **AD-03: Canonical Security Matrix Permission Format:** System roles in PostgreSQL must store permissions matching `security_matrix.evaluate_action_permission` expectations (`<resource>.<ACTION>`), ensuring role-based evaluation succeeds without requiring global SYSADMIN bypasses.

## 6. Design Rationale
In retail operations, users are created by managers who already hold `SYSADMIN` or `MANAGER` credentials. When creating a `CASHIER`, the operation succeeded because:
1. The creator had sufficient authorization.
2. The `role_to_id` mapping in `create_staff_user` resolved `UserRole.CASHIER` -> `role-cashier`.
3. Cashiers have well-defined, minimal operational permissions.

However, issues surfaced in two distinct scenarios:
1. **Role Update Scenario:** When an existing staff member's role was changed in `update_staff_user`, Python raised `NameError: name 'role_to_id' is not defined` because `role_to_id` was only defined locally in `create_staff_user`.
2. **Delegated Creation Scenario:** When a non-MANAGER administrative user (e.g., HR Executive, Branch Admin) attempted to manage or provision staff, the backend endpoint dependency `require_permission("staff_mgmt", "CREATE")` failed with HTTP 403 because their stored role permissions contained legacy dot-notation (`staff.manage`) instead of `staff_mgmt.CREATE`.

Fixing both defects establishes a cohesive, robust RBAC and user lifecycle pipeline.

## 7. Implementation Summary
1. **Module Level Role Mapping:**
   In `backend/app/services/user.py`, established `ROLE_ENUM_TO_ID`:
   ```python
   ROLE_ENUM_TO_ID: dict = {
       UserRole.SYSADMIN: "role-sysadmin",
       UserRole.ADMIN: "role-admin",
       UserRole.MANAGER: "role-manager",
       UserRole.STORE_MANAGER: "role-store-manager",
       UserRole.BRANCH_ADMIN: "role-branch-admin",
       UserRole.INVENTORY_MANAGER: "role-inventory-manager",
       UserRole.PURCHASE_EXECUTIVE: "role-purchase-executive",
       UserRole.SALES_EXECUTIVE: "role-sales-executive",
       UserRole.CASHIER: "role-cashier",
       UserRole.ACCOUNTANT: "role-accountant",
       UserRole.AUDITOR: "role-auditor",
       UserRole.HR_EXECUTIVE: "role-hr-executive",
       UserRole.REPORT_USER: "role-report-user",
       UserRole.VIEWER: "role-viewer",
   }
   ```
2. **Wired into `create_staff_user` and `update_staff_user`:**
   - In `create_staff_user`: `assigned_role_id = req.role_id or req.roleId or ROLE_ENUM_TO_ID.get(req.role)`
   - In `update_staff_user`: `user.role_id = req.role_id or req.roleId or ROLE_ENUM_TO_ID.get(req.role, user.role_id)`
3. **Database Migration v1528:**
   - Ran `alembic -x target=control -x db=smritisys upgrade head` to align control database system roles to canonical `resource.ACTION` permissions array.

## 8. Tests Executed
```powershell
# 1. Pytest RBAC test suite
pytest backend/tests/t_rbac_roles.py

# 2. Vitest User and Staff Creation test suite
npx vitest run src/tests/userStaffCreation.test.ts --reporter=verbose

# 3. End-to-end multi-role verification script
python scratch/verify_all_roles_creation.py
```

## 9. Verification Results
### Literal Terminal Test Outputs

#### A. Pytest RBAC Suite (`backend/tests/t_rbac_roles.py`)
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 20 items

backend\tests\t_rbac_roles.py ....................                       [100%]

====================== 20 passed, 20 warnings in 25.20s =======================
```

#### B. Vitest Frontend Suite (`src/tests/userStaffCreation.test.ts`)
```text
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/userStaffCreation.test.ts > User & Staff Creation Suite v6.72.0 > Password Policy Security Verification > should reject passwords shorter than 8 characters 2ms
 ✓ src/tests/userStaffCreation.test.ts > User & Staff Creation Suite v6.72.0 > Password Policy Security Verification > should reject passwords without uppercase letter 0ms
 ✓ src/tests/userStaffCreation.test.ts > User & Staff Creation Suite v6.72.0 > Password Policy Security Verification > should reject passwords without lowercase letter 0ms
 ✓ src/tests/userStaffCreation.test.ts > User & Staff Creation Suite v6.72.0 > Password Policy Security Verification > should reject passwords without numeric digit 0ms
 ✓ src/tests/userStaffCreation.test.ts > User & Staff Creation Suite v6.72.0 > Password Policy Security Verification > should reject passwords without special character 0ms
 ✓ src/tests/userStaffCreation.test.ts > User & Staff Creation Suite v6.72.0 > Password Policy Security Verification > should accept compliant temporary password 0ms
 ✓ src/tests/userStaffCreation.test.ts > User & Staff Creation Suite v6.72.0 > Password Policy Security Verification > should accept high-entropy complex passwords 0ms
 ✓ src/tests/userStaffCreation.test.ts > User & Staff Creation Suite v6.72.0 > Role Normalization Verification > should normalize lowercase role 'cashier' to 'CASHIER' 0ms
 ✓ src/tests/userStaffCreation.test.ts > User & Staff Creation Suite v6.72.0 > Role Normalization Verification > should normalize 'admin' to 'SYSADMIN' 0ms
 ✓ src/tests/userStaffCreation.test.ts > User & Staff Creation Suite v6.72.0 > Role Normalization Verification > should normalize shorthand 'store' to 'STORE_MANAGER' 0ms
 ✓ src/tests/userStaffCreation.test.ts > User & Staff Creation Suite v6.72.0 > Role Normalization Verification > should normalize shorthand 'purchase' to 'PURCHASE_EXECUTIVE' 0ms
 ✓ src/tests/userStaffCreation.test.ts > User & Staff Creation Suite v6.72.0 > Role Normalization Verification > should normalize shorthand 'sales' to 'SALES_EXECUTIVE' 0ms
 ✓ src/tests/userStaffCreation.test.ts > User & Staff Creation Suite v6.72.0 > Role Normalization Verification > should normalize shorthand 'account' to 'ACCOUNTANT' 0ms
 ✓ src/tests/userStaffCreation.test.ts > User & Staff Creation Suite v6.72.0 > Role Normalization Verification > should normalize shorthand 'hr' to 'HR_EXECUTIVE' 0ms
 ✓ src/tests/userStaffCreation.test.ts > User & Staff Creation Suite v6.72.0 > Payload Construction & Human-Readable Error Formatting > should assemble canonical POST /users/ payload with trimmed strings 1ms
 ✓ src/tests/userStaffCreation.test.ts > User & Staff Creation Suite v6.72.0 > Payload Construction & Human-Readable Error Formatting > should omit empty email as undefined in payload 0ms
 ✓ src/tests/userStaffCreation.test.ts > User & Staff Creation Suite v6.72.0 > Payload Construction & Human-Readable Error Formatting > should format user-friendly duplicate credential errors 0ms

 Test Files  1 passed (1)
      Tests  17 passed (17)
   Start at  05:51:34
   Duration  340ms (transform 39ms, setup 0ms, import 59ms, tests 9ms, environment 0ms)
```

#### C. End-to-End Multi-Role Creation Verification
```text
======================================================================
VERIFICATION: Testing User Creation for all 14 UserRole enums
======================================================================
  [PASS] Created SYSADMIN             -> id=usr-fdd6fdf6 username=test_sysadmin_ec54        role=UserRole.SYSADMIN role_id=role-sysadmin (matches expected: True)
  [PASS] Created ADMIN                -> id=usr-82539478 username=test_admin_35a1           role=UserRole.SYSADMIN role_id=role-sysadmin (matches expected: True)
  [PASS] Created MANAGER              -> id=usr-4067ac2d username=test_manager_5571         role=UserRole.MANAGER role_id=role-manager (matches expected: True)
  [PASS] Created STORE_MANAGER        -> id=usr-3e785af6 username=test_store_manager_cbb5   role=UserRole.STORE_MANAGER role_id=role-store-manager (matches expected: True)
  [PASS] Created BRANCH_ADMIN         -> id=usr-9fd231d8 username=test_branch_admin_bd85    role=UserRole.BRANCH_ADMIN role_id=role-branch-admin (matches expected: True)
  [PASS] Created INVENTORY_MANAGER    -> id=usr-ffbadc49 username=test_inventory_manager_e33f role=UserRole.INVENTORY_MANAGER role_id=role-inventory-manager (matches expected: True)
  [PASS] Created PURCHASE_EXECUTIVE   -> id=usr-b3718e15 username=test_purchase_executive_c548 role=UserRole.PURCHASE_EXECUTIVE role_id=role-purchase-executive (matches expected: True)
  [PASS] Created SALES_EXECUTIVE      -> id=usr-16091dbc username=test_sales_executive_9fe8 role=UserRole.SALES_EXECUTIVE role_id=role-sales-executive (matches expected: True)
  [PASS] Created CASHIER              -> id=usr-d805d5a7 username=test_cashier_a01d         role=UserRole.CASHIER role_id=role-cashier (matches expected: True)
  [PASS] Created ACCOUNTANT           -> id=usr-22d5a5ad username=test_accountant_49b0      role=UserRole.ACCOUNTANT role_id=role-accountant (matches expected: True)
  [PASS] Created AUDITOR              -> id=usr-164b70a3 username=test_auditor_0a9f         role=UserRole.AUDITOR role_id=role-auditor (matches expected: True)
  [PASS] Created HR_EXECUTIVE         -> id=usr-71cce437 username=test_hr_executive_7eb5    role=UserRole.HR_EXECUTIVE role_id=role-hr-executive (matches expected: True)
  [PASS] Created REPORT_USER          -> id=usr-65756921 username=test_report_user_ac01     role=UserRole.REPORT_USER role_id=role-report-user (matches expected: True)
  [PASS] Created VIEWER               -> id=usr-09413530 username=test_viewer_c02b          role=UserRole.VIEWER role_id=role-viewer (matches expected: True)

======================================================================
VERIFICATION: Testing Staff User Update (Role change & role_to_id fix)
======================================================================
  [PASS] Updated user usr-fdd6fdf6 to STORE_MANAGER -> role=UserRole.STORE_MANAGER, role_id=role-store-manager

Cleaning up test users...
Cleanup completed.

======================================================================
FINAL RESULT: ALL PASSED
======================================================================
```

## 10. Known Limitations
- The system intentionally normalizes incoming role string `"ADMIN"` to `UserRole.SYSADMIN` per SMRITI architecture standards, mapping to `role-sysadmin`.
- Custom tenant roles (created via `/api/v1/roles`) must be explicitly supplied with their generated `role_id` string during creation if a non-system role template is desired.

## 11. Future Work
- Add custom role dropdown selector in `StaffMasterWs.tsx` modal dynamically populating from `/api/v1/roles` for tenants with specialized granular roles.
- Introduce audit logging for individual permission modifications made to custom roles.

## 12. Related ADRs
- `ADR-004`: Predefined Global System Roles vs. Tenant-Scoped Custom Roles.
- Phase 1E RBAC R-3 Option B: Coexistence of scoped and seed sales roles.

## 13. Related RFCs
- `RFC-089`: Unified User Management & Identity Synchronization.
