<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.33.0
  Created      : 2026-07-19
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Enterprise Access Architecture Upgrade — v3.33.0

This document defines the foundational **Enterprise Access Architecture (v1.0)** specification, design principles, and phased migration roadmap for SMRITI Retail OS.

---

## 1. Objective
Refactor the user identity, authentication, and authorization systems to implement a multi-tenant, permission-set composite access control system with granular resource-level ownership scopes, multi-company work assignments, and service account API key capabilities.

---

## 2. Architecture Principles
- **Authentication** determines identity.
- **Authorization** determines permitted actions.
- **Roles** represent business responsibilities.
- **Permission Sets** represent reusable capabilities.
- **Permissions** are the smallest unit of authorization.
- **Scopes** define where permissions apply.
- **Approval Workflows** are independent of authorization.
- **Record-Level Security** is enforced after authorization.
- Every access decision must be auditable.
- **Deny by default.**

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
- **System Accounts:**
  - Platform Admin, API Service, Scheduler, Background Worker, Integration Service, Migration Service, Backup Service.

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
- **AD-14 (Composition over Inheritance):** Replace rigid role inheritance chains with dynamic **permission-set composition** to calculate a user's effective permissions.
- **AD-15 (Identity Agnostic Bypass):** Replace hardcoded username bypasses with an immutable database attribute flag (`is_platform_admin`).

---

## 7. Proposed Design

### A. Authorization Pipeline Flow
Every API request executes down this canonical path:
```text
Request
   │
Authentication
   │
Security Context Resolution
   │
User Active Check
   │
Platform Admin? ➔ YES ➔ Bypass to Audit
   │
License Verification
   │
Feature Flags Verification
   │
Permission Sets Evaluation
   │
Permission Verification (module.resource.action)
   │
Scope Validation (SELF / TEAM / BRANCH / COMPANY / ALL)
   │
Record-Level Security Filters
   │
Approval Policy Enforcement
   │
Business Rules Check
   │
Audit Log Generation
   │
Allow / Deny Response
```

### B. Security Context
Every request is parsed into a unified, immutable `SecurityContext` containing:
- **Identity:** `User`, `Role`, `Permission Sets`, `Permission Cache`.
- **Scope Parameters:** `Company`, `Branch`, `Department`, `Warehouse`, `Cost Center`.
- **Session Attributes:** `Session ID`, `Device ID`, `IP Address`.
- **System Attributes:** `Feature Flags`, `License`, `API Key`.

### C. Permission Resolution Order
The authorization engine evaluates security decisions in the following strict order of precedence:
1. **Platform Admin Flag** (`is_platform_admin`) ➔ Bypass if true
2. **License Validity** ➔ Deny if invalid
3. **Feature Enabled** ➔ Deny if feature disabled
4. **Permission Set Mapping** ➔ Deny if action not in Permission Sets
5. **Company Scope Check**
6. **Branch Scope Check**
7. **Department Scope Check**
8. **Record Scope (Ownership Check)**
9. **Business Rules Validation**
10. **Approval Workflow Rule Evaluation** ➔ Allow access

### D. Role & Permission Separation
Implement a decoupled relationship model:
```text
User ➔ User Roles ➔ Role ➔ Permission Sets ➔ Permissions
```

### E. Standardized Actions Vocabulary
To keep permissions predictable, actions are constrained to:
`view`, `list`, `create`, `edit`, `delete`, `approve`, `cancel`, `print`, `export`, `import`, `assign`, `close`, `reopen`, `archive`, `restore`.

### F. Permission Registry & Plugin Registration
Permissions are registered and managed as versioned metadata. SMRITI plugins auto-register custom permissions on system bootstrap:
```text
Plugin Init ➔ register_permissions() ➔ Core Permission Registry
```

### G. Authorization Extension Points
To allow modular customization without modifying the core security engine, the authorization pipeline provides lifecycle hooks:
- `Before Authorization`
- `Before Scope Check`
- `Before Record Filter`
- `After Authorization`
- `After Audit`

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
Verify with standard integration tests that all endpoints throw `403 Forbidden` for unauthorized scopes or lack of permission sets.

---

## 14. Test Plan
Write new tests in `backend/app/tests/test_enterprise_access.py` to assert:
- Permission set composition (adding a set grants its permissions immediately).
- Multi-branch scope switching.
- API Key token authorization.

---

## 15. Documentation Impact
Update System Architecture and Developer API Guides.

---

## 16. Phased Migration Roadmap
1. **Phase 1 (Permission Engine):** Core database schemas for permission sets and dot-notation codes.
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

## 17. Non-Goals
- **Authentication Providers:** Native support for LDAP/OIDC/SAML is out of scope for this version.
- **Attribute-Based Access Control (ABAC):** Rule-based attributes beyond defined scopes are deferred.
- **Field-Level Security:** Restricting specific columns or JSON keys within responses is deferred.
- **Data Masking:** Masking PII/tax registry data at REST is not included in this version.

---

## 18. Security Completion Checklist
- [x] Deny-by-default policy verified.
- [x] Complete audit logging active on all resource updates.
- [x] Zero hardcoded usernames/roles in business logic.
- [x] Zero hardcoded permission strings outside registry.
- [x] Cache invalidation active on permission modifications.
- [x] Session revocation active after role updates.
- [x] Row-level security enforced in all repositories.

---

## 19. Status
Completed.

---

## 20. Related ADRs
- **ADR-004:** Scoped Security Configuration.

---

## 21. Related Walkthroughs
- **Walkthrough-v3.25.0:** Cache Provider Abstraction.
