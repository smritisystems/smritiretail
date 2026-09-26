<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.26.0
  Created      : 2026-08-15
  Modified     : 2026-09-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Architecture Decision — 2026-08-15

## v3.25.0 Authoritative Baseline

`56b5fb46b477aa81166680f60ad7030fe1493e5e` is the authoritative
SMRITI Retail OS v3.25.0 User Training baseline.

The current main/smritiNX lineage is intentional and is NOT treated
as a rollback or corrupted merge.

Inventory Kernel, SPK/SWSDK and SXP remain preserved on:
`origin/feat/physically-isolated-company-dbs`

They are experimental/next-generation architecture candidates and
must not be merged into v3.25.0 unless explicitly approved for v3.26.0+.

## Frozen v3.25.0 Rule

DO NOT modify main for experimental architecture recovery.

Any future Inventory Kernel / SWSDK / SXP integration must occur on
a dedicated feature branch with full regression, build, security,
database and architecture validation before merge.

## Master Baseline Hardening & Migration Governance (v3.25.0)

1. **Control Plane & Company DB Separation**: `smritisys` is the permanent Control Plane database. Each company maintains its own separate Company Business DB (`smriti001`). No transactional company data resides in `smritisys`. No `smriti002-smriti999` databases are automatically created during tests or audits.
2. **Immutable Migration History**: Historical applied migrations (such as `v1333`) are immutable. All new table additions and schema alignments are implemented in subsequent migrations (`v1334_add_v325_enterprise_tables.py`).
3. **Read-Only Schema Audit**: `scripts/audit_sqlalchemy_schema_drift.py` performs pure read-only inspection against PostgreSQL `information_schema` without calling `create_all()`.
4. **ORM Table Classifications**:
   - `REQUIRED_IN_V3_25` (31 Tables): Created via migration `v1334` (`commission_*`, `referral_*`, `loyalty_*`, `promotion_*`, `packing_slips`, `dispatches`, `transaction_cost_*`, `report_*`, `smriti_*`).
   - `PARKED_EXPERIMENTAL_ARCHITECTURE` (7 Tables): Multi-tenant isolated DB control plane models (`control_companies`, `control_company_databases`, `control_users`, `control_psv_configs`, `psv_stock_*`, `integration_outbox_events`) remain preserved on `origin/feat/physically-isolated-company-dbs`.

---

## Tenant Data Boundary — Permanent Architecture Rule (v3.27.0 — 2026-09-23)

**Policy ID:** TDB-v2.0  
**Status:** PERMANENT — MANDATORY — ALL agents, ALL sessions, ALL tasks  
**Effective:** 2026-09-23  
**Supersedes:** TDB-v1.0 (replaces negative forbidden-table lists with positive ownership model)

### Canonical Rule

```
smritisys  →  Control Plane ONLY
smriti001  →  Company/Tenant 001 operational data
smriti002  →  Company/Tenant 002 operational data
smritiXXX  →  Company/Tenant XXX operational data
```

### Positive Ownership Model (`backend/app/db/ownership.py`)

Rather than maintaining fragile negative lists of forbidden tables, SMRITI TDB-v2.0 defines a **canonical positive table ownership registry** where every table in the system is declared with an explicit owner enum:

1. `TableOwner.CONTROL_PLANE`: Belongs exclusively in `smritisys` (governance, identity, routing, platform config).
2. `TableOwner.TENANT`: Belongs exclusively in tenant databases `smritiXXX` (operational, catalog, transactional). Strictly forbidden in `smritisys`.
3. `TableOwner.SHARED_REFERENCE`: Seeded identically into ALL databases as read-only reference data (countries, states, currencies, UOMs, HSN codes).
4. `TableOwner.PLATFORM_TEMPLATE`: Platform templates in `smritisys` used for tenant provisioning.

All guards, linters, Alembic filters, and tests derive their allowed and forbidden sets dynamically from this Single Source of Truth (`TABLE_OWNERSHIP`).

### Multi-Layer Enforcement Architecture

| Layer | Component | Mechanism |
|---|---|---|
| **Layer 1: Canonical Registry** | `backend/app/db/ownership.py` | Single source of truth; enforces non-overlapping table invariants at import time |
| **Layer 2: Seed Contract** | `backend/app/db/seed_contract.py` | `@seed_contract(target="control"|"tenant"|"shared")` decorator; fails closed if invoked against the wrong DB |
| **Layer 3: Migration Contract** | `backend/alembic/migration_contract.py` | `@migration_target(target="control"|"tenant"|"both")` decorator + `validate_migration_execution()` helper |
| **Layer 4: Alembic Filter** | `backend/alembic/env.py` | Derives `TENANT_ONLY_TABLES` from `TENANT_OWNED_TABLES`; rejects creating tenant tables on `smritisys` |
| **Layer 5: Routing & Session** | `backend/app/db/session.py` | `validate_company_database_name()` rejects `smritisys` for company routing |
| **Layer 6: Tenant Context** | `backend/app/db/tenant_context.py` | `TenantDBContext` immutable wrapper + `@require_tenant_context` service decorator |
| **Layer 7: Runtime Guard** | `backend/app/db/cp_guard.py` | Inspects live `smritisys` against `TABLE_OWNERSHIP`; verifies `current_database() == 'smritisys'` |
| **Layer 8: Startup Lifespan** | `backend/app/main.py` | FastAPI lifespan startup hook runs `run_startup_check()` to alert on CP contamination |
| **Layer 9: CI Boundary Guard** | `scripts/ci_tenant_boundary_guard.py` | 10 static-analysis checks run pre-commit/pre-test in CI |
| **Layer 10: Data Disposition** | `scripts/tdb_v2_data_disposition.py` | 6-phase audit, SHA-256 backup, COMP-001 migration, and truncation remediation engine |
| **Layer 11: Test Suite** | `backend/tests/test_tenant_data_boundary.py` | 54 automated boundary enforcement tests (100% passing) |

### Fail-Closed Policy

**Any missing tenant context or attempt to route operational data to `smritisys` MUST:**

1. Raise a `SeedBoundaryViolation`, `MigrationBoundaryViolation`, or `TenantContextRequired` exception
2. Log the violation to internal logs
3. NOT silently fall back to any default database
4. Fail closed immediately

### 10-Check CI Static Analysis Suite

The CI boundary guard (`scripts/ci_tenant_boundary_guard.py`) enforces:
1. `smritisys_in_tenant_loops`: No seed scripts include smritisys in a tenant DB iteration loop
2. `seed_fallback_to_smritisys`: No seed scripts use os.getenv defaults fallback to smritisys
3. `psv_seed_cp_session`: No operational seeds open `async_session()` (CP session)
4. `architecture_governance_databases`: Governance metadata seeds only to `smritisys`
5. `migration_target_guards`: `alembic/env.py` enforces target database checks
6. `ci_alembic_target_flags`: CI workflow uses explicit `-x target=` flags
7. `ownership_declarations_complete`: Every model's `__tablename__` is registered in `TABLE_OWNERSHIP`
8. `seed_contracts_declared`: Core seed scripts declare `@seed_contract`
9. `migration_contracts_declared`: `migration_contract.py` exists and `env.py` uses `TENANT_OWNED_TABLES`
10. `tenant_context_contract_present`: `TenantDBContext` and `@require_tenant_context` are implemented

