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
Classification: Developer Tooling — CFOC New Field Creation Wizard
"""

import sys
import argparse
from pathlib import Path

# Add repo root and backend to sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.governance.field_registry import CANONICAL_FIELDS, CanonicalFieldDef
from app.db.ownership import TABLE_OWNERSHIP, TableOwner


def print_promotion_order():
    print("""
==============================================================
 SMRITI RETAIL OS -- CFOC CANONICAL PROMOTION ORDER
==============================================================
Every business field MUST be promoted through this exact sequence:

  [Step 1] Database / Alembic Schema
           ↓ (Add column in Alembic migration version)
  [Step 2] Canonical Field Registry
           ↓ (Register authoritative metadata in field_registry.py)
  [Step 3] TypeScript SSOT Generation
           ↓ (Run: python scripts/generate_ts_field_registry.py)
  [Step 4] API / Pydantic Contract
           ↓ (Wire into backend/app/schemas/ and endpoints)
  [Step 5] UX Screen Configuration
           ↓ (Reference fieldId in src/components/global/configs/)
  [Step 6] CI Governance Verification
             (Run: npm run governance:fields)

Rule: A field must NEVER be introduced directly into UI/API without
prior canonical registration in backend/app/governance/field_registry.py!
==============================================================
""")


def validate_and_generate_snippet(
    entity_id: str,
    field_name: str,
    db_table: str,
    db_column: str,
    label: str,
    data_type: str = "STRING",
    field_type: str = "TEXT",
    required: bool = False,
    ownership: str = "TENANT",
) -> str:
    field_id = f"{entity_id}.{field_name}"

    if field_id in CANONICAL_FIELDS:
        raise ValueError(f"Field ID '{field_id}' is already registered in CANONICAL_FIELDS!")

    # Check table ownership
    if db_table not in TABLE_OWNERSHIP:
        raise ValueError(f"Table '{db_table}' is not declared in TABLE_OWNERSHIP!")

    table_owner = TABLE_OWNERSHIP[db_table]
    if ownership == "TENANT" and table_owner != TableOwner.TENANT:
        raise ValueError(f"Ownership conflict: Declared TENANT but table '{db_table}' owner is {table_owner.value}!")
    elif ownership == "CONTROL_PLANE" and table_owner != TableOwner.CONTROL_PLANE:
        raise ValueError(f"Ownership conflict: Declared CONTROL_PLANE but table '{db_table}' owner is {table_owner.value}!")

    snippet = f"""    "{field_id}": CanonicalFieldDef(
        field_id="{field_id}",
        entity_id="{entity_id}",
        db_table="{db_table}",
        db_column="{db_column}",
        data_type="{data_type}",
        field_type="{field_type}",
        label="{label}",
        required={required},
        editable=True,
        searchable=True,
        filterable=True,
        sortable=True,
        readonly=False,
        lifecycle=FieldLifecycle.ACTIVE,
        ownership="{ownership}",
        version=1,
    ),"""
    return snippet


def main():
    parser = argparse.ArgumentParser(
        description="SMRITI CFOC New Field Creation Wizard (CFOC v3.46.0)"
    )
    parser.add_argument("--entity", type=str, help="Entity identifier (e.g. customer, supplier, item)")
    parser.add_argument("--field", type=str, help="Field name (e.g. alternate_phone, credit_score)")
    parser.add_argument("--table", type=str, help="Physical database table name (e.g. customers)")
    parser.add_argument("--column", type=str, help="Physical database column name (e.g. alternate_phone)")
    parser.add_argument("--label", type=str, help="Human-readable business label (e.g. Alternate Phone)")
    parser.add_argument("--data-type", type=str, default="STRING", choices=["STRING", "INTEGER", "DECIMAL", "BOOLEAN", "DATE", "DATETIME", "JSON"])
    parser.add_argument("--field-type", type=str, default="TEXT", choices=["TEXT", "NUMBER", "DATE", "DATETIME", "SELECT", "MULTI_SELECT", "BOOLEAN", "LOOKUP", "CURRENCY", "BARCODE", "FILE"])
    parser.add_argument("--required", action="store_true", help="Set if field is mandatory by business policy")
    parser.add_argument("--ownership", type=str, default="TENANT", choices=["TENANT", "CONTROL_PLANE", "SHARED_REFERENCE"])
    parser.add_argument("--show-order", action="store_true", help="Display the CFOC Promotion Order workflow")

    args = parser.parse_args()

    if args.show_order or not (args.entity and args.field and args.table and args.column and args.label):
        print_promotion_order()
        if not (args.entity and args.field and args.table and args.column and args.label):
            print("Usage Example:")
            print("  python scripts/create_canonical_field.py --entity customer --field secondary_email --table customers --column secondary_email --label \"Secondary Email\"")
            return 0

    try:
        snippet = validate_and_generate_snippet(
            entity_id=args.entity,
            field_name=args.field,
            db_table=args.table,
            db_column=args.column,
            label=args.label,
            data_type=args.data_type,
            field_type=args.field_type,
            required=args.required,
            ownership=args.ownership,
        )
        print("\n==============================================================")
        print(" CANONICAL FIELD DEFINITION GENERATED")
        print("==============================================================")
        print(snippet)
        print("\nNext Steps:")
        print("1. Paste the snippet above into 'backend/app/governance/field_registry.py'")
        print("2. Run 'python scripts/generate_ts_field_registry.py'")
        print("3. Run 'npm run governance:fields' to verify 0 drift")
        print("==============================================================\n")
        return 0
    except Exception as e:
        print(f"\n[ERROR] Validation failed: {e}\n", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
