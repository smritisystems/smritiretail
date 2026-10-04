<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Version      : 1.0.0
  Created      : 2026-10-04
  Modified     : 2026-10-04
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal - Security Backlog
-->

# SEC-RBAC-001: RBAC Wildcard Permission Escalation Hardening

**ID:** SEC-RBAC-001
**Status:** OPEN (Post-Phase-1E backlog)
**Priority:** High
**Discovered:** 2026-10-04, during the Phase 1E acceptance gate
**Source Commit:** 40071dbbc9983fea0ea8bc52167da5d1e0669b64

> Phase 1E does not fix this. It is a post-Phase-1E security hardening item.

---

## 1. Issue Summary

`require_role()` in `backend/app/api/deps.py` has a wildcard bypass. Because
`update_role` / `create_role` in `backend/app/api/v1/roles.py` do not validate
`permissions_json`, a MANAGER can write `["*"]` to a custom role in their own
company. Any user bound to that role through `role_id` would then pass every
`require_role` guard, including SYSADMIN-only endpoints.

## 2. Root Cause

### 2.1 Wildcard bypass in `require_role` (deps.py)

```python
if current_user.role_id:
    role_obj = ...  # custom role loaded by role_id
    if "*" in perms:
        return current_user   # bypasses all require_role guards
```

### 2.2 Unrestricted permissions write in roles.py

```python
if req.permissions is not None:
    role.permissions_json = json.dumps(req.permissions)  # no whitelist
```

## 3. Exploitation Chain

1. MANAGER sends `PUT /api/v1/roles/{id}` with `permissions: ["*"]` on a custom
   role in their company. This succeeds today.
2. Any active user whose `role_id` points to that role now passes all
   `require_role` guards.
3. Step 2 only works if MANAGER (or someone else) can assign `user.role_id`.
   The user-management endpoints were not audited in Phase 1E.

**Current risk:** conditional high. On 2026-10-04 the database had
`custom_active = 0`, so no exploitable custom role existed.

## 4. Required Remediation Direction

1. **Permissions whitelist:** non-SYSADMIN callers must not be able to create
   or update a role whose `permissions_json` contains `"*"`. Return 403 with a
   catalogued SMRITI error code (HREP compliant).
2. **SYSADMIN behavior unchanged:** SYSADMIN can still create or update roles
   with any permissions.
3. **Role assignment review:** audit the user-management endpoints that set
   `user.role_id`. MANAGER must only be able to assign roles from their own
   company, and must not be able to assign wildcard roles.
4. **`require_role` wildcard path:** decide whether the bypass is intended. If
   it is not, limit it to SYSADMIN.
5. **Regression tests:**
   - MANAGER `PUT /roles/{id}` with `["*"]` returns 403
   - MANAGER `POST /roles/` with `["*"]` returns 403 (if MANAGER create is allowed)
   - SYSADMIN with `["*"]` still succeeds
   - A wildcard custom role does not grant SYSADMIN-only access to a non-SYSADMIN user
   - The existing 15 Phase 1E RBAC tests still pass

## 5. Definition of Done

- [ ] Non-SYSADMIN wildcard rejected in create/update, with tests
- [ ] SYSADMIN behavior unchanged, with tests
- [ ] `role_id` assignment authorization audited and scoped
- [ ] Decision on the `require_role` wildcard path documented
- [ ] `t_rbac_roles.py` 15/15 still pass
- [ ] Baseline vs current regression comparison shows 0 new failures

## 6. Evidence Trail

- Phase 1E gate report: `docs/reports/2026-10-04/Phase1E_RBAC_Implementation.md`
- Phase 1E final commit: `40071dbbc9983fea0ea8bc52167da5d1e0669b64`
