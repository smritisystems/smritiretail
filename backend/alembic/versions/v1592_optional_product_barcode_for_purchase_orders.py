"""Allow products to exist before a supplier barcode is assigned.

Revision ID: v1592
Revises: v1591
# @migration_target('tenant')
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "v1592"
down_revision: str | Sequence[str] | None = "v1591"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "products",
        "barcode",
        existing_type=sa.String(length=100),
        nullable=True,
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM products WHERE barcode IS NULL) THEN
                RAISE EXCEPTION
                    'Cannot require products.barcode while products without a barcode exist';
            END IF;
        END
        $$;
        """
    )
    op.alter_column(
        "products",
        "barcode",
        existing_type=sa.String(length=100),
        nullable=False,
    )
