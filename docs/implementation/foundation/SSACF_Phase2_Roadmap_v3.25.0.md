<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.25.0
  Created      : 2026-07-18
  Modified     : 2026-07-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SSACF Phase 2 — Operational Maturity Roadmap v3.25.0

**Status:** Draft  
**Precondition:** SSACF Phase 1 (v3.24.0) completed and passing 3/3 integration tests.  
**Architectural Review Score:** 9.8/10 — Release Candidate quality for backend foundation.

---

## 1. Objective

Evolve the SMRITI Security & Access Control Framework from a working foundation into an operationally mature, production-grade authorization subsystem. Phase 2 addresses cache abstraction, role-cycle safety, scoped permissions, field-level security, workflow integration, and the plugin registration framework.

---

## 2. Business Motivation

Phase 1 established the structural security model. Phase 2 is required to:
- Support horizontal scaling (Redis-backed cache instead of in-process dict)
- Prevent data corruption from accidental role inheritance cycles
- Enable granular authorization scopes (Branch, Company, Global) without multiplying permission codes
- Support field-level visibility rules (e.g., hide `cost_price` from cashiers)
- Connect authorization to the existing Workflow Engine
- Allow new modules to self-register permissions, menus, and lookups

---

## 3. Scope

| Phase | Feature | Priority |
|---|---|---|
| 2.1 | Cache Provider Abstraction (Memory → Redis interface) | High |
| 2.2 | Frontend `usePermission()` hook + `/check` consumer | High |
| 2.3 | Role/Policy/Menu Administration UI | Medium |
| 2.4 | Role Cycle Detection (directed graph BFS guard) | High |
| 2.5 | Scoped Permissions (OWN, DEPARTMENT, BRANCH, COMPANY, GLOBAL) | Medium |
| 2.6 | Field-Level Security (per-policy field visibility/editability rules) | Medium |
| 2.7 | Workflow Approval Integration (approval limits, document-state gates) | Medium |
| 2.8 | Plugin Permission & Menu Registration Framework | Low |
| 2.9 | Legacy `UserRole` Enum Retirement | Low |
| 2.10 | Platform vs. Business Administration Role Split & Namespacing | High |

---

## 4. Current State (Phase 1 Baseline)

- 8 SSACF tables live in PostgreSQL: `smriti_roles`, `smriti_permissions`, `smriti_policies`, `smriti_role_policies`, `smriti_policy_permissions`, `smriti_user_roles`, `smriti_menus`, `smriti_security_audits`
- `SecurityService` resolves permissions via BFS role traversal with DENY-wins tri-state logic
- Module-level `Dict[str, Set[str]]` in-memory cache; explicit invalidation API
- `require_permission(code)` FastAPI dependency guard
- `/api/v1/security/menus`, `/check`, `/permissions`, `/roles`, `/policies` endpoints
- Legacy `UserRole` enum coexists; SYSADMIN bypass is in place
- 3 integration tests passing (role inheritance, deny precedence, menu filtering)

---

## 5. Gap Analysis

| Gap | Risk | Phase |
|---|---|---|
| In-memory cache doesn't survive multi-worker or restart | High — stale permissions in production | 2.1 |
| No `visited` guard in BFS role traversal | Medium — circular inheritance crashes the service | 2.4 |
| Permission `scope` column exists but isn't enforced in resolvers | Medium — branch isolation not guaranteed | 2.5 |
| No field-level security | Low now, High once reporting is expanded | 2.6 |
| Workflow approval limits not connected to SSACF | Medium — cashier can approve any amount via API | 2.7 |
| New modules seed permissions manually | Low — developer discipline issue | 2.8 |
| Legacy `UserRole` dual-system coexistence | Low now, increases with time | 2.9 |

---

## 6. Architecture Impact

### 2.1 — Cache Provider Abstraction

Introduce `PermissionCacheProvider` abstract base class:

```python
class PermissionCacheProvider(ABC):
    async def get(self, user_id: str) -> Optional[Set[str]]: ...
    async def set(self, user_id: str, perms: Set[str]): ...
    async def invalidate(self, user_id: str): ...
    async def clear_all(self): ...
```

Implementations:
- `MemoryPermissionCache` — current dict-based (default, single-process)
- `RedisPermissionCache` — Redis `SETEX` with TTL (multi-worker)

`SecurityService` takes the provider via DI, defaulting to memory.

---

### 2.4 — Role Cycle Detection

Add cycle guard to `get_effective_roles()` BFS:

```python
if r.parent_role_id and r.parent_role_id in visited_role_ids:
    raise ValueError(f"Circular role inheritance detected: {r.code} → {r.parent_role_id}")
```

Also add a `validate_role_hierarchy(role_id)` endpoint callable before saving a `parent_role_id` assignment.

---

### 2.5 — Scoped Permissions

Extend `SMRITIPolicyPermission` with a `scope_override` column:

```
OWN_DOCUMENT   — only documents the user created
OWN_BRANCH     — all documents in the user's branch (current default)
ALL_BRANCHES   — all branches within the company
GLOBAL         — across all companies (SYSADMIN only)
```

The resolver picks the narrowest scope allowed by any matching permission entry.

---

### 2.6 — Field-Level Security

New table `smriti_field_policies`:

```
id, policy_id, resource, field_name, visibility (VISIBLE | HIDDEN), editability (EDITABLE | READ_ONLY | RESTRICTED), max_value
```

The security API exposes `GET /api/v1/security/field-rules?resource=Invoice` returning a field map the frontend uses to conditionally render inputs.

---

### 2.7 — Workflow Integration

Extend `SMRITIPolicyPermission` with `approval_limit` (Decimal) and `approval_document_states` (JSON array):

```
cashier can approve invoices up to ₹10,000 in Draft state only
manager can approve up to ₹1,00,000 in Draft or Submitted
```

`WorkflowService` calls `SecurityService.check_approval_limit(user_id, resource, amount, state)` before processing workflow transitions.

---

### 2.8 — Plugin Registration Framework

Each module (inventory, sales, POS) defines a `permissions_manifest.py`:

```python
PERMISSIONS = [
    {"code": "ITEM.CREATE", "resource": "Product", "action": "Create", "module": "Inventory"},
]
MENUS = [
    {"title": "Item Catalog", "route": "/inventory/items", "permission": "ITEM.CREATE"},
]
```

A `register_module_manifest(manifest)` startup hook in `lifespan` upserts permissions and menus from each manifest, replacing manual seed entries.

---

## 7. Proposed Design

### File Changes per Sub-Phase

#### Phase 2.1 — Cache Abstraction
- `[NEW] backend/app/services/permission_cache.py` — `PermissionCacheProvider` ABC + `MemoryPermissionCache`
- `[MODIFY] backend/app/services/security.py` — inject cache provider; remove module-level dict
- `[NEW] backend/app/services/redis_permission_cache.py` — `RedisPermissionCache` (gated behind `settings.USE_REDIS_CACHE`)

#### Phase 2.2 — Frontend Permission Hook
- `[NEW] src/hooks/usePermission.ts` — React hook: calls `/api/v1/security/check`; caches result per session
- `[NEW] src/hooks/useMenus.ts` — React hook: calls `/api/v1/security/menus`; replaces hardcoded sidebar

#### Phase 2.3 — Admin UI
- `[NEW] src/pages/SecurityAdmin/RolesPage.tsx`
- `[NEW] src/pages/SecurityAdmin/PoliciesPage.tsx`
- `[NEW] src/pages/SecurityAdmin/MenusPage.tsx`

#### Phase 2.4 — Cycle Detection
- `[MODIFY] backend/app/services/security.py` — add visited-set guard in BFS
- `[MODIFY] backend/app/api/v1/security.py` — add `POST /roles/{id}/validate-hierarchy`

#### Phase 2.5 — Scoped Permissions
- `[MODIFY] backend/alembic/versions/` — add `scope_override` column to `smriti_policy_permissions`
- `[MODIFY] backend/app/services/security.py` — resolve narrowest scope in permission compilation

#### Phase 2.6 — Field-Level Security
- `[NEW] backend/app/models/security.py` — `SMRITIFieldPolicy` model
- `[NEW] backend/alembic/versions/` — create `smriti_field_policies` table
- `[NEW] backend/app/api/v1/security.py` — `GET /field-rules` endpoint

#### Phase 2.7 — Workflow Integration
- `[MODIFY] backend/app/models/security.py` — add `approval_limit`, `approval_document_states` to `SMRITIPolicyPermission`
- `[MODIFY] backend/app/services/security.py` — `check_approval_limit()` method
- `[MODIFY] backend/app/services/workflow.py` or `pos.py` — call limit checker before state transitions

#### Phase 2.8 — Plugin Registration
- `[NEW] backend/app/core/plugin_registry.py` — `register_module_manifest()` + `lifespan` hook
- `[MODIFY] backend/app/main.py` — call `register_module_manifest` for each installed module

#### Phase 2.9 — UserRole Enum Retirement
- `[MODIFY] backend/app/models/auth.py` — mark `UserRole` as deprecated; remove column after all guards migrated
- `[MODIFY] backend/alembic/versions/` — drop `users.role` column after cutover validation

#### Phase 2.10 — Platform vs. Business Administration Role Split & Namespacing
- `[NEW] backend/app/db/seeds/roles_permissions.py` — seed platform permissions (`SYSTEM.*`, `PLATFORM.*`, `DATABASE.*`) and business permissions (`USER.*`, `SALES.*`, etc.) into `smriti_permissions`
- `[NEW] backend/app/db/seeds/roles.py` — seed `SYSADMIN` (platform) and `Administrator` (business-level master) roles
- `[MODIFY] backend/app/services/security.py` — enforce wildcard namespace matches in `check_permission` and `resolve_permissions`

---

## 8. Files Created

*To be populated per sub-phase as work proceeds.*

---

## 9. Files Modified

*To be populated per sub-phase as work proceeds.*

---

## 10. Dependencies

| Dependency | Required By | Notes |
|---|---|---|
| Redis (optional) | Phase 2.1 | Only needed if `USE_REDIS_CACHE=true`; memory cache remains default |
| `aioredis` or `redis[asyncio]` Python package | Phase 2.1 | Not yet in `requirements.txt` |
| React Query or SWR | Phase 2.2 | For frontend hook caching; already available if used elsewhere |
| SSACF Phase 1 | All | Must be at `head` migration and seeded |

---

## 11. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Redis unavailable in dev | Medium | Fall back to `MemoryPermissionCache` automatically via `settings.USE_REDIS_CACHE` flag |
| Cycle in role graph crashes production | Low | Phase 2.4 adds guard before Phase 2.9 removes legacy fallback |
| Field-level security increases API surface significantly | Medium | Deliver as a separate `/field-rules` endpoint — never embed in core permission resolution |
| Plugin manifest conflicts (two modules claim same permission code) | Low | Upsert semantics; log warnings on code collisions |

---

## 12. Rollback Strategy

Each sub-phase is a separate Alembic revision. Any sub-phase can be individually rolled back via `alembic downgrade -1`. The `MemoryPermissionCache` can be reinstated by disabling `USE_REDIS_CACHE`. No Phase 1 tables are modified in Phase 2.1–2.4; rollback is non-destructive.

---

## 13. Verification Plan

### Automated Tests (per sub-phase)
- **2.1**: `test_security_engine.py` — existing 3 tests pass with new cache provider injected
- **2.4**: New test `test_role_cycle_detection` — `ValueError` raised on circular graph
- **2.5**: New test `test_scope_narrowing` — OWN_BRANCH scope overrides GLOBAL
- **2.6**: New test `test_field_policy_visibility` — hidden fields excluded from response
- **2.7**: New test `test_approval_limit_enforcement` — amount over limit rejected
- **2.10**: New test `test_admin_sysadmin_namespace_separation` — verifying business `Administrator` cannot access platform `SYSTEM.*` namespaces and vice-versa

### Manual Verification
- Login as `cashier` and confirm sidebar only shows permitted menus (Phase 2.2)
- Attempt to create a role cycle in admin UI and verify rejection (Phase 2.3/2.4)
- Login as `Administrator` and confirm no option to access platform databases or system backups exists (Phase 2.10)

---

## 14. Test Plan

Each sub-phase adds at least one new `pytest` test case to `test_security_engine.py` before the sub-phase is marked complete.

---

## 15. Documentation Impact

| Document | Update Required |
|---|---|
| `docs/walkthrough/foundation/` | New walkthrough per sub-phase |
| `docs/architecture/` | Update security architecture diagram |
| `docs/developer-guide/` | Add `usePermission()` usage guide |
| `docs/user-guide/` | Add Role/Policy administration guide (Phase 2.3) |

---

## 16. Deployment Plan

1. Deploy Phase 2.1 (cache abstraction) — backward compatible, no schema change
2. Deploy Phase 2.4 (cycle detection) — backward compatible, no schema change
3. Deploy Phase 2.5 (scoped permissions) — requires Alembic migration: `ALTER TABLE smriti_policy_permissions ADD COLUMN scope_override`
4. Deploy Phase 2.6 (field security) — requires new table `smriti_field_policies`
5. Deploy Phase 2.7 (workflow) — requires two new columns on `smriti_policy_permissions`
6. Deploy Phase 2.8 (plugin registry) — code-only change; no schema change
7. Deploy Phase 2.9 (enum retirement) — requires `ALTER TABLE users DROP COLUMN role`; only after all tests pass without the column
8. Deploy Phase 2.10 (role split & namespaces) — code and default seed change; no schema change

---

## 17. Status

**Draft** — awaiting sub-phase prioritization and sequencing approval.

---

## 18. Related ADRs

- Backend System-of-Record Policy (FastAPI + Postgres mandatory for all new capabilities)
- SMRITI Platform Abstraction Layer — dependency direction (UI → Express → PAL → FastAPI)

---

## 19. Related Walkthroughs

- [SSACF Phase 1 Walkthrough v3.24.0](../walkthrough/foundation/Security_SSACF_Role_And_Menu_Engine_v3.24.0.md)
