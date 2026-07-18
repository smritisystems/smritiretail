<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.30.0
  Created      : 2026-07-19
  Modified     : 2026-07-19
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SaaS Tenant Isolation & Data Security Architecture Plan -- v3.30.0

## 1. Objective
Upgrade SMRITI Retail OS from a multi-company, multi-GSTIN model to a true, SaaS-ready multi-tenant architecture. This plan introduces a top-level `tenant_id` across all transactional, master, security, and settings tables, and enforces data isolation at the ORM/repository layers.

## 2. Business Motivation
Deploying SMRITI Retail OS in the cloud as a SaaS platform requires strict security boundaries. A compromised tenant must never access another tenant's data. Adding a top-level `tenant_id` enables row-level database filtering and secures multi-branch corporate group setups within a shared database architecture.

## 3. Scope
- **Core Models Refactor:** Add `tenant_id` column to all tables extending `BaseEntity` (excluding system-level lookup tables).
- **Tenant Context Extension:** Update `TenantContext` in `backend/app/api/deps.py` to include `tenant_id` resolved from JWT claims.
- **ORM Automatic Query Filtering:** Integrate a SQLAlchemy `before_compile` event interceptor to automatically inject `tenant_id` filters on all selects.
- **SaaS Hierarchy Enforcement:** Establish the strict hierarchy: `Tenant -> Company -> GSTIN -> Branch -> Warehouse -> Documents`.
- **User Authentication:** Bind user security profiles directly to `tenant_id` values.

## 4. Current State
- `TenantContext` only tracks `company_id` and `branch_id`.
- Tenant isolation is procedurally enforced in service files (e.g. `company_id == tenant_ctx.company_id`) without unified top-level tenant boundaries.

## 5. Gap Analysis
- No `tenant_id` column present in SQL databases.
- Multi-tenant cloud deployments risk data leaks if a single company filter is omitted in custom queries.

## 6. Architecture Impact
```text
           Request Header / JWT Token
                      │
                      ▼
       TenantContext (tenant_id resolved)
                      │
                      ▼
   SQLAlchemy Compile Event Interceptor
                      │
                      ▼ (Appends WHERE tenant_id = :tenant_id)
        PostgreSQL Row Isolation
```

## 7. Proposed Design
1. **Base Model Update:**
   Update `BaseEntity` (`backend/app/models/base.py`) to declare:
   ```python
   tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
   ```
2. **Alembic Migration:**
   Generate a migration schema to add `tenant_id` to all entity tables and backfill it with default tenant seeds.
3. **Implicit ORM Interceptor:**
   Use SQLAlchemy compilation events to inject the active tenant filter onto all select statements dynamically:
   ```python
   @event.listens_for(Query, "before_compile", retval=True)
   def filter_by_tenant(query):
       # Append tenant filter if entity inherits from BaseEntity
       pass
   ```

## 8. Files Created
- `backend/alembic/versions/f7g8h9i0j1k2_add_tenant_isolation_v3300.py`

## 9. Files Modified
- `backend/app/models/base.py`
- `backend/app/api/deps.py`
- `backend/app/schemas/user.py`

## 10. Dependencies
- FastAPI JWT Auth handler dependencies.

## 11. Risks
- Database backfill migration might fail or locks active production tables. Backfill must be executed in staged batches.

## 12. Rollback Strategy
- Database backup restoration and Alembic downgrade script.

## 13. Verification Plan
- Unit tests verifying that querying database objects without a tenant context raises authorization errors or returns zero results.

## 14. Test Plan
- `test_cross_tenant_query_leakage`: Query tenant B's records with tenant A's context, asserting 404/empty.
- `test_automatic_tenant_injection`: Write new entity and verify database automatically registers tenant ID.

## 15. Documentation Impact
- Add "SaaS Architecture Guidelines" to the Developer Guide.

## 16. Deployment Plan
- Upgrade during off-peak cloud window.

## 17. Status
Draft (Awaiting User Review)

## 18. Related ADRs
- `ADR-009`: Strangler-Fig Migration Order

## 19. Related Walkthroughs
- —
