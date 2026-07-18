<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.31.0
  Created      : 2026-07-19
  Modified     : 2026-07-19
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SaaS Tenant Isolation & Data Security Architecture Plan -- v3.31.0

## 1. Objective
Refine the SaaS tenant isolation design for SMRITI Retail OS. Replace legacy `before_compile` queries with SQLAlchemy 2.x canonical `do_orm_execute` and `with_loader_criteria` APIs. Consistently store `tenant_id`, `company_id`, and `branch_id` on all business entity tables, isolate global reference tables, and standardise BaseEntity attributes (including soft-delete support and optimistic locking versions).

## 2. Business Motivation
SaaS operations require bulletproof tenant isolation. Using SQLAlchemy 2.x native query interceptors guarantees that all database calls implicitly filter data rows matching the active tenant's context, preventing human coding errors from leading to cross-tenant data leaks.

## 3. Scope
- **SQLAlchemy 2.x Interceptors:** Implement `do_orm_execute` with `with_loader_criteria` inside db session setup.
- **BaseEntity Refactor:** Standardise columns: `tenant_id`, `company_id`, `branch_id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `is_deleted`, `version`.
- **Reference Table Isolation:** Exclude platform lookup tables (Countries, States, HSN, Tax Rates) from tenant constraints.
- **JWT Claims Integration:** Include `tenant_id`, `company_id`, `branch_id`, and roles directly in Auth tokens.

## 4. Current State
- `TenantContext` only records `company_id` and `branch_id`.
- The previous draft v3.30.0 plan proposed using SQLAlchemy `before_compile` which is obsolete in SQLAlchemy 2.0.

## 5. Gap Analysis
- No unified `tenant_id` database columns exist in current tables.
- Reference tables are mixed with tenant transactional schemas.

## 6. Architecture Impact
```text
           Request Header / JWT Token
                      │
                      ▼
     TenantContext (tenant_id, company_id, branch_id)
                      │
                      ▼
   SQLAlchemy 2.x Session do_orm_execute
    └── Inject with_loader_criteria(BaseEntity.tenant_id == current_tenant)
                      │
                      ▼ (Implicit row filtering on all queries)
       PostgreSQL Row Isolation
```

## 7. Proposed Design
1. **Base Model Standardization:**
   ```python
   class BaseEntity(Base):
       __abstract__ = True
       id: Mapped[str] = mapped_column(String(50), primary_key=True)
       tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
       company_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
       branch_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
       created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
       updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
       created_by: Mapped[str] = mapped_column(String(50), nullable=True)
       updated_by: Mapped[str] = mapped_column(String(50), nullable=True)
       is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
       version: Mapped[int] = mapped_column(Integer, default=1)
   ```
2. **loader Criteria Interceptor:**
   Configure connection sessions to apply dynamic filters:
   ```python
   @event.listens_for(AsyncSession, "do_orm_execute")
   def apply_tenant_filter(execute_state):
       if execute_state.is_select:
           execute_state.extra_options += (
               with_loader_criteria(
                   BaseEntity,
                   lambda cls: cls.tenant_id == active_tenant_id,
                   include_subclasses=True
               ),
           )
   ```

## 8. Files Created
- `backend/alembic/versions/f7g8h9i0j1k2_add_tenant_isolation_v3310.py`

## 9. Files Modified
- `backend/app/models/base.py`
- `backend/app/api/deps.py`
- `backend/app/db/session.py`

## 10. Dependencies
- SQLAlchemy 2.0+

## 11. Risks
- Backfilling legacy records with generated default tenant IDs might lock large active production tables. Backfills must be split into paginated script transactions.

## 12. Rollback Strategy
- Database restoration from snapshots.

## 13. Verification Plan
- Assert that cross-tenant queries return zero results.

## 14. Test Plan
- `test_tenant_isolation_enforced_by_default`: Validate that select queries append `WHERE tenant_id = ...`.
- `test_soft_delete_filter`: Validate that default select queries exclude `is_deleted = True`.

## 15. Documentation Impact
- Add "SQLAlchemy 2.x Tenant Query Hook Guidelines" to the developer manual.

## 16. Deployment Plan
- Apply database migrations during low traffic cloud window.

## 17. Status
Draft (Awaiting User Review)

## 18. Related ADRs
- `ADR-009`: Strangler-Fig Migration Order

## 19. Related Walkthroughs
- —
