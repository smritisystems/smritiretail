<!--
  SMRITI Retail OS — Masterbook
  Document  : 03_SECURITY/USER_COMPANY_ASSIGNMENT.md
  Status    : FROZEN
  Version   : 1.0.0  |  Created: 2026-08-10
-->

# User ↔ Company Assignment

---

## Purpose

A single SMRITI user account can be assigned to **multiple companies**. The `UserCompanyAssignment` table governs which companies a user can access and which is their default.

---

## Data Model

### `users` table (key columns)
```sql
id          VARCHAR(50) PRIMARY KEY   -- e.g. "usr-abc123"
username    VARCHAR(100) UNIQUE NOT NULL
role        VARCHAR(30)               -- SYSADMIN | MANAGER | CASHIER | OWNER | ...
company_id  VARCHAR(50)               -- "home" company (default context)
branch_id   VARCHAR(50)               -- default branch
is_active   BOOLEAN NOT NULL
is_deleted  BOOLEAN NOT NULL
```

### `user_company_assignments` table
```sql
id          VARCHAR(50) PRIMARY KEY
user_id     VARCHAR(50) REFERENCES users(id)
company_id  VARCHAR(50) REFERENCES companies(id)
branch_id   VARCHAR(50)               -- optional: restrict to specific branch
is_default  BOOLEAN NOT NULL DEFAULT false
is_active   BOOLEAN NOT NULL DEFAULT true
is_deleted  BOOLEAN NOT NULL DEFAULT false
```

### `user_branch_assignments` table (optional fine-grain)
```sql
id          VARCHAR(50) PRIMARY KEY
user_id     VARCHAR(50) REFERENCES users(id)
branch_id   VARCHAR(50) REFERENCES branches(id)
is_active   BOOLEAN NOT NULL DEFAULT true
```

---

## Company Switch Flow

```
POST /api/v1/auth/switch-company
Body: { "company_id": "comp-xyz" }
Auth: Bearer <current_token>

Validation:
  1. Verify user has UserCompanyAssignment for requested company_id
  2. Verify assignment is_active = true, is_deleted = false
  3. Issue new JWT with updated company_id + branch_id

Response:
  { "access_token": "...", "company_id": "comp-xyz", "branch_id": "br-..." }
```

**Frontend must then:**
1. Store the new JWT
2. Emit `SPK.events.emit("Workspace.Changed.v1")`
3. All services flush company-sensitive caches
4. UI re-renders for new company context

---

## JWT Payload Structure

```json
{
  "sub": "usr-abc123",
  "username": "jawahar",
  "role": "MANAGER",
  "company_id": "comp-alpha",
  "branch_id": "br-main",
  "tenant_id": "tenant-smriti",
  "jti": "unique-token-id",
  "exp": 1722000000
}
```

`company_id` in the JWT is the **authoritative source** for all tenant context resolution.

---

## Auth Rule: Single Assignment Auto-Select (AUTH-003)

If the authenticated user has access to exactly **1 company**, auto-select it and open the dashboard directly. Do NOT show a company selector.

If the user has **N > 1 companies**, show the company selector screen (AUTH-004).

---

## Cascading Security Context

When a user switches company:

| Layer | What Happens |
|---|---|
| Backend JWT | New token issued with new `company_id` |
| TenantContext | Rebuilt from new JWT on every request |
| Frontend Services | `Workspace.Changed.v1` flushes all caches |
| CustomerService | `localCache = []` |
| Any other service | Must also subscribe to `Workspace.Changed.v1` |
| UI State | `selectedCustomer`, `selectedItem`, etc. reset to null |

**Critical:** Failing to subscribe to `Workspace.Changed.v1` causes company A data to silently appear in company B's session (SCS-WSC-002).

---

*Status: FROZEN | Version: 1.0.0 | 2026-08-10*
