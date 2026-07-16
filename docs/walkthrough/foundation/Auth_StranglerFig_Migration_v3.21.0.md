<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.21.0
  Created      : 2026-07-16
  Modified     : 2026-07-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Auth Module — Strangler-Fig Migration v3.21.0

## 1. Purpose

Migrate Auth (login, session management, user CRUD) from Express session-based
authentication to FastAPI JWT Bearer token authentication. This is the most
security-critical Strangler-Fig module (Phase 3 of 5 in migration order).

---

## 2. Scope

| Phase | File | Change |
|---|---|---|
| A | src/middleware/authGuard.ts | Dual-path: accepts legacy sessions + FastAPI JWT |
| B | src/components/LoginScreen.tsx | Single FastAPI login; bridge pattern removed |
| C | src/App.tsx | checkAuth migrated from Express to FastAPI |
| D | src/components/UserProfileTab.tsx | 7 Express calls → apiFetchV1; sessions UI replaced |
| E | src/components/StaffManagementTab.tsx | 4 CRUD calls → apiFetchV1 with snake_case mapping |

---

## 3. Files Created

None (migration only).

---

## 4. Files Modified

| File | Change |
|---|---|
| src/middleware/authGuard.ts | + JWT HS256 local verifier; dual-path auth |
| src/components/LoginScreen.tsx | Removed Express bridge; FastAPI single login |
| src/App.tsx | checkAuth → apiFetchV1('/auth/me') |
| src/components/UserProfileTab.tsx | 7 Express fetch calls → apiFetchV1; sessions placeholder |
| src/components/StaffManagementTab.tsx | 4 Express user CRUD calls → apiFetchV1 |

---

## 5. Architecture Decisions

### A. Middleware-first ordering
uthGuard.ts updated BEFORE login migrated. If login had moved to FastAPI
first, no new sessions would be created in Express — all gated Express routes
would have returned 401. Middleware-first is the only safe migration order.

### B. Local JWT validation (no round-trip)
uthGuard.ts validates JWT signatures locally using Node.js built-in crypto
module (HS256 + JWT_SECRET_KEY). No external dependency, no network round-trip
to FastAPI for every Express request. Compatible with Node.js >= 14.

### C. Removed two-step login bridge
Previous bridge pattern sent the password twice: once to Express (session), once
to FastAPI (JWT). This was fragile and a potential security concern. Replaced with
a single POST to FastAPI /api/v1/auth/login.

### D. smriti_session_token cleared
localStorage.removeItem("smriti_session_token") called on new FastAPI login
and on logout. Cleans up the legacy localStorage key.

### E. Sessions UI — Security Gateway placeholder (Q2 resolved)
FastAPI JWT is stateless. The in-memory Express session store is retired.
The "Active Sessions" sub-tab now shows an informational placeholder explaining
the security model change. Full session audit table planned for v3.22.0.

### F. Staff API shape mapping (camelCase → snake_case)
Express /api/users returned a flat array. FastAPI /api/v1/users/ returns
{ total, users[] } with snake_case fields. etchStaff now extracts data.users.
Create/update payloads mapped from camelCase to snake_case (full_name, branch_id, etc.).

---

## 6. Design Rationale

- Dual-path middleware (Phase A) provides a zero-downtime transition: existing
  browser sessions from before the migration continue to work until they expire.
- The FastAPI UserResponse.role field is compatible with the frontend { role, name }
  shape used by App.tsx and all tab components.
- piFetchV1 automatically sends Authorization: Bearer <smriti_jwt_token>, so
  no per-call token handling is needed in components.

---

## 7. Implementation Summary

### Migration mapping

| Frontend | Old (Express) | New (FastAPI) |
|---|---|---|
| Login | POST /api/auth/login | POST /api/v1/auth/login |
| checkAuth | GET /api/auth/me | GET /api/v1/auth/me |
| Profile load | GET /api/auth/me → { user, sessionInfo } | GET /api/v1/auth/me → UserResponse directly |
| Profile update | PUT /api/users/{id} | PATCH /api/v1/users/{id} |
| Preferences | PUT /api/users/{id}/preferences | PUT /api/v1/users/{id}/preferences |
| Notifications | PUT /api/users/{id}/notifications | PUT /api/v1/users/{id}/notifications |
| Sessions list | GET /api/users/{id}/sessions | HIDDEN (JWT stateless) |
| Session revoke | POST /api/sessions/{token}/revoke | POST /api/v1/auth/logout |
| Staff list | GET /api/users → array | GET /api/v1/users/ → { total, users } |
| Staff create | POST /api/users | POST /api/v1/users/ (snake_case) |
| Staff update | PUT /api/users/{id} | PATCH /api/v1/users/{id} |
| Staff delete | DELETE /api/users/{id} | DELETE /api/v1/users/{id} |

---

## 8. Tests Executed

`
Command: pytest test_auth.py test_user_management.py -v
Result : 27 passed, 120 warnings in 20.32s

Command: pytest app/tests/ --tb=short -q
Result : 161 passed (full suite, zero regressions)
`

---

## 9. Verification Results

### Migration Exit Criteria

`
✅ Login → FastAPI only (bridge pattern removed)
✅ checkAuth → FastAPI JWT Bearer
✅ Profile CRUD → apiFetchV1
✅ Staff CRUD → apiFetchV1 with snake_case mapping
✅ requireAuth accepts FastAPI JWT (middleware updated first)
✅ smriti_session_token cleared on login and logout
✅ Sessions UI → Security Gateway placeholder (not broken UI)
✅ 27/27 auth + user management tests pass
✅ 161/161 full regression suite passes
`

---

## 10. Known Limitations

- uthGuard.ts Path 1 (legacy Express sessions) is still enabled. Removal in v3.22.0.
- Sessions sub-tab shows a placeholder. Full Postgres-backed session audit in v3.22.0.
- Pydantic.parse_raw() deprecation warnings in user.py — tracked, not blocking.

---

## 11. Future Work

- v3.22.0: Remove Path 1 from uthGuard.ts (sessions expired naturally)
- v3.22.0: Delete uth.ts and users.ts Express route files (Phase F cleanup)
- v3.22.0: Provision user_sessions Postgres table + restore session listing UI
- v3.22.0: Replace Pydantic.parse_raw() → model_validate_json() in user.py

---

## 12. Related ADRs

None (all implementation-level).

---

## 13. Related RFCs

None.

---

*Commit: a3663d7 | Branch: main | Date: 2026-07-16*
