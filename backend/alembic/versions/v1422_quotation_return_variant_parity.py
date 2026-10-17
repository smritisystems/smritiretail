"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.17.0
Created      : 2026-09-11
Modified     : 2026-09-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""Quotation and Return Line Item Variant Parity.

Adds variant_id and indices to sales_quotation_items and sales_return_items
to ensure 100% AST schema parity between SQLAlchemy models and tenant schemas.

Revision ID: v1422_quotation_return_variant_parity
Revises: v1421_vendor_360
Create Date: 2026-09-11
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1422_quotation_return_variant_parity"
down_revision: Union[str, Sequence[str], None] = "v1421_vendor_360"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    if not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1"):
        return

    # 1. Ensure variant_id exists on sales_quotation_items
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sales_quotation_items' AND column_name = 'variant_id'
            ) THEN
                ALTER TABLE sales_quotation_items ADD COLUMN variant_id VARCHAR(50);
            END IF;
        END $$;
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_sales_quotation_items_variant_id ON sales_quotation_items(variant_id);")

    # 2. Ensure variant_id exists on sales_return_items
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sales_return_items' AND column_name = 'variant_id'
            ) THEN
                ALTER TABLE sales_return_items ADD COLUMN variant_id VARCHAR(50);
            END IF;
        END $$;
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_sales_return_items_variant_id ON sales_return_items(variant_id);")


def downgrade() -> None:
    bind = op.get_bind()
    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    if not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1"):
        return

    op.execute("DROP INDEX IF EXISTS ix_sales_return_items_variant_id;")
    op.execute("ALTER TABLE IF EXISTS sales_return_items DROP COLUMN IF EXISTS variant_id;")
    op.execute("DROP INDEX IF EXISTS ix_sales_quotation_items_variant_id;")
    op.execute("ALTER TABLE IF EXISTS sales_quotation_items DROP COLUMN IF EXISTS variant_id;")
