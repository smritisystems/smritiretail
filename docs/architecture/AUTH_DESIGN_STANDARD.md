# SMRITI Authentication Design Standard (AUTH-001)

**Status:** 🔒 **FROZEN (Standard v1.0)**  
**Priority:** P0 (Mandatory Security Specification)  
**Applies To:** Auth Orchestrator, User Store, RBAC Engine, Login UI, Company Switcher  

---

## Objective

Implement a secure, enterprise-grade login flow where user identity is authenticated **first**, before resolving authorized companies, branches, or tenant resources.

---

## Core Authentication Philosophy

> **Authenticate User ──► Resolve Assigned Tenant ──► Resolve Company ──► Resolve Branch ──► Load Permissions ──► Open Workspace**

**Never:**

> **Choose Company ──► Login**

The software must adapt to the user's authorized access—not require the user to choose infrastructure or database details before authentication.

---

## Authentication Flow Architecture

```text
Login Screen (Username + Password)
   │
   ▼
Authenticate User Credentials
   │
   ▼
Load User Access Profile & Access Mapping (`UserCompanyAccess`)
   │
   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    ASSIGNMENT RESOLUTION ENGINE                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ ├── Single Assignment (1 Company & 1 Branch):                        │
│ │   └── Auto-select assigned Company, Branch, & Tenant.              │
│ │       Open Default Workspace directly (Zero Prompts).              │
│ │                                                                    │
│ └── Multiple Assignments (> 1 Company):                              │
│     └── Display ONLY authorized companies assigned to user.          │
│         User selects target Company ──► Open Workspace.              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Access Mapping Schema (`UserCompanyAccess`)

After authentication, query active assignments assigned to the authenticated user:

```sql
SELECT 
    user_id,
    company_id,
    database_id,
    branch_id,
    role_id,
    default_company,
    default_branch,
    active
FROM UserCompanyAccess
WHERE user_id = ?
  AND active = true;
```

---

## Security Rules

1. **Zero Unassigned Exposure:** Never display or expose companies, databases, or branches the user is not authorized to access.
2. **No Infrastructure Selection:** Never allow manual database or connection string selection on login forms.
3. **Token-Bound Claims:** All company, branch, and role authorizations MUST be encoded inside or verified against the authenticated user's JWT session token.
4. **Post-Login Switcher:** Company switching is permitted ONLY after successful authentication via profile settings or top header switcher.
