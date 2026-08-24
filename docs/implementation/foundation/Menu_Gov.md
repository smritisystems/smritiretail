<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-08-15
  Modified     : 2026-08-15
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Menu Governance Migration & Deployment Plan v3.0 (Hardened Baseline)

## 1. Objective
Establish a hardened, zero-data-loss, fail-closed database migration and deployment pipeline to apply the approved **SMRITI Menu Governance — Target Navigation Model v1.0** to PostgreSQL table `smriti_menus` in `smritisys` while preserving audit integrity in `smriti_audit_log`.

## 2. Business Motivation
Reorganize the 34 Control Plane menu records into 8 clean navigation groups, establish parent-child workspace hierarchies, and enforce workspace access permissions without mutating primary key menu IDs or breaking backend API authorization boundaries.

## 3. Scope & Non-Negotiable Hardening Safeguards
- **Zero Database Mutation Prior to `--apply`**: `--dry-run` is read-only.
- **Immutable Menu ID Protection**: Migration requires exact set of 34 expected IDs from `TARGET_MODEL_V1`. Any missing, unexpected, or duplicate ID halts execution immediately.
- **Live Database Drift Protection**: Live DB rows are compared against expected baseline before generating UPDATE statements. Any unacknowledged drift halts execution.
- **Human-Readable Dry Run**: `--dry-run` outputs both a detailed per-menu Human-Readable Decision Diff and a summary SQL Diff.
- **Timestamped Immutable Backup**: Pre-migration backup captures complete `smriti_menus` table state, schema metadata, constraints, row count, AND latest `sha256_hash` and `prev_hash` from `smriti_audit_log`.
- **Single Transactional Apply**: All operations execute inside a single PostgreSQL transaction (`BEGIN ... COMMIT`) with automatic `ROLLBACK` on any error.
- **Audit Hash Integrity**: Structural edits log change entries to `smriti_audit_log` with `sha256_hash` and `prev_hash` chain preservation.
- **Hardened Audited Rollback**: `scripts/rollback_menu_migration.py` performs transactional rollback by restoring pre-migration values AND writing audit entries with `change_type = 'ROLLBACK'`.
- **Protected Defaults Preserved**: `menu-dashboard`, `menu-inventory`, `menu-sales`, `menu-reports` identities remain immutable.

## 4. Current State
- `smriti_menus` contains 34 active records (0 inactive, 34 root-level, 0 children).
- All 34 records currently have `tenant_id=NULL`, `company_id=NULL`, `branch_id=NULL` (Global scope).
- 4 default system rows preserved (`menu-dashboard`, `menu-inventory`, `menu-sales`, `menu-reports`).

## 5. Gap Analysis
- Flat navigation (34 root menus, 0 child menus) lacks workspace nesting.
- Category name `Master Framework` updated to `Configuration & Governance`.
- Workspace access permissions explicitly bound (`POS.WORKSPACE.ACCESS`, `INVENTORY.WORKSPACE.ACCESS`, etc.).

## 6. Architecture Impact
- Reuses existing Control Plane tables `smriti_menus` and `smriti_audit_log` (Zero duplicate tables).
- Decouples menu visibility from backend API authorization guards.
- Preserves all 34 primary key menu IDs (`menu-dashboard`, `menu-pos`, `menu-sales`, etc.).

## 7. Proposed Design
Controlled dry-run and execution pipeline via `scripts/migrate_menu_governance_v1.py`:
1. **Pre-migration Backup**: Exports database state snapshot to `scratch/backups/smriti_menus_backup_YYYYMMDD_HHMMSS.json`.
2. **Dry-Run Diff**: Generates exact SQL update statements and prints proposed human decision diff.
3. **Transactional Apply**: Executes updates inside a single PostgreSQL transaction (`BEGIN ... COMMIT`).
4. **Audit Generation**: Writes audit log entries to `smriti_audit_log` with SHA-256 hashes.
5. **Post-migration Verification**: Asserts 34 total records remain active, 4 protected rows preserved, and parent-child parent_id links valid.

## 8. Files Created
- `scripts/migrate_menu_governance_v1.py`
- `scripts/rollback_menu_migration.py`
- `scripts/verify_menu_migration.py`

## 9. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 10. Dependencies
- PostgreSQL `smritisys`
- `smriti_menus` and `smriti_audit_log` tables
- `psycopg2` Python client

## 11. Risks & Fail-Closed Safeguards
- Database drift or missing IDs.
- *Mitigation*: Fail-closed validation halts execution before any mutation if drift or missing IDs are detected.

## 12. Rollback Strategy
Hardened transactional rollback script `scripts/rollback_menu_migration.py` restores pre-migration snapshot values and logs explicit `change_type = 'ROLLBACK'` audit records to `smriti_audit_log`.

## 13. Verification Plan
- `python scripts/verify_menu_migration.py` (Exact 34 IDs, protected defaults, 0 orphans).
- `pytest backend/tests/test_menu_governance.py`.
- `python scripts/test_menu_security_matrix.py`.
- `python scripts/test_browser_navigation_e2e.py`.
- `npx vite build`.

## 14. Test Plan
- Execution of dry-run mode: `python scripts/migrate_menu_governance_v1.py --dry-run` (PASSED).

## 15. Documentation Impact
Update documentation registry and issue migration walkthrough report.

## 16. Deployment Plan
1. Run dry-run mode: `python scripts/migrate_menu_governance_v1.py --dry-run`
2. Review human decision diff and SQL diff with human architect.
3. Run apply mode ONLY UPON EXPLICIT HUMAN APPROVAL: `python scripts/migrate_menu_governance_v1.py --apply`
4. Run verification suite: `python scripts/verify_menu_migration.py`

## 17. Status
DRY_RUN_PASSED / READY_FOR_APPROVAL

## 18. Related ADRs
- ADR-014: Control Plane Security & Single Workspace Architecture.

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Menu_Management_Governance_v1.0.md`
