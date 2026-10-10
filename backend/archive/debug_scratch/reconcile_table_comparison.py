from sqlalchemy import create_engine, inspect
from sqlalchemy.pool import NullPool

print("TABLE COMPARISON: FRESH VS PRODUCTION")
print("=" * 70)

dbs = {
    'Fresh (test)': 'postgresql://postgres:postgres@localhost:5432/smriti_diag_fresh_test',
    'Control (prod)': 'postgresql://postgres:postgres@localhost:5432/smritisys',
    'Tenant (prod)': 'postgresql://postgres:postgres@localhost:5432/smriti001'
}

all_tables = {}
for label, url in dbs.items():
    engine = create_engine(url, poolclass=NullPool)
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    all_tables[label] = tables
    
    print(f"{label:35} {len(tables):3} tables")
    engine.dispose()

print()
print("DIFFERENCES:")
print("-" * 70)

fresh = all_tables['Fresh (test)']
control = all_tables['Control (prod)']
tenant = all_tables['Tenant (prod)']

missing_control = control - fresh
missing_tenant = tenant - fresh

print(f"Missing in fresh from control plane: {len(missing_control)} tables")
if missing_control:
    for t in sorted(missing_control)[:5]:
        print(f"  - {t}")
    if len(missing_control) > 5:
        print(f"  ... and {len(missing_control)-5} more")

print()
print(f"Missing in fresh from tenant: {len(missing_tenant)} tables")
if missing_tenant:
    for t in sorted(missing_tenant)[:5]:
        print(f"  - {t}")
    if len(missing_tenant) > 5:
        print(f"  ... and {len(missing_tenant)-5} more")

print()
print("=" * 70)
if len(missing_control) == 0 and len(missing_tenant) == 0:
    print("✅ FRESH DATABASE = SCHEMA COMPLETE")
    print("   All required tables present via upgrade-only")
else:
    print(f"⚠️  FRESH DATABASE = INCOMPLETE")
    print(f"   Missing {len(missing_control)} control tables, {len(missing_tenant)} tenant tables")
