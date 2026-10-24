"""SMRITI Retail OS Item Master Phase R-09: Dual-Contract SKU Alignment Migration

Revision ID: v1523_sku_canonical_physical_contract
Revises: v1522_item_master_phase11_tracking_mode_harmonization
Create Date: 2026-10-06

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.7
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Architecture Invariants Enforced (ADR-001 Option C):
1. Establishes physical column `sku` on `item_variants` as a PostgreSQL GENERATED ALWAYS AS (variant_sku) STORED column.
2. Maintains 100% backward compatibility with all existing queries referencing `variant_sku`.
3. Creates compound b-tree index `ix_item_variants_sku` on (company_id, sku) WHERE is_deleted = false.
4. Fully reversible upgrade and downgrade paths.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = "v1523_sku_canonical_physical_contract"
down_revision = "v1522_item_master_phase11_tracking_mode_harmonization"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = Inspector.from_engine(conn)
    existing_cols = [c["name"] for c in insp.get_columns("item_variants")]

    if "sku" not in existing_cols:
        conn.execute(sa.text("""
            ALTER TABLE item_variants
            ADD COLUMN sku VARCHAR(100) GENERATED ALWAYS AS (variant_sku) STORED;
        """))

    existing_indices = [idx["name"] for idx in insp.get_indexes("item_variants")]
    if "ix_item_variants_sku" not in existing_indices:
        conn.execute(sa.text("""
            CREATE INDEX ix_item_variants_sku
            ON item_variants (company_id, sku)
            WHERE is_deleted = false;
        """))


def downgrade() -> None:
    conn = op.get_bind()
    insp = Inspector.from_engine(conn)
    existing_indices = [idx["name"] for idx in insp.get_indexes("item_variants")]

    if "ix_item_variants_sku" in existing_indices:
        conn.execute(sa.text("DROP INDEX IF EXISTS ix_item_variants_sku;"))

    existing_cols = [c["name"] for c in insp.get_columns("item_variants")]
    if "sku" in existing_cols:
        conn.execute(sa.text("ALTER TABLE item_variants DROP COLUMN IF EXISTS sku;"))
