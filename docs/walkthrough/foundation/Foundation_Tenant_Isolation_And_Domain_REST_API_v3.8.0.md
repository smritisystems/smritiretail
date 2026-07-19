<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.8.0
  * Created    : 2026-07-11
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# SMRITI Retail OS Walkthrough — Tenant Isolation & Domain REST API — v3.8.0

## 1. Purpose
This walkthrough documents the design and execution of multi-tenant validation and domain REST API routers for products, customers, and sales invoices.

## 2. Scope
- Plumb tenant context headers `X-Company-Id` and `X-Branch-Id` into API endpoints.
- Establish database tenant tables `companies` and `branches`.
- Update repository CRUD layer to automatically filter queries and stamp tenant associations.
- Expose versioned REST API routes under `/api/v1/` for CRM, Inventory, and Sales.
- Verify security and database isolation boundaries via tests.

## 3. Files Created
- [deps.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/api/deps.py)
- [tenant.py (Model)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/tenant.py)
- [tenant.py (Schema)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/schemas/tenant.py)
- [customer.py (Repository)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/repositories/customer.py)
- [sales.py (Repository)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/repositories/sales.py)
- [inventory.py (Router)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/api/v1/inventory.py)
- [crm.py (Router)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/api/v1/crm.py)
- [sales.py (Router)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/api/v1/sales.py)
- [test_tenant_isolation.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/test_tenant_isolation.py)
- [931451e6eea2_add_companies_and_branches.py (Migration)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/alembic/versions/931451e6eea2_add_companies_and_branches.py)
- [backend/Dockerfile](file:///d:/IMP/GitHub/SMRITRretailNX/backend/Dockerfile)
- [backend/entrypoint.sh](file:///d:/IMP/GitHub/SMRITRretailNX/backend/entrypoint.sh)

## 4. Files Modified
- [__init__.py (Models)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/__init__.py)
- [__init__.py (Repositories)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/repositories/__init__.py)
- [__init__.py (API v1)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/api/v1/__init__.py)
- [base.py (Database)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/db/base.py)
- [base.py (Repositories)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/repositories/base.py)
- [product.py (Repositories)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/repositories/product.py)
- [crm.py (Services)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/services/crm.py)
- [inventory.py (Services)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/services/inventory.py)
- [sales.py (Services)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/services/sales.py)
- [main.py (App Core)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/main.py)
- [env.py (Alembic)](file:///d:/IMP/GitHub/SMRITRretailNX/backend/alembic/env.py)
- [test_services.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/test_services.py)
- [docker-compose.yml](file:///d:/IMP/GitHub/SMRITRretailNX/docker-compose.yml)
- [package.json](file:///d:/IMP/GitHub/SMRITRretailNX/package.json)
- [CHANGELOG.md](file:///d:/IMP/GitHub/SMRITRretailNX/CHANGELOG.md)

## 5. Architecture Decisions
- **Fail-Closed Validation:** Incoming requests with missing, inactive, or mismatched `X-Company-Id`/`X-Branch-Id` headers fail-closed immediately with HTTP 400 (Bad Request), avoiding silent data exposure.
- **Transitive Schema Constraints:** Attached Foreign Keys dynamically to `BaseEntity` so all inheriting business models (`Product`, `Customer`, etc.) inherit the schema constraints in Postgres cleanly.
- **Containerization — Migration-Before-Serve:** `entrypoint.sh` runs `alembic upgrade head` before passing control to gunicorn, matching the repo's existing `pg_isready`-gated startup pattern. Migrations run on every container start; this is idempotent for an already-migrated DB.
- **Race-Condition Defence — Catch-at-Commit:** Services check for duplicates before insert (fast path for the common case) and also catch `IntegrityError` at commit time (safety net for concurrent callers who both pass the pre-check). The loser gets HTTP 400 with plain business-language detail; the raw `sqlalchemy.exc.IntegrityError` is never forwarded to the client.
- **No Authentication (explicit):** The `get_tenant_context` dependency validates that the supplied Company/Branch IDs exist and are active — it does **not** verify caller identity. This is documented in `deps.py` with a prominent comment. Real auth is tracked as separate follow-up work.

## 6. Design Rationale
- Plumbed `TenantContext` to repository query wrappers (`BaseRepository._apply_tenant_filter`) to enforce query isolation uniformly across CRUD endpoints.
- Plumbed `TenantContext` into Service constructors to check unique code/barcode availability and deduct inventory stock within the caller's tenant boundary.
- `python-core` service name and container name chosen to match `main.py`'s own startup log line and to be deliberately distinct from the existing `app`/`smriti-api` Node service.

## 7. Implementation Summary
- **Header Parsing Dependency:** Created `get_tenant_context` resolving headers against database `Company` and `Branch` tables.
- **Repository Injectors:** Refactored `BaseRepository` to accept `tenant_ctx` and auto-stamp/filter.
- **REST Endpoints:** Exposed clean FastAPI REST endpoints for all three business domains.
- **IntegrityError Wrapping:** Added `try/except IntegrityError` around `await self.db.commit()` in all four `create_*` service methods, with `await self.db.rollback()` in the except branch per HREP Rule 1.
- **Docker:** Created `backend/Dockerfile` (python:3.12-slim, copies requirements, runs `chmod +x entrypoint.sh`) and `backend/entrypoint.sh` (runs `alembic upgrade head`, then `gunicorn` with `UvicornWorker`). Added `python-core` service to the root `docker-compose.yml`.

## 8. Tests Executed
```
python -m pytest app/tests/ -v
```

## 9. Verification Results
- 21/21 overall test suite checks passed (including concurrency test):
```
============================= test session starts =============================
platform win32 -- Python 3.14.3, pytest-9.0.2, pluggy-1.6.0
rootdir: D:\IMP\GitHub\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.12.1, langsmith-0.8.5, asyncio-1.3.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 21 items

app/tests/test_main.py::test_liveness PASSED                             [  4%]
app/tests/test_main.py::test_readiness PASSED                            [  9%]
app/tests/test_main.py::test_version PASSED                              [ 14%]
app/tests/test_main.py::test_metadata_api PASSED                         [ 19%]
app/tests/test_main.py::test_changelog_api PASSED                        [ 23%]
app/tests/test_main.py::test_dev_tracker_api PASSED                      [ 28%]
app/tests/test_models.py::test_product_model_instantiation PASSED        [ 33%]
app/tests/test_models.py::test_crm_model_instantiation PASSED            [ 38%]
app/tests/test_models.py::test_sales_model_instantiation PASSED          [ 42%]
app/tests/test_repositories.py::test_product_repository_crud PASSED      [ 47%]
app/tests/test_schemas.py::test_crm_schema_validation PASSED             [ 52%]
app/tests/test_schemas.py::test_inventory_schema_validation PASSED       [ 57%]
app/tests/test_schemas.py::test_sales_schema_validation PASSED           [ 61%]
app/tests/test_services.py::test_crm_and_inventory_services PASSED       [ 66%]
app/tests/test_services.py::test_sales_invoice_service PASSED            [ 71%]
app/tests/test_tenant_isolation.py::test_header_validation PASSED        [ 76%]
app/tests/test_tenant_isolation.py::test_read_isolation PASSED           [ 80%]
app/tests/test_tenant_isolation.py::test_write_validation PASSED         [ 85%]
app/tests/test_tenant_isolation.py::test_service_layer_isolation PASSED  [ 90%]
app/tests/test_tenant_isolation.py::test_cross_tenant_branch_validation PASSED [ 95%]
app/tests/test_tenant_isolation.py::test_concurrent_duplicate_barcode_returns_400_not_500 PASSED [100%]

======================= 21 passed, 84 warnings in 3.19s =======================
```

## 10. Known Limitations
- **No caller identity verification:** `get_tenant_context` validates that Company/Branch IDs exist and are active in the database. It does NOT verify who the caller is — any caller who can reach the API and knows a valid Company/Branch ID pair can claim it. Real authentication (JWT, session tokens) is separate follow-up work.
- **NULL `company_id`/`branch_id` on existing rows not backfilled:** Existing seeded data retains NULL in these columns. The FK constraints are nullable to avoid migration failure. Backfill is a separate follow-up ticket.
- **Dev tooling in Docker image:** `backend/requirements.txt` includes `pytest`, `ruff`, `mypy`, `bandit` alongside production deps, so the Docker image ships dev tooling. Splitting into `requirements.txt` / `requirements-dev.txt` is a separate cleanup ticket.
- **Full HREP compliance not implemented:** All `HTTPException` calls use plain string `detail`. The complete HREP policy (Title/Explanation/Suggested Action/Reference ID, error dictionary catalog) is a separate initiative.

## 11. Future Work
- Integrate JWT-based authentication so `get_tenant_context` can also verify caller identity.
- Backfill NULL `company_id`/`branch_id` on existing seeded rows and add NOT NULL DB constraints.
- Split `requirements.txt` into `requirements.txt` (production) and `requirements-dev.txt` (test/lint tooling).
- Implement full HREP error dictionary catalog (`SMRITI-VAL-001`-style structured errors).

## 12. Related ADRs
- None.

## 13. Related RFCs
- RFC-022: Multi-Tenant Schema Isolation.
