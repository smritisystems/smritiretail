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
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

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

def migrate_company_database(db_name: str):
    print(f"\n============================================================")
    print(f"Migrating Company Database: {db_name}")
    print(f"============================================================")
    
    conn = psycopg2.connect(f"dbname={db_name} user=postgres password=postgres host=localhost port=5432")
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    # 1. Check if warehouses table exists
    cur.execute("SELECT to_regclass('public.warehouses');")
    if cur.fetchone()[0] is None:
        print("  - Creating warehouses table...")
        cur.execute("""
            CREATE TABLE warehouses (
                id VARCHAR(50) PRIMARY KEY,
                uuid VARCHAR(50) NOT NULL,
                company_id VARCHAR(50),
                branch_id VARCHAR(50),
                code VARCHAR(50) NOT NULL,
                name VARCHAR(200) NOT NULL,
                is_transit BOOLEAN DEFAULT FALSE,
                is_central_godown BOOLEAN DEFAULT FALSE,
                address TEXT,
                city VARCHAR(100),
                state VARCHAR(100),
                pincode VARCHAR(10),
                contact_person VARCHAR(100),
                phone VARCHAR(20),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                created_by VARCHAR(50),
                updated_by VARCHAR(50),
                is_active BOOLEAN DEFAULT TRUE,
                is_deleted BOOLEAN DEFAULT FALSE,
                deleted_at TIMESTAMP WITH TIME ZONE,
                deleted_by VARCHAR(50),
                version INTEGER DEFAULT 1
            );
        """)
    else:
        print("  - Extending warehouses table...")
        # Drop legacy global unique constraint if present
        cur.execute("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'warehouses_code_key'
                ) THEN
                    ALTER TABLE warehouses DROP CONSTRAINT warehouses_code_key;
                END IF;
            END $$;
        """)
        
        # Add new columns if missing
        new_cols = [
            ("is_central_godown", "BOOLEAN DEFAULT FALSE"),
            ("city", "VARCHAR(100)"),
            ("state", "VARCHAR(100)"),
            ("pincode", "VARCHAR(10)"),
            ("contact_person", "VARCHAR(100)"),
            ("phone", "VARCHAR(20)"),
        ]
        for col_name, col_type in new_cols:
            cur.execute(f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'warehouses' AND column_name = '{col_name}'
                    ) THEN
                        ALTER TABLE warehouses ADD COLUMN {col_name} {col_type};
                    END IF;
                END $$;
            """)

    # Create scoped warehouse code index
    cur.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_company_warehouse_code_active 
        ON warehouses (company_id, code) 
        WHERE is_deleted = false;
    """)

    # 2. Extend stock_movements table with warehouse_id
    cur.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'stock_movements' AND column_name = 'warehouse_id'
            ) THEN
                ALTER TABLE stock_movements ADD COLUMN warehouse_id VARCHAR(50) REFERENCES warehouses(id) ON DELETE SET NULL;
            END IF;
        END $$;
    """)

    # 3. Create product_batch_stocks table
    print("  - Ensuring product_batch_stocks table...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS product_batch_stocks (
            id VARCHAR(50) PRIMARY KEY,
            uuid VARCHAR(50) NOT NULL,
            company_id VARCHAR(50),
            branch_id VARCHAR(50),
            product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
            warehouse_id VARCHAR(50) NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
            batch_no VARCHAR(100) NOT NULL,
            mfg_date DATE,
            expiry_date DATE,
            mrp NUMERIC(15, 2),
            purchase_rate NUMERIC(15, 2),
            sale_rate NUMERIC(15, 2),
            quantity NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
            reserved_quantity NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
            damaged_quantity NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
            last_counted_date TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_by VARCHAR(50),
            updated_by VARCHAR(50),
            is_active BOOLEAN DEFAULT TRUE,
            is_deleted BOOLEAN DEFAULT FALSE,
            deleted_at TIMESTAMP WITH TIME ZONE,
            deleted_by VARCHAR(50),
            version INTEGER DEFAULT 1
        );
    """)

    cur.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_company_wh_prod_batch_active 
        ON product_batch_stocks (company_id, warehouse_id, product_id, batch_no) 
        WHERE is_deleted = false;
    """)

    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_batch_stock_expiry ON product_batch_stocks (expiry_date);
    """)

    # 4. Create stock_transfers table
    print("  - Ensuring stock_transfers table...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS stock_transfers (
            id VARCHAR(50) PRIMARY KEY,
            uuid VARCHAR(50) NOT NULL,
            company_id VARCHAR(50),
            branch_id VARCHAR(50),
            transfer_no VARCHAR(100) NOT NULL,
            source_warehouse_id VARCHAR(50) NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
            dest_warehouse_id VARCHAR(50) NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
            status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
            dispatch_date TIMESTAMP WITH TIME ZONE,
            received_date TIMESTAMP WITH TIME ZONE,
            transporter_name VARCHAR(100),
            lr_number VARCHAR(100),
            vehicle_number VARCHAR(50),
            e_way_bill_no VARCHAR(50),
            idempotency_key VARCHAR(100),
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_by VARCHAR(50),
            updated_by VARCHAR(50),
            is_active BOOLEAN DEFAULT TRUE,
            is_deleted BOOLEAN DEFAULT FALSE,
            deleted_at TIMESTAMP WITH TIME ZONE,
            deleted_by VARCHAR(50),
            version INTEGER DEFAULT 1
        );
    """)

    cur.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_company_transfer_no_active 
        ON stock_transfers (company_id, transfer_no) 
        WHERE is_deleted = false;
    """)

    cur.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_company_transfer_idempotency_active 
        ON stock_transfers (company_id, idempotency_key) 
        WHERE idempotency_key IS NOT NULL AND is_deleted = false;
    """)

    # 5. Create stock_transfer_items table
    print("  - Ensuring stock_transfer_items table...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS stock_transfer_items (
            id VARCHAR(50) PRIMARY KEY,
            uuid VARCHAR(50) NOT NULL,
            company_id VARCHAR(50),
            branch_id VARCHAR(50),
            transfer_id VARCHAR(50) NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
            product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
            batch_no VARCHAR(100) NOT NULL,
            quantity_dispatched NUMERIC(12, 4) NOT NULL,
            quantity_received NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
            quantity_shortage NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
            quantity_damaged NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
            unit_cost NUMERIC(15, 2) NOT NULL,
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_by VARCHAR(50),
            updated_by VARCHAR(50),
            is_active BOOLEAN DEFAULT TRUE,
            is_deleted BOOLEAN DEFAULT FALSE,
            deleted_at TIMESTAMP WITH TIME ZONE,
            deleted_by VARCHAR(50),
            version INTEGER DEFAULT 1
        );
    """)

    # 6. Seed Baseline Default Godowns (Central Godown & Shop Floor)
    cur.execute("SELECT id FROM companies WHERE is_deleted = false LIMIT 1;")
    comp_row = cur.fetchone()
    active_comp_id = comp_row[0] if comp_row else ("COMP-001" if "001" in db_name else ("COMP-002" if "002" in db_name else None))

    cur.execute("SELECT id FROM branches WHERE is_deleted = false LIMIT 1;")
    branch_row = cur.fetchone()
    active_branch_id = branch_row[0] if branch_row else None

    cur.execute("SELECT COUNT(*) FROM warehouses WHERE is_deleted = false;")
    wh_count = cur.fetchone()[0]
    if wh_count == 0 and active_comp_id:
        print(f"  - Seeding default warehouses for {active_comp_id} (Branch: {active_branch_id})...")
        cur.execute("""
            INSERT INTO warehouses (
                id, uuid, company_id, branch_id, code, name, is_transit, is_central_godown,
                city, state, pincode, contact_person, phone, is_active, is_deleted, created_at, modified_at
            ) VALUES 
            ('wh-central-001', %s, %s, %s, 'WH-MAIN', 'Central Distribution Godown', false, true, 'Mumbai', 'Maharashtra', '400001', 'Godown Manager', '+919876543210', true, false, NOW(), NOW()),
            ('wh-shop-001', %s, %s, %s, 'WH-SHOP', 'Retail Floor & Display Shelf', false, false, 'Mumbai', 'Maharashtra', '400001', 'Store Supervisor', '+919876543211', true, false, NOW(), NOW()),
            ('wh-transit-001', %s, %s, %s, 'WH-TRANSIT', 'In-Transit Virtual Location', true, false, 'Mumbai', 'Maharashtra', '400001', 'Logistics Coordinator', '+919876543212', true, false, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING;
        """, (
            str(uuid.uuid4()), active_comp_id, active_branch_id,
            str(uuid.uuid4()), active_comp_id, active_branch_id,
            str(uuid.uuid4()), active_comp_id, active_branch_id
        ))

    # 7. Backfill legacy stock movements
    cur.execute("""
        UPDATE stock_movements 
        SET warehouse_id = 'wh-central-001' 
        WHERE warehouse_id IS NULL AND is_deleted = false;
    """)

    print(f"  [OK] {db_name} WMS Phase 1 Migration Successfully Completed.")
    cur.close()
    conn.close()

def main():
    print("Starting SMRITI WMS Phase 1 Database Migration across Company Data Planes...")
    dbs = get_company_databases()
    for db in dbs:
        try:
            migrate_company_database(db)
        except Exception as e:
            print(f"  [FAIL] Failed migrating {db}: {e}")
            sys.exit(1)
    print("\nAll Company Data Planes Successfully Migrated to WMS Phase 1 Specification.")

if __name__ == "__main__":
    main()
