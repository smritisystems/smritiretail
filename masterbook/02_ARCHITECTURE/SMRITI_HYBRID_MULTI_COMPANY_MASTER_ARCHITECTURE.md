<!--
  SMRITI Retail OS — Masterbook
  Document  : 02_ARCHITECTURE/SMRITI_HYBRID_MULTI_COMPANY_MASTER_ARCHITECTURE.md
  Purpose   : Master architecture — hybrid multi-company SaaS platform design
  Status    : FROZEN (AFR-002)
  Version   : 1.4.0  |  Created: 2026-08-10
  Copyright : © SMRITIBooks.com. All Rights Reserved.
-->

# SMRITI Hybrid Multi-Company Master Architecture

**Status: FROZEN — v1.4 (AFR-002)**

No new architectural capabilities may be introduced until Runtime Certification (Phases A–G) is complete.

---

## Platform Overview

SMRITI Retail OS is a **Hybrid Multi-Company SaaS Platform** supporting:
- Single-company retail installations
- Multi-company retail groups (holding company with subsidiaries)
- Multi-branch per company
- Multi-tenant SaaS deployments

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer (React/TSX)                  │
│   SalesBillingStudio · ItemMaster · CRMStudio           │
│   PurchaseStudio · Launchpad · Dashboard                │
└────────────────────┬────────────────────────────────────┘
                     │ SPK Facade Contracts
┌────────────────────▼────────────────────────────────────┐
│               Platform Kernel (SPK.ule)                  │
│   SPK.navigation · SPK.forms · SPK.security             │
│   SPK.workflow · SPK.reports · SPK.printing · SPK.ai    │
│   SPK.commands · SPK.events · SPK.configuration         │
│                                                          │
│   RULE KND-001: No React/DOM dependency in kernel       │
└────────────────────┬────────────────────────────────────┘
                     │ apiFetchV1()
┌────────────────────▼────────────────────────────────────┐
│               FastAPI Backend (Python 3.13)              │
│   API v1 Routers · Business Orchestrators               │
│   Domain Services · Security Guards                     │
└────────────────────┬────────────────────────────────────┘
                     │ SQLAlchemy Async
┌────────────────────▼────────────────────────────────────┐
│             PostgreSQL (asyncpg)                         │
│   Shared schema · Row-Level Security via company_id     │
│   Triggers · Sequences · JSONB columns                  │
└─────────────────────────────────────────────────────────┘
```

---

## Multi-Company Data Model

### Tenancy Hierarchy

```
Platform (SaaS)
    └── Tenant (client organization)
            └── Company (legal entity)
                    └── Branch (physical/logical location)
                            └── User (assigned to company + branch)
```

### Company Isolation Strategy

Every business entity row carries:

```sql
company_id   VARCHAR(50) NOT NULL  -- owning company
branch_id    VARCHAR(50)           -- owning branch (optional for company-wide records)
tenant_id    VARCHAR(50)           -- SaaS tenant
is_active    BOOLEAN NOT NULL DEFAULT true
is_deleted   BOOLEAN NOT NULL DEFAULT false
```

**All queries MUST filter by `company_id` from `TenantContext`.**
**Cross-company data access is a security violation.**

---

## TenantContext Contract

Every API request carries an immutable `TenantContext`:

```python
@dataclass(frozen=True)
class TenantContext:
    tenant_id: str
    company_id: str
    branch_id: str
    user_id: str
    username: str
    role: str
    record_scope: str   # SELF | TEAM | BRANCH | COMPANY | ALL
```

`TenantContext` is resolved from the JWT token at the dependency layer (`get_tenant_context`).
**It is read-only for the duration of a request (UCR-006).**

---

## Multi-Company Workspace Switching

### Frontend Flow

```
User authenticates (username + password)
    ↓
JWT issued: { sub, company_id, branch_id, role }
    ↓
Launchpad renders (modules for current company)
    ↓
User clicks "Switch Company"
    ↓
POST /api/v1/auth/switch-company  { company_id }
    ↓
New JWT issued for selected company
    ↓
SPK.events.emit("Workspace.Changed.v1")
    ↓
All kernel services flush company-sensitive caches
(CustomerService.localCache = [], etc.)
    ↓
UI re-renders for new company context
```

### Workspace.Changed.v1 Subscriber Pattern

Any service or UI component holding company-sensitive state MUST subscribe:

```typescript
SPK.events.on("Workspace.Changed.v1", () => {
  this.localCache = [];  // flush all company-sensitive data
});
```

This is **mandatory** for every service that caches API data (SCS-WSC-002).

---

## Command Pattern (SPK.commands)

All state-changing operations use the Command pattern:

```typescript
SPK.commands.execute(new CreateSalesInvoiceCommand({
  customerId: selectedCustomer.id,
  invoiceDate: docDate,
  items: [...],
  ...
}));
```

Commands are registered in `SPK.commands.registry`.
The kernel routes them to the appropriate handler.

---

## Platform Kernel Services (SPK.ule)

| Service | Responsibility |
|---|---|
| `SPK.navigation` | Domain sidebar metadata, module registry |
| `SPK.commands` | Command registration and execution |
| `SPK.events` | Cross-component event bus (pub/sub) |
| `SPK.security` | Permission evaluation, role hierarchy |
| `SPK.forms` | Metadata-driven form registry |
| `SPK.configuration` | Branding, regional, environment config |
| `SPK.workflow` | State machine and transition execution |
| `SPK.reports` | Report registry and execution |
| `SPK.printing` | Print template registry and rendering |
| `SPK.ai` | AI skill registry and execution |

---

## API Layer Contract

### Base URL
All API calls use versioned prefix: `/api/v1/`

### Standard Client
```typescript
apiFetchV1(endpoint, options)
// Automatically injects JWT Bearer token
// Handles 401 → redirect to login
// Handles offline → OfflineSessionBadge
```

### Response Envelope
Backend always returns Pydantic-serialized responses.
camelCase ↔ snake_case bridged via `AliasChoices` in Pydantic schemas.

---

## Runtime Certification Phases (A–G)

Until all phases are complete, **no new architectural capabilities** may be introduced:

| Phase | Focus |
|---|---|
| A | Core authentication and multi-company switching |
| B | Sales invoice end-to-end (customer → invoice → payment) |
| C | Purchase order end-to-end |
| D | Inventory management (stock ledger, movements) |
| E | Accounting (journal entries, ledger) |
| F | Reporting and consolidation |
| G | Production readiness (security hardening, performance, monitoring) |

---

*Status: FROZEN — AFR-002 | Version: 1.4.0 | 2026-08-10*
