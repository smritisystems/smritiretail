"""
Test Canonical Schema Extractor from Alembic Migrations v1385-v1388
"""
import sys, os
import importlib.util

sys.path.insert(0, os.path.abspath("backend"))

import alembic.op as a_op

tables = {}
indexes = {}

def mock_f(name):
    return name

def mock_create_table(name, *columns, **kwargs):
    tables[name] = {
        'columns': list(columns),
        'kwargs': kwargs
    }

def mock_create_index(name, table_name, columns, unique=False, schema='public', **kwargs):
    if table_name not in indexes:
        indexes[table_name] = []
    indexes[table_name].append({
        'name': name,
        'columns': columns,
        'unique': unique,
        'kwargs': kwargs
    })

a_op.f = mock_f
a_op.create_table = mock_create_table
a_op.create_index = mock_create_index

# Load migrations
migration_files = [
    ("v1385", "backend/alembic/versions/v1385_crm_and_approvals.py"),
    ("v1386", "backend/alembic/versions/v1386_distribution_warehousing.py"),
    ("v1387", "backend/alembic/versions/v1387_ecommerce_psv_party.py"),
    ("v1388", "backend/alembic/versions/v1388_platform_analytics.py"),
]

for tag, path in migration_files:
    spec = importlib.util.spec_from_file_location(tag, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.upgrade()

print(f"Total tables extracted from v1385-v1388: {len(tables)}")
for tname in sorted(tables.keys()):
    cols = [c.name for c in tables[tname]['columns'] if hasattr(c, 'name') and c.name is not None]
    print(f" - {tname} ({len(cols)} cols)")

