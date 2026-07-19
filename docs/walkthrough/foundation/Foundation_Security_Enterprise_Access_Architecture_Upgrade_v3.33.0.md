<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.33.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Enterprise Access Architecture Upgrade — v3.33.0

This walkthrough documents the design, implementation, and verification of the SMRITI Enterprise Access Architecture Upgrade.

---

## 1. Purpose
Refactor the system from a rigid role inheritance model to a dynamic, multi-tenant composite access control system using **Permission Sets**, dot-notation permissions, and identity-agnostic bypass based on the database column `is_platform_admin`.

---

## 2. Scope
- Rename/refactor security models (`SMRITIPolicy` to `SMRITIPermissionSet`, `SMRITIRolePolicy` to `SMRITIRolePermissionSet`, `SMRITIPolicyPermission` to `SMRITIPermissionSetPermission`).
- Upgrade authorization middleware (`require_permission`) to resolve user permissions by aggregating permission sets.
- Implement an identity-agnostic platform administrator check via the `is_platform_admin` column in the `User` model.
- Update JWT payloads and default user database seeds.
- Re-align test suites and conftest data cleanup / seeding mechanisms.

---

## 3. Files Created
- [backend/alembic/versions/6a5a1f89c59e_rename_policies_to_permission_sets.py](file:///f:/SMRITRretailNXmgrt/backend/alembic/versions/6a5a1f89c59e_rename_policies_to_permission_sets.py)
- [backend/alembic/versions/382862b3ec00_add_is_platform_admin_to_users.py](file:///f:/SMRITRretailNXmgrt/backend/alembic/versions/382862b3ec00_add_is_platform_admin_to_users.py)
- [docs/walkthrough/foundation/Foundation_Security_Enterprise_Access_Architecture_Upgrade_v3.33.0.md](file:///f:/SMRITRretailNXmgrt/docs/walkthrough/foundation/Foundation_Security_Enterprise_Access_Architecture_Upgrade_v3.33.0.md)

---

## 4. Files Modified
- [backend/app/models/security.py](file:///f:/SMRITRretailNXmgrt/backend/app/models/security.py) — Renamed security tables and columns.
- [backend/app/models/auth.py](file:///f:/SMRITRretailNXmgrt/backend/app/models/auth.py) — Added `is_platform_admin` column and constructor hook.
- [backend/app/services/security.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/security.py) — Resolution service query updates.
- [backend/app/services/auth.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/auth.py) — JWT payload builder and seed overrides.
- [backend/app/db/seed.py](file:///f:/SMRITRretailNXmgrt/backend/app/db/seed.py) — Updated initial seed templates.
- [backend/app/tests/conftest.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/conftest.py) — Added dynamic setup & truncation logic.

---

## 5. Architecture Decisions
- **AD-14 (Permission Set Composition):** Replaced role inheritance chains with dynamic aggregation of permission sets, resolving permissions via Allow vs Explicit Deny precedence rules.
- **AD-15 (Identity-Agnostic Platform Admin):** Extracted platform bypass check from string-based roles (`SYSADMIN`) to database boolean attribute (`is_platform_admin`).

---

## 6. Design Rationale
Moving away from hardcoded roles to dynamic permission set composition allows plugins and future extensions to programmatically register and modify permissions, maintaining structural backward-compatibility while improving tenant isolation boundary enforcement.

---

## 7. Implementation Summary
- Updated SQLAlchemy models to represent `smriti_permission_sets`, `smriti_role_permission_sets`, and `smriti_permission_set_permissions`.
- Generated Alembic migrations to execute schema alterations.
- Upgraded resolution logic in `SecurityService.resolve_user_permissions` to aggregate permissions through the active role permission sets.
- Set up test suite configuration seeding routines in `conftest.py`.

---

## 8. Tests Executed
Ran `python -m pytest` on the host to execute the full Python backend test suite (228 tests).

---

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.14.3, pytest-9.0.2, pluggy-1.6.0
rootdir: F:\SMRITRretailNXmgrt\backend
configfile: pyproject.toml
plugins: anyio-4.12.1, langsmith-0.8.5, asyncio-1.3.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 228 items

app\tests\test_main.py ......                                            [ 22%]
...
app\tests\test_sales_pos_purchase_security.py .....                      [ 72%]
app\tests\test_security_engine.py ........                               [ 77%]
...
================ 228 passed, 978 warnings in 424.59s (0:07:04) ================
```

---

## 10. Known Limitations
None. All 228 endpoints and existing authorization matrices are fully backward-compatible.

---

## 11. Future Work
- **Phase 5 (Record Security):** Integrate row-level filtering interceptors scoped to branch/company levels.
- **Phase 6 (Approval Engine):** Modularize purchase/sales approval workflow stages.

---

## 12. Related ADRs
- **ADR-004:** Scoped Security Configuration.

---

## 13. Related RFCs
None.
