"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import asyncio
from sqlalchemy import text
from app.db.session import get_company_sessionmaker


async def migrate_item_extensions():
    """Migrates item master schema extensions and sub-entity tables across tenant databases."""
    tenants = ["smriti001", "smriti002"]

    ddl_statements = [
        """
        CREATE TABLE IF NOT EXISTS item_batches (
            id VARCHAR(50) PRIMARY KEY,
            uuid VARCHAR(36),
            company_id VARCHAR(50),
            branch_id VARCHAR(50),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
            modified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
            created_by VARCHAR(50),
            updated_by VARCHAR(50),
            is_active BOOLEAN DEFAULT TRUE,
            is_deleted BOOLEAN DEFAULT FALSE,
            deleted_at TIMESTAMP WITH TIME ZONE,
            deleted_by VARCHAR(50),
            version INTEGER DEFAULT 1,
            item_id VARCHAR(50) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
            variant_id VARCHAR(50) REFERENCES item_variants(id) ON DELETE CASCADE,
            batch_number VARCHAR(100) NOT NULL,
            mfg_date DATE,
            exp_date DATE,
            mrp NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            cost_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            CONSTRAINT uq_item_batch_no UNIQUE (item_id, batch_number)
        );
        """,
        "CREATE INDEX IF NOT EXISTS ix_item_batches_item_id ON item_batches(item_id);",
        "CREATE INDEX IF NOT EXISTS ix_item_batches_batch_no ON item_batches(batch_number);",
        """
        CREATE TABLE IF NOT EXISTS item_serials (
            id VARCHAR(50) PRIMARY KEY,
            uuid VARCHAR(36),
            company_id VARCHAR(50),
            branch_id VARCHAR(50),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
            modified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
            created_by VARCHAR(50),
            updated_by VARCHAR(50),
            is_active BOOLEAN DEFAULT TRUE,
            is_deleted BOOLEAN DEFAULT FALSE,
            deleted_at TIMESTAMP WITH TIME ZONE,
            deleted_by VARCHAR(50),
            version INTEGER DEFAULT 1,
            item_id VARCHAR(50) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
            variant_id VARCHAR(50) REFERENCES item_variants(id) ON DELETE CASCADE,
            serial_number VARCHAR(100) NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
            warehouse_id VARCHAR(50),
            CONSTRAINT uq_item_serial_no UNIQUE (item_id, serial_number)
        );
        """,
        "CREATE INDEX IF NOT EXISTS ix_item_serials_item_id ON item_serials(item_id);",
        "CREATE INDEX IF NOT EXISTS ix_item_serials_serial_no ON item_serials(serial_number);",
        """
        CREATE TABLE IF NOT EXISTS item_warehouse_locations (
            id VARCHAR(50) PRIMARY KEY,
            uuid VARCHAR(36),
            company_id VARCHAR(50),
            branch_id VARCHAR(50),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
            modified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
            created_by VARCHAR(50),
            updated_by VARCHAR(50),
            is_active BOOLEAN DEFAULT TRUE,
            is_deleted BOOLEAN DEFAULT FALSE,
            deleted_at TIMESTAMP WITH TIME ZONE,
            deleted_by VARCHAR(50),
            version INTEGER DEFAULT 1,
            item_id VARCHAR(50) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
            warehouse_id VARCHAR(50) NOT NULL,
            location_bin VARCHAR(50),
            min_reorder_level NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            max_capacity NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            reorder_quantity NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            CONSTRAINT uq_item_warehouse UNIQUE (item_id, warehouse_id)
        );
        """,
        "CREATE INDEX IF NOT EXISTS ix_item_wh_locations_item_id ON item_warehouse_locations(item_id);",
        "CREATE INDEX IF NOT EXISTS ix_item_wh_locations_wh_id ON item_warehouse_locations(warehouse_id);",
    ]

    for tenant in tenants:
        print(f"Applying Universal Item Master DDL extensions to tenant '{tenant}'...")
        sessionmaker = get_company_sessionmaker(tenant)
        async with sessionmaker() as session:
            for stmt in ddl_statements:
                await session.execute(text(stmt))
            await session.commit()
            print(f"Tenant '{tenant}' Universal Item Master schema migrated successfully.")


if __name__ == "__main__":
    asyncio.run(migrate_item_extensions())
