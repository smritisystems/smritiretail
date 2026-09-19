import psycopg2

# Check control-plane tables in smritisys
conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smritisys')
cur = conn.cursor()

tables_to_check = ['company_database_registries', 'smriti_permissions', 'smriti_audit_log']
print('✅ Control-plane tables in smritisys:')
for tbl in tables_to_check:
    cur.execute(f"SELECT to_regclass('public.{tbl}') IS NOT NULL")
    exists = cur.fetchone()[0]
    status = '✅' if exists else '❌'
    print(f'  {status} {tbl}')

conn.close()

# Check platform tables in smriti001
conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
cur = conn.cursor()

platform_tables = ['platform_capabilities', 'workspace_templates', 'tenant_capability_bindings', 'user_workspace_configs', 'pdt_model_registry', 'pdt_sku_twin_cache']
print('\n✅ Platform tables in smriti001 (sample):')
for tbl in platform_tables:
    cur.execute(f"SELECT to_regclass('public.{tbl}') IS NOT NULL")
    exists = cur.fetchone()[0]
    status = '✅' if exists else '❌'
    print(f'  {status} {tbl}')

print('\n✅ Alembic version tracking:')
cur.execute("SELECT version_num FROM alembic_version ORDER BY version_num DESC LIMIT 2")
for row in cur.fetchall():
    print(f'  {row[0]}')

conn.close()
