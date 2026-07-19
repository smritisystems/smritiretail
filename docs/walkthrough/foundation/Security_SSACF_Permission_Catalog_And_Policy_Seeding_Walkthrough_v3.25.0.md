<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.25.0
  Created      : 2026-07-19
  Modified     : 2026-07-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SSACF Phase 2.2 — Permission Catalog & Policy Seeding

Evolve SMRITI's security framework by implementing a centralized Permission Manifest, seeding decoupled functional policies, and executing an incremental risk-based endpoint migration.

## 1. Purpose
Establish a centralized, dynamic, and configuration-driven permission system for SMRITI Retail OS. Transition the backend from simple role-based constraints (`require_role()`) to granular permission verification mapped via functional policies, providing a scalable foundation for multi-tenant enterprise configurations.

## 2. Scope
* Centralize all security permission codes inside a typed manifest file (`permissions.py`).
* Expand database seeding in `seed.py` to populate all namespaced permissions, functional policies, and role mappings.
* Implement a special `SYSADMIN` identity bypass ("SUPER" God Mode) that operates outside the dynamic database policies to prevent lockout scenarios.
* Perform Phase 1 incremental endpoint migration (Docs, Reports, and Masters modules) to the new `require_permission()` dependencies.
* Write comprehensive integration and regression test coverage.

## 3. Files Created
* [permissions.py](file:///f:/SMRITRretailNXmgrt/backend/app/core/permissions.py) - Contains the central manifest of typed permission definitions, categories, and self-validation routines.
* [SSACF_SECURITY_CONSTITUTION.md](file:///f:/SMRITRretailNXmgrt/docs/architecture/SSACF_SECURITY_CONSTITUTION.md) - Contains the 14 frozen governance rules and constitution of the SMRITI authorization subsystem.


## 4. Files Modified
* [seed.py](file:///f:/SMRITRretailNXmgrt/backend/app/db/seed.py) - Updated to dynamically seed permissions from the manifest, setup functional policies (`POL-SALES-MGMT`, etc.), and link them to system roles.
* [docs.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/docs.py) - Migrated endpoint dependencies to namespaced permission guards.
* [reports.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/reports.py) - Migrated manual role checks to `require_permission("REPORT.VIEW")` and `require_permission("REPORT.EXPORT")`.
* [masters.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/masters.py) - Migrated organization master routes to `require_permission` guards.
* [test_security_engine.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/test_security_engine.py) - Added test cases covering cache invalidation, multi-policy aggregation, and SYSADMIN God Mode bypass.

## 5. Architecture Decisions
* **Bypass-First Authorization for SYSADMIN:** The platform owner/SYSADMIN role sits above the dynamic database configuration to protect system administration from database schema or query corruption.
* **SUPER Authorization Principle:** SUPER (SYSADMIN) bypasses **authorization, not authentication**. Authentication must always succeed first, and every SUPER action must be recorded in an immutable audit log. This preserves security while ensuring the platform owner can always recover and administer the system.
* **Functional Decoupled Policies:** Instead of creating role-named policies, policies are defined by business function (e.g. `POL-CRM-MGMT`, `POL-SALES-MGMT`). Roles are structured as compositions of these policies.

## 6. Design Rationale
* **Manifest Typing:** Using a typed `PermissionDefinition` class with runtime checking on module import guarantees that malformed permissions or duplicate codes are detected instantly.
* **Risk-Phased Migration:** Incremental endpoint migration minimizes regression risk on high-revenue business streams (like POS Checkout) while testing the runtime performance of the caching engine in lower-risk environments (like Docs and Reports).

## 7. Implementation Summary
* Introduced namespaced permission definitions: `SYSTEM.*`, `SECURITY.*`, `SALES.*`, `PURCHASE.*`, `ITEM.*`, `INVENTORY.*`, `CRM.*`, `REPORT.*`, `BACKUP.*`, `RESTORE.*`, `USER.*`, `ROLE.*`, `POLICY.*`, `PERMISSION.*`, `COMPANY.*`, `BRANCH.*`, `DEPARTMENT.*`, `SUPPLIER.*`, `ACCOUNT.*`, `PAYMENT.*`, `WORKFLOW.*`, `APPROVAL.*`, `MENU.*`, `DASHBOARD.*`, `SETTINGS.*`, `AUDIT.*`.
* Integrated automatic validation run on Python import to prevent drift or duplicate registrations.
* Mapped policies to 11 system roles including Owner, Company/Branch Administrator, Shift Supervisor, and Cashier.

## 8. Tests Executed
We ran the complete suite of integration tests inside the Python backend test environment:
`python -m pytest backend/app/tests/test_security_engine.py`

## 9. Verification Results
```text
collected 8 items

backend\app\tests\test_security_engine.py ........                       [100%]

======================== 8 passed, 2 warnings in 3.73s ========================
```

## 10. Known Limitations
* Legacy `UserRole` enums still exist for remaining non-migrated endpoints and will be retired gradually as business modules are migrated.

## 11. Future Work
* Phase 2.3: Migrate high-risk revenue endpoints (Sales, POS, Purchase).
* Phase 2.4: Introduce frontend `usePermission()` security hook.

## 12. Related ADRs
* `ADR-012-SSACF-Role-Engine`

## 13. Related RFCs
* `RFC-024-Granular-Permission-Catalog`
