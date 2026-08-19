"""backfill_variant_id_and_attach_sequence

Revision ID: v1337_backfill_variant_id
Revises: v1336_variant_identity_view
Create Date: 2026-08-20 01:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'v1337_backfill_variant_id'
down_revision: Union[str, Sequence[str], None] = 'v1336_variant_identity_view'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create sequence if not exists
    op.execute("CREATE SEQUENCE IF NOT EXISTS products_variant_id_seq;")

    # 2. Backfill null variant_id rows safely
    op.execute("""
        WITH numbered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY created_at NULLS LAST, id) AS rn
            FROM products
            WHERE variant_id IS NULL
        )
        UPDATE products p
        SET variant_id = n.rn + COALESCE((SELECT MAX(variant_id) FROM products), 0)
        FROM numbered n
        WHERE p.id = n.id;
    """)

    # 3. Synchronize sequence with current max variant_id
    op.execute("""
        SELECT setval(
            'products_variant_id_seq',
            COALESCE((SELECT MAX(variant_id) FROM products), 1)
        );
    """)

    # 4. Attach sequence default to variant_id column
    op.execute("""
        ALTER TABLE products
        ALTER COLUMN variant_id SET DEFAULT nextval('products_variant_id_seq');
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE products
        ALTER COLUMN variant_id DROP DEFAULT;
    """)
    op.execute("DROP SEQUENCE IF EXISTS products_variant_id_seq;")
