from sqlalchemy import create_engine, inspect
from sqlalchemy.pool import NullPool

dbs = {
    'Fresh': 'postgresql://postgres:postgres@localhost:5432/smriti_diag_fresh_test',
    'Control': 'postgresql://postgres:postgres@localhost:5432/smritisys',
    'Tenant': 'postgresql://postgres:postgres@localhost:5432/smriti001'
}

all_tables = {}
for label, url in dbs.items():
    engine = create_engine(url, poolclass=NullPool)
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    all_tables[label] = tables
    engine.dispose()

print("MISSING TABLES FROM FRESH DATABASE")
print("=" * 70)
print()

fresh = all_tables['Fresh']
control = all_tables['Control']
tenant = all_tables['Tenant']

missing_control = sorted(control - fresh)
missing_tenant = sorted(tenant - fresh)

if missing_control:
    print(f"CONTROL PLANE ({len(missing_control)} missing):")
    for t in missing_control:
        print(f"  {t}")

print()

if missing_tenant:
    print(f"TENANT ({len(missing_tenant)} missing):")
    for t in missing_tenant:
        print(f"  {t}")

print()
print("=" * 70)
print(f"Total missing from fresh: {len(missing_control) + len(missing_tenant)} tables")
print()
print("ASSESSMENT:")
print("⛔ FRESH DATABASE REPRODUCIBILITY = INCOMPLETE")
print(f"   Expected ~213-214 tables, got {len(fresh)}")
print()
print("These missing tables mean:")
print("  1. Migrations incomplete or")
print("  2. Manual SQL tables added to production but not in migrations")
print()
print("ACTION REQUIRED: Audit where these 70 tables come from")
