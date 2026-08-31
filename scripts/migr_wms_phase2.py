"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-22
Modified     : 2026-08-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
import uuid
import psycopg2

def get_company_databases():
    try:
        conn = psycopg2.connect("dbname=postgres user=postgres password=postgres host=localhost port=5432")
        cur = conn.cursor()
        cur.execute("SELECT datname FROM pg_database WHERE datname LIKE 'smriti%' AND datname != 'smritisys';")
        dbs = [r[0] for r in cur.fetchall()]
        conn.close()
        return dbs
    except Exception:
        return ["smriti001", "smriti002", "smriti_test_fresh"]

def migrate_phase2_database(db_name: str):
    print(f"\n============================================================")
    print(f"Migrating Company Database (Phase 2 GRN & Sales): {db_name}")
    print(f"============================================================")
    
    conn = psycopg2.connect(f"dbname={db_name} user=postgres password=postgres host=localhost port=5432")
    try:
        cur = conn.cursor()

        # 1. Extend purchase_receipts table with warehouse_id
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'purchase_receipts' AND column_name = 'warehouse_id'
                ) THEN
                    ALTER TABLE purchase_receipts ADD COLUMN warehouse_id VARCHAR(50) REFERENCES warehouses(id) ON DELETE RESTRICT;
                END IF;
            END $$;
        """)

        # 2. Extend purchase_receipt_items with batch and quality attributes
        new_receipt_cols = [
            ("batch_no", "VARCHAR(100)"),
            ("mfg_date", "DATE"),
            ("expiry_date", "DATE"),
            ("mrp", "NUMERIC(15, 2)"),
            ("quantity_damaged", "NUMERIC(10, 2) DEFAULT 0.00"),
        ]
        for col_name, col_type in new_receipt_cols:
            cur.execute(f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'purchase_receipt_items' AND column_name = '{col_name}'
                    ) THEN
                        ALTER TABLE purchase_receipt_items ADD COLUMN {col_name} {col_type};
                    END IF;
                END $$;
            """)

        # 3. Extend sales_invoices table with warehouse_id
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'sales_invoices' AND column_name = 'warehouse_id'
                ) THEN
                    ALTER TABLE sales_invoices ADD COLUMN warehouse_id VARCHAR(50) REFERENCES warehouses(id) ON DELETE RESTRICT;
                END IF;
            END $$;
        """)

        # 4. Extend sales_invoice_items with batch_no
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'sales_invoice_items' AND column_name = 'batch_no'
                ) THEN
                    ALTER TABLE sales_invoice_items ADD COLUMN batch_no VARCHAR(100);
                END IF;
            END $$;
        """)

        # 5. Backfill warehouse_id on existing sales_invoices and purchase_receipts to wh-central-001
        cur.execute("""
            UPDATE sales_invoices 
            SET warehouse_id = 'wh-central-001' 
            WHERE warehouse_id IS NULL AND is_deleted = false;
        """)
        cur.execute("""
            UPDATE purchase_receipts 
            SET warehouse_id = 'wh-central-001' 
            WHERE warehouse_id IS NULL AND is_deleted = false;
        """)

        conn.commit()
        print(f"  [OK] {db_name} WMS Phase 2 Migration Successfully Completed.")
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()

def main():
    print("Starting SMRITI WMS Phase 2 Database Migration across Company Data Planes...")
    dbs = get_company_databases()
    for db in dbs:
        try:
            migrate_phase2_database(db)
        except Exception as e:
            print(f"  [FAIL] Failed migrating {db}: {e}")
            sys.exit(1)
    print("\nAll Company Data Planes Successfully Migrated to WMS Phase 2 Specification.")

if __name__ == "__main__":
    main()
