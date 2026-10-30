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
5. **Cluster Advisory Lock for Concurrency Protection**:
   Integrated PostgreSQL session advisory lock (`pg_advisory_lock(81920261981)`) in `bootstrap_engine.py` to prevent race conditions when container background startup and external installer scripts invoke bootstrap simultaneously.
6. **Canonical Tenant Schema Extensions**:
   Included party master extensions (`parties.merged_into_party_id`, `party_addresses`, `party_contacts`, `party_relationships`) and item master extensions (`item_batches`, `item_serials`) directly into `bootstrap_engine.py` to ensure fresh installs match the ORM model specifications without manual ad-hoc scripts.

## 6. Design Rationale
- On fresh PC installations, Docker creates only `smritisys` via `POSTGRES_DB: smritisys`.
- Relying on developer machines having `smriti001` pre-existing caused immediate 500 errors on fresh environments.
- By embedding the discovery and provisioning directly in the canonical `bootstrap_engine.py`, both automated installers (`install.ps1`, `install.sh`) and standard Docker launches (`docker compose up`) automatically provision the complete topology.

## 7. Implementation Summary
- **Phase 1: Control Plane**: Created `smritisys` if missing, ran `alembic -x target=control -x db=smritisys upgrade head`, and seeded baseline users and company registries.
- **Phase 2: Tenant Discovery**: Queried `company_database_registries` in `smritisys` for valid company databases.
- **Phase 3: Tenant Provisioning & Migration**: For each discovered database (`smriti001`, `smriti002`, `smriti003`), idempotently created the physical database, executed `alembic -x target=tenant -x db=<name> upgrade head`, applied tenant schema extensions, and seeded baseline operational masters.
- **Phase 4: Concurrency & Lock Management**: Enforced cluster-wide advisory locking across all bootstrap invocations.
- **Phase 5: Routing & Health Checks**: Verified that `COMP-001 -> smriti001` resolves to `READY`. Enhanced `/health` and `/ready` to return 503 if tenant database is unavailable.
- **Phase 6: Installer & Update Script Alignment**: Integrated the bootstrap engine into `install.ps1`, `install.sh`, and `scripts/update.ps1`.

## 8. Tests Executed
1. **Isolated Clean PostgreSQL Simulation Test**:
   - Clean Docker volume created (`smriti_clean_pc_sim_volume`) containing only `smritisys` and system DBs (0 tenant DBs).
   - Executed official `install.ps1` without manual DB creation.
   - Verified 12/12 checks passed.
2. **Container Restart & Persistence Verification**:
   - Restarted `smriti-db`, `smriti-api`, and `smriti-web`.
   - Re-verified all 12 checks passed.
3. **Installer Idempotency Test**:
   - Executed `install.ps1` a second time against populated database; exited with code 0 without recreating existing databases.
4. **Development Environment Preservation**:
   - Original `smriti_db_volume` backed up and restored safely.

## 9. Verification Results

### Clean-PC Acceptance Test Matrix
| Acceptance Test | Result | Evidence |
| :--- | :--- | :--- |
| **Fresh PC Simulation** | **PASS** | Clean volume started with 0 tenant DBs; no manual DB creation |
| **Auto Tenant DB Creation** | **PASS** | `bootstrap_engine.py` created `smriti001`, `smriti002`, `smriti003` |
| **Migrations** | **PASS** | Alembic control (`297d2643a139`) and tenant (`064fcf437d04`) migrated |
| **Seeding** | **PASS** | Control plane users & tenant baseline operational data seeded |
| **Tenant Routing** | **PASS** | `COMP-001 -> smriti001` mapped with status `READY` |
| **6 API Tests** | **PASS** | All 6 endpoints returned HTTP 200 OK |
| **Restart / Persistence** | **PASS** | Data preserved across Docker restarts; 12/12 checks green |
| **Installer Idempotency** | **PASS** | Second `install.ps1` run completed cleanly without errors |

```text
================================================================================
SMRITI RETAIL OS — INSTALLATION & TOPOLOGY VERIFICATION REPORT
================================================================================

CHECK ITEM                                    | STATUS   | DETAILS                            
-----------------------------------------------------------------------------------------------
Database: smritisys exists                    | PASSED   | Present in pg_database             
Database: smriti001 exists                    | PASSED   | Present in pg_database             
Control Plane Core Tables (smritisys)         | PASSED   | All 7 verified                     
Tenant Core Tables (smriti001)                | PASSED   | 292 total tables verified
Company: COMP-001 exists in smritisys.companies | PASSED   | Name: Retail Core HQ
Routing: COMP-001 -> smriti001 (status=READY) | PASSED   | Database: smriti001, Status: READY 
API: CRM Customers (/api/v1/crm/customers)    | PASSED   | HTTP 200 OK (returned 0 records)
API: CRM Customer Groups (/api/v1/crm/customer-groups) | PASSED | HTTP 200 OK (returned 3 records)
API: POS Shifts (/api/v1/pos/shifts/)         | PASSED   | HTTP 200 OK (returned 0 records)
API: POS Profiles (/api/v1/pos/profiles/)     | PASSED   | HTTP 200 OK (returned 1 record)
API: Products Search (/api/v1/products/search) | PASSED   | HTTP 200 OK (returned 0 records)
API: Purchase Vendors (/api/v1/purchase/vendors/) | PASSED | HTTP 200 OK (returned 0 records)
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
