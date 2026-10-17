<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Version      : 1.0.0
  Created      : 2026-10-04
  Modified     : 2026-10-04
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal – Security Walkthrough
-->

# Security_RBAC_Wildcard_Escalation_Hardening_v1.0.0

**Phase:** 1F — SEC-RBAC-001 Hardening  
**Branch:** smritiNX  
**Base commit (Phase 1E):** `40071dbbc9983fea0ea8bc52167da5d1e0669b64`  
**Discovery commit:** `3a76de44e40c73208cda29d4790fcbfa2ed5479f`  
**Implementation commit:** `5c0515adfb4a7ddef593f30aa406e5dac90dd346`  
**Date:** 2026-10-04  

---

## 1. Purpose

Close the RBAC wildcard-permission escalation documented in
`docs/security/SEC-RBAC-001_Wildcard_Permission_Escalation.md`.

Two specific paths were hardened:

1. `require_role()` in `deps.py` — the wildcard shortcut (`"*" in perms`)
   was previously unconditional, allowing any user whose `role_id` resolved
   to a wildcard role to bypass ALL `require_role` guards including
   `require_role(SYSADMIN)`.

2. `update_role` / `create_role` in `roles.py` — no validation prevented
   a MANAGER from writing `["*"]` into `permissions_json` of a custom role
   they own, creating a re-escalation path for future custom roles.

---

## 2. Scope

- **In scope:** Two targeted logic changes to harden the existing Phase 1E
  RBAC architecture. No schema changes, no new tables, no new API endpoints,
  no changes to system roles or seeding.
- **Out of scope:** Complete RBAC redesign, role template tables, changes to
  `require_permission` / `evaluate_action_permission` (separate guard).

---

## 3. Files Created

| File | Purpose |
|------|---------|
| `docs/security/SEC-RBAC-001_Wildcard_Permission_Escalation.md` | Security advisory and backlog item |
| `docs/reports/2026-10-04/Phase1F_RBAC_Security_Discovery.md` | Full discovery report with live probe evidence |
| `docs/walkthrough/security/Security_RBAC_Wildcard_Escalation_Hardening_v1.0.0.md` | This walkthrough |

---

## 4. Files Modified

| File | Change | Version |
|------|--------|---------|
| `backend/app/api/deps.py` | `require_role`: wildcard bypass now SYSADMIN-only | 6.27.3 → 6.27.4 |
| `backend/app/api/v1/roles.py` | `create_role` + `update_role`: block non-SYSADMIN wildcard write | 3.16.2 → 3.16.3 |
| `backend/tests/t_rbac_roles.py` | Added 5 new security regression scenarios N–R | +174 lines |

---

## 5. Architecture Decisions

### AD-1: Wildcard bypass scoped to SYSADMIN enum, not removed

**Decision:** Retain the wildcard shortcut in `require_role`, but gate it on
`current_user.role == UserRole.SYSADMIN`.

**Rationale:** Removing the wildcard globally would break SYSADMIN users
bound to `role-sysadmin` (which has `["*"]`) from using the shortcut path.
The correct invariant is: wildcard means "you have every permission your
tier is allowed to have" — and for non-SYSADMIN users, that tier does not
include SYSADMIN-only endpoints. Non-SYSADMIN users already have a complete,
correct fallback via the enum check.

### AD-2: Use SMRITI-AUTH-003 error code for wildcard write rejection

**Decision:** Wildcard write rejections return `SMRITI-AUTH-003` — a new
catalogued error code distinct from `SMRITI-AUTH-001` (permission denied on
resource/action) to allow support teams to identify this specific class of
attempt in audit logs.

### AD-3: No Alembic migration

**Decision:** No migration created. The schema is unchanged. Only application
logic is tightened. The wildcard system roles (`role-manager`, etc.) are
left intact as-is (system roles cannot be modified via API anyway).

---

## 6. Design Rationale

The fix is minimal and targeted:

```
BEFORE:
require_role(_guard):
    if role_id → role → "*" in perms:
        return current_user   ← any role with wildcard passes

AFTER:
require_role(_guard):
    if role_id → role → "*" in perms AND user.role == SYSADMIN:
        return current_user   ← only SYSADMIN enum users shortcut via wildcard
    (else: fall through to enum check)
```

The enum check (`current_user.role not in allowed_roles`) was already
correct. The bug was that the wildcard short-circuit prevented the enum
check from running.

---

## 7. Implementation Summary

### Step 1: Discovery probes
- `p1f_db_probe.py` — confirmed 15 system roles, 3 wildcard roles,
  3 MANAGER users bound to `role-manager` (wildcard).
- `p1f_guard_probe.py` — confirmed all 3 MANAGER users were admitted through
  `require_role(SYSADMIN)` before the fix.

### Step 2: `deps.py` fix (one-line change + docstring)
Changed `if "*" in perms:` → `if "*" in perms and current_user.role == UserRole.SYSADMIN:`

### Step 3: `roles.py` fix (two guard blocks)
Added wildcard-write guards in `create_role` and `update_role`, returning
`403 SMRITI-AUTH-003` for non-SYSADMIN callers.

### Step 4: Test authoring
Added helper functions `_make_wildcard_custom_role`, `_bind_user_role_id`,
`_unbind_user_role_id` and 5 new test scenarios N–R.

### Step 5: Post-fix probe
Re-ran `p1f_guard_probe.py` — MANAGER users are now REJECTED 403 from
`require_role(SYSADMIN)`. SYSADMIN still ADMITTED.

---

## 8. Tests Executed

```
Command: cd backend/tests && pytest t_rbac_roles.py -v --tb=short
Result:  20/20 passed, 0 failed, 17 warnings, 24.93s
```

Scenario coverage:

| Scenario | Description | Result |
|----------|-------------|--------|
| A | System role visibility | PASSED |
| B | Custom role visibility | PASSED |
| C | Cross-tenant isolation | PASSED |
| D | Custom role creation scoped to company | PASSED |
| E | Cross-tenant update blocked | PASSED |
| F | Cross-tenant delete blocked | PASSED |
| G | System role immutability | PASSED |
| H | System role deletion protection | PASSED |
| I | Duplicate custom role rejected | PASSED |
| J | Same name cross-company allowed | PASSED |
| K | Stable system role IDs | PASSED |
| L | Existing role_id assignments valid | PASSED |
| M | R-3 SALES_EXECUTIVE compatibility | PASSED |
| bonus | CASHIER cannot create role | PASSED |
| bonus | Unauthenticated list → 401 | PASSED |
| **N** | **MANAGER + wildcard role_id → rejected at SYSADMIN endpoint** | **PASSED** |
| **O** | **SYSADMIN + wildcard role_id → still admitted** | **PASSED** |
| **P** | **MANAGER PUT ["*"] → 403 SMRITI-AUTH-003** | **PASSED** |
| **Q** | **MANAGER PUT scoped perms → 200** | **PASSED** |
| **R** | **SYSADMIN PUT ["*"] → 200** | **PASSED** |

---

## 9. Verification Results

### Evidence — Git diff (commit 5c0515ad)

**deps.py key change:**
```diff
-                if "*" in perms:
+                # SEC-RBAC-001 hardening: wildcard bypass restricted to SYSADMIN
+                if "*" in perms and current_user.role == UserRole.SYSADMIN:
                     return current_user
```

**roles.py create_role addition:**
```diff
+    if not _is_sysadmin(current_user) and "*" in (req.permissions or []):
+        raise HTTPException(status_code=403, detail="SMRITI-AUTH-003: ...")
```

**roles.py update_role addition:**
```diff
+    if not _is_sysadmin(current_user) and req.permissions is not None and "*" in req.permissions:
+        raise HTTPException(status_code=403, detail="SMRITI-AUTH-003: ...")
```

### Evidence — Live guard probe (post-fix)

```
usr-sysadmin:        enum=SYSADMIN  role_id=role-sysadmin  → ADMITTED
usr-manager:         enum=MANAGER   role_id=role-manager   → REJECTED 403
usr-manager-direct:  enum=MANAGER   role_id=role-manager   → REJECTED 403
usr-store-manager-a: enum=MANAGER   role_id=role-manager   → REJECTED 403
usr-cashier:         enum=CASHIER   role_id=role-cashier   → REJECTED 403
```

### Interpretation

The wildcard bypass no longer admits non-SYSADMIN users to SYSADMIN-gated
endpoints. SYSADMIN users retain shortcut access. MANAGER users continue to
pass `require_role(MANAGER)` and `require_role(SYSADMIN, MANAGER)` through
the enum fallback path — no operational regression.

The wildcard write prohibition in `roles.py` closes the future latent risk
of a MANAGER injecting `["*"]` into a custom role.

### Recommendation

1. Monitor `SMRITI-AUTH-003` occurrences in application logs for unexpected
   write attempts.
2. Review user-management endpoints that set `user.role_id` (currently only
   seeding and no exposed API path) before enabling any API exposure of
   `role_id` assignment.
3. Consider a future ADR to formally decide whether system roles should
   carry `["*"]` or scoped permissions. This is an architectural question
   beyond the scope of Phase 1F.

---

## 10. Known Limitations

- The `require_permission` path (`security_matrix.py:evaluate_action_permission`)
  also has a wildcard check at line 142–148, but it is preceded by a
  `SYSADMIN == True` early-return at line 110. Non-SYSADMIN wildcard bypass
  via `require_permission` is not exploitable because the MANAGER default
  path (line 153–157) already returns `True` for most actions. This was not
  changed in Phase 1F to avoid scope creep.
- The `p1f_guard_probe.py` calls `require_role` as a plain async function.
  In production FastAPI, Depends injection wraps the guard. The probe is
  accurate for the guard logic but does not replicate the full middleware
  stack (CORS, lifespan, etc.).

---

## 11. Future Work

- `SEC-RBAC-002` (potential): Consider whether `["*"]` in system roles
  (`role-manager`, `role-admin`) is intentional or should be scoped.
- `SEC-RBAC-003` (potential): Audit all `role_id` assignment paths if any
  future API exposes direct `role_id` writes.
- `SEC-RBAC-004` (potential): Evaluate the `require_permission` wildcard
  path in `security_matrix.py` for completeness.

---

## 12. Related ADRs

- ADR implicit in Phase 1E: Standard Role Templates vs Custom Roles
  (resolved with 15 system roles via Alembic migrations `v1335`, `v1516`)

---

## 13. Related RFCs

- SEC-RBAC-001: `docs/security/SEC-RBAC-001_Wildcard_Permission_Escalation.md`
