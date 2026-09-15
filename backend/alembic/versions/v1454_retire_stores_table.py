"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.26.0
Created      : 2026-09-16
Modified     : 2026-09-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Schema Lifecycle & Deprecation — Phase C
"""

"""Retire deprecated stores table and companion user_store_assignments (Phase C).

Revision ID: v1454_retire_stores_table
Revises: v1453_seed_sales_promotions_menu
Create Date: 2026-09-16
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "v1454_retire_stores_table"
down_revision: Union[str, Sequence[str], None] = "v1453_seed_sales_promotions_menu"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Check if stores table exists
    has_stores = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'stores';
    """)).scalar()

    if not has_stores:
        return

    # Gate 1 Precondition: Ensure zero operational data in tenant databases
    store_count = bind.execute(sa.text("SELECT COUNT(*) FROM stores;")).scalar() or 0
    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()

    if store_count > 0:
        # In smritisys control plane, clean up stale legacy test seeds
        if current_db == "smritisys":
            bind.execute(sa.text("DELETE FROM stores;"))
        else:
            raise RuntimeError(
                f"Gate 1 Failure: Cannot retire table 'stores' in database '{current_db}' — contains {store_count} active rows."
            )

    # Gate 3: Sever foreign key from staff_placement_assignments if present
    bind.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'staff_placement_assignments_internal_store_id_fkey'
            ) THEN
                ALTER TABLE staff_placement_assignments 
                DROP CONSTRAINT staff_placement_assignments_internal_store_id_fkey;
            END IF;
        END $$;
    """))

    # Gate 3: Drop companion empty table user_store_assignments
    has_usa = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'user_store_assignments';
    """)).scalar()

    if has_usa:
        usa_count = bind.execute(sa.text("SELECT COUNT(*) FROM user_store_assignments;")).scalar() or 0
        if usa_count > 0:
            raise RuntimeError(
                f"Gate 1 Failure: Cannot retire 'user_store_assignments' — contains {usa_count} rows."
            )
        bind.execute(sa.text("DROP TABLE IF EXISTS user_store_assignments CASCADE;"))

    # Gate 4 & 5: Drop stores table
    bind.execute(sa.text("DROP TABLE IF EXISTS stores CASCADE;"))


def downgrade() -> None:
    bind = op.get_bind()

    # Recreate stores table per docs/archive/stores_phase_b_archive_v4.17.0.sql
    bind.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS stores (
            id character varying(50) NOT NULL,
            uuid character varying(36) NOT NULL,
            code character varying(50) NOT NULL,
            name character varying(200) NOT NULL,
            store_type character varying(50),
            address text,
            company_id character varying(50),
            branch_id character varying(50),
            created_at timestamp with time zone,
            modified_at timestamp with time zone,
            created_by character varying(100),
            updated_by character varying(100),
            is_active boolean,
            is_deleted boolean,
            deleted_at timestamp with time zone,
            deleted_by character varying(100),
            version integer,
            CONSTRAINT stores_pkey PRIMARY KEY (id),
            CONSTRAINT stores_code_key UNIQUE (code),
            CONSTRAINT stores_uuid_key UNIQUE (uuid)
        );
    """))

    # Recreate user_store_assignments
    bind.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS user_store_assignments (
            id character varying(50) NOT NULL,
            uuid character varying(36),
            company_id character varying(50) NOT NULL,
            branch_id character varying(50) NOT NULL,
            user_id character varying(50) NOT NULL,
            store_id character varying(50) NOT NULL,
            created_at timestamp with time zone,
            modified_at timestamp with time zone,
            created_by character varying(100),
            updated_by character varying(100),
            is_active boolean,
            is_deleted boolean,
            deleted_at timestamp with time zone,
            deleted_by character varying(100),
            version integer,
            CONSTRAINT user_store_assignments_pkey PRIMARY KEY (id),
            CONSTRAINT user_store_assignments_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT
        );
    """))

    # Re-link staff_placement_assignments FK if table exists
    bind.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_placement_assignments') THEN
                ALTER TABLE staff_placement_assignments 
                ADD CONSTRAINT staff_placement_assignments_internal_store_id_fkey 
                FOREIGN KEY (internal_store_id) REFERENCES stores(id) ON DELETE RESTRICT;
            END IF;
        END $$;
    """))
