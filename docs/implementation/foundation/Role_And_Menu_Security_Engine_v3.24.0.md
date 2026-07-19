<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.24.0
  Created      : 2026-07-18
  Modified     : 2026-07-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Security & Access Control Framework (SSACF) — Implementation Plan v3.24.0

## 1. Objective
To implement the **SMRITI Security & Access Control Framework (SSACF)**, decoupling Role & Permission Management from Menu Management. This establishes a policy-driven RBAC+ABAC engine with cached permission resolution, generalized master lookups, and a plugin registration mechanism to support multi-company, multi-branch, workflow approvals, and future extensions.

## 2. Business Motivation
Enterprise and multi-branch retail environments require robust, granular, and performant authorization policies. Coarse role checks are insufficient. Decoupling permissions from menu rendering allows menus to serve as presentation metadata while permissions act as the authoritative security engine.

## 3. Scope
* **Entities:** User, Role, Policy, Permission, Resource, Action, Scope.
* **Precedence Guard:** Strict enforcement of: `Explicit Deny` -> `Explicit Allow` -> `Inherited Allow` -> `Default Deny`.
* **Policy Layer:** Map Roles to Policies, and Policies to Permissions.
* **Dynamic Menu Resolver:** Query dynamic menu configs with extended metadata (`feature_flag`, `badge`, `permission`, `active`).
* **Seeding:** Generalized master lookup types (`department`, `designation`, `gender`, `country`, `state`, `city`, `blood_group`, `gst_category`, `tax_class`, `currency`, `unit`, `payment_mode`, `reason_code`) and defaults for designations and departments to fix current frontend onboarding 404 errors. Seed only immutable system roles (`SYSADMIN`, `MANAGER`, `CASHIER`).
* **Caching:** Flat permissions graph cached via memory-cache / Redis, returning simple claims in JWT.

## 4. Current State
* Coarse string-based role checking is used (`require_role(UserRole.MANAGER)`).
* Frontend dynamic lookups for departments and designations fail with 404 because `MasterType` and `MasterValue` definitions are missing from the Postgres database.
* The SYSADMIN user lacks tenant contexts, triggering 403 Forbidden on business API routes.

## 5. Gap Analysis
| Current State | Proposed Target (SSACF) |
| :--- | :--- |
| Hardcoded role checks | Policy-driven RBAC + ABAC engine |
| Direct Role -> Permission checks | Decoupled Role -> Policy -> Permission mapping |
| Static menu configs | Dynamic menu presentation metadata with feature flags |
| Coarse JWT tokens | Cached, flattened permissions included in JWT claims |
| Missing metadata lookups (404) | Generalized lookup engine with seeded metadata |

## 6. Architecture Impact
```
Authentication (JWT) 
        │
        ▼
Identity & Role Resolver
        │
        ▼
Policy Engine (RBAC + ABAC) ──► Redis / Memory Cache
        │
        ├───► API Authorization (deps.py)
        └───► Dynamic Menu Resolver
```
* **Performance:** Flattened permission maps are resolved at login, cached, and validated without traversing role trees on every HTTP request.
* **Menu presentation:** Menus consume permissions rather than defining security parameters.

## 7. Proposed Design

### Database Models (`backend/app/models/security.py`)
* **`SMRITIRole`:** `id`, `code` (Unique), `name`, `parent_role_id` (Hierarchy FK), `is_system_role`, `is_active`.
* **`SMRITIPermission`:** `id`, `code` (Unique, e.g. `SALES.APPROVE`), `resource`, `action`, `scope` (`OWN_BRANCH`, `ALL_BRANCHES`, etc.), `module`, `description`.
* **`SMRITIPolicy`:** `id`, `code` (Unique), `name`, `description`, `is_active`.
* **`SMRITIRolePolicy`:** `role_id` (FK), `policy_id` (FK).
* **`SMRITIPolicyPermission`:** `policy_id` (FK), `permission_id` (FK), `permission_type` (Enum: `ALLOW`, `DENY`).
* **`SMRITIMenu`:** `id`, `parent_id` (FK), `title`, `route`, `icon`, `module`, `permission` (Associated Permission Code), `sequence`, `feature_flag`, `badge`, `is_active`.
* **`SMRITISecurityAudit`:** `id`, `user_id`, `created_at`, `action`, `old_value`, `new_value`, `reason`, `ip_address`, `device_info`, `company_id`, `branch_id`.

### Permission Resolver Precedence
```python
def resolve_permissions(role_ids: list[UUID]) -> set[str]:
    # 1. Fetch policies mapped to active roles
    # 2. Extract permission mapping permissions
    # 3. Apply resolution precedence:
    #    Explicit Deny (wins) -> Explicit Allow -> Inherited Allow -> Default Deny
    ...
```

### API Endpoints
* `GET /api/v1/security/menus`
* `GET /api/v1/security/permissions`
* `GET /api/v1/security/roles`
* `GET /api/v1/security/policies`
* `POST /api/v1/security/roles`
* `PUT /api/v1/security/roles/{id}`
* `DELETE /api/v1/security/roles/{id}`
* `POST /api/v1/security/check`

## 8. Files Created
* **`backend/app/models/security.py`:** SQLAlchemy model declarations for SSACF and dynamic menus.
* **`backend/app/schemas/security.py`:** Pydantic models.
* **`backend/app/services/security.py`:** Permissions flattening, caching, dynamic menu resolution service.
* **`backend/app/api/v1/security.py`:** SSACF controllers.
* **`backend/app/tests/test_security_engine.py`:** Automated tests for RBAC/ABAC and Dynamic menus.

## 9. Files Modified
* **`docs/implementation/README.md`:** Synchronize index table status.
* **`backend/app/main.py`:** Add dynamic router.
* **`backend/app/api/deps.py`:** Add dynamic permission check dependency.
* **`backend/app/db/seed.py`:** Seed generalized lookup types, default roles, policies, and lookups for designations/departments.

## 10. Dependencies
* `SQLAlchemy>=2.0`
* `alembic` (database schema migrations)
* `jsonschema` (validation of dynamic lookup master attributes)

## 11. Risks
* **Cache invalidation delays:** Add cache invalidation hooks to role/policy updates.
* **Database migrations:** Write standalone Alembic migrations, test extensively in the test container.

## 12. Rollback Strategy
* Revert git commits and reset branch workspace.
* Alembic migration downgrade.

## 13. Verification Plan
* Run pytest validation: `docker exec smriti-python-core pytest app/tests/test_security_engine.py`.
* Verify dynamic lookups (departments, designations) populate in UI without 404 console errors.

## 14. Test Plan
* Test role inheritance mappings.
* Test tri-state explicit deny overrides.
* Test dynamic menu presentation filtering using distinct user tokens.

## 15. Documentation Impact
* Update developer onboarding guides for API route security declarations.

## 16. Deployment Plan
* Run DB migrations and seed scripts.
* Restart backend service.

## 17. Status
Approved.

## 18. Related ADRs
N/A

## 19. Related Walkthroughs
N/A
