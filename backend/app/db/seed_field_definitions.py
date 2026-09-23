"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.44.0
Created      : 2026-09-23
Modified     : 2026-09-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Architecture Governance Seeder — Field Definitions
"""

import sys
import json
import uuid
import psycopg2
from typing import Dict, Any

try:
    from app.db.seed_contract import seed_contract
    from app.governance.field_registry import CANONICAL_FIELDS, CanonicalFieldDef
except ImportError:
    from backend.app.db.seed_contract import seed_contract
    from backend.app.governance.field_registry import CANONICAL_FIELDS, CanonicalFieldDef

sys.stdout.reconfigure(encoding="utf-8")

DATABASES = ["smritisys"]


@seed_contract(target="control")
def seed_database(db_name: str) -> None:
    print(f"=== Seeding Canonical Field Definitions in {db_name} ===")
    conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{db_name}")
    conn.autocommit = True
    cur = conn.cursor()

    # Verify target table exists
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'field_definitions'
        );
    """)
    if not cur.fetchone()[0]:
        print(f"  [ERROR] Table 'field_definitions' does not exist in {db_name}!")
        conn.close()
        return

    count = 0
    for fid, fdef in CANONICAL_FIELDS.items():
        stable_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"smriti.field.{fid}"))
        val_rules = json.dumps([{"rule": fdef.validation_rule}] if fdef.validation_rule else [])
        ui_aliases = json.dumps(list(fdef.aliases))

        cur.execute("""
            INSERT INTO field_definitions (
                id, uuid, code, version, name, label_key, description,
                field_type, data_type, is_required, is_readonly,
                is_searchable, is_sortable, is_filterable, is_exportable, is_hidden,
                validation_rules, options_source, placeholder_key,
                max_length, min_value, max_value, status,
                entity_key, canonical_table, canonical_column, api_alias, ui_aliases,
                created_at, modified_at
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                NOW(), NOW()
            )
            ON CONFLICT (code) DO UPDATE SET
                name = EXCLUDED.name,
                label_key = EXCLUDED.label_key,
                description = EXCLUDED.description,
                field_type = EXCLUDED.field_type,
                data_type = EXCLUDED.data_type,
                is_required = EXCLUDED.is_required,
                is_readonly = EXCLUDED.is_readonly,
                is_searchable = EXCLUDED.is_searchable,
                is_sortable = EXCLUDED.is_sortable,
                is_filterable = EXCLUDED.is_filterable,
                is_exportable = EXCLUDED.is_exportable,
                validation_rules = EXCLUDED.validation_rules,
                options_source = EXCLUDED.options_source,
                placeholder_key = EXCLUDED.placeholder_key,
                max_length = EXCLUDED.max_length,
                min_value = EXCLUDED.min_value,
                max_value = EXCLUDED.max_value,
                status = EXCLUDED.status,
                entity_key = EXCLUDED.entity_key,
                canonical_table = EXCLUDED.canonical_table,
                canonical_column = EXCLUDED.canonical_column,
                api_alias = EXCLUDED.api_alias,
                ui_aliases = EXCLUDED.ui_aliases,
                modified_at = NOW();
        """, (
            fid, stable_uuid, fid, fdef.version, fdef.label, f"{fid}.label", fdef.help_text,
            fdef.field_type, fdef.data_type, fdef.required, fdef.readonly,
            fdef.searchable, fdef.sortable, fdef.filterable, True, False,
            val_rules, fdef.option_source, fdef.placeholder,
            fdef.max_length, fdef.min_value, fdef.max_value, fdef.status,
            fdef.entity_id, fdef.db_table, fdef.db_column,
            fdef.aliases[0] if fdef.aliases else None, ui_aliases
        ))
        count += 1

    print(f"  [OK] Successfully seeded {count} canonical field definitions into {db_name}.")
    conn.close()
    print(f"=== {db_name} Seeding Complete ===\n")


def main():
    for db in DATABASES:
        seed_database(db)


if __name__ == "__main__":
    main()
