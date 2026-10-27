"""Add canonical receiving warehouse attribution to purchase orders.

Revision ID: v1561
Revises: v1560
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "v1561"
down_revision: Union[str, None] = "v1560"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "purchase_orders",
        sa.Column(
            "warehouse_id",
            sa.String(length=50),
            sa.ForeignKey("warehouses.id", ondelete="RESTRICT"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_purchase_orders_warehouse_id",
        "purchase_orders",
        ["warehouse_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_purchase_orders_warehouse_id", table_name="purchase_orders")
    op.drop_column("purchase_orders", "warehouse_id")
