<!--
  Project         : SMRITI Retail OS
  Organization    : SmritiSys

  Founders
  • Pushpa Devi Jawahar Mallah
    Founder & Chairperson

  • Jawahar Ramkripal Mallah
    Founder, Chief Executive Officer (CEO) &
    Chief Systems Architect

  Email           : support@smritisys.com
  Website         : https://smritisys.com
  Other Domains   : smritibooks.com | erpnbook.com | aitdl.com

  Version         : 3.32.0
  Created         : 2026-07-19
  Modified         : 2026-07-19

  Copyright       : © SmritiSys. All Rights Reserved.
  License         : Proprietary Commercial Software
  Classification  : Internal
-->

# SMRITI Retail OS REST API Guide

This document describes the API layout, routing conventions, status codes, and error formatting standards of SMRITI Retail OS.

---

## 1. REST Layout Conventions

All REST APIs are versioned under the `/api/v1/` prefix:
* **JSON Payloads:** All input/output payloads utilize `CamelCase` in schemas where matching JavaScript variables.
* **HTTP Verbs:**
  * `GET`: Query resources (idempotent).
  * `POST`: Create new entities.
  * `PATCH`: Field-level updates.
  * `DELETE`: Deactivate / soft-delete profiles.

---

## 2. Core API Modules

| Module Path | HTTP Method | Action | Auth Required | Roles |
| --- | --- | --- | :---: | --- |
| `/api/v1/auth/bootstrap` | `POST` | First-run setup admin | No | None (blocks if user exists) |
| `/api/v1/auth/login` | `POST` | Authenticate credentials | No | None |
| `/api/v1/auth/refresh` | `POST` | Invalidate/rotate JWTs | No | None |
| `/api/v1/auth/logout` | `POST` | Revoke current session | Yes | All Roles |
| `/api/v1/auth/me` | `GET` | Retrieve profile metadata | Yes | All Roles |
| `/api/v1/users/` | `POST` | Create new staff profiles | Yes | MANAGER, SYSADMIN |
| `/api/v1/users/{id}` | `PATCH` | Update staff details | Yes | MANAGER, SYSADMIN (or self) |

---

## 3. Human-Readable Errors (HREP)

SMRITI APIs never leak python trackbacks or raw SQL syntax errors to clients. Errors use the structured user experience layout:

```json
{
  "title": "Access Denied",
  "explanation": "Your account does not have the required permission (INVENTORY_EDIT) to perform this action.",
  "suggested_action": "Please contact your system administrator to assign the appropriate policy.",
  "reference_id": "SMRITI-PERM-001"
}
```
Standard reference IDs include:
* `SMRITI-PERM-001`: Access and permissions denied errors.
* `SMRITI-VAL-001`: Request validation and Pydantic validation failures.
* `SMRITI-NET-001`: Internal server and upstream connection issues.
