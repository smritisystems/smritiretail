<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-08-15
  Modified     : 2026-08-15
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Company Database Lifecycle Management Specification v1.0

**Status: LIFECYCLE_ARCHITECTURE_AUDITED_PENDING_UI_GATE**  
**Audit Timestamp:** 2026-08-15 06:45:42 UTC  
**Official Control Plane DB:** `smritisys`  
**Reference Company DB:** `smriti001`  

---

## 1. Lifecycle State Machine & Allowed Transitions

```text
PROVISIONING ───► READY ◄──────► SUSPENDED
   │               │                │
   │               ▼                ▼
   │            ARCHIVED ──────► DECOMMISSIONED
   ▼
PROVISION_FAILED ───► RECOVERY_REQUIRED ───► READY
```

---

## 2. 21 Lifecycle Operations Audit & Status

| Op ID | Operation Name | Description | Status |
|---|---|---|---|
| 1-10 | Creation Pipeline | Validate, Allocate Code, Generate DB Name, Provision, Initialize Schema, Health Check, Register, Admin Assign, Set READY | **IMPLEMENTED** |
| 11-12 | Suspend / Resume | Toggle status `SUSPENDED` / `READY` | **PARTIALLY_IMPLEMENTED** |
| 13-14 | Archive / Read-Only | Set status `ARCHIVED`; routing to read-only pool | **MISSING** |
| 15-16 | Health & Schema Check | Pinging database & checking `schema_version` (3.16.0) | **IMPLEMENTED** |
| 17-19 | Secret Rotation & Backup | Credential rotation, backup status tracking & restore | **MISSING** |
| 20-21 | Decommission & Delete | Unregister routing & safe irreversible DB drop | **MISSING** |

---

## 3. Boundary & Isolation Governance

- **`smritisys`**: Identity, Tenancy, DB Registry, RBAC Roles, Licensing, Menus, UI/UX, Audit.
- **`smriti<CODE>`**: Operational Business System of Record (Sales, POS, Stock, Purchases, Ledgers).
- **React Frontend**: Knows `company_id`. NEVER knows raw `database_name`.
