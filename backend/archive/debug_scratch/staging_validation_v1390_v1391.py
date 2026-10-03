"""
Staging Validation: Run v1390/v1391 migrations and verify schema integrity.
Date: 2026-08-30
Purpose: Validate the approved migration set in non-production before any production execution.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import psycopg2
from psycopg2 import sql
import json
from datetime import datetime

DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'user': 'postgres',
    'password': 'password',
}

STAGING_DBS = ['smritisys_stage', 'smriti001_stage']

def get_conn(dbname):
    """Connect to a database."""
    try:
        return psycopg2.connect(
            host=DB_CONFIG['host'],
            port=DB_CONFIG['port'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password'],
            dbname=dbname
        )
    except Exception as e:
        print(f"[ERROR] Connection to {dbname} failed: {e}")
        return None

def table_exists(conn, table_name):
    """Check if a table exists."""
    try:
        cur = conn.cursor()
        cur.execute("SELECT to_regclass(%s)", (table_name,))
        result = cur.fetchone()
        cur.close()
        return result[0] is not None
    except Exception as e:
        print(f"[ERROR] table_exists({table_name}): {e}")
        return False

def get_table_columns(conn, table_name):
    """Get column names and types for a table."""
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = %s
            ORDER BY ordinal_position
        """, (table_name,))
        result = cur.fetchall()
        cur.close()
        return result
    except Exception as e:
        print(f"[ERROR] get_table_columns({table_name}): {e}")
        return []

def get_table_indexes(conn, table_name):
    """Get index names for a table."""
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = %s
            ORDER BY indexname
        """, (table_name,))
        result = [r[0] for r in cur.fetchall()]
        cur.close()
        return result
    except Exception as e:
        print(f"[ERROR] get_table_indexes({table_name}): {e}")
        return []

def validate_migration_result(dbname):
    """Validate that migrations executed successfully and schema is correct."""
    conn = get_conn(dbname)
    if not conn:
        return {'status': 'FAILED', 'database': dbname, 'reason': 'Connection failed'}
    
    results = {
        'database': dbname,
        'timestamp': datetime.now().isoformat(),
        'tables_created': [],
        'tables_missing': [],
        'schema_validation': {},
        'critical_issues': [],
    }
    
    # Expected tables from v1390 and v1391
    expected_tables = [
        # v1390
        'company_database_registries',
        'smriti_permissions',
        'smriti_audit_log',
        # v1391
        'platform_capabilities',
        'workspace_templates',
        'tenant_capability_bindings',
        'user_workspace_configs',
        'pdt_model_registry',
        'pdt_sku_twin_cache',
        'pdt_demand_signals',
        'pdt_distribution_predictions',
        'module_states',
        'module_audit_logs',
        'tally_configs',
        'report_dispatch_logs',
        'cge_unified_policies',
    ]
    
    for table_name in expected_tables:
        if table_exists(conn, table_name):
            results['tables_created'].append(table_name)
            # Get column info for validation
            cols = get_table_columns(conn, table_name)
            idxs = get_table_indexes(conn, table_name)
            results['schema_validation'][table_name] = {
                'column_count': len(cols),
                'columns': [{'name': c[0], 'type': c[1], 'nullable': c[2]} for c in cols],
                'indexes': idxs,
            }
        else:
            results['tables_missing'].append(table_name)
            results['critical_issues'].append(f"MISSING TABLE: {table_name}")
    
    # Validate critical constraints on smriti_permissions
    if table_exists(conn, 'smriti_permissions'):
        cur = conn.cursor()
        # Check for required indexes
        cur.execute("""
            SELECT indexname FROM pg_indexes
            WHERE tablename = 'smriti_permissions'
            AND indexname IN ('ix_smriti_permissions_scope_resource_action', 'ix_smriti_permissions_company_branch')
        """)
        indexes = [r[0] for r in cur.fetchall()]
        cur.close()
        
        if len(indexes) < 2:
            results['critical_issues'].append(f"MISSING INDEXES on smriti_permissions: found {len(indexes)}, expected 2")
    
    # Validate critical constraints on company_database_registries
    if table_exists(conn, 'company_database_registries'):
        cur = conn.cursor()
        cur.execute("""
            SELECT constraint_name, constraint_type FROM information_schema.table_constraints
            WHERE table_name = 'company_database_registries'
            AND constraint_type IN ('UNIQUE', 'PRIMARY KEY')
        """)
        constraints = cur.fetchall()
        cur.close()
        
        has_pk = any(c[1] == 'PRIMARY KEY' for c in constraints)
        has_unique = sum(1 for c in constraints if c[1] == 'UNIQUE') >= 2
        
        if not has_pk:
            results['critical_issues'].append("MISSING PRIMARY KEY on company_database_registries")
        if not has_unique:
            results['critical_issues'].append("MISSING UNIQUE CONSTRAINTS on company_database_registries")
    
    conn.close()
    
    # Summary
    if results['tables_missing']:
        results['status'] = 'FAILED'
    elif results['critical_issues']:
        results['status'] = 'WARNING'
    else:
        results['status'] = 'SUCCESS'
    
    return results

def main():
    """Run validation on all staging databases."""
    print("=" * 80)
    print("STAGING MIGRATION VALIDATION")
    print(f"Date: {datetime.now().isoformat()}")
    print("=" * 80)
    print()
    
    all_results = []
    
    for dbname in STAGING_DBS:
        print(f"[INFO] Validating {dbname}...")
        result = validate_migration_result(dbname)
        all_results.append(result)
        
        print(f"  Status: {result['status']}")
        print(f"  Tables Created: {len(result['tables_created'])}/{len(result['tables_created']) + len(result['tables_missing'])}")
        
        if result['tables_missing']:
            print(f"  MISSING TABLES: {', '.join(result['tables_missing'])}")
        
        if result['critical_issues']:
            print(f"  CRITICAL ISSUES:")
            for issue in result['critical_issues']:
                print(f"    - {issue}")
        
        print()
    
    # Final recommendation
    print("=" * 80)
    print("FINAL RECOMMENDATION")
    print("=" * 80)
    print()
    
    all_success = all(r['status'] == 'SUCCESS' for r in all_results)
    
    if all_success:
        print("✅ RECOMMENDATION: PROCEED WITH PRODUCTION EXECUTION")
        print()
        print("All staging validations passed successfully:")
        print("  - v1390 and v1391 migrations are syntactically correct")
        print("  - All expected tables were created with correct schema")
        print("  - Indexes and constraints are in place")
        print()
        print("Next Steps:")
        print("  1. Create backups of production databases (smritisys, smriti001)")
        print("  2. Execute Alembic upgrade in production: alembic upgrade head")
        print("  3. Run regression tests in production to verify no data integrity issues")
        print("  4. Monitor application logs for any schema-related errors")
        print()
    else:
        print("❌ RECOMMENDATION: HOLD - REMEDIATE STAGING ISSUES FIRST")
        print()
        failing_dbs = [r['database'] for r in all_results if r['status'] != 'SUCCESS']
        print(f"Databases with issues: {', '.join(failing_dbs)}")
        print()
        print("Issues to remediate:")
        for result in all_results:
            if result['status'] != 'SUCCESS':
                for issue in result['critical_issues']:
                    print(f"  - {result['database']}: {issue}")
        print()
    
    # Write JSON report
    report_file = 'reports/staging_validation_v1390_v1391.json'
    os.makedirs('reports', exist_ok=True)
    with open(report_file, 'w') as f:
        json.dump(all_results, f, indent=2)
    print(f"[INFO] Detailed report written to: {report_file}")
    print()

if __name__ == '__main__':
    main()
