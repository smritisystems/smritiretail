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
from sqlalchemy import create_engine

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.db.base import Base
# Import all models
from app.models import (
    crm, inventory, sales, tenant, auth, purchase, pos, supplier_payment,
    numbering, terms, attributes, barcode, exchange, product_identity, role, master_lookup, user_assignment,
    commission, referral, loyalty, promotions, fulfillment, profitability, reporting, ui_control_plane, workflow
)
from app.compliance import models as compliance_models

def run_schema_drift_audit():
    print("==========================================================")
    print("SMRITI SYSTEMATIC MODEL VS DATABASE SCHEMA DRIFT AUDIT")
    print("==========================================================")

    for db_name in ["smriti001", "smritisys"]:
        db_url = f"postgresql://postgres:postgres@localhost:5432/{db_name}"
        sync_engine = create_engine(db_url)
        Base.metadata.create_all(bind=sync_engine)
        sync_engine.dispose()

    # 2. Check every table and column against database schema
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    missing_columns = []
    missing_tables = []

    for mapper in Base.registry.mappers:
        cls = mapper.class_
        table_name = mapper.persist_selectable.name
        
        # Get actual DB columns
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = %s;
        """, (table_name,))
        db_cols = {row[0] for row in cur.fetchall()}

        if not db_cols:
            missing_tables.append(table_name)
            print(f"[MISSING TABLE] Table '{table_name}' does not exist in database!")
            continue

        # Get ORM model declared column names
        for column in mapper.columns:
            col_name = column.name
            if col_name not in db_cols:
                col_type = str(column.type)
                nullable = column.nullable
                missing_columns.append({
                    "table": table_name,
                    "column": col_name,
                    "type": col_type,
                    "nullable": nullable,
                    "model_class": cls.__name__
                })
                print(f"[SCHEMA DRIFT] Table '{table_name}' -> Model '{cls.__name__}' declares column '{col_name}' ({col_type}) missing from DB!")

    conn.close()

    print("\n==========================================================")
    print(f"TOTAL MISSING TABLES: {len(missing_tables)}")
    print(f"TOTAL MISSING COLUMNS: {len(missing_columns)}")
    print("==========================================================")

    return missing_columns

if __name__ == "__main__":
    run_schema_drift_audit()
