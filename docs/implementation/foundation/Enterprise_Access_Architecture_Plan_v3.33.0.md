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

This plan outlines the design and phased refactoring strategy to transition SMRITI Retail OS to the new Enterprise Access Architecture.

---

## 1. Objective
Refactor the existing role-based access control (RBAC) and permission systems to support SMRITI's new enterprise-grade tiered role structure, hierarchical security scope (Company -> Branch -> Department -> Record), and granular permission codes.

---

## 2. Business Motivation
Provide large-scale retail operators with the administrative granularity required to restrict operations across multiple organizational scopes (multi-company, multi-branch, multi-department) while maintaining absolute data security.

---

## 3. Scope
- **Roles to Support:**
  - Platform Administrator (`SYSADMIN`)
  - Company Owner (`OWNER`)
  - Company Admin (`COMPANY_ADMIN`)
  - Branch Admin (`BRANCH_ADMIN`)
  - Manager (`MANAGER`)
  - Supervisor (`SUPERVISOR`)
  - Staff (`STAFF`)
  - Cashier (`CASHIER`)
- **Scopes to Enforce:**
  - Global (All Tenants)
  - Company (Specific Company)
  - Branch (Specific Branch)
  - Department (Specific Department)
  - Record-Level Security (Own/Assigned documents)
- **Granular Permission Codes:**
  - `sales.invoice.create`, `sales.invoice.edit`, `sales.invoice.delete`
  - `inventory.stock.adjust`, `inventory.stock.view`
  - `users.manage`, `security.audit.view`

---

## 4. Current State
- Native Roles are limited to `SYSADMIN`, `MANAGER`, `CASHIER`, `REPORT_USER`, `VIEWER`.
- Permission checking is handled by `SecurityService` using policy permission assignments with direct bypass for `SYSADMIN`.
- Scoping is primarily dual-layered: Global vs Branch/Company (using `company_id` and `branch_id`).

---

## 5. Gap Analysis
- Missing intermediary roles: `OWNER`, `COMPANY_ADMIN`, `BRANCH_ADMIN`, `SUPERVISOR`, `STAFF`.
- No native department-level or record-level scopes are defined in the auth logic.
- Permission codes are structured in a legacy module-level format (e.g. `CRM.MANAGE_CUSTOMERS` instead of `crm.customer.create`).

---

## 6. Architecture Decisions
- **AD-13 (Hierarchical Role Composition):** Implement nested role inheritance mapping to support ascending authority (e.g., Cashier inherits Staff permissions; Supervisor inherits Cashier; Branch Admin inherits Manager).

---

## 7. Proposed Design
- **User Models Updates:** Update the `UserRole` Enum class in `backend/app/models/auth.py` to support all 8 target roles.
- **Hierarchical Engine:** Refactor `SecurityService.get_effective_roles` to dynamically resolve inherited permissions across all 8 roles.
- **Granular Permission Mappings:** Update database seeds to define policy mappings using the dot-separated enterprise code system.

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
- Cache provider lifecycle (`backend/app/services/cache.py`) for flushing token/permissions cache upon security configuration upgrades.

---

## 11. Risks
- Backwards compatibility breaks during the transition of legacy endpoints to dot-separated permissions.
- Mitigation: Retain fallback mapping tables converting old permission codes (e.g. `ITEM.CREATE`) to new permission formats (e.g. `inventory.item.create`).

---

## 12. Rollback Strategy
Git revert to commit `85b683b` and reload the previous database dump.

---

## 13. Verification Plan
Ensure all existing unit tests in `backend/app/tests/` compile and pass.

---

## 14. Test Plan
Write new integration tests in `backend/app/tests/test_enterprise_security.py` asserting hierarchical role execution, department scoping, and dot-separated permission guard enforcement.

---

## 15. Documentation Impact
Update System User Guide and Developer Guide sections on Roles and Authorization.

---

## 16. Deployment Plan
Run Alembic migration script upgrading `users.role` enum constraints, execute `seed.py`, and restart FastAPI instances.

---

## 17. Status
Draft.

---

## 18. Related ADRs
- **ADR-004:** Scoped Security Configuration.

---

## 19. Related Walkthroughs
- **Walkthrough-v3.25.0:** Cache Provider Abstraction.
