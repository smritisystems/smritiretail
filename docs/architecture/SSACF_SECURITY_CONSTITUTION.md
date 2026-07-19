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

# SMRITI Security & Access Control Framework (SSACF) Security Constitution

This document establishes the frozen governance and architectural rules for SMRITI's security subsystem. Every current and future business module must comply strictly with these rules.

---

## Rule 1 — Authentication Before Authorization
Authentication must always succeed first. No endpoint may evaluate authorization parameters or checks on an unauthenticated identity.

## Rule 2 — SUPER Identity (God Mode)
* `SYSADMIN` (SUPER) is a built-in, hardcoded platform identity.
* SUPER bypasses authorization rules only; it never bypasses authentication requirements.
* SUPER is never stored as a database policy and is never mapped to dynamic database permissions.
* The recovery bypass logic must remain isolated from database operations to prevent lockouts during database corruption.

## Rule 3 — Default Deny
If a permission cannot be explicitly resolved through policy or cache engines, access must be strictly denied. No operations may fail-open.

## Rule 4 — Central Manifest as Source of Truth
Only `permissions.py` defines the catalog of valid permission codes. No API endpoint or service may utilize hardcoded permission string literals that do not exist within the central manifest.

## Rule 5 — Immutable Permission Codes
Once a permission code is introduced (e.g. `SALES.CREATE`), it must never be renamed. If a permission code becomes obsolete, it must be marked as deprecated rather than changing its key string.

## Rule 6 — Functional Policies Only
Policies describe functional business capabilities, not organizational job titles.
* **Allowed:** `POL-SALES-MGMT`, `POL-REPORTING`
* **Prohibited:** `POL-MANAGER`, `POL-OWNER`

## Rule 7 — Role Composition
Roles are structured as logical compositions of functional policies:
```text
Role → Policies → Permissions
```
Direct mapping of large sets of permission IDs to individual roles is prohibited to prevent policy duplication.

## Rule 8 — Immutable Security Auditing
Every security-sensitive event (including login, logout, permission/policy modifications, role assignments, backup/restore, user impersonation, and SUPER bypass) must record a detailed event log in the immutable database audit trail.

## Rule 9 — No Hardcoded Business Roles
End-user authorization must never be evaluated against dynamic role strings (e.g. `if user.role == "Manager"`). Authorization must always evaluate namespaced permissions (`require_permission("SALES.CREATE")`). The only exception is the built-in platform SUPER identity check.

## Rule 10 — Tenant & Branch Isolation
Permissions determine **what** a user is allowed to do. Tenant and branch contexts determine **where** they may perform it. Having a permission code allowed does not permit bypassing company or branch boundaries.

## Rule 11 — Secure by Default
All new API endpoints are closed and protected by default. Developers must explicitly classify and annotate any public or authenticated-only endpoints.

## Rule 12 — Deprecation of Legacy Role Guards
The legacy `require_role()` guard remains active only as a temporary compatibility layer. All new routes and future migrations must strictly utilize the dynamic `require_permission()` dependencies.

## Rule 13 — Separation of Duties
Authorization decisions must remain centralized within the SSACF engine. Business modules must never implement their own ad hoc authorization logic (e.g., checking role strings or hardcoded flags directly). All access control queries must be routed through the SSACF API.

## Rule 14 — Permission Versioning
Every permission code must have lifecycle metadata associated with it (such as introduced version, deprecation status, and replacement code). This allows smooth upgrades and prevents breakage during future platform updates.

