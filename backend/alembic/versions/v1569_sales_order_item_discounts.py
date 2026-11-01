"""Persist line discounts on sales orders."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "v1569"
down_revision: Union[str, Sequence[str], None] = "v1568"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sales_order_items",
        sa.Column("discount_percent", sa.Numeric(5, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "sales_order_items",
        sa.Column("discount_amount", sa.Numeric(15, 2), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("sales_order_items", "discount_amount")
    op.drop_column("sales_order_items", "discount_percent")
