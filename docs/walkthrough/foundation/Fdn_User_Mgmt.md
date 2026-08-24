<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, CEO & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.10.0
  * Created    : 2026-07-11
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# Foundation — User Management — Walkthrough v3.10.0

**Date:** 2026-07-11  
**Git Revision:** 401e477  
**Supersedes:** Nothing (new document)  
**Status:** Done

---

## 1. Purpose

Introduce full SYSADMIN-controlled user lifecycle management so that operational staff (MANAGERs, CASHIERs, VIEWERs) can be provisioned, assigned to tenant scopes, promoted/demoted, and deactivated — all via the REST API, without direct database access.

---

## 2. Scope

| Included | Excluded |
|---|---|
| Create user with role + tenant assignment | Password reset / forgot-password flow |
| List users with role + company filters | OAuth2 / SSO |
| Get any user (SYSADMIN) / own profile (others) | User photo / avatar upload |
| Patch user (role, email, mobile, active state) | Bulk import |
| Soft-deactivate user (SYSADMIN only) | Fine-grained field-level permissions |
| Self-service password change | Admin force-reset password |
| 17 automated tests | Two-factor authentication |

---

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/app/schemas/user.py` | `UserCreate`, `UserUpdate`, `PasswordChange`, `UserResponse`, `UserListResponse` |
| `backend/app/services/user.py` | `UserService` — create, list, get, update, deactivate, change_password |
| `backend/app/api/v1/users.py` | REST router — 6 endpoints under `/api/v1/users/` |
| `backend/app/tests/test_user_management.py` | 17 tests |

---

## 4. Files Modified

| File | Change |
|---|---|
| `backend/app/main.py` | Imported and registered `users.router` at `/api/v1/users`; version → 3.10.0 |
| `backend/app/core/config.py` | `VERSION = "3.10.0"` |
| `backend/app/tests/test_auth.py` | `override_db` fixture now purges `users` + `refresh_token_blacklist` before each test to prevent cross-run contamination |
| `CHANGELOG.md` | v3.10.0 entry |

---

## 5. Architecture Decisions

### A. UserService takes `db: AsyncSession` only (no TenantContext)
`UserService` is an auth-domain service that operates across tenants. It does not receive a `TenantContext` — SYSADMIN queries span all companies. Tenant-scoped queries use the `company_id` filter parameter instead.

### B. `GET /users/{user_id}` — self-or-SYSADMIN access pattern
The self-access check (`current_user.id == user_id`) is enforced at the router layer, not inside `UserService`, because it depends on the calling identity, not on business logic. `UserService.get_user()` is identity-agnostic and purely DB-bound.

### C. Soft-deactivate instead of hard-delete
`POST /users/{user_id}/deactivate` sets `is_active=False, is_deleted=True`. This preserves audit trail — deactivated users' historical transactions remain queryable. Physical deletion is never performed via the API.

### D. Self-deactivation blocked at service layer
A SYSADMIN deactivating themselves would lock out the only admin, potentially making the system unmanageable. The block is in `UserService.deactivate_user()` so it applies regardless of how the method is called.

### E. `PATCH /users/me/password` — routed by identity, not by `{user_id}`
The `/me/` path self-referentially resolves to the token holder's identity. This is safer than exposing a parameterised `/{user_id}/password` endpoint because it removes the risk of IDOR (insecure direct object reference) on the password endpoint.

---

## 6. Design Rationale

- `UserListResponse` wraps users in `{total, users}` so pagination metadata is always present. Consumers should use `total` to decide whether to fetch further pages.
- `PATCH /users/{user_id}` uses partial-update semantics (all fields optional). Only supplied fields are written; absent fields are untouched. This prevents a partial PATCH from accidentally nulling out fields the caller didn't intend to clear.

---

## 7. Implementation Summary

### API Surface

```
POST   /api/v1/users/                 → 201 UserResponse        [SYSADMIN]
GET    /api/v1/users/                 → 200 UserListResponse     [SYSADMIN]
GET    /api/v1/users/{user_id}        → 200 UserResponse         [SYSADMIN | self]
PATCH  /api/v1/users/{user_id}        → 200 UserResponse         [SYSADMIN]
POST   /api/v1/users/{user_id}/deactivate → 200 {message}       [SYSADMIN, not self]
PATCH  /api/v1/users/me/password      → 200 {message}            [any authenticated]
```

### Business Rule Matrix

| Rule | Enforcement Point |
|---|---|
| Non-SYSADMIN must have company_id + branch_id | `UserService.create_user()` |
| company_id must exist and be active | `UserService.create_user()` |
| branch_id must belong to company_id | `UserService.create_user()` |
| Duplicate username/email → 400 (not 500) | `IntegrityError` catch in service |
| SYSADMIN cannot deactivate self | `UserService.deactivate_user()` |
| Current password required for change | `UserService.change_password()` |
| New password ≥ 8 chars | `UserService.change_password()` |
| Non-SYSADMIN cannot view other users | Router-layer identity check |

---

## 8. Tests Executed

**Command:**
```
python -m pytest app/tests/ -v --tb=short
```

**Output (literal):**
```
collected 52 items

app/tests/test_auth.py::test_bootstrap_creates_sysadmin PASSED           [  1%]
app/tests/test_auth.py::test_bootstrap_blocked_when_users_exist PASSED   [  3%]
app/tests/test_auth.py::test_login_valid_credentials PASSED              [  5%]
app/tests/test_auth.py::test_login_invalid_password PASSED               [  7%]
app/tests/test_auth.py::test_login_inactive_user PASSED                  [  9%]
app/tests/test_auth.py::test_get_me_authenticated PASSED                 [ 11%]
app/tests/test_auth.py::test_get_me_no_token PASSED                      [ 13%]
app/tests/test_auth.py::test_get_me_tampered_token PASSED                [ 15%]
app/tests/test_auth.py::test_refresh_valid PASSED                        [ 17%]
app/tests/test_auth.py::test_refresh_with_access_token_rejected PASSED   [ 19%]
app/tests/test_auth.py::test_logout_blacklists_refresh_token PASSED      [ 21%]
app/tests/test_auth.py::test_role_guard_cashier_cannot_create_product PASSED [ 23%]
app/tests/test_auth.py::test_role_guard_manager_can_create_product PASSED [ 25%]
app/tests/test_auth.py::test_protected_route_no_token PASSED             [ 26%]
... [test_main, test_models, test_repositories, test_schemas, test_services,
     test_tenant_isolation — all 21 PASSED] ...
app/tests/test_user_management.py::test_sysadmin_can_create_manager PASSED [ 69%]
app/tests/test_user_management.py::test_manager_cannot_create_user PASSED [ 71%]
app/tests/test_user_management.py::test_create_user_non_sysadmin_without_branch_rejected PASSED [ 73%]
app/tests/test_user_management.py::test_create_duplicate_username_returns_400 PASSED [ 75%]
app/tests/test_user_management.py::test_sysadmin_can_list_users PASSED   [ 76%]
app/tests/test_user_management.py::test_non_sysadmin_cannot_list_users PASSED [ 78%]
app/tests/test_user_management.py::test_list_users_filter_by_role PASSED [ 80%]
app/tests/test_user_management.py::test_sysadmin_can_get_any_user PASSED [ 82%]
app/tests/test_user_management.py::test_user_can_get_own_profile PASSED  [ 84%]
app/tests/test_user_management.py::test_non_sysadmin_cannot_get_other_user PASSED [ 86%]
app/tests/test_user_management.py::test_sysadmin_can_update_user_role PASSED [ 88%]
app/tests/test_user_management.py::test_get_nonexistent_user_returns_404 PASSED [ 90%]
app/tests/test_user_management.py::test_sysadmin_can_deactivate_user PASSED [ 92%]
app/tests/test_user_management.py::test_sysadmin_cannot_deactivate_self PASSED [ 94%]
app/tests/test_user_management.py::test_change_own_password_valid PASSED [ 96%]
app/tests/test_user_management.py::test_change_password_wrong_current PASSED [ 98%]
app/tests/test_user_management.py::test_change_password_too_short PASSED [100%]

====================== 52 passed, 196 warnings in 20.59s =======================
```

---

## 9. Verification Results

| Check | Status |
|---|---|
| 52/52 tests pass | Done — literal output above |
| 35 prior tests continue to pass | Done — zero regressions |
| SYSADMIN-only endpoints return 403 for MANAGER | Done — `test_manager_cannot_create_user` PASSED |
| Non-SYSADMIN without company/branch returns 400 | Done — `test_create_user_non_sysadmin_without_branch_rejected` PASSED |
| Duplicate username returns business-language 400 | Done — `test_create_duplicate_username_returns_400` PASSED |
| Self-deactivation returns 400 | Done — `test_sysadmin_cannot_deactivate_self` PASSED |
| Wrong current password returns 400 | Done — `test_change_password_wrong_current` PASSED |
| Short password returns 400 | Done — `test_change_password_too_short` PASSED |
| Soft-delete sets is_deleted=True in DB | Done — `test_sysadmin_can_deactivate_user` verifies DB state |
| Git commit `401e477` | Done |

---

## 10. Known Limitations

1. **No admin force-reset password** — a SYSADMIN cannot reset another user's password without knowing it. This requires a separate `POST /users/{user_id}/reset-password` endpoint (future work).
2. **No `GET /users/me`** — users must use `GET /users/{their_id}`. A `/me` shortcut is not yet implemented.
3. **No email notification on deactivation** — deactivated users receive no notification. An email notification service is not yet part of the platform.
4. **`PATCH /users/me/password` routing order** — FastAPI path matching means `/me/password` must be registered before `/{user_id}` to avoid `me` being parsed as a `user_id`. This is correctly ordered in the current router but must be maintained if new routes are added.
5. **No pagination on list response beyond `limit=200`** — enforced at the API layer. Cursor-based pagination is a future improvement.

---

## 11. Future Work

- `GET /api/v1/users/me` — self-profile shortcut
- `POST /users/{user_id}/reset-password` — SYSADMIN force-reset
- Email notification on user creation / deactivation
- Audit log entries for user management actions
- User listing for MANAGER role (scoped to own company only)
- `PATCH /users/me` — self-update of email/mobile
- Cursor-based pagination for large user lists

---

## 12. Related ADRs

None yet.

---

## 13. Related RFCs

None yet.
