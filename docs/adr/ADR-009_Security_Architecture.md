# ADR-009: Security Architecture, OAuth2, JWT, & Tenant Isolation

**Status:** APPROVED — v1.0 (2026-07-28)  
**Deciders:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## Context
Multi-tenant enterprise retail operating systems require robust authentication, cryptographic token security, role-based access control (RBAC), and strict data isolation across company branches.

---

## Decision
1. **Authentication**: OAuth2 Password Bearer flow with JWT (RFC 7519) cryptographic tokens (`HS256` / `RS256`).
2. **Tenant & Row Security**: Multi-tenancy enforced via `TenantContext` (`tenant_id`, `company_id`, `branch_id`) injected into SQLAlchemy query filters.
3. **RBAC Permission Scopes**: Fine-grained role permissions (`ITEM.CREATE`, `SALES.INVOICE`, `POS.CHECKOUT`) enforced at API router dependencies.

---

## Consequences
- **Positive**: Zero data leakage across tenants; open standard authorization interoperability.
- **Negative**: Requires passing `TenantContext` through service methods.
