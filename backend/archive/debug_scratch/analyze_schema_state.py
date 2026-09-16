#!/usr/bin/env python
"""
Check schema state and identify which migrations have already been applied
but not yet stamped in alembic_version.
"""
import psycopg2

conn = psycopg2.connect(host='localhost', user='postgres', password='postgres', dbname='smritisys')
cur = conn.cursor()

# Check which tables from v1385-v1391 exist
tables_by_migration = {
    'v1385_crm': ['crm_leads', 'crm_opportunities', 'approval_workflows'],
    'v1386_dist': ['distribution_centers', 'warehouse_zones'],
    'v1387_ecom': ['ecom_channels', 'party_addresses'],
    'v1388_plat': ['platform_capabilities', 'workspace_templates', 'module_states'],
    'v1390_ctrl': ['company_database_registries', 'smriti_permissions', 'smriti_audit_log'],
    'v1391_plat': ['pdt_model_registry', 'pdt_distribution_predictions', 'tally_configs'],
}

print("=" * 80)
print("SCHEMA STATE ANALYSIS")
print("=" * 80)
print()

migration_states = {}
for migration, tables in tables_by_migration.items():
    existing = 0
    for table in tables:
        cur.execute(f"SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='{table}');")
        if cur.fetchone()[0]:
            existing += 1
    
    all_exist = existing == len(tables)
    migration_states[migration] = {
        'tables': tables,
        'existing': existing,
        'total': len(tables),
        'complete': all_exist
    }
    
    status = "✓ COMPLETE" if all_exist else f"✗ PARTIAL ({existing}/{len(tables)})"
    print(f"{migration:20s} {status}")
    for table in tables:
        cur.execute(f"SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='{table}');")
        exists = "✓" if cur.fetchone()[0] else "✗"
        print(f"  {exists} {table}")

print()
print("=" * 80)
print("ALEMBIC VERSION")
print("=" * 80)
cur.execute("SELECT * FROM alembic_version;")
current = cur.fetchone()
print(f"Current version in DB: {current[0]}")

print()
print("=" * 80)
print("RECOMMENDATION")
print("=" * 80)

# Analyze the gap
v1385_complete = migration_states['v1385_crm']['complete']
v1386_complete = migration_states['v1386_dist']['complete']
v1387_complete = migration_states['v1387_ecom']['complete']
v1388_complete = migration_states['v1388_plat']['complete']
v1390_complete = migration_states['v1390_ctrl']['complete']
v1391_complete = migration_states['v1391_plat']['complete']

print()
if not v1390_complete:
    print("❌ CRITICAL: v1390 tables are MISSING")
    print("   - company_database_registries")
    print("   - smriti_permissions")
    print("   - smriti_audit_log")
    print()
    print("ACTION: These tables MUST be created before production tests can pass.")
    print()

if not v1391_complete:
    print("⚠️  WARNING: v1391 tables are MISSING")
    print("   - platform_capabilities, workspace_templates, etc.")
    print()

if v1385_complete and v1386_complete and v1387_complete and v1388_complete:
    print("✅ Tables from v1385-v1388 already exist in database.")
    print()
    print("NEXT STEPS:")
    print("1. Create v1389_park migration record (it does nothing)")
    print("2. Apply v1390 migration (create missing control-plane tables)")
    print("3. Apply v1391 migration (create remaining platform tables)")
    print("4. Run regression tests")
    print()
    print("To safely catch up to v1390:")
    print("  alembic stamp v1389_park")
    print("  alembic upgrade head")
    print()

cur.close()
conn.close()
