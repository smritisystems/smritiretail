"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-08-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITI CANONICAL SCHEMA -- EXACT METADATA COMPARATOR (READ-ONLY)
"""

import sys, os, re, json
import importlib.util
import psycopg2
import psycopg2.extras
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import alembic.op as a_op

sys.stdout.reconfigure(encoding='utf-8')

# ----------------------------------------------------------------------
# 1. BUILD CANONICAL DEFINITIONS
# ----------------------------------------------------------------------
canonical_tables = {}
canonical_indexes = {}
canonical_migration_map = {}

def mock_f(name):
    return name

def mock_create_table(name, *columns, **kwargs):
    canonical_tables[name] = {
        'columns': list(columns),
        'kwargs': kwargs,
        'migration': current_migration_tag
    }
    canonical_migration_map[name] = current_migration_tag

def mock_create_index(name, table_name, columns, unique=False, schema='public', **kwargs):
    if table_name not in canonical_indexes:
        canonical_indexes[table_name] = []
    canonical_indexes[table_name].append({
        'name': name,
        'columns': columns,
        'unique': unique,
        'kwargs': kwargs
    })

a_op.f = mock_f
a_op.create_table = mock_create_table
a_op.create_index = mock_create_index

migration_files = [
    ("v1385_crm", "backend/alembic/versions/v1385_crm_and_approvals.py"),
    ("v1386_dist", "backend/alembic/versions/v1386_distribution_warehousing.py"),
    ("v1387_ecom", "backend/alembic/versions/v1387_ecommerce_psv_party.py"),
    ("v1388_plat", "backend/alembic/versions/v1388_platform_analytics.py"),
]

for tag, path in migration_files:
    current_migration_tag = tag
    spec = importlib.util.spec_from_file_location(tag, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.upgrade()

print(f"Canonical Tables Loaded from v1385-v1388: {len(canonical_tables)}")

# Parse canonical schema into structured comparison dictionaries
def normalize_type_str(sa_type):
    t_str = str(sa_type).upper()
    if isinstance(sa_type, sa.String):
        if sa_type.length is not None:
            return f"VARCHAR({sa_type.length})"
        return "VARCHAR"
    if isinstance(sa_type, sa.Text):
        return "TEXT"
    if isinstance(sa_type, sa.Integer):
        return "INTEGER"
    if isinstance(sa_type, sa.BigInteger):
        return "BIGINT"
    if isinstance(sa_type, sa.SmallInteger):
        return "SMALLINT"
    if isinstance(sa_type, sa.Boolean):
        return "BOOLEAN"
    if isinstance(sa_type, sa.Numeric):
        p = sa_type.precision or 10
        s = sa_type.scale or 0
        return f"NUMERIC({p},{s})"
    if isinstance(sa_type, sa.DateTime):
        if getattr(sa_type, 'timezone', False):
            return "TIMESTAMP WITH TIME ZONE"
        return "TIMESTAMP WITHOUT TIME ZONE"
    if isinstance(sa_type, sa.Date):
        return "DATE"
    if isinstance(sa_type, postgresql.JSONB):
        return "JSONB"
    if isinstance(sa_type, postgresql.ARRAY):
        item_type = normalize_type_str(sa_type.item_type)
        return f"{item_type}[]"
    return t_str

canonical_defs = {}
for tname, tdata in canonical_tables.items():
    cols = {}
    pks = []
    uniques = []
    fks = []
    checks = []

    for item in tdata['columns']:
        if isinstance(item, sa.Column):
            c_type = normalize_type_str(item.type)
            default_val = None
            if item.server_default is not None:
                if hasattr(item.server_default, 'arg'):
                    default_val = str(item.server_default.arg).strip()
                    if isinstance(item.server_default.arg, sa.TextClause):
                        default_val = str(item.server_default.arg.text).strip()
                else:
                    default_val = str(item.server_default).strip()
            
            # Normalize common text defaults
            if default_val:
                default_val = default_val.replace("'", "").strip()
            
            cols[item.name] = {
                'name': item.name,
                'type': c_type,
                'nullable': item.nullable if item.nullable is not None else True,
                'default': default_val,
                'primary_key': bool(item.primary_key)
            }
            if item.primary_key:
                pks.append(item.name)

        elif isinstance(item, sa.PrimaryKeyConstraint):
            for c in item.columns:
                pks.append(c.name if hasattr(c, 'name') else str(c))
        elif isinstance(item, sa.UniqueConstraint):
            u_cols = [c.name if hasattr(c, 'name') else str(c) for c in item.columns]
            uniques.append({
                'name': item.name,
                'columns': sorted(u_cols)
            })
        elif isinstance(item, sa.ForeignKeyConstraint):
            source_cols = [c.name if hasattr(c, 'name') else str(c) for c in item.columns]
            target_table = ""
            target_cols = []
            for elem in item.elements:
                tf = getattr(elem, 'target_fullname', str(elem))
                parts = tf.split('.')
                if len(parts) >= 2:
                    target_table = parts[-2]
                    target_cols.append(parts[-1])
                else:
                    target_cols.append(tf)
            fks.append({
                'source_columns': sorted(source_cols),
                'target_table': target_table,
                'target_columns': sorted(target_cols),
                'ondelete': (item.ondelete or 'NO ACTION').upper(),
                'onupdate': (item.onupdate or 'NO ACTION').upper()
            })
        elif isinstance(item, sa.CheckConstraint):
            checks.append({
                'name': item.name,
                'sqltext': str(item.sqltext).strip()
            })

    # indexes
    t_indexes = canonical_indexes.get(tname, [])
    idx_list = []
    for idx in t_indexes:
        idx_list.append({
            'name': idx['name'],
            'columns': sorted(idx['columns']),
            'unique': idx['unique']
        })

    canonical_defs[tname] = {
        'columns': cols,
        'primary_key': sorted(list(set(pks))),
        'unique_constraints': uniques,
        'foreign_keys': fks,
        'check_constraints': checks,
        'indexes': idx_list,
        'migration': tdata['migration']
    }

# ----------------------------------------------------------------------
# 2. READ PRODUCTION METADATA VIA READ-ONLY CATALOG QUERIES
# ----------------------------------------------------------------------
def get_production_metadata(db_name):
    conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{db_name}")
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    # 1. Existing base tables in public schema
    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    """)
    existing_tables = set(r['table_name'] for r in cur.fetchall())

    meta = {}
    for tname in canonical_defs.keys():
        if tname not in existing_tables:
            meta[tname] = None
            continue

        # Row count
        cur.execute(f"SELECT COUNT(*) FROM public.\"{tname}\";")
        row_count = cur.fetchone()[0]

        # Columns
        cur.execute("""
            SELECT 
                column_name,
                data_type,
                character_maximum_length,
                numeric_precision,
                numeric_scale,
                is_nullable,
                column_default,
                udt_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position;
        """, (tname,))
        cols = {}
        for r in cur.fetchall():
            dt = r['data_type'].upper()
            udt = r['udt_name'].upper()
            cml = r['character_maximum_length']
            np = r['numeric_precision']
            ns = r['numeric_scale']
            
            # Format normalized type string
            if dt == 'CHARACTER VARYING':
                norm_type = f"VARCHAR({cml})" if cml else "VARCHAR"
            elif dt == 'TEXT':
                norm_type = "TEXT"
            elif dt in ('INTEGER', 'INT', 'INT4'):
                norm_type = "INTEGER"
            elif dt in ('BIGINT', 'INT8'):
                norm_type = "BIGINT"
            elif dt in ('SMALLINT', 'INT2'):
                norm_type = "SMALLINT"
            elif dt == 'BOOLEAN':
                norm_type = "BOOLEAN"
            elif dt == 'NUMERIC':
                norm_type = f"NUMERIC({np},{ns})"
            elif dt == 'TIMESTAMP WITH TIME ZONE':
                norm_type = "TIMESTAMP WITH TIME ZONE"
            elif dt == 'TIMESTAMP WITHOUT TIME ZONE':
                norm_type = "TIMESTAMP WITHOUT TIME ZONE"
            elif dt == 'DATE':
                norm_type = "DATE"
            elif dt == 'USER-DEFINED' and udt == 'JSONB':
                norm_type = "JSONB"
            elif dt == 'ARRAY':
                if udt.startswith('_VARCHAR'):
                    norm_type = "VARCHAR[]"
                elif udt.startswith('_TEXT'):
                    norm_type = "TEXT[]"
                else:
                    norm_type = f"{udt[1:]}[]"
            else:
                norm_type = dt

            default_val = r['column_default']
            if default_val:
                # clean postgres type casts in defaults e.g. 'NEW'::character varying or now()
                default_val = re.sub(r"::[\w\s]+(\[\])?", "", default_val).replace("'", "").strip()
                if "now()" in default_val.lower() or "current_timestamp" in default_val.lower():
                    default_val = "now()"

            cols[r['column_name']] = {
                'name': r['column_name'],
                'type': norm_type,
                'nullable': (r['is_nullable'] == 'YES'),
                'default': default_val
            }

        # Primary Key
        cur.execute("""
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema = 'public' 
              AND tc.table_name = %s 
              AND tc.constraint_type = 'PRIMARY KEY';
        """, (tname,))
        pks = sorted([r['column_name'] for r in cur.fetchall()])

        # Unique Constraints
        cur.execute("""
            SELECT tc.constraint_name, kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema = 'public' 
              AND tc.table_name = %s 
              AND tc.constraint_type = 'UNIQUE';
        """, (tname,))
        uq_map = {}
        for r in cur.fetchall():
            cname = r['constraint_name']
            if cname not in uq_map:
                uq_map[cname] = []
            uq_map[cname].append(r['column_name'])
        uniques = [{'name': k, 'columns': sorted(v)} for k, v in uq_map.items()]

        # Foreign Keys
        cur.execute("""
            SELECT
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                rc.delete_rule,
                rc.update_rule
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            JOIN information_schema.referential_constraints AS rc
              ON rc.constraint_name = tc.constraint_name
              AND rc.constraint_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = 'public'
              AND tc.table_name = %s;
        """, (tname,))
        fk_map = {}
        for r in cur.fetchall():
            cname = r['constraint_name']
            if cname not in fk_map:
                fk_map[cname] = {
                    'source_columns': [],
                    'target_table': r['foreign_table_name'],
                    'target_columns': [],
                    'ondelete': r['delete_rule'].upper(),
                    'onupdate': r['update_rule'].upper()
                }
            fk_map[cname]['source_columns'].append(r['column_name'])
            fk_map[cname]['target_columns'].append(r['foreign_column_name'])
        
        fks = []
        for k, v in fk_map.items():
            fks.append({
                'source_columns': sorted(v['source_columns']),
                'target_table': v['target_table'],
                'target_columns': sorted(v['target_columns']),
                'ondelete': v['ondelete'],
                'onupdate': v['onupdate']
            })

        # Check Constraints
        cur.execute("""
            SELECT conname, pg_get_constraintdef(c.oid) AS def
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON t.relnamespace = n.oid
            WHERE n.nspname = 'public'
              AND t.relname = %s
              AND c.contype = 'c';
        """, (tname,))
        checks = []
        for r in cur.fetchall():
            checks.append({
                'name': r['conname'],
                'definition': r['def']
            })

        # Indexes (excluding PK and unique constraints backed by index)
        cur.execute("""
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = %s;
        """, (tname,))
        indexes = []
        for r in cur.fetchall():
            indexes.append({
                'name': r['indexname'],
                'def': r['indexdef']
            })

        meta[tname] = {
            'row_count': row_count,
            'columns': cols,
            'primary_key': pks,
            'unique_constraints': uniques,
            'foreign_keys': fks,
            'check_constraints': checks,
            'indexes': indexes
        }

    conn.close()
    return meta

print("Reading metadata from smritisys...")
smritisys_meta = get_production_metadata("smritisys")

print("Reading metadata from smriti001...")
smriti001_meta = get_production_metadata("smriti001")

# ----------------------------------------------------------------------
# 3. COMPARE METADATA & CLASSIFY
# ----------------------------------------------------------------------
def compare_table(canon, prod):
    if prod is None:
        return {
            'exists': False,
            'schema_class': 'MISSING',
            'col_diffs': [],
            'pk_diff': 'N/A',
            'unique_diff': 'N/A',
            'fk_diff': 'N/A',
            'check_diff': 'N/A',
            'index_diff': 'N/A',
            'action': 'SAFE_CREATE',
            'risk': 'LOW'
        }

    col_diffs = []
    canon_cols = canon['columns']
    prod_cols = prod['columns']

    # Column checks
    for cname, c_info in canon_cols.items():
        if cname not in prod_cols:
            col_diffs.append(f"Missing column: {cname} ({c_info['type']})")
        else:
            p_info = prod_cols[cname]
            # Type compare
            c_type = c_info['type']
            p_type = p_info['type']
            # Normalize VARCHAR vs TEXT or VARCHAR length differences
            if c_type != p_type:
                # check if compatible
                col_diffs.append(f"Type diff {cname}: canon {c_type} vs prod {p_type}")
            
            # Nullable compare
            if c_info['nullable'] != p_info['nullable']:
                col_diffs.append(f"Nullable diff {cname}: canon {c_info['nullable']} vs prod {p_info['nullable']}")

    for cname in prod_cols:
        if cname not in canon_cols:
            col_diffs.append(f"Extra column in prod: {cname} ({prod_cols[cname]['type']})")

    # Primary Key compare
    canon_pk = canon['primary_key']
    prod_pk = prod['primary_key']
    pk_diff = "MATCH" if canon_pk == prod_pk else f"Canon {canon_pk} != Prod {prod_pk}"

    # Unique Constraints compare
    canon_uqs = sorted([u['columns'] for u in canon['unique_constraints']])
    prod_uqs = sorted([u['columns'] for u in prod['unique_constraints']])
    unique_diff = "MATCH" if canon_uqs == prod_uqs else f"Canon {len(canon_uqs)} != Prod {len(prod_uqs)}"

    # Foreign Keys compare
    canon_fks = sorted([(f['source_columns'], f['target_table']) for f in canon['foreign_keys']])
    prod_fks = sorted([(f['source_columns'], f['target_table']) for f in prod['foreign_keys']])
    fk_diff = "MATCH" if canon_fks == prod_fks else f"Canon {len(canon_fks)} != Prod {len(prod_fks)}"

    # Check constraints
    check_diff = "MATCH" if len(canon['check_constraints']) == len(prod['check_constraints']) else f"Canon {len(canon['check_constraints'])} != Prod {len(prod['check_constraints'])}"

    # Index count
    canon_idx_cnt = len(canon['indexes'])
    prod_idx_cnt = len(prod['indexes'])
    index_diff = "MATCH" if canon_idx_cnt == prod_idx_cnt else f"Canon {canon_idx_cnt} vs Prod {prod_idx_cnt}"

    # Classification
    # IDENTICAL: exactly all matches
    # COMPATIBLE: minor non-breaking e.g. extra index or harmless default
    # DRIFTED: column nullable/default difference or non-destructive extra col
    # CRITICAL_DRIFT: missing column, incompatible data type, broken PK/FK
    
    is_identical = (len(col_diffs) == 0 and pk_diff == "MATCH" and unique_diff == "MATCH" and fk_diff == "MATCH")
    
    has_missing_col = any("Missing column" in d for d in col_diffs)
    has_incompatible_type = any("Type diff" in d for d in col_diffs)
    has_pk_break = (pk_diff != "MATCH")
    
    if is_identical:
        schema_class = "IDENTICAL"
        action = "NO_ACTION"
        risk = "LOW"
    elif has_missing_col or has_incompatible_type or has_pk_break:
        schema_class = "CRITICAL_DRIFT"
        action = "SCHEMA_REMEDIATION"
        risk = "HIGH" if prod['row_count'] > 0 else "MEDIUM"
    elif len(col_diffs) > 0 or fk_diff != "MATCH" or unique_diff != "MATCH":
        schema_class = "DRIFTED"
        action = "SYNC_METADATA"
        risk = "LOW"
    else:
        schema_class = "COMPATIBLE"
        action = "NO_ACTION"
        risk = "LOW"

    return {
        'exists': True,
        'row_count': prod['row_count'],
        'schema_class': schema_class,
        'col_diffs': col_diffs,
        'pk_diff': pk_diff,
        'unique_diff': unique_diff,
        'fk_diff': fk_diff,
        'check_diff': check_diff,
        'index_diff': index_diff,
        'action': action,
        'risk': risk
    }

matrix_80 = []

for db_name, db_meta in [("smritisys", smritisys_meta), ("smriti001", smriti001_meta)]:
    for tname in sorted(canonical_defs.keys()):
        canon = canonical_defs[tname]
        prod = db_meta[tname]
        res = compare_table(canon, prod)
        
        matrix_80.append({
            'DATABASE': db_name,
            'TABLE': tname,
            'EXISTS': "YES" if res['exists'] else "NO",
            'ROW_COUNT': res.get('row_count', 0),
            'MIGRATION': canon['migration'],
            'SCHEMA_CLASS': res['schema_class'],
            'COLUMN_DIFF_COUNT': len(res['col_diffs']),
            'PK_DIFF': res['pk_diff'],
            'UNIQUE_DIFF': res['unique_diff'],
            'FK_DIFF': res['fk_diff'],
            'CHECK_DIFF': res['check_diff'],
            'INDEX_DIFF': res['index_diff'],
            'ACTION': res['action'],
            'RISK': res['risk'],
            'DETAILS': res['col_diffs']
        })

print(f"\nMatrix Total Rows: {len(matrix_80)}")

# Summary counts
sys_counts = {'IDENTICAL': 0, 'COMPATIBLE': 0, 'DRIFTED': 0, 'CRITICAL_DRIFT': 0, 'MISSING': 0}
s001_counts = {'IDENTICAL': 0, 'COMPATIBLE': 0, 'DRIFTED': 0, 'CRITICAL_DRIFT': 0, 'MISSING': 0}

for r in matrix_80:
    if r['DATABASE'] == 'smritisys':
        sys_counts[r['SCHEMA_CLASS']] += 1
    else:
        s001_counts[r['SCHEMA_CLASS']] += 1

print("\n--- smritisys Classification ---")
for k, v in sys_counts.items():
    print(f" {k}: {v}")
print(f" TOTAL: {sum(sys_counts.values())}")

print("\n--- smriti001 Classification ---")
for k, v in s001_counts.items():
    print(f" {k}: {v}")
print(f" TOTAL: {sum(s001_counts.values())}")

# Save JSON results for report rendering
with open("backend/canonical_80_matrix_results.json", "w", encoding="utf-8") as f:
    json.dump(matrix_80, f, indent=2)
print("Results saved to backend/canonical_80_matrix_results.json")
