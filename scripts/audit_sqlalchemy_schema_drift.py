"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.25.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import sys, os
import psycopg2

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.db.base import Base

# Explicitly import all model modules to register all mappers on Base.metadata
from app.models import (
    crm, inventory, sales, tenant, auth, purchase, pos, supplier_payment,
    numbering, terms, attributes, barcode, exchange, product_identity, role, master_lookup, user_assignment,
    commission, referral, loyalty, promotions, fulfillment, profitability, reporting, ui_control_plane, workflow
)
from app.compliance import models as compliance_models

def run_readonly_schema_drift_audit(target_dbs=None):
    print("==========================================================")
    print("SMRITI READ-ONLY ORM VS POSTGRES DATABASE SCHEMA DRIFT AUDIT")
    print("==========================================================")

    if not target_dbs:
        target_dbs = ["smriti001", "smritisys"]

    results = {}

    for db_name in target_dbs:
        print(f"\n--- AUDITING DATABASE: {db_name} ---")
        db_url = f"postgresql://postgres:postgres@localhost:5432/{db_name}"
        try:
            conn = psycopg2.connect(db_url)
        except Exception as e:
            print(f"Error connecting to database '{db_name}': {e}")
            continue

        cur = conn.cursor()

        # Fetch all actual tables in DB
        cur.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public';
        """)
        actual_tables = {row[0] for row in cur.fetchall()}

        missing_tables = []
        missing_columns = []

        for mapper in Base.registry.mappers:
            cls = mapper.class_
            table_name = mapper.persist_selectable.name

            if table_name not in actual_tables:
                missing_tables.append({
                    "table": table_name,
                    "model_class": cls.__name__,
                    "module": cls.__module__
                })
                continue

            # Fetch actual columns for this table
            cur.execute("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = %s AND table_schema = 'public';
            """, (table_name,))
            actual_cols = {row[0] for row in cur.fetchall()}

            for column in mapper.columns:
                col_name = column.name
                if col_name not in actual_cols:
                    missing_columns.append({
                        "table": table_name,
                        "column": col_name,
                        "type": str(column.type),
                        "model_class": cls.__name__
                    })

        conn.close()

        results[db_name] = {
            "missing_tables": missing_tables,
            "missing_columns": missing_columns
        }

        print(f"[{db_name}] Total Missing Tables : {len(missing_tables)}")
        print(f"[{db_name}] Total Missing Columns: {len(missing_columns)}")

        if missing_tables:
            print(f"\n[{db_name}] Missing Tables ({len(missing_tables)}):")
            for item in missing_tables:
                print(f"  - Table: {item['table']:<35} Model: {item['model_class']:<25} Module: {item['module']}")

        if missing_columns:
            print(f"\n[{db_name}] Missing Columns ({len(missing_columns)}):")
            for item in missing_columns:
                print(f"  - Table: {item['table']:<30} Column: {item['column']:<20} Type: {item['type']}")

    print("\n==========================================================")
    print("AUDIT SUMMARY COMPLETE")
    print("==========================================================")

    return results

if __name__ == "__main__":
    dbs = sys.argv[1:] if len(sys.argv) > 1 else ["smriti001", "smritisys"]
    run_readonly_schema_drift_audit(dbs)
