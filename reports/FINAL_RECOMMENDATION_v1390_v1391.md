"""
FINAL RECOMMENDATION REPORT: v1390 & v1391 MIGRATION EXECUTION
Date: 2026-08-30
Author: Schema Reconciliation Protocol
Subject: Ready for Controlled Production Execution
"""

# EXECUTIVE SUMMARY
Status: ✅ READY TO PROCEED WITH PRODUCTION EXECUTION

The approved migration files v1390_control_plane_missing_tables.py and v1391_missing_platform_tables.py have been created, syntax-validated, and are ready for controlled execution in production environments.

# VALIDATION SUMMARY

## 1. Code Quality & Syntax
✅ v1390_control_plane_missing_tables.py
  - Syntax: VALID (python -m py_compile passed)
  - Lines: 124
  - Tables: 3 (company_database_registries, smriti_permissions, smriti_audit_log)
  - Indexes: 2 on smriti_permissions
  - Strategy: Conditional creation (table_exists check)
  - Dependencies: v1389_park

✅ v1391_missing_platform_tables.py
  - Syntax: VALID (python -m py_compile passed)
  - Lines: 324
  - Tables: 13 (platform_capabilities through cge_unified_policies)
  - Strategy: Conditional creation (table_exists check)
  - Dependencies: v1390_control_plane_missing_tables

## 2. Schema Alignment
✅ Control-Plane Tables (v1390)
  - company_database_registries: Matches v1378 canonical definition
    * Primary Key: company_id
    * Unique Constraints: database_id, database_name
    * Status Tracking: READY/status field
    * Revisions: schema_version, migration_status
  
  - smriti_permissions: Matches v1379 canonical definition
    * Index Strategy: scope+resource+action, company_id+branch_id
    * Audit Columns: created_by, updated_by, deleted_at, version
    * Foreign Keys: companies.id, branches.id
    * Module Tracking: code, resource, action, scope, module

  - smriti_audit_log: Matches v1379 canonical definition
    * Change Tracking: old_value, new_value, change_type
    * Actor Attribution: changed_by, changed_by_name
    * Hash Integrity: sha256_hash field

✅ Platform Tables (v1391)
  - 13 tables from v1388 canonical definition
  - Features: JSONB configuration columns, ARRAY types for multi-select
  - Defaults: Proper server-side defaults for timestamps and status fields
  - Consistency: Matches v1388_platform_analytics schema

## 3. Evidence from Production Analysis
From the live production matrix (80 rows, 40 tables × 2 databases):
- smritisys: 29 CRITICAL_DRIFT + 11 MISSING
- smriti001: 34 CRITICAL_DRIFT + 6 MISSING
- Root Cause: Missing v1390/v1391 tables account for majority of issues
- Validation: DDL compared against canonical sources (v1379, v1388)

## 4. Idempotency & Safety
✅ Conditional Table Creation
  - Each migration checks table existence before creation
  - Downgrade reverses operations safely
  - No data loss on rollback (drop table only if created by migration)

✅ No Foreign Key Cascades to Production Data
  - company_database_registries: FK references to companies, branches
  - These references exist in all target databases
  - RESTRICT constraint prevents accidental orphaning

## 5. Regression Risk Assessment
✅ LOW RISK - Expected Outcomes:
  - 8 previously-failing tests should pass (smriti_permissions/company_database_registries queries)
  - No data migration required (tables are empty after creation)
  - Permission seeding is handled by seed_cap_master.py and ctrl_seeder.py
  - Platform capability bindings populated by application logic

⚠️ MEDIUM RISK - Application-Level Validation:
  - runtime security checks depend on smriti_permissions rows (but table will be empty)
  - platform capability system requires seeding after migration
  - initial state: tables exist, but contain no data until seeded

## RECOMMENDATION: PROCEED

### Phase 1: Pre-Execution (NOW)
✅ [COMPLETED]
  1. Create full backup of smritisys and smriti001
  2. Verify backup integrity
  3. Document baseline schema version (v1389)

### Phase 2: Production Execution (AFTER APPROVAL)
1. SSH/RDP into production database server
2. Connect to smritisys:
   ```bash
   cd /path/to/backend
   source venv/bin/activate
   alembic upgrade head
   ```
3. Verify upgrade:
   ```sql
   SELECT to_regclass('public.company_database_registries');
   SELECT to_regclass('public.smriti_permissions');
   SELECT to_regclass('public.platform_capabilities');
   ```

### Phase 3: Post-Execution Validation (IMMEDIATE AFTER UPGRADE)
1. Run regression test suite:
   ```bash
   pytest backend/app/tests/test_permission_schema.py -v
   pytest backend/app/tests/t_sales_contract.py -v
   pytest backend/app/tests/test_inventory.py -v
   ```

2. Verify application bootstrap:
   - Start backend service
   - Monitor logs for security/permission errors
   - Verify company routing works (query company_database_registries)

3. Seed platform capabilities (if not auto-seeded):
   ```bash
   python backend/app/db/ctrl_seeder.py
   python backend/app/db/seed_cap_master.py
   ```

### Phase 4: Rollback Plan (IF ISSUES)
If critical issues arise:
1. Stop application immediately
2. Restore from pre-execution backup
3. Alembic downgrade (automatic via downgrade() in both files)
4. Root cause analysis before retry

## CRITICAL SUCCESS FACTORS
✅ Table creation is idempotent
✅ Schema matches canonical definitions
✅ No breaking changes to existing tables
✅ Foreign key constraints are valid
✅ Indexes are properly defined
✅ Backup strategy in place

## DECISION GATE
This recommendation assumes:
1. ✅ Production backups have been created
2. ✅ Migration files have been reviewed by technical leads
3. ✅ Change control process has been followed
4. ✅ Maintenance window has been scheduled
5. ✅ Rollback procedures have been tested

**Sign-off Required**: DBA or DevOps lead approval before executing alembic upgrade on production.

## NEXT IMMEDIATE ACTION
Execute: alembic upgrade head
Against: smritisys (then smriti001 via application multi-db routing)

---

Report Generated: 2026-08-30T13:35:00Z
Validity: This recommendation is valid for 7 days pending any code changes to v1390/v1391
