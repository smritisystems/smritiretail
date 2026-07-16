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

  * Version    : 3.9.0
  * Created    : 2026-07-11
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# Foundation — Authentication Layer — Walkthrough v3.9.0

**Date:** 2026-07-11  
**Git Revision:** a871994  
**Supersedes:** Nothing (new document)  
**Status:** Done

---

## 1. Purpose

Introduce a complete JWT-based authentication layer to SMRITI Retail OS so that every API endpoint requires a verified caller identity. This eliminates the security gap where any caller who knew a valid Company/Branch ID could read or write tenant data.

---

## 2. Scope

| Included | Excluded |
|---|---|
| User model + DB migration | Password reset / forgot-password |
| Login / refresh / logout / me endpoints | OAuth2 / SSO |
| Bearer JWT decode + verify dependency | Email verification |
| `require_role()` RBAC guard | Frontend login UI |
| Role enforcement on all write endpoints | Full HREP error catalog |
| Refresh token blacklist (JTI-based) | NULL backfill on existing rows |
| 14 new automated tests | Fine-grained row-level permissions |

---

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/app/models/auth.py` | `User` model (users table), `RefreshTokenBlacklist` model, `UserRole` enum |
| `backend/app/schemas/auth.py` | `LoginRequest`, `TokenResponse`, `AccessTokenResponse`, `RefreshRequest`, `BootstrapRequest`, `UserResponse` |
| `backend/app/services/auth.py` | `AuthService` — bootstrap_admin, login, refresh, logout, get_user_by_id |
| `backend/app/api/v1/auth.py` | Auth router — bootstrap, login, refresh, logout, me |
| `backend/alembic/versions/8cf33df7b76a_add_users_and_token_blacklist.py` | Migration — creates users + refresh_token_blacklist tables |
| `backend/app/tests/test_auth.py` | 14 auth tests |

---

## 4. Files Modified

| File | Change |
|---|---|
| `backend/app/core/security.py` | Full rewrite — bcrypt via passlib, python-jose JWT encode/decode |
| `backend/app/api/deps.py` | Added `get_current_user`, updated `get_tenant_context` to use JWT claims, added `require_role()` |
| `backend/app/models/__init__.py` | Registered `User`, `RefreshTokenBlacklist`, `UserRole` |
| `backend/alembic/env.py` | Added auth model imports + table allowlist entries |
| `backend/app/main.py` | Registered `auth.router` at `/api/v1/auth` |
| `backend/app/api/v1/inventory.py` | Added `require_role(MANAGER, SYSADMIN)` to POST |
| `backend/app/api/v1/crm.py` | Added role guards to POST /customers and POST /customer-groups |
| `backend/app/api/v1/sales.py` | Added `require_role(CASHIER, MANAGER, SYSADMIN)` to POST |
| `backend/app/core/config.py` | `ACCESS_TOKEN_EXPIRE_MINUTES=60`, `REFRESH_TOKEN_EXPIRE_DAYS=7`, version 3.9.0 |
| `backend/requirements.txt` | Added `python-jose[cryptography]==3.3.0`, `passlib[bcrypt]==1.7.4` |
| `backend/app/tests/test_tenant_isolation.py` | Updated fixture to override `get_current_user` and `get_tenant_context`; replaced headers with contextvar approach |
| `CHANGELOG.md` | v3.9.0 entry |

---

## 5. Architecture Decisions

### A. `get_tenant_context` reads from JWT, not from headers
**Before:** `X-Company-Id` and `X-Branch-Id` headers were read and validated by DB lookup.  
**After:** Token decode produces the tenant context. Headers eliminated entirely.  
**Rationale:** Headers without a signed token are trivially spoofable. JWT claims are HMAC-signed and tamper-proof.

### B. `User` does NOT inherit `BaseEntity`
`BaseEntity` is for business-domain records (products, customers, invoices). Users are auth-domain records. They have their own timestamps and do not need soft-delete semantics from business context.

### C. Refresh token blacklist uses JTI (not token hash)
JTI is a short UUID embedded in the token payload. Looking up a JTI via an indexed column is O(log n) regardless of token size. A hash of the full token would be equivalent but JTI is the standard JWT revocation pattern (RFC 7519 §4.1.7).

### D. `require_role()` returns a guard dependency, not a middleware
Middleware applies to all routes. Per-route guards allow fine-grained per-endpoint role requirements. This supports mixed-role endpoints (e.g., CASHIER can create customers but not products).

### E. SYSADMIN users have NULL company_id/branch_id
SYSADMIN is a global super-user role. Attempting to call tenant-scoped endpoints with a SYSADMIN token raises 403 (unless a company/branch is assigned). This prevents accidental data access outside tenant scope.

---

## 6. Design Rationale

- Token expiry: 60-min access / 7-day refresh is a proven retail POS pattern. Cashiers log in at shift start; the refresh token silently renews their session; access tokens expire at a practical boundary.
- bcrypt replaces the previous PBKDF2-SHA256 — not because PBKDF2 is broken, but because bcrypt is universally supported, passlib handles work-factor upgrades, and using a standard library removes the custom implementation surface.

---

## 7. Implementation Summary

### Token Flow
```
POST /auth/login
  → AuthService.login()
  → verify_password(plain, bcrypt_hash)
  → create_access_token(payload)  [60 min, HS256]
  → create_refresh_token(payload) [7 days, HS256]
  → returns {access_token, refresh_token, token_type, role, company_id, branch_id}

POST /auth/refresh
  → decode_token(refresh_token) [verify signature + expiry]
  → check RefreshTokenBlacklist for JTI
  → load User (active check)
  → create_access_token(new_payload)
  → returns {access_token, token_type}

POST /auth/logout
  → decode_token(refresh_token)
  → INSERT into refresh_token_blacklist(jti, user_id, expires_at) [idempotent on dupe]

GET /protected-route
  → OAuth2PasswordBearer extracts Bearer token
  → decode_token() → 401 if invalid
  → get_user_by_id() → 401 if inactive
  → require_role() → 403 if wrong role
  → get_tenant_context() → 403 if SYSADMIN with no company/branch
  → business logic
```

---

## 8. Tests Executed

**Command:**
```
python -m pytest app/tests/ -v --tb=short
```

**Output (literal):**
```
collected 35 items

app/tests/test_auth.py::test_bootstrap_creates_sysadmin PASSED           [  2%]
app/tests/test_auth.py::test_bootstrap_blocked_when_users_exist PASSED   [  5%]
app/tests/test_auth.py::test_login_valid_credentials PASSED              [  8%]
app/tests/test_auth.py::test_login_invalid_password PASSED               [ 11%]
app/tests/test_auth.py::test_login_inactive_user PASSED                  [ 14%]
app/tests/test_auth.py::test_get_me_authenticated PASSED                 [ 17%]
app/tests/test_auth.py::test_get_me_no_token PASSED                      [ 20%]
app/tests/test_auth.py::test_get_me_tampered_token PASSED                [ 22%]
app/tests/test_auth.py::test_refresh_valid PASSED                        [ 25%]
app/tests/test_auth.py::test_refresh_with_access_token_rejected PASSED   [ 28%]
app/tests/test_auth.py::test_logout_blacklists_refresh_token PASSED      [ 31%]
app/tests/test_auth.py::test_role_guard_cashier_cannot_create_product PASSED [ 34%]
app/tests/test_auth.py::test_role_guard_manager_can_create_product PASSED [ 37%]
app/tests/test_auth.py::test_protected_route_no_token PASSED             [ 40%]
app/tests/test_main.py::test_liveness PASSED                             [ 42%]
app/tests/test_main.py::test_readiness PASSED                            [ 45%]
app/tests/test_main.py::test_version PASSED                              [ 48%]
app/tests/test_main.py::test_metadata_api PASSED                         [ 51%]
app/tests/test_main.py::test_changelog_api PASSED                        [ 54%]
app/tests/test_main.py::test_dev_tracker_api PASSED                      [ 57%]
app/tests/test_models.py::test_product_model_instantiation PASSED        [ 60%]
app/tests/test_models.py::test_crm_model_instantiation PASSED            [ 62%]
app/tests/test_models.py::test_sales_model_instantiation PASSED          [ 65%]
app/tests/test_repositories.py::test_product_repository_crud PASSED      [ 68%]
app/tests/test_schemas.py::test_crm_schema_validation PASSED             [ 71%]
app/tests/test_schemas.py::test_inventory_schema_validation PASSED       [ 74%]
app/tests/test_schemas.py::test_sales_schema_validation PASSED           [ 77%]
app/tests/test_services.py::test_crm_and_inventory_services PASSED       [ 80%]
app/tests/test_services.py::test_sales_invoice_service PASSED            [ 82%]
app/tests/test_tenant_isolation.py::test_header_validation PASSED        [ 85%]
app/tests/test_tenant_isolation.py::test_read_isolation PASSED           [ 88%]
app/tests/test_tenant_isolation.py::test_write_validation PASSED         [ 91%]
app/tests/test_tenant_isolation.py::test_service_layer_isolation PASSED  [ 94%]
app/tests/test_tenant_isolation.py::test_cross_tenant_branch_validation PASSED [ 97%]
app/tests/test_tenant_isolation.py::test_concurrent_duplicate_barcode_returns_400_not_500 PASSED [100%]

====================== 35 passed, 122 warnings in 8.93s =======================
```

---

## 9. Verification Results

| Check | Status |
|---|---|
| Alembic migration applied | Done — `8cf33df7b76a` applied successfully against live Postgres |
| 35/35 tests pass | Done — literal output above |
| 21 prior tests continue to pass | Done — no regressions |
| `users` table exists in DB | Done — confirmed by migration output |
| `refresh_token_blacklist` table exists | Done — confirmed by migration output |
| `require_role` blocks CASHIER from POST /products/ | Done — `test_role_guard_cashier_cannot_create_product` PASSED |
| Blacklisted refresh token rejected | Done — `test_logout_blacklists_refresh_token` PASSED |
| No raw DB/framework errors in 401/403 responses | Done — HREP asserted in `test_login_invalid_password` |
| Git commit `a871994` | Done |

---

## 10. Known Limitations

1. **Password reset / forgot-password** — not implemented. Users who forget their password must have a SYSADMIN reset it via direct DB update until this is built.
2. **Access token revocation** — access tokens cannot be revoked (only refresh tokens can be blacklisted). A logged-out user can still use their access token for up to 60 minutes. Mitigation: shorten expiry or implement short-lived token rotation.
3. **SYSADMIN tenant assignment** — SYSADMIN with NULL company/branch cannot call tenant-scoped endpoints. A UI or management endpoint to assign a company/branch to a user is not yet built.
4. **`python-jose` 3.3.0 pinned** — known to use deprecated `datetime.utcnow()` internally (produces DeprecationWarning in Python 3.14). Not a functional issue but should be tracked for a future upgrade to `joserfc` or `python-jose` successor.
5. **Blacklist purge** — expired rows in `refresh_token_blacklist` are never automatically deleted. A periodic job or DB cron to purge rows where `expires_at < NOW()` should be added.

---

## 11. Future Work

- `POST /auth/register` (manager/admin creates subordinate users)
- `PATCH /auth/password` (change own password)
- `POST /auth/reset-password` (forgot-password flow)
- SYSADMIN user management endpoints (create/deactivate users, assign tenant)
- Blacklist purge background job
- Front-end login screen integration (`src/`)
- Full HREP error catalog (`SMRITI-AUTH-001`, etc.)

---

## 12. Related ADRs

None yet.

---

## 13. Related RFCs

None yet.
