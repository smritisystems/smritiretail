"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.46.0
Created      : 2026-09-23
Modified     : 2026-09-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Architecture Governance Guard — Migration Change-Time CFOC Enforcement
"""

import sys
import ast
import re
from pathlib import Path
from typing import Dict, List, Set, Tuple

# Add repo root and backend to sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.governance.field_registry import CANONICAL_FIELDS
from app.governance.column_classification import CFOC_DB_COLUMN_CLASSIFICATION, get_column_classification


class MigrationParseError(RuntimeError):
    """Raised when an Alembic migration script fails AST parsing."""
    pass


def extract_columns_from_migration(filepath: Path) -> List[Tuple[str, str, int]]:
    """
    AST-parses an Alembic migration script and extracts (table_name, column_name, line_no)
    from op.add_column() and op.create_table() calls.
    Normalizes UTF-8 with BOM (encoding='utf-8-sig') and fails closed on syntax/decode errors.
    """
    results: List[Tuple[str, str, int]] = []
    try:
        content = filepath.read_text(encoding="utf-8-sig")
        tree = ast.parse(content, filename=str(filepath))
    except Exception as e:
        raise MigrationParseError(f"Failed to parse migration {filepath.name}: {e}") from e

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue

        # Check for op.add_column('table', sa.Column('col', ...))
        if isinstance(node.func, ast.Attribute) and node.func.attr == "add_column":
            if len(node.args) >= 2 and isinstance(node.args[0], ast.Constant):
                table_name = str(node.args[0].value)
                col_arg = node.args[1]
                if isinstance(col_arg, ast.Call) and len(col_arg.args) >= 1 and isinstance(col_arg.args[0], ast.Constant):
                    col_name = str(col_arg.args[0].value)
                    results.append((table_name, col_name, node.lineno))

        # Check for op.create_table('table', sa.Column('col', ...), ...)
        elif isinstance(node.func, ast.Attribute) and node.func.attr == "create_table":
            if len(node.args) >= 2 and isinstance(node.args[0], ast.Constant):
                table_name = str(node.args[0].value)
                for arg in node.args[1:]:
                    if isinstance(arg, ast.Call) and isinstance(arg.func, (ast.Attribute, ast.Name)):
                        func_name = arg.func.attr if isinstance(arg.func, ast.Attribute) else arg.func.id
                        if func_name == "Column" and len(arg.args) >= 1 and isinstance(arg.args[0], ast.Constant):
                            col_name = str(arg.args[0].value)
                            results.append((table_name, col_name, arg.lineno))

    return results


def run_migration_cfoc_guard() -> int:
    print("==============================================================")
    print(" SMRITI RETAIL OS -- MIGRATION-TIME CFOC GOVERNANCE GUARD")
    print("==============================================================")
    print("Policy: Every database column introduced via Alembic migrations")
    print("must carry canonical field registration or formal classification.")
    print("Fail-Closed Policy: Any unparseable migration script triggers exit 1.")
    print("--------------------------------------------------------------")

    versions_dir = BACKEND_DIR / "alembic" / "versions"
    if not versions_dir.exists():
        print(f"Error: Migration directory '{versions_dir}' not found.")
        return 1

    migration_files = sorted(list(versions_dir.glob("*.py")))
    print(f"Inspecting {len(migration_files)} Alembic migration scripts...")

    governed_tables = {f.db_table for f in CANONICAL_FIELDS.values()}
    unclassified_violations: List[Dict[str, str]] = []
    parse_errors: List[Tuple[str, str]] = []
    scanned_columns_count = 0

    for mfile in migration_files:
        try:
            cols = extract_columns_from_migration(mfile)
        except MigrationParseError as e:
            parse_errors.append((mfile.name, str(e)))
            continue

        for table, col, lineno in cols:
            scanned_columns_count += 1
            if table not in governed_tables:
                continue

            # Check if column is classified
            classification = get_column_classification(table, col)
            if not classification:
                unclassified_violations.append({
                    "file": mfile.name,
                    "line": str(lineno),
                    "table": table,
                    "column": col,
                })

    if parse_errors:
        print("\n[FAIL-CLOSED] MIGRATION AST PARSING FAILURES DETECTED!")
        print(f"Encountered {len(parse_errors)} unparseable Alembic migration scripts:")
        for fname, err in parse_errors:
            print(f"  - {fname}: {err}")
        print("\n==============================================================")
        print(" REMEDIATION REQUIRED:")
        print(" 1. Fix Python syntax or encoding issues in the migration scripts.")
        print(" 2. All migration files must be valid Python AST to pass CFOC gate.")
        print("==============================================================")
        return 1

    print(f"Total columns extracted across migrations: {scanned_columns_count}")
    print(f"Columns checked on governed tables: {scanned_columns_count - len(unclassified_violations)}")

    if unclassified_violations:
        print("\n[FAIL] MIGRATION CFOC VIOLATIONS DETECTED!")
        print(f"Found {len(unclassified_violations)} unclassified columns in Alembic migration files:")
        for v in unclassified_violations[:20]:
            print(f"  - {v['file']}:{v['line']} -> Table '{v['table']}', Column '{v['column']}' is UNCLASSIFIED!")
        print("\n==============================================================")
        print(" REMEDIATION REQUIRED:")
        print(" 1. For business fields: Register in 'backend/app/governance/field_registry.py'")
        print(" 2. For technical/audit columns: Declare in 'backend/app/governance/column_classification.py'")
        print(" 3. Re-run 'python scripts/generate_ts_field_registry.py'")
        print("==============================================================")
        return 1

    print("\n [OK] Migration-Time CFOC Parity Verified: 0 Ungoverned Columns.")
    print(" All migration columns in governed tables are classified or registered.")
    print(" Fail-Closed Integrity Verified: 100% of migration scripts parsed cleanly.")
    print("==============================================================\n")
    return 0


if __name__ == "__main__":
    sys.exit(run_migration_cfoc_guard())
