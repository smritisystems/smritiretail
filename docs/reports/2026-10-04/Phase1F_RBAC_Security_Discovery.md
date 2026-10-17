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
  Classification: Internal – Security Report
-->

# Phase 1F RBAC Security Discovery Report

**Phase:** 1F – SEC-RBAC-001 Hardening  
**Base commit (Phase 1E final):** `40071dbbc9983fea0ea8bc52167da5d1e0669b64`  
**Discovery commit:** `3a76de44e40c73208cda29d4790fcbfa2ed5479f`  
**Date:** 2026-10-04  
**Status:** Discovery COMPLETE — escalation path CONFIRMED

---

## 1. Objective

Verify whether the wildcard-permission escalation described in
`docs/security/SEC-RBAC-001_Wildcard_Permission_Escalation.md` is
exploitable against the live smritisys database, and enumerate every
code path an attacker could use.

---

## 2. Evidence: DB State (smritisys, Alembic head `v1516_role_tenancy_constraints`)

### 2.1 Role inventory

```
Command: ..\\.venv\\Scripts\\python.exe scratch/p1f_db_probe.py (F:\SMRITRretailNX\backend)

== role counts
   (15 total_active, 15 system_active, 0 custom_active, 0 system_with_company)

== roles (id / is_system / company_id / wildcard / bound_active_users)
role-admin            is_system=True  company=None  wildcard=True   bound=0
role-cashier          is_system=True  company=None  wildcard=False  bound=2
role-manager          is_system=True  company=None  wildcard=True   bound=3   ← RISK
role-sales_executive  is_system=True  company=None  wildcard=True   bound=0
role-sysadmin         is_system=True  company=None  wildcard=True   bound=4
...
(remaining 10 roles have wildcard=False)
```

**Key finding:** `custom_active = 0` — there are no exploitable *custom* roles today.
However, the three MANAGER users are bound to the **system** `role-manager`
which carries `["*"]`, which is sufficient to trigger the bypass.

### 2.2 Non-SYSADMIN users bound to a wildcard role

```
== non-SYSADMIN users bound to wildcard role (3 rows)
   ('usr-store-manager-a', 'MANAGER', 'role-manager')
   ('usr-manager-direct', 'MANAGER', 'role-manager')
   ('usr-manager', 'MANAGER', 'role-manager')
```

---

## 3. Evidence: Live Guard Probe

```
Command: ..\\.venv\\Scripts\\python.exe scratch/p1f_guard_probe.py (F:\SMRITRretailNX\backend)

usr-sysadmin:       enum=SYSADMIN  role_id=role-sysadmin  → ADMITTED to require_role(SYSADMIN)
usr-manager:        enum=MANAGER   role_id=role-manager   → ADMITTED to require_role(SYSADMIN)  ← BUG
usr-manager-direct: enum=MANAGER   role_id=role-manager   → ADMITTED to require_role(SYSADMIN)  ← BUG
usr-store-manager-a:enum=MANAGER   role_id=role-manager   → ADMITTED to require_role(SYSADMIN)  ← BUG
usr-cashier:        enum=CASHIER   role_id=role-cashier   → REJECTED 403
```

**Interpretation:** `require_role(UserRole.SYSADMIN)` admits any user whose
`role_id` resolves to a role that contains `"*"` in `permissions_json`.
This is the bypass documented in SEC-RBAC-001 §2.1, confirmed live.

---

## 4. Root-Cause Code Paths

### 4.1 `require_role` bypass — `backend/app/api/deps.py:382-393`

```python
if current_user.role_id:
    res = await db.execute(select(Role).where(...))
    role_obj = res.scalars().first()
    if role_obj:
        perms = json.loads(role_obj.permissions_json)
        if "*" in perms:
            return current_user   # ← unconditional return, ignores allowed_roles
```

**The wildcard check is performed BEFORE the allowed_roles check.**
A user with any wildcard `role_id` bypasses ALL `require_role` guards,
regardless of the caller's `allowed_roles` argument.

### 4.2 Unrestricted wildcard write — `backend/app/api/v1/roles.py:208-209`

```python
if req.permissions is not None:
    role.permissions_json = json.dumps(req.permissions)  # no whitelist validation
```

`update_role` accepts MANAGER callers (for their own company's custom roles).
If any custom role exists for a MANAGER's company, the MANAGER can freely
write `["*"]` into it.  That role then triggers the bypass in §4.1.

`create_role` is currently SYSADMIN-only (line 109), so MANAGER cannot
create new roles.  But the missing whitelist in `update_role` is the
exploitable write path for future custom roles.

### 4.3 Role assignment — `backend/app/services/user.py:431`

```python
if req.role is not None: user.role = req.role
```

`update_staff_user` (called from `PATCH /api/v1/users/{user_id}`) allows a
MANAGER to change a user's enum *role*, but **does not expose `role_id`
assignment** through any current staff management API.  `role_id` is only set
by seeding and the SYSADMIN-controlled `UserCreate`/`UserUpdate` paths.

**Current risk of role_id re-assignment via API:** None found.

---

## 5. Risk Assessment

| Vector | Status | Severity |
|--------|--------|----------|
| MANAGER + wildcard `role_id` bypasses `require_role(SYSADMIN)` | **CONFIRMED** | High |
| MANAGER writes `["*"]` to a custom role (future) | **Latent** — 0 custom roles today | High |
| MANAGER assigns wildcard `role_id` to other users via API | **Not found** — no API exposes `role_id` write | N/A |
| `require_permission` wildcard (`security_matrix.py:142-148`) | **Bounded** — gated to SYSADMIN first (line 110) | Low |

---

## 6. Remediation Plan (Phase 1F Hardening)

### 6.1 Minimal targeted fix (chosen approach)

**Only two changes are required:**

| # | File | Change | Risk |
|---|------|--------|------|
| 1 | `backend/app/api/deps.py` | Restrict wildcard bypass in `require_role` to SYSADMIN enum users only | Low — additive guard |
| 2 | `backend/app/api/v1/roles.py` | Block non-SYSADMIN callers from writing `"*"` into `permissions_json` | Low — new validation only |

No Alembic migration required (schema unchanged).  
No system roles altered.  
No existing SYSADMIN behaviour changes.

### 6.2 Design decision on `require_role` wildcard path

**Decision:** Wildcard `role_id` permissions should NOT grant access to
SYSADMIN-gated endpoints for non-SYSADMIN enum users.
The wildcard is intended to allow a custom role to substitute for a
non-SYSADMIN tier, not to elevate it to superuser.

Concretely, `require_role` will be amended:

```python
# BEFORE (vulnerable):
if "*" in perms:
    return current_user

# AFTER (hardened):
if "*" in perms and current_user.role == UserRole.SYSADMIN:
    return current_user
```

This preserves SYSADMIN wildcard shortcut while removing the non-SYSADMIN
bypass.  For standard MANAGER users bound to `role-manager`, the fallback
enum check on line 399 still correctly ADMITS them to
`require_role(MANAGER)` and `require_role(SYSADMIN, MANAGER)` guards,
so no operational regression occurs.

### 6.3 Permissions whitelist for `update_role`

Non-SYSADMIN callers receive a 403 if `"*"` appears in the submitted
`permissions` list.  SYSADMIN callers are unrestricted.

---

## 7. Test Plan (to be executed in Phase 1F Step 7)

New tests added to `backend/tests/t_rbac_roles.py` (scenarios N–R):

| Scenario | Description |
|----------|-------------|
| N | MANAGER bound to wildcard role_id is REJECTED by `require_role(SYSADMIN)` |
| O | SYSADMIN bound to wildcard role_id is still ADMITTED |
| P | MANAGER updating own custom role with `["*"]` → 403 |
| Q | MANAGER updating own custom role with `["inventory.view"]` → 200 |
| R | SYSADMIN updating any role with `["*"]` → 200 |

Regression: existing 15 scenarios (A–M) + bonus tests must all pass.

---

## 8. Files to Change

| File | Change Type |
|------|-------------|
| `backend/app/api/deps.py` | Logic fix — `require_role` wildcard guard |
| `backend/app/api/v1/roles.py` | Validation — block non-SYSADMIN wildcard write |
| `backend/tests/t_rbac_roles.py` | New scenarios N–R |

No other files require modification.

---

## 9. Definition of Done

- [ ] `require_role(SYSADMIN)` rejects MANAGER bound to wildcard `role_id`
- [ ] `require_role(SYSADMIN, MANAGER)` still admits MANAGER
- [ ] SYSADMIN wildcard shortcut unchanged
- [ ] MANAGER `PUT /roles/{id}` with `["*"]` → 403
- [ ] MANAGER `PUT /roles/{id}` with scoped perms → 200
- [ ] SYSADMIN `PUT /roles/{id}` with `["*"]` → 200
- [ ] 15 existing Phase 1E tests (A–M) pass
- [ ] 5 new security regression tests (N–R) pass
- [ ] git diff evidence provided per AGENTS.md Rule 1
- [ ] Walkthrough document created
