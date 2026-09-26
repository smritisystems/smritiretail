<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.16.0
  * Created    : 2026-09-24
  * Modified   : 2026-09-24
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Architecture Governance Implementation Plan
-->

# Implementation Plan: SMRITI Retail OS v3.16.0 — Release Hardening & Bootstrap Architecture

**Version:** 3.16.0  
**Domain:** Foundation / Core Platform  
**Status:** Completed  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  

---

## 1. Objective
Eliminate the fresh PC installation catalog failure (`asyncpg.exceptions.InvalidCatalogNameError: database "smriti001" does not exist`) by establishing an automated canonical bootstrap engine and proving product readiness across a 5-stage verification roadmap (Clean Topology Installation, E2E Retail Lifecycle, Runtime Dynamic Tenant Provisioning, Disaster Recovery, and Upgrade Lineage).

---

## 2. Business Motivation
SMRITI Retail OS must be turnkey on any customer PC running Windows 10/11 or Linux without requiring manual database creation (`CREATE DATABASE smriti001`). Customers expect that executing `install.ps1 -Mode Production` immediately provisions control plane and tenant databases, applies migrations, seeds baseline operational data, and executes POS and ERP operations with complete multi-tenant database isolation.

---

## 3. Scope
1. **Bootstrap Engine Hardening**:
   - Automated detection of registered tenant targets from `smritisys.company_database_registries`.
   - Idempotent creation of physical PostgreSQL databases (`smriti001`, `smriti002`, `smriti003`, and dynamic tenants).
   - Head revision Alembic migrations (`target=tenant`, revision=`head`).
   - Seeding of baseline operational records (administrator user `usr-admin`, customer groups, primary warehouse `WH-<comp>-MAIN` with pincode `400050`, cash registers).
2. **Complete Retail E2E Business Lifecycle**:
   - Verification of full operational flow: Authentication $\rightarrow$ Company Selection $\rightarrow$ Register/Shift Open $\rightarrow$ Customer Master $\rightarrow$ Item Master $\rightarrow$ Stock Inward (GRN) $\rightarrow$ POS Checkout $\rightarrow$ Real-Time Stock Decrement $\rightarrow$ Day Close Reconciliation.
3. **Runtime Dynamic Tenant Provisioning**:
   - Dynamic company (`COMP-004`) registration in control plane, physical DB (`smriti004`) provisioning, routing discovery (`status = READY`), and strict database isolation from `smriti001`.
4. **Disaster Recovery (DR)**:
   - Automated full custom-format dumps (`pg_dump -Fc`) of `smritisys`, `smriti001`, `smriti004`, clean target restoration (`pg_restore`), schema and Alembic revision parity verification, and 100% transactional recovery.
5. **Upgrade Lineage**:
   - Idempotent execution of `scripts/update.ps1` and bootstrap engine, verifying zero schema drift, 100% data preservation, and operational API health.

---

## 4. Current State
- The bootstrap fix was committed in `5524cfc6` and `d77c96ec`.
- Fresh volume testing proved that an initially empty PostgreSQL instance (containing only `postgres` and `smritisys`) successfully provisions `smriti001`, `smriti002`, and `smriti003` with all 12 checks passing.
- Operational services run on standardized Docker ports: PostgreSQL (`2781`), API (`1981`), Web (`8101`).

---

## 5. Gap Analysis
1. *POS Shift Reconciliation*: Shift denomination counts required explicit column mapping and cast handling for non-note denominations.
2. *Tenant Context Resolution*: `TenantContext` in API dependencies lacked `@property def tenant_id`, causing runtime attribute errors in services expecting `tenant.tenant_id`.
3. *Dispatch Fulfillment Warehouse*: POS checkout required an existing primary warehouse with valid 6-digit Indian PIN code for dispatch fulfillment.
4. *Automated Verification Tooling*: Lack of end-to-end automated scripts to execute and measure the 5-stage lifecycle and disaster recovery cycle.

---

## 6. Architecture Impact
- **Control Plane (`smritisys`)**: Sole authority for routing registry (`company_database_registries`), company discovery, and user authentication.
- **Tenant Plane (`smriti001`..`smritiNNN`)**: Dedicated physical database per company with absolute query and schema isolation.
- **Dynamic Provisioning**: `provision_and_migrate_tenants()` callable at runtime during tenant registration without restarting containers.

---

## 7. Proposed Design
1. Enhance `backend/app/db/bootstrap_engine.py` to seed baseline `usr-admin` and primary warehouse `WH-<comp>-MAIN` on all provisioned tenant databases.
2. Update `backend/app/api/deps.py` with `tenant_id` property on `TenantContext`.
3. Clean `backend/app/services/pos.py` denomination parser and bind ORM entity `POSShiftDenominationCount` with exact table schema columns.
4. Build 4 standalone automated verification test suites:
   - `backend/tools/test_e2e_retail_lifecycle.py`
   - `backend/tools/test_runtime_tenant_creation.py`
   - `backend/tools/test_disaster_recovery.py`
   - `backend/tools/test_upgrade_lineage.py`

---

## 8. Files Created
- `backend/tools/test_e2e_retail_lifecycle.py`
- `backend/tools/test_runtime_tenant_creation.py`
- `backend/tools/test_disaster_recovery.py`
- `backend/tools/test_upgrade_lineage.py`
- `docs/implementation/foundation/Fdn_Release_Hardening_Bootstrap_Plan_v3.16.0.md`
- `docs/walkthrough/foundation/Fdn_Release_Hardening_Bootstrap_v3.16.0.md`

---

## 9. Files Modified
- `backend/app/api/deps.py`
- `backend/app/db/bootstrap_engine.py`
- `backend/app/models/pos.py`
- `backend/app/services/catalog_validation.py`
- `backend/app/services/identity/code_generator.py`
- `backend/app/services/pos.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

---

## 10. Dependencies
- Docker & Docker Compose v2+
- PostgreSQL 15 (containerized or local)
- Python 3.10+ with `psycopg2`, `httpx`, `sqlalchemy`, `alembic`

---

## 11. Risks
- *Risk*: Concurrent shift closure denomination mismatch.
  *Mitigation*: Pre-filter denomination dictionary and cast to integer note counts.
- *Risk*: Accidental data destruction during update.
  *Mitigation*: Updates prohibited from using `down -v`. Migrations execute non-destructively.

---

## 12. Rollback Strategy
All database migrations and updates are strictly non-destructive. If an update fails, volume snapshots and `backups/dr_verification/*.dump` archives permit immediate restoration via `pg_restore`.

---

## 13. Verification Plan
Execute the 5 verification suites and record literal terminal outputs:
1. `docker compose exec -T smriti-api python /workspace/backend/tools/verify_installation.py`
2. `docker compose exec -T smriti-api python /workspace/backend/tools/test_e2e_retail_lifecycle.py`
3. `docker compose exec -T smriti-api python /workspace/backend/tools/test_runtime_tenant_creation.py`
4. `python backend/tools/test_disaster_recovery.py`
5. `python backend/tools/test_upgrade_lineage.py`

---

## 14. Test Plan
- Unit tests: Bytecode compilation (`py_compile`).
- Integration tests: Database topology, routing resolution, live API HTTP 200 responses.
- E2E tests: Retail sales lifecycle, multi-tenant isolation, backup & restore.

---

## 15. Documentation Impact
- Update `docs/walkthrough/README.md` and `docs/implementation/README.md`.
- Create detailed walkthrough in `docs/walkthrough/foundation/Fdn_Release_Hardening_Bootstrap_v3.16.0.md`.
- Document non-destructive upgrade procedure in `CHANGELOG.md`.

---

## 16. Deployment Plan
1. Pull latest code via `git pull origin smritiNX`.
2. Run `install.ps1 -Mode Production` (or `scripts/update.ps1`).
3. Run `backend/tools/verify_installation.py` to confirm 12/12 checks green.

---

## 17. Status
**Completed** — All 5 stages verified and 22-item release gate matrix passed.

---

## 18. Related ADRs
- `ADR-001`: Multi-Tenant Shared Process Dedicated Database Architecture
- `ADR-042`: SMRITI Canonical Parameter Namespace

---

## 19. Related Walkthroughs
- [Foundation: Release Hardening & Bootstrap Architecture v3.16.0](../walkthrough/foundation/Fdn_Release_Hardening_Bootstrap_v3.16.0.md)
