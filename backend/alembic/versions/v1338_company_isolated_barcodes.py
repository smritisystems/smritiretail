"""company_isolated_barcodes

Revision ID: v1338_company_isolated_barcodes
Revises: v1337_backfill_variant_id
Create Date: 2026-08-20 02:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'v1338_company_isolated_barcodes'
down_revision: Union[str, Sequence[str], None] = 'v1337_backfill_variant_id'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop old global table-wide unique index/constraint on barcode
    op.execute("DROP INDEX IF EXISTS ix_products_barcode;")
    op.execute("ALTER TABLE products DROP CONSTRAINT IF EXISTS uq_products_barcode;")
    op.execute("ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_key;")

    # 2. Create non-unique b-tree index for rapid barcode lookup and scanner integration
    op.execute("CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);")

    # 3. Create tenant-isolated partial unique index
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_company_barcode_active
        ON products (company_id, barcode)
        WHERE (is_deleted = false AND barcode IS NOT NULL);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_company_barcode_active;")
    op.execute("DROP INDEX IF EXISTS idx_products_barcode;")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_products_barcode ON products (barcode);")
