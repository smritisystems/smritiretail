"""Add an explicit business date to stock movements.

Revision ID: v1572
Revises: v1571
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1572"
down_revision: Union[str, Sequence[str], None] = "v1571"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if not sa.inspect(bind).has_table("stock_movements"):
        return
    existing = {column["name"] for column in sa.inspect(bind).get_columns("stock_movements")}
    if "business_date" not in existing:
        op.add_column("stock_movements", sa.Column("business_date", sa.Date(), nullable=True))
    indexes = {index["name"] for index in sa.inspect(bind).get_indexes("stock_movements")}
    if "ix_stock_movements_business_date" not in indexes:
        op.create_index("ix_stock_movements_business_date", "stock_movements", ["business_date"])


def downgrade() -> None:
    # Keep historical business-date metadata if a rollback is required.
    pass
