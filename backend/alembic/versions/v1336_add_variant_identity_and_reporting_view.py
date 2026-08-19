"""add_variant_identity_and_reporting_view

Revision ID: v1336_variant_identity_view
Revises: v1335_seed_roles
Create Date: 2026-08-20 01:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'v1336_variant_identity_view'
down_revision: Union[str, Sequence[str], None] = 'v1335_seed_roles'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add variant_id column IF NOT EXISTS
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'products' AND column_name = 'variant_id'
            ) THEN
                ALTER TABLE products ADD COLUMN variant_id BIGINT;
            END IF;
        END $$;
    """)

    # 2. Add non-unique index on variant_id IF NOT EXISTS
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_products_variant_id
        ON products USING btree (variant_id);
    """)

    # 3. Add composite unique identity index on active products IF NOT EXISTS
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_variant_identity_active
        ON products USING btree (
            company_id,
            lower((style_code)::text),
            lower((color)::text),
            lower((size)::text)
        )
        WHERE ((is_deleted = false) AND (style_code IS NOT NULL) AND (color IS NOT NULL) AND (size IS NOT NULL));
    """)

    # 4. Create or replace the canonical reporting flat view
    op.execute("""
        CREATE OR REPLACE VIEW report_flat_inventory_sales AS
        SELECT
            p.variant_id,
            p.id AS product_id,
            p.company_id,
            p.branch_id,
            p.code AS sku_code,
            p.barcode,
            p.name AS product_name,
            p.category AS merchandise_category,
            p.brand,
            p.style_code,
            p.color,
            p.size,
            p.mrp,
            p.cost_price,
            p.price AS selling_price,
            p.gst_percentage,
            p.hsn_code,
            p.stock AS current_stock,
            p.attributes,
            p.is_deleted,
            p.created_at,
            p.modified_at
        FROM products p;
    """)


def downgrade() -> None:
    # 1. Drop canonical reporting view
    op.execute("DROP VIEW IF EXISTS report_flat_inventory_sales;")

    # 2. Drop unique identity index
    op.execute("DROP INDEX IF EXISTS uq_variant_identity_active;")

    # 3. Drop variant_id index
    op.execute("DROP INDEX IF EXISTS idx_products_variant_id;")

    # 4. Drop variant_id column
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'products' AND column_name = 'variant_id'
            ) THEN
                ALTER TABLE products DROP COLUMN variant_id;
            END IF;
        END $$;
    """)
