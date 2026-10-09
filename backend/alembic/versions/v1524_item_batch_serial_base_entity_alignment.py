"""SMRITI Retail OS Item Master Phase R-10: Item Batch, Serial, and Location BaseEntity Alignment Migration

Revision ID: v1524_item_batch_serial_base_entity_alignment
Revises: v1523_sku_canonical_physical_contract
Create Date: 2026-10-09

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.50
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Architecture Invariants Enforced:
1. Aligns item_batches, item_serials, and item_warehouse_locations with BaseEntity contract.
2. Ensures uuid, branch_id, modified_at, created_by, updated_by, is_deleted, deleted_at, deleted_by, version columns exist.
3. Safe backfill for existing rows with gen_random_uuid() or uuid_generate_v4().
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = "v1524_item_batch_serial_base_entity_alignment"
down_revision = "v1523_sku_canonical_physical_contract"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    tables = ["item_batches", "item_serials", "item_warehouse_locations"]

    for table in tables:
        conn.execute(sa.text(f"""
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '{table}') THEN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '{table}' AND column_name = 'uuid') THEN
                        ALTER TABLE {table} ADD COLUMN uuid VARCHAR(36);
                        UPDATE {table} SET uuid = md5(random()::text || clock_timestamp()::text)::uuid::text WHERE uuid IS NULL;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '{table}' AND column_name = 'company_id') THEN
                        ALTER TABLE {table} ADD COLUMN company_id VARCHAR(50) DEFAULT 'COMP-001';
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '{table}' AND column_name = 'is_active') THEN
                        ALTER TABLE {table} ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '{table}' AND column_name = 'branch_id') THEN
                        ALTER TABLE {table} ADD COLUMN branch_id VARCHAR(50);
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '{table}' AND column_name = 'modified_at') THEN
                        ALTER TABLE {table} ADD COLUMN modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '{table}' AND column_name = 'created_by') THEN
                        ALTER TABLE {table} ADD COLUMN created_by VARCHAR(100);
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '{table}' AND column_name = 'updated_by') THEN
                        ALTER TABLE {table} ADD COLUMN updated_by VARCHAR(100);
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '{table}' AND column_name = 'is_deleted') THEN
                        ALTER TABLE {table} ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '{table}' AND column_name = 'deleted_at') THEN
                        ALTER TABLE {table} ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '{table}' AND column_name = 'deleted_by') THEN
                        ALTER TABLE {table} ADD COLUMN deleted_by VARCHAR(100);
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '{table}' AND column_name = 'version') THEN
                        ALTER TABLE {table} ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
                    END IF;
                END IF;
            END $$;
        """))


def downgrade() -> None:
    pass
