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

# Implementation Plan: Role Template Mapping & Staff Creation Deep Audit & Remediation v3.17.1

## 1. Objective
Investigate and permanently remediate why user and staff creation succeeded when assigning the **Cashier** role but encountered authorization blocking (HTTP 403) and runtime crashes (`NameError`) when assigning other roles (Store Manager, Branch Admin, HR Executive, Accountant, etc.) across the database, backend APIs, and role definition layers.

## 2. Business Motivation
In multi-store retail environments, non-SYSADMIN operational administrators (e.g. Branch Admins, Store Managers, HR Executives) must onboard staff across various operational disciplines—including sales associates, accountants, and inventory handlers. When user creation fails or only Cashiers can be provisioned, store setup stalls, branch onboarding is blocked, and operational autonomy breaks down. Establishing unified role mapping and canonical permissions enables reliable workforce management.

## 3. Scope
- **Database (`smritisys.roles`):** Audit all 15 system role definitions, verify foreign key integrity against `users.role_id`, and convert legacy dot-notation permissions into canonical `resource.ACTION` format (`staff_mgmt.CREATE`, `staff_mgmt.VIEW`).
- **Alembic Migration (`backend/alembic/versions/v1528_canonical_role_permissions_remediation.py`):** Author and apply version-controlled migration v1528 on control database `smritisys` upgrading role permissions while strictly adhering to Phase 1E RBAC R-3 Option B (retaining `role-sales_executive` wildcard baseline alongside `role-sales-executive`).
- **Backend Service (`backend/app/services/user.py`):** Define `ROLE_ENUM_TO_ID` canonical lookup at module scope. Fix `update_staff_user` where `role_to_id` was referenced out of scope, eliminating runtime `NameError`.
- **RBAC & Security Matrix (`security_matrix.py` & `deps.py`):** Verify `evaluate_action_permission` requirements for `staff_mgmt.CREATE` across caller roles.
- **Verification & Testing:** Verify creation of all 14 `UserRole` enums and profile updates via automated scripts, Vitest (`userStaffCreation.test.ts`), and Pytest (`t_rbac_roles.py`).

## 4. Current State
- Prior to audit, the system had a critical disparity in caller authorization: `evaluate_action_permission` implicitly grants `staff_mgmt.CREATE` to callers with role `SYSADMIN` and `MANAGER`. For all other caller roles (e.g., HR Executive, Branch Admin), it checks whether their assigned `role_id` possesses `staff_mgmt.CREATE` or `*`.
- In the PostgreSQL `roles` table, system roles had been seeded with legacy dot-notation permissions (such as `staff.manage` instead of `staff_mgmt.CREATE`). As a consequence, non-MANAGER/SYSADMIN callers were rejected with HTTP 403 Forbidden.
- In `backend/app/services/user.py`, `update_staff_user` attempted to look up `role_to_id.get(req.role, user.role_id)`. However, `role_to_id` was defined solely inside `create_staff_user`, triggering a catastrophic `NameError` whenever a staff member's role was modified.
- Two rows existed for `SALES_EXECUTIVE`: `role-sales_executive` (underscore ID with `["*"]`) and `role-sales-executive` (hyphen ID with scoped permissions). Phase 1E RBAC explicitly mandated retaining both under Option B, with automated test coverage in `t_rbac_roles.py` Scenario M.

## 5. Gap Analysis
| Defect / Area | Existing Behavior | Target Canonical Behavior |
|---|---|---|
| **DEFECT-001 (Permissions Format)** | System roles in `roles` table contained legacy dot-notation (`staff.manage`, `pos.sell`) | Seeded with canonical `resource.ACTION` notation (`staff_mgmt.CREATE`, `staff_mgmt.VIEW`, `sales_billing.VIEW`, etc.) |
| **DEFECT-002 (Update Staff Crash)** | `update_staff_user` referenced undefined local variable `role_to_id` causing `NameError` | Module-level `ROLE_ENUM_TO_ID` used across both `create_staff_user` and `update_staff_user` |
| **Role-to-Enum Parity** | Local dictionaries in methods were duplicative and incomplete | Single canonical dictionary `ROLE_ENUM_TO_ID` mapping all 14 `UserRole` enums |
| **Phase 1E Invariant** | Uncoordinated soft-delete risked failing Scenario M in `t_rbac_roles.py` | Both `role-sales_executive` and `role-sales-executive` preserved; `ROLE_ENUM_TO_ID` points to scoped role |
| **Alembic Lineage** | Database was at `v1527_attendance_index_and_device_key` without role migration | Alembic migration `v1528_canonical_role_permissions_remediation` registered and applied to head |

## 6. Architecture Impact
- **Security Matrix Alignment:** Aligning `roles.permissions_json` with `security_matrix.evaluate_action_permission` ensures consistent rule evaluation across all REST API endpoints.
- **Zero Schema Drift:** No column additions or constraint deletions were required; all operations operate within the existing relational schema.
- **Strict Backward Compatibility:** Preserves Phase 1E RBAC R-3 Option B invariants without regressing existing baseline tokens or user sessions.

## 7. Proposed Design
1. **Module-Level Role Map in `user.py`:**
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
2. **Alembic Migration v1528:**
   Apply batch SQL updates to synchronize canonical JSON arrays for `role-store-manager`, `role-branch-admin`, `role-hr-executive`, `role-inventory-manager`, `role-purchase-executive`, `role-sales-executive`, `role-cashier`, `role-accountant`, `role-auditor`, `role-report-user`, and `role-viewer`.

## 8. Files Created
- `backend/alembic/versions/v1528_canonical_role_permissions_remediation.py` — Alembic migration updating role permissions on control database `smritisys`.
- `docs/implementation/security/Security_Role_Template_Mapping_And_Staff_Creation_Audit_Plan_v3.17.1.md` — This implementation plan.
- `docs/walkthrough/security/Security_Role_Template_Mapping_And_Staff_Creation_Audit_v3.17.1.md` — Walkthrough and audit report.

## 9. Files Modified
- `backend/app/services/user.py` — Defined `ROLE_ENUM_TO_ID`, updated `create_staff_user` and `update_staff_user`, bumped UADHP header to v3.17.1.
- `docs/implementation/README.md` — Appended master index table.
- `docs/walkthrough/README.md` — Appended master index table.
- `CHANGELOG.md` — Logged v3.17.1 release notes.

## 10. Dependencies
- PostgreSQL running on port 2781 (control DB `smritisys`).
- Alembic database migration tooling (`alembic -x target=control -x db=smritisys`).
- Python 3.11/3.13 runtime with SQLAlchemy and asyncpg.

## 11. Risks
| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Deletion of legacy wildcard sales role | Low | High | Verified against `t_rbac_roles.py` Scenario M; both roles explicitly retained in DB and code |
| Permission denial during staff creation | Low | Medium | Seeded `staff_mgmt.CREATE` on Branch Admin and HR Executive system roles |
| Runtime NameError during profile update | None | High | Completely resolved by promoting `ROLE_ENUM_TO_ID` to module scope |

## 12. Rollback Strategy
- **Alembic Downgrade:** Run `alembic -x target=control -x db=smritisys downgrade v1527_attendance_index_and_device_key` which executes `LEGACY_ROLE_PERMISSIONS` rollback in `v1528`.
- **Git Reversion:** `git checkout HEAD~1 backend/app/services/user.py`.

## 13. Verification Plan
1. Check Alembic revision state with `alembic current`.
2. Execute `pytest backend/tests/t_rbac_roles.py` to confirm all 20 scenarios (including Scenario M) pass.
3. Execute `npx vitest run src/tests/userStaffCreation.test.ts` to confirm frontend creation and normalization pass.
4. Execute full lifecycle creation script across all 14 `UserRole` enums and staff role updating.

## 14. Test Plan
- **Scenario 1:** Create staff user with role `CASHIER` -> Expect success, `role_id="role-cashier"`.
- **Scenario 2:** Create staff user with role `STORE_MANAGER` -> Expect success, `role_id="role-store-manager"`.
- **Scenario 3:** Create staff user with role `HR_EXECUTIVE` -> Expect success, `role_id="role-hr-executive"`.
- **Scenario 4:** Update created user's role to `STORE_MANAGER` via `update_staff_user` -> Expect success, no `NameError`.
- **Scenario 5:** Confirm `t_rbac_roles.py` passes 20/20 with 0 regressions.

## 15. Documentation Impact
- Update `docs/implementation/README.md` master index.
- Update `docs/walkthrough/README.md` master index.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
- Pull changes into target environment.
- Run `alembic -x target=control -x db=smritisys upgrade head`.
- Restart FastAPI service if running.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-004`: Dual-Tier RBAC with Predefined System Roles and Tenant-Scoped Custom Roles.
- Phase 1E RBAC R-3 Option B: Coexistence of scoped `role-sales-executive` and seed `role-sales_executive`.

## 19. Related Walkthroughs
- `docs/walkthrough/security/Security_Role_Template_Mapping_And_Staff_Creation_Audit_v3.17.1.md`
- `docs/walkthrough/security/Security_RBAC_Wildcard_Escalation_Hardening_v1.0.0.md`
- `docs/walkthrough/hr/User_And_Staff_Creation_Hardening_And_Error_Visibility_Walkthrough_v6.72.0.md`
