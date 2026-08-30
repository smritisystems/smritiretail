"""
SMRITI LIVE PRODUCTION SCHEMA MATRIX (READ-ONLY)

This script reads the canonical schema definitions from the v1385-v1388 Alembic files,
reads live metadata from smritisys and smriti001 via psycopg2, and produces the required
80-row matrix without executing any migration or production change.
"""

import csv
import importlib.util
import json
import re
from pathlib import Path

import psycopg2
import psycopg2.extras
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import alembic.op as a_op

ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "reports"
REPORT_DIR.mkdir(exist_ok=True)

CANONICAL_TABLES = {}
CANONICAL_INDEXES = {}
CANONICAL_MIGRATION = {}
CURRENT_MIGRATION = None


def mock_f(name):
    return name


def mock_create_table(name, *columns, **kwargs):
    CANONICAL_TABLES[name] = {
        "columns": list(columns),
        "kwargs": kwargs,
        "migration": CURRENT_MIGRATION,
    }
    CANONICAL_MIGRATION[name] = CURRENT_MIGRATION


def mock_create_index(name, table_name, columns, unique=False, schema="public", **kwargs):
    CANONICAL_INDEXES.setdefault(table_name, []).append(
        {"name": name, "columns": list(columns), "unique": unique, "kwargs": kwargs}
    )


a_op.f = mock_f
a_op.create_table = mock_create_table
a_op.create_index = mock_create_index

MIGRATION_FILES = [
    ("v1385_crm", ROOT / "backend" / "alembic" / "versions" / "v1385_crm_and_approvals.py"),
    ("v1386_dist", ROOT / "backend" / "alembic" / "versions" / "v1386_distribution_warehousing.py"),
    ("v1387_ecom", ROOT / "backend" / "alembic" / "versions" / "v1387_ecommerce_psv_party.py"),
    ("v1388_plat", ROOT / "backend" / "alembic" / "versions" / "v1388_platform_analytics.py"),
]

for tag, path in MIGRATION_FILES:
    CURRENT_MIGRATION = tag
    spec = importlib.util.spec_from_file_location(tag, str(path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.upgrade()


def normalize_type_str(sa_type):
    t_str = str(sa_type).upper()
    if isinstance(sa_type, sa.String):
        return f"VARCHAR({sa_type.length})" if sa_type.length is not None else "VARCHAR"
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
        return "TIMESTAMP WITH TIME ZONE" if getattr(sa_type, "timezone", False) else "TIMESTAMP WITHOUT TIME ZONE"
    if isinstance(sa_type, sa.Date):
        return "DATE"
    if isinstance(sa_type, postgresql.JSONB):
        return "JSONB"
    if isinstance(sa_type, postgresql.ARRAY):
        item_type = normalize_type_str(sa_type.item_type)
        return f"{item_type}[]"
    return t_str


CANONICAL_DEFS = {}
for tname, tdata in CANONICAL_TABLES.items():
    cols = {}
    pks = []
    uniques = []
    fks = []
    checks = []
    for item in tdata["columns"]:
        if isinstance(item, sa.Column):
            default_val = None
            if item.server_default is not None:
                if hasattr(item.server_default, "arg"):
                    default_val = str(item.server_default.arg).strip()
                    if isinstance(item.server_default.arg, sa.TextClause):
                        default_val = str(item.server_default.arg.text).strip()
                else:
                    default_val = str(item.server_default).strip()
            if default_val:
                default_val = default_val.replace("'", "").strip()
            cols[item.name] = {
                "name": item.name,
                "type": normalize_type_str(item.type),
                "nullable": item.nullable if item.nullable is not None else True,
                "default": default_val,
                "primary_key": bool(item.primary_key),
            }
            if item.primary_key:
                pks.append(item.name)
        elif isinstance(item, sa.PrimaryKeyConstraint):
            for c in item.columns:
                pks.append(c.name if hasattr(c, "name") else str(c))
        elif isinstance(item, sa.UniqueConstraint):
            cols_list = [c.name if hasattr(c, "name") else str(c) for c in item.columns]
            uniques.append({"name": item.name, "columns": sorted(cols_list)})
        elif isinstance(item, sa.ForeignKeyConstraint):
            source_cols = [c.name if hasattr(c, "name") else str(c) for c in item.columns]
            target_table = ""
            target_cols = []
            for elem in item.elements:
                tf = getattr(elem, "target_fullname", str(elem))
                parts = tf.split(".")
                if len(parts) >= 2:
                    target_table = parts[-2]
                    target_cols.append(parts[-1])
                else:
                    target_cols.append(tf)
            fks.append({
                "source_columns": sorted(source_cols),
                "target_table": target_table,
                "target_columns": sorted(target_cols),
                "ondelete": (item.ondelete or "NO ACTION").upper(),
                "onupdate": (item.onupdate or "NO ACTION").upper(),
            })
        elif isinstance(item, sa.CheckConstraint):
            checks.append({"name": item.name, "sqltext": str(item.sqltext).strip()})

    idx_list = []
    for idx in CANONICAL_INDEXES.get(tname, []):
        idx_list.append({"name": idx["name"], "columns": sorted(idx["columns"]), "unique": idx["unique"]})

    CANONICAL_DEFS[tname] = {
        "columns": cols,
        "primary_key": sorted(list(set(pks))),
        "unique_constraints": uniques,
        "foreign_keys": fks,
        "check_constraints": checks,
        "indexes": idx_list,
        "migration": tdata["migration"],
    }


def clean_default(value):
    if not value:
        return None
    cleaned = re.sub(r"::[A-Za-z0-9_\s\[\]]+", "", value)
    cleaned = cleaned.replace("'", "").strip()
    if cleaned.lower() in {"now()", "current_timestamp"}:
        return "now()"
    return cleaned


def get_production_metadata(db_name):
    conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{db_name}")
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")
    existing_tables = {r["table_name"] for r in cur.fetchall()}

    metadata = {}
    for tname in sorted(CANONICAL_DEFS.keys()):
        if tname not in existing_tables:
            metadata[tname] = None
            continue

        cur.execute(f'SELECT COUNT(*) FROM public."{tname}";')
        row_count = cur.fetchone()[0]

        cur.execute(
            """
            SELECT column_name, data_type, character_maximum_length, numeric_precision, numeric_scale,
                   is_nullable, column_default, udt_name
            FROM information_schema.columns
            WHERE table_schema='public' AND table_name=%s
            ORDER BY ordinal_position;
            """,
            (tname,),
        )
        cols = {}
        for row in cur.fetchall():
            dt = row["data_type"].upper() if row["data_type"] else ""
            udt = (row["udt_name"] or "").upper()
            cml = row["character_maximum_length"]
            np = row["numeric_precision"]
            ns = row["numeric_scale"]

            if dt == "CHARACTER VARYING":
                norm = f"VARCHAR({cml})" if cml else "VARCHAR"
            elif dt == "TEXT":
                norm = "TEXT"
            elif dt in {"INTEGER", "INT", "INT4"}:
                norm = "INTEGER"
            elif dt in {"BIGINT", "INT8"}:
                norm = "BIGINT"
            elif dt in {"SMALLINT", "INT2"}:
                norm = "SMALLINT"
            elif dt == "BOOLEAN":
                norm = "BOOLEAN"
            elif dt == "NUMERIC":
                norm = f"NUMERIC({np},{ns})"
            elif dt == "TIMESTAMP WITH TIME ZONE":
                norm = "TIMESTAMP WITH TIME ZONE"
            elif dt == "TIMESTAMP WITHOUT TIME ZONE":
                norm = "TIMESTAMP WITHOUT TIME ZONE"
            elif dt == "DATE":
                norm = "DATE"
            elif dt == "USER-DEFINED" and udt == "JSONB":
                norm = "JSONB"
            elif dt == "ARRAY":
                if udt.startswith("_VARCHAR"):
                    norm = "VARCHAR[]"
                elif udt.startswith("_TEXT"):
                    norm = "TEXT[]"
                else:
                    norm = f"{udt[1:]}[]"
            else:
                norm = dt

            cols[row["column_name"]] = {
                "name": row["column_name"],
                "type": norm,
                "nullable": row["is_nullable"] == "YES",
                "default": clean_default(row["column_default"]),
            }

        cur.execute(
            """
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema='public' AND tc.table_name=%s AND tc.constraint_type='PRIMARY KEY';
            """,
            (tname,),
        )
        pks = sorted([r[0] for r in cur.fetchall()])

        cur.execute(
            """
            SELECT tc.constraint_name, kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema='public' AND tc.table_name=%s AND tc.constraint_type='UNIQUE';
            """,
            (tname,),
        )
        uq_map = {}
        for cname, col in cur.fetchall():
            uq_map.setdefault(cname, []).append(col)
        uniques = [{"name": k, "columns": sorted(v)} for k, v in uq_map.items()]

        cur.execute(
            """
            SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name,
                   ccu.column_name AS foreign_column_name, rc.delete_rule, rc.update_rule
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
            JOIN information_schema.referential_constraints rc
              ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
            WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public' AND tc.table_name=%s;
            """,
            (tname,),
        )
        fk_map = {}
        for constraint_name, col, ftable, fcol, delete_rule, update_rule in cur.fetchall():
            fk_map.setdefault(constraint_name, {
                "source_columns": [],
                "target_table": ftable,
                "target_columns": [],
                "ondelete": delete_rule.upper(),
                "onupdate": update_rule.upper(),
            })
            fk_map[constraint_name]["source_columns"].append(col)
            fk_map[constraint_name]["target_columns"].append(fcol)
        fks = [{
            "source_columns": sorted(v["source_columns"]),
            "target_table": v["target_table"],
            "target_columns": sorted(v["target_columns"]),
            "ondelete": v["ondelete"],
            "onupdate": v["onupdate"],
        } for v in fk_map.values()]

        cur.execute(
            """
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON t.relnamespace = n.oid
            WHERE n.nspname='public' AND t.relname=%s AND c.contype='c';
            """,
            (tname,),
        )
        checks = [{"name": name, "definition": definition} for name, definition in cur.fetchall()]

        cur.execute("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=%s;", (tname,))
        indexes = [{"name": idxname, "def": idxdef} for idxname, idxdef in cur.fetchall()]

        metadata[tname] = {
            "row_count": row_count,
            "columns": cols,
            "primary_key": pks,
            "unique_constraints": uniques,
            "foreign_keys": fks,
            "check_constraints": checks,
            "indexes": indexes,
        }

    cur.close()
    conn.close()
    return metadata


def compare_table(canonical, production):
    if production is None:
        return {
            "exists": False,
            "row_count": 0,
            "schema_class": "MISSING",
            "column_diff_count": 0,
            "pk_diff": "N/A",
            "unique_diff": "N/A",
            "fk_diff": "N/A",
            "check_diff": "N/A",
            "index_diff": "N/A",
            "exact_differences": "TABLE MISSING",
            "data_risk": "HIGH",
            "recommended_action": "CREATE_REQUIRED",
        }

    diffs = []
    canonical_cols = canonical["columns"]
    prod_cols = production["columns"]

    for name, canon_info in canonical_cols.items():
        if name not in prod_cols:
            diffs.append(f"MISSING_COLUMN:{name}:{canon_info['type']}")
            continue
        prod_info = prod_cols[name]
        if canon_info["type"] != prod_info["type"]:
            diffs.append(f"TYPE_DIFF:{name}:{canon_info['type']}->{prod_info['type']}")
        if canon_info["nullable"] != prod_info["nullable"]:
            diffs.append(f"NULLABILITY_DIFF:{name}:{canon_info['nullable']}->{prod_info['nullable']}")
        if canon_info["default"] != prod_info["default"]:
            diffs.append(f"DEFAULT_DIFF:{name}:{canon_info['default']}->{prod_info['default']}")

    for name in prod_cols:
        if name not in canonical_cols:
            diffs.append(f"EXTRA_COLUMN:{name}:{prod_cols[name]['type']}")

    pk_diff = "MATCH" if canonical["primary_key"] == production["primary_key"] else f"CANON:{canonical['primary_key']}|PROD:{production['primary_key']}"
    unique_diff = "MATCH" if sorted([tuple(sorted(x["columns"])) for x in canonical["unique_constraints"]]) == sorted([tuple(sorted(x["columns"])) for x in production["unique_constraints"]]) else f"CANON:{len(canonical['unique_constraints'])}|PROD:{len(production['unique_constraints'])}"
    fk_diff = "MATCH" if sorted([(tuple(sorted(f["source_columns"])), f["target_table"]) for f in canonical["foreign_keys"]]) == sorted([(tuple(sorted(f["source_columns"])), f["target_table"]) for f in production["foreign_keys"]]) else f"CANON:{len(canonical['foreign_keys'])}|PROD:{len(production['foreign_keys'])}"
    check_diff = "MATCH" if len(canonical["check_constraints"]) == len(production["check_constraints"]) else f"CANON:{len(canonical['check_constraints'])}|PROD:{len(production['check_constraints'])}"
    index_diff = "MATCH" if len(canonical["indexes"]) == len(production["indexes"]) else f"CANON:{len(canonical['indexes'])}|PROD:{len(production['indexes'])}"

    exists = True
    if not diffs and pk_diff == "MATCH" and unique_diff == "MATCH" and fk_diff == "MATCH" and check_diff == "MATCH" and index_diff == "MATCH":
        schema_class = "IDENTICAL"
        action = "NO_ACTION"
        data_risk = "LOW"
    else:
        has_missing = any(d.startswith("MISSING_COLUMN:") for d in diffs)
        has_type_diff = any(d.startswith("TYPE_DIFF:") for d in diffs)
        has_pk_break = pk_diff != "MATCH"
        if has_missing or has_type_diff or has_pk_break:
            schema_class = "CRITICAL_DRIFT"
            action = "HUMAN_REVIEW"
            data_risk = "HIGH" if production["row_count"] > 0 else "MEDIUM"
        elif diffs or unique_diff != "MATCH" or fk_diff != "MATCH" or check_diff != "MATCH" or index_diff != "MATCH":
            schema_class = "DRIFTED"
            action = "RECONCILE"
            data_risk = "MEDIUM" if production["row_count"] > 0 else "LOW"
        else:
            schema_class = "COMPATIBLE"
            action = "NO_ACTION"
            data_risk = "LOW"

    return {
        "exists": exists,
        "row_count": production["row_count"],
        "schema_class": schema_class,
        "column_diff_count": len(diffs),
        "pk_diff": pk_diff,
        "unique_diff": unique_diff,
        "fk_diff": fk_diff,
        "check_diff": check_diff,
        "index_diff": index_diff,
        "exact_differences": "; ".join(diffs) if diffs else "NONE",
        "data_risk": data_risk,
        "recommended_action": action,
    }


def build_matrix():
    matrix = []
    dbs = [("smritisys", get_production_metadata("smritisys")), ("smriti001", get_production_metadata("smriti001"))]

    for db_name, db_meta in dbs:
        for table_name in sorted(CANONICAL_DEFS.keys()):
            canonical = CANONICAL_DEFS[table_name]
            production = db_meta.get(table_name)
            result = compare_table(canonical, production)
            matrix.append({
                "database": db_name,
                "table": table_name,
                "exists": "YES" if result["exists"] else "NO",
                "row_count": result["row_count"],
                "canonical_migration": canonical["migration"],
                "schema_class": result["schema_class"],
                "column_diff_count": result["column_diff_count"],
                "pk_diff": result["pk_diff"],
                "unique_diff": result["unique_diff"],
                "fk_diff": result["fk_diff"],
                "check_diff": result["check_diff"],
                "index_diff": result["index_diff"],
                "exact_differences": result["exact_differences"],
                "data_risk": result["data_risk"],
                "recommended_action": result["recommended_action"],
            })
    return matrix


matrix = build_matrix()
assert len(matrix) == 80, f"Unexpected row count: {len(matrix)}"

seen = set()
for row in matrix:
    key = (row["database"], row["table"])
    assert key not in seen, f"Duplicate key: {key}"
    seen.add(key)

summary = {"smritisys": {}, "smriti001": {}}
for row in matrix:
    db = row["database"]
    summary.setdefault(db, {})
    summary[db][row["schema_class"]] = summary[db].get(row["schema_class"], 0) + 1

assert sum(summary["smritisys"].values()) == 40
assert sum(summary["smriti001"].values()) == 40
assert summary["smritisys"].get("MISSING", 0) == 11
assert summary["smriti001"].get("MISSING", 0) == 6

csv_path = REPORT_DIR / "live_production_schema_matrix_80.csv"
with csv_path.open("w", newline="", encoding="utf-8") as fh:
    fieldnames = [
        "database",
        "table",
        "exists",
        "row_count",
        "canonical_migration",
        "schema_class",
        "column_diff_count",
        "pk_diff",
        "unique_diff",
        "fk_diff",
        "check_diff",
        "index_diff",
        "exact_differences",
        "data_risk",
        "recommended_action",
    ]
    writer = csv.DictWriter(fh, fieldnames=fieldnames)
    writer.writeheader()
    for row in matrix:
        writer.writerow(row)

md_lines = [
    "# Live production schema matrix (80 rows)",
    "",
    "## Summary",
    "",
    f"- smritisys: {summary['smritisys']}",
    f"- smriti001: {summary['smriti001']}",
    "",
    "| database | table | exists | row_count | canonical_migration | schema_class | column_diff_count | pk_diff | unique_diff | fk_diff | check_diff | index_diff | exact_differences | data_risk | recommended_action |",
    "|---|---|---|---:|---|---|---:|---|---|---|---|---|---|---|---|",
]
for row in matrix:
    md_lines.append(
        "| {database} | {table} | {exists} | {row_count} | {canonical_migration} | {schema_class} | {column_diff_count} | {pk_diff} | {unique_diff} | {fk_diff} | {check_diff} | {index_diff} | {exact_differences} | {data_risk} | {recommended_action} |".format(**row)
    )

md_path = REPORT_DIR / "live_production_schema_matrix_80.md"
md_path.write_text("\n".join(md_lines) + "\n", encoding="utf-8")

print(json.dumps({
    "matrix_rows": len(matrix),
    "smritisys": summary["smritisys"],
    "smriti001": summary["smriti001"],
    "csv": str(csv_path),
    "md": str(md_path),
}, indent=2))
