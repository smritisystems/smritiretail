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
Classification: Internal Walkthrough
-->

# Walkthrough: Upgrade & Migration Governance Policy v1.0.0

**Area:** Governance  
**Topic:** UMGP — Upgrade and Migration Governance Policy  
**Version:** 1.0.0  
**Date:** 2026-10-27  
**Author:** Jawahar Ramkripal Mallah  
**Commits:** `dd7c8f39` (UMGP implementation), `417fd79b` (einvoice async follow-up)

---

## 1. Purpose

Establish permanent, machine-enforced governance rules for every database schema
migration, deployment, and upgrade operation in SMRITI Retail OS. Prevent data
loss, ensure rollback paths exist before migrations run, and block non-compliant
migrations at CI time.

---

## 2. Scope

| Layer | Scope |
|-------|-------|
| CI/CD | `.github/workflows/ci.yml` — UMGP gate added as required step |
| Scripts | `scripts/check_migration_governance.py` (new), `scripts/auto_migrate.py` (updated), `scripts/update.sh` (updated) |
| Tests | `backend/app/tests/test_upgrade_migration_governance.py` (14 new test cases) |
| Documentation | `docs/governance/UPGRADE_MIGRATION_GOVERNANCE_POLICY.md` (new) |
| Router fixes | `dispatch_invoicing.py`, `tds_compliance.py`, `einvoice.py`, `crm_reports.py` |
| Async migration | `einvoice.py` — full body async migration (commit `417fd79b`) |

---

## 3. Files Created

| File | Purpose |
|------|---------|
| `scripts/check_migration_governance.py` | CI gate: G1 (target declaration), G2 (destructive approval), G3 (hardcoded DB name warnings) |
| `backend/app/tests/test_upgrade_migration_governance.py` | 14-case regression test suite TC-UMGP-001 through TC-UMGP-014 |
| `docs/governance/UPGRADE_MIGRATION_GOVERNANCE_POLICY.md` | Permanent governance policy (12 rules, CI architecture, rollback procedures, acceptance criteria) |
| `docs/walkthrough/governance/Governance_UMGP_Upgrade_Migration_Policy_v1.0.0.md` | This walkthrough |

---

## 4. Files Modified

| File | Change |
|------|--------|
| `scripts/auto_migrate.py` | Added `_get_alembic_head()` and `_is_at_head()` — dynamic head detection (UMGP-003) |
| `scripts/update.sh` | 5-step → 6-step; added mandatory preflight backup as Step 2/6 (UMGP-001); hard-fail migration errors (UMGP-009) |
| `.github/workflows/ci.yml` | Added `UMGP Migration Governance Gate (UMGP-v1.0)` step after CFOC guard, before pytest |
| `backend/app/api/v1/dispatch_invoicing.py` | Added missing `get_company_db` import from `app.api.deps` |
| `backend/app/api/v1/tds_compliance.py` | Added missing `get_company_db` import from `app.api.deps` |
| `backend/app/api/v1/einvoice.py` | BOM stripped; `get_company_db` import added; `Session→AsyncSession`; all 6 endpoint bodies async-migrated (`db.query→await db.execute(select(...))`) |
| `backend/app/api/v1/crm_reports.py` | BOM stripped |

---

## 5. Architecture Decisions

### AD-1: Grandfather Clause at v1552
All 238 existing migrations are grandfathered from rules UMGP-005 (target
declaration) and UMGP-006 (destructive approval). The cutoff is revision ≥ v1553.
**Rationale:** Retrofitting decorators on 238 files would be high-risk with zero
functional benefit. The CI gate validates new code paths only.

### AD-2: G2 Checks Upgrade-Only
The destructive operation check (UMGP-006 / G2) applies only to `upgrade()`
function bodies. `downgrade()` functions legitimately use `drop_table()` as their
primary mechanism. Checking `downgrade()` bodies would produce 100% false positives
on all 238 legacy migrations.

### AD-3: G3 as Warning, Not Failure
Hardcoded tenant DB names (`smriti001`, etc.) in legacy migration comments and
docstrings are flagged as warnings (UMGP-G3-WARN) but do not fail the gate.
These references are in comment lines, not executable code, and retrofitting them
carries unnecessary churn risk.

### AD-4: Dynamic Alembic Head via Subprocess
`_get_alembic_head()` runs `alembic heads --verbose` in a subprocess rather than
importing Alembic's Python API. This avoids requiring a live database connection
just to read the script directory head and keeps `auto_migrate.py` self-contained.

---

## 6. Design Rationale

The UMGP policy is designed around three failure modes observed in pre-policy
deployments:

1. **Silent migration failures** — `|| true` in bash scripts suppressed errors.
   Fixed by UMGP-009 (hard-fail) and UMGP-001 (backup before any attempt).

2. **Hardcoded head versions** — `ver == "v1543"` broke immediately when new
   migrations were added. Fixed by UMGP-003 (dynamic head query).

3. **Cross-boundary migrations** — No machine check prevented a `target=control`
   migration running against tenant DBs. Fixed by UMGP-004 (`migration_contract.py`
   `validate_migration_execution()` called at runtime in every new migration).

---

## 7. Implementation Summary

| Rule | Mechanism | Status |
|------|-----------|--------|
| UMGP-001 Preflight backup | `update.sh` Step 2/6 → `auto_migrate.py --backup-only` | Done |
| UMGP-002 Canonical orchestrator | `bootstrap_engine.py` called from `update.sh` Step 5/6 | Done |
| UMGP-003 Dynamic head | `_get_alembic_head()` + `_is_at_head()` in `auto_migrate.py` | Done |
| UMGP-004/005 Boundary enforcement | `migration_contract.py` `validate_migration_execution()` | Done (existing) |
| UMGP-005 CI Gate G1 | `check_migration_governance.py` → CI step | Done |
| UMGP-006 CI Gate G2 | `check_migration_governance.py` → CI step | Done |
| UMGP-009 Hard-fail | `update.sh` — no `|| true`, explicit `exit 1` | Done |
| UMGP-010 Docker healthcheck | `docker-compose.yml` — `pg_isready` + `service_healthy` | Done (existing) |
| UMGP-011 CI gate mandatory | `.github/workflows/ci.yml` non-skippable step | Done |
| einvoice async follow-up | All 6 endpoint bodies: `async def` + `await db.execute(select(...))` | Done |

---

## 8. Tests Executed

**Command:**
```
pytest backend/app/tests/test_upgrade_migration_governance.py -v --tb=short -p no:cacheprovider
```

| TC | Name | Result |
|----|------|--------|
| TC-UMGP-001 | `test_ci_gate_passes_on_existing_migrations` | PASSED |
| TC-UMGP-002 | `test_ci_gate_blocks_migration_missing_target` | PASSED |
| TC-UMGP-003 | `test_ci_gate_blocks_destructive_without_approval` | PASSED |
| TC-UMGP-004 | `test_migration_boundary_tenant_blocked_on_control` | PASSED |
| TC-UMGP-005 | `test_migration_boundary_control_blocked_on_tenant` | PASSED |
| TC-UMGP-006 | `test_migration_boundary_both_allowed_everywhere` | PASSED |
| TC-UMGP-007 | `test_auto_migrate_verify_only` | PASSED |
| TC-UMGP-008 | `test_auto_migrate_backup_creates_manifest` | PASSED |
| TC-UMGP-009 | `test_update_sh_has_preflight_backup` | PASSED |
| TC-UMGP-010 | `test_update_ps1_uses_bootstrap_engine` | PASSED |
| TC-UMGP-011 | `test_migration_inventory_count` | PASSED |
| TC-UMGP-012 | `test_migration_contract_exports` | PASSED |
| TC-UMGP-013 | `test_docker_compose_db_healthcheck` | PASSED |
| TC-UMGP-014 | `test_umgp_governance_document_exists` | PASSED |

**Result: 14 passed, 0 failed in 135.00s**

---

## 9. Verification Results

| Evidence | Value |
|----------|-------|
| pytest exit code | 0 |
| Tests | 14/14 passed |
| CI gate exit code | 0 |
| Migrations scanned | 238 |
| G1 violations | 0 |
| G2 violations | 0 |
| G3 warnings (non-blocking) | 15 |
| Commit (UMGP impl) | `dd7c8f39` |
| Commit (einvoice async) | `417fd79b` |
| app.main import | OK (verified via subprocess) |

---

## 10. Known Limitations

- **einvoice.py endpoints are scaffolded, not production IRP-connected.** The
  `_simulate_irn()` function generates a SHA-256 hash as a placeholder until live
  NIC/IRP credentials are configured in settings. This is a deliberate design
  decision documented in the module header.
- **G3 warnings (15):** Hardcoded `smriti001` references in legacy migration
  docstrings — non-blocking, but should be cleaned up when those files are next
  touched.
- **einvoice.py has no dedicated test suite.** The async migration was structural;
  a dedicated `test_einvoice.py` should be written in a follow-up sprint with a
  test database that has the `einvoices` table provisioned.

---

## 11. Future Work

- Write `backend/app/tests/test_einvoice.py` against a provisioned test DB.
- Integrate UMGP with pre-commit hooks for local enforcement before CI push.
- Implement `--dry-run` flag in `auto_migrate.py` to preview migration plan without
  executing it.
- Address 15 G3 warnings (hardcoded `smriti001` in legacy migration docstrings)
  in a dedicated cleanup sprint.

---

## 12. Related ADRs

- TDB-v2.0 (Tenant Database Boundary Policy) — enforced by `migration_contract.py`
- NGP-v1.0 (Naming Governance Policy) — CI gate at step 8
- CFOC-v3.46.0 (Canonical Field Ownership Contract) — CI gate at step 10/11

---

## 13. Related RFCs

- SMRITI Backend System-of-Record Policy (AGENTS.md Rule: FastAPI + Postgres sole backend)
- SMRITI Human-Readable Error Policy (HREP) — all error messages use business language
