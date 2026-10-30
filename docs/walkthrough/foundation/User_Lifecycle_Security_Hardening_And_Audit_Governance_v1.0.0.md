<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.17
  Created      : 2026-10-07
  Modified     : 2026-10-07
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: User Lifecycle Security Hardening, Reactivation & Audit Governance

**Version:** 1.0.0  
**Release Target:** v6.70.17  
**Area:** Foundation / Auth & Security / Staff 360  
**Date:** 2026-10-07  
**Status:** Done  

---

## 1. Purpose
Remediate security gaps, administrative lockout vulnerabilities, and synchronization omissions identified during the comprehensive audit of the system user creation, updation, and deletion lifecycles. Ensure complete isolation of elevated roles (`SYSADMIN`), automatic assignment synchronization across control-plane relational entities, active shift reconciliation guards before cashier deactivation, and immutable tamper-evident audit journal recording in `smriti_audit_log`.

---

## 2. Scope
- `backend/app/services/user.py`: Core user lifecycle logic (`create_user`, `update_user`, `deactivate_user`, `create_staff_user`, `update_staff_user`, `deactivate_staff`, `list_staff`, `get_user`).
- `backend/app/api/v1/users.py`: Router dependency injection and endpoint exposure (`create_staff_user`, `reactivate_staff_user`).
- `backend/app/tests/test_user_lifecycle_audit_hardening.py`: 9-point automated test suite covering privilege escalation, last-SYSADMIN defense, reactivation visibility, relational assignments, POS shift pre-check, and audit logging.
- `package.json`, `backend/app/core/config.py`, `src/config/version.ts`, `CHANGELOG.md`: SSOT version progression to `6.70.17`.

---

## 3. Files Created
1. `backend/app/tests/test_user_lifecycle_audit_hardening.py` — Automated verification test suite for user lifecycle hardening.
2. `docs/walkthrough/foundation/User_Lifecycle_Security_Hardening_And_Audit_Governance_v1.0.0.md` — This governance walkthrough document.

---

## 4. Files Modified
1. `backend/app/services/user.py` — Added privilege escalation checks, last-SYSADMIN protections, relational assignment sync, POS shift guard, and audit journal logging.
2. `backend/app/api/v1/users.py` — Injected `current_user` into `create_staff_user`, added `POST /{user_id}/reactivate` route.
3. `package.json` — Bumped version to `6.70.17`.
4. `backend/app/core/config.py` — Bumped version to `6.70.17`.
5. `src/config/version.ts` — Bumped version to `6.70.17`.
6. `backend/app/api/v1/staff.py` — Synchronized `update_staff_directory_profile` with `control_db`, enforced SYSADMIN role modification guard, anti-lockout protection, and audit logging.
7. `CHANGELOG.md` — Added `[6.70.17]` release notes.
8. `docs/walkthrough/README.md` — Appended walkthrough index entry.

---

## 5. Architecture Decisions
1. **Mandatory Actor Role Verification on Privilege Changes (ADR-SEC-012)**:
   - Creating or elevating any profile to `UserRole.SYSADMIN` strictly requires `requesting_user.role == UserRole.SYSADMIN`.
   - Tenant managers with `staff_mgmt: CREATE` or `staff_mgmt: EDIT` permissions are barred from elevating accounts or reassigning roles without SYSADMIN authorization.
2. **Deterministic Last-Active SYSADMIN Protection (ADR-SEC-013)**:
   - A single-query advisory count check (`_assert_not_last_active_sysadmin`) blocks role demotion or inactivation whenever `remaining active SYSADMIN count == 0`.
   - Operators cannot deactivate their own profiles (`is_self` deactivation block).
3. **Ghost User Elimination & Reactivation Unification (ADR-SEC-014)**:
   - When filtering staff by `status="Inactive"`, `list_staff` bypasses the `is_deleted == False` clause so `LockedUsersView.tsx` can query and display all inactive/soft-deleted accounts.
   - Updating status to `status="Active"` sets `is_deleted = False`, `is_active = True`, and `status = "Active"`, cleanly restoring the operator to duty.
4. **Relational Control-Plane Assignment Parity (ADR-SEC-015)**:
   - `UserService._enroll_assignments()` synchronously provisions records in `user_company_assignments` and `user_branch_assignments` with `is_default = True` whenever a user is created or transferred.
5. **Pre-flight Shift Reconciliation Guard (ADR-SEC-016)**:
   - Deactivating a cashier queries `shifts` in the tenant register database; if an `OPEN` shift is found, the operation halts with HTTP 400 and actionable guidance.

---

## 6. Design Rationale
In enterprise retail environments, cashiers and branch managers must never have the ability to promote themselves or their colleagues to global system administrators. Furthermore, soft deletion previously broke UI unlock workflows by rendering deactivated users completely invisible to standard endpoints. By aligning query visibility and adding an atomic reactivation workflow, security and operational workflows are both satisfied without introducing data drift.

---

## 7. Implementation Summary
- **Privilege Barriers**:
  - `create_staff_user`: Validates `req.role == UserRole.SYSADMIN` requires `requesting_user.role == UserRole.SYSADMIN`.
  - `update_staff_user`: Asserts only `SYSADMIN` can alter user roles.
- **Lockout Prevention**:
  - `_assert_not_last_active_sysadmin`: Verified across `update_staff_user`, `update_user`, `deactivate_staff`, and `deactivate_user`.
- **Soft-Delete Reactivation**:
  - Updated `list_staff` to query `is_deleted` records when `status_filter == "Inactive"`.
  - `get_user` accepts `include_deleted` flag for reactivation paths.
- **Assignment Auto-Enrollment**:
  - Added `_enroll_assignments()` creating `UserCompanyAssignment` and `UserBranchAssignment`.
- **POS Shift Check**:
  - Added `_check_active_pos_shifts()` with graceful handling for ad-hoc environments.
- **Audit Logging**:
  - Recorded `SmritiAuditLog` entries for `USER_CREATED`, `USER_UPDATED`, `USER_ROLE_CHANGED`, `USER_DEACTIVATED`, and `USER_REACTIVATED`.

---

## 8. Tests Executed
1. `pytest backend/app/tests/test_user_lifecycle_audit_hardening.py` (12/12 PASSED):
   - `test_prevent_non_sysadmin_creating_sysadmin`: PASSED
   - `test_sysadmin_can_create_sysadmin`: PASSED
   - `test_prevent_non_sysadmin_modifying_roles`: PASSED
   - `test_prevent_demoting_or_inactivating_last_sysadmin`: PASSED
   - `test_prevent_self_deactivation`: PASSED
   - `test_deactivate_and_reactivate_lifecycle`: PASSED
   - `test_auto_enroll_assignments`: PASSED
   - `test_audit_logs_recorded_for_lifecycle_events`: PASSED
   - `test_active_pos_shift_blocks_deactivation`: PASSED
   - `test_list_staff_role_normalization`: PASSED
   - `test_staff_directory_profile_synchronization`: PASSED
   - `test_password_change_audit_journal`: PASSED
2. `pytest backend/app/tests/t_user_mgmt.py` (13/13 PASSED):
   - `test_sysadmin_can_create_manager`: PASSED
   - `test_cashier_cannot_create_user`: PASSED
   - `test_create_duplicate_username_returns_400`: PASSED
   - `test_sysadmin_can_list_users`: PASSED
   - `test_cashier_cannot_list_users`: PASSED
   - `test_sysadmin_can_get_any_user`: PASSED
   - `test_user_can_get_own_profile`: PASSED
   - `test_cashier_cannot_get_other_user`: PASSED
   - `test_sysadmin_can_update_user_role`: PASSED
   - `test_get_nonexistent_user_returns_404`: PASSED
   - `test_sysadmin_can_deactivate_user`: PASSED
   - `test_sysadmin_cannot_deactivate_self`: PASSED
   - `test_change_own_password_valid`: PASSED
3. `pytest backend/app/tests/t_staff_verify.py` (9/9 PASSED):
   - `test_staff_user_response_schema_verification`: PASSED
   - `test_staff_access_is_scoped_to_active_company_and_branch`: PASSED
   - `test_staff_creation_requires_explicit_password`: PASSED
   - `test_attendance_is_tenant_scoped_and_duplicate_dates_are_rejected`: PASSED
   - `test_leave_requires_valid_dates_and_manager_decision`: PASSED
   - `test_partner_staff_placement_validates_store_code_and_approval`: PASSED
   - `test_internal_staff_placement_uses_target_branch_scope`: PASSED
   - `test_internal_staff_placement_rejects_missing_branch`: PASSED
   - `test_staff_placement_reassign_flow`: PASSED
4. Combined Suite Run: `pytest backend/app/tests/test_user_lifecycle_audit_hardening.py backend/app/tests/t_user_mgmt.py backend/app/tests/t_staff_verify.py` (34/34 PASSED in 61.74s).
5. `pytest backend/app/tests/test_console_errors_remediation.py`: 16/16 PASSED
6. `vitest run src/tests/universalImportEngine.test.ts`: 10/10 PASSED
7. `python scripts/validate_version_ssot.py`: 100% Consistent at `6.70.17`
8. `npm run build`: Production bundle compiled in 45.02s with 0 errors.

---

## 9. Verification Results
| Check | Requirement | Result | Status |
|---|---|---|---|
| Role Elevation Guard | Manager cannot create SYSADMIN | HTTP 403 Forbidden | Done |
| Role Modification Guard | Manager cannot alter roles | HTTP 403 Forbidden | Done |
| Lockout Protection | Cannot demote last active SYSADMIN | HTTP 400 Bad Request | Done |
| Self-Deactivation Guard | Operator cannot deactivate self | HTTP 400 Bad Request | Done |
| Reactivation Pipeline | LockedUsersView unlock action works | Entity restored Active | Done |
| Relational Assignments | Auto-creates UCA and UBA | is_default = True | Done |
| Active POS Shift Guard | Cashier deactivation blocked if shift open | HTTP 400 Bad Request | Done |
| Audit Trail | Immutable log recorded | SmritiAuditLog entries present | Done |
| Role Normalization | Case-insensitive and alias queries (admin -> SYSADMIN) | Matches canonical roles | Done |
| Staff 360 Parity | Directory profile updates commit control-plane user | Role & status synced | Done |
| Password Change Audit | Self-service & admin resets recorded | USER_PASSWORD_CHANGED logged | Done |

---

## 10. Known Limitations
- Background retry worker for offline tenant shifts is stubbed pending distributed synchronization rollout.
- Biometric credential enrollment remains out of scope for browser-based password authentication.

---

## 11. Future Work
- Add multi-factor authentication (MFA/TOTP) requirements for all `SYSADMIN` login attempts.
- Implement time-bound break glass elevation for emergency site-reliability operators.

---

## 12. Related ADRs
- `ADR-SEC-012`: Role Hierarchy & Elevation Boundary Control
- `ADR-SEC-013`: Single System Administrator Inactivation Guard
- `ADR-SEC-014`: Soft-Delete & Account Unlock Synchronization
- `ADR-SEC-015`: Dual Control-Plane Assignment Automation
- `ADR-SEC-016`: POS Shift Life-cycle Integrity Guard

---

## 13. Related RFCs
- `RFC-2026-071`: Universal Staff 360 Security Model & Audit Standard
