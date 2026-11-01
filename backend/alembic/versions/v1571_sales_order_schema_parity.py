"""Add missing Sales Order fields required by the current ORM model.

Revision ID: v1571
Revises: v1570
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "v1571"
down_revision: Union[str, Sequence[str], None] = "v1570"
branch_labels: Union[str, Sequence[str], None] = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("sales_orders"):
        return

    existing = {column["name"] for column in inspector.get_columns("sales_orders")}
    columns = (
        ("po_number", sa.Column("po_number", sa.String(100), nullable=True)),
        ("po_date", sa.Column("po_date", sa.Date(), nullable=True)),
        ("delivery_date", sa.Column("delivery_date", sa.Date(), nullable=True)),
        ("site_code", sa.Column("site_code", sa.String(50), nullable=True)),
        ("site_name", sa.Column("site_name", sa.String(255), nullable=True)),
        ("delivery_address", sa.Column("delivery_address", sa.Text(), nullable=True)),
        ("vendor_code", sa.Column("vendor_code", sa.String(50), nullable=True)),
        ("customer_id", sa.Column("customer_id", sa.String(50), nullable=True)),
        ("customer_gstin", sa.Column("customer_gstin", sa.String(50), nullable=True)),
        (
            "basic_total",
            sa.Column("basic_total", sa.Numeric(15, 2), nullable=True, server_default=sa.text("0.00")),
        ),
        (
            "is_interstate",
            sa.Column("is_interstate", sa.Boolean(), nullable=True, server_default=sa.text("true")),
        ),
        (
            "total_qty",
            sa.Column("total_qty", sa.Numeric(15, 4), nullable=True, server_default=sa.text("0.0000")),
        ),
        (
            "billed_qty",
            sa.Column("billed_qty", sa.Numeric(15, 4), nullable=True, server_default=sa.text("0.0000")),
        ),
        (
            "billed_value",
            sa.Column("billed_value", sa.Numeric(15, 2), nullable=True, server_default=sa.text("0.00")),
        ),
        (
            "pending_qty",
            sa.Column("pending_qty", sa.Numeric(15, 4), nullable=True, server_default=sa.text("0.0000")),
        ),
        (
            "pending_value",
            sa.Column("pending_value", sa.Numeric(15, 2), nullable=True, server_default=sa.text("0.00")),
        ),
        (
            "fulfillment_status",
            sa.Column(
                "fulfillment_status",
                sa.String(50),
                nullable=True,
                server_default=sa.text("'UNFULFILLED'"),
            ),
        ),
        (
            "po_metadata",
            sa.Column(
                "po_metadata",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=sa.text("'{}'::jsonb"),
            ),
        ),
    )
    for name, column in columns:
        if name not in existing:
            op.add_column("sales_orders", column)

    indexes = {index["name"] for index in sa.inspect(bind).get_indexes("sales_orders")}
    if "po_number" in existing | {name for name, _ in columns} and not {
        "ix_sales_orders_po_number",
        "idx_sales_orders_po_number",
    }.intersection(indexes):
        op.create_index("ix_sales_orders_po_number", "sales_orders", ["po_number"])
    if "customer_id" in existing | {name for name, _ in columns} and "ix_sales_orders_customer_id" not in indexes:
        op.create_index("ix_sales_orders_customer_id", "sales_orders", ["customer_id"])


def downgrade() -> None:
    # Keep additive compatibility columns to preserve production order history.
    pass
