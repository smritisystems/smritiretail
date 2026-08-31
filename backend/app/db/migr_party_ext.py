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


async def migrate_party_extensions():
    """Migrates party table schema extensions and sub-entity tables across tenant databases."""
    tenants = ["smriti001", "smriti002"]
    
    ddl_statements = [
        "ALTER TABLE parties ADD COLUMN IF NOT EXISTS merged_into_party_id VARCHAR(50);",
        "CREATE INDEX IF NOT EXISTS ix_parties_merged_into ON parties(merged_into_party_id);",
        """
        CREATE TABLE IF NOT EXISTS party_addresses (
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
            party_id VARCHAR(50) NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
            address_type VARCHAR(30) NOT NULL DEFAULT 'BILLING',
            address_title VARCHAR(100),
            address_line1 TEXT NOT NULL,
            address_line2 TEXT,
            city VARCHAR(100) NOT NULL,
            state VARCHAR(100) NOT NULL,
            state_code VARCHAR(5),
            pincode VARCHAR(10) NOT NULL,
            country VARCHAR(100) NOT NULL DEFAULT 'India',
            gstin VARCHAR(15),
            is_primary BOOLEAN NOT NULL DEFAULT FALSE
        );
        """,
        "CREATE INDEX IF NOT EXISTS ix_party_addresses_party_id ON party_addresses(party_id);",
        """
        CREATE TABLE IF NOT EXISTS party_contacts (
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
            party_id VARCHAR(50) NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
            contact_name VARCHAR(150) NOT NULL,
            designation VARCHAR(100),
            department VARCHAR(100),
            phone VARCHAR(20),
            mobile VARCHAR(20),
            email VARCHAR(255),
            is_primary BOOLEAN NOT NULL DEFAULT FALSE
        );
        """,
        "CREATE INDEX IF NOT EXISTS ix_party_contacts_party_id ON party_contacts(party_id);",
        """
        CREATE TABLE IF NOT EXISTS party_relationships (
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
            source_party_id VARCHAR(50) NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
            target_party_id VARCHAR(50) NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
            relationship_type VARCHAR(50) NOT NULL,
            metadata_json JSONB DEFAULT '{}'
        );
        """,
        "CREATE INDEX IF NOT EXISTS ix_party_rel_source ON party_relationships(source_party_id);",
        "CREATE INDEX IF NOT EXISTS ix_party_rel_target ON party_relationships(target_party_id);",
    ]

    for tenant in tenants:
        print(f"Applying Party Master DDL extensions to tenant '{tenant}'...")
        sessionmaker = get_company_sessionmaker(tenant)
        async with sessionmaker() as session:
            for stmt in ddl_statements:
                await session.execute(text(stmt))
            await session.commit()
            print(f"Tenant '{tenant}' Party Master schema migrated successfully.")


if __name__ == "__main__":
    asyncio.run(migrate_party_extensions())
