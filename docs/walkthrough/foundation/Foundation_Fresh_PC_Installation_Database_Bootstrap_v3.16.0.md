<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-09-24
  Modified     : 2026-09-24
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Fresh PC Installation Database Bootstrap & Topology Fix (v3.16.0)

## 1. Purpose
Resolve the fresh PC installation failure where new machine setups failed with:
```text
asyncpg.exceptions.InvalidCatalogNameError: database "smriti001" does not exist
```
The goal was to establish a canonical, idempotent, single-command database bootstrap and verification workflow ensuring that starting from a clean Docker/PostgreSQL installation, the control plane (`smritisys`) and tenant operational databases (`smriti001`, `smriti002`, `smriti003`) are automatically provisioned, migrated, seeded, and verified without manual intervention.

## 2. Scope
- Control-plane (`smritisys`) and tenant operational databases (`smriti001`, `smriti002`, `smriti003`) provisioning and routing.
- Alembic database migrations across both `target=control` and `target=tenant` contexts.
- Multi-company baseline seeding (Customer Groups, Customers, Products, Cash Registers, Suppliers, and Universal Parties).
- Docker and installer entrypoint orchestration (`entrypoint.sh`, `install.ps1`, `install.sh`, `scripts/update.ps1`).
- Enhanced health and readiness diagnostics in FastAPI (`/health` and `/ready`).
- Automated installation topology and real API verification test suite (`verify_installation.py`).

## 3. Files Created
- `backend/app/db/bootstrap_engine.py`: Canonical database bootstrap engine orchestrating control-plane initialization, tenant database discovery, raw DDL database creation, multi-target Alembic migrations, and baseline operational data seeding.
- `backend/tools/verify_installation.py`: Comprehensive test and validation CLI that verifies database existence in PostgreSQL catalog, validates table presence, checks `COMP-001 -> smriti001` routing, and tests 6 critical operational API endpoints.
- `backend/tools/__init__.py`: Package initialization marker for backend tools.

## 4. Files Modified
- `backend/app/db/session.py`: Added `verify_tenant_connectivity(database_name)` to allow runtime health probes to verify operational tenant database connectivity independently from the control plane.
- `backend/app/main.py`: Updated `/health` and `/ready` endpoints to inspect both control plane (`smritisys`) and tenant database (`smriti001`), returning HTTP 503 if the tenant database is disconnected or unprovisioned.
- `backend/app/schemas/pos.py`: Added defensive UTC timestamp fallback (`now = datetime.now(timezone.utc)`) in `POSProfileResponse.from_register` to prevent HTTP 500 when registering terminals.
- `backend/entrypoint.sh`: Replaced fragmented migrations and seeding with canonical invocation of `python -m app.db.bootstrap_engine`.
- `docker-compose.yml`: Added volume mounts for `./backend/tools:/app/tools` and `./backend/entrypoint.sh:/app/entrypoint.sh`.
- `docker-compose.dev.yml`: Added volume mount for `./backend/tools:/app/tools`.
- `install.ps1`: Restructured to follow the Rule 4 lifecycle (DB start -> health wait -> bootstrap engine -> web startup -> verification tool) and fixed `Show-ErrorDiagnostics` parameter aliases.
- `install.sh`: Aligned bash installer with canonical bootstrap engine and verification tool.
- `scripts/update.ps1`: Integrated `python -m app.db.bootstrap_engine` to guarantee non-destructive updates.

## 5. Architecture Decisions
1. **Separation of Control Plane & Tenant Data Planes**:
   Maintained `smritisys` as the control-plane system of record and `smriti001` (and `smriti002`, `smriti003`) as physical tenant operational databases. Rejected merging them into a single database.
2. **Deterministic Regex Filtering for Tenant Discovery**:
   Queried `company_database_registries` filtering by `LOWER(database_name) ~ '^smriti(?!000)(?!sys)[a-z0-9]{3}$'` to provision company databases while ignoring ephemeral test databases.
3. **Explicit Autocommit Connection Lifecycle for DDL**:
   Managed raw psycopg2 connections explicitly outside context managers (`conn = get_raw_connection(); conn.autocommit = True; try ... finally: conn.close()`) to satisfy PostgreSQL's requirement that `CREATE DATABASE` execute outside transaction blocks.
4. **Dynamic Branch Resolution in Tenant Seeding**:
   Rather than hardcoding branch IDs, queried the tenant database for active branches (`SELECT id FROM branches WHERE company_id = %s ...`) and created a default branch if none was found.

## 6. Design Rationale
- On fresh PC installations, Docker creates only `smritisys` via `POSTGRES_DB: smritisys`.
- Relying on developer machines having `smriti001` pre-existing caused immediate 500 errors on fresh environments.
- By embedding the discovery and provisioning directly in the canonical `bootstrap_engine.py`, both automated installers (`install.ps1`, `install.sh`) and standard Docker launches (`docker compose up`) automatically provision the complete topology.

## 7. Implementation Summary
- **Phase 1: Control Plane**: Created `smritisys` if missing, ran `alembic -x target=control -x db=smritisys upgrade head`, and seeded baseline users and company registries.
- **Phase 2: Tenant Discovery**: Queried `company_database_registries` in `smritisys` for valid company databases.
- **Phase 3: Tenant Provisioning & Migration**: For each discovered database (`smriti001`, `smriti002`, `smriti003`), idempotently created the physical database, executed `alembic -x target=tenant -x db=<name> upgrade head`, and seeded baseline operational masters.
- **Phase 4: Routing & Health Checks**: Verified that `COMP-001 -> smriti001` resolves to `READY`. Enhanced `/health` and `/ready` to return 503 if tenant database is unavailable.
- **Phase 5: Installer & Update Script Alignment**: Integrated the bootstrap engine into `install.ps1`, `install.sh`, and `scripts/update.ps1`.

## 8. Tests Executed
1. **Direct Bootstrap Engine Test in Container**:
   `docker compose exec -T smriti-api python -m app.db.bootstrap_engine`
   - Verified creation of missing databases (`smriti003`).
   - Verified skipping existing databases (`smritisys`, `smriti001`, `smriti002`).
   - Verified migration and seeding.
2. **Idempotency Re-run**:
   Executed `python -m app.db.bootstrap_engine` a second time to confirm zero data destruction and idempotent execution.
3. **Official Installation Verification CLI**:
   `docker compose exec -T smriti-api python -m tools.verify_installation --api-url http://localhost:8000`
   - Verified physical existence of `smritisys` and `smriti001`.
   - Verified 7 core tables in `smritisys`.
   - Verified 11 core tables in `smriti001` (out of 285 total tables).
   - Verified company `COMP-001` exists and routes to `smriti001` with status `READY`.
   - Tested 6 operational APIs via live HTTP against port 8000:
     - `/api/v1/crm/customers` (HTTP 200 OK)
     - `/api/v1/crm/customer-groups` (HTTP 200 OK)
     - `/api/v1/pos/shifts/` (HTTP 200 OK)
     - `/api/v1/pos/profiles/` (HTTP 200 OK)
     - `/api/v1/products/search` (HTTP 200 OK)
     - `/api/v1/purchase/vendors/` (HTTP 200 OK)
4. **Python Syntax Compilation Check**:
   `python -m py_compile app/db/bootstrap_engine.py tools/verify_installation.py tools/__init__.py app/db/session.py app/main.py app/schemas/pos.py` (Exit code 0).

## 9. Verification Results
```text
================================================================================
SMRITI RETAIL OS — INSTALLATION & TOPOLOGY VERIFICATION REPORT
================================================================================

CHECK ITEM                                    | STATUS   | DETAILS                            
-----------------------------------------------------------------------------------------------
Database: smritisys exists                    | PASSED   | Present in pg_database             
Database: smriti001 exists                    | PASSED   | Present in pg_database             
Control Plane Core Tables (smritisys)         | PASSED   | All 7 verified                     
Tenant Core Tables (smriti001)                | PASSED   | All 11 verified (285 total tables) 
Company: COMP-001 exists in smritisys.companies | PASSED   | Name: My Retail Store              
Routing: COMP-001 -> smriti001 (status=READY) | PASSED   | Database: smriti001, Status: READY 
API: CRM Customers (/api/v1/crm/customers)    | PASSED   | HTTP 200 OK (Items: 100)           
API: CRM Customer Groups (/api/v1/crm/customer-groups) | PASSED   | HTTP 200 OK (Items: 100)           
API: POS Shifts (/api/v1/pos/shifts/)         | PASSED   | HTTP 200 OK (Items: 100)           
API: POS Profiles (/api/v1/pos/profiles/)     | PASSED   | HTTP 200 OK (Items: 2)             
API: Products Search (/api/v1/products/search) | PASSED   | HTTP 200 OK (Items: 50)            
API: Purchase Vendors (/api/v1/purchase/vendors/) | PASSED   | HTTP 200 OK (Items: 15)            
-----------------------------------------------------------------------------------------------
Summary: Total: 12 | Passed: 12 | Failed: 0
================================================================================
VERIFICATION PASSED: Database topology, routing, and operational APIs verified.
```

## 10. Known Limitations
- Initial tenant migrations across ~175 Alembic revisions take ~20-30 seconds per new tenant database. This is a one-time operation during fresh installation.

## 11. Future Work
- Pre-generate an empty template database (`template_smriti`) during Docker build to speed up provisioning of new tenants from ~25s to <1s via `CREATE DATABASE ... TEMPLATE template_smriti`.

## 12. Related ADRs
- `ADR-001`: Multi-Tenant Physical Database Separation Architecture.
- `ADR-005`: One-Way Canonical Master to Compatibility Projection Architecture.

## 13. Related RFCs
- `RFC-2026-07-TDB`: Tenant Data Boundary Governance Specification.
