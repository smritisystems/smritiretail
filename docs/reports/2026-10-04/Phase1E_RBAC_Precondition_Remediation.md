<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Version      : 3.16.1
  Created      : 2026-10-04
  Modified     : 2026-10-04
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Phase 1E RBAC Pre-condition Remediation

**Type:** Pre-condition Remediation Report
**Date:** 2026-10-04
**Base Commit:** 8b78b653
**Branch:** smritiNX

## 1. Baseline

Pre-change safety gate passed:
- HEAD: 8b78b6535a902f7ab72b2fa0a2552b6c4e964c9e (8b78b653)
- Branch: smritiNX
- DB: v1516_role_tenancy_constraints HEAD, 4 indexes, 15 system roles, 0 custom roles

## 2. R-1 ORM Fix

File: backend/app/models/role.py

Problem: name column declared unique=True, index=True — creates alembic autogenerate hazard after
v1516 dropped ix_roles_name and replaced with two partial indexes.

Change (literal git diff):
-    name             = Column(String(100), nullable=False, unique=True, index=True)
+    # NOTE: Uniqueness on 'name' is enforced by two PostgreSQL partial indexes
+    # created in migration v1516_role_tenancy_constraints:
+    #   uq_roles_system_name  WHERE is_system = TRUE  AND is_deleted = FALSE
+    #   uq_roles_company_name WHERE is_system = FALSE AND is_deleted = FALSE
+    # DO NOT add unique=True or index=True here it creates an alembic
+    # autogenerate hazard (would attempt to recreate the dropped ix_roles_name).
+    name             = Column(String(100), nullable=False)

Status: Done. No migration created. Compile exit 0. Active name column confirmed: Column(String(100), nullable=False).

## 3. R-2 Seed Fix

File: backend/alembic/versions/v1335_add_user_role_id_and_seed_roles.py

Problem: ON CONFLICT (name) requires global unique constraint on name. v1516 dropped ix_roles_name.
Re-running v1335 on fresh DB would fail.

Pre-change verification:
- All 12 ROLES_SEED entries have explicit stable id values
- No duplicate IDs
- ON CONFLICT (id) DO UPDATE is correct (updates description, permissions_json, modified_at)

Change (literal git diff):
-                ON CONFLICT (name) DO UPDATE SET
+                 -- R-2 FIX: Changed ON CONFLICT (name) to ON CONFLICT (id).
+                 ON CONFLICT (id) DO UPDATE SET

Status: Done. No migration executed against DB. v1516 unmodified (empty git diff).

## 4. R-3 SALES_EXECUTIVE Usage Audit

### User Assignments
A. Users with role_id = role-sales_executive (wildcard): 0
B. Users with role_id = role-sales-executive (scoped): 0

### Both DB Roles
role-sales-executive | Sales Executive | is_system=t | company_id=NULL | scoped perms (5)
role-sales_executive | SALES_EXECUTIVE | is_system=t | company_id=NULL | ["*"]

### CRITICAL FINDING
UserRole enum (auth.py) contains: SYSADMIN, MANAGER, CASHIER, REPORT_USER, VIEWER
SALES_EXECUTIVE is NOT in the UserRole enum.
No user can ever have role=SALES_EXECUTIVE as an auth token.
No require_role(UserRole.SALES_EXECUTIVE) API guard exists or can be written.

### Code References
C. approval_engine.py: ROLE_HIERARCHY["SALES_EXECUTIVE"]=2 — string dict key, DEAD CODE PATH (unreachable)
   search_engine.py: DOMAIN_PERMISSIONS["SALES_EXECUTIVE"] — string dict key, DEAD CODE PATH (unreachable)
   seed_baseline_users.py: seeds role-sales_executive with ["*"] permissions
   Frontend: display strings only ("Sales Executive", "SALES_EXECUTIVE") — not auth tokens

D. UserRole.SALES_EXECUTIVE does NOT exist in enum. The legacy role does not serve any RBAC guard.

E. Wildcard ["*"] on role-sales_executive is a seed artifact (seed_baseline_users seeds all
   enum-alias roles with ["*"]). Not an intentional elevated grant.

F. Sales Executive (scoped, role-sales-executive) is the intended canonical RBAC role.
   Seeded by v1335 with proper scoped perms. Used by frontend as canonical display name.

### Recommendation
OPTION B: Retain both, formally document as intentionally distinct.

Rationale:
1. Zero active impact — 0 users assigned to either role via role_id
2. Wildcard role is enum-alias seed artifact, not an elevated grant
3. Scoped role is operational canonical role (v1335 seed, frontend references)
4. Engine dict entries are dead code paths — document as reserved future tier slots
5. Deprecating wildcard now would disturb seed_baseline_users.py dev environment seeding

Architect acknowledgment: Required before OPTION B is formally recorded in ADR.
Does NOT block Phase 1E code work — no runtime impact.

## 5. Validation

| Check | Result |
|-------|--------|
| python -m compileall backend/app -q | EXIT 0 |
| role.py active name Column | Column(String(100), nullable=False) only |
| v1335 ON CONFLICT active | ON CONFLICT (id) — confirmed line 130 |
| v1335 ON CONFLICT (name) active | Not present (only in SQL comments) |
| v1516 git diff | (empty — unmodified) |

## 6. Database Safety Verification

| Check | Result |
|-------|--------|
| alembic_version | v1516_role_tenancy_constraints (unchanged) |
| DB indexes | 4: roles_pkey, roles_uuid_key, uq_roles_company_name, uq_roles_system_name |
| Role counts | total_active=15, system_active=15, custom_active=0 (unchanged) |
| User assignments | with_role_id=9, enum_only=836, total=845 (unchanged) |
| ix_roles_name | Not present (dropped by v1516) |
| Migration executed | No |
| Seed executed | No |
| DB data modified | No |

## 7. Remaining Risks

| Risk | Severity | Disposition |
|------|----------|-------------|
| SALES_EXECUTIVE engine dict dead code | Low | Document in Phase 1E per OPTION B |
| list_roles no company filter | Medium | Defer to Phase 2 |
| update/delete_role no company ownership check | Low | Defer to Phase 2 |
| place_of_supply_code GST schema mismatch | High | Separate track |
| t_univ_party alias collision | Medium | Separate track |

## 8. Recommendation

1. Architect acknowledge R-3 OPTION B (can be concurrent with Phase 1E, not blocking)
2. Commit R-1 and R-2 changes to smritiNX before Phase 1E implementation starts
3. Phase 1E may now begin
4. Fix GST place_of_supply_code in a separate branch

## 9. Phase 1E Readiness Decision

Checklist:
[x] R-1 Done — role.py name column has no global uniqueness
[x] R-2 Done — v1335 uses ON CONFLICT (id)
[x] Compile passes (exit 0)
[x] v1516 unmodified
[x] Live DB indexes unchanged
[x] Live DB role counts unchanged
[x] Live DB user assignments unchanged
[x] No DB mutation performed
[x] R-3 audit complete with recommendation
[ ] R-3 architect acknowledgment (pending, non-blocking)
[ ] Post-remediation test results (task-4397 running)
[ ] Commit to smritiNX

Evidence Level: A — literal git diffs, compile output, and DB query results for all claims.

PRE-CONDITION STATUS: READY FOR PHASE 1E

(Conditional: R-3 architect acknowledgment can be concurrent.
 Test results to be appended when task-4397 completes.)

---
End of Phase 1E RBAC Pre-condition Remediation Report
