"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Copyright    : © SMRITIBooks.com. All Rights Reserved.
Purpose      : Rigorous column-level & constraint-level AST/metadata comparison for eway_bills and ecom_* tables
"""
import sys, os, re, json, importlib.util
import psycopg2
import psycopg2.extras
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import alembic.op as a_op

sys.stdout.reconfigure(encoding='utf-8')

# ----------------------------------------------------------------------
# 1. EXTRACT CANONICAL SCHEMA FROM MIGRATIONS (v1386 & v1387)
# ----------------------------------------------------------------------
target_tables = [
    'eway_bills',
    'ecom_channels',
    'ecom_sku_mappings',
    'ecom_order_imports',
    'ecom_stock_sync_logs',
    'ecom_reconciliations'
]

canonical_tables = {}
canonical_indexes = {}
current_migration = ""

def mock_f(name): return name
def mock_create_table(name, *columns, **kwargs):
    if name in target_tables:
        canonical_tables[name] = {
            'columns': list(columns),
            'kwargs': kwargs,
            'migration': current_migration
        }
def mock_create_index(name, table_name, columns, unique=False, schema='public', **kwargs):
    if table_name in target_tables:
        if table_name not in canonical_indexes:
            canonical_indexes[table_name] = []
        canonical_indexes[table_name].append({
            'name': name,
            'columns': columns,
            'unique': unique
        })

a_op.f = mock_f
a_op.create_table = mock_create_table
a_op.create_index = mock_create_index

migrations = [
    ("v1386_dist", "backend/alembic/versions/v1386_distribution_warehousing.py"),
    ("v1387_ecom", "backend/alembic/versions/v1387_ecommerce_psv_party.py")
]

for tag, path in migrations:
    current_migration = tag
    spec = importlib.util.spec_from_file_location(tag, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.upgrade()

def normalize_sa_type(sa_type):
    t_str = str(sa_type).upper()
    if isinstance(sa_type, sa.String):
        return f"VARCHAR({sa_type.length})" if sa_type.length else "VARCHAR"
    if isinstance(sa_type, sa.Text): return "TEXT"
    if isinstance(sa_type, sa.Integer): return "INTEGER"
    if isinstance(sa_type, sa.BigInteger): return "BIGINT"
    if isinstance(sa_type, sa.SmallInteger): return "SMALLINT"
    if isinstance(sa_type, sa.Boolean): return "BOOLEAN"
    if isinstance(sa_type, sa.Numeric):
        p = sa_type.precision or 10
        s = sa_type.scale or 0
        return f"NUMERIC({p},{s})"
    if isinstance(sa_type, sa.DateTime):
        return "TIMESTAMP WITH TIME ZONE" if getattr(sa_type, 'timezone', False) else "TIMESTAMP WITHOUT TIME ZONE"
    if isinstance(sa_type, sa.Date): return "DATE"
    if isinstance(sa_type, postgresql.JSONB): return "JSONB"
    if isinstance(sa_type, postgresql.ARRAY):
        return f"{normalize_sa_type(sa_type.item_type)}[]"
    return t_str

canonical_defs = {}
for tname, tdata in canonical_tables.items():
    cols = {}
    pks = []
    uniques = []
    fks = []
    for item in tdata['columns']:
        if isinstance(item, sa.Column):
            def_val = None
            if item.server_default is not None:
                if hasattr(item.server_default, 'arg'):
                    def_val = str(item.server_default.arg).strip()
                    if isinstance(item.server_default.arg, sa.TextClause):
                        def_val = str(item.server_default.arg.text).strip()
                else:
                    def_val = str(item.server_default).strip()
            if def_val:
                def_val = def_val.replace("'", "").strip()
            cols[item.name] = {
                'type': normalize_sa_type(item.type),
                'nullable': item.nullable if item.nullable is not None else True,
                'default': def_val
            }
            if item.primary_key:
                pks.append(item.name)
        elif isinstance(item, sa.PrimaryKeyConstraint):
            for c in item.columns:
                pks.append(c.name if hasattr(c, 'name') else str(c))
        elif isinstance(item, sa.UniqueConstraint):
            uniques.append(sorted([c.name if hasattr(c, 'name') else str(c) for c in item.columns]))
        elif isinstance(item, sa.ForeignKeyConstraint):
            src = sorted([c.name if hasattr(c, 'name') else str(c) for c in item.columns])
            tgt_tbl = ""
            for elem in item.elements:
                tf = getattr(elem, 'target_fullname', str(elem))
                parts = tf.split('.')
                if len(parts) >= 2:
                    tgt_tbl = parts[-2]
            fks.append((src, tgt_tbl, (item.ondelete or 'NO ACTION').upper()))
    
    canonical_defs[tname] = {
        'columns': cols,
        'pk': sorted(list(set(pks))),
        'uniques': sorted(uniques),
        'fks': sorted(fks),
        'indexes': sorted([sorted(idx['columns']) for idx in canonical_indexes.get(tname, [])]),
        'migration': tdata['migration']
    }

print("Canonical Definitions Loaded for 6 tables:")
for t in target_tables:
    c = canonical_defs.get(t)
    if c:
        print(f"  • {t:<22} : {len(c['columns'])} cols, PK={c['pk']}, FKs={len(c['fks'])}, Uniques={len(c['uniques'])}, Migration={c['migration']}")
    else:
        print(f"  • {t:<22} : NOT FOUND IN MIGRATIONS")

# ----------------------------------------------------------------------
# 2. QUERY LIVE METADATA FROM BOTH DATABASES
# ----------------------------------------------------------------------
def inspect_database_tables(db_name):
    conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{db_name}")
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    # Alembic version
    cur.execute("SELECT version_num FROM alembic_version;")
    v_rows = cur.fetchall()
    alembic_v = [r[0] for r in v_rows]
    
    # Check if smriti_audit_log exists to find creation history
    cur.execute("""
        SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'smriti_audit_log');
    """)
    has_audit = cur.fetchone()[0]
    audit_events = []
    if has_audit:
        cur.execute("""
            SELECT changed_table, change_type, changed_by, changed_at, change_reason 
            FROM smriti_audit_log 
            WHERE changed_table IN %s
            ORDER BY changed_at DESC;
        """, (tuple(target_tables),))
        audit_events = cur.fetchall()

    results = {}
    for tname in target_tables:
        # Check pg_class
        cur.execute("""
            SELECT c.oid, c.relname, c.relfilenode, c.reltuples, c.relpages
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = %s;
        """, (tname,))
        pg_row = cur.fetchone()
        if not pg_row:
            results[tname] = {'exists': False}
            continue

        # Row count
        cur.execute(f'SELECT COUNT(*) FROM public."{tname}";')
        row_cnt = cur.fetchone()[0]

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
            
            if dt == 'CHARACTER VARYING': norm_type = f"VARCHAR({cml})" if cml else "VARCHAR"
            elif dt == 'TEXT': norm_type = "TEXT"
            elif dt in ('INTEGER', 'INT', 'INT4'): norm_type = "INTEGER"
            elif dt in ('BIGINT', 'INT8'): norm_type = "BIGINT"
            elif dt in ('SMALLINT', 'INT2'): norm_type = "SMALLINT"
            elif dt == 'BOOLEAN': norm_type = "BOOLEAN"
            elif dt == 'NUMERIC': norm_type = f"NUMERIC({np},{ns})"
            elif dt == 'TIMESTAMP WITH TIME ZONE': norm_type = "TIMESTAMP WITH TIME ZONE"
            elif dt == 'TIMESTAMP WITHOUT TIME ZONE': norm_type = "TIMESTAMP WITHOUT TIME ZONE"
            elif dt == 'DATE': norm_type = "DATE"
            elif dt == 'USER-DEFINED' and udt == 'JSONB': norm_type = "JSONB"
            elif dt == 'ARRAY': norm_type = "VARCHAR[]" if udt.startswith('_VARCHAR') else f"{udt[1:]}[]"
            else: norm_type = dt

            def_val = r['column_default']
            if def_val:
                def_val = re.sub(r"::[\w\s]+(\[\])?", "", def_val).replace("'", "").strip()
                if "now()" in def_val.lower() or "current_timestamp" in def_val.lower():
                    def_val = "now()"

            cols[r['column_name']] = {
                'type': norm_type,
                'nullable': (r['is_nullable'] == 'YES'),
                'default': def_val
            }

        # PK
        cur.execute("""
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema = 'public' AND tc.table_name = %s AND tc.constraint_type = 'PRIMARY KEY';
        """, (tname,))
        pks = sorted([r['column_name'] for r in cur.fetchall()])

        # Unique
        cur.execute("""
            SELECT tc.constraint_name, kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema = 'public' AND tc.table_name = %s AND tc.constraint_type = 'UNIQUE';
        """, (tname,))
        uq_map = {}
        for r in cur.fetchall():
            uq_map.setdefault(r['constraint_name'], []).append(r['column_name'])
        uniques = sorted([sorted(v) for v in uq_map.values()])

        # FK
        cur.execute("""
            SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name, rc.delete_rule
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
            JOIN information_schema.referential_constraints AS rc
              ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' AND tc.table_name = %s;
        """, (tname,))
        fk_map = {}
        for r in cur.fetchall():
            cname = r['constraint_name']
            if cname not in fk_map:
                fk_map[cname] = {'src': [], 'target': r['foreign_table_name'], 'ondelete': r['delete_rule'].upper()}
            fk_map[cname]['src'].append(r['column_name'])
        fks = sorted([(sorted(v['src']), v['target'], v['ondelete']) for v in fk_map.values()])

        # Indexes
        cur.execute("""
            SELECT indexname, indexdef FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = %s;
        """, (tname,))
        idx_rows = cur.fetchall()

        results[tname] = {
            'exists': True,
            'oid': pg_row['oid'],
            'relfilenode': pg_row['relfilenode'],
            'row_count': row_cnt,
            'columns': cols,
            'pk': pks,
            'uniques': uniques,
            'fks': fks,
            'indexes': [r['indexname'] for r in idx_rows]
        }

    conn.close()
    return alembic_v, audit_events, results

# ----------------------------------------------------------------------
# 3. COMPARE AND REPORT
# ----------------------------------------------------------------------
for db_name in ['smritisys', 'smriti001']:
    alembic_v, audit_events, prod_data = inspect_database_tables(db_name)
    print(f"\n========================================================")
    print(f" DEEP COMPARISON FOR: {db_name}")
    print(f" Current alembic_version: {alembic_v}")
    print(f" Audit log events for target tables: {len(audit_events)}")
    print(f"========================================================")

    for tname in target_tables:
        canon = canonical_defs.get(tname)
        prod = prod_data.get(tname)
        
        print(f"\n--------------------------------------------------------")
        print(f" TABLE: {tname}")
        print(f"--------------------------------------------------------")
        
        if not prod.get('exists'):
            print(f"  ❌ Status: MISSING (Table does not exist in {db_name})")
            continue

        print(f"  ✓ Exists: YES (OID={prod['oid']}, relfilenode={prod['relfilenode']}, Rows={prod['row_count']})")
        
        # Check column-by-column
        c_cols = canon['columns']
        p_cols = prod['columns']
        
        col_diffs = []
        # Missing or drifted cols
        for cname, cinfo in c_cols.items():
            if cname not in p_cols:
                col_diffs.append(f"MISSING COLUMN in DB: {cname} ({cinfo['type']})")
            else:
                pinfo = p_cols[cname]
                if cinfo['type'] != pinfo['type']:
                    col_diffs.append(f"TYPE MISMATCH on {cname}: Canonical {cinfo['type']} != DB {pinfo['type']}")
                if cinfo['nullable'] != pinfo['nullable']:
                    col_diffs.append(f"NULLABILITY MISMATCH on {cname}: Canonical nullable={cinfo['nullable']} != DB nullable={pinfo['nullable']}")
        
        for pname, pinfo in p_cols.items():
            if pname not in c_cols:
                col_diffs.append(f"EXTRA COLUMN in DB: {pname} ({pinfo['type']})")

        # PK Diff
        pk_match = (canon['pk'] == prod['pk'])
        # Unique Diff
        uq_match = (canon['uniques'] == prod['uniques'])
        # FK Diff
        fk_match = (canon['fks'] == prod['fks'])

        print(f"  • Total Canonical Columns : {len(c_cols)}")
        print(f"  • Total DB Columns        : {len(p_cols)}")
        print(f"  • Column Differences Count: {len(col_diffs)}")
        if col_diffs:
            for cd in col_diffs:
                print(f"    - {cd}")
        else:
            print(f"    ✓ All {len(c_cols)} column names, data types, and nullabilities match EXACTLY!")

        print(f"  • Primary Key Match       : {'EXACT MATCH ' + str(prod['pk']) if pk_match else 'MISMATCH: Canonical ' + str(canon['pk']) + ' != DB ' + str(prod['pk'])}")
        print(f"  • Unique Constraints Match: {'EXACT MATCH' if uq_match else 'MISMATCH: Canonical ' + str(canon['uniques']) + ' != DB ' + str(prod['uniques'])}")
        print(f"  • Foreign Keys Match      : {'EXACT MATCH' if fk_match else 'MISMATCH: Canonical ' + str(canon['fks']) + ' != DB ' + str(prod['fks'])}")

        if not col_diffs and pk_match and uq_match and fk_match:
            print(f"  >>> VERDICT: [IDENTICAL] 100% Exact Schema Match with Migration {canon['migration']}")
        elif not col_diffs and pk_match:
            print(f"  >>> VERDICT: [COMPATIBLE] Columns & PK match exactly, minor constraint difference")
        else:
            print(f"  >>> VERDICT: [DRIFTED / CRITICAL_DRIFT] Real schema differences detected!")
