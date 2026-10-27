<!--
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Governance Policy
-->

# SMRITI Retail OS — Upgrade and Migration Governance Policy (UMGP-v1.0)

**Status:** ACTIVE — MANDATORY — All agents, all sessions, all releases  
**Policy ID:** UMGP-v1.0  
**Effective:** 2026-10-27  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect  
**Supersedes:** Ad-hoc migration practices prior to 2026-10-27

---

## Purpose

Permanent enforceable engineering rules for every upgrade, migration, patch,
deployment, or Git-pull operation on SMRITI Retail OS. Ensures no production
data loss, every schema change is traceable and reversible, and every deployment
has a rollback path before changes are applied.

---

## Scope

Applies to: all Git branches (main, smritiNX, developer, release/*, hotfix/*),
all Alembic migrations under `backend/alembic/versions/`, all deployment scripts
(`scripts/update.sh`, `scripts/update.ps1`, `scripts/migrate.ps1`), all automation
scripts (`scripts/auto_migrate.py`, `scripts/check_migration_governance.py`), all
CI/CD workflows (`.github/workflows/ci.yml`), all AI agents, all human contributors,
all release processes.

---

## Rules

### UMGP-001 — Mandatory Preflight Backup

**Enforced via:** `scripts/update.sh` Step 2/6

A verified database backup MUST be created before any schema-changing migration runs.
Failure to produce a backup is a hard abort — the update pipeline must not continue.

**Implementation:**
- `update.sh` Step 2/6 calls `auto_migrate.py --backup-only` before container rebuild
- Creates compressed `pg_dump` (`.dump`) with SHA-256 manifest at `backend/backups/pre_migration/<session>/`
- Fallback chain: Docker `pg_dump` → host `pg_dump` → PostgreSQL server-side template clone
- Non-zero exit from backup step aborts the entire pipeline (no `|| true` allowed)

**Verification:** TC-UMGP-009 in `test_upgrade_migration_governance.py`

---

### UMGP-002 — Canonical Migration Orchestrator

**Enforced via:** `scripts/update.sh` Step 5/6

All migration execution MUST go through `backend/app/db/bootstrap_engine.py`.
Direct raw `alembic upgrade head` calls in deployment scripts are prohibited.

`bootstrap_engine.py` handles: control-plane migration, tenant DB discovery,
per-tenant migration, baseline seed — all idempotent.

**Verification:** TC-UMGP-010 in `test_upgrade_migration_governance.py`

---

### UMGP-003 — Dynamic Head Version Detection

**Enforced via:** `scripts/auto_migrate.py`

Hard-coded Alembic head version strings (e.g. `ver == "v1543"`) are prohibited.
The current head MUST be determined dynamically from the Alembic script directory at runtime.

**Correct implementation:** `_get_alembic_head(is_control)` and `_is_at_head(version, dbname, is_control)`
query `alembic heads --verbose` at runtime and parse the `(head)` token.

---

### UMGP-004 — Migration Boundary Enforcement (TDB-v2.0)

**Enforced via:** `backend/alembic/migration_contract.py`

Control-plane migrations MUST NOT run against tenant databases.
Tenant migrations MUST NOT run against `smritisys`.
`validate_migration_execution(target, dbname)` must be called at the start of
`upgrade()` and `downgrade()` in every new migration.

**Database Boundary Contract:**

| Target    | Allowed DBs                   | Blocked DBs     |
|-----------|-------------------------------|-----------------|
| `control` | `smritisys` only              | `smriti001`, …  |
| `tenant`  | `smriti001`, `smriti002`, …   | `smritisys`     |
| `both`    | Any                           | None            |

**Verification:** TC-UMGP-004, TC-UMGP-005, TC-UMGP-006

---

### UMGP-005 — Migration Target Declaration (CI Gate G1)

**Enforced via:** `scripts/check_migration_governance.py`  
**Applies to:** Revision v1553 and later

Every new Alembic migration file (revision >= v1553) MUST contain a `@migration_target()`
decorator. Legacy migrations (v1552 and earlier) are grandfathered.

**Required pattern:**

```python
from alembic.migration_contract import migration_target, validate_migration_execution

@migration_target("tenant")  # or "control" or "both"
def upgrade():
    validate_migration_execution("tenant", op.get_bind().engine.url.database)
    ...
```

CI enforcement: gate exits 1 and blocks merge (violation tagged UMGP-G1).

---

### UMGP-006 — Destructive Operation Approval (CI Gate G2)

**Enforced via:** `scripts/check_migration_governance.py`  
**Applies to:** Revision v1553 and later, `upgrade()` functions only

Any `op.drop_table()`, `op.drop_column()`, `op.drop_index()`, `op.drop_constraint()`,
raw `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or `DELETE FROM` in an `upgrade()` function
MUST be preceded within 3 lines by the approval marker:

```python
# UMGP:DESTRUCTIVE_APPROVED - <justification>
op.drop_table("deprecated_table_name")
```

Preferred alternative: use `IF EXISTS` DDL variants to make operations idempotent.
CI enforcement: gate exits 1 and blocks merge (violation tagged UMGP-G2).

---

### UMGP-007 — Zero Data Loss Verification

**Enforced via:** `auto_migrate.py` post-migration verification

After every migration run, row counts for vital tables MUST be >= pre-migration counts.
Any row count decrease triggers a verification failure.

**Vital tables monitored:** `companies`, `users`, `customers`, `customer_relationships`,
`products`, `item_variants`, `sales_invoices`, `sales_invoice_items`, `stock_movements`

---

### UMGP-008 — Automated Rollback Path

**Enforced via:** `auto_migrate.py --auto-rollback`

Every deployment must have a documented rollback path before execution.
If migration fails and `--auto-rollback` is passed, `auto_migrate.py` restores automatically.

**Manual rollback:**
```bash
python scripts/auto_migrate.py --restore "backend/backups/pre_migration/<session>/<db>_<ts>.dump"
```

---

### UMGP-009 — Hard-Fail on Migration Error

**Enforced via:** `scripts/update.sh`

Deployment scripts MUST NOT suppress migration errors with `|| true`.
Any migration failure MUST abort hard with actionable recovery instructions.

**Prohibited:**
```bash
alembic upgrade head 2>&1 || true
```

**Required:**
```bash
if ! docker compose exec smriti-api python -m app.db.bootstrap_engine; then
    echo "Recovery: docker compose logs smriti-api"
    exit 1
fi
```

---

### UMGP-010 — Docker Healthcheck Dependency

**Enforced via:** `docker-compose.yml`

`smriti-api` MUST declare `condition: service_healthy` on `smriti-db`.
`smriti-db` MUST have a `pg_isready` healthcheck.
Migrations MUST NOT run against a database that has not passed its healthcheck.

**Verification:** TC-UMGP-013

---

### UMGP-011 — CI Gate Mandatory in Pipeline

**Enforced via:** `.github/workflows/ci.yml`

`check_migration_governance.py` MUST be a required, non-skippable step in backend CI.
It MUST run after Alembic migrations and before pytest.

Step name in CI: `UMGP Migration Governance Gate (UMGP-v1.0)`

---

### UMGP-012 — Migration Audit Trail

**Enforced via:** `auto_migrate.py` backup manifest

Every migration run MUST produce an audit record containing: pre-migration Alembic
version, post-migration version, vital table row counts before and after, backup file
path, SHA-256 of backup, and UTC timestamp.

**Audit manifest location:** `backend/backups/pre_migration/<session>/backup_manifest_<ts>.json`

---

## Preflight Checklist

Before any migration or deployment, ALL of the following MUST be confirmed:

- [ ] PostgreSQL is reachable (`pg_isready` passes)
- [ ] Pre-migration backup is created and SHA-256 verified
- [ ] Alembic current version is known and logged
- [ ] Rollback path is documented (backup manifest path available)
- [ ] CI governance gate passes on the PR branch

---

## Rollback Procedure

```bash
# Step 1: Identify the backup session from the manifest
ls backend/backups/pre_migration/

# Step 2: Verify the backup (check SHA-256 in manifest)
python -m json.tool backend/backups/pre_migration/<session>/backup_manifest_*.json

# Step 3: Restore
python scripts/auto_migrate.py --restore "backend/backups/pre_migration/<session>/<db>_<ts>.dump"

# Step 4: Verify restoration
python scripts/auto_migrate.py --verify-only
```

---

## CI Enforcement Architecture

```
Git Push to PR Branch
        |
.github/workflows/ci.yml
        |
  [1]  TypeScript Gate (0 errors required)
  [2]  ESLint
  [3]  Vitest
  [4]  Production Build
  [5]  Ruff Linting
  [6]  Alembic: smritisys (control plane)
  [7]  Alembic: smriti001 (tenant)
  [8]  Naming Guard (NGP-v1.0)
  [9]  Tenant Boundary Guard (TDB-v1.0)
  [10] CFOC Migration Column Guard
  [11] UMGP Migration Governance Gate  <-- THIS POLICY
  [12] pytest (including TC-UMGP-001..014)
        |
Merge Allowed (all gates green)
```

---

## Acceptance Criteria

A migration is **accepted** when ALL of the following are true:

| Criterion                               | Verification Method          |
|-----------------------------------------|------------------------------|
| `check_migration_governance.py` exits 0 | CI gate step                 |
| `@migration_target` declared (v1553+)   | TC-UMGP-002                  |
| No unapproved destructive ops (v1553+)  | TC-UMGP-003                  |
| Migration boundary respected            | TC-UMGP-004, TC-UMGP-005     |
| Preflight backup exists with manifest   | TC-UMGP-008                  |
| Row counts >= pre-migration             | `auto_migrate` verify        |
| Alembic version table at head           | `auto_migrate` verify        |
| All 14 TC-UMGP tests pass               | `pytest`                     |

---

## Enforcement File Registry

| File | Role |
|------|------|
| `scripts/check_migration_governance.py` | CI gate — G1, G2, G3 rules |
| `scripts/auto_migrate.py` | Backup, dynamic head, verify, rollback |
| `scripts/update.sh` | Preflight backup step, hard-fail migration |
| `scripts/update.ps1` | Windows equivalent of update.sh |
| `backend/alembic/migration_contract.py` | Runtime boundary enforcement |
| `backend/app/db/bootstrap_engine.py` | Canonical migration orchestrator |
| `.github/workflows/ci.yml` | CI pipeline with UMGP gate |
| `backend/app/tests/test_upgrade_migration_governance.py` | 14-case regression suite |
| `docs/governance/UPGRADE_MIGRATION_GOVERNANCE_POLICY.md` | This document |

---

## Legacy Migration Grandfather Clause

All Alembic migration files with revision number <= v1552 (238 files as of 2026-10-27)
are **grandfathered** from rules UMGP-005 and UMGP-006. They were authored before this
policy and contain valid, production-tested Alembic DDL. They pass the governance gate
without modification.

New migrations beginning at revision v1553 are subject to all UMGP rules.

---

## Revision History

| Version | Date       | Change |
|---------|------------|--------|
| v1.0.0  | 2026-10-27 | Initial policy — UMGP-001 through UMGP-012; CI gate; 14-case test suite; update.sh preflight backup; auto_migrate.py dynamic head detection |