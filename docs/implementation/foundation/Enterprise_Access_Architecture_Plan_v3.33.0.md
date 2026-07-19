<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.33.0
  Created      : 2026-07-19
  Modified     : 2026-07-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Enterprise Access Architecture Upgrade — v3.33.0

This plan outlines the updated architecture and phased migration roadmap for the enterprise-grade permissions, roles, and scope control system in SMRITI Retail OS.

---

## 1. Objective
Refactor the existing user identity, authentication, and authorization systems to implement a multi-tenant, permission-group composite access control system with granular resource-level ownership scopes, multi-company work assignments, and service account API key capabilities.

---

## 2. Business Motivation
Provide modern retail enterprises with the operational granularity required to manage diverse staff roles across complex multi-branch, multi-warehouse, and multi-department corporate structures while maintaining strict data isolation and auditability.

---

## 3. Scope
- **Future-Proof Role List:**
  - **Platform-Level Roles:** `SYSADMIN` (Platform Admin), `SUPPORT_ENGINEER`, `LICENSE_MANAGER`, `AUDITOR`, `API_SERVICE`.
  - **Company-Level Roles:** `OWNER`, `COMPANY_ADMIN`, `FINANCE_HEAD`, `SALES_HEAD`, `HR_HEAD`, `CRM_HEAD`, `IT_ADMIN`.
  - **Branch-Level Roles:** `BRANCH_ADMIN`, `MANAGER`, `SUPERVISOR`, `STAFF`, `CASHIER`.
- **Granular Dot-Notation Permissions:**
  - Format: `module.resource.action` (e.g., `inventory.item.create`, `sales.invoice.cancel`, `system.settings.edit`).
- **Record-Level Security Scopes:**
  - `SELF` (own records), `TEAM` (group/department), `BRANCH` (current location), `COMPANY` (legal entity), `ALL` (global platform).

---

## 4. Current State
- Native Roles are limited to `SYSADMIN`, `MANAGER`, `CASHIER`, `REPORT_USER`, `VIEWER`.
- Permission checks are handled via direct bypass for `SYSADMIN` based on string role matching.
- User scoping is strictly single-company and single-branch.

---

## 5. Gap Analysis
- Role inheritance model results in implicit permission accumulation that is difficult to audit.
- No support for multi-company or multi-branch staff assignment.
- Lack of distinct separation between access control, record ownership, and approval workflows.

---

## 6. Architecture Decisions
- **AD-13 (Separation of Identity Concerns):** Keep roles, permissions, scopes, and approval workflows as entirely separate, decoupled concerns.
- **AD-14 (Composition over Inheritance):** Replace rigid role inheritance chains with dynamic **permission-group composition** to calculate a user's effective permissions.
- **AD-15 (Identity Agnostic Bypass):** Replace hardcoded username bypasses with an immutable database attribute flag (`is_platform_admin`).

---

## 7. Proposed Design

### A. Role & Permission Separation
Implement a decoupled relationship model:
```text
User ➔ User Roles ➔ Role ➔ Permission Groups ➔ Permissions
```

### B. User Multi-Scope Assignment Tables
Introduce relational association tables supporting cross-branch and cross-company assignments:
- `user_company`: Scopes company-level access.
- `user_branch`: Scopes location-level access.
- `user_department`: Scopes division-level access.
- `user_warehouse` / `user_cost_center`: Scopes operational resources.

### C. Record-Level Security Ownership
Map users to data access tiers:
- `Sales Executive` ➔ View: `SELF`
- `Branch Manager` ➔ View: `BRANCH`
- `Company Owner` ➔ View: `COMPANY`
- `SYSADMIN` ➔ View: `ALL`

### D. Decoupled Approval Engine
Differentiate between resource access (e.g., creating a purchase order) and validation workflow (e.g., signing off or approving a purchase order based on financial limits).

### E. Service Account API Keys
Add support for non-human `API Key` tokens mapped directly to scoped permissions (e.g. `inventory.*` read-only) to allow automated third-party integrations.

---

## 8. Files Created
- `docs/implementation/foundation/Enterprise_Access_Architecture_Plan_v3.33.0.md`

---

## 9. Files Modified
- [backend/app/models/auth.py](file:///f:/SMRITRretailNXmgrt/backend/app/models/auth.py)
- [backend/app/services/security.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/security.py)
- [backend/app/db/seed.py](file:///f:/SMRITRretailNXmgrt/backend/app/db/seed.py)

---

## 10. Dependencies
- FastAPI dependency injection pipeline (`backend/app/api/deps.py`).
- Alembic database migration engines.

---

## 11. Risks
- Performance overhead from checking multiple scope association tables at runtime.
- Mitigation: Implement Redis/Memory caching for resolved user permissions and scopes with invalidation triggers on update.

---

## 12. Rollback Strategy
Revert database schema using Alembic downgrade instructions and restore code to commit `85b683b`.

---

## 13. Verification Plan
Verify with standard integration tests that all endpoints throw `403 Forbidden` for unauthorized scopes or lack of permission groups.

---

## 14. Test Plan
Write new tests in `backend/app/tests/test_enterprise_access.py` to assert:
- Permission group composition (adding a group grants its permissions immediately).
- Multi-branch scope switching.
- API Key token authorization.

---

## 15. Documentation Impact
Update System Architecture and Developer API Guides.

---

## 16. Phased Migration Roadmap
1. **Phase 1 (Permission Engine):** Core database schemas for permission groups and dot-notation codes.
2. **Phase 2 (Authentication):** Support for `is_platform_admin` flag and token payload updates.
3. **Phase 3 (Authorization):** Composite permission checks in `require_permission`.
4. **Phase 4 (Scope Engine):** Multi-company/branch assignment tables implementation.
5. **Phase 5 (Record Security):** Row-level filtering interceptors (SELF, BRANCH, COMPANY).
6. **Phase 6 (Approval Engine):** Decoupled multi-stage approval states.
7. **Phase 7 (API Security):** Scoped API Key service accounts.
8. **Phase 8 (UI Refactor):** Menu and layout rendering adjustments.
9. **Phase 9 (Testing):** Automation and stress-testing under peak concurrent requests.
10. **Phase 10 (Documentation):** Final Developer manuals and ADR revisions.

---

## 17. Status
Draft.

---

## 18. Related ADRs
- **ADR-004:** Scoped Security Configuration.

---

## 19. Related Walkthroughs
- **Walkthrough-v3.25.0:** Cache Provider Abstraction.
