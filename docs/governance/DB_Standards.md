# SMRITI Database Governance Coding Standard

**Status:** FROZEN — v1.0 (2026-07-28)  
**Reference ADR:** ADR-004 (Database Governance), ADR-011 (Canonical Data Model)

---

## 1. Database Selection
- **Primary Database**: PostgreSQL 15+ (ACID, JSONB, Full-Text Search, Logical Replication).
- **ORM Engine**: SQLAlchemy 2.0 Async (`AsyncSession`).
- **Migration Engine**: Alembic (`backend/alembic/versions/`).

---

## 2. Model Naming Convention
```text
✅  ProductModel       (matches domain entity)
✅  SalesInvoiceModel
✅  WarehouseModel
❌  MyProd             (abbreviation — prohibited)
❌  StockItem2         (numeral suffix — prohibited)
```

## 3. Table Naming Convention
- All tables lowercase with underscore: `products`, `sales_invoices`, `stock_movements`.
- Junction tables: `product_barcodes`, `supplier_contacts`.

## 4. Column Conventions
- Primary Key: `id SERIAL` or `id UUID`.
- Audit Columns: `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`, `created_by UUID`, `updated_by UUID`.
- Soft Delete: `is_deleted BOOLEAN DEFAULT FALSE`, `deleted_at TIMESTAMPTZ`.
- Tenant Isolation: `tenant_id UUID NOT NULL`, `company_id UUID NOT NULL`, `branch_id UUID`.

## 5. Migration Rules (AOP-004)
- Every schema change: Alembic revision file required.
- Additive only: `ADD COLUMN IF NOT EXISTS`.
- Destructive DDL: Requires 2-phase deprecation + Architecture Review Board approval.
- All migrations include `downgrade()` rollback implementation.

## 6. Repository Rules (ADR-006)
- Zero raw SQL in service or controller layers.
- All `SELECT`, `INSERT`, `UPDATE`, `DELETE` live in `backend/app/repositories/`.
- All queries use parameterized bindings; zero f-string SQL construction.

---

## 7. Database Blueprint Governance Rules (ADR-012)

### DBP-001 — Blueprint is Authoritative
No new Alembic migration shall be committed unless the corresponding table/column is documented in `docs/database/SMRITI_DATABASE_BLUEPRINT_v1.0.md` and reviewed against the Canonical Data Model.

### DBP-002 — Canonical Ownership
Every database table has exactly ONE owning module. Other modules consume through Repository/Service/API only. Cross-module direct table access and parallel duplicate schemas are prohibited (GR-001 + GR-011).

### DBP-003 — Migration Traceability
Every Alembic migration file MUST include a docstring header referencing:
- Database Blueprint section
- Canonical Data Model entity (if applicable)
- ADR number (for structural changes)

```python
"""Add journal_entries table

DBP Reference : SMRITI_DATABASE_BLUEPRINT_v1.0.md §3 — Accounting
CDM Reference : SMRITI_CANONICAL_DATA_MODEL_v1.0.md — LedgerEntry
ADR Reference : ADR-012
"""
```

## 8. BaseEntity Inheritance (Mandatory)
All new models MUST inherit `BaseEntity` or `RowSecuredMixin` from `backend/app/db/base.py`.
This automatically provides: `id`, `uuid`, `tenant_id`, `company_id`, `branch_id`, `created_at`, `modified_at`, `created_by`, `updated_by`, `is_active`, `is_deleted`, `deleted_at`, `version`.
Never redefine these fields in individual models.

